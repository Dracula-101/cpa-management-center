/**
 * The job-portal app's AI console, served by the app behind the same hostname (the tunnel sends /jp/* to it).
 * It needs the app's panel token (JP_PANEL_TOKEN in the app's .env), kept like the management key.
 */
import { obfuscatedStorage } from '@/services/storage/secureStorage';

const TOKEN_KEY = 'jpPanelToken';

export type Lane = 'cli' | 'api' | 'shadow';
export type Stats = {
  calls: number;
  failed: number;
  tokens: number;
  p50: number | null;
  p90: number | null;
  agree: number | null;
  agreeCalls: number;
};
export type Finding = { tone: 'danger' | 'warning' | 'success' | 'info'; title: string; detail: string; purpose?: string; action?: { lane: Lane } };
export type Task = { purpose: string; component: string; kind: string; lane: Lane; cliOnly: boolean; pool: string; stats: Stats };
export type Component = { key: string; label: string; priority: string; capHit: string | null; proxyKey: boolean; lanes: Record<Lane, number>; stats: Stats };
export type Account = {
  kind: 'claude' | 'proxy';
  account: string;
  channel?: string;
  status?: string;
  plan?: string;
  resting?: boolean;
  why?: string;
  week?: number | null;
  fiveHour?: number | null;
  success?: number;
  failed?: number;
  pools?: string[];
};
export type Overview = { day: Stats; lanes: Record<Lane, Stats>; findings: Finding[]; components: Component[]; tasks: Task[]; accounts: Account[] };
export type Flow = Stats & { component: string; purpose: string; lane: Lane; provider: string; model: string; account: string };
export type Call = {
  id: number;
  ts: number;
  component: string;
  purpose: string;
  lane: Lane;
  provider: string;
  model: string;
  account: string;
  outcome: string;
  errorKind: string;
  seconds: number;
  agree: number | null;
  detail: string;
};
export type Member = { channel: string; model: string };
export type Bench = { at: number; results: (Member & { n: number; failed: number; score: number; p50_s: number | null })[] } | null;
export type Pools = {
  pools: { name: string; members: Member[]; stats: Stats; usedBy: string[] }[];
  bench: Record<string, Bench>;
  benchRunning: boolean;
  models: { model: string; maker?: string; inputs?: string[]; note?: string; good_for?: string[]; stats: Stats }[];
  channels: string[];
};

export type AgentRow = {
  id: string;
  label: string;
  open: number;
  critical: boolean;
  mode: 'off' | 'shadow' | 'live';
  tokensToday: number;
  investigationsToday: number;
  lastWake: string | null;
  profile: { goal: string; tokensDay: number; investigationsDay: number; error: string } | null;
};
export type AgentIncident = { id: number; ownerLabel: string; severity: 'info' | 'warning' | 'critical'; title: string; rule: string; count: number; lastAt: string };
export type AgentAction = { id: number; actorLabel: string; kind: string; target: string; status: string; result: string; reason: string; createdAt: string };
export type AgentFix = { id: number; owner: string; title: string; state: string; issue: number | null; pr: number | null; checks: string; risky: string };
export type Agents = {
  mode: 'off' | 'shadow' | 'live';
  dashboard: string;
  agents: AgentRow[];
  brain: { tokensToday: number; lastReview: string | null };
  incidents: AgentIncident[];
  waiting: AgentAction[];
  recent: AgentAction[];
  fixes: AgentFix[];
};

export const panelToken = {
  get: (): string => obfuscatedStorage.getItem<string>(TOKEN_KEY) || '',
  set: (value: string) => obfuscatedStorage.setItem(TOKEN_KEY, value.trim()),
};

export async function jp<T>(base: string, path: string, body?: unknown, token: string = panelToken.get()): Promise<T> {
  const res = await fetch(`${base.replace(/\/+$/, '')}/jp/api/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'X-JP-Panel-Token': token, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    if (res.status === 403) throw new Error('The panel token is missing or wrong (JP_PANEL_TOKEN in the job-portal .env).');
    let message = `HTTP ${res.status}`;
    try {
      message = JSON.parse(text).error?.message || JSON.parse(text).detail || message;
    } catch {
      /* not JSON */
    }
    throw new Error(message);
  }
  return JSON.parse(text) as T;
}
