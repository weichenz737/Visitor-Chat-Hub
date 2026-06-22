/** Role identifiers stored in agents.role and JWT payload. */
export const Role = {
  AGENT: "agent",
  SUPER_ADMIN: "super_admin",
} as const;

export type RoleType = (typeof Role)[keyof typeof Role];

/** Fine-grained permissions for API and UI guards. */
export const Permission = {
  AGENTS_MANAGE: "agents:manage",
  SESSIONS_READ_ALL: "sessions:read:all",
  SESSIONS_READ_OWN: "sessions:read:own",
  SESSIONS_TAKEOVER: "sessions:takeover",
  SESSIONS_REPLY: "sessions:reply",
  MESSAGES_READ_ALL: "messages:read:all",
  MESSAGES_READ_OWN: "messages:read:own",
  QUICK_REPLIES_MANAGE_OWN: "quick_replies:manage:own",
  QUICK_REPLIES_MANAGE_ALL: "quick_replies:manage:all",
  ADMIN_ACCESS: "admin:access",
} as const;

export type PermissionType = (typeof Permission)[keyof typeof Permission];

const ROLE_PERMISSIONS: Record<RoleType, readonly PermissionType[]> = {
  [Role.AGENT]: [
    Permission.SESSIONS_READ_OWN,
    Permission.SESSIONS_REPLY,
    Permission.MESSAGES_READ_OWN,
    Permission.QUICK_REPLIES_MANAGE_OWN,
  ],
  [Role.SUPER_ADMIN]: [
    Permission.ADMIN_ACCESS,
    Permission.AGENTS_MANAGE,
    Permission.SESSIONS_READ_ALL,
    Permission.SESSIONS_READ_OWN,
    Permission.SESSIONS_TAKEOVER,
    Permission.SESSIONS_REPLY,
    Permission.MESSAGES_READ_ALL,
    Permission.MESSAGES_READ_OWN,
    Permission.QUICK_REPLIES_MANAGE_OWN,
    Permission.QUICK_REPLIES_MANAGE_ALL,
  ],
};

export function normalizeRole(role: string | undefined | null): RoleType {
  return role === Role.SUPER_ADMIN ? Role.SUPER_ADMIN : Role.AGENT;
}

export function hasPermission(role: string | undefined | null, permission: PermissionType): boolean {
  const normalized = normalizeRole(role);
  return ROLE_PERMISSIONS[normalized].includes(permission);
}

export function isSuperAdmin(role: string | undefined | null): boolean {
  return normalizeRole(role) === Role.SUPER_ADMIN;
}

export function canAccessSession(
  role: string | undefined | null,
  userId: number,
  sessionAgentId: number | null | undefined,
): boolean {
  if (isSuperAdmin(role)) return true;
  return sessionAgentId != null && sessionAgentId === userId;
}

/** All defined permissions (for admin UI). */
export function getAllPermissions(): readonly PermissionType[] {
  return Object.values(Permission);
}

/** Permissions granted to a role (for admin UI). */
export function getPermissionsForRole(role: string | undefined | null): readonly PermissionType[] {
  return ROLE_PERMISSIONS[normalizeRole(role)];
}

export const ROLE_LABELS: Record<RoleType, string> = {
  [Role.AGENT]: "普通客服",
  [Role.SUPER_ADMIN]: "超级管理员",
};

export const PERMISSION_LABELS: Record<PermissionType, string> = {
  [Permission.ADMIN_ACCESS]: "访问管理后台",
  [Permission.AGENTS_MANAGE]: "客服账号管理",
  [Permission.SESSIONS_READ_ALL]: "查看全部会话",
  [Permission.SESSIONS_READ_OWN]: "查看自己的会话",
  [Permission.SESSIONS_TAKEOVER]: "强制接管会话",
  [Permission.SESSIONS_REPLY]: "回复消息",
  [Permission.MESSAGES_READ_ALL]: "查看全部聊天记录",
  [Permission.MESSAGES_READ_OWN]: "查看自己的聊天记录",
  [Permission.QUICK_REPLIES_MANAGE_OWN]: "管理个人常用语",
  [Permission.QUICK_REPLIES_MANAGE_ALL]: "管理全部常用语",
};
