'use client';
import { useMemo, useState } from 'react';
import { useSaved } from './StarProvider';
import { useArticleModal } from './ArticleModalProvider';
import { StarFilled, Layers, Plus, Trash, Edit, X } from '@/components/icons';

// The member's favorites, browsable and groupable into folders — the app-side
// equivalent of the static preview's favorites page. Favorites are saved
// per-account (server-backed when signed in); folders live alongside them.
type View = 'all' | 'unfiled' | string;

export default function FavoritesList() {
  const { favorites, favFolders, toggleFavorite, addFavFolder, renameFavFolder, removeFavFolder, setFavFolder, ready } = useSaved();
  const { openArticle } = useArticleModal();
  const [view, setView] = useState<View>('all');
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [renameName, setRenameName] = useState('');

  // A folder view whose folder was deleted falls back to "All".
  const activeFolder = favFolders.find((f) => f.id === view);
  const effView: View = view === 'all' || view === 'unfiled' || activeFolder ? view : 'all';

  const unfiledCount = useMemo(() => favorites.filter((f) => !f.folder).length, [favorites]);
  const shown = useMemo(
    () => favorites.filter((f) => (effView === 'all' ? true : effView === 'unfiled' ? !f.folder : f.folder === effView)),
    [favorites, effView],
  );

  function submitNew() {
    const name = newName.trim();
    if (name) addFavFolder(name);
    setNewName('');
    setNewOpen(false);
  }
  function submitRename() {
    const name = renameName.trim();
    if (name && activeFolder) renameFavFolder(activeFolder.id, name);
    setRenaming(false);
  }
  function deleteFolder() {
    if (activeFolder) { removeFavFolder(activeFolder.id); setView('all'); }
  }

  return (
    <div className="module">
      <div className="mb-4 flex items-center gap-2">
        <h1 className="flex items-center gap-2 text-xl font-bold"><StarFilled className="text-brand-600" width={20} height={20} /> Your favorites</h1>
      </div>

      {!ready ? (
        <p className="text-[var(--muted)]">Loading…</p>
      ) : favorites.length === 0 ? (
        <p className="text-[var(--muted)]">
          No favorites yet. Tap the star on any article to save it here — then group them into folders like <b>Training</b>, <b>Front&nbsp;counter</b> or <b>Marketing</b>.
        </p>
      ) : (
        <>
          {/* Folder chips + new-folder control */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Chip label="All" count={favorites.length} active={effView === 'all'} onClick={() => setView('all')} />
            {favFolders.length > 0 && (
              <Chip label="Unfiled" count={unfiledCount} active={effView === 'unfiled'} onClick={() => setView('unfiled')} />
            )}
            {favFolders.map((f) => (
              <Chip key={f.id} label={f.name} count={favorites.filter((x) => x.folder === f.id).length} active={effView === f.id} onClick={() => setView(f.id)} />
            ))}
            {newOpen ? (
              <span className="inline-flex items-center gap-1">
                <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={32}
                  onKeyDown={(e) => { if (e.key === 'Enter') submitNew(); if (e.key === 'Escape') { setNewOpen(false); setNewName(''); } }}
                  placeholder="Folder name" className="input h-8 w-36 px-2 py-1 text-sm" />
                <button onClick={submitNew} className="btn-primary btn-sm">Add</button>
                <button onClick={() => { setNewOpen(false); setNewName(''); }} className="btn-outline btn-sm" aria-label="Cancel"><X width={14} height={14} /></button>
              </span>
            ) : (
              favFolders.length < 40 && (
                <button onClick={() => setNewOpen(true)} className="inline-flex items-center gap-1 rounded-full border border-dashed border-[var(--border)] px-3 py-1.5 text-sm font-semibold text-[var(--muted)] hover:text-brand-600">
                  <Plus width={14} height={14} /> New folder
                </button>
              )
            )}
          </div>

          {/* Rename / delete for the selected folder */}
          {activeFolder && (
            <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
              {renaming ? (
                <span className="inline-flex items-center gap-1">
                  <input autoFocus value={renameName} onChange={(e) => setRenameName(e.target.value)} maxLength={32}
                    onKeyDown={(e) => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') setRenaming(false); }}
                    className="input h-8 w-40 px-2 py-1 text-sm" />
                  <button onClick={submitRename} className="btn-primary btn-sm">Save</button>
                  <button onClick={() => setRenaming(false)} className="btn-outline btn-sm">Cancel</button>
                </span>
              ) : (
                <>
                  <span>Showing <b className="text-[var(--fg)]">{activeFolder.name}</b></span>
                  <button onClick={() => { setRenameName(activeFolder.name); setRenaming(true); }} className="inline-flex items-center gap-1 hover:text-brand-600"><Edit width={13} height={13} /> Rename</button>
                  <button onClick={deleteFolder} className="inline-flex items-center gap-1 hover:text-red-600"><Trash width={13} height={13} /> Delete folder</button>
                </>
              )}
            </div>
          )}

          {shown.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Nothing filed here yet. Use the folder menu on any favorite to move it in.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((f) => (
                <li key={f.id} className="card flex flex-col gap-3 p-4">
                  <button onClick={() => openArticle(f.slug)} className="text-left">
                    <h3 className="font-bold leading-tight text-[var(--fg)] hover:text-brand-600">{f.title}</h3>
                  </button>
                  <div className="mt-auto flex items-center gap-2">
                    <span className="flex items-center gap-1 text-[var(--muted)]"><Layers width={14} height={14} /></span>
                    <select
                      value={f.folder || ''}
                      onChange={(e) => setFavFolder(f.id, e.target.value || null)}
                      aria-label="Move to folder"
                      className="input h-8 flex-1 px-2 py-1 text-sm">
                      <option value="">Unfiled</option>
                      {favFolders.map((folder) => (
                        <option key={folder.id} value={folder.id}>{folder.name}</option>
                      ))}
                    </select>
                    <button onClick={() => toggleFavorite({ id: f.id, title: f.title, slug: f.slug })}
                      title="Remove from favorites" aria-label="Remove from favorites"
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-brand-600 hover:bg-[var(--bg-soft)]">
                      <StarFilled width={17} height={17} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function Chip({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${active ? 'bg-brand-600 text-white' : 'bg-[var(--bg-soft)] text-[var(--fg)] hover:bg-[var(--border)]'}`}>
      {label}<span className={`rounded-full px-1.5 text-xs ${active ? 'bg-white/25' : 'bg-black/10 dark:bg-white/10'}`}>{count}</span>
    </button>
  );
}
