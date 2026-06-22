/**
 * P3: agent self-service profile update
 */

export interface UpdateAgentMeBody {
  /** @minLength 1 */
  displayName?: string;
  /** @nullable */
  avatarUrl?: string | null;
}
