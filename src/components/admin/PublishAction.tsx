'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { getPublishChecklist, setArticleStatus } from '@/lib/actions';
import PublishChecklistModal, { type ChecklistData } from './PublishChecklistModal';

// The Articles list's quick "Publish" — routes through the SAME pre-publish
// checklist the composer shows. Clicking Publish loads the article's settings,
// opens the modal, and only flips it live on Confirm (never past a hard byline
// conflict, which also disables Confirm).
export default function PublishAction({ id }: { id: string }) {
  const router = useRouter();
  const [data, setData] = useState<ChecklistData | null>(null);
  const [loading, startLoad] = useTransition();
  const [publishing, startPublish] = useTransition();

  const open = () => startLoad(async () => {
    const d = await getPublishChecklist(id);
    if (d) setData(d);
  });
  const confirm = () => startPublish(async () => {
    try {
      await setArticleStatus(id, 'PUBLISHED');
      setData(null);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not publish.');
    }
  });

  return (
    <>
      <button type="button" disabled={loading} onClick={open} className="btn-sm btn-outline">
        {loading ? 'Checking…' : 'Publish'}
      </button>
      <PublishChecklistModal data={data} onCancel={() => setData(null)} onConfirm={confirm} cancelLabel="Cancel" busy={publishing} />
    </>
  );
}
