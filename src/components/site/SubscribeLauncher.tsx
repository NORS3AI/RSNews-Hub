'use client';
import { Bell } from '@/components/icons';
import { SUBSCRIBE_EVENT } from './SubscribePopup';

/** Opens the shared Subscribe popup. Drop it anywhere a "Subscribe" button
 *  belongs — footer, Notifications page, an Industry News header. `preselect`
 *  pre-checks a topic (e.g. the category being viewed). */
export default function SubscribeLauncher({
  label = 'Subscribe', preselect, className, icon = true,
}: { label?: string; preselect?: string; className?: string; icon?: boolean }) {
  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent(SUBSCRIBE_EVENT, { detail: preselect ? { preselect } : {} }))}
      className={className || 'btn bg-white text-brand-700 hover:bg-white/90'}>
      {icon && <Bell width={16} height={16} />} {label}
    </button>
  );
}
