'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addSavedSupplier, removeSavedSupplier } from '@/lib/actions';
import { Star, StarFilled } from '@/components/icons';

// Add/remove a supplier from the reader's phone book. `signedIn={false}` sends
// the visitor to sign in first (the server action would reject anyway).
export default function SupplierSaveButton({ vendorId, saved, signedIn }: { vendorId: string; saved: boolean; signedIn: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(saved);
  const [pending, start] = useTransition();

  function toggle() {
    if (!signedIn) { router.push('/login'); return; }
    const next = !on;
    setOn(next); // optimistic
    start(async () => {
      try {
        await (next ? addSavedSupplier(vendorId) : removeSavedSupplier(vendorId));
        router.refresh();
      } catch {
        setOn(!next); // revert on failure
      }
    });
  }

  return (
    <button onClick={toggle} disabled={pending} aria-pressed={on}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${on ? 'border-brand-500 bg-brand-500 text-white' : 'border-[var(--border)] text-[var(--fg)] hover:border-brand-500 hover:text-brand-600'}`}>
      {on ? <StarFilled width={16} height={16} /> : <Star width={16} height={16} />}
      {on ? 'In your phone book' : 'Save to phone book'}
    </button>
  );
}
