
import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Phone, Video, Search, MoreVertical, Smile, Paperclip, Mic, Loader2, ArrowLeft, ArrowRight, Volume2, Maximize2, Minimize2, MessageSquare } from 'lucide-react';

export function WhatsAppPreviewCard({ content, onSend, onCancel, defaultPhone = "", previewMode = false, onProceed, audioPath, onConvertAudio, isAudioLoading, attachments = [] }) {
    const [phone, setPhone] = useState(defaultPhone);
    const [message, setMessage] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const textareaRef = useRef(null);

    // Sync state with content prop (for streaming)
    useEffect(() => {
        if (content) {
            setMessage(content);
        }
    }, [content]);

    // Auto-resize textarea
    useEffect(() => {
        if (isExpanded && textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [message, isExpanded]);

    const handleAction = async () => {
        if (previewMode) {
            onProceed();
            setIsExpanded(false); // Close modal
            return;
        }
        if (!phone) return alert("Please enter a phone number.");
        setIsSending(true);
        await onSend(phone, message);
        setIsSending(false);
        setIsExpanded(false); // Close modal
    };

    // --- MODAL / THUMBNAIL LOGIC ---
    if (!isExpanded) {
        return (
            <div
                onClick={() => setIsExpanded(true)}
                className="relative group cursor-pointer snap-start shrink-0 transition-all duration-300 hover:scale-[1.02]"
            >

                {/* Thumbnail Container - Responsive Width for Mobile (85vw) up to Fixed 320px */}
                <div className="w-[85vw] sm:w-[320px] h-[220px] overflow-hidden rounded-2xl border border-[#004a3c]/50 shadow-lg relative bg-[#0b141a] opacity-80 hover:opacity-100 transition-opacity">
                    {/* Background Pattern Overlay */}
                    <div
                        className="absolute inset-0 opacity-10"
                        style={{
                            backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')",
                            backgroundSize: "300px"
                        }}
                    />

                    {/* Block Interaction on Thumbnail */}
                    <div className="absolute inset-0 z-10 bg-transparent" />

                    {/* Scaled Content (Approx 0.6x) */}
                    <div className="scale-[0.6] origin-top-left w-[166%] h-[166%] p-4">
                        <div className="bg-[#005c4b] w-full rounded-xl rounded-tr-none shadow-md overflow-hidden relative border border-[#004a3c]">
                            {/* Attachment Thumbnail */}
                            {attachments.length > 0 && (
                                <div className="mb-2 mx-6 mt-6">
                                    <img
                                        src={attachments[0]}
                                        alt="WhatsApp Media"
                                        className="w-full h-32 rounded-lg object-cover opacity-80"
                                    />
                                </div>
                            )}

                            <textarea
                                readOnly
                                value={message}
                                className="w-full min-h-[200px] bg-transparent text-zinc-100 placeholder-emerald-200/50 outline-none resize-none px-6 pb-6 pt-2 text-lg leading-relaxed font-medium"
                                placeholder="Type a WhatsApp message..."
                            />
                            {/* Time tick */}
                            <div className="absolute bottom-2 right-4 flex items-center gap-1.5 opacity-70">
                                <span className="text-xs text-emerald-100">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                <span className="text-[#53bdeb] font-bold text-xs">✓✓</span>
                            </div>
                        </div>
                    </div>

                    {/* Expand Overlay Hint */}
                    <div className="absolute bottom-3 right-3 z-20 bg-black/40 backdrop-blur-md p-2 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-2 group-hover:translate-y-0">
                        <Maximize2 className="w-4 h-4" />
                    </div>
                </div>
            </div>
        );
    }

    // --- EXPANDED MODAL VIEW ---
    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-in fade-in duration-300" onClick={() => setIsExpanded(false)} />

            {/* Modal Content */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in zoom-in-95 duration-300 pointer-events-none">
                <div className="w-full max-w-2xl pointer-events-auto">

                    {/* Header Controls */}
                    <div className="flex justify-between items-center mb-2 px-2">
                        <span className="text-zinc-300 text-xs font-medium uppercase tracking-wider flex items-center gap-2">
                            <MessageSquare className="w-4 h-4 text-[#25D366]" />
                            WhatsApp Preview
                        </span>
                        <button
                            onClick={() => setIsExpanded(false)}
                            className="p-1.5 hover:bg-white/10 rounded-full text-zinc-400 hover:text-white transition-colors"
                            title="Collapse"
                        >
                            <Minimize2 className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="w-full font-sans">
                        {/* WhatsApp-style Message Bubble Container */}
                        <div
                            className="bg-[#0b141a] rounded-2xl shadow-xl overflow-hidden border border-zinc-800"
                            style={{
                                backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')",
                                backgroundSize: "400px",
                                backgroundBlendMode: "overlay"
                            }}
                        >
                            <div className="p-4 flex flex-col items-end">
                                {/* The Message Bubble itself */}
                                <div className="bg-[#005c4b] w-full rounded-xl rounded-tr-none shadow-md overflow-hidden relative border border-[#004a3c]">
                                    {/* Attachment Image */}
                                    {attachments.length > 0 && (
                                        <div className="mb-2">
                                            <img
                                                src={attachments[0]}
                                                alt="WhatsApp Media"
                                                className="w-full h-auto rounded-lg object-cover max-h-60"
                                            />
                                        </div>
                                    )}
                                    <textarea
                                        ref={textareaRef}
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        className="w-full min-h-[100px] bg-transparent text-zinc-100 placeholder-emerald-200/50 outline-none resize-none p-2 text-lg leading-relaxed font-medium overflow-hidden"
                                        placeholder="Type a WhatsApp message..."
                                    />
                                    {/* Time tick */}
                                    <div className="absolute bottom-2 right-4 flex items-center gap-1.5 opacity-70">
                                        <span className="text-xs text-emerald-100">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        <span className="text-[#53bdeb] font-bold text-xs">✓✓</span>
                                    </div>
                                </div>
                            </div>

                            {/* Audio Preview (if available) - Inside the container but below the bubble area */}
                            {audioPath && (
                                <div className="px-6 py-3 bg-[#005c4b]/20 border-t border-zinc-800/50 flex items-center justify-between backdrop-blur-sm">
                                    <div className="flex items-center gap-3 w-full">
                                        <span className="text-emerald-400 text-sm font-medium whitespace-nowrap">Audio Preview</span>
                                        <audio
                                            src={`http://localhost:8000${audioPath}`}
                                            controls
                                            className="h-8 w-full max-w-md opacity-90 hover:opacity-100 transition-opacity invert-[.9]"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Action Bar */}
                        <div className="flex flex-col-reverse sm:flex-row items-center justify-between mt-4 px-2 gap-3 sm:gap-0">
                            <button
                                onClick={onCancel}
                                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-all text-sm font-medium"
                            >
                                <X className="w-4 h-4" />
                                Cancel
                            </button>

                            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                                {!audioPath && (
                                    <button
                                        onClick={onConvertAudio}
                                        disabled={isAudioLoading}
                                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all text-sm font-medium disabled:opacity-50"
                                    >
                                        {isAudioLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
                                        {isAudioLoading ? "Converting..." : "Convert to Audio"}
                                    </button>
                                )}

                                <button
                                    onClick={handleAction}
                                    disabled={isSending}
                                    className="w-full sm:w-auto bg-[#00a884] hover:bg-[#008f70] text-black px-8 py-2.5 rounded-full font-bold text-base transition-all shadow-lg shadow-emerald-900/20 disabled:opacity-70 flex items-center justify-center gap-2 translate-y-0 active:translate-y-0.5"
                                >
                                    {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : (previewMode ? "Proceed" : "Send WhatsApp")}
                                    {!isSending && <Send className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {!previewMode && (
                            <div className="flex justify-center mt-6">
                                <div className="flex flex-col sm:flex-row items-center gap-3 bg-zinc-900/80 backdrop-blur-md px-4 py-2 rounded-2xl sm:rounded-full border border-zinc-700 shadow-xl w-full sm:w-auto">
                                    <span className="text-zinc-400 text-sm mb-1 sm:mb-0">To:</span>
                                    <input
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        placeholder="+1 234..."
                                        className="bg-transparent text-zinc-200 outline-none text-sm w-full sm:sm-40 placeholder-zinc-600 text-center sm:text-left"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
