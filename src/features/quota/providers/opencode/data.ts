/**
 * OpenCode Go quota data layer. React-free / SCSS-free.
 */

import type { TFunction } from 'i18next';
import type { AuthFileItem, KimiQuotaRow, OpenCodeQuotaState } from '@/types';
import { apiCallApi, getApiCallErrorMessage } from '@/services/api';
import { createStatusError, isDisabledAuthFile } from '@/utils/quota';
import { normalizeAuthIndex } from '@/utils/authIndex';
import { isRecord } from '@/utils/helpers';
import type { QuotaProviderData } from '../types';

export const OPENCODE_USAGE_URL = 'https://opencode.ai/inference/go/v1/usage';

const WINDOWS = [
  { id: 'rolling', labelKey: 'opencode_quota.rolling', periodHours: 5 },
  { id: 'weekly', labelKey: 'opencode_quota.weekly', periodHours: 24 * 7 },
  { id: 'monthly', labelKey: 'opencode_quota.monthly', periodHours: null },
] as const;

type OpenCodeQuotaData = Pick<OpenCodeQuotaState, 'rows'>;

/** `{ usage: { rolling|weekly|monthly: { percent, resetsAt } } }` → used/100 rows. */
export function parseOpenCodeUsage(payload: unknown): KimiQuotaRow[] {
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch {
      return [];
    }
  }
  const usage = isRecord(payload) && isRecord(payload.usage) ? payload.usage : null;
  if (!usage) return [];
  return WINDOWS.flatMap(({ id, labelKey, periodHours }) => {
    const window = usage[id];
    if (!isRecord(window)) return [];
    const percent = Number(window.percent);
    const resetAtMs =
      typeof window.resetsAt === 'string' ? Date.parse(window.resetsAt) || null : null;
    return [
      {
        id,
        labelKey,
        used: Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0,
        limit: 100,
        resetAtMs,
        periodHours,
      },
    ];
  });
}

const fetchOpenCodeQuota = async (file: AuthFileItem, t: TFunction): Promise<OpenCodeQuotaData> => {
  const authIndex = normalizeAuthIndex(file['auth_index'] ?? file.authIndex);
  if (!authIndex) throw new Error(t('opencode_quota.missing_auth_index'));

  const result = await apiCallApi.request({
    authIndex,
    method: 'GET',
    url: OPENCODE_USAGE_URL,
    header: {
      Authorization: 'Bearer $TOKEN$',
      Accept: 'application/json',
      'User-Agent': 'cpa-management-center/1.0',
    },
  });
  if (result.statusCode < 200 || result.statusCode >= 300) {
    throw createStatusError(getApiCallErrorMessage(result), result.statusCode);
  }
  const rows = parseOpenCodeUsage(result.body ?? result.bodyText);
  if (rows.length === 0) throw new Error(t('opencode_quota.empty_data'));
  return { rows };
};

export const OPENCODE_CONFIG: QuotaProviderData<OpenCodeQuotaState, OpenCodeQuotaData> = {
  type: 'opencode',
  i18nPrefix: 'opencode_quota',
  filterFn: (file) => file.type === 'opencode' && !isDisabledAuthFile(file),
  fetchQuota: fetchOpenCodeQuota,
  storeSelector: (state) => state.opencodeQuota,
  storeSetter: 'setOpenCodeQuota',
  buildLoadingState: () => ({ status: 'loading', rows: [] }),
  buildSuccessState: (data) => ({ status: 'success', ...data }),
  buildErrorState: (message, status) => ({
    status: 'error',
    rows: [],
    error: message,
    errorStatus: status,
  }),
};
