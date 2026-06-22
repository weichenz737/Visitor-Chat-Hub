/** Apply super-admin SSO bridge params from agent console (local dev). */
export function applyAdminSessionBridgeFromUrl(): boolean {
  if (typeof window === "undefined") return false;

  const params = new URLSearchParams(window.location.search);
  if (params.get("bridge") !== "1") return false;

  const token = params.get("token");
  const role = params.get("role");
  if (!token || role !== "super_admin") return false;

  localStorage.setItem("admin_token", token);
  localStorage.setItem("admin_role", "super_admin");

  const username = params.get("username");
  if (username) localStorage.setItem("admin_username", username);

  const userId = params.get("userId");
  if (userId) localStorage.setItem("admin_id", userId);

  window.history.replaceState({}, "", window.location.pathname);
  return true;
}
