'use client';
import { ThumbsUp } from '@/components/icons';
import { useRecommend } from './RecommendProvider';

// The top-of-article recommend count (meta row, next to views). Reads the shared
// RecommendProvider state so it updates the instant the reader hits Recommend at
// the end of the piece. Hidden until at least one recommend exists.
export default function RecommendCount() {
  const { count } = useRecommend();
  if (count <= 0) return null;
  return (
    <span className="flex items-center gap-1 text-brand-600"><ThumbsUp width={14} height={14} />{count} recommend</span>
  );
}
