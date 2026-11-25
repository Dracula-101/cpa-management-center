import { useCallback, useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { IconSettings, IconTrash2 } from '@/components/ui/icons';
import { providersApi } from '@/services/api/providers';
import { useNotificationStore } from '@/stores';
import type { OpenAIProviderConfig } from '@/types';
import { OPENCODE_GO_NAME } from '@/features/oauth/opencodeGo';
import iconOpenCodeLight from '@/assets/icons/opencode.svg';
import iconOpenCodeDark from '@/assets/icons/opencode-dark.svg';
import cardStyles from './AuthFileCard.module.scss';
import sectionStyles from './ModelRulesEntry.module.scss';
import pageStyles from '../AuthFilesPage.module.scss';

const hostOf = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

/**
 * API-key (OpenAI-compatible) providers next to the credential files. The backend lists only
 * file-backed credentials, so these come from the config and edit the same config entries.
 */
export function ApiKeyProvidersSection({
  disableControls,
  resolvedTheme,
}: {
  disableControls: boolean;
  resolvedTheme: 'light' | 'dark';
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const labelId = useId();
  const { showNotification, showConfirmation } = useNotificationStore();
  const [providers, setProviders] = useState<OpenAIProviderConfig[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setProviders(await providersApi.getOpenAIProviders());
    } catch (err) {
      showNotification(err instanceof Error ? err.message : String(err), 'error');
    }
  }, [showNotification]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (name: string, action: () => Promise<void>, success: string) => {
    setBusy(name);
    try {
      await action();
      showNotification(success, 'success');
    } catch (err) {
      showNotification(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setBusy(null);
      await load();
    }
  };

  const toggle = (provider: OpenAIProviderConfig, enabled: boolean) =>
    void run(
      provider.name,
      () =>
        providersApi.updateOpenAIProviderDisabled(
          provider.sourceIndex ?? 0,
          !enabled,
          provider.source
        ),
      t(enabled ? 'api_key_providers.enabled' : 'api_key_providers.disabled', {
        name: provider.name,
      })
    );

  const remove = (provider: OpenAIProviderConfig) =>
    showConfirmation({
      title: t('api_key_providers.delete_title'),
      message: t('api_key_providers.delete_confirm', { name: provider.name }),
      variant: 'danger',
      confirmText: t('common.confirm'),
      onConfirm: () =>
        run(
          provider.name,
          () => providersApi.deleteOpenAIProvider(provider.sourceIndex ?? 0, provider.source),
          t('api_key_providers.deleted', { name: provider.name })
        ),
    });

  if (providers.length === 0) return null;

  return (
    <section className={sectionStyles.entry} aria-labelledby={labelId}>
      <h2 className={sectionStyles.label} id={labelId}>
        {t('api_key_providers.title')}
      </h2>
      <div className={pageStyles.grid}>
        {providers.map((provider) => {
          const isOpenCode = provider.name === OPENCODE_GO_NAME;
          const working = busy === provider.name;
          return (
            <article
              key={provider.name}
              className={`${cardStyles.card} ${provider.disabled ? cardStyles.cardDisabled : ''}`}
            >
              <header className={cardStyles.head}>
                <h3 className={cardStyles.identity}>
                  {isOpenCode && (
                    <img
                      src={resolvedTheme === 'dark' ? iconOpenCodeDark : iconOpenCodeLight}
                      alt=""
                      width={18}
                      height={18}
                    />
                  )}
                  <span className={cardStyles.account} title={provider.name}>
                    {isOpenCode ? 'OpenCode Go' : provider.name}
                  </span>
                </h3>
                <span className={cardStyles.runtimeLabel}>{t('api_key_providers.badge')}</span>
              </header>

              <p className={cardStyles.fileName} title={provider.baseUrl}>
                {hostOf(provider.baseUrl)}
              </p>

              <div className={cardStyles.metaRow}>
                <span>
                  {t('api_key_providers.models', { count: provider.models?.length ?? 0 })}
                </span>
                <span className={cardStyles.metaDivider} aria-hidden="true">
                  ·
                </span>
                <span>{t('api_key_providers.keys', { count: provider.apiKeyEntries.length })}</span>
                {provider.prefix && (
                  <>
                    <span className={cardStyles.metaDivider} aria-hidden="true">
                      ·
                    </span>
                    <span title={t('api_key_providers.prefix_hint')}>{provider.prefix}/</span>
                  </>
                )}
              </div>

              <footer className={cardStyles.actions}>
                <div className={cardStyles.actionsMain}>
                  <div className={cardStyles.utilityActions}>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => navigate('/ai-providers')}
                      className={cardStyles.iconButton}
                      title={t('api_key_providers.edit')}
                      aria-label={t('api_key_providers.edit')}
                    >
                      <IconSettings size={15} />
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => remove(provider)}
                      className={cardStyles.iconButton}
                      title={t('api_key_providers.delete')}
                      aria-label={t('api_key_providers.delete')}
                      disabled={disableControls || working}
                    >
                      {working ? <LoadingSpinner size={14} /> : <IconTrash2 size={15} />}
                    </Button>
                  </div>
                </div>
                <div className={cardStyles.toggleWrap}>
                  <span className={cardStyles.toggleLabel}>
                    {t('auth_files.status_toggle_label')}
                  </span>
                  <ToggleSwitch
                    ariaLabel={t('api_key_providers.toggle', { name: provider.name })}
                    checked={!provider.disabled}
                    disabled={disableControls || working}
                    onChange={(value) => toggle(provider, value)}
                  />
                </div>
              </footer>
            </article>
          );
        })}
      </div>
    </section>
  );
}
