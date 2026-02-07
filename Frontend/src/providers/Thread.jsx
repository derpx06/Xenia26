import { validate } from "uuid";
import { getApiKey } from "@/lib/api-key";
import { useQueryState } from "@/hooks/use-query-state";
import {
    createContext,
    useContext,
    useCallback,
    useState,
} from "react";
import { createClient } from "./custom-client";

const ThreadContext = createContext(undefined);

function getThreadSearchMetadata(
    assistantId,
) {
    if (validate(assistantId)) {
        return { assistant_id: assistantId };
    } else {
        return { graph_id: assistantId };
    }
}

export function ThreadProvider({ children }) {
    const [apiUrl] = useQueryState("apiUrl");
    const [assistantId] = useQueryState("assistantId");
    const [threads, setThreads] = useState([]);
    const [threadsLoading, setThreadsLoading] = useState(false);

    const getThreads = useCallback(async () => {
        if (!apiUrl || !assistantId) return [];
        const client = createClient(apiUrl, getApiKey() ?? undefined);

        const threads = await client.threads.search({
            metadata: {
                ...getThreadSearchMetadata(assistantId),
            },
            limit: 100,
        });

        return threads;
    }, [apiUrl, assistantId]);

    const value = {
        getThreads,
        threads,
        setThreads,
        threadsLoading,
        setThreadsLoading,
    };

    return (
        <ThreadContext.Provider value={value}>{children}</ThreadContext.Provider>
    );
}

export function useThreads() {
    const context = useContext(ThreadContext);
    if (context === undefined) {
        throw new Error("useThreads must be used within a ThreadProvider");
    }
    return context;
}
