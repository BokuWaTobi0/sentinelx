import { test } from 'node:test';
import assert from 'node:assert/strict';
import { can, type Role, type Permission } from '../src/lib/rbac';
test('permissions deny escalation for every role',()=>{
 const matrix: Record<Role, boolean[]> = {VIEWER:[true,true,false,false,false],ANALYST:[true,true,true,false,false],ADMIN:[true,true,true,true,true]};
 const permissions:Permission[]=['events:read','alerts:read','alerts:update','audit:read','users:read'];
 for(const role of Object.keys(matrix) as Role[]) permissions.forEach((p,i)=>assert.equal(can(role,p),matrix[role][i],`${role}:${p}`));
 assert.equal(can('UNKNOWN' as Role,'alerts:read'),false);
});
