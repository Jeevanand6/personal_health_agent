import io
import os
import uuid
from typing import Dict, Tuple
from fastapi import HTTPException, UploadFile, status
from PIL import Image
from app.core.config import settings
from app.core.logging import logger
from app.core.sanitizer import sanitize_filename, is_safe_path

ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}

MIME_TO_EXTENSIONS = {
    "application/pdf": [".pdf"],
    "image/jpeg": [".jpg", ".jpeg"],
    "image/jpg": [".jpg", ".jpeg"],
    "image/png": [".png"],
}

# Magic byte signatures for file verification
FILE_SIGNATURES: Dict[str, Tuple[bytes, ...]] = {
    ".pdf": (b"%PDF-", b"%PDF"),
    ".jpg": (b"\xff\xd8\xff",),
    ".jpeg": (b"\xff\xd8\xff",),
    ".png": (b"\x89PNG\r\n\x1a\n",),
}


class StorageService:
    def __init__(self, base_dir: str = settings.LOCAL_STORAGE_DIR):
        self.base_dir = os.path.abspath(base_dir)
        os.makedirs(self.base_dir, exist_ok=True)

    def _validate_magic_bytes(self, header: bytes, ext: str) -> bool:
        signatures = FILE_SIGNATURES.get(ext)
        if not signatures:
            return False
        return any(header.startswith(sig) for sig in signatures)

    def _verify_image_integrity(self, file_bytes: bytes, ext: str) -> None:
        """Uses Pillow to verify that an uploaded image file is structurally valid and not a polyglot."""
        if ext in [".jpg", ".jpeg", ".png"]:
            try:
                img_io = io.BytesIO(file_bytes)
                with Image.open(img_io) as img:
                    img.verify()
            except Exception as exc:
                logger.warning(f"Image integrity verification failed for extension {ext}: {exc}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Image verification failed: file is corrupt, malformed, or an unreadable image format.",
                )

    async def save_uploaded_file(
        self,
        upload_file: UploadFile,
        user_id: uuid.UUID,
    ) -> Dict:
        """
        Validates extension, MIME type, magic bytes, file integrity, and maximum size limit,
        then writes to disk with a cryptographically safe UUID filename.
        Guarantees path traversal prevention.
        """
        raw_filename = upload_file.filename or "unnamed_document"
        clean_original_name = sanitize_filename(raw_filename)

        # 1. Extension validation (strict whitelist)
        _, ext = os.path.splitext(clean_original_name.lower())
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file format '{ext}'. Only PDF, JPG, JPEG, and PNG files are allowed.",
            )

        # 2. Content-Type / MIME validation
        content_type = (upload_file.content_type or "").lower().strip()
        valid_exts = MIME_TO_EXTENSIONS.get(content_type)
        if not valid_exts or ext not in valid_exts:
            # Fallback normalization if browser sends generic octet-stream
            if content_type in ("", "application/octet-stream", "binary/octet-stream"):
                if ext in [".jpg", ".jpeg"]:
                    content_type = "image/jpeg"
                elif ext == ".png":
                    content_type = "image/png"
                elif ext == ".pdf":
                    content_type = "application/pdf"
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid MIME type '{upload_file.content_type}' for extension '{ext}'.",
                )

        # 3. Read initial chunk to inspect magic bytes header
        chunk = await upload_file.read(4096)
        if not chunk:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The uploaded file is empty.",
            )

        if not self._validate_magic_bytes(chunk, ext):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File header does not match declared type (magic byte validation failed).",
            )

        # 4. Generate secure random UUID filename (completely decoupling stored path from user input)
        document_id = uuid.uuid4()
        safe_filename = f"{document_id}{ext}"
        destination_path = os.path.abspath(os.path.join(self.base_dir, safe_filename))

        # Path traversal guard
        if not is_safe_path(destination_path, self.base_dir):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid file path detected.",
            )

        # 5. Stream and verify size limit
        total_size = len(chunk)
        collected_chunks = [chunk]

        try:
            with open(destination_path, "wb") as out_file:
                out_file.write(chunk)
                while True:
                    next_chunk = await upload_file.read(65536)
                    if not next_chunk:
                        break
                    total_size += len(next_chunk)
                    if total_size > settings.MAX_UPLOAD_SIZE_BYTES:
                        raise HTTPException(
                            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                            detail=f"File exceeds maximum size limit of {settings.MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)} MB.",
                        )
                    out_file.write(next_chunk)
                    if ext in [".jpg", ".jpeg", ".png"] and total_size <= 5242880:
                        collected_chunks.append(next_chunk)

            # 6. For images, perform Pillow integrity verification on the collected data
            if ext in [".jpg", ".jpeg", ".png"]:
                full_image_bytes = b"".join(collected_chunks)
                self._verify_image_integrity(full_image_bytes, ext)

        except Exception:
            # Clean up partial file on failure or abort
            if os.path.exists(destination_path):
                try:
                    os.remove(destination_path)
                except OSError:
                    pass
            raise

        logger.info(
            f"Stored document {document_id} ({total_size} bytes) securely for user {user_id}"
        )

        return {
            "id": document_id,
            "filename": safe_filename,
            "original_filename": clean_original_name,
            "mime_type": content_type,
            "file_size": total_size,
            "storage_path": destination_path,
        }

    def delete_file(self, storage_path: str) -> bool:
        """Removes the file safely from the disk volume with path traversal validation."""
        try:
            if not is_safe_path(storage_path, self.base_dir):
                logger.warning(f"Unsafe path traversal attempt blocked during delete: {storage_path}")
                return False

            abs_path = os.path.abspath(storage_path)
            if os.path.exists(abs_path):
                os.remove(abs_path)
                logger.info(f"Removed file from disk: {abs_path}")
                return True
        except Exception as exc:
            logger.error(f"Error deleting file {storage_path}: {exc}")
        return False

    def validate_stored_file(self, storage_path: str) -> bool:
        """Verifies that a stored file exists and is within the safe storage directory."""
        if not storage_path or not is_safe_path(storage_path, self.base_dir):
            return False
        return os.path.exists(os.path.abspath(storage_path))


storage_service = StorageService()
