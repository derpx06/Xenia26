import { useState, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';

export function useFastAPIStream({
    apiUrl,
    apiKey,
    assistantId,
    threadId,
    onThreadId,
}) {
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(undefined);
    const abortControllerRef = useRef(null);
    const messagesRef = useRef([]);

    // Helper to update messages state and ref synchronously
    const setMessagesSafe = (newMessages) => {
        if (typeof newMessages === 'function') {
            setMessages(prev => {
                const updated = newMessages(prev);
                messagesRef.current = updated;
                return updated;
            });
        } else {
            messagesRef.current = newMessages;
            setMessages(newMessages);
        }
    };

    // Fetch history when threadId changes
    useEffect(() => {
        async function fetchHistory() {
            if (!threadId) {
                setMessages([]);
                messagesRef.current = [];
                return;
            }

            try {
                const res = await fetch(`${apiUrl}/ml/agent/threads/${threadId}`);
                if (!res.ok) throw new Error("Failed to fetch history");

                const history = await res.json();

                // Map backend history to frontend message format
                const mappedMessages = history.map(msg => {
                    if (msg.role === 'user') {
                        return {
                            id: uuidv4(),
                            type: 'human',
                            content: msg.content
                        };
                    } else if (msg.role === 'assistant') {
                        // For now we don't have tool calls persisted fully, just content
                        return {
                            id: uuidv4(),
                            type: 'ai',
                            content: msg.content,
                            tool_calls: msg.tool_calls || []
                        };
                    }
                    return null;
                }).filter(Boolean);

                setMessagesSafe(mappedMessages);
            } catch (e) {
                console.error("Error fetching history:", e);
                toast.error("Failed to load conversation history");
            }
        }

        fetchHistory();
    }, [threadId, apiUrl]);

    const stop = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setIsLoading(false);
            toast.info("Stopped generation");
        }
    }, []);

    const submit = useCallback(async (values, options) => {
        try {
            if (isLoading) return;
            setIsLoading(true);
            setError(undefined);

            // 1. Handle Optimistic Updates (e.g., adding User Message)
            if (options?.optimisticValues) {
                const optimistic = options.optimisticValues({ messages: messagesRef.current });
                if (optimistic.messages) {
                    setMessagesSafe(optimistic.messages);
                }
            }

            // 2. Prepare Payload
            const currentMessages = messagesRef.current;
            const lastMessage = currentMessages[currentMessages.length - 1];

            if (!lastMessage) {
                setIsLoading(false);
                return;
            }

            // Extract User Message Content
            let userMessage = "";
            if (lastMessage.type === 'human') {
                if (Array.isArray(lastMessage.content)) {
                    userMessage = lastMessage.content
                        .filter(c => c.type === 'text')
                        .map(c => c.text)
                        .join('\n');
                } else {
                    userMessage = lastMessage.content;
                }
            }

            // Format History (excluding the last new message)
            const history = currentMessages.slice(0, -1).map(msg => {
                if (msg.type === 'human') {
                    // Normalize content to string if array
                    const content = Array.isArray(msg.content)
                        ? msg.content.filter(c => c.type === 'text').map(c => c.text).join('\n')
                        : msg.content;
                    return { role: 'user', content };
                } else if (msg.type === 'ai') {
                    return {
                        role: 'assistant',
                        content: msg.content || "",
                        tool_calls: msg.tool_calls
                    };
                } else if (msg.type === 'tool') {
                    return {
                        role: 'tool',
                        content: msg.content,
                        tool_call_id: msg.tool_call_id,
                        name: msg.name
                    };
                }
                return null;
            }).filter(Boolean);

            // 3. Start Streaming Request
            abortControllerRef.current = new AbortController();

            // Use apiUrl passed to the hook (should be localhost:8000 from provider)
            const response = await fetch(`${apiUrl}/ml/agent/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': apiKey ? `Bearer ${apiKey}` : undefined,
                },
                body: JSON.stringify({
                    message: userMessage,
                    model: "qwen2.5:7b",
                    conversation_history: history,
                    max_iterations: 10
                }),
                signal: abortControllerRef.current.signal,
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Server Error: ${response.status} ${errText}`);
            }

            // 4. Handle Streaming Response
            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            // Create initial AI placeholder message
            let activeAiMessageId = uuidv4();
            const initialAiMessage = {
                id: activeAiMessageId,
                type: 'ai',
                content: '',
                tool_calls: []
            };

            setMessagesSafe(prev => [...prev, initialAiMessage]);

            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n\n');
                buffer = lines.pop();

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const jsonStr = line.slice(6);
                        try {
                            const chunk = JSON.parse(jsonStr);

                            setMessages(prev => {
                                const nextMessages = [...prev];

                                if (chunk.type === 'response') {
                                    const msgIndex = nextMessages.findIndex(m => m.id === activeAiMessageId);
                                    if (msgIndex !== -1) {
                                        nextMessages[msgIndex] = {
                                            ...nextMessages[msgIndex],
                                            content: nextMessages[msgIndex].content + chunk.content
                                        };
                                    }
                                } else if (chunk.type === 'tool_call') {
                                    const msgIndex = nextMessages.findIndex(m => m.id === activeAiMessageId);
                                    if (msgIndex !== -1) {
                                        const currentMsg = nextMessages[msgIndex];
                                        const toolCall = {
                                            id: uuidv4(),
                                            name: chunk.tool_name,
                                            args: chunk.tool_input,
                                            type: "tool_call"
                                        };
                                        nextMessages[msgIndex] = {
                                            ...currentMsg,
                                            tool_calls: [...(currentMsg.tool_calls || []), toolCall]
                                        };
                                    }
                                } else if (chunk.type === 'tool_result') {
                                    // 1. Find the tool call ID this result belongs to
                                    const activeMsg = nextMessages.find(m => m.id === activeAiMessageId);
                                    // Robustly find related tool call (avoiding findLast for compatibility)
                                    // We want the LAST tool call with matching name
                                    const matchingToolCalls = (activeMsg?.tool_calls || []).filter(tc => tc.name === chunk.tool_name);
                                    const relatedToolCall = matchingToolCalls.length > 0 ? matchingToolCalls[matchingToolCalls.length - 1] : null;

                                    // 2. Append ToolMessage
                                    const toolMsg = {
                                        id: uuidv4(),
                                        type: 'tool',
                                        name: chunk.tool_name,
                                        content: chunk.content || chunk.tool_output,
                                        tool_call_id: relatedToolCall?.id || "unknown"
                                    };
                                    nextMessages.push(toolMsg);

                                    // 3. Prepare for next turn
                                    const newAiId = uuidv4();
                                    activeAiMessageId = newAiId;
                                    nextMessages.push({
                                        id: newAiId,
                                        type: 'ai',
                                        content: '',
                                        tool_calls: []
                                    });
                                } else if (chunk.type === 'thought') {
                                    // Optional: Render thoughts
                                } else if (chunk.type === 'error') {
                                    toast.error(chunk.content);
                                }

                                messagesRef.current = nextMessages; // Sync ref
                                return nextMessages;
                            });

                        } catch (e) {
                            console.error("Error parsing SSE JSON", e);
                        }
                    }
                }
            }
            setIsLoading(false);

        } catch (e) {
            if (e.name === 'AbortError') return;
            console.error(e);
            setError(e);
            setIsLoading(false);
            toast.error("Error generating response", { description: e.message });
        }
    }, [apiUrl, apiKey]);

    return {
        messages,
        submit,
        stop,
        isLoading,
        error
    };
}
