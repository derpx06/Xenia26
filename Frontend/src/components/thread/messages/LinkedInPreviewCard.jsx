
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
        <div className="w-full max-lg mx-auto bg-white rounded-t-xl shadow-[0_0_20px_rgba(0,0,0,0.15)] overflow-hidden font-sans border border-gray-300 animate-in slide-in-from-bottom-10 fade-in duration-500">
            {/* LinkedIn Header */}
            <div className="bg-white border-b border-gray-200 px-3 py-2 flex items-center justify-between relative shadow-sm z-10">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden">
                            <img src="https://static.licdn.com/sc/h/9c8pery4andzj6ohjkjp54ma2" alt="Avatar" className="w-full h-full object-cover" />
                        </div>
                        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></div>
                    </div>
                    <div>
                        <div className="flex items-center gap-1">
                            <input
                                value={previewMode ? "LinkedIn Member" : recipient}
                                onChange={(e) => setRecipient(e.target.value)}
                                placeholder="Recipient Name"
                                className="font-bold text-sm text-gray-900 outline-none w-32 placeholder-gray-400 disabled:text-gray-500"
                                disabled={previewMode}
                            />
                        </div>
                        <p className="text-xs text-gray-500 truncate w-40">Available on mobile</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 text-gray-600">
                    <MoreHorizontal className="w-5 h-5 cursor-pointer hover:bg-gray-100 rounded" />
                    <Video className="w-5 h-5 cursor-pointer hover:bg-gray-100 rounded" />
                    <Star className="w-5 h-5 cursor-pointer hover:bg-gray-100 rounded" />
                    <ChevronUp className="w-5 h-5 cursor-pointer hover:bg-gray-100 rounded" />
                    <X className="w-5 h-5 cursor-pointer hover:bg-gray-100 rounded" onClick={onCancel} />
                </div>
            </div>

            {/* Chat Area */}
            <div className="bg-[#F3F2EF] h-[250px] p-4 overflow-y-auto flex flex-col gap-4">
                <div className="flex flex-col items-center">
                    <span className="text-[10px] items-center text-gray-500 font-medium my-2">Today</span>
                </div>

                {/* Message Bubble (Me) */}
                <div className="flex justify-end">
                    <div className="bg-[#D9EAF7] rounded-tl-lg rounded-tr-lg rounded-bl-lg text-gray-900 p-3 max-w-[85%] text-sm shadow-sm">
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            className="bg-transparent w-full h-full min-h-[80px] outline-none resize-none leading-relaxed"
                        />
                    </div>
                </div>
            </div>

            {/* Input Area */}
            <div className="bg-white p-2 border-t border-gray-300">
                <div className="flex flex-col gap-2">
                    <textarea
                        className="w-full outline-none text-sm resize-none h-10 px-2 pt-2 placeholder-gray-500"
                        placeholder="Write a message..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                    />
                    <div className="flex justify-between items-center px-2 pb-1">
                        <div className="flex items-center gap-4 text-gray-500">
                            <Image className="w-5 h-5 cursor-pointer hover:text-gray-700" />
                            <Paperclip className="w-5 h-5 cursor-pointer hover:text-gray-700" />
                            <div className="bg-gray-200 px-2 py-0.5 rounded text-xs font-bold text-gray-600 cursor-pointer hover:bg-gray-300">GIF</div>
                            <Smile className="w-5 h-5 cursor-pointer hover:text-gray-700" />
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleAction}
                                disabled={isSending}
                                className="bg-[#0A66C2] hover:bg-[#004182] text-white px-4 py-1.5 rounded-full font-bold text-sm transition-colors disabled:opacity-70 flex items-center gap-2"
                            >
                                {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : (previewMode ? "Proceed" : "Send")}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Audio Section */}
            {(audioPath || previewMode) && (
                <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1">
                        {!audioPath ? (
                            <button
                                onClick={onConvertAudio}
                                disabled={isAudioLoading}
                                className="flex items-center gap-2 px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition-colors border border-blue-200 disabled:opacity-50"
                            >
                                {isAudioLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
                                {isAudioLoading ? "Converting..." : "Convert to Audio"}
                            </button>
                        ) : (
                            <audio
                                src={`http://localhost:8000${audioPath}`}
                                controls
                                className="h-8 w-full max-w-xs scale-90 origin-left"
                            />
                        )}
                        <span className="text-[10px] text-gray-400 font-medium">XTTS v2 Clone</span>
                    </div>
                </div>
            )}
        </div>
    );
}
