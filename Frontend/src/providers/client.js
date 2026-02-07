import { Client } from "@langchain/langgraph-sdk";

export function createClient(apiUrl, apiKey) {
    return new Client({
        apiKey,
        apiUrl,
    });
}
