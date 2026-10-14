export const PERMISSIONS = [
  ["users", "Users"], ["publishers", "Publishers"], ["authors", "Authors"], ["books", "Books"], ["book_review", "Book Review"], ["orders", "Orders"],
  ["transactions", "Transactions"], ["sales", "Sales"], ["payouts", "Payouts"], ["support", "Support"], ["analytics", "Analytics"],
  ["activity_logs", "Activity Logs"], ["settings", "Settings"], ["admins", "Admins"],
] as const;
export type Permission = (typeof PERMISSIONS)[number][0];
export const ALL_PERMISSIONS = PERMISSIONS.map((p) => p[0]) as Permission[];

export const ROLES = [
  ["SUPER_ADMIN", "Super Admin"], ["OPERATIONS", "Operations Admin"], ["CONTENT", "Content Manager"], ["FINANCE", "Finance Admin"], ["SUPPORT", "Support Admin"],
] as const;
export type Role = (typeof ROLES)[number][0];
export const roleLabel = (r: string) => ROLES.find((x) => x[0] === r)?.[1] ?? r;

/** Starting permissions for each role (a Super Admin can then tailor them per person). */
export const ROLE_DEFAULTS: Record<Role, Permission[]> = {
  SUPER_ADMIN: ALL_PERMISSIONS,
  OPERATIONS: ["users", "publishers", "authors", "books", "orders", "support", "analytics"],
  CONTENT: ["authors", "books", "book_review", "analytics"],
  FINANCE: ["orders", "transactions", "sales", "payouts", "analytics"],
  SUPPORT: ["users", "publishers", "support"],
};

export function permsOf(admin: { role: string; permissions: string }): Permission[] {
  if (admin.role === "SUPER_ADMIN") return ALL_PERMISSIONS;
  try {
    const p = JSON.parse(admin.permissions) as string[];
    return p.filter((x): x is Permission => (ALL_PERMISSIONS as string[]).includes(x) && x !== "admins");
  } catch { return []; }
}
