'use client';
import { useState } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { Megaphone, Rows, BarChart, Check, CursorClick, Trash, Users } from '@/components/icons';
import { uploadImage } from '@/lib/uploadClient';
import { BrandMark } from '@/components/BrandLogo';

// Custom article elements. Each serializes to plain, semantic HTML with a data-
// attribute so the reader (and the clipping tool, which only cares about text)
// stay simple — and each gets a friendly in-editor preview so composing feels
// like arranging cards, not writing markup.

function Shell({ children, onDelete, tone = 'slate' }: { children: React.ReactNode; onDelete: () => void; tone?: 'slate' | 'orange' }) {
  return (
    <NodeViewWrapper className="my-3">
      <div contentEditable={false} className={`group relative overflow-hidden rounded-xl border ${tone === 'orange' ? 'border-brand-300 bg-brand-50 dark:border-brand-900 dark:bg-brand-950/30' : 'border-dashed border-[var(--border)] bg-[var(--bg-soft)]'} px-4 py-3`}>
        <button type="button" onClick={onDelete} title="Remove" className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-lg text-[var(--muted)] opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-950/40">
          <Trash width={15} height={15} />
        </button>
        {children}
      </div>
    </NodeViewWrapper>
  );
}
const Label = ({ icon, text }: { icon: React.ReactNode; text: string }) => (
  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{icon}{text}</div>
);

/* ── Ad slot ─────────────────────────────────────────────────────────────── */
const AdView = (props: any) => (
  <Shell onDelete={props.deleteNode} tone="orange">
    <Label icon={<Megaphone width={14} height={14} className="text-brand-600" />} text="Ad slot" />
    <p className="mt-1 text-sm text-[var(--fg)]">An ad drops in here on the live site — auto-matched from your campaigns &amp; house ads.</p>
  </Shell>
);
export const AdSlot = Node.create({
  name: 'adSlot', group: 'block', atom: true, selectable: true, draggable: true,
  parseHTML() { return [{ tag: 'div[data-ad-slot]' }]; },
  renderHTML() { return ['div', { 'data-ad-slot': '', 'data-ad-type': 'auto' }]; },
  addNodeView() { return ReactNodeViewRenderer(AdView); },
});

