import { modelsApi } from '@/services/api/models';
import { providersApi } from '@/services/api/providers';

export const OPENCODE_GO_NAME = 'opencode-go';
export const OPENCODE_GO_BASE_URL = 'https://opencode.ai/inference/go/openai/v1';

// Go rejects requests without a per-conversation session id, so forward the one the client sends.
export const OPENCODE_GO_HEADERS: Record<string, string> = {
  'x-opencode-session': '$x-opencode-session',
  'X-Claude-Code-Session-Id': '$X-Claude-Code-Session-Id',
  session_id: '$session_id',
};

const isChatModel = (id: string) => !/embedding|decision/i.test(id);

export const buildOpenCodeGoGroup = (apiKey: string, modelIds: string[]) => ({
  name: OPENCODE_GO_NAME,
  prefix: OPENCODE_GO_NAME,
  'base-url': OPENCODE_GO_BASE_URL,
  headers: OPENCODE_GO_HEADERS,
  keys: [{ 'api-key': apiKey.trim() }],
  models: [...new Set(modelIds.map((id) => id.trim()).filter((id) => id && isChatModel(id)))].map(
    (id) => ({ name: id, alias: id })
  ),
});

/** Checks the key against OpenCode Go (through the backend) and saves it; returns the model count. */
export async function connectOpenCodeGo(apiKey: string): Promise<number> {
  const models = await modelsApi.fetchModelsViaApiCall(OPENCODE_GO_BASE_URL, apiKey.trim());
  const group = buildOpenCodeGoGroup(
    apiKey,
    models.map((model) => model.name)
  );
  if (group.models.length === 0) return 0;
  await providersApi.upsertOpenAIGroup(group);
  return group.models.length;
}
