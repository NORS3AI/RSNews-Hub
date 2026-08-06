import { redirect } from 'next/navigation';

// Subscriptions folded into the account-wide Notifications inbox.
export default function SubscriptionsRedirect() {
  redirect('/docs/notifications');
}
