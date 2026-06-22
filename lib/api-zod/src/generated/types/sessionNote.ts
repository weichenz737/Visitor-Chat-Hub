/**
 * Session notes types (manual until next orval codegen)
 */
export interface SessionNote {
  id: number;
  sessionId: number;
  agentId: number;
  agentDisplayName?: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
  canEdit: boolean;
}

export interface SessionNotesResponse {
  notes: SessionNote[];
}

export interface PutSessionNotesBody {
  content: string;
}
