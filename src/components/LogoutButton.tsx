'use client';
import { useRouter } from 'next/navigation';
import { Logout } from './icons';

export default function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/docs');
    router.refresh();
  }
  return <button onClick={logout} className="btn-outline btn-sm"><Logout width={15} height={15} /> Sign out</button>;
}
