const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface AIChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  engine?: string;
}

export interface AIChatRequestPayload {
  message: string;
  session_id?: string;
  history?: AIChatMessage[];
}

export interface AIChatResponseData {
  reply: string;
  session_id: string;
  engine_used: string;
  suggested_questions: string[];
  context_summary?: Record<string, unknown>;
}

export async function sendAIChatMessage(
  token: string | null | undefined,
  payload: AIChatRequestPayload
): Promise<AIChatResponseData> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API}/api/v1/manager/ai/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Failed to communicate with AI Manager Assistant.");
  }

  return res.json();
}

export async function fetchAISuggestions(
  token: string | null | undefined
): Promise<string[]> {
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API}/api/v1/manager/ai/suggestions`, {
    headers,
  });

  if (!res.ok) {
    return [
      "Give me a complete summary of today's performance",
      "Which ingredients are low on stock?",
      "What is our table occupancy rate?",
      "Show active kitchen order status",
    ];
  }

  return res.json();
}

export async function streamAIChatMessage(
  token: string | null | undefined,
  payload: AIChatRequestPayload,
  onChunk: (text: string) => void,
  onDone: (data: { session_id: string; engine: string }) => void,
): Promise<void> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API}/api/v1/manager/ai/chat/stream`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as Record<string, string>)?.detail ?? "Failed to stream AI response.");
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      try {
        const parsed = JSON.parse(raw) as { type: string; content?: string; session_id?: string; engine?: string };
        if (parsed.type === "chunk" && parsed.content) onChunk(parsed.content);
        if (parsed.type === "done" && parsed.session_id)
          onDone({ session_id: parsed.session_id, engine: parsed.engine ?? "live_db_fallback" });
      } catch {
        // ignore malformed SSE lines
      }
    }
  }
}