/* ── Spacer ──────────────────────────────────────────────────────────────── */
const SIZES: Record<string, string> = { sm: '18px', md: '36px', lg: '64px' };
const SpacerView = (props: any) => {
  const size = props.node.attrs.size || 'md';
  return (
    <Shell onDelete={props.deleteNode}>
      <div className="flex items-center justify-between">
        <Label icon={<Rows width={14} height={14} />} text="Blank space" />
        <div className="flex gap-1">
          {(['sm', 'md', 'lg'] as const).map((s) => (
            <button key={s} type="button" onClick={() => props.updateAttributes({ size: s })}
              className={`rounded-md px-2 py-0.5 text-xs font-bold ${size === s ? 'bg-brand-600 text-white' : 'bg-[var(--card)] text-[var(--muted)] hover:text-[var(--fg)]'}`}>
              {s.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div style={{ height: SIZES[size] }} />
    </Shell>
  );
};
export const Spacer = Node.create({
  name: 'spacer', group: 'block', atom: true, selectable: true, draggable: true,
  addAttributes() { return { size: { default: 'md' } }; },
  parseHTML() { return [{ tag: 'div[data-spacer]', getAttrs: (el) => ({ size: (el as HTMLElement).getAttribute('data-size') || 'md' }) }]; },
  renderHTML({ node }) { return ['div', { 'data-spacer': '', 'data-size': node.attrs.size, style: `height:${SIZES[node.attrs.size] || SIZES.md}` }]; },
  addNodeView() { return ReactNodeViewRenderer(SpacerView); },
});

/* ── Poll / Quiz embeds ──────────────────────────────────────────────────── */
function embedNode(name: string, dataAttr: string) {
  return Node.create({
    name, group: 'block', atom: true, selectable: true, draggable: true,
    addAttributes() { return { id: { default: '' }, label: { default: '' } }; },
    parseHTML() { return [{ tag: `div[${dataAttr}]`, getAttrs: (el) => ({ id: (el as HTMLElement).getAttribute(dataAttr) || '', label: (el as HTMLElement).getAttribute('data-label') || '' }) }]; },
    renderHTML({ node }) { return ['div', { [dataAttr]: node.attrs.id, 'data-label': node.attrs.label }]; },
    addNodeView() {
      return ReactNodeViewRenderer((props: any) => (
        <Shell onDelete={props.deleteNode} tone="orange">
          <Label icon={<BarChart width={14} height={14} className="text-brand-600" />} text={name === 'pollEmbed' ? 'Poll' : 'Pop quiz'} />
          <p className="mt-1 text-sm font-semibold text-[var(--fg)]">{props.node.attrs.label || '(select one)'}</p>
          <p className="text-xs text-[var(--muted)]">Readers can {name === 'pollEmbed' ? 'vote' : 'take it'} right here in the article.</p>
        </Shell>
      ));
    },
  });
}
export const PollEmbed = embedNode('pollEmbed', 'data-poll');
export const QuizEmbed = embedNode('quizEmbed', 'data-quiz');

/* ── Call-to-action button ───────────────────────────────────────────────── */
const ButtonView = (props: any) => {
  const { label, href } = props.node.attrs;
  const edit = () => {
    const l = window.prompt('Button text', label || 'Learn more'); if (l === null) return;
    const h = window.prompt('Link URL (https://…)', href || 'https://'); if (h === null) return;
    props.updateAttributes({ label: l.trim() || 'Learn more', href: h.trim() });
  };
  return (
    <Shell onDelete={props.deleteNode}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <Label icon={<CursorClick width={14} height={14} />} text="Button" />
          <div className="mt-2"><span className="btn-primary btn-sm pointer-events-none inline-flex">{label || 'Learn more'}</span></div>
          <p className="mt-1 truncate text-xs text-[var(--muted)]">{href || 'No link set'}</p>
        </div>
        <button type="button" onClick={edit} className="btn-outline btn-sm shrink-0">Edit</button>
      </div>
    </Shell>
  );
};
export const CtaButton = Node.create({
  name: 'ctaButton', group: 'block', atom: true, selectable: true, draggable: true,
  addAttributes() { return { label: { default: 'Learn more' }, href: { default: '' } }; },
  parseHTML() { return [{ tag: 'a[data-button]', getAttrs: (el) => ({ href: (el as HTMLElement).getAttribute('href') || '', label: (el as HTMLElement).textContent || 'Learn more' }) }]; },
  renderHTML({ node }) { return ['a', mergeAttributes({ 'data-button': '', class: 'a-btn', href: node.attrs.href }), node.attrs.label]; },
  addNodeView() { return ReactNodeViewRenderer(ButtonView); },
});

/* ── Author byline card ──────────────────────────────────────────────────── */
const AuthorView = (props: any) => {
  const a = props.node.attrs;
  const up = props.updateAttributes;
  const inhouse = a.inhouse === true || a.inhouse === 'true' || a.inhouse === '1';
  const [editing, setEditing] = useState(!inhouse && !a.name);
  const [busy, setBusy] = useState(false);
  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return; setBusy(true);
    const r = await uploadImage(f); setBusy(false); if (r.ok) up({ avatar: r.url }); e.target.value = '';
  }
  const displayName = inhouse ? 'RS News' : (a.name || 'Author name');
  const displayTitle = inhouse ? 'Editorial Team' : a.title;
  const displayBio = inhouse ? '' : a.bio;
  const avatar = inhouse
    ? <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full"><BrandMark size={48} className="rounded-full" /></span>
    : a.avatar
      // eslint-disable-next-line @next/next/no-img-element
      ? <img src={a.avatar} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
      : <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--card)] text-base font-black text-[var(--muted)]">{(a.name || '?').slice(0, 1).toUpperCase()}</span>;

  return (
    <Shell onDelete={props.deleteNode}>
      <div className="flex items-start justify-between gap-3">
        <Label icon={<Users width={14} height={14} />} text="Author" />
        <button type="button" onClick={() => setEditing((v) => !v)} className="btn-outline btn-sm shrink-0">{editing ? 'Done' : 'Edit'}</button>
      </div>

      {/* Preview — auto-adjusts: title/bio only show when set. */}
      <div className="mt-2 flex items-center gap-3">
        {avatar}
        <div className="min-w-0">
          <div className="font-bold leading-tight text-[var(--fg)]">{displayName}</div>
          {displayTitle ? <div className="text-sm text-[var(--muted)]">{displayTitle}</div> : null}
          {displayBio ? <div className="mt-0.5 line-clamp-2 text-xs text-[var(--muted)]">{displayBio}</div> : null}
        </div>
      </div>

      {editing && (
        <div className="mt-3 space-y-2 border-t border-[var(--border)] pt-3">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={inhouse} onChange={(e) => up({ inhouse: e.target.checked })} className="h-4 w-4" />
            Written in-house by RS News
          </label>
          {!inhouse && (
            <>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => (document.getElementById('author-file-' + props.getPos?.()) as HTMLInputElement)?.click()} className="btn-outline btn-sm">{busy ? 'Uploading…' : a.avatar ? 'Change headshot' : 'Add headshot'}</button>
                {a.avatar && <button type="button" onClick={() => up({ avatar: '' })} className="text-xs text-red-600 hover:underline">Remove</button>}
                <input id={'author-file-' + props.getPos?.()} type="file" accept="image/*" onChange={pick} className="hidden" />
              </div>
              <input value={a.name || ''} onChange={(e) => up({ name: e.target.value })} placeholder="Name" className="input" />
              <input value={a.title || ''} onChange={(e) => up({ title: e.target.value })} placeholder="Title / role (optional)" className="input" />
              <textarea value={a.bio || ''} onChange={(e) => up({ bio: e.target.value })} placeholder="Short bio (optional)" className="input min-h-[56px]" />
            </>
          )}
        </div>
      )}
    </Shell>
  );
};
export const Author = Node.create({
  name: 'author', group: 'block', atom: true, selectable: true, draggable: true,
  addAttributes() { return { name: { default: '' }, title: { default: '' }, avatar: { default: '' }, bio: { default: '' }, inhouse: { default: false } }; },
  parseHTML() {
    return [{ tag: 'div[data-author]', getAttrs: (el) => {
      const e = el as HTMLElement;
      return { name: e.getAttribute('data-name') || '', title: e.getAttribute('data-title') || '', avatar: e.getAttribute('data-avatar') || '', bio: e.getAttribute('data-bio') || '', inhouse: e.getAttribute('data-inhouse') === '1' };
    } }];
  },
  renderHTML({ node }) {
    return ['div', { 'data-author': '', 'data-name': node.attrs.name, 'data-title': node.attrs.title, 'data-avatar': node.attrs.avatar, 'data-bio': node.attrs.bio, 'data-inhouse': node.attrs.inhouse ? '1' : '0' }];
  },
  addNodeView() { return ReactNodeViewRenderer(AuthorView); },
});

/* ── Pull-quote (editable text, styled) ──────────────────────────────────── */
export const PullQuote = Node.create({
  name: 'pullQuote', group: 'block', content: 'inline*', defining: true,
  parseHTML() { return [{ tag: 'blockquote[data-pullquote]' }]; },
  renderHTML({ HTMLAttributes }) { return ['blockquote', mergeAttributes(HTMLAttributes, { 'data-pullquote': '', class: 'pullquote' }), 0]; },
});
