import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ThreadIdCopyable } from "./thread-id";
import { InboxItemInput } from "./inbox-item-input";
import useInterruptedActions from "../hooks/use-interrupted-actions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useQueryState } from "@/hooks/use-query-state";
import { constructOpenInStudioURL, buildDecisionFromState, prettifyText } from "../utils";
import { useStreamContext } from "@/providers/Stream";
import { ExternalLink, CheckCircle2, AlertCircle, Layers } from "lucide-react";

function ButtonGroup({
    handleShowState,
    handleShowDescription,
    showingState,
    showingDescription,
}) {
    return (
        <div className="flex p-1 bg-zinc-100 rounded-xl shadow-inner-sm">
            <Button
                variant="ghost"
                className={cn(
                    "h-8 rounded-lg px-4 text-[10px] font-bold uppercase tracking-widest transition-all",
                    showingState ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700",
                )}
                size="sm"
                onClick={handleShowState}
            >
                State
            </Button>
            <Button
                variant="ghost"
                className={cn(
                    "h-8 rounded-lg px-4 text-[10px] font-bold uppercase tracking-widest transition-all",
                    showingDescription ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700",
                )}
                size="sm"
                onClick={handleShowDescription}
            >
                Description
            </Button>
        </div>
    );
}

function isValidHitlRequest(interrupt) {
    return (
        !!interrupt.value &&
        Array.isArray(interrupt.value.action_requests) &&
        interrupt.value.action_requests.length > 0 &&
        Array.isArray(interrupt.value.review_configs) &&
        interrupt.value.review_configs.length > 0
    );
}

function getDecisionStatus(decision) {
    if (!decision) return null;
    return decision.type;
}

function getActionTitle(action) {
    return action?.name ? prettifyText(action.name) : "Interrupt Requested";
}

