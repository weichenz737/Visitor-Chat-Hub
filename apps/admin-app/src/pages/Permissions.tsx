import {
  Role,
  Permission,
  getAllPermissions,
  getPermissionsForRole,
  hasPermission,
  ROLE_LABELS,
  PERMISSION_LABELS,
  type PermissionType,
} from "@workspace/permissions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Crown, User } from "lucide-react";

function PermissionMatrix({ role }: { role: typeof Role.AGENT | typeof Role.SUPER_ADMIN }) {
  const granted = new Set(getPermissionsForRole(role));
  const all = getAllPermissions();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {role === Role.SUPER_ADMIN ? (
            <Crown className="w-4 h-4 text-amber-600" />
          ) : (
            <User className="w-4 h-4 text-primary" />
          )}
          {ROLE_LABELS[role]}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {all.map((perm: PermissionType) => {
          const ok = granted.has(perm);
          return (
            <div key={perm} className="flex items-center justify-between gap-3 text-sm py-1">
              <span className={ok ? "text-foreground" : "text-muted-foreground line-through"}>
                {PERMISSION_LABELS[perm] ?? perm}
              </span>
              <Badge variant={ok ? "default" : "outline"} className="text-[10px] shrink-0">
                {ok ? "允许" : "禁止"}
              </Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default function PermissionsPage() {
  const adminPerms = getPermissionsForRole(Role.SUPER_ADMIN);

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">角色与权限</h1>
        <p className="text-sm text-muted-foreground mt-1">
          系统采用 RBAC 模型。超级管理员拥有普通客服的全部权限，并额外具备管理后台能力。
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <PermissionMatrix role={Role.AGENT} />
        <PermissionMatrix role={Role.SUPER_ADMIN} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">权限校验说明</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>· 普通客服登录客服工作台（:5174），只能访问分配给自己的会话。</p>
          <p>· 超级管理员可登录管理后台（:5175）和客服工作台，可查看/接管全部会话。</p>
          <p>· 客服管理、系统配置等操作需要「客服账号管理」权限（仅超管）。</p>
          <p className="pt-2 text-xs">
            当前登录角色权限数：{adminPerms.length} 项；
            管理后台访问：
            {hasPermission(Role.SUPER_ADMIN, Permission.ADMIN_ACCESS) ? "已启用" : "未启用"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
