import React, { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useThreads } from "@/providers/Thread";
import { getContentString } from "../utils";
import { useQueryState } from "@/hooks/use-query-state";
import { Skeleton } from "@/components/ui/skeleton";
import { PanelRightOpen, PanelRightClose, MessageSquare, Clock, Plus } from "lucide-react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

function ThreadList({
    threads,
    onThreadClick,
}) {
    const [threadId, setThreadId] = useQueryState("threadId");

    if (threads.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-zinc-950">
                <div className="p-4 bg-zinc-900 rounded-2xl mb-4 border border-zinc-800/50">
                    <MessageSquare className="size-6 text-zinc-600" />
                </div>
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">No threads yet</p>
            </div>
        );
    }

    return (
        <div className="flex h-full w-full flex-col items-start justify-start gap-1 p-3 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-800 [&::-webkit-scrollbar-track]:bg-transparent">
            <div className="px-3 py-2 mb-2 flex items-center gap-2">
                <Clock className="size-3 text-zinc-600" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">Recent Threads</span>
            </div>
            {threads.map((t) => {
                const isActive = t.thread_id === threadId;
                let itemText = t.thread_id;
                if (
                    t.values?.messages?.length > 0
                ) {
                    const firstMessage = t.values.messages[0];
                    itemText = getContentString(firstMessage.content);
                }

                return (
                    <div
                        key={t.thread_id}
                        className="w-full"
                    >
                        <Button
                            variant="ghost"
                            className={cn(
                                "w-full h-auto py-3 px-4 items-start justify-start text-left font-bold text-xs transition-all duration-200 rounded-xl border border-transparent",
                                isActive
                                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/20 translate-x-1 border-indigo-500"
                                    : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300"
                            )}
                            onClick={(e) => {
                                e.preventDefault();
                                onThreadClick?.(t.thread_id);
                                if (t.thread_id === threadId) return;
                                setThreadId(t.thread_id);
                            }}
                        >
                            <p className="truncate text-ellipsis w-full tracking-tight">{itemText}</p>
                        </Button>
                    </div>
                );
            })}
        </div>
    );
}

function ThreadHistoryLoading() {
    return (
        <div className="flex h-full w-full flex-col items-start justify-start gap-3 p-4">
            <div className="h-4 w-24 bg-zinc-50 animate-pulse rounded-md mb-2 ml-2" />
            {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton
                    key={`skeleton-${i}`}
                    className="h-12 w-full rounded-xl"
                />
            ))}
        </div>
    );
}

export default function ThreadHistory() {
    const isLargeScreen = useMediaQuery("(min-width: 1024px)");
    const [chatHistoryOpen, setChatHistoryOpen] = useQueryState(
        "chatHistoryOpen",
        false
    );
    const [, setThreadId] = useQueryState("threadId");

    const { getThreads, threads, setThreads, threadsLoading, setThreadsLoading } =
        useThreads();

    useEffect(() => {
        if (typeof window === "undefined") return;
        setThreadsLoading(true);
        getThreads()
            .then(setThreads)
            .catch(console.error)
            .finally(() => setThreadsLoading(false));
    }, []);

    return (
        <div className="flex flex-col h-full bg-zinc-950 select-none">
            <div className="flex items-center justify-between p-6 pb-2">
                <div className="flex items-center gap-3">
                    <div className="size-8 rounded-xl bg-indigo-600 flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                        <MessageSquare className="size-4 text-white" />
                    </div>
                    <h2 className="text-sm font-black uppercase tracking-widest text-zinc-200">History</h2>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900"
                    onClick={() => setChatHistoryOpen(false)}
                >
                    <PanelRightClose className="size-4" />
                </Button>
            </div>

            <div className="flex-1 overflow-hidden mt-2">
                {threadsLoading ? (
                    <ThreadHistoryLoading />
                ) : (
                    <ThreadList threads={threads} onThreadClick={() => !isLargeScreen && setChatHistoryOpen(false)} />
                )}
            </div>

            <div className="p-4 border-t border-zinc-900 bg-zinc-900/30">
                <Button
                    variant="brand"
                    className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-900/40 border-none"
                    onClick={() => {
                        setThreadId(null);
                        if (!isLargeScreen) setChatHistoryOpen(false);
                    }}
                >
                    <Plus className="size-3.5 mr-2" />
                    New Outreach
                </Button>
            </div>
        </div>
    );
}
