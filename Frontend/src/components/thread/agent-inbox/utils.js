import { isBaseMessage } from "@langchain/core/messages";
import { format } from "date-fns";
import { startCase } from "lodash";

export function prettifyText(action) {
    return startCase(action.replace(/_/g, " "));
}

export function isArrayOfMessages(value) {
    if (!Array.isArray(value)) return false;

    if (
        value.every(isBaseMessage) ||
        value.every(
            (v) =>
                typeof v === "object" &&
                v !== null &&
                "id" in v &&
                "type" in v &&
                "content" in v
        )
    ) {
        return true;
    }
    return false;
}

export function baseMessageObject(item) {
    if (isBaseMessage(item)) {
        const contentText =
            typeof item.content === "string"
                ? item.content
                : JSON.stringify(item.content, null);
        let toolCallText = "";
        if ("tool_calls" in item) {
            toolCallText = JSON.stringify(item.tool_calls, null);
        }
        return `${item.type}:${contentText ? ` ${contentText}` : ""}${toolCallText ? ` - Tool calls: ${toolCallText}` : ""}`;
    } else if (
        typeof item === "object" &&
        item &&
        "type" in item &&
        "content" in item
    ) {
        const contentText =
            typeof item.content === "string"
                ? item.content
                : JSON.stringify(item.content, null);
        let toolCallText = "";
        if ("tool_calls" in item) {
            toolCallText = JSON.stringify(item.tool_calls, null);
        }
        return `${item.type}:${contentText ? ` ${contentText}` : ""}${toolCallText ? ` - Tool calls: ${toolCallText}` : ""}`;
    }

    if (typeof item === "object") {
        return JSON.stringify(item, null);
    } else {
        return item;
    }
}

export function unknownToPrettyDate(input) {
    try {
        if (input) {
            return format(new Date(input), "MM/dd/yyyy hh:mm a");
        }
    } catch (_) {
        // failed to parse date. no-op
    }
    return undefined;
}

export function createDefaultHumanResponse(
    hitlRequest,
    initialHumanInterruptEditValue
) {
    const responses = [];
    const actionRequest = hitlRequest.action_requests?.[0];
    const reviewConfig =
        hitlRequest.review_configs?.find(
            (config) => config.action_name === actionRequest?.name,
        ) ?? hitlRequest.review_configs?.[0];

    if (!actionRequest || !reviewConfig) {
        return { responses: [], defaultSubmitType: undefined, hasApprove: false };
    }

    const allowedDecisions = reviewConfig.allowed_decisions ?? [];

    if (allowedDecisions.includes("edit")) {
        Object.entries(actionRequest.args).forEach(([key, value]) => {
            const stringValue =
                typeof value === "string" || typeof value === "number"
                    ? value.toString()
                    : JSON.stringify(value, null);
            initialHumanInterruptEditValue.current = {
                ...initialHumanInterruptEditValue.current,
                [key]: stringValue,
            };
        });

        const editedAction = {
            name: actionRequest.name,
            args: { ...actionRequest.args },
        };

        responses.push({
            type: "edit",
            edited_action: editedAction,
            acceptAllowed: allowedDecisions.includes("approve"),
            editsMade: false,
        });
    }

    if (allowedDecisions.includes("approve")) {
        responses.push({ type: "approve" });
    }

    if (allowedDecisions.includes("reject")) {
        responses.push({ type: "reject", message: "" });
    }

    let defaultSubmitType;
    if (allowedDecisions.includes("approve")) {
        defaultSubmitType = "approve";
    } else if (allowedDecisions.includes("reject")) {
        defaultSubmitType = "reject";
    } else if (allowedDecisions.includes("edit")) {
        defaultSubmitType = "edit";
    }

    const hasApprove = allowedDecisions.includes("approve");

    return { responses, defaultSubmitType, hasApprove };
}

export function buildDecisionFromState(
    responses,
    selectedSubmitType
) {
    if (!responses.length) {
        return { error: "Please enter a response." };
    }

    const selectedDecision = responses.find(
        (response) => response.type === selectedSubmitType,
    );

    if (!selectedDecision) {
        return { error: "No response selected." };
    }

    if (selectedDecision.type === "approve") {
        return { decision: { type: "approve" } };
    }

    if (selectedDecision.type === "reject") {
        const message = selectedDecision.message?.trim();
        if (!message) {
            return { error: "Please provide a rejection reason." };
        }
        return { decision: { type: "reject", message } };
    }

    if (selectedDecision.type === "edit") {
        if (selectedDecision.acceptAllowed && !selectedDecision.editsMade) {
            return { decision: { type: "approve" } };
        }

        return {
            decision: {
                type: "edit",
                edited_action: selectedDecision.edited_action,
            },
        };
    }

    return { error: "Unsupported response type." };
}

export function constructOpenInStudioURL(
    deploymentUrl,
    threadId
) {
    const smithStudioURL = new URL("https://smith.langchain.com/studio/thread");
    const trimmedDeploymentUrl = deploymentUrl.replace(/\/$/, "");

    if (threadId) {
        smithStudioURL.pathname += `/${threadId}`;
    }

    smithStudioURL.searchParams.append("baseUrl", trimmedDeploymentUrl);

    return smithStudioURL.toString();
}

export function haveArgsChanged(
    args,
    initialValues
) {
    if (typeof args !== "object" || !args) {
        return false;
    }

    const currentValues = args;

    return Object.entries(currentValues).some(([key, value]) => {
        const valueString = ["string", "number"].includes(typeof value)
            ? value.toString()
            : JSON.stringify(value, null);
        return initialValues[key] !== valueString;
    });
}
