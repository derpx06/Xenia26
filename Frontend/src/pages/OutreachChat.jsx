import { useEffect, useRef, useState } from "react";
import { Send, Mail, Phone, X, Loader2, Sparkles, ChevronRight, ChevronLeft, Volume2, Settings2, Paperclip } from "lucide-react";
import Sidebar from "../components/Sidebar";
import MarkdownRenderer from "../components/MarkdownRenderer";
import MessageAudioPlayer from "../components/thread/messages/MessageAudioPlayer";
import { EmailPreviewCard } from "../components/thread/messages/EmailPreviewCard";
import { WhatsAppPreviewCard } from "../components/thread/messages/WhatsAppPreviewCard";
import { LinkedInPreviewCard } from "../components/thread/messages/LinkedInPreviewCard";
import ContactInputStep from "../components/ContactInputStep";
import ChatSidebar from "../components/ChatSidebar";
import { useDebounce } from "use-debounce";
import { motion, AnimatePresence } from "framer-motion";

const CarouselContainer = ({ children }) => {
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [children]);

  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -300 : 300;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      setTimeout(checkScroll, 300);
    }
  };

  return (
    <div className="relative group w-full mt-4">
      {/* Left Button */}
      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-20 p-2 bg-black/60 text-white rounded-full backdrop-blur-md hover:bg-black/80 transition-all shadow-xl -ml-2 sm:-ml-4 border border-white/10"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}

      {/* Container */}
      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory items-start scrollbar-hide w-full"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {children}
      </div>

      {/* Right Button */}
      {canScrollRight && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-20 p-2 bg-black/60 text-white rounded-full backdrop-blur-md hover:bg-black/80 transition-all shadow-xl -mr-2 sm:-mr-4 border border-white/10"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};

const API_BASE_URL = "http://127.0.0.1:8000";
const BACKEND_API_URL = "http://localhost:8080/api";

export default function OutreachChat() {
  // --- UI STATE ---
  const [hasStarted, setHasStarted] = useState(false);
  const [agentStatus, setAgentStatus] = useState("Idle");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Default closed as per request

  // --- LOGIC STATE ---
  // --- LOGIC STATE ---
  const [chatSessions, setChatSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]); // Loaded from DB or empty
  const [messagesDebounced] = useDebounce(messages, 2000); // Auto-save trigger
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [activeSendFlow, setActiveSendFlow] = useState(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [playingAudioMsgId, setPlayingAudioMsgId] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [senderIdentity, setSenderIdentity] = useState({ name: "", email: "" });
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);

  // --- MENTIONS STATE ---
  const [contacts, setContacts] = useState([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [cursorPosition, setCursorPosition] = useState(null);
  const [mentionStartPos, setMentionStartPos] = useState(null);
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);
  const [mentionedContacts, setMentionedContacts] = useState([]); // Track selected mentions
  const [defaultVoices, setDefaultVoices] = useState([]);
  const [customVoices, setCustomVoices] = useState([]);
  const [voiceMode, setVoiceMode] = useState("auto"); // auto | default | custom
  const [selectedDefaultVoice, setSelectedDefaultVoice] = useState("");
  const [selectedCustomVoiceId, setSelectedCustomVoiceId] = useState("");
  const [ttsAvailable, setTtsAvailable] = useState(false);
  const [ttsError, setTtsError] = useState("");


  // --- SESSION MANAGEMENT ---

  // 1. Fetch Sessions List
  useEffect(() => {
    const fetchSessions = async () => {
      const userEmail = senderIdentity.email || localStorage.getItem("userEmail");
      if (!userEmail) return;

      try {
        const res = await fetch(`${BACKEND_API_URL}/chat/sessions?email=${encodeURIComponent(userEmail)}`);
        if (res.ok) {
          const data = await res.json();
          setChatSessions(data);

          // If no active session, auto-select most recent or create new
          if (!activeSessionId) {
            if (data.length > 0) {
              setActiveSessionId(data[0]._id);
            } else {
              handleCreateSession(userEmail); // Auto-create first chat
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch sessions:", err);
      }
    };

    if (senderIdentity.email) fetchSessions();
  }, [senderIdentity.email]);

  // 2. Fetch Messages for Active Session
  useEffect(() => {
    const fetchSessionMessages = async () => {
      if (!activeSessionId) return;
      try {
        const res = await fetch(`${BACKEND_API_URL}/chat/sessions/${activeSessionId}`);
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages || []);
        }
      } catch (err) {
        console.error("Failed to fetch messages:", err);
      }
    };
    fetchSessionMessages();
  }, [activeSessionId]);

  // 3. Auto-Save Logic (Sync to DB)
  useEffect(() => {
    const syncSession = async () => {
      if (!activeSessionId || messages.length === 0) return;

      try {
        // Determine dynamic title if it's "New Chat" and we have user messages
        let newTitle = undefined;
        const currentSession = chatSessions.find(s => s._id === activeSessionId);
        if (currentSession && currentSession.title === "New Chat") {
          const firstUserMsg = messages.find(m => m.role === 'user');
          if (firstUserMsg) {
            newTitle = firstUserMsg.content.slice(0, 30) + (firstUserMsg.content.length > 30 ? "..." : "");
          }
        }

        await fetch(`${BACKEND_API_URL}/chat/sessions/${activeSessionId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages,
            title: newTitle
          })
        });

        // Refresh list if title changed
        if (newTitle) {
          setChatSessions(prev => prev.map(s =>
            s._id === activeSessionId ? { ...s, title: newTitle, lastUpdated: new Date().toISOString() } : s
          ));
        }

      } catch (err) {
        console.error("Failed to sync session:", err);
      }
    };

    if (messagesDebounced.length > 0) {
      syncSession();
    }
  }, [messagesDebounced, activeSessionId]);

  const handleCreateSession = async (emailOverride = null) => {
    const email = emailOverride || senderIdentity.email || localStorage.getItem("userEmail");
    if (!email) return;

    try {
      const initialMsg = {
        role: "assistant",
        type: "text",
        content: "Hello! I am Verve. I can help you draft emails, find contacts, or negotiate deals. How can I help you today?",
        id: Date.now().toString()
      };

      const res = await fetch(`${BACKEND_API_URL}/chat/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userEmail: email,
          title: "New Chat",
          messages: [initialMsg]
        })
      });

      if (res.ok) {
        const newSession = await res.json();
        setChatSessions([newSession, ...chatSessions]);
        setActiveSessionId(newSession._id);
        setMessages([initialMsg]);
        setHasStarted(false); // Go to splash screen for new chat feels fresh
      }
    } catch (err) {
      console.error("Failed to create session:", err);
    }
  };

  const handleDeleteSession = async (sessionId) => {
    try {
      const res = await fetch(`${BACKEND_API_URL}/chat/sessions/${sessionId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        const newSessions = chatSessions.filter(s => s._id !== sessionId);
        setChatSessions(newSessions);
        if (activeSessionId === sessionId) {
          setActiveSessionId(newSessions.length > 0 ? newSessions[0]._id : null);
          if (newSessions.length === 0) {
            handleCreateSession(); // Ensure always one chat
          }
        }
      }
    } catch (err) {
      console.error("Failed to delete session:", err);
    }
  };

  const handleRenameSession = async (sessionId, newTitle) => {
    try {
      setChatSessions(prev => prev.map(s => s._id === sessionId ? { ...s, title: newTitle } : s));
      await fetch(`${BACKEND_API_URL} /chat/sessions / ${sessionId} `, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle })
      });
    } catch (err) {
      console.error("Failed to rename session:", err);
    }
  };

  useEffect(() => {
    const resolveSenderIdentity = async () => {
      let email = "";
      let name = "";
      try {
        const rawUser = localStorage.getItem("user");
        const parsedUser = rawUser ? JSON.parse(rawUser) : {};
        email =
          localStorage.getItem("userEmail") ||
          parsedUser?.email ||
          "";
        name =
          localStorage.getItem("userName") ||
          localStorage.getItem("name") ||
          parsedUser?.name ||
          "";
      } catch (_err) {
        email = localStorage.getItem("userEmail") || "";
        name = localStorage.getItem("userName") || localStorage.getItem("name") || "";
      }

      if (email) {
        try {
          const res = await fetch(`${BACKEND_API_URL} /user/profile / ${encodeURIComponent(email)} `);
          if (res.ok) {
            const data = await res.json();
            const profileUser = data?.user || {};
            email = profileUser.email || email;
            name = profileUser.name || name;
            if (name) localStorage.setItem("userName", name);
            if (email) localStorage.setItem("userEmail", email);
          }
        } catch (error) {
          console.error("Failed to resolve sender profile:", error);
        }
      }

      setSenderIdentity({
        email: (email || "").trim().toLowerCase(),
        name: (name || "").trim(),
      });
    };

    resolveSenderIdentity();
  }, []);

  // Fetch Contacts
  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const userEmail = senderIdentity.email || localStorage.getItem("userEmail") || "";
        if (!userEmail) return;
        const res = await fetch(`${BACKEND_API_URL}/contacts?email=${encodeURIComponent(userEmail)}`, {
          headers: { "x-user-email": userEmail }
        });
        if (res.ok) {
          const data = await res.json();
          setContacts(data);
        }
      } catch (error) {
        console.error("Error fetching contacts:", error);
      }
    };
    fetchContacts();
  }, [senderIdentity.email]);

  useEffect(() => {
    const fetchVoices = async () => {
      try {
        const userEmail = senderIdentity.email || localStorage.getItem("userEmail");
        const res = await fetch(`${API_BASE_URL}/ml/agent/sarge/voices?email=${encodeURIComponent(userEmail || "")}`);
        if (!res.ok) {
          setTtsAvailable(false);
          setTtsError(`TTS unavailable (HTTP ${res.status})`);
          return;
        }
        const data = await res.json();
        const available = data?.tts_available !== false;
        setTtsAvailable(available);
        setTtsError(data?.tts_error || "");
        const defaults = data.default_voices || [];
        const customs = data.custom_voices || [];
        setDefaultVoices(defaults);
        setCustomVoices(customs);

        const defaultCustom = customs.find((v) => v.is_default);
        if (defaultCustom) setSelectedCustomVoiceId(defaultCustom.id);
        if (defaults.length > 0) setSelectedDefaultVoice(defaults[0].id);
      } catch (error) {
        setTtsAvailable(false);
        setTtsError("TTS unavailable: failed to connect to backend");
        console.error("Failed to fetch voice options:", error);
      }
    };
    fetchVoices();
  }, [senderIdentity.email]);

  // Scroll to bottom
  useEffect(() => {
    if (!bottomRef.current) return;

    // Smooth scroll for general updates
    bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, activeSendFlow, hasStarted]);

  // Faster scroll for streaming content
  useEffect(() => {
    if (isStreaming && bottomRef.current) {
      // Use instant scroll for streaming to keep up with high-frequency updates
      bottomRef.current.scrollIntoView({ behavior: "auto", block: "end" });
    }
  }, [streamingContent]);

  // No manual audio cleanup needed as components handle it now

  // --- ACTIONS (Email/WhatsApp/LinkedIn) ---
  const handleSendAction = async (msgIndex, content, type) => {
    // Attempt to find mention context from the previous user message
    let prefillValue = "";
    let attachments = [];

    if (msgIndex > 0 && messages[msgIndex - 1].role === 'user') {
      const relatedUserMsg = messages[msgIndex - 1];
      const primaryContact = relatedUserMsg.mentions?.[0];

      // Capture image if present
      if (relatedUserMsg.image) {
        attachments = [relatedUserMsg.image];
      }

      if (primaryContact) {
        if (type === 'email') prefillValue = primaryContact.email || "";
        else if (type === 'whatsapp') prefillValue = primaryContact.phone || "";
        else if (type === 'linkedin') prefillValue = primaryContact.linkedinUrl || primaryContact.name || "";
      }
    }

    setActiveSendFlow({ msgIndex, type, content, step: 'preview', value: prefillValue, attachments });
  };

  const handleProceedToInput = (msgIndex, content, type) => {
    // If we are already in a flow, just update step
    if (activeSendFlow && activeSendFlow.msgIndex === msgIndex) {
      setActiveSendFlow(prev => ({ ...prev, step: 'input' }));
    } else {
      // If starting fresh (rare for proceed, but safe)
      handleSendAction(msgIndex, content, type);
      setTimeout(() => setActiveSendFlow(prev => ({ ...prev, step: 'input' })), 0);
    }
  };

  // Helper to convert base64 to File object
  const base64ToFile = async (base64, filename) => {
    const res = await fetch(base64);
    const blob = await res.blob();
    return new File([blob], filename, { type: blob.type });
  };

  // Helper to copy image to clipboard (Fallback)
  // Helper to copy image to clipboard (Fallback)
  const copyImageToClipboard = async (base64, text = null) => {
    try {
      const response = await fetch(base64);
      const blob = await response.blob();
      const clipboardData = { [blob.type]: blob };

      if (text) {
        clipboardData['text/plain'] = new Blob([text], { type: 'text/plain' });
      }

      await navigator.clipboard.write([
        new ClipboardItem(clipboardData)
      ]);
      return true;
    } catch (err) {
      console.error("Failed to copy image:", err);
      return false;
    }
  };

  const executeSend = async (target, subjectOrText, bodyText) => {
    setLoadingAction(true);
    const type = activeSendFlow?.type;
    const attachments = activeSendFlow?.attachments || [];

    try {
      // --- NATIVE SHARE API ATTEMPT (Best UX) ---
      let nativeShareSuccess = false;
      if ((type === 'whatsapp' || type === 'linkedin') && attachments.length > 0) {
        try {
          if (navigator.canShare && navigator.share) {
            const file = await base64ToFile(attachments[0], `attachment-${Date.now()}.png`);
            if (navigator.canShare({ files: [file] })) {
              await navigator.share({
                files: [file],
                title: type === 'whatsapp' ? 'Send via WhatsApp' : 'Post to LinkedIn',
                text: subjectOrText
              });
              nativeShareSuccess = true;
              setActiveSendFlow(null);
              setLoadingAction(false);
              return; // Success! Exit early.
            }
          }
        } catch (shareErr) {
          console.warn("Web Share API failed/cancelled, falling back to deep link:", shareErr);
          // Fall through to standard deep link logic
        }
      }

      // --- STANDARD DEEP LINK LOGIC (Fallback) ---
      if (type === 'whatsapp') {
        let clipboardMsg = "";

        if (attachments.length > 0 && !nativeShareSuccess) {
          const copied = await copyImageToClipboard(attachments[0], subjectOrText);
          if (copied) {
            clipboardMsg = "\n\n✅ Image (and text) copied to clipboard!\n👉 Press Ctrl+V to paste it in WhatsApp.";
          } else {
            clipboardMsg = "\n\n⚠️ Could not auto-copy image. Please attach it manually.";
          }
        }

        let cleanPhone = target.replace(/[^0-9]/g, '');
        // If 10 digits (e.g. 9876543210), assume India +91.
        // If empty, it stays empty (manual select).
        if (cleanPhone.length === 10) {
          cleanPhone = '91' + cleanPhone;
        }

        const waLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(subjectOrText)}`;

        // Explicit confirmation so user knows what to do
        if (clipboardMsg) {
          if (window.confirm(`Ready to send?${clipboardMsg}`)) {
            window.open(waLink, '_blank');
            setActiveSendFlow(null);
          }
        } else {
          window.open(waLink, '_blank');
          setActiveSendFlow(null);
        }

      } else if (type === 'linkedin') {
        let clipboardMsg = "";

        if (attachments.length > 0 && !nativeShareSuccess) {
          const copied = await copyImageToClipboard(attachments[0]);
          if (copied) {
            clipboardMsg = "\n\n✅ Image copied to clipboard!\n👉 Press Ctrl+V to paste it in LinkedIn.";
          } else {
            clipboardMsg = "\n\n⚠️ Could not auto-copy image. Please attach it manually.";
          }
        }

        const linkedInUrl = `https://www.linkedin.com/messaging/compose/?recipient=${encodeURIComponent(target)}&body=${encodeURIComponent(subjectOrText)}`;

        if (clipboardMsg) {
          if (window.confirm(`Ready to send?${clipboardMsg}`)) {
            window.open(linkedInUrl, '_blank');
            setActiveSendFlow(null);
          }
        } else {
          window.open(linkedInUrl, '_blank');
          setActiveSendFlow(null);
        }

      } else if (type === 'email') {
        const payload = {
          to: target,
          subject: subjectOrText,
          text: bodyText,
          attachments: attachments
        };

        const res = await fetch(`${BACKEND_API_URL}/send/email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          alert(`✅ Email sent to ${target}!`);
          setActiveSendFlow(null);
        } else {
          const data = await res.json();
          alert(`❌ Failed: ${data.message}`);
        }
      } // Close email block

    } catch (err) {
      console.error(err);
      alert(`Error executing action: ${err.message || err}`);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleGenerateAudio = async (text, msgId = null) => {
    if (!text) return;
    if (!ttsAvailable) {
      alert(ttsError || "TTS is unavailable on backend.");
      return;
    }
    try {
      setLoadingAction(true);
      const userEmail = localStorage.getItem("userEmail");
      const selectedCustomVoice = customVoices.find((v) => v.id === selectedCustomVoiceId);
      if (voiceMode === "custom" && !selectedCustomVoiceId) {
        alert("Select a saved audio sample first.");
        setLoadingAction(false);
        return;
      }
      const res = await fetch(`${API_BASE_URL}/ml/agent/sarge/voice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          email: userEmail,
          voice_mode: voiceMode,
          default_voice_id: selectedDefaultVoice || null,
          voice_profile_id: selectedCustomVoiceId || null,
          personality: selectedCustomVoice?.personality || null
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.detail || `Audio generation failed (${res.status})`);
      }
      if (data.audio_url) {
        // If we have a msgId, update the message with the new audio URL
        if (msgId) {
          setMessages(prev => prev.map(m =>
            m.id === msgId ? { ...m, generated_content: { ...m.generated_content, audio_path: data.audio_url } } : m
          ));
        }

      }
    } catch (err) {
      console.error("Audio generation failed:", err);
      alert(err?.message || "Audio generation failed");
    } finally {
      setLoadingAction(false);
    }
  };

  const parseMultiChannelMarkdown = (text) => {
    if (!text) return null;
    const sections = {};
    const lines = text.split("\n");
    let current = null;
    for (const line of lines) {
      const match = line.match(/^##\s+(.*)\s*$/);
      if (match) {
        current = match[1].trim().toLowerCase().replace(/\s+/g, "_");
        if (!sections[current]) sections[current] = "";
        continue;
      }
      if (current) {
        sections[current] += (sections[current] ? "\n" : "") + line;
      }
    }
    return Object.keys(sections).length ? sections : null;
  };

  const hasStructuredChannelContent = (msg) => {
    const gc = msg?.generated_content;
    if (!gc) return false;
    return Boolean(gc.email || gc.whatsapp || gc.sms || gc.linkedin || gc.instagram);
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setSelectedImage(e.target.result);
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const sendMessage = async () => {
    if (!input.trim() && !selectedImage) return;
    const originalInput = input;

    // Filter mentions to ensure they are still in the input (simple check)
    const activeMentions = mentionedContacts.filter(c => originalInput.includes(c.name));

    // Optimistically add user message
    const userMsg = {
      role: "user",
      type: "text",
      content: originalInput,
      mentions: activeMentions, // Attach mentions metadata
      image: selectedImage
    };
    setMessages((prev) => [...prev, userMsg]);

    setInput("");
    setSelectedImage(null); // Clear image after send
    if (fileInputRef.current) fileInputRef.current.value = "";
    setMentionedContacts([]); // Clear mentions for next message
    setIsStreaming(true);
    setAgentStatus("Connecting...");
    setStreamingContent("");

    // Create a placeholder for the assistant message
    const assistantMsgId = Date.now().toString();
    const initialAssistantMsg = {
      id: assistantMsgId,
      role: "assistant",
      type: "text",
      content: "",
      tool_calls: [],
      tool_results: [],
      thoughts: ["[SYSTEM] Initializing agent..."]
    };

    setMessages(prev => [...prev, initialAssistantMsg]);

    try {
      const userEmail = localStorage.getItem("userEmail") || "";
      const senderName =
        localStorage.getItem("userName") ||
        localStorage.getItem("name") ||
        "";
      const response = await fetch(`${API_BASE_URL}/ml/agent/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": userEmail,
          "x-user-name": senderName
        },
        body: JSON.stringify({
          model: "qwen2.5:7b",
          message: originalInput,
          user_email: userEmail,
          sender_name: senderName,
          thread_id: assistantMsgId,
          conversation_history: messages.map(m => ({
            role: m.role,
            content: m.content
          })),
        }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n"); // Split by double newline for SSE events
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              setMessages(prev => {
                const newMessages = [...prev];
                const msgIndex = newMessages.findIndex(m => m.id === assistantMsgId);
                if (msgIndex === -1) return prev;

                const msg = { ...newMessages[msgIndex] };
                newMessages[msgIndex] = msg;

                if (data.type === "response") {
                  msg.content += data.content || "";
                  setStreamingContent(msg.content);
                }
                else if (data.type === "thought") {
                  const thoughtText = typeof data.content === 'object'
                    ? JSON.stringify(data.content)
                    : data.content;

                  msg.thoughts = [...(msg.thoughts || []), thoughtText];
                  if (thoughtText.includes("[PHASE]") || thoughtText.includes("[MILESTONE]")) {
                    setAgentStatus(thoughtText.replace(/\[.*?\]\s*/, ""));
                  }
                  setStreamingContent(prev => prev + " ");
                }
                else if (data.type === "done") {
                  setIsStreaming(false);
                  setStreamingContent("");
                  setAgentStatus("Complete");

                  // Task 9 Support: Attempt JSON parse first
                  let parsed = null;
                  try {
                    // Clean potential markdown blocks if LLM wraps JSON
                    const cleanContent = msg.content.replace(/```json/g, "").replace(/```/g, "").trim();
                    const json = JSON.parse(cleanContent);
                    // Validate structure (must contain channel keys)
                    if (json && (json.email || json.linkedin_dm || json.whatsapp || json.sms)) {
                      parsed = json;
                    }
                  } catch (e) {
                    // Fallback to markdown parsing
                    parsed = parseMultiChannelMarkdown(msg.content);
                  }

                  if (parsed) {
                    msg.generated_content = {
                      email: parsed.email,
                      whatsapp: parsed.whatsapp,
                      sms: parsed.sms,
                      linkedin: parsed.linkedin_dm || parsed.linkedin,
                      instagram: parsed.instagram_dm || parsed.instagram
                    };
                  }
                }

                return newMessages;
              });

            } catch (e) {
              console.error("Error parsing SSE:", e);
            }
          }
        }
      }
    } catch (error) {
      console.error(error);
      setIsStreaming(false);
    }
  };

  /* --- MENTION HANDLERS --- */
  const handleInputChange = (e) => {
    const value = e.target.value;
    const selectionStart = e.target.selectionStart;
    setInput(value);
    setCursorPosition(selectionStart);

    const beforeCursor = value.slice(0, selectionStart);
    const mentionMatch = beforeCursor.match(/(?:^|\s)@([^\s@]*)$/);

    if (mentionMatch) {
      const query = mentionMatch[1] || "";
      const start = selectionStart - query.length - 1; // include '@'
      setMentionStartPos(start);
      setMentionQuery(query);
      setActiveMentionIndex(0);
      setShowMentions(true);
      return;
    }

    setMentionStartPos(null);
    setMentionQuery("");
    setActiveMentionIndex(0);
    setShowMentions(false);
  };

  const handleMentionSelect = (contact) => {
    if (mentionStartPos != null && cursorPosition != null) {
      const before = input.substring(0, mentionStartPos);
      const after = input.substring(cursorPosition);
      const newValue = `${before}@${contact.name} ${after}`;
      setInput(newValue);
      setShowMentions(false);
      setMentionStartPos(null);
      setMentionQuery("");
      setActiveMentionIndex(0);

      // Add to mentioned contacts state
      setMentionedContacts(prev => {
        if (!prev.find(c => c._id === contact._id)) {
          return [...prev, contact];
        }
        return prev;
      });
      // Reset cursor focus logic if needed, typically input auto-focuses
    }
  };

  const filteredContacts = contacts
    .filter(c => {
      const q = mentionQuery.toLowerCase();
      return (
        c.name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.company?.toLowerCase().includes(q) ||
        c.role?.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const q = mentionQuery.toLowerCase();
      const aStarts = a.name?.toLowerCase().startsWith(q) ? 1 : 0;
      const bStarts = b.name?.toLowerCase().startsWith(q) ? 1 : 0;
      return bStarts - aStarts;
    })
    .slice(0, 8);

  return (
    <div className="flex h-screen bg-[#020202] text-white overflow-hidden font-sans selection:bg-purple-500/30">

      {/* ANIMATION STYLES */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(2deg); }
        }
        .robot-3d-anim {
          animation: float 6s ease-in-out infinite;
          filter: drop-shadow(0 0 40px rgba(249, 115, 22, 0.4)); /* Orange Glow */
        }
        .aurora-bg {
          background-image: 
            radial-gradient(at 0% 0%, rgba(56, 189, 248, 0.15) 0px, transparent 50%),
            radial-gradient(at 100% 100%, rgba(168, 85, 247, 0.15) 0px, transparent 50%);
          animation: aurora 15s ease infinite alternate;
          background-size: 150% 150%;
        }
        @keyframes aurora {
          0% { background-position: 50% 50%; }
          50% { background-position: 100% 0%; }
          100% { background-position: 50% 50%; }
        }
        .glass-panel {
          background: rgba(10, 10, 10, 0.6);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }
        @keyframes soundbar {
          0% { transform: scaleY(0.3); opacity: 0.35; }
          50% { transform: scaleY(1); opacity: 1; }
          100% { transform: scaleY(0.3); opacity: 0.35; }
        }
        .sound-bar {
          width: 3px;
          border-radius: 999px;
          background: linear-gradient(180deg, #22d3ee 0%, #3b82f6 100%);
          transform-origin: center bottom;
        }
      `}</style>

      <Sidebar />
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: "auto", opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="flex flex-col h-full border-r border-white/5 bg-[#0A0A0A] z-40 overflow-hidden"
          >
            <ChatSidebar
              sessions={chatSessions}
              activeSessionId={activeSessionId}
              onSelectSession={(id) => { setActiveSessionId(id); setHasStarted(true); }}
              onCreateSession={() => handleCreateSession()}
              onDeleteSession={handleDeleteSession}
              onRenameSession={handleRenameSession}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className={`flex-1 w-full relative aurora-bg flex flex-col h-full overflow-x-hidden transition-all duration-300 ${isSidebarOpen ? "opacity-40 pointer-events-none" : ""}`}>

        {/* Toggle Button */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute top-4 left-14 md:left-4 z-50 p-2 bg-[#1A1A1A]/80 backdrop-blur-md border border-white/10 rounded-lg text-white hover:bg-white/10 transition-colors shadow-lg pointer-events-auto"
          title={isSidebarOpen ? "Close History" : "Open History"}
        >
          {isSidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        {/* --- STATE 1: INTRO SCREEN --- */}
        {!hasStarted ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 relative z-10 animate-in fade-in duration-700">

            {/* --- 3D ROBOT VISUAL (High Quality Orange Robot) --- */}
            <div className="mb-8 relative w-full max-w-[300px] md:max-w-[450px] aspect-square flex items-center justify-center -mt-20">
              {/* Glow behind robot */}
              <div className="absolute inset-0 bg-orange-500/20 blur-[100px] rounded-full animate-pulse"></div>

              {/* This image is a High-Quality 3D Render of an Orange/Yellow Robot */}
              <img
                src="https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExOTd4aXpqOG9qbXJrbzA4a3A4c2N4ZjJoYzh4aHpwa2xsMHQ1eXoxeiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/5k5vZwRFZR5aZeniqb/giphy.gif"
                alt="3D AI Robot"
                className="w-full h-full object-contain robot-3d-anim relative z-10"
              />
            </div>

            <div className="text-center space-y-8 max-w-2xl relative z-20 -mt-24">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-orange-300 mb-2 backdrop-blur-md shadow-lg">
                <Sparkles className="w-3 h-3 text-orange-400" /> NEXT-GEN AI AGENT
              </div>

              <h1 className="text-5xl md:text-7xl font-bold tracking-tighter bg-gradient-to-b from-white via-white to-neutral-500 bg-clip-text text-transparent drop-shadow-sm">
                Hello, Human.
              </h1>

              <p className="text-neutral-400 text-lg md:text-xl font-medium leading-relaxed max-w-lg mx-auto">
                I am <span className="text-white">Verve</span>. Your autonomous engine for drafting, negotiating, and closing deals.
              </p>

              <button
                onClick={() => setHasStarted(true)}
                className="group relative inline-flex items-center gap-3 px-8 py-4 bg-white text-black rounded-full font-bold text-lg shadow-[0_0_50px_rgba(255,255,255,0.2)] hover:shadow-[0_0_80px_rgba(255,255,255,0.4)] transition-all transform hover:scale-105 active:scale-95"
              >
                Initialize System
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        ) : (

          /* --- STATE 2: CHAT INTERFACE --- */
          <div className="flex-1 flex flex-col h-full animate-in slide-in-from-bottom-10 fade-in duration-700">

            {/* Header */}
            <div className="absolute top-0 left-0 right-0 z-30 p-4 sm:p-6">
              <div className="glass-panel rounded-2xl px-4 pl-14 sm:pl-6 py-4 flex justify-between items-center shadow-lg">
                <div className="flex items-center gap-4">
                  {/* Small version of the 3D head */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500/20 to-yellow-500/20 flex items-center justify-center border border-white/10 overflow-hidden">
                    <img
                      src="https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExOTd4aXpqOG9qbXJrbzA4a3A4c2N4ZjJoYzh4aHpwa2xsMHQ1eXoxeiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/5k5vZwRFZR5aZeniqb/giphy.gif"
                      className="w-12 h-12 object-cover translate-y-1"
                      alt="Mini Robot"
                    />
                  </div>
                  <div>
                    <h1 className="text-lg font-bold text-white">Verve AI</h1>
                    <div className="flex items-center gap-1.5">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                      </span>
                      <p className="text-[10px] text-emerald-400 font-medium tracking-wide">SYSTEM ACTIVE</p>
                    </div>
                  </div>
                </div>
                {/* Agent Live Status Chip */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 border border-white/10 text-xs text-zinc-300">
                  <span className={`w-2 h-2 rounded-full ${isStreaming ? "bg-orange-400 animate-pulse" : "bg-emerald-400"}`} />
                  <span className="font-semibold">Agent Live</span>
                  <span className="text-zinc-400">·</span>
                  <span className="max-w-[200px] truncate">{agentStatus}</span>
                </div>

                <button onClick={() => setHasStarted(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors text-neutral-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Chat Scroll Area */}
            <div className="flex-1 overflow-y-auto px-4 md:px-20 pt-24 md:pt-28 pb-6 space-y-6 custom-scrollbar scroll-smooth">
              {messages.map((msg, i) => (
                <div key={i} className={`flex w-full ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`flex flex-col max-w-2xl ${msg.role === "user" ? "items-end" : "items-start"} w-full`}>

                    {/* PROCESS BOX (Agent Journey) */}
                    {msg.role === 'assistant' && (
                      ((isStreaming && i === messages.length - 1) ||
                        (msg.tool_calls?.length > 0 || msg.tool_results?.length > 0 || msg.thoughts?.length > 0 || msg.active_node)) && (
                        <div className="mb-4 w-full max-w-2xl flex flex-col gap-0 bg-[#0F0F0F] border border-white/5 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 backdrop-blur-md">

                          {/* 1. HEADER & PROGRESS STEPS */}
                          <div className="p-4 border-b border-white/5 bg-[#141414]">
                            <div className="flex items-center gap-2 mb-4">
                              <div className="relative flex h-2 w-2">
                                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isStreaming ? 'bg-orange-400' : 'bg-green-400'}`}></span>
                                <span className={`relative inline-flex rounded-full h-2 w-2 ${isStreaming ? 'bg-orange-500' : 'bg-green-500'}`}></span>
                              </div>
                              <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                                {isStreaming ? "Agent Active" : "Process Complete"}
                              </span>
                            </div>

                            {/* Stepper */}
                            <div className="flex justify-between items-center px-1">
                              {['ROUTER', 'PROFILER', 'RETRIEVER', 'WRITER', 'CRITIC'].map((step, idx) => {
                                // Check if this step is active or done based on thoughts or state
                                const isCurrentMsg = i === messages.length - 1;
                                const isStepActive = msg.active_node === step ||
                                  (idx === 0 && isStreaming && isCurrentMsg && !msg.active_node) ||
                                  msg.thoughts?.some(t => t.toUpperCase().includes(`[${step}]`));
                                return (
                                  <div key={step} className="flex flex-col items-center gap-2 relative z-10 group">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all duration-500 ${isStepActive
                                      ? "bg-purple-600 border-purple-400 text-white shadow-[0_0_15px_rgba(147,51,234,0.5)]"
                                      : "bg-zinc-900 border-zinc-800 text-zinc-600"
                                      }`}>
                                      {idx === 0 && <span className="text-[10px] font-bold">R</span>}
                                      {idx === 1 && <span className="text-[10px] font-bold">P</span>}
                                      {idx === 2 && <span className="text-[10px] font-bold">M</span>}
                                      {idx === 3 && <span className="text-[10px] font-bold">W</span>}
                                      {idx === 4 && <span className="text-[10px] font-bold">C</span>}
                                    </div>
                                    <span className={`text-[10px] font-bold tracking-wider transition-colors duration-300 ${isStepActive ? "text-purple-300" : "text-zinc-700"}`}>
                                      {step}
                                    </span>
                                  </div>
                                );
                              })}
                              {/* Connector Line (Background) */}
                              <div className="absolute left-6 right-6 top-[70px] h-0.5 bg-zinc-800 -z-0 hidden md:block" />
                            </div>
                          </div>

                          {/* 2. LIVE TERMINAL LOGS */}
                          <div className="p-3 bg-black/50 font-mono text-[11px] h-48 overflow-y-auto custom-scrollbar flex flex-col-reverse">
                            {/* Reverse parsing to show latest at bottom if we used flex-col, but flex-col-reverse keeps bottom anchored */}
                            <div className="flex flex-col gap-1">
                              {(msg.thoughts || []).map((thought, tIdx) => {
                                // Extract Node Name if present
                                const match = thought.match(/^\[(\w+)\]\s*(.*)/);
                                const node = match ? match[1] : null;
                                const content = match ? match[2] : thought;

                                let colorClass = "text-zinc-500";
                                if (node === 'ROUTER') colorClass = "text-blue-400";
                                if (node === 'PROFILER') colorClass = "text-pink-400";
                                if (node === 'RETRIEVER') colorClass = "text-yellow-400";
                                if (node === 'WRITER') colorClass = "text-purple-400";
                                if (node === 'CRITIC') colorClass = "text-red-400";
                                if (node === 'STYLE_INFERRER') colorClass = "text-cyan-400";
                                if (node === 'GENERATOR') colorClass = "text-emerald-400 italic";
                                if (node === 'SYSTEM') colorClass = "text-zinc-500 italic";
                                if (node === 'SARGE') colorClass = "text-orange-400 font-bold";

                                return (
                                  <div key={tIdx} className="break-words leading-relaxed border-l-2 border-white/5 pl-2 hover:bg-white/5 transition-colors p-1 rounded-r-md">
                                    {node && (
                                      <span className={`${colorClass} font-bold mr-2 opacity-80`}>
                                        {node}:
                                      </span>
                                    )}
                                    <span className="text-zinc-300 opacity-90">{content}</span>
                                  </div>
                                );
                              })}

                              {/* Tools */}
                              {msg.tool_calls?.map((tc, tcIdx) => (
                                <div key={`tc-${tcIdx}`} className="text-cyan-400 pl-2 border-l-2 border-cyan-500/30 py-1">
                                  <span className="opacity-50 mr-2">TOOL:</span>
                                  {tc.name}({JSON.stringify(tc.args).slice(0, 50)}...)
                                </div>
                              ))}

                              {/* Results */}
                              {msg.tool_results?.map((tr, trIdx) => (
                                <div key={`tr-${trIdx}`} className="text-emerald-400 pl-2 border-l-2 border-emerald-500/30 py-1">
                                  <span className="opacity-50 mr-2">RESULT:</span>
                                  Done.
                                </div>
                              ))}

                              {/* Connection State */}
                              {msg.thoughts?.length === 0 && isStreaming && i === messages.length - 1 && (
                                <div className="text-zinc-500 animate-pulse flex items-center gap-2">
                                  <span className="w-1 h-1 bg-zinc-500 rounded-full"></span>
                                  Streaming from SARGE engine...
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    )}

                    {/* MESSAGE BUBBLE */}
                    {(!hasStructuredChannelContent(msg) || msg.role === "user") && (
                      <div className={`px-4 sm:px-6 py-4 rounded-2xl text-sm shadow-xl backdrop-blur-md border ${msg.role === "user"
                        ? "bg-purple-600/20 border-purple-500/30 text-white rounded-tr-sm"
                        : "bg-[#111]/80 border-white/10 text-neutral-200 rounded-tl-sm w-full"
                        }`}>
                        {msg.image && (
                          <div className="mb-3">
                            <img
                              src={msg.image}
                              alt="Attachment"
                              className="max-h-60 w-auto rounded-lg border border-white/10 shadow-lg object-contain bg-black/50"
                            />
                          </div>
                        )}
                        {msg.content ? (
                          <MarkdownRenderer>{msg.content}</MarkdownRenderer>
                        ) : (
                          <span className="animate-pulse text-zinc-500">Thinking...</span>
                        )}
                      </div>
                    )}

                    {msg.role === "assistant" && hasStructuredChannelContent(msg) && (
                      <CarouselContainer>
                        {msg.generated_content?.email && (
                          <EmailPreviewCard
                            content={msg.generated_content.email}
                            previewMode={true}
                            onProceed={() => handleProceedToInput(i, msg.generated_content.email, "email")}
                            onCancel={() => { }}
                            audioPath={msg.generated_content?.audio_path}
                            onConvertAudio={() => handleGenerateAudio(msg.generated_content.email, msg.id)}
                            isAudioLoading={loadingAction}
                            attachments={messages[i - 1]?.image ? [messages[i - 1].image] : []}
                          />
                        )}
                        {msg.generated_content?.whatsapp && (
                          <WhatsAppPreviewCard
                            content={msg.generated_content.whatsapp}
                            previewMode={true}
                            onProceed={() => handleProceedToInput(i, msg.generated_content.whatsapp, "whatsapp")}
                            onCancel={() => { }}
                            attachments={messages[i - 1]?.image ? [messages[i - 1].image] : []}
                          />
                        )}
                        {(msg.generated_content?.linkedin || msg.generated_content?.linkedin_dm) && (
                          <LinkedInPreviewCard
                            content={msg.generated_content?.linkedin || msg.generated_content?.linkedin_dm}
                            previewMode={true}
                            onProceed={() => handleProceedToInput(i, msg.generated_content?.linkedin || msg.generated_content?.linkedin_dm, "linkedin")}
                            onCancel={() => { }}
                            attachments={messages[i - 1]?.image ? [messages[i - 1].image] : []}
                          />
                        )}

                      </CarouselContainer>
                    )}

                    {/* ACTIONS */}
                    {msg.role === 'assistant' && (
                      <div className="mt-3 w-full pl-1">
                        {/* TTS CONTROLS & PLAYER */}
                        <div className="mb-2">
                          {/* Audio Player (if exists) */}
                          {msg.generated_content?.audio_path && (
                            <MessageAudioPlayer
                              src={msg.generated_content.audio_path.startsWith("http")
                                ? msg.generated_content.audio_path
                                : `http://localhost:8000${msg.generated_content.audio_path}`}
                              msgId={msg.id || i}
                              activeId={playingAudioMsgId}
                              onPlay={(id) => setPlayingAudioMsgId(id)}
                              voiceName="Voice Message"
                              voiceType={voiceMode === 'custom' ? 'Custom Voice' : voiceMode === 'default' ? 'Model Voice' : 'Auto Voice'}
                            />
                          )}

                          {/* Voice Settings Toggle */}
                          <details className="group/settings">
                            <summary className="list-none cursor-pointer flex items-center gap-2 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors bg-black/20 w-fit px-2 py-1 rounded-lg">
                              <Settings2 className="w-3 h-3" />
                              <span>Configure Voice</span>
                              <ChevronRight className="w-3 h-3 transition-transform group-open/settings:rotate-90" />
                            </summary>

                            <div className="mt-2 p-3 rounded-xl border border-white/5 bg-[#0f0f0f] flex flex-col gap-2 animate-in slide-in-from-top-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <select
                                  value={voiceMode}
                                  onChange={(e) => setVoiceMode(e.target.value)}
                                  disabled={!ttsAvailable}
                                  className="flex-1 min-w-[120px] bg-black border border-white/10 rounded-lg px-2 py-1.5 text-xs text-zinc-300 focus:ring-1 focus:ring-purple-500 outline-none disabled:opacity-50"
                                >
                                  <option value="auto">Auto (Default)</option>
                                  <option value="default">Model Default</option>
                                  <option value="custom">Custom Voice</option>
                                </select>

                                <select
                                  value={selectedCustomVoiceId}
                                  onChange={(e) => setSelectedCustomVoiceId(e.target.value)}
                                  disabled={voiceMode === "default" || !ttsAvailable}
                                  className={`flex-1 min-w-[120px] bg-black border border-white/10 rounded-lg px-2 py-1.5 text-xs text-zinc-300 focus:ring-1 focus:ring-purple-500 outline-none disabled:opacity-50 ${voiceMode === "default" ? "hidden" : "block"}`}
                                >
                                  <option value="">Select Custom Voice</option>
                                  {customVoices.map((voice) => (
                                    <option key={voice.id} value={voice.id}>
                                      {voice.name} ({voice.personality || "Professional"})
                                    </option>
                                  ))}
                                </select>

                                <select
                                  value={selectedDefaultVoice}
                                  onChange={(e) => setSelectedDefaultVoice(e.target.value)}
                                  disabled={voiceMode === "custom" || !ttsAvailable}
                                  className={`flex-1 min-w-[120px] bg-black border border-white/10 rounded-lg px-2 py-1.5 text-xs text-zinc-300 focus:ring-1 focus:ring-purple-500 outline-none disabled:opacity-50 ${voiceMode === "custom" ? "hidden" : "block"}`}
                                >
                                  {defaultVoices.length === 0 ? (
                                    <option value="">No Model Voices</option>
                                  ) : (
                                    defaultVoices.map((voice) => (
                                      <option key={voice.id} value={voice.id}>
                                        {voice.name}
                                      </option>
                                    ))
                                  )}
                                </select>
                              </div>

                              {!ttsAvailable && (
                                <div className="text-[10px] text-red-400/80 px-1 border-l-2 border-red-500/30 pl-2">
                                  {ttsError || "Text-to-Speech service unavailable"}
                                </div>
                              )}
                            </div>
                          </details>
                        </div>

                        {(activeSendFlow?.msgIndex === i || msg.active_node === 'WRITER') ? (
                          <div className="w-full mt-4 animate-in slide-in-from-bottom-2 duration-300">

                            {/* DRAFTING STATE */}
                            {msg.active_node === 'WRITER' && !activeSendFlow ? (
                              <div className="flex flex-col gap-4 w-full animate-pulse">
                                <div className="p-6 rounded-2xl bg-white/5 border border-white/10 border-dashed flex items-center gap-4 text-zinc-500">
                                  <div className="w-10 h-10 rounded-xl bg-zinc-800 animate-spin flex items-center justify-center">⏳</div>
                                  <div>
                                    <p className="text-sm font-bold">Drafting personalized outreach...</p>
                                    <p className="text-xs">Personalizing for prospect profile</p>
                                  </div>
                                </div>
                              </div>
                            ) : null}

                            {/* MANUAL SEND FLOW (Fallback or Override) */}
                            {activeSendFlow?.msgIndex === i && activeSendFlow.step === 'preview' && (
                              <div className="w-full mt-4 animate-in slide-in-from-bottom-2 duration-300">
                                {activeSendFlow.type === 'email' && (
                                  <EmailPreviewCard
                                    content={activeSendFlow.content}
                                    previewMode={true}
                                    onProceed={() => setActiveSendFlow({ ...activeSendFlow, step: 'input' })}
                                    onCancel={() => setActiveSendFlow(null)}
                                    // Audio props can be added here if manual flow supports audio generation
                                    onConvertAudio={() => handleGenerateAudio(activeSendFlow.content)}
                                    isAudioLoading={loadingAction}
                                  />
                                )}
                                {activeSendFlow.type === 'linkedin' && (
                                  <LinkedInPreviewCard
                                    content={activeSendFlow.content}
                                    previewMode={true}
                                    onProceed={() => setActiveSendFlow({ ...activeSendFlow, step: 'input' })}
                                    onCancel={() => setActiveSendFlow(null)}
                                    onConvertAudio={() => handleGenerateAudio(activeSendFlow.content)}
                                    isAudioLoading={loadingAction}
                                  />
                                )}
                                {activeSendFlow.type === 'whatsapp' && (
                                  <WhatsAppPreviewCard
                                    content={activeSendFlow.content}
                                    previewMode={true}
                                    onProceed={() => setActiveSendFlow({ ...activeSendFlow, step: 'input' })}
                                    onCancel={() => setActiveSendFlow(null)}
                                    onConvertAudio={() => handleGenerateAudio(activeSendFlow.content)}
                                    isAudioLoading={loadingAction}
                                  />
                                )}
                              </div>
                            )}

                            {activeSendFlow?.msgIndex === i && activeSendFlow.step === 'input' && (
                              <div className="p-4 border border-purple-500/30 bg-purple-900/10 rounded-xl mt-2">
                                <ContactInputStep
                                  activeSendFlow={activeSendFlow}
                                  setActiveSendFlow={setActiveSendFlow}
                                  executeSend={(val) => executeSend(val, activeSendFlow.content, activeSendFlow.content)}
                                  loadingAction={loadingAction}
                                  onCancel={() => setActiveSendFlow(null)}
                                />
                              </div>
                            )}

                          </div>
                        ) : !hasStructuredChannelContent(msg) ? (
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => handleSendAction(i, msg.generated_content?.email || msg.streaming_generated_content?.email || msg.content, 'email')}
                              className="px-3 py-1.5 bg-[#1A1A1A] border border-white/10 hover:border-purple-500/50 rounded-lg text-xs font-medium text-neutral-400 hover:text-white transition-all flex items-center gap-2"
                            >
                              <Mail className="w-3 h-3" /> Email
                            </button>
                            <button
                              onClick={() => handleSendAction(i, msg.generated_content?.whatsapp || msg.streaming_generated_content?.whatsapp || msg.content, 'whatsapp')}
                              className="px-3 py-1.5 bg-[#1A1A1A] border border-white/10 hover:border-green-500/50 rounded-lg text-xs font-medium text-neutral-400 hover:text-white transition-all flex items-center gap-2"
                            >
                              <Phone className="w-3 h-3" /> WhatsApp
                            </button>
                            <button
                              onClick={() => handleSendAction(i, msg.generated_content?.linkedin || msg.streaming_generated_content?.linkedin || msg.content, 'linkedin')}
                              className="px-3 py-1.5 bg-[#1A1A1A] border border-white/10 hover:border-blue-700/50 rounded-lg text-xs font-medium text-neutral-400 hover:text-white transition-all flex items-center gap-2"
                            >
                              {/* Using Map icon temporarily for LinkedIn or text, reusing generic icon if needed, but text is clearer */}
                              <span className="font-bold text-[10px] bg-blue-600 text-white px-1 rounded">in</span> LinkedIn
                            </button>
                            <button
                              onClick={() => handleGenerateAudio(msg.content, msg.id)}
                              disabled={!ttsAvailable || loadingAction}
                              title={!ttsAvailable ? (ttsError || "TTS unavailable on backend") : ""}
                              className="px-3 py-1.5 bg-[#1A1A1A] border border-white/10 hover:border-blue-500/50 rounded-lg text-xs font-medium text-neutral-400 hover:text-white transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Volume2 className="w-3 h-3" /> Audio
                            </button>
                          </div>
                        ) : (
                          <div className="text-[11px] text-zinc-500 px-1">
                            Use each channel card above to proceed with send flow.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} className="h-4" />
            </div>


            {/* Input Area */}
            <div className="p-4 sm:p-6 relative z-40 shrink-0 w-full max-w-4xl mx-auto">
              {/* Mentions Dropdown */}
              {showMentions && (
                <div className="absolute bottom-24 left-6 z-50 w-64 bg-[#111] border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                  <div className="px-3 py-2 text-[10px] font-bold text-neutral-500 uppercase tracking-wider border-b border-white/5 flex items-center justify-between">
                    <span>Suggested Contacts</span>
                    <span className="text-[9px] text-neutral-600 normal-case">Enter to select</span>
                  </div>
                  {filteredContacts.length > 0 ? (
                    <div className="max-h-48 overflow-y-auto custom-scrollbar">
                      {filteredContacts.map((contact, idx) => (
                        <button
                          key={contact._id}
                          onClick={() => handleMentionSelect(contact)}
                          onMouseEnter={() => setActiveMentionIndex(idx)}
                          className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${idx === activeMentionIndex ? "bg-white/10" : "hover:bg-white/5"
                            }`}
                        >
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-800 to-blue-900 flex items-center justify-center text-[10px] font-bold text-white border border-white/10">
                            {contact.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-white font-medium truncate">{contact.name}</div>
                            <div className="text-[10px] text-neutral-500 truncate">
                              {contact.role || "Contact"} {contact.company ? `• ${contact.company}` : ""}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="px-3 py-3 text-xs text-neutral-500">No contacts match “{mentionQuery}”.</div>
                  )}
                </div>
              )}

              <div className="max-w-4xl mx-auto relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl opacity-20 group-focus-within:opacity-60 blur transition duration-500"></div>

                {/* Image Preview */}
                {selectedImage && (
                  <div className="absolute bottom-full left-0 mb-2 p-2 bg-[#0A0A0A] border border-white/10 rounded-xl shadow-lg flex items-start gap-2 animate-in slide-in-from-bottom-2">
                    <img src={selectedImage} alt="Preview" className="h-20 w-auto rounded-lg object-cover" />
                    <button
                      onClick={removeImage}
                      className="p-1 bg-black/50 hover:bg-black/80 rounded-full text-white/70 hover:text-white transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}

                <div className="relative flex items-center bg-[#0A0A0A] border border-white/10 rounded-2xl px-4 py-3 gap-4 shadow-2xl">

                  {/* File Input */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageSelect}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 -ml-2 rounded-xl text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>

                  <input
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={(e) => {
                      if (showMentions) {
                        if (e.key === "ArrowDown") {
                          e.preventDefault();
                          if (filteredContacts.length > 0) {
                            setActiveMentionIndex((prev) => (prev + 1) % filteredContacts.length);
                          }
                          return;
                        }
                        if (e.key === "ArrowUp") {
                          e.preventDefault();
                          if (filteredContacts.length > 0) {
                            setActiveMentionIndex((prev) => (prev - 1 + filteredContacts.length) % filteredContacts.length);
                          }
                          return;
                        }
                        if ((e.key === "Enter" || e.key === "Tab") && filteredContacts.length > 0) {
                          e.preventDefault();
                          handleMentionSelect(filteredContacts[activeMentionIndex] || filteredContacts[0]);
                          return;
                        }
                        if (e.key === "Escape") {
                          e.preventDefault();
                          setShowMentions(false);
                          return;
                        }
                      }

                      if (e.key === "Enter" && !isStreaming && !showMentions) {
                        sendMessage();
                      }
                    }}
                    placeholder="Type your request here... Use @ to mention contacts"
                    className="flex-1 bg-transparent outline-none text-base text-white placeholder-neutral-600 font-medium"
                    disabled={isStreaming}
                    autoFocus
                  />
                  <button
                    onClick={sendMessage}
                    className="p-3 rounded-xl bg-purple-600 text-white hover:bg-purple-500 transition-all shadow-lg shadow-purple-900/20"
                    disabled={isStreaming || !input.trim()}
                  >
                    {isStreaming ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>

          </div>
        )}

      </div>

      {/* --- CONTACT INPUT MODAL (STEP: INPUT) --- */}
      {activeSendFlow?.step === 'input' && (
        <ContactInputStep
          activeSendFlow={activeSendFlow}
          setActiveSendFlow={setActiveSendFlow}
          executeSend={(target) => executeSend(target, activeSendFlow.type === 'whatsapp' ? activeSendFlow.content : "Subject Here", activeSendFlow.content)}
          loadingAction={loadingAction}
          onCancel={() => setActiveSendFlow(null)}
        />
      )}
    </div>
  );
}
