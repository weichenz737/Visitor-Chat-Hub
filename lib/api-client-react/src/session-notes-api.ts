import { customFetch } from "./custom-fetch";
import type { PutSessionNotesBody, SessionNote, SessionNotesResponse } from "./generated/api.schemas";

export function getSessionNotesQueryKey(sessionId: number) {
  return ["/api/sessions", sessionId, "notes"] as const;
}

export async function getSessionNotes(sessionId: number): Promise<SessionNotesResponse> {
  return customFetch<SessionNotesResponse>(`/api/sessions/${sessionId}/notes`, {
    method: "GET",
  });
}

export async function putSessionNotes(sessionId: number, body: PutSessionNotesBody): Promise<SessionNote> {
  return customFetch<SessionNote>(`/api/sessions/${sessionId}/notes`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
