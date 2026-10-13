import { can,type Role } from './rbac';
export function canReadIncidentTimeline(role:Role){return can(role,'alerts:read')&&can(role,'events:read');}
