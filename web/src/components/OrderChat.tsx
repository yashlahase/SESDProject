"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

type Msg = {
  id: string;
  content: string;
  createdAt: string;
  sender: { id: string; name: string; role: string };
};

export function OrderChat({ orderId }: { orderId: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"idle" | "connecting" | "live" | "error">("idle");
  const socketRef = useRef<Socket | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const url = useMemo(() => process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:3001", []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatus("connecting");
      const r = await fetch("/api/auth/socket-token", { credentials: "include" });
      if (!r.ok) {
        setStatus("error");
        return;
      }
      const { token } = (await r.json()) as { token: string };
      if (cancelled) return;
      const socket = io(url, {
        transports: ["websocket", "polling"],
        auth: { token },
      });
      socketRef.current = socket;
      socket.on("connect", () => {
        setStatus("live");
        socket.emit("join_order", orderId);
      });
      socket.on("connect_error", () => setStatus("error"));
      socket.on("new_message", (msg: Msg) => {
        setMessages((m) => (m.some((x) => x.id === msg.id) ? m : [...m, msg]));
      });
    })();
    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [orderId, url]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetch(`/api/orders/${orderId}/messages`, { credentials: "include" });
      if (!r.ok) return;
      const data = (await r.json()) as { messages: Msg[] };
      if (!cancelled) setMessages(data.messages);
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    const text = input.trim();
    if (!text) return;
    const clientMsgId = crypto.randomUUID();
    setInput("");
    const socket = socketRef.current;
    if (socket?.connected) {
      socket.emit(
        "send_message",
        { orderId, content: text, clientMsgId },
        (ack: { ok?: boolean; error?: string } | undefined) => {
          if (!ack?.ok) void restFallback(text, clientMsgId);
        },
      );
      return;
    }
    await restFallback(text, clientMsgId);
  }

  async function restFallback(content: string, clientMsgId: string) {
    const r = await fetch(`/api/orders/${orderId}/messages`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content, clientMsgId }),
    });
    if (r.ok) {
      const data = (await r.json()) as { message: Msg };
      setMessages((m) => (m.some((x) => x.id === data.message.id) ? m : [...m, data.message]));
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold tracking-tight text-[var(--foreground)]">Order chat</h3>
        <span className="text-xs text-[var(--muted)]">
          {status === "live" && "Live"}
          {status === "connecting" && "Connecting…"}
          {status === "error" && "REST fallback"}
          {status === "idle" && ""}
        </span>
      </div>
      <div className="mb-3 max-h-72 space-y-2 overflow-y-auto rounded-xl bg-[var(--muted-bg)] p-3">
        {messages.length === 0 && (
          <p className="text-sm text-[var(--muted)]">No messages yet. Say hello to the store.</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className="rounded-lg bg-[var(--card)] px-3 py-2 text-sm shadow-sm">
            <div className="mb-0.5 flex items-center justify-between gap-2">
              <span className="font-medium text-[var(--foreground)]">{m.sender.name}</span>
              <span className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                {m.sender.role.replace("_", " ")}
              </span>
            </div>
            <p className="text-[var(--foreground)]">{m.content}</p>
          </div>
        ))}
        <div ref={bottom} />
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void send()}
          placeholder="Type a message…"
          className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:ring-2"
        />
        <button
          type="button"
          onClick={() => void send()}
          className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-95"
        >
          Send
        </button>
      </div>
    </div>
  );
}
