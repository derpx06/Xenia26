
import React, { useState } from 'react';
import { X, Minimize2, Maximize2, Paperclip, Link, Smile, User, MoreVertical, Trash2, Send, Loader2, ArrowRight, Volume2 } from 'lucide-react';

export function EmailPreviewCard({ content, onSend, onCancel, defaultTo = "", previewMode = false, onProceed, audioPath, onConvertAudio, isAudioLoading }) {
    const [to, setTo] = useState(defaultTo);
    const [subject, setSubject] = useState("");
    const [body, setBody] = useState("");
    const [isSending, setIsSending] = useState(false);

    // Sync state with content prop (for streaming)
    React.useEffect(() => {
        if (content) {
            const match = content.match(/Subject:\s*[:]*\s*(.+)/i);
            const newSubject = match ? match[1].trim() : "Quick Question";
            const newBody = content.replace(/Subject:.*\n*/i, '').trim();

            setSubject(newSubject);
            setBody(newBody);
        }
    }, [content]);

    const handleAction = async () => {
        if (previewMode) {
            onProceed();
            return;
        }
        if (!to) return alert("Please enter a recipient email.");
        setIsSending(true);
        await onSend(to, subject, body);
        setIsSending(false);
    };

    return (
        <div className="w-full max-w-2xl mx-auto bg-white rounded-t-xl shadow-2xl overflow-hidden font-sans border border-gray-200 animate-in slide-in-from-bottom-10 fade-in duration-500">
            {/* Gmail-style Header */}
            <div className="bg-[#1A1A1A] text-white px-4 py-3 flex items-center justify-between rounded-t-xl">
                <span className="font-medium text-sm flex items-center gap-2">
                    New Message
                </span>
                <div className="flex items-center gap-3 text-gray-400">
                    <Minimize2 className="w-4 h-4 cursor-pointer hover:text-white" />
                    <Maximize2 className="w-4 h-4 cursor-pointer hover:text-white" />
                    <X className="w-4 h-4 cursor-pointer hover:text-white" onClick={onCancel} />
                </div>
            </div>

            {/* Inputs */}
            <div className="bg-white text-black p-4 space-y-2">
                <div className="flex items-center border-b border-gray-100 pb-1">
                    <span className="text-gray-500 text-sm w-16">To</span>
                    <input
                        value={previewMode ? "Recipient" : to}
                        onChange={(e) => setTo(e.target.value)}
                        placeholder="Recipient"
                        className="flex-1 outline-none text-sm py-1 disabled:text-gray-400"
                        autoFocus={!previewMode}
                        disabled={previewMode}
                    />
                </div>
                <div className="flex items-center border-b border-gray-100 pb-1">
                    <span className="text-gray-500 text-sm w-16">Subject</span>
                    <input
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="Subject"
                        className="flex-1 outline-none text-sm py-1 font-medium"
                    />
                </div>

                {/* Body */}
                <div className="py-2 min-h-[200px]">
                    <textarea
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        className="w-full h-full min-h-[200px] outline-none text-sm resize-none text-gray-800 leading-relaxed custom-scrollbar"
                    />
                </div>
            </div>

            {/* Footer / Toolbar */}
            <div className="bg-white p-3 border-t border-gray-100 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleAction}
                        disabled={isSending}
                        className="bg-[#0B57D0] hover:bg-[#0947AB] text-white px-5 py-2 rounded-full font-medium text-sm flex items-center gap-2 transition-colors disabled:opacity-70"
                    >
                        {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : (previewMode ? "Proceed" : "Send")}
                    </button>
                    <div className="flex items-center gap-4 ml-2 text-gray-500">
                        <span className="border-r border-gray-300 h-5 mx-1"></span>
                        <span className="font-serif font-bold text-lg cursor-pointer hover:bg-gray-100 p-1 rounded">A</span>
                        <Paperclip className="w-5 h-5 cursor-pointer hover:bg-gray-100 p-0.5 rounded" />
                        <Link className="w-5 h-5 cursor-pointer hover:bg-gray-100 p-0.5 rounded" />
                        <Smile className="w-5 h-5 cursor-pointer hover:bg-gray-100 p-0.5 rounded" />
                        <User className="w-5 h-5 cursor-pointer hover:bg-gray-100 p-0.5 rounded" />
                    </div>
                </div>
                <div className="flex items-center gap-2 text-gray-400">
                    <MoreVertical className="w-4 h-4 cursor-pointer hover:text-gray-600" />
                    <Trash2 className="w-4 h-4 cursor-pointer hover:text-gray-600" onClick={onCancel} />
                </div>
            </div>

            {/* Audio Section */}
            {(audioPath || previewMode) && (
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1">
                        {!audioPath ? (
                            <button
                                onClick={onConvertAudio}
                                disabled={isAudioLoading}
                                className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-bold transition-colors border border-purple-200 disabled:opacity-50"
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
                        <span className="text-[10px] text-gray-400 font-medium">XTTS v2 Premium Draft</span>
                    </div>
                </div>
            )}
        </div>
    );
}
