
import React, { useState } from 'react';
import { X, Send, Phone, Video, Search, MoreVertical, Smile, Paperclip, Mic, Loader2, ArrowLeft, ArrowRight } from 'lucide-react';

export function WhatsAppPreviewCard({ content, onSend, onCancel, defaultPhone = "", previewMode = false, onProceed }) {
    const [phone, setPhone] = useState(defaultPhone);
    const [message, setMessage] = useState(content);
    const [isSending, setIsSending] = useState(false);

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
        <div className="w-full max-w-sm mx-auto bg-[#efeae2] rounded-3xl shadow-2xl overflow-hidden font-sans border border-gray-200 relative animate-in slide-in-from-bottom-10 fade-in duration-500">
            {/* WhatsApp Header */}
            <div className="bg-[#008069] text-white px-4 py-3 flex items-center justify-between shadow-md z-10 relative">
                <div className="flex items-center gap-3">
                    <ArrowLeft className="w-5 h-5 cursor-pointer" onClick={onCancel} />
                    <div className="w-9 h-9 bg-gray-300 rounded-full flex items-center justify-center text-gray-600 font-bold overflow-hidden">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png" alt="Profile" className="w-full h-full object-cover" />
                    </div>
                    <div>
                        <input
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="+1 234..."
                            className="bg-transparent text-white placeholder-white/70 outline-none w-32 font-medium text-base"
                        />
                        <p className="text-xs text-white/80">online</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <Video className="w-5 h-5" />
                    <Phone className="w-5 h-5" />
                    <MoreVertical className="w-5 h-5" />
                </div>
            </div>

            {/* Chat Area (Background Pattern) */}
            <div
                className="h-[300px] p-4 overflow-y-auto flex flex-col gap-2 relative"
                style={{
                    backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')",
                    backgroundSize: "400px"
                }}
            >
                {/* Outgoing Message Bubble */}
                <div className="self-end bg-[#E7FFDB] text-black p-2 px-3 rounded-lg rounded-tr-none shadow-sm max-w-[85%] text-sm relative leading-relaxed">
                    <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="bg-transparent w-full resize-none outline-none min-h-[60px]"
                    />
                    <div className="flex justify-end items-end gap-1 mt-1">
                        <span className="text-[10px] text-gray-500">{currentTime}</span>
                        <span className="text-blue-500 font-bold text-[10px]">✓✓</span>
                    </div>
                </div>
            </div>

            {/* Input Bar */}
            <div className="bg-[#F0F2F5] px-2 py-2 flex items-center gap-2">
                <Smile className="w-6 h-6 text-gray-500 cursor-pointer" />
                <Paperclip className="w-6 h-6 text-gray-500 cursor-pointer" />
                <div className="flex-1 bg-white rounded-lg px-3 py-2 text-sm shadow-sm flex items-center">
                    <span className="text-gray-400">Message</span>
                </div>
                <button
                    onClick={handleAction}
                    disabled={isSending}
                    className={`bg-[#008069] flex items-center justify-center text-white shadow-md hover:bg-[#006d59] transition-colors ${previewMode ? 'px-6 py-2 rounded-full w-auto' : 'w-10 h-10 rounded-full'}`}
                >
                    {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : (previewMode ? <span className="font-bold text-sm">Proceed</span> : <Send className="w-5 h-5 pl-1" />)}
                </button>
            </div>
        </div>
    );
}
