import type { AlertView } from '@/components/alert-queue';

export type Tone = 'high' | 'medium' | 'low' | 'none';

export type FocusIncident = {
  id: string;
  title: string;
  subtitle: string;
  tone: Tone;
  priorityLabel: string;
  band: string | null;
  score: number | null;
  status: string;
  statusLabel: string;
  source: string | null;
  actor: string | null;
  ago: string;
  iso: string;
  signal: string;
  rule: string;
  activity: string | null;
  riskText: string;
};

const ruleLabels: Record<string, string> = {
  'failed-login-burst-v1': 'Repeated login failures',
  'password-spray-v1': 'Password spraying',
  'ip-failures-across-actors-v1': 'Repeated failures from one source',
  'success-after-failure-burst-v1': 'Successful login after failures',
};

export const statusLabel = (status: string) => status.charAt(0) + status.slice(1).toLowerCase().replace('_', ' ');

export function toneFor(band: string | null, severity: string): Tone {
  const key = band ?? severity;
  return key === 'CRITICAL' || key === 'HIGH' ? 'high' : key === 'MEDIUM' ? 'medium' : key === 'LOW' ? 'low' : 'none';
}

export function ago(iso: string, now = Date.now()) {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 30 ? `${days}d ago` : iso.slice(0, 10);
}

export function sourceOf(evidence: AlertView['evidence']) {
  const ips = Array.isArray(evidence.sourceIps) ? evidence.sourceIps.filter((ip): ip is string => typeof ip === 'string') : [];
  const first = typeof evidence.sourceIp === 'string' ? evidence.sourceIp : ips[0] ?? null;
  const extra = ips.length > 1 ? ips.length - 1 : 0;
  return first ? (extra ? `${first} +${extra}` : first) : null;
}

export function actorOf(evidence: AlertView['evidence']) {
  if (typeof evidence.actor === 'string') return evidence.actor;
  return typeof evidence.actorCount === 'number' ? `${evidence.actorCount} actor labels` : null;
}

export function signalOf(evidence: AlertView['evidence']) {
  return evidence.demo === true ? 'Simulated signal' : evidence.detector ? 'Rule detected' : 'Seeded demo';
}

export function toFocusIncident(alert: AlertView, now = Date.now()): FocusIncident {
  const { evidence } = alert;
  const count = typeof evidence.failureCount === 'number' ? evidence.failureCount : null;
  const window = typeof evidence.windowSeconds === 'number' ? evidence.windowSeconds : null;
  return {
    id: alert.id,
    title: alert.title,
    subtitle: evidence.explanation ?? 'A sample incident for testing your investigation workflow.',
    tone: toneFor(alert.priority_band, alert.severity),
    priorityLabel: alert.priority_band ? `${statusLabel(alert.priority_band)} priority` : 'Unscored',
    band: alert.priority_band,
    score: alert.priority_score,
    status: alert.status,
    statusLabel: statusLabel(alert.status),
    source: sourceOf(evidence),
    actor: actorOf(evidence),
    ago: ago(alert.created_at, now),
    iso: alert.created_at,
    signal: signalOf(evidence),
    rule: ruleLabels[evidence.detector ?? alert.rule_id] ?? alert.rule_id,
    activity: count === null ? null : `${count} failure${count === 1 ? '' : 's'}${window === null ? '' : ` in ${window}s`}`,
    riskText: alert.priority_score === null
      ? 'There is not enough recorded evidence to calculate a priority score yet.'
      : strongestFactor(alert),
  };
}

function strongestFactor(alert: AlertView) {
  const top = [...(alert.score_factors ?? [])].sort((a, b) => b.points - a.points)[0];
  return top ? `Strongest factor: ${top.label} (+${top.points}). Open the incident for the full breakdown.` : 'Priority is calculated from the recorded evidence.';
}
