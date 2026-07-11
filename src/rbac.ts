import type { PermissionKey, RoleDefinition, RoleName, User } from "./types";

export const ALL_PERMISSIONS: PermissionKey[] = [
  "dashboard.view",
  "inventory.view",
  "inventory.manage",
  "inventory.stock.update",
  "inventory.transactions.view",
  "sales.billing.create",
  "sales.billing.view",
  "sales.returns.create",
  "customers.manage",
  "collections.manage",
  "reports.view",
  "settings.view",
  "settings.manage",
  "statements.view",
  "users.manage",
  "roles.manage",
  "data.manage",
  "audit.view",
];

export const ROLE_DEFINITIONS: Record<RoleName, RoleDefinition> = {
  admin: {
    id: "admin",
    label: "Admin",
    description: "Full access to the entire ERP system and user management.",
    permissions: ALL_PERMISSIONS,
  },
  factory_ground_staff: {
    id: "factory_ground_staff",
    label: "Factory Ground Staff",
    description: "Inventory operations only for stock management and movement tracking.",
    permissions: [
      "dashboard.view",
      "inventory.view",
      "inventory.manage",
      "inventory.stock.update",
      "inventory.transactions.view",
    ],
  },
  tour_user: {
    id: "tour_user",
    label: "Tour User",
    description: "Sales and collections operations for field representatives.",
    permissions: [
      "dashboard.view",
      "sales.billing.create",
      "sales.billing.view",
      "sales.returns.create",
      "customers.manage",
      "collections.manage",
      "statements.view",
    ],
  },
};

export const ROUTE_PERMISSIONS: Record<string, PermissionKey> = {
  "/": "dashboard.view",
  "/inventory": "inventory.view",
  "/billing": "sales.billing.create",
  "/invoices": "sales.billing.view",
  "/returns": "sales.returns.create",
  "/customers": "customers.manage",
  "/collections": "collections.manage",
  "/reports": "reports.view",
  "/statements": "statements.view",
  "/settings": "settings.view",
};

export function getUserPermissions(user: Pick<User, "role" | "permissions"> | null | undefined): PermissionKey[] {
  if (!user) return [];
  if (user.role === "admin") return ALL_PERMISSIONS;
  const role = typeof user.role === "string" ? user.role : undefined;
  const basePermissions = ROLE_DEFINITIONS[role as RoleName]?.permissions ?? [];
  return Array.from(new Set([...basePermissions, ...(user.permissions ?? [])]));
}

export function hasPermission(user: Pick<User, "role" | "permissions"> | null | undefined, permission: PermissionKey): boolean {
  const permissions = getUserPermissions(user);
  return permissions.includes(permission);
}

export function canAccessRoute(user: Pick<User, "role" | "permissions"> | null | undefined, path: string): boolean {
  const permission = ROUTE_PERMISSIONS[path];
  if (!permission) return true;
  return hasPermission(user, permission);
}

export function getRoleLabel(role: RoleName): string {
  return ROLE_DEFINITIONS[role]?.label ?? role;
}
