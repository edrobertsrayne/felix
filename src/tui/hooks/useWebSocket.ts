import { useState, useEffect, useRef, useCallback } from "react";
import type { ChatMessage } from "../components/MessageBubble.js";

interface ServerMessage {
  type:
    | "response"
    | "error"
    | "history"
    | "memory"
    | "searchResults"
    | "stream_start"
    | "stream_chunk"
    | "stream_end";
  content: string;
  sessionId?: string;
  timestamp: number;
}

interface UseWebSocketOptions {
  gatewayUrl: string;
}

interface UseWebSocketResult {
  messages: ChatMessage[];
  connected: boolean;
  isThinking: boolean;
  streamingContent: string;
  sendMessage: (content: string) => void;
  clearSession: () => void;
}

export function useWebSocket({
  gatewayUrl,
}: UseWebSocketOptions): UseWebSocketResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const sessionId = "default";

  useEffect(() => {
    const ws = new WebSocket(gatewayUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ type: "history", sessionId }));
    };

    ws.onmessage = (event) => {
      try {
        const msg: ServerMessage = JSON.parse(String(event.data));
        switch (msg.type) {
          case "response":
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: msg.content,
                timestamp: msg.timestamp,
              },
            ]);
            setIsThinking(false);
            break;

          case "error":
            setMessages((prev) => [
              ...prev,
              {
                role: "system",
                content: `Error: ${msg.content}`,
                timestamp: msg.timestamp,
              },
            ]);
            setIsThinking(false);
            setStreamingContent("");
            break;

          case "history":
            try {
              const history: ChatMessage[] = JSON.parse(msg.content);
              setMessages(history);
            } catch {
              // Ignore parse errors
            }
            break;

          case "stream_start":
            setIsThinking(false);
            setStreamingContent("");
            break;

          case "stream_chunk":
            setStreamingContent((prev) => prev + msg.content);
            break;

          case "stream_end":
            setStreamingContent("");
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: msg.content,
                timestamp: msg.timestamp,
              },
            ]);
            break;
        }
      } catch {
        // Ignore parse errors
      }
    };

    ws.onclose = () => {
      setConnected(false);
    };

    ws.onerror = () => {
      setConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [gatewayUrl]);

  const sendMessage = useCallback(
    (content: string) => {
      const trimmed = content.trim();
      if (!trimmed) return;

      setMessages((prev) => [
        ...prev,
        { role: "user", content: trimmed, timestamp: Date.now() },
      ]);
      setIsThinking(true);

      wsRef.current?.send(
        JSON.stringify({
          type: "message",
          content: trimmed,
          sessionId,
        }),
      );
    },
    [sessionId],
  );

  const clearSession = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: "clear", sessionId }));
    setMessages([]);
  }, [sessionId]);

  return {
    messages,
    connected,
    isThinking,
    streamingContent,
    sendMessage,
    clearSession,
  };
}
