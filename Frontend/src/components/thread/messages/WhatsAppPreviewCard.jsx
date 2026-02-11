
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

    const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
        <div className="w-full max-w-sm mx-auto bg-[#0b141a] rounded-3xl shadow-2xl overflow-hidden font-sans border border-zinc-800 relative animate-in slide-in-from-bottom-10 fade-in duration-500">
            {/* WhatsApp Header */}
            <div className="bg-[#202c33] text-zinc-100 px-4 py-3 flex items-center justify-between shadow-md z-10 relative">
                <div className="flex items-center gap-3">
                    <ArrowLeft className="w-5 h-5 cursor-pointer text-zinc-300" onClick={onCancel} />
                    <div className="w-9 h-9 bg-zinc-600 rounded-full flex items-center justify-center text-zinc-300 font-bold overflow-hidden">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png" alt="Profile" className="w-full h-full object-cover opacity-80 invert" />
                    </div>
                    <div>
                        <input
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="+1 234..."
                            className="bg-transparent text-zinc-100 placeholder-zinc-500 outline-none w-32 font-medium text-base"
                        />
                        <p className="text-xs text-zinc-400">online</p>
                    </div>
                </div>
                <div className="flex items-center gap-4 text-zinc-300">
                    <Video className="w-5 h-5 cursor-pointer hover:text-zinc-100" />
                    <Phone className="w-5 h-5 cursor-pointer hover:text-zinc-100" />
                    <MoreVertical className="w-5 h-5 cursor-pointer hover:text-zinc-100" />
                </div>
            </div>

            {/* Chat Area (Background Pattern) */}
            <div
                className="h-[300px] p-4 overflow-y-auto flex flex-col gap-2 relative bg-[#0b141a]"
                style={{
                    backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')",
                    backgroundSize: "400px",
                    backgroundBlendMode: "overlay"
                }}
            >
                {/* Outgoing Message Bubble */}
                <div className="self-end bg-[#005c4b] text-zinc-100 p-2 px-3 rounded-lg rounded-tr-none shadow-md max-w-[85%] text-sm relative leading-relaxed">
                    <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="bg-transparent w-full resize-none outline-none min-h-[60px] text-zinc-100 placeholder-zinc-400"
                    />
                    <div className="flex justify-end items-end gap-1 mt-1">
                        <span className="text-[10px] text-zinc-400/80">{currentTime}</span>
                        <span className="text-[#53bdeb] font-bold text-[10px]">✓✓</span>
                    </div>
                </div>
            </div>

            {/* Input Bar */}
            <div className="bg-[#202c33] px-2 py-2 flex items-center gap-2">
                <Smile className="w-6 h-6 text-zinc-400 cursor-pointer hover:text-zinc-300" />
                <Paperclip className="w-6 h-6 text-zinc-400 cursor-pointer hover:text-zinc-300" />
                <div className="flex-1 bg-[#2a3942] rounded-lg px-3 py-2 text-sm shadow-sm flex items-center">
                    <span className="text-zinc-400">Message</span>
                </div>
                <button
                    onClick={handleAction}
                    disabled={isSending}
                    className={`bg-[#00a884] flex items-center justify-center text-white shadow-md hover:bg-[#008f70] transition-colors ${previewMode ? 'px-6 py-2 rounded-full w-auto' : 'w-10 h-10 rounded-full'}`}
                >
                    {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : (previewMode ? <span className="font-bold text-sm">Proceed</span> : <Send className="w-5 h-5 pl-1" />)}
                </button>
            </div>

            {/* Audio Section */}
            {(audioPath || previewMode) && (
                <div className="px-4 py-2 border-t border-zinc-800 flex items-center justify-between gap-4" style={{ backgroundColor: '#202c33' }}>
                    <div className="flex items-center gap-3 flex-1">
                        {!audioPath ? (
                            <button
                                onClick={onConvertAudio}
                                disabled={isAudioLoading}
                                className="flex items-center gap-2 px-3 py-1 bg-[#2a3942] hover:bg-[#111b21] text-emerald-400 rounded-lg text-xs font-bold transition-colors border border-zinc-700 disabled:opacity-50"
                            >
                                {isAudioLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
                                {isAudioLoading ? "Converting..." : "Convert to Audio"}
                            </button>
                        ) : (
                            <audio
                                src={`http://localhost:8000${audioPath}`}
                                controls
                                className="h-8 w-full max-w-xs scale-90 origin-left invert-[.9]"
                            />
                        )}
                        <span className="text-[10px] text-zinc-500 font-medium">XTTS v2 Preview</span>
                    </div>
                </div>
            )}
        </div>
    );
}
