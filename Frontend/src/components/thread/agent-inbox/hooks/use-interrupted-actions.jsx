import { useStreamContext } from "@/providers/Stream";
import { toast } from "sonner";
import {
    useEffect,
    useRef,
    useState,
} from "react";
import { buildDecisionFromState, createDefaultHumanResponse } from "../utils";

export default function useInterruptedActions({
    interrupt,
}) {
    const thread = useStreamContext();
    const [humanResponse, setHumanResponse] = useState([]);
    const [loading, setLoading] = useState(false);
    const [streaming, setStreaming] = useState(false);
    const [streamFinished, setStreamFinished] = useState(false);
    const [selectedSubmitType, setSelectedSubmitType] = useState();
    const [hasEdited, setHasEdited] = useState(false);
    const [hasAddedResponse, setHasAddedResponse] = useState(false);
    const [approveAllowed, setApproveAllowed] = useState(false);
    const initialHumanInterruptEditValue = useRef({});

    useEffect(() => {
        const hitlValue = interrupt?.value;
        initialHumanInterruptEditValue.current = {};

        if (!hitlValue) {
            setHumanResponse([]);
            setSelectedSubmitType(undefined);
            setApproveAllowed(false);
            setHasEdited(false);
            setHasAddedResponse(false);
            return;
        }

        try {
            const { responses, defaultSubmitType, hasApprove } =
                createDefaultHumanResponse(hitlValue, initialHumanInterruptEditValue);
            setHumanResponse(responses);
            setSelectedSubmitType(defaultSubmitType);
            setApproveAllowed(hasApprove);
            setHasEdited(false);
            setHasAddedResponse(false);
        } catch (error) {
            console.error("Error formatting and setting human response state", error);
            setHumanResponse([]);
            setSelectedSubmitType(undefined);
            setApproveAllowed(false);
        }
    }, [interrupt]);

    const resumeRun = (decisions) => {
        try {
            thread.submit(
                {},
                {
                    command: {
                        resume: {
                            decisions,
                        },
                    },
                },
            );
            return true;
        } catch (error) {
            console.error("Error sending human response", error);
            return false;
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const { decision, error } = buildDecisionFromState(
            humanResponse,
            selectedSubmitType,
        );

        if (!decision) {
            toast.error("Error", {
                description: error ?? "Unsupported response type.",
                duration: 5000,
                richColors: true,
                closeButton: true,
            });
            return;
        }

        if (error) {
            toast.error("Error", {
                description: error,
                duration: 5000,
                richColors: true,
                closeButton: true,
            });
            return;
        }

        let errorOccurred = false;
        initialHumanInterruptEditValue.current = {};

        try {
            setLoading(true);
            setStreaming(true);

            const resumedSuccessfully = resumeRun([decision]);
            if (!resumedSuccessfully) {
                errorOccurred = true;
                return;
            }

            toast("Success", {
                description: "Response submitted successfully.",
                duration: 5000,
            });

            setStreamFinished(true);
        } catch (error) {
            console.error("Error sending human response", error);
            errorOccurred = true;

            if (error?.message?.includes("Invalid assistant")) {
                toast("Error: Invalid assistant ID", {
                    description:
                        "The provided assistant ID was not found in this graph. Please update the assistant ID in the settings and try again.",
                    richColors: true,
                    closeButton: true,
                    duration: 5000,
                });
            } else {
                toast.error("Error", {
                    description: "Failed to submit response.",
                    richColors: true,
                    closeButton: true,
                    duration: 5000,
                });
            }
        } finally {
            setStreaming(false);
            setLoading(false);
            if (errorOccurred) {
                setStreamFinished(false);
            }
        }
    };

    const handleResolve = async (e) => {
        e.preventDefault();
        setLoading(true);
        initialHumanInterruptEditValue.current = {};

        try {
            thread.submit(
                {},
                {
                    command: {
                        goto: "__end__", // Using string literal for END
                    },
                },
            );

            toast("Success", {
                description: "Marked thread as resolved.",
                duration: 3000,
            });
        } catch (error) {
            console.error("Error marking thread as resolved", error);
            toast.error("Error", {
                description: "Failed to mark thread as resolved.",
                richColors: true,
                closeButton: true,
                duration: 3000,
            });
        } finally {
            setLoading(false);
        }
    };

    const supportsMultipleMethods =
        humanResponse.filter((response) =>
            ["edit", "approve", "reject"].includes(response.type),
        ).length > 1;

    return {
        handleSubmit,
        handleResolve,
        humanResponse,
        selectedSubmitType,
        streaming,
        streamFinished,
        loading,
        supportsMultipleMethods,
        hasEdited,
        hasAddedResponse,
        approveAllowed,
        setSelectedSubmitType,
        setHumanResponse,
        setHasAddedResponse,
        setHasEdited,
        initialHumanInterruptEditValue,
    };
}
