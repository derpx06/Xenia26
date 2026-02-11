import React, { useMemo } from "react";
import { Copy, Mail, ExternalLink, CheckCircle2, Send, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function EmailCard({ content }) {
    const emailData = useMemo(() => {
        const startMarker = "EMAIL_DRAFT_START";
        const endMarker = "EMAIL_DRAFT_END";

        const startIndex = content.indexOf(startMarker);
        const endIndex = content.indexOf(endMarker);

        if (startIndex === -1) return null;

        const draftContent = content.substring(
            startIndex + startMarker.length,
            endIndex === -1 ? content.length : endIndex
        ).trim();

        const match = draftContent.match(/Subject:\s*(.+)/i);
        const subject = match ? match[1].trim() : "No Subject";

        let body = draftContent.replace(/Subject:.*(\n|$)/i, '').trim();
        body = body.replace(/^Body:\s*/i, '').trim();
        body = body.replace(/^---\s*/, "").trim(); // Legacy cleanup

        return { subject, body };
    }, [content]);

    if (!emailData) return null;

    const handleCopy = () => {
        navigator.clipboard.writeText(`Subject: ${emailData.subject}\n\n${emailData.body}`);
        toast.success("Copied to clipboard", {
            description: "Email draft is ready to be pasted."
        });
    };

    const handleOpenInGmail = () => {
        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(emailData.subject)}&body=${encodeURIComponent(emailData.body)}`;
        window.open(gmailUrl, "_blank");
    };

    return (
        <div className="flex flex-col w-full max-w-2xl mx-auto my-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="relative overflow-hidden rounded-[2rem] border border-zinc-800 bg-zinc-950 shadow-2xl shadow-zinc-950/50">
                {/* Abstract Background Element */}
                <div className="absolute -top-24 -right-24 size-48 bg-indigo-500/10 rounded-full blur-3xl opacity-50" />
                <div className="absolute -bottom-24 -left-24 size-48 bg-purple-500/10 rounded-full blur-3xl opacity-50" />

                {/* Header */}
                <div className="relative px-8 py-6 border-b border-zinc-900 bg-zinc-900/30 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="size-10 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <Mail className="size-5 text-white" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black uppercase tracking-widest text-zinc-200">Email Outreach</h3>
                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                                <CheckCircle2 className="size-3 text-emerald-500" />
                                DRAFT READY
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleCopy}
                            className="h-9 px-3 rounded-xl text-zinc-400 hover:text-indigo-400 hover:bg-zinc-800 transition-all font-bold text-[10px] uppercase tracking-wider"
                        >
                            <Copy className="size-3.5 mr-2" />
                            Copy
                        </Button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="relative p-8 space-y-6">
                    <div className="space-y-1.5">
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 ml-1">Subject</p>
                        <div className="px-5 py-3 rounded-xl bg-zinc-900 border border-zinc-800 font-bold text-zinc-200 text-sm shadow-inner-sm">
                            {emailData.subject}
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 ml-1">Message Body</p>
                        <div className="px-6 py-5 rounded-2xl bg-zinc-900/50 border border-zinc-800 text-sm text-zinc-300 leading-relaxed font-medium min-h-[160px] whitespace-pre-wrap">
                            {emailData.body}
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-6 bg-zinc-900/30 border-t border-zinc-800 flex items-center justify-center">
                    <Button
                        onClick={handleOpenInGmail}
                        className="h-12 px-10 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-[0.15em] shadow-xl shadow-indigo-500/20 transition-all hover:scale-[1.02] active:scale-95 group border-none"
                    >
                        <Send className="size-4 mr-3 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                        Send with Gmail
                        <ExternalLink className="size-3 ml-3 opacity-50" />
                    </Button>
                </div>
            </div>

            {/* Tips / Context */}
            <div className="mt-4 px-6 flex items-center justify-center gap-4 text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                <div className="flex items-center gap-1.5">
                    <MailCheck className="size-3.5 text-indigo-500/50" />
                    Optimized for high conversion
                </div>
                <div className="size-1 bg-zinc-800 rounded-full" />
                <div>1-click professional sign-off</div>
            </div>
        </div>
    );
}

export default EmailCard;
