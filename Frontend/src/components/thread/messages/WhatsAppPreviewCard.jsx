
import React, { useState } from 'react';
import { X, Send, Phone, Video, Search, MoreVertical, Smile, Paperclip, Mic, Loader2, ArrowLeft, ArrowRight, Volume2 } from 'lucide-react';

export function WhatsAppPreviewCard({ content, onSend, onCancel, defaultPhone = "", previewMode = false, onProceed, audioPath, onConvertAudio, isAudioLoading }) {
    const [phone, setPhone] = useState(defaultPhone);
    const [message, setMessage] = useState("");
    const [isSending, setIsSending] = useState(false);

    // Sync state with content prop (for streaming)
    React.useEffect(() => {
        if (content) {
            setMessage(content);
        }
    }, [content]);

    const handleAction = async () => {
        if (previewMode) {
            onProceed();
            return;
        }
        if (!phone) return alert("Please enter a phone number.");
        setIsSending(true);
        await onSend(phone, message);
        setIsSending(false);
    };

    return (
        <div className="w-full max-w-2xl mx-auto font-sans animate-in slide-in-from-bottom-10 fade-in duration-500">
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
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            className="w-full min-h-[300px] bg-transparent text-zinc-100 placeholder-emerald-200/50 outline-none resize-none p-6 text-lg leading-relaxed font-medium"
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
            <div className="flex items-center justify-between mt-4 px-2">
                <button
                    onClick={onCancel}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-all text-sm font-medium"
                >
                    <X className="w-4 h-4" />
                    Cancel
                </button>

                <div className="flex items-center gap-3">
                    {!audioPath && (
                        <button
                            onClick={onConvertAudio}
                            disabled={isAudioLoading}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all text-sm font-medium disabled:opacity-50"
                        >
                            {isAudioLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
                            {isAudioLoading ? "Converting..." : "Convert to Audio"}
                        </button>
                    )}

                    <button
                        onClick={handleAction}
                        disabled={isSending}
                        className="bg-[#00a884] hover:bg-[#008f70] text-black px-8 py-2.5 rounded-full font-bold text-base transition-all shadow-lg shadow-emerald-900/20 disabled:opacity-70 flex items-center gap-2 translate-y-0 active:translate-y-0.5"
                    >
                        {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : (previewMode ? "Proceed" : "Send WhatsApp")}
                        {!isSending && <Send className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            {!previewMode && (
                <div className="flex justify-center mt-6">
                    <div className="flex items-center gap-3 bg-zinc-900/50 px-4 py-2 rounded-full border border-zinc-800">
                        <span className="text-zinc-500 text-sm">To:</span>
                        <input
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="+1 234..."
                            className="bg-transparent text-zinc-200 outline-none text-sm w-40 placeholder-zinc-600"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
