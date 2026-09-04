import type { ActorRole } from "@/domain/types";

export type AppArea = "portal" | "cockpit" | "partner";

const PORTAL_ROLES: ActorRole[] = ["CLIENT", "ADVISOR"];
const COCKPIT_ROLES: ActorRole[] = ["ADVISOR"];
const PARTNER_ROLES: ActorRole[] = [
  "MORTGAGE_PARTNER",
  "CONVEYANCER",
  "MOVE_PARTNER",
];

const AREA_ROLES: Record<AppArea, readonly ActorRole[]> = {
  portal: PORTAL_ROLES,
  cockpit: COCKPIT_ROLES,
  partner: PARTNER_ROLES,
};

export function roleCanAccess(role: string, area: AppArea): boolean {
  return AREA_ROLES[area].includes(role as ActorRole);
}

export function requireRole(role: string, allowed: string | string[]): void {
  const allowedRoles = Array.isArray(allowed) ? allowed : [allowed];
  if (!allowedRoles.includes(role)) {
    throw new Error(
      `Forbidden: role ${role} not in [${allowedRoles.join(", ")}]`,
    );
  }
}

export function areaFromPath(pathname: string): AppArea | null {
  if (pathname.startsWith("/portal")) return "portal";
  if (pathname.startsWith("/cockpit")) return "cockpit";
  if (pathname.startsWith("/partner")) return "partner";
  return null;
}
