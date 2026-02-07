import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useStreamContext } from "@/providers/Stream";
import { StateView } from "./components/state-view";
import { ThreadActionsView } from "./components/thread-actions-view";
import { Brain, Sparkles } from "lucide-react";

export function ThreadView({ interrupt }) {
    const thread = useStreamContext();
    const interrupts = useMemo(
        () =>
            (Array.isArray(interrupt) ? interrupt : [interrupt]).filter(
                (item) => !!item,
            ),
        [interrupt],
    );
    const [activeInterruptIndex, setActiveInterruptIndex] = useState(0);
    const [showDescription, setShowDescription] = useState(false);
    const [showState, setShowState] = useState(false);
    const showSidePanel = showDescription || showState;

    useEffect(() => {
        setActiveInterruptIndex(0);
    }, [interrupts.length]);

    const activeInterrupt = interrupts[activeInterruptIndex];
    const activeDescription =
        activeInterrupt?.value?.action_requests?.[0]?.description ?? "";

    const handleShowSidePanel = (
        showStateFlag,
        showDescriptionFlag,
    ) => {
        if (showStateFlag && showDescriptionFlag) {
            console.error("Cannot show both state and description");
            return;
        }
        if (showStateFlag) {
            setShowDescription(false);
            setShowState(true);
        } else if (showDescriptionFlag) {
            setShowState(false);
            setShowDescription(true);
        } else {
            setShowState(false);
            setShowDescription(false);
        }
    };

    if (!activeInterrupt) {
        return null;
    }

    return (
        <div className="flex h-full w-full flex-col rounded-[2rem] bg-indigo-50/10 border border-indigo-100 p-8 shadow-xl shadow-indigo-50/20 lg:p-10 backdrop-blur-md mt-6 mb-2 mx-auto max-w-4xl animate-in zoom-in-95 duration-500">
            <div className="flex items-center gap-3 mb-8">
                <div className="size-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                    <Brain className="size-5 text-white animate-pulse" />
                </div>
                <div>
                    <h3 className="text-lg font-black tracking-tight text-zinc-900 uppercase">Input Required</h3>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Sparkles className="size-3 text-indigo-400" />
                        Agent is waiting for your decision
                    </p>
                </div>
            </div>

            {showSidePanel ? (
                <StateView
                    handleShowSidePanel={handleShowSidePanel}
                    description={activeDescription}
                    values={thread.values}
                    view={showState ? "state" : "description"}
                />
            ) : (
                <div className="flex w-full flex-col gap-6">
                    {interrupts.length > 1 && (
                        <div className="flex flex-wrap items-center gap-2 mb-2 p-1 bg-zinc-100 rounded-2xl w-fit">
                            {interrupts.map((it, idx) => {
                                const title =
                                    it.value?.action_requests?.[0]?.name ??
                                    `Interrupt ${idx + 1}`;
                                return (
                                    <button
                                        key={it.id ?? idx}
                                        type="button"
                                        onClick={() => setActiveInterruptIndex(idx)}
                                        className={cn(
                                            "rounded-xl px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all duration-300",
                                            idx === activeInterruptIndex
                                                ? "bg-white text-indigo-600 shadow-sm"
                                                : "text-zinc-500 hover:text-zinc-700",
                                        )}
                                    >
                                        {title}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    <ThreadActionsView
                        interrupt={activeInterrupt}
                        handleShowSidePanel={handleShowSidePanel}
                        showState={showState}
                        showDescription={showDescription}
                    />
                </div>
            )}
        </div>
    );
}
export default ThreadView;
