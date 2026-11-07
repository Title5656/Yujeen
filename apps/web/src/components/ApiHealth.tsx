import { useEffect, useState } from 'react';
import { fetchHealth } from '../lib/api.js';

export function ApiHealth() {
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void fetchHealth(controller.signal).then(
      () => {
        if (!controller.signal.aborted) setState('ok');
      },
      () => {
        if (!controller.signal.aborted) setState('error');
      },
    );
    return () => controller.abort();
  }, [attempt]);

  return (
    <div className={`health health--${state}`}>
      <span aria-hidden="true" className="health-dot" />
      <span role={state === 'error' ? 'alert' : 'status'}>
        {state === 'loading'
          ? 'กำลังตรวจสอบ API…'
          : state === 'ok'
            ? 'API พร้อมใช้งาน'
            : 'ยังเชื่อมต่อ API ไม่ได้'}
      </span>
      {state === 'error' && (
        <button
          className="retry"
          onClick={() => {
            setState('loading');
            setAttempt((value) => value + 1);
          }}
        >
          ลองใหม่
        </button>
      )}
    </div>
  );
}