export function ThreadActionsView({
    interrupt,
    handleShowSidePanel,
    showDescription,
    showState,
}) {
    const stream = useStreamContext();
    const [threadId] = useQueryState("threadId");
    const [apiUrl] = useQueryState("apiUrl");
    const [currentIndex, setCurrentIndex] = useState(0);
    const [addressedActions, setAddressedActions] = useState(new Map());
    const [submittingAll, setSubmittingAll] = useState(false);

    const hitlValue = interrupt.value;
    const actionRequests = useMemo(
        () => hitlValue?.action_requests ?? [],
        [hitlValue?.action_requests],
    );
    const reviewConfigs = useMemo(
        () => hitlValue?.review_configs ?? [],
        [hitlValue?.review_configs],
    );

    const hasMultipleActions = actionRequests.length > 1;
    const currentAction = actionRequests[currentIndex];
    const matchingConfig =
        reviewConfigs.find(
            (config) => config.action_name === currentAction?.name,
        ) ?? reviewConfigs[currentIndex];

    const singleActionInterrupt = useMemo(() => {
        if (!currentAction || !matchingConfig) {
            return interrupt;
        }

        return {
            ...interrupt,
            value: {
                action_requests: [currentAction],
                review_configs: [matchingConfig],
            },
        };
    }, [interrupt, currentAction, matchingConfig]);

    const {
        approveAllowed,
        hasEdited,
        hasAddedResponse,
        streaming,
        supportsMultipleMethods,
        streamFinished,
        loading,
        handleSubmit,
        handleResolve,
        setSelectedSubmitType,
        setHasAddedResponse,
        setHasEdited,
        humanResponse,
        setHumanResponse,
        selectedSubmitType,
        initialHumanInterruptEditValue,
    } = useInterruptedActions({
        interrupt: singleActionInterrupt,
    });

    useEffect(() => {
        setCurrentIndex(0);
        setAddressedActions(new Map());
    }, [interrupt]);

    const handleOpenInStudio = () => {
        if (!apiUrl) {
            toast.error("Deployment URL missing", {
                description: "Please set the LangGraph deployment URL in settings.",
            });
            return;
        }

        const studioUrl = constructOpenInStudioURL(apiUrl, threadId ?? undefined);
        window.open(studioUrl, "_blank");
    };

    const handleApproveAll = useCallback(() => {
        if (!hasMultipleActions) return;

        try {
            const allDecisions = actionRequests.map(() => ({
                type: "approve",
            }));

            stream.submit(
                {},
                {
                    command: {
                        resume: { decisions: allDecisions },
                    },
                },
            );

            toast.success("Success", {
                description: "All actions approved successfully.",
            });
        } catch (error) {
            console.error("Error approving all actions", error);
            toast.error("Failed to approve", {
                description: "An unexpected error occurred while approving actions.",
            });
        }
    }, [actionRequests, hasMultipleActions, stream]);

    const handleSubmitAll = useCallback(() => {
        if (!hasMultipleActions) return;

        if (addressedActions.size !== actionRequests.length) {
            toast.warning("Incomplete Review", {
                description: `Please address all ${actionRequests.length} actions before submitting.`,
            });
            return;
        }

        try {
            setSubmittingAll(true);
            const allDecisions = actionRequests.map((_, index) => {
                const decision = addressedActions.get(index);
                if (!decision) {
                    throw new Error(`Missing decision for action ${index + 1}`);
                }
                return decision;
            });

            stream.submit(
                {},
                {
                    command: {
                        resume: { decisions: allDecisions },
                    },
                },
            );

            toast.success("Submitted", {
                description: "All decisions have been sent to the agent.",
            });
            setAddressedActions(new Map());
        } catch (error) {
            console.error("Error submitting all actions", error);
            toast.error("Submission failed", {
                description: "Could not submit your decisions.",
            });
        } finally {
            setSubmittingAll(false);
        }
    }, [actionRequests, addressedActions, hasMultipleActions, stream]);

    const allAllowApprove = useMemo(() => {
        if (!hasMultipleActions) return false;
        return actionRequests.every((actionRequest) => {
            const matching = reviewConfigs.find(
                (config) => config.action_name === actionRequest.name,
            );
            return matching?.allowed_decisions.includes("approve");
        });
    }, [actionRequests, reviewConfigs, hasMultipleActions]);

    const handleSaveDecision = () => {
        const { decision, error } = buildDecisionFromState(
            humanResponse,
            selectedSubmitType,
        );

        if (!decision || error) {
            toast.error("Invalid Selection", {
                description: error ?? "Please select a valid action.",
            });
            return;
        }

        setAddressedActions((prev) => {
            const next = new Map(prev);
            next.set(currentIndex, decision);
            return next;
        });

        toast.info(`Action ${currentIndex + 1} Saved`, {
            description: "You can now proceed to the next item.",
        });

        if (currentIndex < actionRequests.length - 1) {
            setCurrentIndex((prev) => prev + 1);
        }
    };

    const currentTitle = getActionTitle(currentAction);
    const actionsDisabled = loading || streaming || submittingAll;
    const hasAllDecisions =
        hasMultipleActions && addressedActions.size === actionRequests.length;

    if (!isValidHitlRequest(interrupt)) {
        return (
            <div className="flex flex-col items-center justify-center rounded-2xl bg-zinc-50 border border-zinc-200 p-8 text-center max-w-full">
                <AlertCircle className="size-8 text-zinc-400 mb-4" />
                <p className="text-sm font-medium text-zinc-600">
                    Unexpected interrupt format. The agent might be requesting something we can't render yet.
                </p>
            </div>
        );
    }

    const interruptValue = singleActionInterrupt.value;

    return (
        <div className="flex h-full w-full max-w-full flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex w-full flex-wrap items-center justify-between gap-4 border-b border-zinc-100 pb-6">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <Layers className="size-4 text-indigo-500" />
                        <h2 className="text-xl font-black tracking-tight text-zinc-900 uppercase">
                            {hasMultipleActions
                                ? `Pending Items (${addressedActions.size}/${actionRequests.length})`
                                : currentTitle}
                        </h2>
                    </div>
                    {threadId && <ThreadIdCopyable threadId={threadId} />}
                </div>

                <div className="flex items-center gap-2">
                    {apiUrl && (
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-9 px-4 rounded-xl border-zinc-200 bg-white hover:bg-zinc-50 font-bold text-[10px] uppercase tracking-wider shadow-sm"
                            onClick={handleOpenInStudio}
                        >
                            <ExternalLink className="size-3 mr-2" />
                            Studio
                        </Button>
                    )}
                    <ButtonGroup
                        handleShowState={() => handleShowSidePanel(true, false)}
                        handleShowDescription={() => handleShowSidePanel(false, true)}
                        showingState={showState}
                        showingDescription={showDescription}
                    />
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <Button
                    variant="outline"
                    className="h-9 px-4 rounded-xl border-zinc-300 bg-white font-bold text-[10px] uppercase tracking-wider text-zinc-700 hover:bg-zinc-50 transition-all shadow-sm"
                    onClick={handleResolve}
                    disabled={actionsDisabled}
                >
                    Skip All
                </Button>
                {hasMultipleActions && allAllowApprove && (
                    <Button
                        variant="outline"
                        className="h-9 px-4 rounded-xl border-emerald-200 bg-emerald-50/50 font-bold text-[10px] uppercase tracking-wider text-emerald-700 hover:bg-emerald-50 transition-all shadow-sm"
                        onClick={handleApproveAll}
                        disabled={actionsDisabled}
                    >
                        <CheckCircle2 className="size-3 mr-2" />
                        Approve All
                    </Button>
                )}
            </div>

            {hasMultipleActions && (
                <div className="flex w-full items-center gap-1.5 px-1 py-4">
                    {actionRequests.map((_, index) => {
                        const status = getDecisionStatus(addressedActions.get(index));
                        return (
                            <button
                                type="button"
                                key={index}
                                onClick={() => setCurrentIndex(index)}
                                className={cn(
                                    "h-1.5 flex-1 rounded-full transition-all duration-300",
                                    "bg-zinc-100",
                                    status === "approve" && "bg-emerald-400",
                                    status === "reject" && "bg-rose-400",
                                    status === "edit" && "bg-amber-400",
                                    index === currentIndex && "ring-2 ring-indigo-500 ring-offset-4 ring-offset-white opacity-100",
                                    status === null && index !== currentIndex && "opacity-40"
                                )}
                            >
                                <span className="sr-only">Item {index + 1}</span>
                            </button>
                        );
                    })}
                </div>
            )}

            <div className="flex-1 overflow-auto pr-1 -mr-1">
                <InboxItemInput
                    approveAllowed={approveAllowed}
                    hasEdited={hasEdited}
                    hasAddedResponse={hasAddedResponse}
                    interruptValue={interruptValue}
                    humanResponse={humanResponse}
                    initialValues={initialHumanInterruptEditValue.current}
                    setHumanResponse={setHumanResponse}
                    supportsMultipleMethods={supportsMultipleMethods}
                    setSelectedSubmitType={setSelectedSubmitType}
                    setHasAddedResponse={setHasAddedResponse}
                    setHasEdited={setHasEdited}
                    handleSubmit={hasMultipleActions ? handleSaveDecision : handleSubmit}
                    isLoading={hasMultipleActions ? submittingAll : loading}
                    selectedSubmitType={selectedSubmitType}
                />
            </div>

            {hasMultipleActions && (
                <div className="flex w-full items-center justify-between border-t border-zinc-100 pt-6">
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-9 font-bold text-[10px] uppercase tracking-wider rounded-xl"
                            disabled={currentIndex === 0}
                            onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                        >
                            Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-9 font-bold text-[10px] uppercase tracking-wider rounded-xl"
                            disabled={currentIndex === actionRequests.length - 1}
                            onClick={() => setCurrentIndex((prev) => Math.min(actionRequests.length - 1, prev + 1))}
                        >
                            Next
                        </Button>
                    </div>
                    <Button
                        variant="brand"
                        className="h-10 px-6 rounded-xl font-bold text-xs uppercase tracking-widest bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-100 disabled:shadow-none"
                        disabled={!hasAllDecisions || submittingAll}
                        onClick={handleSubmitAll}
                    >
                        {submittingAll
                            ? "Executing..."
                            : `Submit ${actionRequests.length} Decisons`}
                    </Button>
                </div>
            )}

            {!hasMultipleActions && streamFinished && (
                <div className="flex items-center gap-2 text-emerald-600 animate-in fade-in duration-1000">
                    <CheckCircle2 className="size-5" />
                    <p className="text-sm font-black uppercase tracking-widest">Execution Complete</p>
                </div>
            )}
        </div>
    );
}
