import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { IconLoader2 } from '@/components/ui/icons';
import { connectOpenCodeGo } from '../opencodeGo';
import { DialogTitle, type DialogHeading } from './OAuthFlowDialog';
import dialogStyles from './OAuthFlowDialog.module.scss';

export interface OpenCodeGoDialogProps {
  open: boolean;
  heading: DialogHeading;
  onAdded: () => void;
  onViewProviders: () => void;
  onClose: () => void;
}

export function OpenCodeGoDialog({
  open,
  heading,
  onAdded,
  onViewProviders,
  onClose,
}: OpenCodeGoDialogProps) {
  const { t } = useTranslation();
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [modelCount, setModelCount] = useState<number | null>(null);

  const close = () => {
    if (modelCount !== null) {
      setApiKey('');
      setModelCount(null);
    }
    setError('');
    onClose();
  };

  const connect = async () => {
    setLoading(true);
    setError('');
    try {
      const count = await connectOpenCodeGo(apiKey);
      if (count === 0) {
        setError(t('opencode_go.no_models'));
        return;
      }
      setModelCount(count);
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      width={500}
      className={dialogStyles.dialog}
      title={<DialogTitle {...heading} />}
    >
      <div className={dialogStyles.view} key={modelCount !== null ? 'result' : 'form'}>
        {modelCount !== null ? (
          <div className={dialogStyles.result} role="status">
            <svg className={dialogStyles.successMark} viewBox="0 0 52 52" aria-hidden="true">
              <circle className={dialogStyles.successRing} cx="26" cy="26" r="24" />
              <path className={dialogStyles.successCheck} d="M16 27l7 7 14-15" />
            </svg>
            <div className={dialogStyles.resultTitle}>
              {t('opencode_go.result_title', { count: modelCount })}
            </div>
            <div className={dialogStyles.resultActions}>
              <button type="button" className={dialogStyles.secondary} onClick={onViewProviders}>
                {t('opencode_go.view_providers')}
              </button>
              <button type="button" className={dialogStyles.primary} onClick={close}>
                {t('opencode_go.done')}
              </button>
            </div>
          </div>
        ) : (
          <form
            className={dialogStyles.stack}
            onSubmit={(event) => {
              event.preventDefault();
              void connect();
            }}
          >
            <Input
              label={t('opencode_go.key_label')}
              note={
                <>
                  {t('opencode_go.key_note')}{' '}
                  <a
                    className={dialogStyles.inlineLink}
                    href="https://opencode.ai/console"
                    target="_blank"
                    rel="noreferrer"
                  >
                    opencode.ai/console
                  </a>
                </>
              }
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="sk-..."
            />

            {error && (
              <div className={dialogStyles.alert} role="alert">
                {error}
              </div>
            )}

            <div>
              <button
                type="submit"
                className={dialogStyles.primary}
                disabled={!apiKey.trim() || loading}
              >
                {loading && (
                  <IconLoader2 size={14} className={dialogStyles.spinning} aria-hidden="true" />
                )}
                {t('opencode_go.connect_button')}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
