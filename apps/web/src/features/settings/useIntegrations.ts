import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { IntegrationsSchema } from '@portfolio/contracts';
import type { Integrations } from '@portfolio/contracts';
import { api, message } from './api.js';

export function useIntegrations() {
  const [state, setState] = useState<Integrations | null>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void api('integrations', 'GET', undefined, controller.signal)
      .then((result) => {
        setState(result === null ? null : IntegrationsSchema.parse(result));
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setError(message(error));
      });
    return () => controller.abort();
  }, []);

  async function update(action: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try {
      setState(IntegrationsSchema.parse(await action()));
    } catch (error) {
      setError(message(error));
      // Reconcile after a failed or concurrent test (the previous candidate proof can be revoked).
      try {
        const latest = await api('integrations');
        setState(latest === null ? null : IntegrationsSchema.parse(latest));
      } catch {
        /* The error above remains visible. */
      }
    } finally {
      setBusy(false);
    }
  }

  function change(path: string, method: string, body: unknown) {
    return update(() => api('integrations/' + path, method, body));
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    form.reset();
    void update(async () => {
      const { candidate } = IntegrationsSchema.parse(
        await api('integrations/candidate', 'PUT', {
          provider: 'alpaca',
          keyId: fields.get('keyId'),
          secret: fields.get('secret'),
        }),
      );
      if (!candidate) throw new Error('บันทึกคีย์ไม่สำเร็จ กรุณาลองใหม่');
      return api('integrations/test', 'POST', { version: candidate.version });
    });
  }

  return { state, error, busy, change, save };
}
