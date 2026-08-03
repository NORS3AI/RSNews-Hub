'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Check } from './icons';

export default function SubscribeButton({
  categoryId = null, initialSubscribed, isAuthed, label = 'Subscribe', size = 'sm',
}: { categoryId?: string | null; initialSubscribed: boolean; isAuthed: boolean; label?: string; size?: 'sm' | 'md' }) {
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function toggle() {
    if (!isAuthed) { router.push('/login?next=' + encodeURIComponent(location.pathname)); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/subscriptions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ categoryId }),
      });
      const data = await res.json();
      if (res.ok) setSubscribed(data.subscribed);
    } finally { setLoading(false); }
  }

  return (
    <button onClick={toggle} disabled={loading}
      className={`${subscribed ? 'btn-outline' : 'btn-primary'} ${size === 'sm' ? 'btn-sm' : ''}`}>
      {subscribed ? <><Check width={15} height={15} /> Subscribed</> : <><Bell width={15} height={15} /> {label}</>}
    </button>
  );
}
