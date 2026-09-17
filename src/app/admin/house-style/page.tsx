import { getHouseStyleRuleRows } from '@/lib/houseStyleServer';
import { getTagGlossaryRows } from '@/lib/tagGlossaryServer';
import DictionaryTabs from '@/components/admin/DictionaryTabs';

export const dynamic = 'force-dynamic';

// Admin: the RS Dictionary — two admin-editable word lists behind two tabs. House
// style is the spellings the Newsroom checker enforces; the Tag glossary is the
// industry vocabulary the tag suggester proposes. Built-in rows in either can be
// edited or disabled but not deleted; add your own on top.
export default async function AdminDictionary() {
  const [rules, terms] = await Promise.all([getHouseStyleRuleRows(), getTagGlossaryRows()]);
  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-2xl font-bold">RS Dictionary</h1>
      <p className="mb-5 text-sm text-[var(--muted)]">
        The newsroom&apos;s two word lists: the <b>house style</b> the checker enforces, and the <b>tag glossary</b> the suggester proposes. Both are yours to edit.
      </p>
      <DictionaryTabs rules={rules} terms={terms} />
    </div>
  );
}
