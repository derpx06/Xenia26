
import React, { useState } from 'react';
import { X, Send, Image, Paperclip, MoreHorizontal, Video, Star, Loader2, ChevronUp, Smile, Volume2 } from 'lucide-react';

export function LinkedInPreviewCard({ content, onSend, onCancel, defaultRecipient = "", previewMode = false, onProceed, audioPath, onConvertAudio, isAudioLoading }) {
    const [recipient, setRecipient] = useState(defaultRecipient);
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
        setIsSending(true);
        await onSend(recipient, message);
        setIsSending(false);
    };

    return (
        <div className="w-full max-w-2xl mx-auto font-sans animate-in slide-in-from-bottom-10 fade-in duration-500">
            {/* LinkedIn-style Message Bubble */}
            <div className="bg-[#0A66C2] rounded-2xl shadow-xl overflow-hidden border border-[#004182]">
                <div className="p-1">
                    <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="w-full min-h-[300px] bg-transparent text-white placeholder-blue-200 outline-none resize-none p-6 text-lg leading-relaxed font-medium"
                        placeholder="Type your LinkedIn message..."
                    />
                </div>

                {/* Audio Preview (if available) */}
                {audioPath && (
                    <div className="px-6 py-3 bg-[#004182]/30 border-t border-[#004182]/50 flex items-center justify-between">
                        <div className="flex items-center gap-3 w-full">
                            <span className="text-blue-100 text-sm font-medium whitespace-nowrap">Audio Preview</span>
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
                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-zinc-400 hover:text-blue-400 hover:bg-blue-500/10 transition-all text-sm font-medium disabled:opacity-50"
                        >
                            {isAudioLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
                            {isAudioLoading ? "Converting..." : "Convert to Audio"}
                        </button>
                    )}

                    <button
                        onClick={handleAction}
                        disabled={isSending}
                        className="bg-[#0A66C2] hover:bg-[#004182] text-white px-8 py-2.5 rounded-full font-bold text-base transition-all shadow-lg shadow-blue-900/20 disabled:opacity-70 flex items-center gap-2 translate-y-0 active:translate-y-0.5"
                    >
                        {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : (previewMode ? "Proceed" : "Send Message")}
                        {!isSending && <Send className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            {/* Recipient Input (Wait, user just said "message box", we might still need recipient if not provided) */}
            {!previewMode && (
                <div className="flex justify-center mt-6">
                    <div className="flex items-center gap-3 bg-zinc-900/50 px-4 py-2 rounded-full border border-zinc-800">
                        <span className="text-zinc-500 text-sm">To:</span>
                        <input
                            value={recipient}
                            onChange={(e) => setRecipient(e.target.value)}
                            placeholder="Recipient Name"
                            className="bg-transparent text-zinc-200 outline-none text-sm w-40 placeholder-zinc-600"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
