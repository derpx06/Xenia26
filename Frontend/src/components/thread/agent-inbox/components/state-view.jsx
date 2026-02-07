import { Button } from "@/components/ui/button";
import { ChevronLeft, Info, Database, Braces } from "lucide-react";
import { MarkdownText } from "../../markdown-text";
import { cn } from "@/lib/utils";

export function StateView({
    view,
    values,
    description,
    handleShowSidePanel,
}) {
    return (
        <div className="flex h-full w-full flex-col gap-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleShowSidePanel(false, false)}
                    className="h-8 px-2 text-zinc-500 hover:text-zinc-800"
                >
                    <ChevronLeft className="size-4 mr-1" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Back</span>
                </Button>
                <div className="flex items-center gap-2">
                    {view === "state" ? <Database className="size-3.5 text-indigo-500" /> : <Info className="size-3.5 text-indigo-500" />}
                    <h2 className="text-sm font-black uppercase tracking-widest text-zinc-900">
                        {view === "state" ? "Graph State" : "Action Description"}
                    </h2>
                </div>
            </div>

            <div className="flex-1 overflow-auto bg-zinc-50/50 rounded-2xl border border-zinc-100 p-6 shadow-inner-sm">
                {view === "state" ? (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Braces className="size-3 text-zinc-400" />
                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Raw Data</p>
                        </div>
                        <pre className="font-mono text-[11px] text-zinc-700 leading-relaxed whitespace-pre-wrap break-all">
                            {JSON.stringify(values, null, 2)}
                        </pre>
                    </div>
                ) : (
                    <div className="markdown-container prose prose-zinc prose-sm max-w-none">
                        <MarkdownText>{description}</MarkdownText>
                    </div>
                )}
            </div>
        </div>
    );
}
