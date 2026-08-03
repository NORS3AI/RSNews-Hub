'use client';
import { useTransition } from 'react';

type Action = { label: string; run: () => Promise<any>; danger?: boolean; confirm?: string };

export function ActionButtons({ actions }: { actions: Action[] }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {actions.map((a, i) => (
        <button
          key={i}
          disabled={pending}
          onClick={() => {
            if (a.confirm && !window.confirm(a.confirm)) return;
            start(() => { a.run(); });
          }}
          className={`btn-sm ${a.danger ? 'btn-danger' : 'btn-outline'}`}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}
