import React, { memo, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Undo2, Check, X, Send } from "lucide-react";
import { MarkdownText } from "../../markdown-text";
import { haveArgsChanged, prettifyText } from "../utils";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function ResetButton({ handleReset }) {
    return (
        <Button
            onClick={handleReset}
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-zinc-400 hover:text-rose-500 hover:bg-rose-50"
        >
            <Undo2 className="size-3.5 mr-1.5" />
            <span className="text-[10px] uppercase font-bold tracking-wider">Reset</span>
        </Button>
    );
}

function ArgsRenderer({ args }) {
    return (
        <div className="flex w-full flex-col items-start gap-4">
            {Object.entries(args).map(([key, value]) => {
                const stringValue =
                    typeof value === "string" || typeof value === "number"
                        ? value.toString()
                        : JSON.stringify(value, null);

                return (
                    <div
                        key={`args-${key}`}
                        className="flex flex-col items-start gap-1.5 w-full"
                    >
                        <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider ml-1">
                            {prettifyText(key)}
                        </p>
                        <div className="w-full rounded-xl bg-zinc-50 border border-zinc-100 p-3 text-sm text-zinc-700 leading-relaxed shadow-sm">
                            <MarkdownText>{stringValue}</MarkdownText>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function ApproveOnly({
    isLoading,
    actionRequestArgs,
    handleSubmit,
}) {
    return (
        <div className="flex w-full flex-col items-start gap-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-md">
            {Object.keys(actionRequestArgs).length > 0 && (
                <ArgsRenderer args={actionRequestArgs} />
            )}
            <Button
                variant="brand"
                disabled={isLoading}
                onClick={handleSubmit}
                className="w-full h-11 rounded-xl font-bold text-sm shadow-indigo-100 shadow-lg"
            >
                <Check className="size-4 mr-2" />
                Approve Execution
            </Button>
        </div>
    );
}

function EditActionCard({
    humanResponse,
    isLoading,
    initialValues,
    onEditChange,
    handleSubmit,
    actionArgs,
}) {
    const defaultRows = useRef({});
    const editResponse = humanResponse.find(
        (response) => response.type === "edit",
    );
    const approveResponse = humanResponse.find(
        (response) => response.type === "approve",
    );

    if (
        !editResponse ||
        editResponse.type !== "edit" ||
        typeof editResponse.edited_action !== "object" ||
        !editResponse.edited_action
    ) {
        if (approveResponse) {
            return (
                <ApproveOnly
                    actionRequestArgs={actionArgs}
                    isLoading={isLoading}
                    handleSubmit={handleSubmit}
                />
            );
        }
        return null;
    }

    const header = editResponse.acceptAllowed ? "Edit & Approve" : "Edit Parameters";
    const buttonText =
        editResponse.acceptAllowed && !editResponse.editsMade
            ? "Approve"
            : "Submit Changes";

    const handleReset = () => {
        if (!editResponse.edited_action?.args) {
            return;
        }

        const keysToReset = [];
        const valuesToReset = [];
        Object.entries(initialValues).forEach(([key, value]) => {
            if (key in editResponse.edited_action.args) {
                const stringValue =
                    typeof value === "string" || typeof value === "number"
                        ? value.toString()
                        : JSON.stringify(value, null);
                keysToReset.push(key);
                valuesToReset.push(stringValue);
            }
        });

        if (keysToReset.length > 0 && valuesToReset.length > 0) {
            onEditChange(valuesToReset, editResponse, keysToReset);
        }
    };

    const handleKeyDown = (event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            handleSubmit(event);
        }
    };

    return (
        <div className="flex w-full min-w-full flex-col items-start gap-5 rounded-2xl border border-zinc-200 bg-white p-6 shadow-md">
            <div className="flex w-full items-center justify-between border-b border-zinc-100 pb-3">
                <p className="text-sm font-bold text-zinc-800 uppercase tracking-widest">{header}</p>
                <ResetButton handleReset={handleReset} />
            </div>

            {Object.entries(editResponse.edited_action.args).map(
                ([key, value], idx) => {
                    const stringValue =
                        typeof value === "string" || typeof value === "number"
                            ? value.toString()
                            : JSON.stringify(value, null);

                    if (defaultRows.current[key] === undefined) {
                        defaultRows.current[key] = !stringValue.length
                            ? 3
                            : Math.max(stringValue.length / 30, 4);
                    }

                    return (
                        <div
                            className="flex h-full w-full flex-col items-start gap-2"
                            key={`allow-edit-args--${key}-${idx}`}
                        >
                            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider ml-1">
                                {prettifyText(key)}
                            </p>
                            <Textarea
                                disabled={isLoading}
                                className="w-full min-h-[80px] rounded-xl border-zinc-200 bg-zinc-50/50 focus:bg-white focus:ring-zinc-200 text-sm py-3 transition-all"
                                value={stringValue}
                                onChange={(event) =>
                                    onEditChange(event.target.value, editResponse, key)
                                }
                                onKeyDown={handleKeyDown}
                                rows={defaultRows.current[key] || 4}
                            />
                        </div>
                    );
                },
            )}

            <div className="flex w-full items-center justify-end gap-2 mt-2">
                <Button
                    variant="brand"
                    disabled={isLoading}
                    onClick={handleSubmit}
                    className="h-10 px-6 rounded-lg font-bold text-xs shadow-lg shadow-indigo-100"
                >
                    {editResponse.acceptAllowed && !editResponse.editsMade ? <Check className="size-3.5 mr-2" /> : <Send className="size-3.5 mr-2" />}
                    {buttonText}
                </Button>
            </div>
        </div>
    );
}
const EditAndApprove = memo(EditActionCard);

function RejectActionCard({
    humanResponse,
    isLoading,
    onChange,
    handleSubmit,
    showArgs,
    actionArgs,
}) {
    const rejectResponse = humanResponse.find(
        (response) => response.type === "reject",
    );

    if (!rejectResponse) {
        return null;
    }

    const handleKeyDown = (event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            handleSubmit(event);
        }
    };

    return (
        <div className="flex w-full max-w-full flex-col items-start gap-5 rounded-2xl border border-rose-100 bg-rose-50/20 p-6 shadow-sm">
            <div className="flex w-full items-center justify-between border-b border-rose-100/50 pb-3">
                <p className="text-sm font-bold text-rose-800 uppercase tracking-widest flex items-center">
                    <X className="size-4 mr-2" />
                    Reject & Feedback
                </p>
                <ResetButton handleReset={() => onChange("", rejectResponse)} />
            </div>

            {showArgs && <ArgsRenderer args={actionArgs} />}

            <div className="flex w-full flex-col items-start gap-2">
                <p className="text-[11px] font-bold text-rose-400 uppercase tracking-wider ml-1">Rejection Reason</p>
                <Textarea
                    disabled={isLoading}
                    className="w-full rounded-xl border-rose-200 bg-white/80 focus:ring-rose-200 text-sm py-3 transition-all placeholder:text-rose-300"
                    value={rejectResponse.message ?? ""}
                    onChange={(event) => onChange(event.target.value, rejectResponse)}
                    onKeyDown={handleKeyDown}
                    rows={3}
                    placeholder="Why are you rejecting this? (e.g. wrong tool, incorrect params)"
                />
            </div>

            <div className="flex w-full items-center justify-end gap-2 mt-2">
                <Button
                    variant="destructive"
                    disabled={isLoading || !rejectResponse.message?.trim()}
                    onClick={handleSubmit}
                    className="h-10 px-6 rounded-lg font-bold text-xs border-none bg-rose-600 hover:bg-rose-700 shadow-lg shadow-rose-100"
                >
                    Submit Rejection
                </Button>
            </div>
        </div>
    );
}
const RejectCard = memo(RejectActionCard);

export function InboxItemInput({
    interruptValue,
    humanResponse,
    approveAllowed,
    hasEdited,
    hasAddedResponse,
    initialValues,
    isLoading,
    supportsMultipleMethods,
    selectedSubmitType,
    setHumanResponse,
    setSelectedSubmitType,
    setHasAddedResponse,
    setHasEdited,
    handleSubmit,
}) {
    const allowedDecisions =
        interruptValue.review_configs?.[0]?.allowed_decisions ?? [];
    const actionRequest = interruptValue.action_requests?.[0];
    const actionArgs = actionRequest?.args ?? {};
    const isEditAllowed = allowedDecisions.includes("edit");
    const isRejectAllowed = allowedDecisions.includes("reject");
    const hasArgs = Object.keys(actionArgs).length > 0;
    const showArgsInReject =
        hasArgs && !isEditAllowed && !approveAllowed && isRejectAllowed;
    const showArgsOutsideCards =
        hasArgs && !showArgsInReject && !isEditAllowed && !approveAllowed;

    const onEditChange = (
        change,
        response,
        key,
    ) => {
        if (
            (Array.isArray(change) && !Array.isArray(key)) ||
            (!Array.isArray(change) && Array.isArray(key))
        ) {
            toast.error("Error", {
                description: "Unable to update edited values.",
                richColors: true,
                closeButton: true,
            });
            return;
        }

        let valuesChanged = true;
        if (response.type === "edit" && response.edited_action) {
            const updatedArgs = { ...(response.edited_action.args || {}) };

            if (Array.isArray(change) && Array.isArray(key)) {
                change.forEach((value, index) => {
                    if (index < key.length) {
                        updatedArgs[key[index]] = value;
                    }
                });
            } else {
                updatedArgs[key] = change;
            }

            valuesChanged = haveArgsChanged(updatedArgs, initialValues);
        }

        if (!valuesChanged) {
            setHasEdited(false);
            if (approveAllowed) {
                setSelectedSubmitType("approve");
            } else if (hasAddedResponse) {
                setSelectedSubmitType("reject");
            }
        } else {
            setSelectedSubmitType("edit");
            setHasEdited(true);
        }

        setHumanResponse((prev) => {
            if (response.type !== "edit" || !response.edited_action) {
                console.error("Mismatched response type for edit", response.type);
                return prev;
            }

            const newArgs =
                Array.isArray(change) && Array.isArray(key)
                    ? {
                        ...response.edited_action.args,
                        ...Object.fromEntries(key.map((k, index) => [k, change[index]])),
                    }
                    : {
                        ...response.edited_action.args,
                        [key]: change,
                    };

            const newEdit = {
                type: "edit",
                edited_action: {
                    name: response.edited_action.name,
                    args: newArgs,
                },
            };

            return prev.map((existing) => {
                if (existing.type !== "edit") {
                    return existing;
                }

                if (existing.acceptAllowed) {
                    return {
                        ...newEdit,
                        acceptAllowed: true,
                        editsMade: valuesChanged,
                    };
                }

                return newEdit;
            });
        });
    };

    const onRejectChange = (change, response) => {
        if (response.type !== "reject") {
            console.error("Mismatched response type for rejection");
            return;
        }

        const trimmed = change.trim();
        setHasAddedResponse(!!trimmed);

        if (!trimmed) {
            if (hasEdited) {
                setSelectedSubmitType("edit");
            } else if (approveAllowed) {
                setSelectedSubmitType("approve");
            }
        } else {
            setSelectedSubmitType("reject");
        }

        setHumanResponse((prev) =>
            prev.map((existing) =>
                existing.type === "reject"
                    ? { type: "reject", message: change }
                    : existing,
            ),
        );
    };

    return (
        <div className="flex w-full max-w-full flex-col items-start justify-start gap-4">
            {showArgsOutsideCards && <ArgsRenderer args={actionArgs} />}

            <div className="flex w-full flex-col items-stretch gap-4">
                <EditAndApprove
                    humanResponse={humanResponse}
                    isLoading={isLoading}
                    initialValues={initialValues}
                    actionArgs={actionArgs}
                    onEditChange={onEditChange}
                    handleSubmit={handleSubmit}
                />

                {supportsMultipleMethods ? (
                    <div className="flex items-center gap-4 px-2">
                        <Separator className="flex-1 opacity-10" />
                        <p className="text-[10px] uppercase font-black text-zinc-300 tracking-[0.2em]">OR</p>
                        <Separator className="flex-1 opacity-10" />
                    </div>
                ) : null}

                <RejectCard
                    humanResponse={humanResponse}
                    isLoading={isLoading}
                    showArgs={showArgsInReject}
                    actionArgs={actionArgs}
                    onChange={onRejectChange}
                    handleSubmit={handleSubmit}
                />

                {isLoading && (
                    <div className="flex items-center justify-center gap-2 py-2">
                        <div className="size-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                        <div className="size-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                        <div className="size-2 bg-indigo-500 rounded-full animate-bounce"></div>
                        <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider ml-2">Submitting decision...</p>
                    </div>
                )}
            </div>
        </div>
    );
}
