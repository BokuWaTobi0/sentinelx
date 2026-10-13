import { test } from 'node:test';
import assert from 'node:assert/strict';
import { can, type Role, type Permission } from '../src/lib/rbac';
import { canReadIncidentTimeline } from '../src/lib/timeline-access';
test('permissions deny escalation for every role',()=>{
 const matrix: Record<Role, boolean[]> = {VIEWER:[true,true,false,false,false,false,false,true],ANALYST:[true,true,true,false,false,false,true,true],ADMIN:[true,true,true,true,true,true,true,true]};
 const permissions:Permission[]=['events:read','alerts:read','alerts:update','audit:read','users:read','rules:manage','events:import','notifications:read'];
 for(const role of Object.keys(matrix) as Role[]) permissions.forEach((p,i)=>assert.equal(can(role,p),matrix[role][i],`${role}:${p}`));
 assert.equal(can('UNKNOWN' as Role,'alerts:read'),false);
});
test('incident timeline requires both incident and event read permissions',()=>{
 for(const role of ['VIEWER','ANALYST','ADMIN'] as const)assert.equal(canReadIncidentTimeline(role),true);
 assert.equal(canReadIncidentTimeline('UNKNOWN' as Role),false);
});
