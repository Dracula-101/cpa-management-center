import type { AuthFileItem, OpenAIProviderConfig } from '@/types';
import { authFilesApi } from '@/services/api/authFiles';
import { providersApi } from '@/services/api/providers';
import { apiKeyUsageApi } from '@/services/api/apiKeyUsage';
import {
  normalizeRecentRequestBuckets,
  normalizeUsageTotal,
  type ApiKeyUsageResponse,
} from '@/utils/recentRequests';
import { OPENCODE_GO_NAME } from '@/features/oauth/opencodeGo';
import { normalizeAuthIndex } from '@/utils/authIndex';
import { isRecord } from '@/utils/helpers';

export const OPENCODE_AUTH_TYPE = 'opencode';

/**
 * An OpenAI-compatible config provider shown as a credential. The backend lists only file-backed
 * credentials, so these are built from the config; actions go to the config, not /credentials.
 */
export interface ApiKeyProviderItem extends AuthFileItem {
  apiKeyProvider: OpenAIProviderConfig;
}

export const isApiKeyProviderItem = (file: AuthFileItem): file is ApiKeyProviderItem =>
  typeof file.apiKeyProvider === 'object' && file.apiKeyProvider !== null;

// v8 /config spells it auth_index; the shared parser only reads auth-index.
const firstKeyAuthIndex = (provider: OpenAIProviderConfig): string | null => {
  const keys = provider.source?.group?.keys;
  const first = Array.isArray(keys) && isRecord(keys[0]) ? keys[0] : null;
  return (
    provider.apiKeyEntries[0]?.authIndex ??
    normalizeAuthIndex(first?.['auth_index'] ?? first?.['auth-index']) ??
    provider.authIndex ??
    null
  );
};

export const toApiKeyProviderItems = (
  providers: OpenAIProviderConfig[],
  usage: ApiKeyUsageResponse
): ApiKeyProviderItem[] =>
  providers.map((provider) => {
    const byKey = usage[provider.name] ?? {};
    const stats = byKey[provider.baseUrl] ?? Object.values(byKey)[0] ?? {};
    const type = provider.name === OPENCODE_GO_NAME ? OPENCODE_AUTH_TYPE : 'openai-compatibility';
    return {
      name: provider.name,
      type,
      provider: type,
      authIndex: firstKeyAuthIndex(provider),
      disabled: provider.disabled === true,
      status: provider.disabled ? 'disabled' : 'active',
      successCount: normalizeUsageTotal(stats.success),
      failureCount: normalizeUsageTotal(stats.failed),
      recentRequests: normalizeRecentRequestBuckets(stats.recent_requests ?? stats.recentRequests),
      apiKeyProvider: provider,
    };
  });

/** Credential files plus API-key providers; a failure on the extras never hides the files. */
export async function listCredentialsWithApiKeyProviders() {
  const [data, providers, usage] = await Promise.all([
    authFilesApi.list(),
    providersApi.getOpenAIProviders().catch(() => [] as OpenAIProviderConfig[]),
    apiKeyUsageApi.getUsage().catch(() => ({}) as ApiKeyUsageResponse),
  ]);
  return {
    ...data,
    files: [...(data?.files ?? []), ...toApiKeyProviderItems(providers, usage ?? {})],
  };
}

export const setApiKeyProviderEnabled = (item: ApiKeyProviderItem, enabled: boolean) =>
  providersApi.updateOpenAIProviderDisabled(
    item.apiKeyProvider.sourceIndex ?? 0,
    !enabled,
    item.apiKeyProvider.source
  );

export const deleteApiKeyProvider = (item: ApiKeyProviderItem) =>
  providersApi.deleteOpenAIProvider(
    item.apiKeyProvider.sourceIndex ?? 0,
    item.apiKeyProvider.source
  );
