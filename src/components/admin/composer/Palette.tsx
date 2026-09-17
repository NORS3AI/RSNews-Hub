'use client';
import { useRef, useState } from 'react';
import { useComposer } from './context';
import { uploadImage } from '@/lib/uploadClient';
import {
  H1, H2, ListBullet, ListOrdered, Quote, Minus, Rows,
  ImageIcon, Megaphone, Users, CursorClick, BarChart, Check,
} from '@/components/icons';

export default function Palette() {
  const { editor, insertBlock } = useComposer();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  if (!editor) return null;

  const chain = () => editor.chain().focus();
  async function onImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f || !editor) return;
    setUploading(true); const r = await uploadImage(f); setUploading(false);
    if (r.ok) editor.chain().focus().setImage({ src: r.url }).run();
    if (fileRef.current) fileRef.current.value = '';
  }

  const groups: { title: string; items: { label: string; icon: React.ReactNode; run: () => void }[] }[] = [
    { title: 'Text', items: [
      { label: 'Heading', icon: <H1 width={17} height={17} />, run: () => chain().toggleHeading({ level: 2 }).run() },
      { label: 'Subheading', icon: <H2 width={17} height={17} />, run: () => chain().toggleHeading({ level: 3 }).run() },
      { label: 'Bulleted list', icon: <ListBullet width={17} height={17} />, run: () => chain().toggleBulletList().run() },
      { label: 'Numbered list', icon: <ListOrdered width={17} height={17} />, run: () => chain().toggleOrderedList().run() },
      { label: 'Quote', icon: <Quote width={17} height={17} />, run: () => chain().toggleBlockquote().run() },
    ] },
    { title: 'Layout', items: [
      { label: 'Divider', icon: <Minus width={17} height={17} />, run: () => chain().setHorizontalRule().run() },
      { label: 'Blank space', icon: <Rows width={17} height={17} />, run: () => insertBlock('spacer', { size: 'md' }) },
    ] },
    { title: 'Media & blocks', items: [
      { label: 'Image', icon: <ImageIcon width={17} height={17} />, run: () => fileRef.current?.click() },
      { label: 'Ad slot', icon: <Megaphone width={17} height={17} />, run: () => insertBlock('adSlot') },
      { label: 'Sponsor ad (reserved)', icon: <Megaphone width={17} height={17} />, run: () => insertBlock('reservedAd') },
      { label: 'Pull-quote', icon: <Quote width={17} height={17} />, run: () => editor.chain().focus().insertContent({ type: 'pullQuote', content: [{ type: 'text', text: 'Pull a punchy line here.' }] }).run() },
      { label: 'Button', icon: <CursorClick width={17} height={17} />, run: () => insertBlock('ctaButton', { label: 'Learn more', href: '' }) },
      { label: 'Author card', icon: <Users width={17} height={17} />, run: () => insertBlock('author', { name: '', title: '', avatar: '', bio: '', inhouse: false }) },
      { label: 'Poll', icon: <BarChart width={17} height={17} />, run: () => insertBlock('pollEmbed') },
      { label: 'Pop quiz', icon: <Check width={17} height={17} />, run: () => insertBlock('quizEmbed') },
    ] },
  ];

  return (
    <div className="space-y-4">
      <div className="text-xs font-black uppercase tracking-wide text-[var(--muted)]">Add element</div>
      {groups.map((g) => (
        <div key={g.title}>
          <div className="mb-1 px-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]/70">{g.title}</div>
          <div className="space-y-0.5">
            {g.items.map((it) => (
              <button key={it.label} type="button" onClick={it.run}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-[var(--fg)] transition hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-950/30">
                <span className="text-[var(--muted)]">{it.icon}</span>{it.label}
              </button>
            ))}
          </div>
        </div>
      ))}
      {uploading && <p className="px-1 text-xs text-[var(--muted)]">Uploading image…</p>}
      <input ref={fileRef} type="file" accept="image/*" onChange={onImage} className="hidden" />
    </div>
  );
}
