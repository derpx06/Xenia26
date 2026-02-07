/**
 * Custom Client to interact with Xenia26 FastAPI Agent Endpoints
 * Mimics the structure of @langchain/langgraph-sdk Client where necessary
 */

export class CustomClient {
    constructor({ apiUrl, apiKey }) {
        this.apiUrl = apiUrl;
        this.apiKey = apiKey;
        this.threads = new ThreadsResource(this);
    }
}

class ThreadsResource {
    constructor(client) {
        this.client = client;
    }

    /**
     * Search for threads.
     * Maps to GET /ml/agent/threads
     */
    async search({ metadata, limit } = {}) {
        try {
            const res = await fetch(`${this.client.apiUrl}/ml/agent/threads`, {
                headers: {
                    ...(this.client.apiKey && { "Authorization": `Bearer ${this.client.apiKey}` }),
                }
            });

            if (!res.ok) {
                console.error("Failed to fetch threads", res.status);
                return [];
            }

            const threads = await res.json();

            // Map backend format to expectations
            // Backend returns: [{ id, created_at, updated_at, metadata: { title } }]
            // Frontend expects: { thread_id, values: { messages: [{ content }] } }
            return threads.map(t => ({
                thread_id: t.id,
                created_at: t.created_at,
                updated_at: t.updated_at,
                metadata: t.metadata,
                values: {
                    messages: [
                        {
                            type: 'human', // Mock message for preview
                            content: t.metadata?.title || "New Conversation"
                        }
                    ]
                }
            }));
        } catch (e) {
            console.error("Error searching threads:", e);
            return [];
        }
    }

    /**
     * Get thread state (history).
     * Maps to GET /ml/agent/threads/{threadId}
     * Returns minimal state object to satisfy format
     */
    async getState(threadId) {
        // We might not need this if we fetch history directly in useFastAPIStream
        // But let's implement just in case
        return { values: [] };
    }

    async getHistory(threadId) {
        try {
            const res = await fetch(`${this.client.apiUrl}/ml/agent/threads/${threadId}`, {
                headers: {
                    ...(this.client.apiKey && { "Authorization": `Bearer ${this.client.apiKey}` }),
                }
            });
            if (!res.ok) return [];
            return await res.json();
        } catch (e) {
            console.error("Error fetching history:", e);
            return [];
        }
    }
}

export function createClient(apiUrl, apiKey) {
    return new CustomClient({ apiUrl, apiKey });
}
