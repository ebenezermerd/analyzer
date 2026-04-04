"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type WSStatus = "idle" | "connecting" | "connected" | "streaming" | "done" | "error";

interface UseWebSocketOptions {
  /** Auto-connect on mount */
  autoConnect?: boolean;
  /** Reconnect on disconnect (up to 3 times) */
  maxRetries?: number;
}

interface UseWebSocketReturn<T> {
  status: WSStatus;
  messages: T[];
  lastMessage: T | null;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
}

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace("http", "ws");

export function useWebSocket<T = Record<string, unknown>>(
  path: string,
  params?: Record<string, string>,
  options: UseWebSocketOptions = {},
): UseWebSocketReturn<T> {
  const { autoConnect = false, maxRetries = 2 } = options;
  const [status, setStatus] = useState<WSStatus>("idle");
  const [messages, setMessages] = useState<T[]>([]);
  const [lastMessage, setLastMessage] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const statusRef = useRef<string>("idle");
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const buildUrl = useCallback(() => {
    const qs = paramsRef.current
      ? "?" + new URLSearchParams(paramsRef.current).toString()
      : "";
    return `${API_BASE}${path}${qs}`;
  }, [path]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const updateStatus = useCallback((s: WSStatus) => {
    statusRef.current = s;
    setStatus(s);
  }, []);

  const connect = useCallback(() => {
    disconnect();
    setMessages([]);
    setLastMessage(null);
    setError(null);
    updateStatus("connecting");

    const ws = new WebSocket(buildUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      updateStatus("connected");
      retriesRef.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as T;
        setLastMessage(data);
        setMessages((prev) => [...prev, data]);

        const typed = data as Record<string, unknown>;
        if (typed.type === "done" || typed.type === "error") {
          updateStatus(typed.type === "error" ? "error" : "done");
          if (typed.type === "error" && typed.message) {
            setError(typed.message as string);
          }
        } else if (statusRef.current !== "streaming") {
          updateStatus("streaming");
        }
      } catch {
        // non-JSON message, ignore
      }
    };

    ws.onerror = () => {
      setError("WebSocket connection error");
      updateStatus("error");
    };

    ws.onclose = () => {
      if (statusRef.current === "done") return;
      if (retriesRef.current < maxRetries && statusRef.current !== "error") {
        retriesRef.current += 1;
        const delay = Math.min(1000 * 2 ** retriesRef.current, 8000);
        setTimeout(connect, delay);
      } else if (statusRef.current !== "done") {
        updateStatus("error");
      }
    };
  }, [buildUrl, disconnect, maxRetries, updateStatus]);

  useEffect(() => {
    if (autoConnect) connect();
    return disconnect;
  }, [autoConnect, connect, disconnect]);

  return { status, messages, lastMessage, error, connect, disconnect };
}
