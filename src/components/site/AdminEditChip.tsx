import Link from 'next/link';
import { Edit } from '@/components/icons';

// Admin-only "edit in place" affordance shown in the corner of each homepage
// module. Custom (Studio) modules deep-link to their builder; catalog modules
// link to the homepage layout manager. Rendered only for staff, so it never
// reaches the public.
export default function AdminEditChip({ href, title }: { href: string; title: string }) {
  return (
    <Link
      href={href}
      title={title}
      className="absolute right-3 top-3 z-20 inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--card)] px-2.5 py-1 text-xs font-bold text-[var(--fg)] opacity-0 shadow-card transition hover:border-brand-400 hover:text-brand-600 focus:opacity-100 group-hover:opacity-100"
    >
      <Edit width={13} height={13} /> Edit
    </Link>
  );
}
