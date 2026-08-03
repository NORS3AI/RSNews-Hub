'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function SubscribeButton({
  articleId,
  initialSubscribed,
  isLoggedIn,
}: {
  articleId: number;
  initialSubscribed: boolean;
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    if (!isLoggedIn) {
      router.push('/login');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/subscriptions', {
        method: subscribed ? 'DELETE' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ articleId }),
      });
      if (res.ok) setSubscribed(!subscribed);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      className={subscribed ? 'btn-secondary' : 'btn-primary'}
    >
      {subscribed ? '✓ Subscribed' : '＋ Subscribe'}
    </button>
  );
}
