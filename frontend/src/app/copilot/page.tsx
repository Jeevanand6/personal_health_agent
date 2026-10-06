"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Bot,
  Send,
  Sparkles,
  FileText,
  Layers,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  Plus,
  ChevronDown,
  CheckCircle2,
  Info,
  Clock,
  Check,
  AlertCircle,
  CornerDownLeft,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import {
  chatWithCopilotApi,
  getDocumentsApi,
  fetchChatSessionDetailApi,
  MedicalDocument,
  SourceReference,
  CopilotChatResponse,
} from "@/lib/api";

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: SourceReference[];
  disclaimer?: string;
  confidence?: number;
  mode?: string;
  timestamp: string;
}

function CopilotChatContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, token, isLoading: authLoading } = useAuth();
  const { language, isTamil, t } = useLanguage();

  const urlDocId = searchParams.get("document_id");
  const urlSessionId = searchParams.get("session_id");

  // State
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(urlSessionId || null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(urlDocId || null);
  const [userDocuments, setUserDocuments] = useState<MedicalDocument[]>([]);
  const [docDropdownOpen, setDocDropdownOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending]);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  // Load user documents on mount
  useEffect(() => {
    if (token) {
      loadDocuments();
    }
  }, [token]);

  // Handle URL session_id changes
  useEffect(() => {
    if (urlSessionId && urlSessionId !== activeSessionId) {
      loadSessionById(urlSessionId);
    }
  }, [urlSessionId, token]);

  // Handle URL document_id changes
  useEffect(() => {
    if (urlDocId) {
      setSelectedDocumentId(urlDocId);
    }
  }, [urlDocId]);

  // Listen for global custom events from the left sidebar
  useEffect(() => {
    const handleGlobalNewChat = () => {
      handleNewChat();
    };
    const handleGlobalSessionDelete = (e: Event) => {
      const customEvent = e as CustomEvent<{ sessionId: string }>;
      if (customEvent.detail?.sessionId === activeSessionId) {
        handleNewChat();
      }
    };

    window.addEventListener("health_copilot_new_chat", handleGlobalNewChat);
    window.addEventListener("health_copilot_session_deleted", handleGlobalSessionDelete);
    return () => {
      window.removeEventListener("health_copilot_new_chat", handleGlobalNewChat);
      window.removeEventListener("health_copilot_session_deleted", handleGlobalSessionDelete);
    };
  }, [activeSessionId]);

  const loadDocuments = async () => {
    if (!token) return;
    try {
      const docs = await getDocumentsApi(token);
      setUserDocuments(docs);
    } catch {
      // Non-critical background failure
    }
  };

  const loadSessionById = async (sessionId: string) => {
    if (!token) return;
    try {
      setErrorMessage(null);
      const detail = await fetchChatSessionDetailApi(sessionId, token);
      setActiveSessionId(detail.id);
      setSelectedDocumentId(detail.document_id || null);

      const formatted: DisplayMessage[] = detail.messages.map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
        sources: m.sources,
        disclaimer: m.disclaimer || undefined,
        timestamp: new Date(m.created_at).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      }));
      setMessages(formatted);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load session.";
      setErrorMessage(msg);
    }
  };

  const handleNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
    setInputMessage("");
    setErrorMessage(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    router.replace("/copilot");
  };

  const selectedDocObj = userDocuments.find((d) => d.id === selectedDocumentId);

  // Suggested prompt pills
  const suggestedPrompts = [
    {
      en: "Who is my doctor?",
      ta: "எனது மருத்துவர் யார்?",
    },
    {
      en: "What medicines did my doctor prescribe?",
      ta: "மருத்துவர் என்ன மருந்துகளை பரிந்துரைத்தார்?",
    },
    {
      en: "What is my HbA1c?",
      ta: "எனது HbA1c அளவு என்ன?",
    },
    {
      en: "Which values are abnormal?",
      ta: "மாறுபட்ட ஆய்வக முடிவுகள் என்ன?",
    },
    {
      en: "Explain my prescription.",
      ta: "எனது மருந்துச் சீட்டை விளக்கவும்.",
    },
  ];

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isSending || !token) return;

    setErrorMessage(null);
    const userMsgId = `user_${Date.now()}`;
    const userMsg: DisplayMessage = {
      id: userMsgId,
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    setIsSending(true);

    try {
      const res: CopilotChatResponse = await chatWithCopilotApi(
        {
          message: text,
          document_id: selectedDocumentId,
          session_id: activeSessionId,
          language: language === "ta" ? "ta" : "en",
        },
        token
      );

      setActiveSessionId(res.session_id);

      const assistantMsg: DisplayMessage = {
        id: res.message_id || `asst_${Date.now()}`,
        role: "assistant",
        content: res.answer,
        sources: res.sources,
        disclaimer: res.disclaimer,
        confidence: res.confidence,
        mode: res.mode,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // Notify sidebar to refresh recent sessions
      window.dispatchEvent(new CustomEvent("health_copilot_session_updated"));
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Health Copilot could not complete your inquiry. Please try again.";
      setErrorMessage(msg);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const cleanMessageContent = (text: string) => {
    return text
      .replace(/<<<UNTRUSTED[A-Z_]*>>>/g, "")
      .replace(/--- (?:End )?Excerpt ---/g, "")
      .trim();
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/60 relative overflow-hidden">
      {/* 1. Subtle Context Header Strip (Requirement 7 & 8) */}
      <div className="border-b border-slate-200/80 bg-white/90 backdrop-blur px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 shrink-0 z-10 shadow-2xs">
        {/* Document Context Selector (Requirement 8) */}
        <div className="relative">
          <button
            onClick={() => setDocDropdownOpen(!docDropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 text-xs font-medium text-slate-700 transition shadow-2xs"
          >
            {selectedDocObj ? (
              <>
                <FileText className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                <span className="font-semibold text-slate-800 max-w-[160px] sm:max-w-[240px] truncate">
                  {selectedDocObj.original_filename}
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800 uppercase">
                  {selectedDocObj.document_type}
                </span>
              </>
            ) : (
              <>
                <Layers className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                <span className="font-semibold text-slate-800">
                  {isTamil ? "அனைத்து மருத்துவ ஆவணங்கள்" : "All Uploaded Health Records"}
                </span>
              </>
            )}
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1 shrink-0" />
          </button>

          {/* Document Context Selector Dropdown Popover */}
          {docDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setDocDropdownOpen(false)}
              />
              <div className="absolute left-0 top-full mt-1.5 w-72 sm:w-80 rounded-2xl bg-white border border-slate-200 shadow-xl z-40 p-2 space-y-1 max-h-72 overflow-y-auto animate-in fade-in duration-150">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2.5 py-1">
                  {isTamil ? "ஆவணத்தின் வரம்பை தேர்வு செய்க" : "Select Retrieval Scope"}
                </div>
                {/* Option: All Records */}
                <button
                  onClick={() => {
                    setSelectedDocumentId(null);
                    setDocDropdownOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs text-left transition ${
                    selectedDocumentId === null
                      ? "bg-teal-50 text-teal-900 font-bold border border-teal-200/80"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Layers className="w-4 h-4 text-teal-600 shrink-0" />
                    <span>{isTamil ? "அனைத்து ஆவணங்கள் (All Records)" : "All Health Records"}</span>
                  </div>
                  {selectedDocumentId === null && (
                    <Check className="w-4 h-4 text-teal-600 shrink-0" />
                  )}
                </button>

                {/* Individual Uploaded Documents */}
                {userDocuments.map((doc) => {
                  const isSelected = selectedDocumentId === doc.id;
                  return (
                    <button
                      key={doc.id}
                      onClick={() => {
                        setSelectedDocumentId(doc.id);
                        setDocDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs text-left transition ${
                        isSelected
                          ? "bg-teal-50 text-teal-900 font-bold border border-teal-200/80"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 text-teal-600 shrink-0" />
                        <div className="truncate">
                          <div className="font-semibold truncate">{doc.original_filename}</div>
                          <span className="text-[10px] text-slate-400 uppercase font-medium">
                            {doc.document_type}
                          </span>
                        </div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-teal-600 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* New Chat Button (Requirement 9) */}
        <button
          onClick={handleNewChat}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 hover:text-slate-900 transition shadow-2xs"
          title="Start fresh consultation"
        >
          <Plus className="w-3.5 h-3.5 text-teal-600" />
          <span>{isTamil ? "புதிய உரையாடல்" : "New Chat"}</span>
        </button>
      </div>

      {/* 2. Messages Conversation Stream Area (ChatGPT Style) */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-12 lg:px-24 py-6 space-y-6 max-w-4xl mx-auto w-full">
        {errorMessage && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {messages.length === 0 ? (
          /* Empty / Welcome State (ChatGPT Style) */
          <div className="h-full flex flex-col items-center justify-center text-center px-4 py-8 max-w-xl mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center text-white mb-4 shadow-lg shadow-teal-500/20">
              <Bot className="w-9 h-9 stroke-[2.2]" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">
              {isTamil ? "மருத்துவக் கோபைலட் தயார்" : "How can I help with your health records?"}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mb-8 leading-relaxed max-w-md">
              {isTamil
                ? "உங்கள் பதிவேற்றப்பட்ட மருந்துச் சீட்டுகள், ஆய்வக முடிவுகள் மற்றும் மருத்துவ வரலாறு பற்றி பாதுகாப்பாக வினவலாம். அனைத்து பதில்களும் உங்கள் ஆவணங்களின் அடிப்படையில் மட்டுமே உருவாக்கப்படும்."
                : "Ask questions about your uploaded prescriptions, lab reports, observations, or medical history. Answers are strictly verified against your authorized health records."}
            </p>

            {/* Suggested Prompt Cards */}
            <div className="w-full space-y-2.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 text-left px-1">
                {isTamil ? "பரிந்துரைக்கப்படும் வினாக்கள்:" : "Suggested Questions:"}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                {suggestedPrompts.map((item, idx) => {
                  const text = isTamil ? item.ta : item.en;
                  return (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(text)}
                      className="p-3.5 rounded-2xl border border-slate-200/90 bg-white hover:border-teal-400 hover:bg-teal-50/40 text-xs font-medium text-slate-700 hover:text-teal-950 transition flex items-center justify-between group shadow-2xs hover:shadow-xs text-left"
                    >
                      <span className="line-clamp-2">{text}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-teal-600 shrink-0 ml-2 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* Conversation Messages List */
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.role === "user" ? "items-end" : "items-start"
              }`}
            >
              <div
                className={`max-w-[92%] sm:max-w-[85%] rounded-2xl p-4 sm:p-5 text-xs sm:text-sm leading-relaxed transition-all ${
                  msg.role === "user"
                    ? "bg-slate-900 text-white rounded-tr-xs shadow-sm ml-8"
                    : "bg-white text-slate-800 border border-slate-200/90 rounded-tl-xs shadow-sm mr-8"
                }`}
              >
                {/* Assistant Header Avatar & Grounding Badge */}
                {msg.role === "assistant" && (
                  <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-slate-100">
                    <div className="flex items-center gap-2 font-bold text-teal-800">
                      <div className="w-5 h-5 rounded-md bg-teal-100 flex items-center justify-center text-teal-700">
                        <Bot className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs">{isTamil ? "ஹெல்த் கோபைலட்" : "Health Copilot"}</span>
                    </div>

                    {msg.mode === "general" ? (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-full font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                        <Sparkles className="w-3 h-3 text-indigo-600" />
                        <span>{isTamil ? "பொதுவான AI உதவி" : "General AI Assistant"}</span>
                      </span>
                    ) : msg.mode === "current_web" ? (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-full font-medium bg-sky-50 text-sky-700 border border-sky-200">
                        <ExternalLink className="w-3 h-3 text-sky-600" />
                        <span>{isTamil ? "நேரலை இணையத் தகவல்" : "Live Web Information"}</span>
                      </span>
                    ) : msg.mode === "mixed_health" ? (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-full font-medium bg-teal-50 text-teal-800 border border-teal-200">
                        <CheckCircle2 className="w-3 h-3 text-teal-600" />
                        <span>{isTamil ? "ஆவணங்கள் + மருத்துவ அறிவு" : "Records + Medical Knowledge"}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>{isTamil ? "ஆவணங்களில் சரிபார்க்கப்பட்டது" : "Based on your uploaded records"}</span>
                      </span>
                    )}
                  </div>
                )}

                {/* Message Content Body */}
                <div className="whitespace-pre-wrap font-sans text-slate-800 leading-relaxed">
                  {cleanMessageContent(msg.content)}
                </div>

                {/* Verified Source Attribution Cards */}
                {msg.role === "assistant" && msg.sources && msg.sources.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                      <Layers className="w-3.5 h-3.5 text-teal-600" />
                      <span>{isTamil ? "ஆதார ஆவணங்கள்:" : "Verified Sources:"}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.sources.map((src, sIdx) => (
                        <div
                          key={sIdx}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-700 hover:bg-teal-50 hover:border-teal-300 transition"
                        >
                          <FileText className="w-3 h-3 text-teal-600" />
                          <span className="font-semibold truncate max-w-[160px]">
                            {src.document_name}
                          </span>
                          {src.page && (
                            <span className="text-[10px] text-slate-400">
                              (P. {src.page})
                            </span>
                          )}
                          {src.document_id && (
                            <Link
                              href={`/documents/${src.document_id}`}
                              className="text-teal-600 hover:text-teal-800 ml-0.5"
                              title="View Document"
                              target="_blank"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Medical Safety Disclaimer Strip */}
                {msg.role === "assistant" && msg.disclaimer && (
                  <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-start gap-1.5 text-[10px] text-slate-400 leading-normal">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <span>{msg.disclaimer}</span>
                  </div>
                )}
              </div>

              {/* Timestamp */}
              <span className="text-[10px] text-slate-400 mt-1 px-1">
                {msg.timestamp}
              </span>
            </div>
          ))
        )}

        {/* Loading / Thinking Animation State (Requirement 6) */}
        {isSending && (
          <div className="flex items-start gap-3 animate-in fade-in">
            <div className="w-7 h-7 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 shrink-0 mt-1">
              <Bot className="w-4 h-4 animate-spin text-teal-600" />
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                <span className="inline-block w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                <span>
                  {isTamil
                    ? "ஆவணங்களை சரிபார்த்து விடை தயாரிக்கிறது..."
                    : "Analyzing verified records..."}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 3. Bottom Prompt Input Container (ChatGPT Style) */}
      <div className="shrink-0 max-w-4xl mx-auto w-full px-4 sm:px-6 pb-4 pt-1 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent">
        <div className="relative rounded-2xl border border-slate-300/80 bg-white shadow-lg focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-500/20 transition-all p-2 sm:p-2.5 flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={inputMessage}
            onChange={(e) => {
              setInputMessage(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              isTamil
                ? "மருத்துவப் பதிவுகள், மருத்துவ அறிவு அல்லது பொதுவான கேள்விகளைக் கேட்கவும்..."
                : "Ask about your health records, medical questions, or general topics (e.g. Python, workout, weather)..."
            }
            rows={1}
            disabled={isSending}
            className="flex-1 max-h-36 resize-none bg-transparent py-1.5 px-2 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-hidden disabled:opacity-50"
          />

          <button
            onClick={() => handleSendMessage()}
            disabled={!inputMessage.trim() || isSending}
            className="w-9 h-9 rounded-xl bg-teal-600 hover:bg-teal-500 text-white flex items-center justify-center disabled:opacity-30 disabled:hover:bg-teal-600 transition shadow-sm shrink-0 active:scale-95"
            title="Send Message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        {/* Micro-Disclaimer Note */}
        <p className="text-center text-[10px] text-slate-400 mt-2">
          {isTamil
            ? "ஹெல்த் கோபைலட் உங்கள் பதிவேற்றப்பட்ட ஆவணங்களின் அடிப்படையில் பதிலளிக்கிறது. மருத்துவ ஆலோசனைகளுக்கு மருத்துவரை அணுகவும்."
            : "Health Copilot is grounded in your uploaded records and does not substitute professional medical advice."}
        </p>
      </div>
    </div>
  );
}

export default function CopilotPage() {
  return (
    <Suspense
      fallback={
        <div className="h-full flex items-center justify-center text-slate-500 text-xs">
          Loading Health Copilot...
        </div>
      }
    >
      <CopilotChatContent />
    </Suspense>
  );
}
