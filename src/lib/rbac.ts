export type Role = 'VIEWER' | 'ANALYST' | 'ADMIN';
export type Permission = 'events:read' | 'alerts:read' | 'alerts:update' | 'audit:read' | 'users:read';
const grants: Record<Role, readonly Permission[]> = {
 VIEWER: ['events:read','alerts:read'],
 ANALYST: ['events:read','alerts:read','alerts:update'],
 ADMIN: ['events:read','alerts:read','alerts:update','audit:read','users:read'],
};
export function can(role: Role, permission: Permission): boolean {
 return grants[role]?.includes(permission) ?? false;
}
