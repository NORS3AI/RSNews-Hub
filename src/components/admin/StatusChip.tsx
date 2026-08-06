import { STATUS_LABEL, type LifeStatus } from '@/lib/contentStatus';

// The shared status pill. Draft = yellow, Scheduled = blue, Live = green,
// Ended = gray — distinct at a glance so a stray Draft jumps out of a list.
const CHIP: Record<LifeStatus, string> = {
  draft: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  live: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  ended: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
};

export const STATUS_DOT: Record<LifeStatus, string> = {
  draft: 'bg-yellow-400', scheduled: 'bg-blue-500', live: 'bg-green-500', ended: 'bg-slate-400',
};

export default function StatusChip({ status, className = '' }: { status: LifeStatus; className?: string }) {
  return <span className={`badge ${CHIP[status]} ${className}`}>{STATUS_LABEL[status]}</span>;
}
