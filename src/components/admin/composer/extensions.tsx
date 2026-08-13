'use client';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { Megaphone, Rows, BarChart, Check, CursorClick, Trash, Users, Minus, Grip } from '@/components/icons';
import { BrandMark } from '@/components/BrandLogo';

// Custom article elements. Each serializes to plain, semantic HTML with a data-
// attribute (so the reader — and the clipping tool, which only cares about text —
// stay simple). In the composer each shows a clean PREVIEW; you configure it in
// the right-hand "Element" panel, and reorder by dragging. Selecting one rings it.

export const CUSTOM_TYPES = ['adSlot', 'reservedAd', 'spacer', 'pollEmbed', 'quizEmbed', 'ctaButton', 'author'];

function Card({ children, onDelete, tone = 'slate', selected }: { children: React.ReactNode; onDelete: () => void; tone?: 'slate' | 'orange'; selected?: boolean }) {
  return (
    <NodeViewWrapper className="my-3">
      <div contentEditable={false}
        className={`group relative overflow-hidden rounded-xl border py-3 pl-10 pr-4 transition ${
          tone === 'orange' ? 'border-brand-300 bg-brand-50 dark:border-brand-900 dark:bg-brand-950/30' : 'border-dashed border-[var(--border)] bg-[var(--bg-soft)]'
        } ${selected ? 'ring-2 ring-brand-500' : ''}`}>
        {/* Drag handle — scopes drag-start to here (no accidental drags) and makes
            reordering discoverable. The node itself is draggable:true. */}
        <span data-drag-handle draggable title="Drag to reorder" contentEditable={false}
          className="absolute left-1.5 top-1/2 grid h-7 w-6 -translate-y-1/2 cursor-grab place-items-center rounded-md text-[var(--muted)] opacity-40 transition hover:bg-[var(--card)] hover:text-[var(--fg)] group-hover:opacity-100 active:cursor-grabbing">
          <Grip width={14} height={14} />
        </span>
        <button type="button" onClick={onDelete} title="Remove" contentEditable={false}
          className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-lg text-[var(--muted)] opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-950/40">
          <Trash width={15} height={15} />
        </button>
        {children}
      </div>
    </NodeViewWrapper>
  );
}
const Tag = ({ icon, text }: { icon: React.ReactNode; text: string }) => (
  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{icon}{text}</div>
);
const hint = <span className="text-[var(--muted)]">— set it in the Element panel →</span>;

/* ── Ad slot ─────────────────────────────────────────────────────────────── */
const AD_SIZE_LABEL: Record<string, string> = { wide: 'Wide banner', rectangle: 'Rectangle' };
export const AdSlot = Node.create({
  name: 'adSlot', group: 'block', atom: true, selectable: true, draggable: true,
  // brand = advertiser lock (normalized brand key; empty = Auto smart-cycle);
  // size = slot shape; adLabel = advertiser display name for the editor card.
  addAttributes() { return { brand: { default: '' }, size: { default: 'wide' }, adLabel: { default: '' } }; },
  parseHTML() {
    return [{ tag: 'div[data-ad-slot]', getAttrs: (el) => ({
      brand: (el as HTMLElement).getAttribute('data-ad-brand') || '',
      size: (el as HTMLElement).getAttribute('data-ad-size') || 'wide',
      adLabel: (el as HTMLElement).getAttribute('data-ad-label') || '',
    }) }];
  },
  renderHTML({ node }) { return ['div', { 'data-ad-slot': '', 'data-ad-brand': node.attrs.brand || '', 'data-ad-size': node.attrs.size || 'wide', 'data-ad-label': node.attrs.adLabel || '' }]; },
  addNodeView() {
    return ReactNodeViewRenderer((p: any) => (
      <Card onDelete={p.deleteNode} tone="orange" selected={p.selected}>
        <Tag icon={<Megaphone width={14} height={14} className="text-brand-600" />} text={`Ad slot · ${AD_SIZE_LABEL[p.node.attrs.size] || 'Wide banner'}`} />
        <p className="mt-1 text-sm text-[var(--fg)]">{p.node.attrs.brand ? <>Advertiser: <strong>{p.node.attrs.adLabel || p.node.attrs.brand}</strong></> : <>Auto — best match, competitor-safe.</>}</p>
      </Card>
    ));
  },
});

/* ── Reserved sponsor ad (a specific one-off creative, by id) ─────────────── */
export const ReservedAd = Node.create({
  name: 'reservedAd', group: 'block', atom: true, selectable: true, draggable: true,
  // adId = the exact reserved Ad to render (rectangle); adLabel = its brand, for
  // the editor card only.
  addAttributes() { return { adId: { default: '' }, adLabel: { default: '' } }; },
  parseHTML() {
    return [{ tag: 'div[data-ad-id]', getAttrs: (el) => ({
      adId: (el as HTMLElement).getAttribute('data-ad-id') || '',
      adLabel: (el as HTMLElement).getAttribute('data-ad-label') || '',
    }) }];
  },
  renderHTML({ node }) { return ['div', { 'data-ad-id': node.attrs.adId || '', 'data-ad-label': node.attrs.adLabel || '' }]; },
  addNodeView() {
    return ReactNodeViewRenderer((p: any) => (
      <Card onDelete={p.deleteNode} tone="orange" selected={p.selected}>
        <Tag icon={<Megaphone width={14} height={14} className="text-brand-600" />} text="Sponsor ad · Rectangle" />
        <p className="mt-1 text-sm text-[var(--fg)]">{p.node.attrs.adId ? <>Creative: <strong>{p.node.attrs.adLabel || p.node.attrs.adId}</strong></> : <>Pick the sponsor&apos;s creative {hint}</>}</p>
      </Card>
    ));
  },
});

