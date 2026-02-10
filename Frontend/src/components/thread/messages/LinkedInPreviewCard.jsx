
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
        <div className="w-full max-lg mx-auto bg-zinc-950 rounded-t-xl shadow-[0_0_20px_rgba(0,0,0,0.5)] overflow-hidden font-sans border border-zinc-800 animate-in slide-in-from-bottom-10 fade-in duration-500">
            {/* LinkedIn Header */}
            <div className="bg-zinc-900 border-b border-zinc-800 px-3 py-2 flex items-center justify-between relative shadow-sm z-10">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="w-8 h-8 rounded-full bg-zinc-800 overflow-hidden border border-zinc-700">
                            <img src="https://static.licdn.com/sc/h/9c8pery4andzj6ohjkjp54ma2" alt="Avatar" className="w-full h-full object-cover opacity-90" />
                        </div>
                        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-zinc-900 rounded-full"></div>
                    </div>
                    <div>
                        <div className="flex items-center gap-1">
                            <input
                                value={previewMode ? "LinkedIn Member" : recipient}
                                onChange={(e) => setRecipient(e.target.value)}
                                placeholder="Recipient Name"
                                className="font-bold text-sm text-zinc-100 bg-transparent outline-none w-32 placeholder-zinc-500 disabled:text-zinc-400"
                                disabled={previewMode}
                            />
                        </div>
                        <p className="text-xs text-zinc-500 truncate w-40">Available on mobile</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 text-zinc-400">
                    <MoreHorizontal className="w-5 h-5 cursor-pointer hover:bg-zinc-800 rounded hover:text-zinc-200" />
                    <Video className="w-5 h-5 cursor-pointer hover:bg-zinc-800 rounded hover:text-zinc-200" />
                    <Star className="w-5 h-5 cursor-pointer hover:bg-zinc-800 rounded hover:text-zinc-200" />
                    <ChevronUp className="w-5 h-5 cursor-pointer hover:bg-zinc-800 rounded hover:text-zinc-200" />
                    <X className="w-5 h-5 cursor-pointer hover:bg-zinc-800 rounded hover:text-zinc-200" onClick={onCancel} />
                </div>
            </div>

            {/* Chat Area */}
            <div className="bg-black/40 h-[250px] p-4 overflow-y-auto flex flex-col gap-4">
                <div className="flex flex-col items-center">
                    <span className="text-[10px] items-center text-zinc-500 font-medium my-2 uppercase tracking-wide">Today</span>
                </div>

                {/* Message Bubble (Me) */}
                <div className="flex justify-end">
                    <div className="bg-[#0A66C2] rounded-tl-lg rounded-tr-lg rounded-bl-lg text-white p-3 max-w-[85%] text-sm shadow-md">
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            className="bg-transparent w-full h-full min-h-[80px] outline-none resize-none leading-relaxed placeholder-white/50 text-white"
                        />
                    </div>
                </div>
            </div>

            {/* Input Area */}
            <div className="bg-zinc-900 p-2 border-t border-zinc-800">
                <div className="flex flex-col gap-2">
                    <textarea
                        className="w-full bg-zinc-800/50 rounded-lg outline-none text-sm resize-none h-12 px-3 pt-3 text-zinc-200 placeholder-zinc-500 border border-zinc-800 focus:border-zinc-700 transition-colors"
                        placeholder="Write a message..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                    />
                    <div className="flex justify-between items-center px-2 pb-1 pt-1">
                        <div className="flex items-center gap-4 text-zinc-500">
                            <Image className="w-5 h-5 cursor-pointer hover:text-zinc-300 transition-colors" />
                            <Paperclip className="w-5 h-5 cursor-pointer hover:text-zinc-300 transition-colors" />
                            <div className="bg-zinc-800 px-2 py-0.5 rounded text-xs font-bold text-zinc-400 cursor-pointer hover:bg-zinc-700 hover:text-zinc-200 transition-colors">GIF</div>
                            <Smile className="w-5 h-5 cursor-pointer hover:text-zinc-300 transition-colors" />
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleAction}
                                disabled={isSending}
                                className="bg-[#0A66C2] hover:bg-[#004182] text-white px-4 py-1.5 rounded-full font-bold text-sm transition-colors disabled:opacity-70 flex items-center gap-2 shadow-lg shadow-blue-900/20"
                            >
                                {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : (previewMode ? "Proceed" : "Send")}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Audio Section */}
            {(audioPath || previewMode) && (
                <div className="px-4 py-2 bg-zinc-900 border-t border-zinc-800 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1">
                        {!audioPath ? (
                            <button
                                onClick={onConvertAudio}
                                disabled={isAudioLoading}
                                className="flex items-center gap-2 px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-blue-400 rounded-lg text-xs font-bold transition-colors border border-zinc-700 disabled:opacity-50"
                            >
                                {isAudioLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
                                {isAudioLoading ? "Converting..." : "Convert to Audio"}
                            </button>
                        ) : (
                            <audio
                                src={`http://localhost:8000${audioPath}`}
                                controls
                                className="h-8 w-full max-w-xs scale-90 origin-left opacity-80 hover:opacity-100 transition-opacity invert-[.9]"
                            />
                        )}
                        <span className="text-[10px] text-zinc-500 font-medium">XTTS v2 Clone</span>
                    </div>
                </div>
            )}
        </div>
    );
}
