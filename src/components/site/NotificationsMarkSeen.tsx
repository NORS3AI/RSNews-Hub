'use client';
import { useEffect } from 'react';
import { NOTIF_CHANGED } from './SubscribePopup';

/** Marks the account's notifications as seen when the inbox opens, then clears
 *  the sidebar dot. The unread chips already rendered this visit stay put. */
export default function NotificationsMarkSeen() {
  useEffect(() => {
    fetch('/api/notifications', { method: 'POST' })
      .then(() => window.dispatchEvent(new Event(NOTIF_CHANGED)))
      .catch(() => {});
  }, []);
  return null;
}
