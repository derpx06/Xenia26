
import React, { useState } from 'react';
import { X, Minimize2, Maximize2, Paperclip, Link, Smile, User, MoreVertical, Trash2, Send, Loader2, ArrowRight, Volume2, Mail } from 'lucide-react';

export function EmailPreviewCard({ content, onSend, onCancel, defaultTo = "", previewMode = false, onProceed, audioPath, onConvertAudio, isAudioLoading, attachments = [] }) {
    const [to, setTo] = useState(defaultTo);
    const [subject, setSubject] = useState("");
    const [body, setBody] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    // Sync state with content prop (for streaming)
    React.useEffect(() => {
        if (content) {
            const match = content.match(/Subject:\s*(.+)/i);
            const newSubject = match ? match[1].trim() : "No Subject";

            // Remove subject line and optional Body: label
            let newBody = content.replace(/Subject:.*(\n|$)/i, '').trim();
            newBody = newBody.replace(/^Body:\s*/i, '').trim();
            newBody = newBody.replace(/^---\s*/, "").trim(); // Legacy cleanup

            setSubject(newSubject);
            setBody(newBody);
        }
    }, [content]);

    const handleAction = async () => {
        if (previewMode) {
            onProceed();
            setIsExpanded(false); // Close modal
            return;
        }
        if (!to) return alert("Please enter a recipient email.");
        setIsSending(true);
        await onSend(to, subject, body);
        setIsSending(false);
        setIsExpanded(false); // Close modal on send too
    };

    // --- MODAL / THUMBNAIL LOGIC ---
    if (!isExpanded) {
        return (
            <div
                onClick={() => setIsExpanded(true)}
                className="relative group cursor-pointer snap-start shrink-0 transition-all duration-300 hover:scale-[1.02]"
            >
                {/* Thumbnail Container - Responsive Width for Mobile (85vw) up to Fixed 320px */}
                <div className="w-[85vw] sm:w-[320px] h-[220px] overflow-hidden rounded-2xl border border-zinc-800 shadow-lg relative bg-zinc-950 opacity-80 hover:opacity-100 transition-opacity">
                    {/* Block Interaction */}
                    <div className="absolute inset-0 z-10 bg-transparent" />

                    {/* Scaled Content (Approx 0.6x) */}
                    <div className="scale-[0.55] origin-top-left w-[182%] h-[182%] bg-zinc-950 p-4">
                        {/* Fake Header */}
                        <div className="bg-zinc-900 text-zinc-400 px-4 py-3 flex items-center justify-between rounded-t-xl border-b border-zinc-800 mb-2">
                            <span className="font-medium text-sm">New Message</span>
                            <div className="flex gap-2">
                                <div className="w-3 h-3 rounded-full bg-zinc-700" />
                                <div className="w-3 h-3 rounded-full bg-zinc-700" />
                            </div>
                        </div>

                        {/* Fake Inputs */}
                        <div className="space-y-3 px-2">
                            <div className="border-b border-zinc-800 pb-1 text-zinc-500 text-sm flex gap-2">
                                <span>To:</span> <span className="text-zinc-300">{to || "Recipient"}</span>
                            </div>
                            <div className="border-b border-zinc-800 pb-1 text-zinc-500 text-sm flex gap-2">
                                <span>Subject:</span> <span className="text-zinc-300 font-medium">{subject || "No Subject"}</span>
                            </div>
                            <div className="text-zinc-400 text-sm whitespace-pre-wrap mt-2 line-clamp-6">
                                {body || "Drafting email content..."}
                            </div>

                            {/* Attachment Indicator */}
                            {attachments.length > 0 && (
                                <div className="mt-3 flex items-center gap-2 px-2 py-1 bg-zinc-900/50 rounded-lg w-fit border border-zinc-800">
                                    <Paperclip className="w-3 h-3 text-zinc-500" />
                                    <span className="text-[10px] text-zinc-400 font-medium">{attachments.length} Image{attachments.length !== 1 ? 's' : ''} attached</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Expand Overlay Hint */}
                    <div className="absolute bottom-3 right-3 z-20 bg-blue-600/90 backdrop-blur-md p-2 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-2 group-hover:translate-y-0 shadow-lg">
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

                    <div className="w-full bg-zinc-950 rounded-xl shadow-2xl overflow-hidden font-sans border border-zinc-800 flex flex-col">
                        {/* Gmail-style Header */}
                        <div className="bg-zinc-900 text-zinc-200 px-4 py-3 flex items-center justify-between border-b border-zinc-800 shrink-0">
                            <span className="font-medium text-sm flex items-center gap-2">
                                New Message
                            </span>
                            <div className="flex items-center gap-3 text-zinc-400">
                                <Minimize2 className="w-4 h-4 cursor-pointer hover:text-white" onClick={() => setIsExpanded(false)} />
                            </div>
                        </div>

                        {/* Inputs */}
                        <div className="bg-zinc-950 text-zinc-200 p-4 space-y-2 shrink-0">
                            <div className="flex flex-col sm:flex-row sm:items-center border-b border-zinc-800 pb-1">
                                <span className="text-zinc-500 text-sm w-16 mb-1 sm:mb-0">To</span>
                                <input
                                    value={previewMode ? "Recipient" : to}
                                    onChange={(e) => setTo(e.target.value)}
                                    placeholder="Recipient"
                                    className="flex-1 bg-transparent outline-none text-sm py-1 disabled:text-zinc-500 placeholder-zinc-600 text-zinc-200"
                                    autoFocus={!previewMode}
                                    disabled={previewMode}
                                />
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center border-b border-zinc-800 pb-1">
                                <span className="text-zinc-500 text-sm w-16 mb-1 sm:mb-0">Subject</span>
                                <input
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    placeholder="Subject"
                                    className="flex-1 bg-transparent outline-none text-sm py-1 font-medium placeholder-zinc-600 text-zinc-200"
                                />
                            </div>

                            <div className="py-2 min-h-[200px]">
                                <textarea
                                    value={body}
                                    onChange={(e) => setBody(e.target.value)}
                                    className="w-full h-full min-h-[200px] bg-transparent outline-none text-sm resize-none text-zinc-300 leading-relaxed custom-scrollbar placeholder-zinc-600"
                                />
                            </div>

                            {/* Attachments */}
                            {attachments.length > 0 && (
                                <div className="border-t border-zinc-800 pt-3 mt-2">
                                    <div className="text-zinc-500 text-xs font-medium mb-2 flex items-center gap-2">
                                        <Paperclip className="w-3 h-3" />
                                        {attachments.length} Attachment{attachments.length !== 1 ? 's' : ''}
                                    </div>
                                    <div className="flex gap-2 overflow-x-auto pb-2">
                                        {attachments.map((src, i) => (
                                            <div key={i} className="relative group shrink-0">
                                                <img
                                                    src={src}
                                                    alt={`Attachment ${i + 1}`}
                                                    className="h-20 w-auto rounded-lg border border-zinc-700 bg-zinc-900 object-cover"
                                                />
                                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                                                    <Maximize2 className="w-4 h-4 text-white" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
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
                                            {isAudioLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Volume2 className="w-3 h-3" />}
                                            {isAudioLoading ? "Converting..." : "Convert to Audio"}
                                        </button>
                                    ) : (
                                        <div className="flex items-center gap-3 w-full">
                                            <span className="text-zinc-400 text-xs font-medium whitespace-nowrap">Audio Preview</span>
                                            <audio
                                                src={`http://localhost:8000${audioPath}`}
                                                controls
                                                className="h-6 w-full max-w-md opacity-70 hover:opacity-100 transition-opacity invert-[.9]"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
