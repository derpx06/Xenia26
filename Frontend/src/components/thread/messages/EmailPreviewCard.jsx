
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
        <div className="w-full max-w-2xl mx-auto bg-zinc-950 rounded-t-xl shadow-2xl overflow-hidden font-sans border border-zinc-800 animate-in slide-in-from-bottom-10 fade-in duration-500">
            {/* Gmail-style Header */}
            <div className="bg-zinc-900 text-zinc-200 px-4 py-3 flex items-center justify-between rounded-t-xl border-b border-zinc-800">
                <span className="font-medium text-sm flex items-center gap-2">
                    New Message
                </span>
                <div className="flex items-center gap-3 text-zinc-400">
                    <Minimize2 className="w-4 h-4 cursor-pointer hover:text-white" />
                    <Maximize2 className="w-4 h-4 cursor-pointer hover:text-white" />
                    <X className="w-4 h-4 cursor-pointer hover:text-white" onClick={onCancel} />
                </div>
            </div>

            {/* Inputs */}
            <div className="bg-zinc-950 text-zinc-200 p-4 space-y-2">
                <div className="flex items-center border-b border-zinc-800 pb-1">
                    <span className="text-zinc-500 text-sm w-16">To</span>
                    <input
                        value={previewMode ? "Recipient" : to}
                        onChange={(e) => setTo(e.target.value)}
                        placeholder="Recipient"
                        className="flex-1 bg-transparent outline-none text-sm py-1 disabled:text-zinc-500 placeholder-zinc-600 text-zinc-200"
                        autoFocus={!previewMode}
                        disabled={previewMode}
                    />
                </div>
                <div className="flex items-center border-b border-zinc-800 pb-1">
                    <span className="text-zinc-500 text-sm w-16">Subject</span>
                    <input
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="Subject"
                        className="flex-1 bg-transparent outline-none text-sm py-1 font-medium placeholder-zinc-600 text-zinc-200"
                    />
                </div>

                {/* Body */}
                <div className="py-2 min-h-[200px]">
                    <textarea
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        className="w-full h-full min-h-[200px] bg-transparent outline-none text-sm resize-none text-zinc-300 leading-relaxed custom-scrollbar placeholder-zinc-600"
                    />
                </div>
            </div>

            {/* Footer / Toolbar */}
            <div className="bg-zinc-900 p-3 border-t border-zinc-800 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleAction}
                        disabled={isSending}
                        className="bg-[#0B57D0] hover:bg-[#0947AB] text-white px-5 py-2 rounded-full font-medium text-sm flex items-center gap-2 transition-colors disabled:opacity-70 shadow-lg shadow-blue-900/20"
                    >
                        {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : (previewMode ? "Proceed" : "Send")}
                    </button>
                    <div className="flex items-center gap-4 ml-2 text-zinc-500">
                        <span className="border-r border-zinc-700 h-5 mx-1"></span>
                        <span className="font-serif font-bold text-lg cursor-pointer hover:bg-zinc-800 p-1 rounded hover:text-zinc-300 transition-colors">A</span>
                        <Paperclip className="w-5 h-5 cursor-pointer hover:bg-zinc-800 p-0.5 rounded hover:text-zinc-300 transition-colors" />
                        <Link className="w-5 h-5 cursor-pointer hover:bg-zinc-800 p-0.5 rounded hover:text-zinc-300 transition-colors" />
                        <Smile className="w-5 h-5 cursor-pointer hover:bg-zinc-800 p-0.5 rounded hover:text-zinc-300 transition-colors" />
                        <User className="w-5 h-5 cursor-pointer hover:bg-zinc-800 p-0.5 rounded hover:text-zinc-300 transition-colors" />
                    </div>
                </div>
                <div className="flex items-center gap-2 text-zinc-400">
                    <MoreVertical className="w-4 h-4 cursor-pointer hover:text-zinc-200" />
                    <Trash2 className="w-4 h-4 cursor-pointer hover:text-red-400" onClick={onCancel} />
                </div>
            </div>

            {/* Audio Section */}
            {(audioPath || previewMode) && (
                <div className="px-4 py-3 bg-zinc-900 border-t border-zinc-800 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1">
                        {!audioPath ? (
                            <button
                                onClick={onConvertAudio}
                                disabled={isAudioLoading}
                                className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-purple-400 rounded-lg text-xs font-bold transition-colors border border-zinc-700 disabled:opacity-50"
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
                        <span className="text-[10px] text-zinc-500 font-medium">XTTS v2 Premium Draft</span>
                    </div>
                </div>
            )}
        </div>
    );
}
