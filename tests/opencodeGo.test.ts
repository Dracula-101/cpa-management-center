import { describe, expect, test } from 'bun:test';
import { buildOpenCodeGoGroup, OPENCODE_GO_BASE_URL } from '../src/features/oauth/opencodeGo';

describe('buildOpenCodeGoGroup', () => {
  test('saves a prefixed provider that forwards session headers and keeps only chat models', () => {
    const group = buildOpenCodeGoGroup(' sk-test ', [
      'kimi-k3',
      'kimi-k3',
      'text-embedding-3-small',
      'gpt-6-luna-decision',
      ' glm-5.3 ',
    ]);
    expect(group.name).toBe('opencode-go');
    expect(group.prefix).toBe('opencode-go');
    expect(group['base-url']).toBe(OPENCODE_GO_BASE_URL);
    expect(group.keys).toEqual([{ 'api-key': 'sk-test' }]);
    expect(group.headers['x-opencode-session']).toBe('$x-opencode-session');
    expect(group.models).toEqual([
      { name: 'kimi-k3', alias: 'kimi-k3' },
      { name: 'glm-5.3', alias: 'glm-5.3' },
    ]);
  });
});
