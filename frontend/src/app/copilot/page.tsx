"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import {
  chatWithCopilotApi,
  fetchChatSessionsApi,
  fetchChatSessionDetailApi,
  deleteChatSessionApi,
  getDocumentsApi,
  CopilotChatResponse,
  SourceReference,
  ChatSessionSummary,
  ChatMessageItem,
  MedicalDocument,
} from "@/lib/api";
import {
  Bot,
  Send,
  Sparkles,
  RotateCw,
  Plus,
  Trash2,
  FileText,
  ShieldAlert,
  ChevronRight,
  ExternalLink,
  Info,
  Clock,
  Layers,
  CheckCircle2,
  AlertTriangle,
  History,
  X,
  Search,
  MessageSquare,
  ArrowRight,
  Stethoscope,
} from "lucide-react";

interface DisplayMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  sources?: SourceReference[];
  disclaimer?: string;
  confidence?: number;
  timestamp: string;
}

function CopilotChatContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, token, isLoading: authLoading } = useAuth();
  const { language, setLanguage, isTamil, t } = useLanguage();

  const urlDocId = searchParams.get("document_id");

  // State
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(urlDocId || null);
  const [userDocuments, setUserDocuments] = useState<MedicalDocument[]>([]);
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  // Load user's documents and sessions on mount
  useEffect(() => {
    if (token) {
      loadDocuments();
      loadSessions();
    }
  }, [token]);

  // Update selected doc if URL query param changes
  useEffect(() => {
    if (urlDocId) {
      setSelectedDocumentId(urlDocId);
    }
  }, [urlDocId]);

  const loadDocuments = async () => {
    if (!token) return;
    try {
      const docs = await getDocumentsApi(token);
      setUserDocuments(docs);
    } catch {
      // Non-critical if list fails
    }
  };

  const loadSessions = async () => {
    if (!token) return;
    try {
      const s = await fetchChatSessionsApi(token);
      setSessions(s);
    } catch {
      // Non-critical
    }
  };

  const handleSelectSession = async (sessionId: string) => {
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
        timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }));
      setMessages(formatted);
      setShowHistoryModal(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load session.";
      setErrorMessage(msg);
    }
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!token) return;
    try {
      await deleteChatSessionApi(sessionId, token);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        handleNewChat();
      }
    } catch {
      // Non-critical
    }
  };

  const handleNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
    setInputMessage("");
    setErrorMessage(null);
  };

  const selectedDocObj = userDocuments.find((d) => d.id === selectedDocumentId);

  // Dynamic suggested quick questions
  const getSuggestedQuestions = () => {
    if (selectedDocObj) {
      const type = selectedDocObj.document_type.toUpperCase();
      if (type.includes("PRESCRIPTION")) {
        return isTamil
          ? [
              "மருத்துவர் யார்?",
              "மருந்துச் சீட்டில் என்ன மருந்துகள் உள்ளன?",
              "இந்த மருந்துச் சீட்டை தமிழில் விளக்கவும்.",
              "மருந்துகளின் அளவை அதிகரிக்கலாமா?",
            ]
          : [
              "Who is my doctor?",
              "What medicines did my doctor prescribe?",
              "What is the dosage of Azithromycin?",
              "Explain this prescription in simple terms.",
            ];
      }
      if (type.includes("LAB") || type.includes("REPORT") || type.includes("DIAGNOSTIC")) {
        return isTamil
          ? [
              "எனது ஆய்வக அறிக்கையில் உள்ள மாறுபட்ட (Abnormal) முடிவுகள் என்ன?",
              "எனது சமீபத்திய குளுக்கோஸ் அளவு என்ன?",
              "இந்த அறிக்கையை தமிழில் விளக்கவும்.",
              "எனது இரத்த அழுத்தம் என்ன?",
            ]
          : [
              "Which lab values are abnormal?",
              "What was my glucose value?",
              "Explain this laboratory report in simple language.",
              "What is my blood pressure?",
            ];
      }
    }

    return isTamil
      ? [
          "எனது மருத்துவர் யார்?",
          "எனது பதிவேற்றப்பட்ட மருந்துகளின் பட்டியல் என்ன?",
          "எனது மாறுபட்ட ஆய்வக முடிவுகள் என்ன?",
          "எனது மருத்துவ ஆவணங்களின் சுருக்கத்தைத் தருக.",
        ]
      : [
          "Who is my doctor?",
          "What medicines appear in my records?",
          "Which lab values are abnormal?",
          "Give me a summary of my uploaded medical records.",
        ];
  };

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
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      loadSessions(); // refresh history list
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Health Copilot could not complete your request. Please try again.";
      setErrorMessage(msg);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
      {/* Top Copilot Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 border-b border-slate-200 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-500 flex items-center justify-center text-white shadow-md shadow-teal-500/20">
            <Bot className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                {isTamil ? "தனிப்பட்ட நல்வாழ்வு கோபைலட்" : "Personal Health Copilot"}
              </h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 border border-teal-200">
                <Sparkles className="w-3 h-3 text-teal-600" />
                RAG Grounded
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {isTamil
                ? "உங்கள் பதிவேற்றப்பட்ட ஆவணங்கள் & மருத்துவத் தரவுகளிலிருந்து மட்டுமே பதிலளிக்கிறது."
                : "Answers strictly grounded in your verified medical records & OCR documents."}
            </p>
          </div>
        </div>

        {/* Mode Selector & Action Buttons */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Document Scope Selector */}
          <div className="flex items-center gap-1.5 bg-slate-100/90 rounded-xl p-1 border border-slate-200 text-xs">
            <button
              onClick={() => setSelectedDocumentId(null)}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                !selectedDocumentId
                  ? "bg-white text-teal-800 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {isTamil ? "அனைத்து ஆவணங்கள்" : "All Records"}
            </button>

            <select
              value={selectedDocumentId || ""}
              onChange={(e) => setSelectedDocumentId(e.target.value || null)}
              className={`px-2 py-1 rounded-lg font-semibold bg-transparent border-0 text-xs cursor-pointer focus:ring-0 ${
                selectedDocumentId ? "bg-white text-teal-800 shadow-sm" : "text-slate-600"
              }`}
            >
              <option value="">{isTamil ? "குறிப்பிட்ட ஆவணம்..." : "Filter Document..."}</option>
              {userDocuments.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.original_filename.length > 25
                    ? doc.original_filename.slice(0, 22) + "..."
                    : doc.original_filename}
                </option>
              ))}
            </select>
          </div>

          {/* Language Switcher */}
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-0.5">
            <button
              onClick={() => setLanguage("en")}
              className={`px-2 py-1 text-xs font-bold rounded-lg transition-all ${
                language === "en" ? "bg-white text-teal-800 shadow-sm" : "text-slate-600"
              }`}
            >
              EN
            </button>
            <button
              onClick={() => setLanguage("ta")}
              className={`px-2 py-1 text-xs font-bold rounded-lg transition-all ${
                language === "ta" ? "bg-white text-teal-800 shadow-sm" : "text-slate-600"
              }`}
            >
              தமிழ்
            </button>
          </div>

          {/* New Chat Button */}
          <button
            onClick={handleNewChat}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-teal-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition shadow-xs"
            title="Start new conversation"
          >
            <Plus className="w-3.5 h-3.5 text-teal-600" />
            <span>{isTamil ? "புதிய அரட்டை" : "New Chat"}</span>
          </button>

          {/* Sessions History Drawer Trigger */}
          <button
            onClick={() => setShowHistoryModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-teal-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition shadow-xs"
            title="View Past Consultation History"
          >
            <History className="w-3.5 h-3.5 text-teal-600" />
            <span>{isTamil ? "வரலாறு" : "History"}</span>
          </button>
        </div>
      </div>

      {/* Active Document Notification Strip if in Document Mode */}
      {selectedDocObj && (
        <div className="mt-2 px-3 py-1.5 rounded-xl bg-teal-50 border border-teal-200/80 flex items-center justify-between text-xs text-teal-900">
          <div className="flex items-center gap-2 truncate">
            <FileText className="w-4 h-4 text-teal-700 shrink-0" />
            <span className="font-semibold">{isTamil ? "தேர்ந்தெடுக்கப்பட்ட ஆவணம்:" : "Target Document:"}</span>
            <span className="font-medium underline truncate">{selectedDocObj.original_filename}</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-200/60 text-teal-800">
              {selectedDocObj.document_type}
            </span>
          </div>
          <button
            onClick={() => setSelectedDocumentId(null)}
            className="text-xs font-semibold text-teal-700 hover:text-teal-900 ml-2 shrink-0 underline"
          >
            {isTamil ? "அனைத்து ஆவணங்களுக்கும் திரும்பு" : "Switch to All Records"}
          </button>
        </div>
      )}

      {/* Messages Stream Container */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
        {messages.length === 0 ? (
          /* Empty / Welcome State */
          <div className="h-full flex flex-col items-center justify-center text-center px-4 max-w-xl mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600 mb-3 shadow-inner">
              <Bot className="w-8 h-8 stroke-[2.2]" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-1">
              {isTamil ? "மருத்துவக் கோபைலட் தயார்" : "How can I help with your health records?"}
            </h2>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              {isTamil
                ? "உங்கள் பதிவேற்றப்பட்ட மருந்துச் சீட்டுகள், ஆய்வக முடிவுகள், மற்றும் மருத்துவ வரலாறு பற்றி பாதுகாப்பாக வினவலாம். அனைத்து பதில்களும் உங்கள் ஆவணங்களின் அடிப்படையில் மட்டுமே உருவாக்கப்படும்."
                : "Ask questions about your uploaded prescriptions, lab reports, observations, or medical history. Answers are strictly verified against your authorized health records."}
            </p>

            {/* Quick Suggested Prompts Grid */}
            <div className="w-full space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 text-left">
                {isTamil ? "பரிந்துரைக்கப்படும் கேள்விகள்:" : "Suggested Questions:"}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                {getSuggestedQuestions().map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(q)}
                    className="p-3 rounded-xl border border-slate-200/80 bg-white hover:border-teal-300 hover:bg-teal-50/40 text-xs font-medium text-slate-700 hover:text-teal-900 transition flex items-center justify-between group text-left shadow-2xs"
                  >
                    <span>{q}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-teal-600 shrink-0 ml-2" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Message List */
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.role === "user" ? "items-end" : "items-start"
              }`}
            >
              <div
                className={`max-w-[88%] sm:max-w-[80%] rounded-2xl p-4 shadow-sm text-xs leading-relaxed ${
                  msg.role === "user"
                    ? "bg-teal-600 text-white rounded-br-xs"
                    : "bg-white text-slate-800 border border-slate-200/90 rounded-bl-xs"
                }`}
              >
                {/* Assistant Header Avatar */}
                {msg.role === "assistant" && (
                  <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-1.5 font-bold text-teal-800">
                      <Bot className="w-3.5 h-3.5" />
                      <span>{isTamil ? "ஹெல்த் கோபைலட்" : "Health Copilot"}</span>
                    </div>
                    {msg.confidence !== undefined && (
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          msg.confidence > 0 && msg.sources && msg.sources.length > 0
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-slate-100 text-slate-500 border border-slate-200"
                        }`}
                      >
                        {msg.confidence > 0 && msg.sources && msg.sources.length > 0 ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>{isTamil ? "ஆவணங்களில் சரிபார்க்கப்பட்டது" : "Based on your uploaded records"}</span>
                          </>
                        ) : (
                          <>
                            <Info className="w-3 h-3 text-slate-400" />
                            <span>{isTamil ? "ஆவணங்களில் விபரம் இல்லை" : "Information absent from records"}</span>
                          </>
                        )}
                      </span>
                    )}
                  </div>
                )}

                {/* Message Content Body */}
                <div className="whitespace-pre-wrap">
                  {msg.content
                    .replace(/<<<UNTRUSTED[A-Z_]*>>>/g, "")
                    .replace(/--- (?:End )?Excerpt ---/g, "")
                    .trim()}
                </div>

                {/* Source Attribution Cards (Phase 13 Grounded Retrieval) */}
                {msg.role === "assistant" && msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                      <Layers className="w-3.5 h-3.5 text-teal-600" />
                      <span>{isTamil ? "ஆதார ஆவணங்கள் (Sources):" : "Verified Sources:"}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.sources.map((src, sIdx) => (
                        <div
                          key={sIdx}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-700 hover:bg-teal-50 hover:border-teal-300 transition"
                        >
                          <FileText className="w-3 h-3 text-teal-600" />
                          <span className="font-semibold truncate max-w-[150px]">
                            {src.document_name}
                          </span>
                          {src.page && (
                            <span className="text-[10px] text-slate-500">
                              (P. {src.page})
                            </span>
                          )}
                          {src.document_id && (
                            <Link
                              href={`/documents/${src.document_id}`}
                              className="text-teal-600 hover:text-teal-800 ml-0.5"
                              title="View Document Details"
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
                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-start gap-1.5 text-[10px] text-slate-500 leading-normal">
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

        {/* Sending / Processing Skeleton */}
        {isSending && (
          <div className="flex flex-col items-start">
            <div className="max-w-[80%] rounded-2xl p-4 bg-white border border-slate-200 text-xs text-slate-600 shadow-sm flex items-center gap-3">
              <RotateCw className="w-4 h-4 text-teal-600 animate-spin" />
              <div className="flex flex-col gap-0.5">
                <span className="font-semibold text-slate-800">
                  {isTamil ? "மருத்துவத் தரவுகளை ஆய்வு செய்கிறது..." : "Retrieving verified clinical records..."}
                </span>
                <span className="text-[11px] text-slate-400">
                  {isTamil ? "பாதுகாப்பான RAG பகுப்பாய்வு..." : "Performing semantic search & clinical reasoning..."}
                </span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error Message Alert */}
      {errorMessage && (
        <div className="mb-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => handleSendMessage()}
            className="text-xs font-bold underline hover:text-rose-950 ml-3"
          >
            {isTamil ? "மீண்டும் முயற்சி செய்" : "Retry"}
          </button>
        </div>
      )}

      {/* Bottom Input Area */}
      <div className="pt-2 border-t border-slate-200">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2 bg-white rounded-2xl border border-slate-300 focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-100 p-1.5 shadow-sm transition"
        >
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder={
              selectedDocObj
                ? isTamil
                  ? `இந்த ஆவணத்தைப் பற்றி கேளுங்கள் (${selectedDocObj.original_filename})...`
                  : `Ask about this document (${selectedDocObj.original_filename})...`
                : isTamil
                ? "உங்கள் மருத்துவ பதிவுகள் பற்றி கேளுங்கள்..."
                : "Ask about prescriptions, glucose, lab reports, medications..."
            }
            disabled={isSending}
            className="flex-1 px-3 py-2 text-xs text-slate-800 placeholder-slate-400 bg-transparent focus:outline-hidden disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!inputMessage.trim() || isSending}
            className="p-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:bg-slate-200 text-white disabled:text-slate-400 transition shadow-xs flex items-center justify-center shrink-0"
            title="Send Message"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        <p className="text-[10px] text-slate-400 text-center mt-1.5">
          {isTamil
            ? "கோபைலட் உங்கள் ஆவணங்களிலிருந்து மட்டுமே பதிலளிக்கிறது; மருத்துவ நோயறிதல் அல்ல."
            : "Health Copilot is grounded in your uploaded records and does not replace medical consultation."}
        </p>
      </div>

      {/* Past Sessions History Modal / Drawer */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-teal-600" />
                <h3 className="font-bold text-sm text-slate-900">
                  {isTamil ? "கடந்த ஆலோசனை வரலாறு" : "Consultation History"}
                </h3>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 max-h-[60vh] overflow-y-auto space-y-2">
              {sessions.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  {isTamil ? "வரலாறு எதுவும் இல்லை." : "No previous consultation history found."}
                </div>
              ) : (
                sessions.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => handleSelectSession(s.id)}
                    className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between text-xs group ${
                      activeSessionId === s.id
                        ? "border-teal-500 bg-teal-50/60 text-teal-900 font-semibold"
                        : "border-slate-200 hover:border-teal-300 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className="truncate mr-2">
                      <p className="truncate font-medium">{s.title}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {new Date(s.updated_at).toLocaleDateString()} • {s.message_count} {isTamil ? "செய்திகள்" : "messages"}
                        {s.document_name ? ` • ${s.document_name}` : ""}
                      </p>
                    </div>
                    <button
                      onClick={(e) => handleDeleteSession(s.id, e)}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition shrink-0"
                      title="Delete Session"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200"
              >
                {isTamil ? "மூடு" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CopilotPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <RotateCw className="w-8 h-8 text-teal-600 animate-spin" />
        </div>
      }
    >
      <CopilotChatContent />
    </Suspense>
  );
}
