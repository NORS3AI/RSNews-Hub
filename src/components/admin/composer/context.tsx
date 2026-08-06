'use client';
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { useEditor, type Editor } from '@tiptap/react';
import { NodeSelection } from '@tiptap/pm/state';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { AdSlot, Spacer, PollEmbed, QuizEmbed, CtaButton, PullQuote, Author, CUSTOM_TYPES } from './extensions';

export type Opt = { id: string; title: string };
export type Selected = { type: string; attrs: Record<string, unknown>; pos: number } | null;

type Ctx = {
  editor: Editor | null;
  html: string;
  selected: Selected;
  polls: Opt[]; quizzes: Opt[]; ads: Opt[];
  insertBlock: (type: string, attrs?: Record<string, unknown>) => void;
  updateSelected: (attrs: Record<string, unknown>) => void;
  deleteSelected: () => void;
};
const C = createContext<Ctx | null>(null);
export const useComposer = () => { const v = useContext(C); if (!v) throw new Error('useComposer outside provider'); return v; };

export function ComposerProvider({
  name = 'content', initialHTML = '', polls = [], quizzes = [], ads = [], children,
}: { name?: string; initialHTML?: string; polls?: Opt[]; quizzes?: Opt[]; ads?: Opt[]; children: ReactNode }) {
  const [html, setHtml] = useState(initialHTML);
  const [selected, setSelected] = useState<Selected>(null);

  const compute = useCallback((editor: Editor) => {
    const sel = editor.state.selection;
    if (sel instanceof NodeSelection && CUSTOM_TYPES.includes(sel.node.type.name)) {
      setSelected({ type: sel.node.type.name, attrs: { ...sel.node.attrs }, pos: sel.from });
    } else setSelected(null);
  }, []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, link: false }),
      Link.configure({ openOnClick: false, autolink: true }),
      Image.configure({ HTMLAttributes: { class: 'a-figimg' } }),
      Placeholder.configure({ placeholder: 'Write your story… paste it all in, then click an element on the left to drop it in wherever your cursor is.' }),
      AdSlot, Spacer, PollEmbed, QuizEmbed, CtaButton, PullQuote, Author,
    ],
    content: initialHTML || '',
    editorProps: { attributes: { class: 'composer-surface prose-article focus:outline-none' } },
    onUpdate: ({ editor }) => { setHtml(editor.getHTML()); compute(editor); },
    onSelectionUpdate: ({ editor }) => compute(editor),
  });

  // Insert a block at the cursor, then select it so the Element panel opens on it.
  const insertBlock = useCallback((type: string, attrs: Record<string, unknown> = {}) => {
    if (!editor) return;
    editor.chain().focus().insertContent({ type, attrs }).run();
    const pos = editor.state.selection.from - 1;
    if (pos >= 0) { try { editor.chain().setNodeSelection(pos).run(); } catch { /* ignore */ } }
  }, [editor]);

  const updateSelected = useCallback((attrs: Record<string, unknown>) => {
    if (!editor || !selected) return;
    editor.chain().focus().updateAttributes(selected.type, attrs).run();
  }, [editor, selected]);

  const deleteSelected = useCallback(() => { if (editor) editor.chain().focus().deleteSelection().run(); }, [editor]);

  return (
    <C.Provider value={{ editor, html, selected, polls, quizzes, ads, insertBlock, updateSelected, deleteSelected }}>
      {children}
      <textarea name={name} value={html} readOnly hidden />
    </C.Provider>
  );
}
