/**
 * OpenCode Go quota body: one meter per window (5-hour, weekly, monthly).
 */

import { useTranslation } from 'react-i18next';
import type { OpenCodeQuotaState } from '@/types';
import { buildResetDisplay } from '@/utils/quota';
import { useNow } from '@/hooks/useNow';
import { QuotaMeter } from '../../components/QuotaMeter';
import { QuotaResetLabel } from '../../components/QuotaResetLabel';
import type { QuotaBodyProps } from '../../types';

export function OpenCodeQuotaBody({ quota, classes }: QuotaBodyProps<OpenCodeQuotaState>) {
  const { t, i18n } = useTranslation();
  const now = useNow();
  const rows = quota.rows ?? [];

  if (rows.length === 0) {
    return <div className={classes.quotaMessage}>{t('opencode_quota.empty_data')}</div>;
  }

  return (
    <>
      {rows.map((row, index) => {
        const remaining = Math.max(0, Math.min(100, Math.round(100 - row.used)));
        const resetDisplay = buildResetDisplay(null, row.resetAtMs, now, i18n.resolvedLanguage);
        return (
          <div key={row.id} className={classes.quotaRow}>
            <div className={classes.quotaRowHeader}>
              <span className={classes.quotaModel}>{row.labelKey ? t(row.labelKey) : row.id}</span>
              <div className={classes.quotaMeta}>
                <span className={classes.quotaPercent}>{remaining}%</span>
                {resetDisplay && <QuotaResetLabel display={resetDisplay} classes={classes} />}
              </div>
            </div>
            <QuotaMeter percent={remaining} classes={classes} index={index} />
          </div>
        );
      })}
    </>
  );
}
