import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getNewsroomDoc, listMyFlaggedDrafts } from '@/lib/newsroomServer';
import { getHouseStyleRules } from '@/lib/houseStyleServer';
import DocEditor from '@/components/admin/newsroom/DocEditor';

export const dynamic = 'force-dynamic';

// Admin → Newsroom → one draft: the editor. Autosaves, shows who else is here,
// carries a notes thread (each note can be anchored to a highlighted passage), runs
// the RS Dictionary checker, and shows a quick-switcher of the staffer's flagged
// drafts so they can flip between in-progress stories. One button pushes to composer.
export default async function NewsroomDocPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const [user, doc, styleRules] = await Promise.all([getCurrentUser(), getNewsroomDoc(id), getHouseStyleRules()]);
  if (!doc) notFound();
  const me = user ? { id: user.id, name: user.name } : { id: '', name: 'You' };
  const flaggedDrafts = user ? await listMyFlaggedDrafts(user.id) : [];
  const flagged = flaggedDrafts.some((d) => d.id === id);
  return (
    <div className="mx-auto max-w-6xl">
      <DocEditor doc={doc} me={me} styleRules={styleRules} flagged={flagged} flaggedDrafts={flaggedDrafts} />
    </div>
  );
}
