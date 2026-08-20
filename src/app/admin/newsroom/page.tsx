import { getCurrentUser } from '@/lib/auth';
import { listNewsroomDocs } from '@/lib/newsroomServer';
import { getHouseStyleRules } from '@/lib/houseStyleServer';
import Newsroom from '@/components/admin/newsroom/Newsroom';

export const dynamic = 'force-dynamic';

// Admin → Newsroom: a shared, OneNote-style drafts space. Any staffer (ADMIN or
// EDITOR) can open, read, and edit any draft; each is a tab. Bodies autosave;
// there's a comments thread that auto-tags whoever wrote each note; a house-style
// checker flags off-house spellings + missing Oxford commas; and one button pushes
// a finished draft into the real article composer (removing it from here).
export default async function NewsroomPage() {
  const [user, docs, styleRules] = await Promise.all([getCurrentUser(), listNewsroomDocs(), getHouseStyleRules()]);
  const me = user ? { id: user.id, name: user.name } : { id: '', name: 'You' };
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Newsroom</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          A shared scratchpad for drafting stories together. Everything autosaves, everyone with admin can see and edit, and one button hands a finished draft to the article editor. Draft the words here — you&apos;ll add formatting, images, and blocks after you push.
        </p>
      </div>
      <Newsroom initialDocs={docs} me={me} styleRules={styleRules} />
    </div>
  );
}
