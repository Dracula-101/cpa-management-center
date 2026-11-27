import { afterEach, describe, expect, test } from 'bun:test';
import { jp, type Agents } from '../src/features/jobPortal/api';
const realFetch = globalThis.fetch;

describe('job portal console client', () => {
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  test('sends the panel token to /jp/api on the same host and posts JSON', async () => {
    const seen: { url: string; init: RequestInit }[] = [];
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      seen.push({ url, init });
      return new Response('{"saved": true}', { status: 200 });
    }) as unknown as typeof fetch;
    expect(await jp<{ saved: boolean }>('https://ai.echo-app.net/', 'profiles', { lanes: { 'jobs.review': 'api' } }, 'secret')).toEqual({ saved: true });
    expect(seen[0].url).toBe('https://ai.echo-app.net/jp/api/profiles');
    expect((seen[0].init.headers as Record<string, string>)['X-JP-Panel-Token']).toBe('secret');
    expect(seen[0].init.method).toBe('POST');
  });

  test('a refused token says where to find the right one', async () => {
    globalThis.fetch = (async () => new Response('', { status: 403 })) as unknown as typeof fetch;
    await expect(jp('https://ai.echo-app.net', 'overview', undefined, 'wrong')).rejects.toThrow('JP_PANEL_TOKEN');
  });

  test('the Agents tab reads /jp/api/agents with a GET', async () => {
    const seen: { url: string; init: RequestInit }[] = [];
    const body = { mode: 'shadow', dashboard: 'https://dash/system?tab=brain', agents: [], brain: { tokensToday: 0, lastReview: null }, incidents: [], waiting: [], recent: [], fixes: [] };
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      seen.push({ url, init });
      return new Response(JSON.stringify(body), { status: 200 });
    }) as unknown as typeof fetch;
    const got = await jp<Agents>('https://ai.echo-app.net', 'agents', undefined, 'secret');
    expect(got.mode).toBe('shadow');
    expect(seen[0].url).toBe('https://ai.echo-app.net/jp/api/agents');
    expect(seen[0].init.method).toBe('GET');
  });
});
