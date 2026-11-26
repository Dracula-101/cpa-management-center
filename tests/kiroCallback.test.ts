import { describe, expect, test } from 'bun:test';
import { resolveCallbackUrl } from '../src/features/oauth/callbackUrl';

describe('Kiro callback', () => {
  const pasted =
    'http://localhost:3128/oauth/callback?login_option=google&code=abc-123&state=kiro-0123';

  test('sends the whole pasted address as the code so the plugin keeps login_option', () => {
    const url = new URL(resolveCallbackUrl('kiro', `  ${pasted} `)!);
    expect(url.searchParams.get('state')).toBe('kiro-0123');
    expect(url.searchParams.get('code')).toBe(pasted);
  });

  test('passes portal errors through and rejects input without a state', () => {
    const url = new URL(
      resolveCallbackUrl(
        'kiro',
        'http://localhost:3128/oauth/callback?error=access_denied&state=kiro-0123'
      )!
    );
    expect(url.searchParams.get('error')).toBe('access_denied');
    expect(url.searchParams.get('code')).toBeNull();
    expect(resolveCallbackUrl('kiro', 'abc-123')).toBeNull();
    expect(resolveCallbackUrl('kiro', 'http://localhost:3128/oauth/callback?code=x')).toBeNull();
  });
});

describe('Kiro plugin tiles', () => {
  test('know their flow: browser sign-in takes a callback, Builder ID is device code', async () => {
    const { buildPluginOAuthProviderCards, supportsManualCallback } =
      await import('../src/features/oauth/providers');
    const cards = buildPluginOAuthProviderCards(
      [
        {
          id: 'kiro',
          supportsOAuth: true,
          effectiveEnabled: true,
          oauthProviders: ['kiro', 'kiro-builder-id'],
        } as never,
      ],
      ''
    );
    expect(cards.map((card) => [card.id, card.flow, supportsManualCallback(card)])).toEqual([
      ['kiro', 'browser', true],
      ['kiro-builder-id', 'device', false],
    ]);
  });
});

describe('Quota tabs', () => {
  test('plugin quota credentials get a tab named after their provider', async () => {
    const { buildTabIds, buildTabCounts, filterEntriesByTab } =
      await import('../src/features/quota/logic');
    const entries = [
      { file: { name: 'kiro-a.json', type: 'kiro', provider: 'kiro' }, type: 'plugin' as const },
      { file: { name: 'codex.json', type: 'codex' }, type: 'codex' as const },
    ] as never[];
    const ids = buildTabIds(entries);
    expect(ids).toContain('kiro');
    expect(ids).not.toContain('plugin');
    expect(buildTabCounts(entries).kiro).toBe(1);
    expect(filterEntriesByTab(entries, 'kiro')).toHaveLength(1);
    expect(buildTabIds([])).toContain('plugin');
  });
});