/* ── Spacer ──────────────────────────────────────────────────────────────── */
export const SPACER_SIZES: Record<string, string> = { sm: '18px', md: '36px', lg: '64px' };
export const Spacer = Node.create({
  name: 'spacer', group: 'block', atom: true, selectable: true, draggable: true,
  addAttributes() { return { size: { default: 'md' } }; },
  parseHTML() { return [{ tag: 'div[data-spacer]', getAttrs: (el) => ({ size: (el as HTMLElement).getAttribute('data-size') || 'md' }) }]; },
  renderHTML({ node }) { return ['div', { 'data-spacer': '', 'data-size': node.attrs.size, style: `height:${SPACER_SIZES[node.attrs.size] || SPACER_SIZES.md}` }]; },
  addNodeView() {
    return ReactNodeViewRenderer((p: any) => (
      <Card onDelete={p.deleteNode} selected={p.selected}>
        <Tag icon={<Rows width={14} height={14} />} text={`Blank space · ${String(p.node.attrs.size).toUpperCase()}`} />
        <div style={{ height: SPACER_SIZES[p.node.attrs.size] || SPACER_SIZES.md }} />
      </Card>
    ));
  },
});

/* ── Poll / Quiz embeds ──────────────────────────────────────────────────── */
function embedNode(name: string, dataAttr: string, kind: 'Poll' | 'Pop quiz') {
  return Node.create({
    name, group: 'block', atom: true, selectable: true, draggable: true,
    addAttributes() { return { id: { default: '' }, label: { default: '' } }; },
    parseHTML() { return [{ tag: `div[${dataAttr}]`, getAttrs: (el) => ({ id: (el as HTMLElement).getAttribute(dataAttr) || '', label: (el as HTMLElement).getAttribute('data-label') || '' }) }]; },
    renderHTML({ node }) { return ['div', { [dataAttr]: node.attrs.id, 'data-label': node.attrs.label }]; },
    addNodeView() {
      return ReactNodeViewRenderer((p: any) => (
        <Card onDelete={p.deleteNode} tone="orange" selected={p.selected}>
          <Tag icon={<BarChart width={14} height={14} className="text-brand-600" />} text={kind} />
          <p className="mt-1 text-sm font-semibold text-[var(--fg)]">{p.node.attrs.label || hint}</p>
        </Card>
      ));
    },
  });
}
export const PollEmbed = embedNode('pollEmbed', 'data-poll', 'Poll');
export const QuizEmbed = embedNode('quizEmbed', 'data-quiz', 'Pop quiz');

/* ── Call-to-action button ───────────────────────────────────────────────── */
export const CtaButton = Node.create({
  name: 'ctaButton', group: 'block', atom: true, selectable: true, draggable: true,
  addAttributes() { return { label: { default: 'Learn more' }, href: { default: '' } }; },
  parseHTML() { return [{ tag: 'a[data-button]', getAttrs: (el) => ({ href: (el as HTMLElement).getAttribute('href') || '', label: (el as HTMLElement).textContent || 'Learn more' }) }]; },
  renderHTML({ node }) { return ['a', mergeAttributes({ 'data-button': '', class: 'a-btn', href: node.attrs.href }), node.attrs.label]; },
  addNodeView() {
    return ReactNodeViewRenderer((p: any) => (
      <Card onDelete={p.deleteNode} selected={p.selected}>
        <Tag icon={<CursorClick width={14} height={14} />} text="Button" />
        <div className="mt-2"><span className="btn-primary btn-sm pointer-events-none inline-flex">{p.node.attrs.label || 'Learn more'}</span></div>
        <p className="mt-1 truncate text-xs text-[var(--muted)]">{p.node.attrs.href || hint}</p>
      </Card>
    ));
  },
});

/* ── Author bio card (inline additional content, e.g. a guest writer) ───────── */
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
  addNodeView() {
    return ReactNodeViewRenderer((p: any) => {
      const a = p.node.attrs;
      const inhouse = a.inhouse === true || a.inhouse === '1';
      const name = inhouse ? 'RS News' : (a.name || <span className="text-[var(--muted)]">Author name {hint}</span>);
      const title = inhouse ? 'Editorial Team' : a.title;
      const bio = inhouse ? '' : a.bio;
      const avatar = inhouse
        ? <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full"><BrandMark size={48} className="rounded-full" /></span>
        // eslint-disable-next-line @next/next/no-img-element
        : a.avatar ? <img src={a.avatar} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
          : <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--card)] text-base font-black text-[var(--muted)]">{(a.name || '?').slice(0, 1).toUpperCase()}</span>;
      return (
        <Card onDelete={p.deleteNode} selected={p.selected}>
          <Tag icon={<Users width={14} height={14} />} text="Author card" />
          <div className="mt-2 flex items-center gap-3">
            {avatar}
            <div className="min-w-0">
              <div className="font-bold leading-tight text-[var(--fg)]">{name}</div>
              {title ? <div className="text-sm text-[var(--muted)]">{title}</div> : null}
              {bio ? <div className="mt-0.5 line-clamp-2 text-xs text-[var(--muted)]">{bio}</div> : null}
            </div>
          </div>
        </Card>
      );
    });
  },
});

/* ── Pull-quote (editable text, styled) ──────────────────────────────────── */
export const PullQuote = Node.create({
  name: 'pullQuote', group: 'block', content: 'inline*', defining: true,
  parseHTML() { return [{ tag: 'blockquote[data-pullquote]' }]; },
  renderHTML({ HTMLAttributes }) { return ['blockquote', mergeAttributes(HTMLAttributes, { 'data-pullquote': '', class: 'pullquote' }), 0]; },
});
