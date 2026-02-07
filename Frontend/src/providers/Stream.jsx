import React, {
    createContext,
    useContext,
    useState,
    useEffect,
} from "react";
// import { useStream } from "@langchain/langgraph-sdk/react";
import { useFastAPIStream } from "@/hooks/use-fastapi-stream";
// import {
//     uiMessageReducer,
//     isUIMessage,
//     isRemoveUIMessage,
// } from "@langchain/langgraph-sdk/react-ui";
import { useQueryState } from "@/hooks/use-query-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LangGraphLogoSVG } from "@/components/icons/langgraph";
import { Label } from "@/components/ui/label";
import { ArrowRight } from "lucide-react";
import { PasswordInput } from "@/components/ui/password-input";
import { getApiKey } from "@/lib/api-key";
import { useThreads } from "./Thread";
import { toast } from "sonner";

const StreamContext = createContext(undefined);

async function sleep(ms = 4000) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkGraphStatus(
    apiUrl,
    apiKey,
) {
    try {
        const res = await fetch(`${apiUrl}/info`, {
            ...(apiKey && {
                headers: {
                    "X-Api-Key": apiKey,
                },
            }),
        });

        return res.ok;
    } catch (e) {
        console.error(e);
        return false;
    }
}

const StreamSession = ({
    children,
    apiKey,
    apiUrl,
    assistantId,
}) => {
    const [threadId, setThreadId] = useQueryState("threadId");
    // const { getThreads, setThreads } = useThreads(); // Threads management needs update for FastAPI

    const { messages, submit, stop, isLoading, error } = useFastAPIStream({
        apiUrl,
        apiKey: apiKey ?? undefined,
        assistantId,
        onThreadId: (id) => {
            setThreadId(id);
            // Refetch threads logic would go here
        },
    });

    // Check status effect logic can remain or be adapted

    return (
        <StreamContext.Provider
            value={{
                messages,
                submit,
                stop,
                isLoading,
                error,
                interrupt: undefined,
                getMessagesMetadata: () => ({}),
                setBranch: () => { },
            }}
        >
            {children}
        </StreamContext.Provider>
    );
};

// Default values for the form
const DEFAULT_API_URL = "http://localhost:8000";
const DEFAULT_ASSISTANT_ID = "agent";

export const StreamProvider = ({
    children,
}) => {
    // Get environment variables
    const envApiUrl = import.meta.env.VITE_API_URL;
    const envAssistantId = import.meta.env.VITE_ASSISTANT_ID;

    // Use URL params with env var fallbacks
    const [apiUrl, setApiUrl] = useQueryState("apiUrl", {
        defaultValue: envApiUrl || DEFAULT_API_URL,
    });
    const [assistantId, setAssistantId] = useQueryState("assistantId", {
        defaultValue: envAssistantId || DEFAULT_ASSISTANT_ID,
    });

    // For API key, use localStorage with env var fallback
    const [apiKey, _setApiKey] = useState(() => {
        const storedKey = getApiKey();
        return storedKey || "";
    });

    const setApiKey = (key) => {
        window.localStorage.setItem("lg:chat:apiKey", key);
        _setApiKey(key);
    };

    // Determine final values to use, prioritizing URL params then env vars then defaults
    const finalApiUrl = apiUrl || envApiUrl || DEFAULT_API_URL;
    const finalAssistantId = assistantId || envAssistantId || DEFAULT_ASSISTANT_ID;

    // Show the form if we: don't have an API URL, or don't have an assistant ID
    if (!finalApiUrl || !finalAssistantId) {
        return (
            <div className="flex min-h-screen w-full items-center justify-center p-4">
                <div className="animate-in fade-in-0 zoom-in-95 bg-background flex max-w-3xl flex-col rounded-lg border shadow-lg">
                    <div className="mt-14 flex flex-col gap-2 border-b p-6">
                        <div className="flex flex-col items-start gap-2">
                            <LangGraphLogoSVG className="h-7" />
                            <h1 className="text-xl font-semibold tracking-tight">
                                Agent Chat
                            </h1>
                        </div>
                        <p className="text-muted-foreground">
                            Welcome to Agent Chat! Before you get started, you need to enter
                            the URL of the deployment and the assistant / graph ID.
                        </p>
                    </div>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();

                            const form = e.target;
                            const formData = new FormData(form);
                            const apiUrl = formData.get("apiUrl");
                            const assistantId = formData.get("assistantId");
                            const apiKey = formData.get("apiKey");

                            setApiUrl(apiUrl);
                            setApiKey(apiKey);
                            setAssistantId(assistantId);

                            form.reset();
                        }}
                        className="bg-muted/50 flex flex-col gap-6 p-6"
                    >
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="apiUrl">
                                Deployment URL<span className="text-rose-500">*</span>
                            </Label>
                            <p className="text-muted-foreground text-sm">
                                This is the URL of your LangGraph deployment. Can be a local, or
                                production deployment.
                            </p>
                            <Input
                                id="apiUrl"
                                name="apiUrl"
                                className="bg-background"
                                defaultValue={apiUrl || DEFAULT_API_URL}
                                required
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <Label htmlFor="assistantId">
                                Assistant / Graph ID<span className="text-rose-500">*</span>
                            </Label>
                            <p className="text-muted-foreground text-sm">
                                This is the ID of the graph (can be the graph name), or
                                assistant to fetch threads from, and invoke when actions are
                                taken.
                            </p>
                            <Input
                                id="assistantId"
                                name="assistantId"
                                className="bg-background"
                                defaultValue={assistantId || DEFAULT_ASSISTANT_ID}
                                required
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <Label htmlFor="apiKey">LangSmith API Key</Label>
                            <p className="text-muted-foreground text-sm">
                                This is <strong>NOT</strong> required if using a local LangGraph
                                server. This value is stored in your browser's local storage and
                                is only used to authenticate requests sent to your LangGraph
                                server.
                            </p>
                            <PasswordInput
                                id="apiKey"
                                name="apiKey"
                                defaultValue={apiKey ?? ""}
                                className="bg-background"
                                placeholder="lsv2_pt_..."
                            />
                        </div>

                        <div className="mt-2 flex justify-end">
                            <Button
                                type="submit"
                                size="lg"
                            >
                                Continue
                                <ArrowRight className="size-5" />
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <StreamSession
            apiKey={apiKey}
            apiUrl={finalApiUrl}
            assistantId={finalAssistantId}
        >
            {children}
        </StreamSession>
    );
};

// Create a custom hook to use the context
export const useStreamContext = () => {
    const context = useContext(StreamContext);
    if (context === undefined) {
        throw new Error("useStreamContext must be used within a StreamProvider");
    }
    return context;
};

export default StreamContext;
