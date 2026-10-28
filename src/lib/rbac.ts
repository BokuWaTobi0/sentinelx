export type Role = 'VIEWER' | 'ANALYST' | 'ADMIN';
export type Permission = 'events:read' | 'alerts:read' | 'alerts:update' | 'alerts:escalate' | 'audit:read' | 'users:read' | 'rules:manage' | 'events:import' | 'notifications:read';
const grants: Record<Role, readonly Permission[]> = {
 VIEWER: ['events:read','alerts:read','alerts:escalate','notifications:read'],
 ANALYST: ['events:read','alerts:read','alerts:update','events:import','notifications:read'],
 ADMIN: ['events:read','alerts:read','alerts:update','audit:read','users:read','rules:manage','events:import','notifications:read'],
};
export function can(role: Role, permission: Permission): boolean {
 return grants[role]?.includes(permission) ?? false;
}
