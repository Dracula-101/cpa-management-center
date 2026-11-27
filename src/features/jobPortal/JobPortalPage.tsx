import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAuthStore } from '@/stores';
import { jp, panelToken, type Agents, type Call, type Flow, type Lane, type Member, type Overview, type Pools, type Stats } from './api';
import styles from './JobPortalPage.module.scss';

type Tab = 'needs' | 'agents' | 'components' | 'map' | 'calls' | 'pools' | 'accounts';
const TABS: { key: Tab; label: string }[] = [
  { key: 'needs', label: 'Needs a look' },
  { key: 'agents', label: 'Agents' },
  { key: 'components', label: 'Components' },
  { key: 'map', label: 'Who uses what' },
  { key: 'calls', label: 'Every call' },
  { key: 'pools', label: 'Pools & models' },
  { key: 'accounts', label: 'Accounts' },
];
const LANE: Record<Lane, string> = { cli: 'CLI', api: 'API', shadow: 'Shadow' };
const secs = (n: number | null | undefined) => (n == null ? '—' : n < 10 ? `${n.toFixed(1)}s` : `${Math.round(n)}s`);
const num = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}k` : String(n));

function StatPills({ s }: { s: Stats }) {
  if (!s.calls) return <span className={styles.pill}>no calls</span>;
  return (
    <>
      <span className={styles.pill}>{num(s.calls)} calls</span>
      {s.failed ? <span className={styles.danger}>{s.failed} failed</span> : null}
      <span className={styles.pill}>median {secs(s.p50)}</span>
      {s.agree != null ? (
        <span className={s.agree >= 0.85 ? styles.success : s.agree < 0.6 ? styles.warning : styles.pill}>
          agrees {Math.round(s.agree * 100)}% · {s.agreeCalls}
        </span>
      ) : null}
    </>
  );
}

/** load() now and whenever `key` changes; reload() runs it again. */
function useLoad<T>(load: () => Promise<T>, key: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [round, setRound] = useState(0);
  useEffect(() => {
    let live = true;
    load().then(
      (d) => {
        if (!live) return;
        setData(d);
        setError('');
      },
      (e: Error) => live && setError(e.message)
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, round]);
  return { data, error, reload: () => setRound((r) => r + 1) };
}

function TokenGate({ onSaved }: { onSaved: () => void }) {
  const [value, setValue] = useState('');
  return (
    <Card title="Connect the job-portal app">
      <p className={styles.muted}>
        Paste the app's panel token (JP_PANEL_TOKEN in ~/job-portal/config/.env on the GCP VM). It stays in this browser.
      </p>
      <div className={styles.row}>
        <input className={`${styles.input} ${styles.grow}`} type="password" value={value} onChange={(e) => setValue(e.target.value)} placeholder="panel token" />
        <Button
          size="sm"
          disabled={!value.trim()}
          onClick={() => {
            panelToken.set(value);
            onSaved();
          }}
        >
          Save
        </Button>
      </div>
    </Card>
  );
}

export function JobPortalPage() {
  const apiBase = useAuthStore((s) => s.apiBase) || window.location.origin;
  const [tab, setTab] = useState<Tab>('needs');
  const [hasToken, setHasToken] = useState(Boolean(panelToken.get()));
  const overview = useLoad(() => jp<Overview>(apiBase, 'overview'), `${apiBase}|${hasToken}`);
  const [notice, setNotice] = useState('');
  const setLane = (purpose: string, lane: Lane) =>
    jp(apiBase, 'profiles', { lanes: { [purpose]: lane } }).then(overview.reload, (e: Error) => setNotice(e.message));

  if (!hasToken) return <TokenGate onSaved={() => setHasToken(true)} />;
  const d = overview.data;
  return (
    <div className={styles.page}>
      <div className={styles.tabs}>
        {TABS.map((t) => (
          <button key={t.key} type="button" className={tab === t.key ? styles.tabActive : styles.tab} onClick={() => setTab(t.key)}>
            {t.label}
            {t.key === 'needs' && d?.findings.length ? ` · ${d.findings.length}` : ''}
          </button>
        ))}
        <Button size="sm" variant="ghost" onClick={() => setHasToken(false)}>
          Change token
        </Button>
      </div>
      {notice ? <div className={styles.row}><span className={styles.warning}>{notice}</span></div> : null}
      {overview.error ? <Card title="Couldn't load"><p className={styles.muted}>{overview.error}</p></Card> : null}
      {tab === 'agents' ? (
        <AgentsTab apiBase={apiBase} />
      ) : !d ? null : tab === 'needs' ? (
        <Needs d={d} setLane={setLane} />
      ) : tab === 'components' ? (
        <Components d={d} setLane={setLane} />
      ) : tab === 'map' ? (
        <MapTab apiBase={apiBase} />
      ) : tab === 'calls' ? (
        <Calls apiBase={apiBase} />
      ) : tab === 'pools' ? (
        <PoolsTab apiBase={apiBase} notify={setNotice} />
      ) : (
        <Accounts d={d} />
      )}
    </div>
  );
}

function Needs({ d, setLane }: { d: Overview; setLane: (p: string, l: Lane) => void }) {
  return (
    <>
      <div className={styles.metrics}>
        <div className={styles.metric}><b>{num(d.day.calls)}</b><span>AI calls today</span></div>
        <div className={styles.metric}><b>{d.day.failed}</b><span>failed today</span></div>
        <div className={styles.metric}><b>{secs(d.day.p50)}</b><span>median answer</span></div>
        <div className={styles.metric}><b>{num(d.day.tokens)}</b><span>tokens today</span></div>
        {(['cli', 'api', 'shadow'] as Lane[]).map((l) => (
          <div key={l} className={styles.metric}><b>{num(d.lanes[l].calls)}</b><span>{LANE[l]} lane calls</span></div>
        ))}
      </div>
      <Card title="Needs a look">
        <div className={styles.list}>
          {d.findings.length ? (
            d.findings.map((f) => (
              <div key={f.title} className={styles.row}>
                <span className={styles[f.tone]}>{f.tone}</span>
                <span className={styles.grow}>
                  <b>{f.title}</b>
                  <br />
                  <span className={styles.muted}>{f.detail}</span>
                </span>
                {f.action && f.purpose ? (
                  <Button size="sm" onClick={() => setLane(f.purpose!, f.action!.lane)}>Switch to {LANE[f.action.lane]}</Button>
                ) : null}
              </div>
            ))
          ) : (
            <p className={styles.muted}>Nothing needs you.</p>
          )}
        </div>
      </Card>
    </>
  );
}

function Components({ d, setLane }: { d: Overview; setLane: (p: string, l: Lane) => void }) {
  const [pick, setPick] = useState(d.components[0]?.key);
  const comp = d.components.find((c) => c.key === pick);
  return (
    <div className={styles.split}>
      <div className={styles.side}>
        {d.components.map((c) => (
          <button key={c.key} type="button" className={c.key === pick ? styles.sideActive : styles.sideItem} onClick={() => setPick(c.key)}>
            <b>{c.label}</b>
            <br />
            <span className={styles.muted}>
              {num(c.stats.calls)} today · {c.priority.replace('_', ' ')}
              {c.capHit ? ' · capped' : ''}
            </span>
          </button>
        ))}
      </div>
      <Card title={comp ? `${comp.label} — tasks and lanes` : 'Tasks'}>
        <div className={styles.list}>
          {d.tasks
            .filter((t) => t.component === pick)
            .map((t) => (
              <div key={t.purpose} className={styles.row}>
                <span className={styles.grow}>
                  <b>{t.purpose}</b>
                  <br />
                  <span className={styles.muted}>{t.kind} · pool {t.pool}</span>
                </span>
                {t.cliOnly ? (
                  <span className={styles.info}>CLI only</span>
                ) : (
                  <span className={styles.lanes}>
                    {(['cli', 'shadow', 'api'] as Lane[]).map((l) => (
                      <button key={l} type="button" className={t.lane === l ? styles.laneActive : styles.lane} onClick={() => setLane(t.purpose, l)}>
                        {LANE[l]}
                      </button>
                    ))}
                  </span>
                )}
                <StatPills s={t.stats} />
              </div>
            ))}
        </div>
      </Card>
    </div>
  );
}

function MapTab({ apiBase }: { apiBase: string }) {
  const flows = useLoad(() => jp<{ flows: Flow[] }>(apiBase, 'flows?hours=24'), apiBase);
  const groups = useMemo(() => {
    const out = new Map<string, Flow[]>();
    for (const f of flows.data?.flows ?? []) out.set(f.component, [...(out.get(f.component) ?? []), f]);
    return [...out.entries()];
  }, [flows.data]);
  return (
    <>
      {groups.map(([component, rows]) => (
        <Card key={component} title={`${component} — last 24 h`}>
          <div className={styles.list}>
            {rows.map((r) => (
              <div key={`${r.purpose}-${r.lane}-${r.provider}-${r.model}-${r.account}`} className={styles.row}>
                <b className={styles.grow}>{r.purpose}</b>
                <span className={r.lane === 'api' ? styles.info : styles.pill}>{LANE[r.lane]}</span>
                <span>{r.provider}</span>
                <span className={styles.muted}>{r.model}</span>
                {r.account ? <span className={styles.pill}>{r.account}</span> : null}
                <StatPills s={r} />
              </div>
            ))}
          </div>
        </Card>
      ))}
      {flows.error ? <p className={styles.muted}>{flows.error}</p> : null}
    </>
  );
}

function Calls({ apiBase }: { apiBase: string }) {
  const [failed, setFailed] = useState(false);
  const calls = useLoad(() => jp<{ calls: Call[] }>(apiBase, `calls?hours=24${failed ? '&outcome=failed' : ''}`), `${apiBase}|${failed}`);
  const [open, setOpen] = useState<number | null>(null);
  const detail = useLoad(() => (open ? jp<Record<string, unknown>>(apiBase, `calls/${open}`) : Promise.resolve(null)), `${apiBase}|${open}`);
  return (
    <div className={open ? styles.split : undefined} style={open ? { gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)' } : undefined}>
      <Card title="Every call (24 h)" extra={<Button size="sm" variant="secondary" onClick={() => setFailed(!failed)}>{failed ? 'Show all' : 'Failed only'}</Button>}>
        <div className={styles.list}>
          {(calls.data?.calls ?? []).map((c) => (
            <button key={c.id} type="button" className={styles.row} style={{ border: 0, textAlign: 'left', color: 'inherit', cursor: 'pointer' }} onClick={() => setOpen(c.id)}>
              <span className={styles.muted}>{new Date(c.ts * 1000).toLocaleTimeString()}</span>
              <span className={styles.grow}>
                <b>{c.purpose || '—'}</b>
                <br />
                <span className={styles.muted}>{c.provider} · {c.model}{c.account ? ` · ${c.account}` : ''}</span>
              </span>
              <span className={c.lane === 'api' ? styles.info : styles.pill}>{LANE[c.lane]}</span>
              {c.outcome === 'ok' ? <span className={styles.success}>{c.agree != null ? `agrees ${Math.round(c.agree * 100)}%` : 'ok'}</span> : <span className={styles.danger}>{c.errorKind || c.outcome}</span>}
              <span className={styles.pill}>{secs(c.seconds)}</span>
            </button>
          ))}
        </div>
      </Card>
      {open ? (
        <Card title={`Call ${open}`} extra={<Button size="sm" variant="ghost" onClick={() => setOpen(null)}>Close</Button>}>
          <pre className={styles.pre}>{detail.data ? JSON.stringify(detail.data, null, 2) : detail.error || 'Loading…'}</pre>
        </Card>
      ) : null}
    </div>
  );
}

function PoolsTab({ apiBase, notify }: { apiBase: string; notify: (m: string) => void }) {
  const pools = useLoad(() => jp<Pools>(apiBase, 'pools'), apiBase);
  const [pick, setPick] = useState<string | null>(null);
  const [draft, setDraft] = useState<Member[] | null>(null);
  const data = pools.data;
  if (!data) return <p className={styles.muted}>{pools.error || 'Loading…'}</p>;
  const pool = data.pools.find((p) => p.name === (pick ?? data.pools[0]?.name));
  const members = draft ?? pool?.members ?? [];
  const apply = () =>
    pool &&
    jp(apiBase, 'profiles', { pools: { [pool.name]: members }, apply: true }).then(
      () => {
        setDraft(null);
        notify(`${pool.name} saved and pushed to the proxy`);
        pools.reload();
      },
      (e: Error) => notify(e.message)
    );
  const bench = (kind: 'fast' | 'write') =>
    jp<{ started: boolean; why?: string }>(apiBase, 'bench', { kind }).then((r) => notify(r.started ? `Benchmark ${kind} started` : r.why || ''), (e: Error) => notify(e.message));
  return (
    <>
      <div className={styles.split}>
        <div className={styles.side}>
          {data.pools.map((p) => (
            <button key={p.name} type="button" className={p.name === pool?.name ? styles.sideActive : styles.sideItem} onClick={() => { setPick(p.name); setDraft(null); }}>
              <b>{p.name.replace(/^jp-/, '')}</b>
              <br />
              <span className={styles.muted}>{p.members.length} models · {p.usedBy.length} API tasks</span>
            </button>
          ))}
        </div>
        {pool ? (
          <Card title={pool.name} extra={<Button size="sm" disabled={!draft} onClick={apply}>Apply to proxy</Button>}>
            <p className={styles.muted}>{pool.usedBy.length ? `Answers ${pool.usedBy.join(', ')}` : 'No task sends API calls here yet.'}</p>
            <div className={styles.list}>
              {members.map((m, i) => (
                <div key={`${i}-${m.channel}`} className={styles.row}>
                  <select className={styles.input} value={m.channel} onChange={(e) => setDraft(members.map((x, j) => (j === i ? { ...x, channel: e.target.value } : x)))}>
                    {data.channels.map((c) => <option key={c}>{c}</option>)}
                  </select>
                  <input className={`${styles.input} ${styles.grow}`} value={m.model} onChange={(e) => setDraft(members.map((x, j) => (j === i ? { ...x, model: e.target.value } : x)))} />
                  <Button size="sm" variant="ghost" onClick={() => setDraft(members.filter((_, j) => j !== i))}>Remove</Button>
                </div>
              ))}
              <Button size="sm" variant="secondary" onClick={() => setDraft([...members, { channel: 'antigravity', model: '' }])}>Add model</Button>
            </div>
          </Card>
        ) : null}
      </div>
      <Card
        title="Benchmark on your data"
        extra={
          <span className={styles.row} style={{ background: 'transparent', padding: 0 }}>
            <Button size="sm" variant="secondary" disabled={data.benchRunning} onClick={() => bench('fast')}>Run fast</Button>
            <Button size="sm" variant="secondary" disabled={data.benchRunning} onClick={() => bench('write')}>Run write</Button>
          </span>
        }
      >
        {data.benchRunning ? <span className={styles.info}>running…</span> : null}
        {(['fast', 'write'] as const).map((k) => (
          <Section key={k} title={`${k} — ${data.bench[k] ? new Date(data.bench[k]!.at * 1000).toLocaleString() : 'not run yet'}`}>
            {[...(data.bench[k]?.results ?? [])].sort((a, b) => b.score - a.score).map((r) => (
              <div key={`${r.channel}-${r.model}`} className={styles.row}>
                <b className={styles.grow}>{r.model}</b>
                <span className={styles.pill}>{r.channel}</span>
                <span className={r.score >= 0.8 ? styles.success : r.score < 0.5 ? styles.warning : styles.pill}>{Math.round(r.score * 100)}% right</span>
                <span className={styles.pill}>median {secs(r.p50_s)}</span>
                {r.failed ? <span className={styles.danger}>{r.failed}/{r.n} failed</span> : null}
              </div>
            ))}
          </Section>
        ))}
      </Card>
      <Card title="Models">
        <div className={styles.list}>
          {data.models.map((m) => (
            <div key={m.model} className={styles.row}>
              <b>{m.model}</b>
              {m.maker ? <span className={styles.pill}>{m.maker}</span> : null}
              {m.inputs?.includes('image') ? <span className={styles.info}>reads images</span> : null}
              {m.good_for?.map((g) => <span key={g} className={styles.pill}>{g}</span>)}
              <span className={`${styles.muted} ${styles.grow}`}>{m.note}</span>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginTop: 10 }}>
      <p className={styles.muted}>{title}</p>
      <div className={styles.list}>{children}</div>
    </div>
  );
}

function Accounts({ d }: { d: Overview }) {
  return (
    <>
      <Card title="Claude on the CLI (add one: ssh -t gcp ai-login claude <name>)">
        <div className={styles.list}>
          {d.accounts.filter((a) => a.kind === 'claude').map((a) => (
            <div key={a.account} className={styles.row}>
              <b className={styles.grow}>{a.account}</b>
              {a.resting ? <span className={styles.warning}>resting: {a.why}</span> : <span className={styles.success}>ready</span>}
              <span className={styles.muted}>week {a.week == null ? '—' : `${Math.round(a.week)}%`}</span>
              <span className={styles.bar}><span className={styles.barFill} style={{ width: `${Math.min(100, a.week ?? 0)}%`, display: 'block' }} /></span>
            </div>
          ))}
        </div>
      </Card>
      <Card title="Proxy logins in the app's pools">
        <div className={styles.list}>
          {d.accounts.filter((a) => a.kind === 'proxy').map((a) => (
            <div key={`${a.channel}-${a.account}`} className={styles.row}>
              <b className={styles.grow}>{a.account}</b>
              <span className={styles.pill}>{a.channel}</span>
              <span className={a.pools?.length ? styles.info : styles.pill}>{a.pools?.length ? `${a.pools.length} pools` : 'kept off the API lane'}</span>
              {a.failed ? <span className={styles.danger}>{a.failed} failed</span> : null}
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

const SEVERITY: Record<string, string> = { critical: styles.danger, warning: styles.warning, info: styles.pill };
const ACTION: Record<string, string> = { needs_you: styles.warning, done: styles.success, failed: styles.danger, shadow: styles.pill };

function AgentsTab({ apiBase }: { apiBase: string }) {
  const agents = useLoad(() => jp<Agents>(apiBase, 'agents'), apiBase);
  if (agents.error) return <Card title="Couldn't load"><p className={styles.muted}>{agents.error}</p></Card>;
  const d = agents.data;
  if (!d) return null;
  const open = d.agents.reduce((n, a) => n + a.open, 0);
  return (
    <>
      <div className={styles.metrics}>
        <div className={styles.metric}><b>{d.mode}</b><span>Brain mode (BRAIN_MODE)</span></div>
        <div className={styles.metric}><b>{open}</b><span>open incidents</span></div>
        <div className={styles.metric}><b>{d.waiting.length}</b><span>waiting for you</span></div>
        <div className={styles.metric}><b>{num(d.brain.tokensToday)}</b><span>Brain tokens today</span></div>
        <div className={styles.metric}><b>{d.fixes.filter((f) => !['kept', 'closed', 'rolled_back', 'stalled'].includes(f.state)).length}</b><span>fixes in flight</span></div>
      </div>
      <div className={styles.row}>
        <span className={styles.grow}>Approve, deny, switch agents live and read memory on the dashboard.</span>
        <a href={d.dashboard} target="_blank" rel="noreferrer"><Button size="sm">Open the Brain tab</Button></a>
      </div>
      <Card title="Agents">
        <div className={styles.list}>
          {d.agents.map((a) => (
            <div key={a.id} className={styles.row}>
              <b className={styles.grow}>{a.label}</b>
              {a.profile?.error ? <span className={styles.danger}>profile error</span> : <span className={a.mode === 'live' ? styles.success : styles.pill}>{a.mode}</span>}
              {a.open ? <span className={a.critical ? styles.danger : styles.warning}>{a.open} open</span> : <span className={styles.success}>ok</span>}
              <span className={styles.muted}>{num(a.tokensToday)} / {num(a.profile?.tokensDay ?? 0)} tokens · {a.investigationsToday}/{a.profile?.investigationsDay ?? 0} investigations</span>
            </div>
          ))}
        </div>
      </Card>
      {d.waiting.length ? (
        <Card title="Waiting for you (decide on the dashboard)">
          <div className={styles.list}>
            {d.waiting.map((w) => (
              <div key={w.id} className={styles.row}>
                <b className={styles.grow}>{w.actorLabel}: {w.kind.replace('_', ' ')} {w.target}</b>
                <span className={styles.muted}>{w.reason || w.result}</span>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
      <Card title="Open incidents">
        <div className={styles.list}>
          {d.incidents.length ? d.incidents.map((i) => (
            <div key={i.id} className={styles.row}>
              <span className={SEVERITY[i.severity] ?? styles.pill}>{i.severity}</span>
              <b className={styles.grow}>{i.title}</b>
              <span className={styles.muted}>{i.ownerLabel} · {i.rule.replace(/_/g, ' ')}{i.count > 1 ? ` · ${i.count}×` : ''}</span>
            </div>
          )) : <p className={styles.muted}>Nothing open.</p>}
        </div>
      </Card>
      <Section title="What agents did (or would do, in shadow) in the last 24 h">
        {d.recent.map((r) => (
          <div key={r.id} className={styles.row}>
            <span className={ACTION[r.status] ?? styles.pill}>{r.status.replace('_', ' ')}</span>
            <b className={styles.grow}>{r.actorLabel}: {r.kind.replace('_', ' ')} {r.target}</b>
            <span className={styles.muted}>{r.result}</span>
          </div>
        ))}
      </Section>
      {d.fixes.length ? (
        <Section title="Code fixes (GitHub issue → cloud session → PR → you merge → deploy → 1-hour watch)">
          {d.fixes.map((f) => (
            <div key={f.id} className={styles.row}>
              <span className={styles.info}>{f.state.replace('_', ' ')}</span>
              <b className={styles.grow}>{f.title}</b>
              {f.issue ? <span className={styles.muted}>issue #{f.issue}</span> : null}
              {f.pr ? <span className={styles.muted}>PR #{f.pr} · checks {f.checks || '—'}</span> : null}
              {f.risky ? <span className={styles.warning}>you deploy: {f.risky}</span> : null}
            </div>
          ))}
        </Section>
      ) : null}
    </>
  );
}
