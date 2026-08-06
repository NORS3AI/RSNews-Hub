'use client';
import { Bell } from './icons';
import { SUBSCRIBE_EVENT } from './site/SubscribePopup';

// Thin launcher for the shared Subscribe popup. Kept for the category/article
// pages; `topicSlug` pre-checks that topic when the popup opens. (The older
// per-category toggle props are accepted but ignored so call sites don't break.)
export default function SubscribeButton({
  topicSlug, label = 'Subscribe', size = 'sm',
}: {
  topicSlug?: string; label?: string; size?: 'sm' | 'md';
  categoryId?: string | null; initialSubscribed?: boolean; isAuthed?: boolean;
}) {
  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent(SUBSCRIBE_EVENT, { detail: topicSlug ? { preselect: topicSlug } : {} }))}
      className={`btn-primary ${size === 'sm' ? 'btn-sm' : ''}`}>
      <Bell width={15} height={15} /> {label}
    </button>
  );
}
