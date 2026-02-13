
import React, { useState } from 'react';
import { X, Send, Image, Paperclip, MoreHorizontal, Video, Star, Loader2, ChevronUp, Smile, Volume2, Maximize2, Minimize2, Linkedin } from 'lucide-react';

export function LinkedInPreviewCard({ content, onSend, onCancel, defaultRecipient = "", previewMode = false, onProceed, audioPath, onConvertAudio, isAudioLoading }) {
    const [recipient, setRecipient] = useState(defaultRecipient);
    const [message, setMessage] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    // Sync state with content prop (for streaming)
    React.useEffect(() => {
        if (content) {
            setMessage(content);
        }
    }, [content]);

    const handleAction = async () => {
        if (previewMode) {
            onProceed();
            setIsExpanded(false); // Close modal
            return;
        }
        setIsSending(true);
        await onSend(recipient, message);
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
                <div className="w-[85vw] sm:w-[320px] h-[220px] overflow-hidden rounded-2xl border border-[#004182]/50 shadow-lg relative bg-[#0A66C2] opacity-80 hover:opacity-100 transition-opacity">
                    {/* Block Interaction on Thumbnail */}
                    <div className="absolute inset-0 z-10 bg-transparent" />

                    {/* Scaled Content */}
                    <div className="scale-[0.55] origin-top-left w-[182%] h-[182%] p-4">
                        <div className="bg-[#0A66C2] rounded-2xl shadow-none border-none">
                            <div className="p-1">
                                <textarea
                                    readOnly
                                    value={message}
                                    className="w-full min-h-[300px] bg-transparent text-white placeholder-blue-200 outline-none resize-none p-6 text-lg leading-relaxed font-medium"
                                    placeholder="Type your LinkedIn message..."
                                />
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
                            <Linkedin className="w-4 h-4 text-[#0A66C2]" />
                            LinkedIn DM
                        </span>
                        <button
                            onClick={() => setIsExpanded(false)}
                            className="p-1.5 hover:bg-white/10 rounded-full text-zinc-400 hover:text-white transition-colors"
                            title="Collapse"
                        >
                            <Minimize2 className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Main Card Content */}
                    <div className="w-full font-sans">
                        <div className="bg-[#0A66C2] rounded-2xl shadow-2xl overflow-hidden border border-[#004182]">
                            <div className="p-1">
                                <textarea
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    className="w-full min-h-[300px] bg-transparent text-white placeholder-blue-200 outline-none resize-none p-6 text-lg leading-relaxed font-medium"
                                    placeholder="Type your LinkedIn message..."
                                />
                            </div>

                            {/* Audio Preview */}
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
                                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-zinc-400 hover:text-blue-400 hover:bg-blue-500/10 transition-all text-sm font-medium disabled:opacity-50"
                                    >
                                        {isAudioLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
                                        {isAudioLoading ? "Converting..." : "Convert to Audio"}
                                    </button>
                                )}

                                <button
                                    onClick={handleAction}
                                    disabled={isSending}
                                    className="w-full sm:w-auto bg-[#0A66C2] hover:bg-[#004182] text-white px-8 py-2.5 rounded-full font-bold text-base transition-all shadow-lg shadow-blue-900/20 disabled:opacity-70 flex items-center justify-center gap-2 translate-y-0 active:translate-y-0.5"
                                >
                                    {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : (previewMode ? "Proceed" : "Send Message")}
                                    {!isSending && <Send className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {/* Recipient Input */}
                        {!previewMode && (
                            <div className="flex justify-center mt-6">
                                <div className="flex flex-col sm:flex-row items-center gap-3 bg-zinc-900/80 backdrop-blur-md px-4 py-2 rounded-2xl sm:rounded-full border border-zinc-700 shadow-xl w-full sm:w-auto">
                                    <span className="text-zinc-400 text-sm mb-1 sm:mb-0">To:</span>
                                    <input
                                        value={recipient}
                                        onChange={(e) => setRecipient(e.target.value)}
                                        placeholder="Recipient Name"
                                        className="bg-transparent text-zinc-200 outline-none text-sm w-full sm:w-40 placeholder-zinc-600 text-center sm:text-left"
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
