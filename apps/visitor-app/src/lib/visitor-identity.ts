import { generateVisitorId } from "@/lib/utils";

export const VISITOR_ID_KEY = "visitor_id";
export const VISITOR_NICKNAME_KEY = "visitor_nickname";

const ADJECTIVES = ["快樂", "友善", "活潑", "溫柔", "聰明", "勇敢", "開朗", "細心", "熱情", "耐心"];
const NOUNS = ["小貓", "小狗", "兔子", "熊貓", "企鵝", "海豚", "獅子", "老虎", "狐狸", "鸚鵡"];

export function generateNickname(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 900) + 100;
  return `${adj}${noun}${num}`;
}

/** Stable anonymous id — persisted in localStorage across visits. */
export function getOrCreateVisitorId(): string {
  let id = localStorage.getItem(VISITOR_ID_KEY)?.trim();
  if (!id) {
    id = generateVisitorId();
    localStorage.setItem(VISITOR_ID_KEY, id);
  }
  sessionStorage.setItem("visitorId", id);
  return id;
}

export function getStoredVisitorNickname(): string | null {
  const fromSession = sessionStorage.getItem("visitorNickname")?.trim();
  if (fromSession) return fromSession;

  const fromLocal = localStorage.getItem(VISITOR_NICKNAME_KEY)?.trim();
  return fromLocal || null;
}

/** Persist nickname for this browser so the same visitor keeps the same name. */
export function setStoredVisitorNickname(nickname: string): void {
  const trimmed = nickname.trim();
  if (!trimmed) return;
  localStorage.setItem(VISITOR_NICKNAME_KEY, trimmed);
  sessionStorage.setItem("visitorNickname", trimmed);
}

/** Reuse saved nickname; only generate once per browser if none exists. */
export function getOrCreateVisitorNickname(): string {
  const stored = getStoredVisitorNickname();
  if (stored) return stored;

  const generated = generateNickname();
  setStoredVisitorNickname(generated);
  return generated;
}

export function resolveInitialVisitorNickname(): string {
  return getStoredVisitorNickname() ?? "";
}

/** Restore visitorId from localStorage into sessionStorage when resuming. */
export function syncVisitorIdToSession(): string | null {
  let visitorId = sessionStorage.getItem("visitorId")?.trim();
  if (visitorId) return visitorId;

  visitorId = localStorage.getItem(VISITOR_ID_KEY)?.trim() ?? "";
  if (!visitorId) return null;

  sessionStorage.setItem("visitorId", visitorId);
  return visitorId;
}
