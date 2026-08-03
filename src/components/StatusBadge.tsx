const STYLES: Record<string, string> = {
  published: 'bg-green-100 text-green-800',
  draft: 'bg-amber-100 text-amber-800',
  archived: 'bg-slate-200 text-slate-700',
  trashed: 'bg-red-100 text-red-700',
  active: 'bg-green-100 text-green-800',
  suspended: 'bg-amber-100 text-amber-800',
  banned: 'bg-red-100 text-red-700',
  admin: 'bg-brand-100 text-brand-800',
  editor: 'bg-purple-100 text-purple-800',
  user: 'bg-slate-100 text-slate-700',
};

export default function StatusBadge({ value }: { value: string }) {
  return <span className={`badge ${STYLES[value] || 'bg-slate-100 text-slate-700'}`}>{value}</span>;
}
