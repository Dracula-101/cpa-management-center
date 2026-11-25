import { describe, expect, test } from 'bun:test';
import { parseOpenCodeUsage } from '../src/features/quota/providers/opencode/data';
import {
  isApiKeyProviderItem,
  toApiKeyProviderItems,
} from '../src/features/authFiles/apiKeyProviders';
import type { OpenAIProviderConfig } from '../src/types';

describe('parseOpenCodeUsage', () => {
  test('turns the three Go windows into used/100 rows with reset instants', () => {
    const rows = parseOpenCodeUsage(
      JSON.stringify({
        usage: {
          rolling: { status: 'ok', percent: 12.5, resetsAt: '2026-11-25T15:13:48.000Z' },
          weekly: { status: 'ok', percent: 140, resetsAt: '2026-11-30T00:00:00.000Z' },
          monthly: { status: 'ok', percent: 'x' },
        },
      })
    );
    expect(rows.map((row) => [row.id, row.used, row.limit])).toEqual([
      ['rolling', 12.5, 100],
      ['weekly', 100, 100],
      ['monthly', 0, 100],
    ]);
    expect(rows[0].resetAtMs).toBe(Date.parse('2026-11-25T15:13:48.000Z'));
    expect(rows[2].resetAtMs).toBeNull();
  });

  test('returns no rows for an unexpected payload', () => {
    expect(parseOpenCodeUsage({ error: 'nope' })).toEqual([]);
    expect(parseOpenCodeUsage('not json')).toEqual([]);
  });
});

describe('toApiKeyProviderItems', () => {
  const provider: OpenAIProviderConfig = {
    name: 'opencode-go',
    prefix: 'opencode-go',
    baseUrl: 'https://opencode.ai/inference/go/openai/v1',
    apiKeyEntries: [{ apiKey: 'sk-test', authIndex: 'abc123' }],
    models: [{ name: 'kimi-k3', alias: 'kimi-k3' }],
  };

  test('builds an opencode credential with the key auth index and request stats', () => {
    const [item] = toApiKeyProviderItems([provider], {
      'opencode-go': {
        'https://opencode.ai/inference/go/openai/v1': {
          success: 3,
          failed: 1,
          recent_requests: [{ time: '18:40-18:50', success: 3, failed: 1 }],
        },
      },
    });
    expect(item.type).toBe('opencode');
    expect(item.authIndex).toBe('abc123');
    expect(item.successCount).toBe(3);
    expect(item.failureCount).toBe(1);
    expect(item.recentRequests?.length).toBe(1);
    expect(isApiKeyProviderItem(item)).toBe(true);
    expect(JSON.stringify({ ...item, apiKeyProvider: undefined })).not.toContain('sk-test');
  });

  test('reads the v8 auth_index spelling from the raw config entry', () => {
    const [item] = toApiKeyProviderItems(
      [
        {
          ...provider,
          apiKeyEntries: [{ apiKey: 'sk-test' }],
          source: {
            groupIndex: 0,
            group: { keys: [{ 'api-key': 'sk-test', auth_index: 'v8idx' }] },
          },
        },
      ],
      {}
    );
    expect(item.authIndex).toBe('v8idx');
  });

  test('other OpenAI-compatible providers get the generic type and a disabled flag', () => {
    const [item] = toApiKeyProviderItems([{ ...provider, name: 'other', disabled: true }], {});
    expect(item.type).toBe('openai-compatibility');
    expect(item.disabled).toBe(true);
    expect(item.successCount).toBe(0);
  });
});

describe('OpenCodeQuotaBody', () => {
  test('shows remaining percent per window with its label', async () => {
    const { createElement } = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { OpenCodeQuotaBody } =
      await import('../src/features/quota/providers/opencode/OpenCodeQuotaBody');
    const { QUOTA_CLASS_KEYS, bindQuotaClasses } = await import('../src/features/quota/types');
    await import('../src/i18n');
    const classes = bindQuotaClasses(
      Object.fromEntries(QUOTA_CLASS_KEYS.map((key) => [key, key])),
      'test'
    );
    const rows = parseOpenCodeUsage({
      usage: { rolling: { percent: 25 }, weekly: { percent: 60 }, monthly: { percent: 0 } },
    });
    const html = renderToStaticMarkup(
      createElement(OpenCodeQuotaBody, { quota: { status: 'success', rows }, classes })
    );
    expect(html).toContain('5-hour limit');
    expect(html).toContain('75%');
    expect(html).toContain('40%');
    expect(html).toContain('100%');
  });
});
