'use client';
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import AutoPlugDialog from './AutoPlugDialog';

type CreateResult = { ok: boolean; id?: string; name?: string; error?: string };

// Wraps a poll/quiz "create" form: on a successful save it clears the form and
// opens the auto-plug dialog for the new item. The form fields + submit button
// are passed as children (rendered by the server page), so this stays generic.
export default function AutoPlugForm({ kind, action, className, children }: {
  kind: 'poll' | 'quiz';
  action: (fd: FormData) => Promise<CreateResult>;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [plug, setPlug] = useState<{ id: string; name: string } | null>(null);

  return (
    <>
      <form
        ref={formRef}
        className={className}
        onSubmit={(e) => {
          e.preventDefault();
          if (pending) return; // guard against a double-submit creating duplicates
          const fd = new FormData(e.currentTarget);
          setError(null);
          start(async () => {
            const res = await action(fd);
            if (res.ok && res.id) {
              formRef.current?.reset();
              setPlug({ id: res.id, name: res.name ?? '' });
              router.refresh();
            } else {
              setError(res.error ?? 'Something went wrong.');
            }
          });
        }}
      >
        {children}
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      </form>
      {plug && <AutoPlugDialog kind={kind} id={plug.id} name={plug.name} onClose={() => setPlug(null)} />}
    </>
  );
}
