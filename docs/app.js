/* RSNews Hub — static preview. Sidebar nav, module-forward layout,
   favorites (★) + read-later (📖) + history, flat orange (#E97D34). */
(function () {
  'use strict';
  var DATA = window.__DATA__ || { articles: [], categories: [] };
  var ARTICLES = DATA.articles || [];
  var CATEGORIES = DATA.categories || [];
  var INDUSTRY = DATA.industry || [];
  var POLLS = DATA.polls || [];
  var COMICS = DATA.comics || [];
  var QUIZ = DATA.quiz || null;
  var bySlug = {};
  ARTICLES.forEach(function (a) { bySlug[a.slug] = a; });
  var FAV_KEY = 'rsnews_favorites_v1', READ_KEY = 'rsnews_toread_v1', HIST_KEY = 'rsnews_history_v1';
  var THEME_KEY = 'rsnews_theme', SIDE_KEY = 'rsnews_sidebar', HIST_MAX = 50;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function el(id) { return document.getElementById(id); }
  function fmtDate(iso) { if (!iso) return ''; try { return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); } catch (e) { return ''; } }
  var ICON = {
    star: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9L12 3.5Z"/></svg>',
    starFill: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9L12 3.5Z"/></svg>',
    book: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M12 17v5M9 3h6l-1 6 3 3H7l3-3-1-6Z"/></svg>',
    bookFill: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"><path d="M12 17v5M9 3h6l-1 6 3 3H7l3-3-1-6Z"/></svg>',
    bookSm: '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17v5M9 3h6l-1 6 3 3H7l3-3-1-6Z"/></svg>',
    pinMd: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"><path d="M12 17v5M9 3h6l-1 6 3 3H7l3-3-1-6Z"/></svg>',
    expandLR: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M4 12h16M8 8l-4 4 4 4M16 8l4 4-4 4"/></svg>',
    collapseLR: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M4 12h16M4 8l4 4-4 4M20 8l-4 4 4 4"/></svg>',
    x: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    clock: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    clockLg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" stroke-width="2" stroke-linecap="round" style="display:inline;vertical-align:-4px"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    eye: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
    arrow: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>',
    stamp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2"/></svg>',
    share: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>',
    clip: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12"/></svg>',
    download: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>',
    copy: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    trash2: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6"/></svg>',
    check: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    starLg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="var(--orange)" stroke="none" style="display:inline;vertical-align:-4px"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9L12 3.5Z"/></svg>',
    folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/></svg>',
    folderPlus: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M12 11v4M10 13h4"/></svg>'
  };

  /* ---------- theme ---------- */
  var THEME_ORDER = ['light', 'dark', 'rs'];
  // The button shows the CURRENT theme, so the label always matches what's on
  // screen; clicking cycles to the next. (Tooltip hints what's next.)
  var THEME_META = { light: { icon: 'sun', label: 'Light mode' }, dark: { icon: 'moon', label: 'Dark mode' }, rs: { icon: 'stamp', label: 'RS mode' } };
  var THEME_NEXT_LABEL = { light: 'Dark', dark: 'RS', rs: 'Light' };
  function applyTheme(t) {
    var root = document.documentElement;
    root.classList.toggle('dark', t === 'dark');
    root.classList.toggle('rs', t === 'rs');
    var b = el('theme-btn'); var m = THEME_META[t] || THEME_META.light;
    if (b) { b.innerHTML = ICON[m.icon] + '<span class="side-label">' + m.label + '</span>'; b.title = 'Theme: ' + m.label + ' — click for ' + THEME_NEXT_LABEL[t]; }
  }
  function initTheme() {
    var t; try { t = localStorage.getItem(THEME_KEY); } catch (e) {}
    if (THEME_ORDER.indexOf(t) < 0) t = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    applyTheme(t);
  }
  function toggleTheme() {
    var root = document.documentElement;
    var cur = root.classList.contains('dark') ? 'dark' : root.classList.contains('rs') ? 'rs' : 'light';
    var t = THEME_ORDER[(THEME_ORDER.indexOf(cur) + 1) % THEME_ORDER.length];
    try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
    applyTheme(t);
  }

  /* ---------- sidebar ---------- */
  function initSidebar() { try { if (localStorage.getItem(SIDE_KEY) === 'collapsed') el('shell').classList.add('collapsed'); } catch (e) {} }
  function toggleCollapse() {
    var shell = el('shell'); shell.classList.toggle('collapsed');
    try { localStorage.setItem(SIDE_KEY, shell.classList.contains('collapsed') ? 'collapsed' : 'expanded'); } catch (e) {}
  }
  function closeDrawer() { el('shell').classList.remove('mobileopen'); }
  function setActive(node) {
    document.querySelectorAll('.side-nav .side-item').forEach(function (x) { x.classList.remove('is-active'); });
    if (node && node.classList.contains('side-item')) node.classList.add('is-active');
  }

  /* ---------- saved lists + history ---------- */
  function read(k) { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch (e) { return []; } }
  function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function inList(k, id) { return read(k).some(function (s) { return s.id === id; }); }
  function toggleIn(k, slug) { var a = bySlug[slug]; if (!a) return; var l = read(k);
    l = inList(k, a.id) ? l.filter(function (s) { return s.id !== a.id; }) : [{ id: a.id, title: a.title, slug: a.slug }].concat(l); write(k, l); }
  function isFav(id) { return inList(FAV_KEY, id); }
  function isRead(id) { return inList(READ_KEY, id); }
  function toggleFav(slug) { toggleIn(FAV_KEY, slug); syncButtons(); }
  function toggleRead(slug) { toggleIn(READ_KEY, slug); renderStrip(); syncButtons(); }
  function removeRead(id) { write(READ_KEY, read(READ_KEY).filter(function (s) { return s.id !== id; })); renderStrip(); syncButtons(); }
  function clearRead() { write(READ_KEY, []); renderStrip(); syncButtons(); }
  /* ---------- favorite folders ---------- */
  var FAVFOLDERS_KEY = 'rsnews_favfolders_v1';
  var favView = 'all';      // 'all' | 'unfiled' | folderId
  var favNewOpen = false;   // is the "new folder" input showing
  function getFavFolders() { return read(FAVFOLDERS_KEY); }
  function addFavFolder(name) { name = (name || '').trim(); if (!name) return null;
    var l = getFavFolders(); var id = 'f' + Date.now() + Math.floor(Math.random() * 1000);
    l.push({ id: id, name: name.slice(0, 32) }); write(FAVFOLDERS_KEY, l); return id; }
  function renameFavFolder(id, name) { name = (name || '').trim(); if (!name) return;
    var l = getFavFolders(); l.forEach(function (f) { if (f.id === id) f.name = name.slice(0, 32); }); write(FAVFOLDERS_KEY, l); }
  function removeFavFolder(id) { write(FAVFOLDERS_KEY, getFavFolders().filter(function (f) { return f.id !== id; }));
    var favs = read(FAV_KEY); favs.forEach(function (x) { if (x.folder === id) delete x.folder; }); write(FAV_KEY, favs); }
  function setFavFolder(artId, folderId) { var favs = read(FAV_KEY);
    favs.forEach(function (x) { if (x.id === artId) { if (folderId) x.folder = folderId; else delete x.folder; } }); write(FAV_KEY, favs); }
  function getHistory() { return read(HIST_KEY); }
  function recordHistory(a) { if (!a) return; var l = read(HIST_KEY).filter(function (s) { return s.id !== a.id; });
    l.unshift({ id: a.id, title: a.title, slug: a.slug, ts: Date.now() }); if (l.length > HIST_MAX) l = l.slice(0, HIST_MAX); write(HIST_KEY, l); }
  function clearHistory() { write(HIST_KEY, []); }
  function timeAgo(ts) { if (!ts) return ''; var s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
    if (s < 60) return 'just now'; var m = Math.floor(s / 60); if (m < 60) return m + ' min ago';
    var h = Math.floor(m / 60); if (h < 24) return h + (h === 1 ? ' hour ago' : ' hours ago');
    var d = Math.floor(h / 24); if (d < 7) return d + (d === 1 ? ' day ago' : ' days ago');
    try { return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); } catch (e) { return ''; } }

  /* ---------- share ---------- */
  function shareUrlFor(slug) { return location.origin + location.pathname + '#' + slug; }
  function toast(msg) {
    var t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
    document.body.appendChild(t); requestAnimationFrame(function () { t.classList.add('show'); });
    setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 250); }, 1800);
  }
  function openShare(slug) {
    var a = bySlug[slug]; if (!a) return;
    var url = shareUrlFor(slug), text = a.title;
    var enc = encodeURIComponent;
    var links = [
      { label: 'X', href: 'https://twitter.com/intent/tweet?url=' + enc(url) + '&text=' + enc(text) },
      { label: 'Facebook', href: 'https://www.facebook.com/sharer/sharer.php?u=' + enc(url) },
      { label: 'LinkedIn', href: 'https://www.linkedin.com/sharing/share-offsite/?url=' + enc(url) },
      { label: 'Email', href: 'mailto:?subject=' + enc(text) + '&body=' + enc(url) }
    ];
    var html = '<div class="dlg-card" style="max-width:440px">' +
      '<div class="dlg-head"><h3>Share this article</h3><button class="icon-btn" data-dlg-close="1">' + ICON.x + '</button></div>' +
      '<div class="dlg-body"><div class="share-url"><input readonly value="' + esc(url) + '" id="share-url-input"><button class="btn btn-primary btn-sm" data-copy-link="' + esc(url) + '">' + ICON.copy + ' Copy</button></div>' +
      '<div class="share-grid">' + links.map(function (l) { return '<a class="share-opt" href="' + l.href + '" target="_blank" rel="noopener">' + esc(l.label) + '</a>'; }).join('') +
      (navigator.share ? '<button class="share-opt" data-native-share="' + esc(slug) + '">More…</button>' : '') + '</div></div></div>';
    openDialog(html);
  }

  /* ---------- clippings + quote image ---------- */
  var CLIP_KEY = 'rsnews_clippings_v1';
  function getClippings() { return read(CLIP_KEY); }
  function saveClipping(c) { var l = read(CLIP_KEY); l.unshift(c); if (l.length > 100) l = l.slice(0, 100); write(CLIP_KEY, l); }
  function removeClipping(id) { write(CLIP_KEY, read(CLIP_KEY).filter(function (c) { return c.id !== id; })); }

  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function wrapText(ctx, text, maxW) {
    var words = text.split(/\s+/), lines = [], line = '';
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + ' ' + words[i] : words[i];
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = words[i]; } else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }
  // Elements never captured in a clip; block tags become their own line.
  var CLIP_SKIP = '.had, .ad, [data-ad-brand], [data-ad], figure, figcaption, .clip-hint, button, script, style, aside';
  var CLIP_BLOCK = { P:1,H1:1,H2:1,H3:1,H4:1,H5:1,H6:1,LI:1,BLOCKQUOTE:1,FIGCAPTION:1,DIV:1,SECTION:1,UL:1,OL:1,PRE:1,TABLE:1 };
  function clipBlocksToText(root) {
    var parts = [], buf = '';
    function flush() { var t = buf.replace(/\s+/g, ' ').trim(); if (t) parts.push(t); buf = ''; }
    function walk(node) {
      if (node.nodeType === 3) { buf += node.nodeValue || ''; return; }
      if (node.nodeType === 11) { node.childNodes.forEach(walk); return; } // DocumentFragment
      if (node.nodeType !== 1) return;
      if (node.tagName === 'BR') { buf += ' '; return; }
      if (CLIP_BLOCK[node.tagName]) { flush(); if (node.tagName === 'LI') buf = '• '; node.childNodes.forEach(walk); flush(); }
      else { node.childNodes.forEach(walk); }
    }
    walk(root); flush(); return parts.join('\n');
  }
  // Extract the selection as ad-free, block-separated text clamped to `container`.
  function extractClipText(sel, container) {
    var full = document.createRange(); full.selectNodeContents(container);
    var parts = [];
    for (var i = 0; i < sel.rangeCount; i++) {
      var r = sel.getRangeAt(i).cloneRange();
      if (r.compareBoundaryPoints(Range.START_TO_START, full) < 0) r.setStart(full.startContainer, full.startOffset);
      if (r.compareBoundaryPoints(Range.END_TO_END, full) > 0) r.setEnd(full.endContainer, full.endOffset);
      if (r.collapsed) continue;
      var frag = r.cloneContents();
      Array.prototype.forEach.call(frag.querySelectorAll(CLIP_SKIP), function (n) { n.remove(); });
      var t = clipBlocksToText(frag); if (t) parts.push(t);
    }
    return parts.join('\n').replace(/\n{2,}/g, '\n').trim();
  }
  function clampBlocks(blocks, max) {
    var out = [], used = 0;
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i]; if (used >= max) break;
      if (used + b.length <= max) { out.push(b); used += b.length; }
      else { out.push(b.slice(0, max - used).replace(/\s+\S*$/, '').trim() + '…'); break; }
    }
    return out;
  }
  // Quote-image theming (mirrors the app): dark / light / RS.
  var CLIPTHEME_KEY = 'rsnews_cliptheme_v1';
  var clipTheme = (function () { try { var t = localStorage.getItem(CLIPTHEME_KEY); return (t === 'light' || t === 'rs' || t === 'dark') ? t : 'dark'; } catch (e) { return 'dark'; } })();
  var QUOTE_PALETTES = {
    dark:  { bg1: '#2b333d', bg2: '#141a21', accent: '#E97D34', quoteMark: 'rgba(233,125,52,.92)', quote: '#f4f1ea', footerText: '#ffffff', footerSub: 'rgba(255,255,255,.6)', divider: 'rgba(255,255,255,.16)', logoBg: '#E97D34', logoText: '#ffffff', footerBg: null, logo: 'dark', parchment: false },
    light: { bg1: '#fbf7ee', bg2: '#efe6d4', accent: '#E97D34', quoteMark: 'rgba(233,125,52,.92)', quote: '#2b333c', footerText: '#2b333c', footerSub: 'rgba(43,51,60,.55)', divider: 'rgba(43,51,60,.14)', logoBg: '#E97D34', logoText: '#ffffff', footerBg: null, logo: 'light', parchment: false },
    rs:    { bg1: '#f7edd8', bg2: '#f2e6cb', accent: '#3d2a19', quoteMark: 'rgba(61,42,25,.4)', quote: '#3d2a19', footerText: '#f7edd8', footerSub: 'rgba(247,237,216,.72)', divider: 'rgba(61,42,25,.2)', logoBg: '#f7edd8', logoText: '#2b333c', footerBg: '#2b333c', logo: 'dark', parchment: true }
  };
  var Q_LOGO_LIGHT = 'brand/rsnews-hub-logo-light.png', Q_LOGO_DARK = 'brand/rsnews-hub-logo-dark.png', Q_PARCHMENT = 'textures/rs-cream.webp';
  var QIMG = {};
  function qimg(src) { var i = QIMG[src]; if (!i) { i = new Image(); i.src = src; QIMG[src] = i; } return i; }
  function qready(i) { return !!(i && i.complete && i.naturalWidth > 0); }
  function drawCover(ctx, img, x, y, w, h) { var ir = img.naturalWidth / img.naturalHeight, r = w / h; var dw = ir > r ? h * ir : w, dh = ir > r ? h : w / ir; ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh); }
  var quoteAssetsReady = false;
  function preloadQuoteAssets(cb) {
    var srcs = [Q_LOGO_LIGHT, Q_LOGO_DARK, Q_PARCHMENT], n = srcs.length, done = 0;
    function tick() { if (++done >= n) { quoteAssetsReady = true; if (cb) cb(); } }
    srcs.forEach(function (s) { var i = qimg(s); if (qready(i)) { tick(); return; } i.onload = tick; i.onerror = tick; });
  }
  // Repaint the clippings once (when the logo/parchment finish loading).
  function ensureQuoteAssets(cb) { if (quoteAssetsReady) return; preloadQuoteAssets(cb); }
  function makeQuoteImage(o) {
    var W = 1080, H = 1080, pad = 96, canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H; var ctx = canvas.getContext('2d');
    var p = QUOTE_PALETTES[o.theme || 'dark'] || QUOTE_PALETTES.dark;
    var parch = p.parchment ? qimg(Q_PARCHMENT) : null;
    if (p.parchment && qready(parch)) { ctx.fillStyle = p.bg1; ctx.fillRect(0, 0, W, H); drawCover(ctx, parch, 0, 0, W, H); }
    else { var g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, p.bg1); g.addColorStop(1, p.bg2); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    ctx.fillStyle = p.accent; ctx.fillRect(pad, pad, 96, 12);
    ctx.textBaseline = 'top'; ctx.textAlign = 'left';
    ctx.fillStyle = p.quoteMark; ctx.font = '900 200px Georgia, serif';
    ctx.fillText('“', pad - 12, pad - 8);
    var blocks = clampBlocks((o.quote || '').split('\n').map(function (s) { return s.replace(/\s+/g, ' ').trim(); }).filter(Boolean), 340);
    if (!blocks.length) blocks = [''];
    var disp = blocks.map(function (b, i) { return (i === 0 ? '“' + b : b) + (i === blocks.length - 1 ? '”' : ''); });
    var maxW = W - pad * 2, size = 62, wrapped = [], lineH = 0, blockGap = 0;
    var quoteTop = pad + 210, avail = (H - 330) - quoteTop;
    while (size >= 26) {
      ctx.font = '700 ' + size + 'px ui-sans-serif, system-ui, Arial, sans-serif';
      lineH = size * 1.3; blockGap = Math.round(size * 0.6);
      wrapped = disp.map(function (b) { return wrapText(ctx, b, maxW); });
      var total = wrapped.reduce(function (sum, ls, i) { return sum + ls.length * lineH + (i ? blockGap : 0); }, 0);
      if (total <= avail) break; size -= 3;
    }
    ctx.fillStyle = p.quote; ctx.font = '700 ' + size + 'px ui-sans-serif, system-ui, Arial, sans-serif';
    var y = quoteTop; wrapped.forEach(function (ls, i) { if (i) y += blockGap; ls.forEach(function (ln) { ctx.fillText(ln, pad, y); y += lineH; }); });
    var by = H - 300;
    if (p.footerBg) { ctx.fillStyle = p.footerBg; ctx.fillRect(0, by, W, H - by); }
    else { ctx.strokeStyle = p.divider; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(pad, by); ctx.lineTo(W - pad, by); ctx.stroke(); }
    var logo = qimg(p.logo === 'light' ? Q_LOGO_LIGHT : Q_LOGO_DARK), urlY;
    if (qready(logo)) { var lh = 82, lw = lh * (logo.naturalWidth / logo.naturalHeight); ctx.drawImage(logo, pad, by + 34, lw, lh); urlY = by + 34 + lh + 8; }
    else {
      ctx.fillStyle = p.logoBg; roundRect(ctx, pad, by + 34, 68, 68, 15); ctx.fill();
      ctx.fillStyle = p.logoText; ctx.font = '900 32px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('RS', pad + 34, by + 34 + 36); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillStyle = p.footerText; ctx.font = '800 32px ui-sans-serif, Arial'; ctx.fillText('RSNews Hub', pad + 86, by + 40);
      ctx.fillStyle = p.footerSub; ctx.font = '500 24px ui-sans-serif, Arial'; ctx.fillText(o.url || '', pad + 86, by + 78); urlY = -1;
    }
    if (urlY >= 0) { ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = p.footerSub; ctx.font = '500 24px ui-sans-serif, Arial'; ctx.fillText(o.url || '', pad, urlY); }
    var ty = by + 168; ctx.fillStyle = p.footerText; ctx.font = '800 34px ui-sans-serif, Arial';
    var titleLines = wrapText(ctx, o.title || '', maxW).slice(0, 2);
    titleLines.forEach(function (l, i) { ctx.fillText(l, pad, ty + i * 42); });
    if (o.author) { ctx.fillStyle = p.footerSub; ctx.font = '500 27px ui-sans-serif, Arial';
      ctx.fillText('— ' + o.author, pad, ty + titleLines.length * 42 + 8); }
    return canvas.toDataURL('image/png');
  }
  function clipFileName(o) { return 'rsnews-clip-' + (o.slug || 'quote') + '.png'; }
  function downloadDataUrl(dataUrl, name) {
    var a = document.createElement('a'); a.href = dataUrl; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  }
  function downloadImage(src, name) {
    if (src.indexOf('data:') === 0) { downloadDataUrl(src, name); return; }
    fetch(src).then(function (r) { return r.blob(); }).then(function (b) {
      var u = URL.createObjectURL(b); downloadDataUrl(u, name); setTimeout(function () { URL.revokeObjectURL(u); }, 5000);
    }).catch(function () { downloadDataUrl(src, name); });
  }
  function comicFileName(title) { return 'backroom-humor-' + (title || 'comic').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') + '.jpg'; }
  function clipShareText(o) {
    return '“' + (o.quote || '') + '” — ' + (o.title || '') + '\n' + shareUrlFor(o.slug || '');
  }
  function openClip(text, slug) {
    // Collapse spaces/tabs but KEEP newlines so block breaks (headings, bullets)
    // survive into the quote image.
    var a = bySlug[slug] || {};
    text = (text || '').split('\n').map(function (s) { return s.replace(/[ \t]+/g, ' ').trim(); }).filter(Boolean).join('\n');
    if (text.replace(/\s/g, '').length < 4) { toast('Select some text first'); return; }
    var o = { quote: text, title: a.title || '', author: a.author || '', url: (location.host + location.pathname + '#' + (slug || '')), slug: slug, theme: clipTheme };
    var img = makeQuoteImage(o);
    var html = '<div class="dlg-card" style="max-width:560px">' +
      '<div class="dlg-head"><h3>News clipping</h3><button class="icon-btn" data-dlg-close="1">' + ICON.x + '</button></div>' +
      '<div class="dlg-body"><img class="clip-preview" src="' + img + '" alt="Quote image">' +
      '<div class="dlg-actions">' +
      '<button class="btn btn-primary btn-sm" data-clip-save="1">' + ICON.clip + ' Save clip</button>' +
      '<button class="btn btn-outline btn-sm" data-clip-download="1">' + ICON.download + ' Download image</button>' +
      '<button class="btn btn-outline btn-sm" data-clip-copy="1">' + ICON.copy + ' Copy quote</button>' +
      '</div><p class="dlg-note">Not saved yet — tap <b>Save clip</b> to keep it in your Clippings.</p></div></div>';
    openDialog(html, { img: img, o: o, text: text, slug: slug, saved: false });
  }

  /* ---------- generic dialog ---------- */
  var dialogData = null;
  function openDialog(html, data) {
    dialogData = data || null;
    var host = el('dialog-host');
    host.innerHTML = '<div class="dlg"><div class="dlg-backdrop" data-dlg-close="1"></div>' + html + '</div>';
  }
  function closeDialog() { el('dialog-host').innerHTML = ''; dialogData = null; }

  var stripExpanded = false, stripConfirmClear = false;
  function renderStrip() {
    var wrap = el('strip'); if (!wrap) return;
    var list = read(READ_KEY);
    if (!list.length) { stripConfirmClear = false; wrap.innerHTML = ''; return; }
    var chips = list.map(function (s) {
      return '<div class="chip"><span data-open="' + esc(s.slug) + '" style="display:flex;align-items:center;gap:7px;min-width:0">' +
        '<span style="color:var(--orange);flex-shrink:0;display:flex">' + ICON.pinMd + '</span><span class="chip-title">' + esc(s.title) + '</span></span>' +
        '<span class="chip-x" data-unread="' + esc(s.id) + '" title="Unpin">' + ICON.x + '</span></div>';
    }).join('');
    var clear = stripConfirmClear
      ? '<span class="strip-clear-confirm">Clear all? <button class="scy" data-strip-clear-yes="1">Yes</button><button class="scn" data-strip-clear-no="1">No</button></span>'
      : '<button class="strip-clear" data-strip-clear="1" title="Clear all pinned">Clear all</button>';
    wrap.innerHTML = '<div class="strip-wrap"><div class="strip' + (stripExpanded ? ' expanded' : '') + '"><div class="strip-inner">' +
      '<button class="strip-icon-btn" data-strip-expand="1" title="' + (stripExpanded ? 'Collapse' : 'Expand — show all titles') + '">' + (stripExpanded ? ICON.collapseLR : ICON.expandLR) + '</button>' +
      '<span class="strip-label">' + ICON.pinMd + ' Pinned</span><div class="chips">' + chips + '</div>' +
      '<div class="strip-clear-wrap">' + clear + '</div></div></div></div>';
  }
  function syncButtons() {
    document.querySelectorAll('[data-fav]').forEach(function (b) {
      var a = bySlug[b.getAttribute('data-fav')]; if (!a) return; var on = isFav(a.id); b.classList.toggle('on', on);
      if (b.getAttribute('data-variant') === 'pill') b.innerHTML = (on ? ICON.starFill : ICON.star) + (on ? ' Favorited' : ' Favorite');
      else b.innerHTML = on ? ICON.starFill : ICON.star;
    });
    document.querySelectorAll('[data-read]').forEach(function (b) {
      var a = bySlug[b.getAttribute('data-read')]; if (!a) return; var on = isRead(a.id); b.classList.toggle('on', on);
      if (b.getAttribute('data-variant') === 'pill') b.innerHTML = (on ? ICON.bookFill : ICON.book) + (on ? ' Pinned' : ' Pin');
      else b.innerHTML = on ? ICON.bookFill : ICON.book;
    });
  }

  /* ---------- builders ---------- */
  function catBadge(c) { return c ? '<span class="badge" style="background:' + c.color + '22;color:' + c.color + '">' + esc(c.name) + '</span>' : ''; }
  function acts(slug, cls) { cls = cls || 'iconbtn';
    return '<button class="' + cls + '" data-fav="' + esc(slug) + '" title="Favorite" aria-label="Favorite">' + ICON.star + '</button>' +
      '<button class="' + cls + '" data-read="' + esc(slug) + '" title="Read later (pins to top)" aria-label="Read later">' + ICON.book + '</button>'; }

  function articleBlock(a, opts) {
    opts = opts || {};
    var accent = a.category ? a.category.color : 'var(--orange)';
    // Uniform cover slot: image when present, else a branded placeholder — so a
    // carousel never mixes image + no-image cards.
    var top = a.coverImage ? '<img src="' + esc(a.coverImage) + '" alt="" loading="lazy" style="aspect-ratio:16/9;width:100%;object-fit:cover">'
      : '<div class="ablock-ph"><span class="accent" style="background:' + accent + '"></span>RS</div>';
    return '<article class="ablock' + (opts.sm ? ' sm' : '') + '"><div class="acts">' + acts(a.slug) + '</div>' + top +
      '<a href="#' + esc(a.slug) + '" data-open="' + esc(a.slug) + '" class="body"><div>' + catBadge(a.category) + '</div>' +
      '<h3>' + esc(a.title) + '</h3>' +
      '<div class="meta"><span>' + fmtDate(a.publishedAt) + '</span><span>' + ICON.clock + (a.readMinutes || 1) + ' min</span><span>' + ICON.eye + (a.views || 0) + '</span></div>' +
      '</a></article>';
  }
  function latestRow(a) {
    return '<div class="lrow" data-open="' + esc(a.slug) + '"><div class="acts">' + acts(a.slug) + '</div>' +
      '<div class="lbody"><div>' + catBadge(a.category) + '</div><h3>' + esc(a.title) + '</h3>' +
      '<div class="lmeta"><span>' + fmtDate(a.publishedAt) + '</span><span>' + ICON.clock + (a.readMinutes || 1) + ' min</span><span>' + ICON.eye + (a.views || 0) + '</span></div></div></div>';
  }
  function orangeItem(a) {
    return '<div class="oitem" data-open="' + esc(a.slug) + '"><span class="ocat">' + (a.category ? esc(a.category.name) : 'News') + '</span>' +
      '<h3>' + esc(a.title) + '</h3><div class="ometa"><span>' + fmtDate(a.publishedAt) + '</span><span>' + (a.readMinutes || 1) + ' min read</span></div>' +
      '<div class="orange-acts">' + acts(a.slug, 'oiconbtn') + '</div></div>';
  }
  function ad(kind) { var m = { leaderboard: '728 × 90', rectangle: '300 × 250', inarticle: 'In-article' }[kind] || '';
    return '<div class="ad ad-' + kind + '"><div class="ad-inner"><span class="ad-label">Advertisement</span><span class="ad-size">' + m + '</span></div></div>'; }

  /* ---------- Industry News (curated external links) ---------- */
  var ICON_EXT = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>';
  var ICON_PAPER = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h13a1 1 0 0 1 1 1v14a2 2 0 0 0 2 2H5a2 2 0 0 1-2-2V5a1 1 0 0 1 1-1Z"/><path d="M18 8h2a1 1 0 0 1 1 1v10a2 2 0 0 1-2 2M8 8h6M8 12h6M8 16h4"/></svg>';
  function linkSource(url, source) {
    if (source && source.trim()) return source.trim();
    try { return new URL(/^https?:\/\//i.test(url) ? url : 'https://' + url).hostname.replace(/^www\./, ''); }
    catch (e) { return (url || '').replace(/^https?:\/\//i, '').replace(/^www\./, '').split('/')[0]; }
  }
  function shortSource(s) { return s.length > 22 ? s.slice(0, 21) + '…' : s; }
  function postedLabel(d) { var dt = new Date(d); return dt.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
  function industryRows() {
    return INDUSTRY.map(function (l) {
      return '<a class="ind-row" href="' + esc(l.url) + '" target="_blank" rel="noopener noreferrer">' +
        '<span class="ind-ico">' + ICON_EXT + '</span>' +
        '<span class="ind-main"><span class="ind-title">' + esc(l.title) + '</span>' +
        '<span class="ind-meta"><span class="ind-src">' + esc(shortSource(linkSource(l.url, l.source))) + '</span>' +
        '<span>' + esc(postedLabel(l.postedAt)) + '</span>' +
        '<span class="ind-views">' + ICON.eye + (l.views || 0) + '</span></span></span></a>';
    }).join('');
  }
  function industryModule() {
    return '<section class="module orange ind-orange">' +
      '<button class="ind-head" data-industry-open="1" title="Expand Industry News">' + ICON_PAPER + '<span class="ind-bigtitle">Industry News</span></button>' +
      '<p class="ind-sub">Curated links — tap the title to expand</p>' +
      '<div class="ind-scroll">' + industryRows() + '</div></section>';
  }
  function industryDialogRows() {
    return INDUSTRY.slice(0, 50).map(function (l) {
      return '<a class="ind-mrow ind-reveal" href="' + esc(l.url) + '" target="_blank" rel="noopener noreferrer">' +
        '<span class="ind-mico">' + ICON_EXT + '</span>' +
        '<span class="ind-mmain"><span class="ind-mtitle">' + esc(l.title) + '</span>' +
        '<span class="ind-mmeta"><span class="ind-msrc">' + esc(linkSource(l.url, l.source)) + '</span>' +
        '<span>' + esc(postedLabel(l.postedAt)) + '</span>' +
        '<span class="ind-views">' + ICON.eye + (l.views || 0) + '</span></span></span></a>';
    }).join('');
  }
  function openIndustryDialog() {
    var count = Math.min(INDUSTRY.length, 50);
    var html = '<div class="dlg-card ind-modal">' +
      '<div class="ind-modal-head"><div><h3 class="ind-modal-title">' + ICON_PAPER + ' Industry News</h3>' +
      '<p class="ind-modal-sub">Most recent ' + count + ' &middot; curated by our team</p></div>' +
      '<div class="ind-modal-actions"><a class="btn btn-outline btn-sm" href="#" data-industry-archive="1">View archive</a>' +
      '<button class="icon-btn" data-dlg-close="1">' + ICON.x + '</button></div></div>' +
      '<div class="ind-modal-body" id="ind-modal-body">' + industryDialogRows() +
      '<div class="ind-modal-foot"><a href="#" data-industry-archive="1" class="link-orange">See the full Industry News archive &rarr;</a></div></div></div>';
    openDialog(html, null);
    setupIndustryReveal();
  }
  function setupIndustryReveal() {
    var body = document.getElementById('ind-modal-body');
    if (!body) return;
    var els = body.querySelectorAll('.ind-reveal');
    if (!('IntersectionObserver' in window)) { els.forEach(function (e) { e.classList.add('in'); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { root: body, rootMargin: '0px 0px -8% 0px', threshold: 0.02 });
    els.forEach(function (e) { io.observe(e); });
  }
  /* ---------- Backroom Humor comics ---------- */
  function currentComic() {
    var actives = COMICS.filter(function (c) { return c.active; });
    if (!actives.length) return null;
    return actives[Math.floor(Math.random() * actives.length)];
  }
  function comicModule() {
    var c = currentComic();
    if (!c) return '';
    return '<section class="comic-section"><div class="module-head"><h2 class="comic-h2">Backroom Humor</h2>' +
      '<a class="link-orange" href="#" data-comics-archive="1">View all comics</a></div>' +
      '<div class="comic-frame"><img src="' + esc(c.image) + '" alt="' + esc(c.title) + '"></div></section>';
  }
  var lightboxComic = null;
  function openComicLightbox(src, alt) {
    lightboxComic = { src: src, title: alt || '' };
    var host = el('dialog-host');
    host.innerHTML = '<div class="comic-lb"><div class="comic-lb-bg" data-lb-close="1"></div>' +
      '<button class="comic-lb-x" data-lb-close="1" aria-label="Close">' + ICON.x + '</button>' +
      '<div class="comic-lb-inner"><img src="' + esc(src) + '" alt="' + esc(alt || '') + '">' +
      '<div class="comic-lb-acts">' +
      '<button class="comic-lb-btn" data-comic-dl="1">' + ICON.download + ' Download image</button>' +
      '<button class="comic-lb-save" data-comic-save="1">' + ICON.clip + ' Save to clippings</button>' +
      '</div></div></div>';
    document.body.classList.add('modal-open');
  }
  function closeComicLightbox() { el('dialog-host').innerHTML = ''; document.body.classList.remove('modal-open'); lightboxComic = null; }
  function renderComicsArchive() {
    var h = '<div class="content"><section class="module"><div class="module-head"><h2>😄 Backroom Humor</h2><a class="link-orange" href="#" data-home="1">Home</a></div>';
    if (!COMICS.length) { h += '<p style="color:var(--muted);margin:0">No comics yet.</p>'; }
    h += '<div class="comic-grid">' + COMICS.map(function (c) {
      return '<figure class="comic-card"><img src="' + esc(c.image) + '" alt="' + esc(c.title) + '"><figcaption><span class="comic-title">' + esc(c.title) + '</span><span class="comic-date">' + esc(postedLabel(c.postedAt)) + '</span></figcaption></figure>';
    }).join('') + '</div></section></div>';
    el('main').innerHTML = h; window.scrollTo(0, 0);
  }

  /* ---------- Reader poll ---------- */
  var ICON_CHART = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><rect x="7" y="11" width="3" height="6" rx="0.5"/><rect x="12" y="7" width="3" height="10" rx="0.5"/><rect x="17" y="13" width="3" height="4" rx="0.5"/></svg>';
  function activePoll() { return POLLS.filter(function (p) { return p.active; })[0] || null; }
  function pollVoted(id) { try { return localStorage.getItem('rsnews_poll_' + id); } catch (e) { return null; } }
  function pollModule(poll) {
    var voted = pollVoted(poll.id);
    var total = poll.options.reduce(function (n, o) { return n + o.votes; }, 0);
    var isClosed = poll.closesAt && new Date(poll.closesAt) < new Date();
    var showRes = !!voted || isClosed;
    var opts = poll.options.map(function (o) {
      if (!showRes) { return '<button class="poll-opt" data-poll-vote="' + esc(poll.id) + ':' + esc(o.id) + '">' + esc(o.label) + '</button>'; }
      var pct = total ? Math.round(o.votes / total * 100) : 0;
      var mine = voted === o.id;
      return '<div class="poll-res"><span class="poll-bar" style="width:' + pct + '%"></span>' +
        '<span class="poll-res-in"><span class="poll-lbl">' + (mine ? ICON.check : '') + esc(o.label) + '</span><span class="poll-pct">' + pct + '%</span></span></div>';
    }).join('');
    return '<section class="module poll-card">' +
      '<div class="poll-head"><span class="poll-badge">Poll</span><span class="poll-sub">Reader poll of the month</span></div>' +
      '<h2 class="poll-q">' + esc(poll.question) + '</h2>' +
      '<div class="poll-opts">' + opts + '</div>' +
      '<div class="poll-foot">' + total + ' vote' + (total === 1 ? '' : 's') + (isClosed ? ' &middot; closed' : (voted ? ' &middot; thanks for voting!' : '')) + '</div>' +
      '<a class="btn btn-outline btn-sm poll-view" href="#" data-polls-archive="1">View latest polls</a></section>';
  }
  function castPollVote(pollId, optionId) {
    if (pollVoted(pollId)) return;
    var poll = POLLS.filter(function (p) { return p.id === pollId; })[0]; if (!poll) return;
    var opt = poll.options.filter(function (o) { return o.id === optionId; })[0]; if (!opt) return;
    opt.votes += 1;
    try { localStorage.setItem('rsnews_poll_' + pollId, optionId); } catch (e) {}
    var card = document.querySelector('.poll-card');
    if (card) { var tmp = document.createElement('div'); tmp.innerHTML = pollModule(poll); card.replaceWith(tmp.firstChild); }
  }
  /* ---------- Pop Quiz ---------- */
  var ICON_CLOCK = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
  function quizDone(id) { try { return !!localStorage.getItem('rsnews_quiz_' + id); } catch (e) { return false; } }
  function quizLeftMs() { return QUIZ ? new Date(QUIZ.closesAt).getTime() - Date.now() : 0; }
  function fmtQuizLeft(ms) {
    if (ms <= 0) return 'Closed';
    var h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
    if (h >= 1) return h + 'h ' + m + 'm left';
    var s = Math.floor((ms % 60000) / 1000);
    return m >= 1 ? m + 'm ' + s + 's left' : s + 's left';
  }
  function quizCard() {
    if (!QUIZ) return '';
    var left = quizLeftMs(), closed = left <= 0, done = quizDone(QUIZ.id);
    var timer = '<span class="quiz-timer' + (closed ? ' is-closed' : '') + '" data-quiz-timer="1">' + ICON_CLOCK + ' ' + fmtQuizLeft(left) + '</span>';
    var body;
    if (done) {
      body = '<div class="quiz-note quiz-note-done"><span class="quiz-note-h">' + ICON.check + ' Answer submitted</span>' +
        '<span class="quiz-note-sub">We&rsquo;ll share the results and answers in an article soon.</span></div>';
    } else if (closed) {
      body = '<div class="quiz-note">This quiz has closed. Watch for the results article!</div>';
    } else {
      body = '<button class="btn btn-primary quiz-take" data-quiz-open="1">Take the quiz</button>';
    }
    return '<section class="module quiz-card">' +
      '<div class="quiz-head"><span class="quiz-badge">Pop Quiz</span>' + timer + '</div>' +
      '<h2 class="quiz-title">' + esc(QUIZ.title) + '</h2>' +
      '<p class="quiz-meta">' + QUIZ.questions.length + ' question' + (QUIZ.questions.length === 1 ? '' : 's') + ' &middot; multiple choice</p>' +
      body + '</section>';
  }
  function openQuizModal() {
    if (!QUIZ || quizDone(QUIZ.id) || quizLeftMs() <= 0) return;
    var qs = QUIZ.questions.map(function (q, qi) {
      var opts = q.options.map(function (o) {
        return '<label class="quiz-opt"><input type="radio" name="' + esc(q.id) + '" value="' + esc(o.id) + '" data-quiz-radio="1">' + esc(o.label) + '</label>';
      }).join('');
      return '<fieldset class="quiz-fs"><legend class="quiz-legend">' + (qi + 1) + '. ' + esc(q.prompt) + '</legend><div class="quiz-opts">' + opts + '</div></fieldset>';
    }).join('');
    var html = '<div class="quiz-modal">' +
      '<div class="quiz-modal-head"><div><span class="quiz-badge">Pop Quiz</span>' +
      '<h3 class="quiz-modal-title">' + esc(QUIZ.title) + '</h3>' +
      '<p class="quiz-modal-timer">' + ICON_CLOCK + ' ' + fmtQuizLeft(quizLeftMs()) + '</p></div>' +
      '<button class="quiz-x" data-dlg-close="1" aria-label="Close">' + ICON.x + '</button></div>' +
      '<div class="quiz-body">' + qs + '</div>' +
      '<p class="quiz-err" data-quiz-err="1" style="display:none"></p>' +
      '<button class="btn btn-primary quiz-submit" data-quiz-submit="1">Submit answers</button>' +
      '<p class="quiz-fine">One submission per device. Correct answers revealed later.</p></div>';
    openDialog(html, null);
  }
  function submitQuiz() {
    if (!QUIZ) return;
    var answered = QUIZ.questions.every(function (q) { return document.querySelector('input[name="' + q.id + '"]:checked'); });
    var errEl = document.querySelector('[data-quiz-err]');
    if (!answered) { if (errEl) { errEl.textContent = 'Please answer every question.'; errEl.style.display = 'block'; } return; }
    // Static preview has no backend — record locally so the card flips to "submitted".
    try { localStorage.setItem('rsnews_quiz_' + QUIZ.id, '1'); } catch (e) {}
    closeDialog();
    var card = document.querySelector('.quiz-card');
    if (card) { var tmp = document.createElement('div'); tmp.innerHTML = quizCard(); card.replaceWith(tmp.firstChild); }
    toast('Answer submitted');
  }
  // Keep the little countdown ticking on the homepage card.
  setInterval(function () {
    if (!QUIZ) return;
    document.querySelectorAll('[data-quiz-timer]').forEach(function (elm) {
      var left = quizLeftMs();
      elm.innerHTML = ICON_CLOCK + ' ' + fmtQuizLeft(left);
      if (left <= 0) elm.classList.add('is-closed');
    });
  }, 1000);

  function industryPollRow() {
    var poll = activePoll();
    var ind = INDUSTRY.length ? industryModule() : '';
    var pol = poll ? pollModule(poll) : '';
    var quiz = quizCard();
    var aside = (pol || quiz) ? '<div class="ind-aside">' + pol + quiz + '</div>' : '';
    if (ind && aside) return '<div class="ind-poll-row">' + ind + aside + '</div>';
    return ind || aside;
  }
  function renderPollsArchive() {
    var h = '<div class="content"><section class="module"><div class="module-head"><h2 class="ind-h2">' + ICON_CHART + ' Polls</h2><a class="link-orange" href="#" data-home="1">Home</a></div>';
    if (!POLLS.length) { h += '<p style="color:var(--muted);margin:0">No polls yet.</p>'; }
    POLLS.forEach(function (poll) {
      var total = poll.options.reduce(function (n, o) { return n + o.votes; }, 0);
      var isClosed = poll.closesAt && new Date(poll.closesAt) < new Date();
      h += '<div class="poll-arch"><div class="poll-arch-head"><h3>' + esc(poll.question) + '</h3>' +
        (poll.active ? '<span class="badge poll-badge-live">Live</span>' : (isClosed ? '<span class="badge">Closed</span>' : '<span class="badge">Past</span>')) + '</div>' +
        poll.options.map(function (o) { var pct = total ? Math.round(o.votes / total * 100) : 0;
          return '<div class="poll-res"><span class="poll-bar" style="width:' + pct + '%"></span><span class="poll-res-in"><span class="poll-lbl">' + esc(o.label) + '</span><span class="poll-pct">' + pct + '%</span></span></div>'; }).join('') +
        '<div class="poll-foot">' + total + ' total votes</div></div>';
    });
    h += '</section></div>';
    el('main').innerHTML = h; window.scrollTo(0, 0);
  }
  function renderIndustryArchive() {
    closeDialog();
    var byMonth = {};
    INDUSTRY.forEach(function (l) {
      var k = new Date(l.postedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      (byMonth[k] = byMonth[k] || []).push(l);
    });
    var h = '<div class="content"><section class="module"><div class="module-head"><h2 class="ind-h2">' + ICON_PAPER + ' Industry News archive</h2>' +
      '<a class="link-orange" href="#" data-home="1">Home</a></div>';
    if (!INDUSTRY.length) { h += '<p style="color:var(--muted);margin:0">No industry links yet.</p>'; }
    Object.keys(byMonth).forEach(function (m) {
      h += '<h3 style="font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:800;margin:22px 0 10px">' + esc(m) + '</h3>' +
        '<div class="ind-arch">' + byMonth[m].map(function (l) {
          return '<a class="ind-row" href="' + esc(l.url) + '" target="_blank" rel="noopener noreferrer">' +
            '<span class="ind-ico">' + ICON_EXT + '</span>' +
            '<span class="ind-main"><span class="ind-title">' + esc(l.title) + '</span>' +
            '<span class="ind-meta"><span class="ind-src">' + esc(linkSource(l.url, l.source)) + '</span>' +
            '<span>' + esc(postedLabel(l.postedAt)) + '</span>' +
            '<span class="ind-views">' + ICON.eye + (l.views || 0) + '</span></span></span></a>';
        }).join('') + '</div>';
    });
    h += '</section></div>';
    el('main').innerHTML = h; window.scrollTo(0, 0);
  }

  /* ---------- smart in-article ads ----------
     Inside an article we must never show a competitor's ad (an article about
     PostalMate must never carry a ShipRite ad). Each ad has a competitive
     "group"; we scan the article for brands and drop any ad whose group is
     represented by a rival brand. Neutral house ads (group:null) are safe. */
  var AD_BRANDS = [
    { name: 'PackageHub', group: 'shipping-software', aliases: ['packagehub', 'package hub', 'pack and ship', 'pack & ship', 'pack-and-ship'] },
    { name: 'PackWise', group: 'packing-supplies', aliases: ['packwise', 'pack wise', 'packing supplies', 'bubble wrap'] },
    { name: 'PrintPilot', group: 'printing', aliases: ['printpilot', 'print pilot', 'business cards', 'flyers'] },
    { name: 'PostalMate', group: 'shipping-software', aliases: ['postalmate', 'postal mate'] },
    { name: 'ShipRite', group: 'shipping-software', aliases: ['shiprite', 'ship-rite', 'ship rite'] },
    { name: 'Stamps.com', group: 'shipping-software', aliases: ['stamps.com', 'stamps .com'] },
    { name: 'Endicia', group: 'shipping-software', aliases: ['endicia'] },
    { name: 'AWS', group: 'cloud', aliases: ['aws', 'amazon web services'] },
    { name: 'Azure', group: 'cloud', aliases: ['azure', 'microsoft azure'] },
    { name: 'Google Cloud', group: 'cloud', aliases: ['google cloud', 'gcp'] },
    { name: 'Stripe', group: 'payments', aliases: ['stripe'] },
    { name: 'Square', group: 'payments', aliases: ['square payments', 'square pos'] },
    { name: 'PayPal', group: 'payments', aliases: ['paypal'] }
  ];
  var HOUSE_ADS = [
    { id: 'packagehub', brand: 'PackageHub', group: 'shipping-software', label: 'Pack & ship network', headline: 'PackageHub Business Centers — solutions for independent pack & ship stores.', cta: 'Learn more', href: '#', accent: '#1f3a5f', imageWide: 'ads/packagehub-banner.png', imageRect: 'ads/packagehub-rect.png' },
    { id: 'packwise', brand: 'PackWise', group: 'packing-supplies', label: 'Packing supplies', headline: 'PackWise — bubble wrap, tape, labels and everything to pack, ship and deliver with confidence.', cta: 'Shop now', href: '#', accent: '#4e8a2e', imageWide: 'ads/packwise-banner.png', imageRect: 'ads/packwise-rect.png' },
    { id: 'printpilot', brand: 'PrintPilot', group: 'printing', label: 'Printing', headline: 'PrintPilot Solutions — business cards, flyers, labels, signs & more.', cta: 'Get started', href: '#', accent: '#6b2fb3', imageWide: 'ads/printpilot-banner.png', imageRect: 'ads/printpilot-rect.png' },
    { id: 'postalmate', brand: 'PostalMate', group: 'shipping-software', label: 'Shipping & POS software', headline: 'PostalMate — all-in-one shipping, POS & mailbox management for retail counters.', cta: 'Start free trial', href: '#', accent: '#2f6f4f' },
    { id: 'shiprite', brand: 'ShipRite', group: 'shipping-software', label: 'Shipping software', headline: 'ShipRite — multi-carrier shipping and store management, built for pack-and-ship stores.', cta: 'Book a demo', href: '#', accent: '#2b5a86' },
    { id: 'stripe', brand: 'Stripe', group: 'payments', label: 'Payments', headline: 'Stripe — accept payments and grow revenue with a few lines of code.', cta: 'Get started', href: '#', accent: '#5a54d6' },
    { id: 'rsnews-pro', brand: 'RSNews Pro', group: null, label: 'RSNews Hub', headline: 'Read faster with RSNews Pro — ad-free articles, offline clippings, and daily digests.', cta: 'Upgrade', href: '#', accent: '#E97D34' },
    { id: 'clouddesk', brand: 'CloudDesk', group: null, label: 'Support software', headline: 'CloudDesk — the helpdesk your team will actually enjoy using.', cta: 'Try it free', href: '#', accent: '#2b7a8c' },
    { id: 'brewcrate', brand: 'BrewCrate', group: null, label: 'Coffee club', headline: 'BrewCrate — freshly-roasted specialty coffee, delivered to your desk monthly.', cta: 'Shop now', href: '#', accent: '#8a5a2b' },
    { id: 'ledgerlite', brand: 'LedgerLite', group: null, label: 'Accounting', headline: 'LedgerLite — simple bookkeeping and invoicing for small businesses.', cta: 'Learn more', href: '#', accent: '#4a6b8a' }
  ];
  function adNormalize(s) { return ' ' + (s || '').toLowerCase().replace(/<[^>]*>/g, ' ').replace(/[^a-z0-9. ]+/g, ' ').replace(/\s+/g, ' ') + ' '; }
  function detectBrandMentions(text) {
    var hay = adNormalize(text), out = [];
    AD_BRANDS.forEach(function (b) {
      if (b.aliases.some(function (a) { return hay.indexOf(' ' + a + ' ') >= 0 || hay.indexOf(' ' + a + '.') >= 0 || hay.indexOf(' ' + a + ',') >= 0; })) out.push({ group: b.group, brand: b.name });
    });
    return out;
  }
  function adConflicts(adObj, mentions) {
    if (!adObj.group) return false;
    return mentions.some(function (m) { return m.group === adObj.group && m.brand.toLowerCase() !== adObj.brand.toLowerCase(); });
  }
  function adSeed(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function pickInArticleAd(ads, text, slotSeed) {
    var mentions = detectBrandMentions(text);
    var safe = ads.filter(function (a) { return !adConflicts(a, mentions); });
    if (!safe.length) return null;
    // Prefer ads relevant to the topic; otherwise any safe ad (a safe ad names
    // no competitor present in the article).
    var relevant = safe.filter(function (a) { return a.group && mentions.some(function (m) { return m.group === a.group && m.brand.toLowerCase() === a.brand.toLowerCase(); }); });
    var pool = relevant.length ? relevant : safe;
    return pool[adSeed(slotSeed) % pool.length];
  }
  function adsAreRivals(a, b) { return a.id === b.id || (!!a.group && a.group === b.group); }
  function pickTwoAds(text) {
    var top = pickInArticleAd(HOUSE_ADS, text, 'reader-top');
    var rest = top ? HOUSE_ADS.filter(function (a) { return !adsAreRivals(a, top); }) : HOUSE_ADS;
    var bottom = pickInArticleAd(rest, text, 'reader-bottom');
    return { top: top, bottom: bottom };
  }
  function houseAdRender(a, size) {
    if (!a) return ad(size === 'rectangle' ? 'rectangle' : 'inarticle');
    var img = size === 'rectangle' ? (a.imageRect || a.imageWide) : (a.imageWide || a.imageRect);
    if (img) {
      return '<a class="had had-img' + (size === 'rectangle' ? ' had-rect' : '') + '" href="' + a.href + '" data-ad-brand="' + esc(a.brand) + '">' +
        '<span class="had-adchip">Ad</span><img src="' + img + '" alt="' + esc(a.brand) + '"></a>';
    }
    return '<div class="had' + (size === 'rectangle' ? ' had-rect' : '') + '" data-ad-brand="' + esc(a.brand) + '"><div class="had-bar" style="background:' + a.accent + '"></div>' +
      '<div class="had-body"><div class="had-top"><span class="had-badge" style="background:' + a.accent + '">Ad</span><span class="had-brand">' + esc(a.brand) + '</span><span class="had-label">' + esc(a.label) + '</span></div>' +
      '<p class="had-head">' + esc(a.headline) + '</p>' +
      '<a class="had-cta" href="' + a.href + '" style="background:' + a.accent + '">' + esc(a.cta) + ' &rarr;</a></div></div>';
  }
  window.__rsAdPick = function (text, slot) { return pickInArticleAd(HOUSE_ADS, text, slot); }; // exposed for headless tests / debugging
  window.__rsAdPickTwo = pickTwoAds;

  var CHEV_L = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 6-6 6 6 6"/></svg>';
  var CHEV_R = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>';
  function carousel(items, build, width) {
    var w = width ? ' style="width:' + width + 'px"' : '';
    return '<div class="carousel at-start">' +
      '<button class="car-btn car-prev" data-scroll="-1" aria-label="Previous">' + CHEV_L + '</button>' +
      '<div class="car-track">' + items.map(function (a) { return '<div class="car-item"' + w + '>' + build(a) + '</div>'; }).join('') + '</div>' +
      '<button class="car-btn car-next" data-scroll="1" aria-label="Next">' + CHEV_R + '</button></div>';
  }
  function refreshCarousels() {
    document.querySelectorAll('.carousel').forEach(function (car) {
      var track = car.querySelector('.car-track'); if (!track) return;
      var max = track.scrollWidth - track.clientWidth;
      car.classList.toggle('no-scroll', max <= 2);
      car.classList.toggle('at-start', track.scrollLeft <= 2);
      car.classList.toggle('at-end', track.scrollLeft >= max - 2);
    });
  }
  function initCarousels() {
    document.querySelectorAll('.car-track').forEach(function (track) {
      track.addEventListener('scroll', refreshCarousels, { passive: true });
    });
    refreshCarousels();
  }

  function related(a) {
    var tg = {}; (a.tags || []).forEach(function (t) { tg[t.slug] = 1; });
    return ARTICLES.filter(function (x) { return x.id !== a.id; }).map(function (x) { var s = 0;
      (x.tags || []).forEach(function (t) { if (tg[t.slug]) s += 3; }); if (a.category && x.category && a.category.slug === x.category.slug) s += 2; return { x: x, s: s }; })
      .sort(function (p, q) { return q.s - p.s || (q.x.views || 0) - (p.x.views || 0); }).slice(0, 3).map(function (o) { return o.x; });
  }
  function nextArticle(a) { return ARTICLES.filter(function (x) { return x.id !== a.id && new Date(x.publishedAt) < new Date(a.publishedAt); })
    .sort(function (p, q) { return new Date(q.publishedAt) - new Date(p.publishedAt); })[0] || null; }
  function isRecent(a) { return a.publishedAt && (Date.now() - new Date(a.publishedAt).getTime()) <= 7 * 864e5; }

  /* ---------- home ---------- */
  // Homepage ad slots have no article context, so any advertiser is safe here.
  // Rotate through the image creatives so the real ads are visible on the home
  // page (not just inside articles). Falls back to the placeholder box.
  var homeAdIdx = 0;
  function homeAd(size) {
    var wantRect = size === 'rectangle';
    var pool = HOUSE_ADS.filter(function (a) { return wantRect ? (a.imageRect || a.imageWide) : (a.imageWide || a.imageRect); });
    if (!pool.length) return ad(size);
    var a = pool[homeAdIdx++ % pool.length];
    return '<div class="had-home' + (wantRect ? ' had-home-rect' : ' had-home-lead') + '">' + houseAdRender(a, wantRect ? 'rectangle' : 'inarticle') + '</div>';
  }
  /* ---------- RS Council column ---------- */
  function councilModule() {
    var cols = ARTICLES.filter(function (a) { return a.category && a.category.slug === 'rs-council'; })
      .sort(function (p, q) { return new Date(q.publishedAt) - new Date(p.publishedAt); }).slice(0, 12);
    if (!cols.length) return '';
    return '<section class="module council-col">' +
      '<div class="council-head"><h2>RS Council</h2><span class="council-sub">The column</span></div>' +
      cols.map(function (a) {
        return '<a class="council-entry" data-open="' + esc(a.slug) + '" href="#' + esc(a.slug) + '">' +
          '<h3 class="council-title">' + esc(a.title) + '</h3>' +
          '<div class="council-meta">' + esc(a.author || 'RS Council') + (a.publishedAt ? ' &middot; ' + fmtDate(a.publishedAt) : '') + '</div>' +
          '<div class="council-body">' + (a.content || '') + '</div>' +
          '<span class="council-more">Open full column &rarr;</span></a>';
      }).join('') + '</section>';
  }
  // Council column + a stacked ad rail to fill the space beside the narrow column.
  function councilRow() {
    var col = councilModule(); if (!col) return '';
    var aside = '<div class="council-aside">' +
      '<div class="council-ad">' + homeAd('leaderboard') + '</div>' +
      '<div class="council-ad">' + homeAd('rectangle') + '</div></div>';
    return '<div class="council-row">' + col + aside + '</div>';
  }

  /* ---------- Feature showcase (big split carousel) ---------- */
  var ARR_L = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>';
  var ARR_R = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  var featureItems = [], featureIdx = 0;
  function featureShowcaseInner() {
    var a = featureItems[featureIdx]; if (!a) return '';
    var accent = a.category ? a.category.color : 'var(--orange)';
    var n = featureItems.length;
    return '<div class="fs-text"><div class="fs-inner">' +
      (a.category ? '<div class="fs-cat" style="color:' + accent + '">' + esc(a.category.name) + '<span class="fs-cat-bar" style="background:' + accent + '"></span></div>' : '') +
      '<h2 class="fs-title" data-open="' + esc(a.slug) + '">' + esc(a.title) + '</h2>' +
      '<a class="fs-read" data-open="' + esc(a.slug) + '" href="#' + esc(a.slug) + '">Read the full story</a>' +
      (n > 1 ? '<div class="fs-nav"><button class="fs-arrow" data-feature="-1" aria-label="Previous">' + ARR_L + '</button><button class="fs-arrow" data-feature="1" aria-label="Next">' + ARR_R + '</button><span class="fs-count">' + (featureIdx + 1) + ' / ' + n + '</span></div>' : '') +
      '</div></div>' +
      '<div class="fs-img" data-open="' + esc(a.slug) + '">' + (a.coverImage ? '<img src="' + esc(a.coverImage) + '" alt="' + esc(a.title) + '">' : '<span class="fs-ph">RS</span>') + '</div>';
  }
  function featureShowcase() {
    var sorted = ARTICLES.slice().sort(function (p, q) { return new Date(q.publishedAt) - new Date(p.publishedAt); });
    featureItems = sorted.filter(function (a) { return a.featured; }).slice(0, 8);
    if (!featureItems.length) featureItems = sorted.slice(0, 5);
    featureIdx = 0;
    if (!featureItems.length) return '';
    return '<section class="feature-showcase" id="feature-showcase">' + featureShowcaseInner() + '</section>';
  }

  function renderHome() {
    homeAdIdx = 0;
    var sorted = ARTICLES.slice().sort(function (p, q) { return new Date(q.publishedAt) - new Date(p.publishedAt); });
    var lead = sorted.filter(function (a) { return a.featured; })[0] || sorted[0];
    if (!lead) { el('main').innerHTML = '<div class="content"><p>No articles yet.</p></div>'; return; }
    var recent = sorted.filter(isRecent).slice(0, 8);
    var latest = sorted.filter(function (a) { return a.id !== lead.id; });
    var trending = ARTICLES.slice().sort(function (p, q) { return (q.views || 0) - (p.views || 0); }).slice(0, 5);
    var recommend = trending.slice(0, 3);

    /* Hero — full width beside the sidebar */
    var h = '<div class="content">';
    h += heroBlock(lead);

    /* Orange "this week" module */
    if (recent.length) {
      h += '<section class="module orange"><div class="module-head"><h2>Published this week</h2><span class="link-orange">' + recent.length + ' new</span></div>' +
        '<div class="grid g4">' + recent.map(orangeItem).join('') + '</div></section>';
    }

    /* Two-column: Latest (list) + rail */
    h += '<div class="row two">';
    h += '<section class="module"><div class="module-head"><h2>Latest articles</h2><a class="link-orange" href="#" data-home="1">View all</a></div>' +
      latest.slice(0, 6).map(latestRow).join('') +
      '<div style="margin-top:16px;display:flex;justify-content:center">' + homeAd('leaderboard') + '</div></section>';
    h += '<div class="rail" style="display:flex;flex-direction:column;gap:20px">' +
      '<section class="module"><div class="module-head"><h2>Trending</h2></div>' +
      trending.map(function (a, i) { return '<div class="mini" data-open="' + esc(a.slug) + '"><span class="n">' + (i + 1) + '</span><span class="mt">' + esc(a.title) + '</span><span class="mv">' + ICON.eye + (a.views || 0) + '</span></div>'; }).join('') +
      '</section>' +
      '<section class="module"><div class="module-head"><h2>Categories</h2></div><div class="cats">' +
      CATEGORIES.map(function (c) { return '<span class="cat-chip" data-cat="' + esc(c.slug) + '" style="color:' + c.color + '">' + esc(c.name) + '<span class="count">' + (c.count || 0) + '</span></span>'; }).join('') +
      '</div></section>' +
      '<section class="module" style="display:flex;justify-content:center">' + homeAd('rectangle') + '</section>' +
      '</div>';
    h += '</div>';

    /* Industry News + monthly poll (2-col row) */
    h += industryPollRow();

    /* Big split feature showcase — sits below Industry News */
    h += featureShowcase();

    /* Backroom Humor comic */
    h += comicModule();

    /* RS Council column (+ ads filling the space beside it) */
    h += councilRow();

    /* You might like — swipeable carousel */
    var youMightLike = ARTICLES.slice().sort(function (p, q) { return (q.views || 0) - (p.views || 0); });
    if (youMightLike.length) {
      h += '<section class="module"><div class="module-head"><h2>You might like</h2>' +
        '</div>' +
        carousel(youMightLike, function (a) { return articleBlock(a); }) + '</section>';
    }

    /* Full-width leaderboard ad */
    h += '<div class="module" style="display:flex;justify-content:center">' + homeAd('leaderboard') + '</div>';

    /* Category spotlights — a module per popular category */
    var topCats = CATEGORIES.slice().sort(function (p, q) { return (q.count || 0) - (p.count || 0); }).slice(0, 3);
    topCats.forEach(function (c, idx) {
      var items = ARTICLES.filter(function (a) { return a.category && a.category.slug === c.slug; }).slice(0, 10);
      if (!items.length) return;
      h += '<section class="module"><div class="module-head"><h2 style="color:' + c.color + '">In ' + esc(c.name) + '</h2>' +
        '<span class="cat-chip" data-cat="' + esc(c.slug) + '" style="color:' + c.color + '">See all ' + (c.count || 0) + '</span></div>' +
        carousel(items, function (a) { return articleBlock(a); }) + '</section>';
      // Sprinkle an ad between the two spotlights
      if (idx === 0) h += '<div class="module" style="display:flex;justify-content:center">' + homeAd('leaderboard') + '</div>';
    });

    /* Popular topics (tag cloud) */
    var tagCount = {};
    ARTICLES.forEach(function (a) { (a.tags || []).forEach(function (t) { tagCount[t.name] = (tagCount[t.name] || 0) + 1; }); });
    var topTags = Object.keys(tagCount).sort(function (x, y) { return tagCount[y] - tagCount[x]; });
    if (topTags.length) {
      h += '<section class="module"><div class="module-head"><h2>Popular topics</h2></div><div class="cats">' +
        topTags.map(function (t) { return '<span class="cat-chip" data-topic="' + esc(t) + '">#' + esc(t) + '<span class="count">' + tagCount[t] + '</span></span>'; }).join('') +
        '</div></section>';
    }

    /* Editor's picks — swipeable */
    var picks = ARTICLES.slice().sort(function (p, q) { return (q.views || 0) - (p.views || 0); });
    if (picks.length) {
      h += '<section class="module"><div class="module-head"><h2>Editor&rsquo;s picks</h2></div>' +
        carousel(picks, function (a) { return articleBlock(a); }) + '</section>';
    }

    /* Leaderboard ad */
    h += '<div class="module" style="display:flex;justify-content:center">' + homeAd('leaderboard') + '</div>';

    /* Quick reads — short articles */
    var quick = sorted.slice().sort(function (p, q) { return (p.readMinutes || 1) - (q.readMinutes || 1); });
    h += '<section class="module"><div class="module-head"><h2>Quick reads</h2><span class="link-orange" style="cursor:default">5 min or less</span></div>' +
      carousel(quick, function (a) { return articleBlock(a, { sm: true }); }, 250) + '</section>';

    /* More to explore — swipeable */
    h += '<section class="module"><div class="module-head"><h2>More to explore</h2></div>' +
      carousel(sorted, function (a) { return articleBlock(a, { sm: true }); }, 250) + '</section>';

    /* Ad rectangles row */
    h += '<div class="row" style="grid-template-columns:1fr"><div class="grid g3">' +
      '<div class="module" style="display:flex;justify-content:center">' + homeAd('rectangle') + '</div>' +
      '<div class="module" style="display:flex;justify-content:center">' + homeAd('rectangle') + '</div>' +
      '<div class="module" style="display:flex;justify-content:center">' + homeAd('rectangle') + '</div>' +
      '</div></div>';

    /* Subscribe CTA (orange) */
    h += '<section class="module orange"><div style="max-width:560px">' +
      '<h2 style="font-size:24px;font-weight:900;margin:0">Never miss a story</h2>' +
      '<p style="margin:8px 0 16px;color:rgba(255,255,255,.9);font-size:16px">Get the week\'s best articles delivered to your inbox. No spam, unsubscribe anytime.</p>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
      '<input type="email" placeholder="you@example.com" style="flex:1;min-width:220px;height:46px;border-radius:11px;border:1px solid rgba(255,255,255,.4);background:rgba(255,255,255,.14);color:#fff;padding:0 14px;font-size:15px;outline:none">' +
      '<button class="btn" style="background:#fff;color:var(--orange)">Subscribe</button></div></div></section>';

    h += '</div>';
    el('main').innerHTML = h;
    syncButtons();
    initCarousels();
  }

  function heroBlock(lead) {
    return '<section class="hero"><div class="acts">' + acts(lead.slug) + '</div>' +
      '<a href="#' + esc(lead.slug) + '" data-open="' + esc(lead.slug) + '"><div class="hero-inner">' +
      (lead.coverImage ? '<div class="cover"><img src="' + esc(lead.coverImage) + '" alt="" style="height:100%;width:100%;object-fit:cover"></div>' : '<div class="cover"><span class="decor">RS</span></div>') +
      '<div class="content" style="padding:28px">' +
      '<div style="display:flex;align-items:center;gap:10px"><span class="badge" style="background:var(--orange-soft);color:var(--orange)">Headline</span>' +
      (lead.category ? '<span style="font-size:13px;font-weight:700;color:' + lead.category.color + '">' + esc(lead.category.name) + '</span>' : '') + '</div>' +
      '<h1>' + esc(lead.title) + '</h1>' + (lead.excerpt ? '<p class="hex">' + esc(lead.excerpt) + '</p>' : '') +
      '<div style="margin-top:18px;color:var(--orange);font-weight:800;font-size:15px;display:flex;align-items:center;gap:8px">Read article ' + ICON.arrow + '</div>' +
      '</div></div></a></section>';
  }

  /* ---------- history ---------- */
  function renderHistory() {
    var list = getHistory();
    var h = '<div class="content"><section class="module"><div class="module-head"><h2>' + ICON.clockLg + ' Your history</h2>' +
      (list.length ? '<button class="btn btn-outline btn-sm" data-clearhistory="1">Clear history</button>' : '') + '</div>';
    if (!list.length) h += '<p style="color:var(--muted);margin:0;font-size:16px">No history yet. Open a few articles and they\'ll show up here — handy for finding one you clicked away from.</p>';
    else {
      h += '<p style="color:var(--muted);margin:0 0 12px;font-size:15px">The last ' + list.length + ' article' + (list.length === 1 ? '' : 's') + ' you opened, most recent first.</p>';
      h += list.map(function (s) { var a = bySlug[s.slug];
        return '<div class="mini" data-open="' + esc(s.slug) + '"><span style="color:var(--muted);flex-shrink:0">' + ICON.clock + '</span>' +
          '<span class="mt">' + esc(s.title) + (a && a.category ? ' <span style="color:' + a.category.color + ';font-weight:700;font-size:13px">· ' + esc(a.category.name) + '</span>' : '') + '</span>' +
          '<span class="mv">' + esc(timeAgo(s.ts)) + '</span></div>'; }).join('');
    }
    h += '</section></div>';
    el('main').innerHTML = h; window.scrollTo(0, 0);
  }

  /* ---------- favorites ---------- */
  function favChip(id, name, count) {
    return '<button class="fav-chip' + (favView === id ? ' active' : '') + '" data-favfolder="' + esc(id) + '">' +
      esc(name) + '<span class="fav-chip-n">' + count + '</span></button>';
  }
  function favCard(a, cur) {
    var accent = a.category ? a.category.color : 'var(--orange)';
    var top = a.coverImage ? '<img src="' + esc(a.coverImage) + '" alt="" loading="lazy" style="aspect-ratio:16/9;width:100%;object-fit:cover">'
      : '<div class="ablock-ph"><span class="accent" style="background:' + accent + '"></span>RS</div>';
    var opts = '<option value="">Unfiled</option>' + getFavFolders().map(function (f) {
      return '<option value="' + esc(f.id) + '"' + (cur === f.id ? ' selected' : '') + '>' + esc(f.name) + '</option>'; }).join('');
    return '<article class="ablock"><div class="acts">' + acts(a.slug) + '</div>' + top +
      '<a href="#' + esc(a.slug) + '" data-open="' + esc(a.slug) + '" class="body"><div>' + catBadge(a.category) + '</div>' +
      '<h3>' + esc(a.title) + '</h3>' +
      '<div class="meta"><span>' + fmtDate(a.publishedAt) + '</span><span>' + ICON.clock + (a.readMinutes || 1) + ' min</span></div></a>' +
      '<div class="fav-folder-bar">' + ICON.folder + '<select class="fav-folder-sel" data-fav-setfolder="' + esc(a.id) + '" aria-label="Move to folder">' + opts + '</select></div>' +
      '</article>';
  }
  function renderFavorites() {
    var favs = read(FAV_KEY), folders = getFavFolders();
    if (favView !== 'all' && favView !== 'unfiled' && !folders.some(function (f) { return f.id === favView; })) favView = 'all';
    var h = '<div class="content"><section class="module" data-page="favorites"><div class="module-head"><h2>' + ICON.starLg + ' Your favorites</h2></div>';
    if (!favs.length) {
      h += '<p style="color:var(--muted);margin:0;font-size:16px">No favorites yet. Tap the ' + ICON.star + ' on any article to save it here — then group them into folders like <b>Training</b>, <b>Front&nbsp;counter</b> or <b>Marketing</b>.</p></section></div>';
      el('main').innerHTML = h; window.scrollTo(0, 0); return;
    }
    var unfiled = favs.filter(function (x) { return !x.folder; }).length;
    var shown = favs.filter(function (x) { return favView === 'all' ? true : favView === 'unfiled' ? !x.folder : x.folder === favView; });
    // Folder chips + new-folder control
    h += '<div class="fav-folders">' + favChip('all', 'All', favs.length) +
      (folders.length ? favChip('unfiled', 'Unfiled', unfiled) : '') +
      folders.map(function (f) { return favChip(f.id, f.name, favs.filter(function (x) { return x.folder === f.id; }).length); }).join('') +
      (favNewOpen
        ? '<span class="fav-newfolder"><input type="text" class="fav-newfolder-input" placeholder="Folder name" maxlength="32" data-fav-newfolder-input="1"><button class="fav-newfolder-add" data-fav-newfolder-add="1">Add</button><button class="fav-newfolder-cancel" data-fav-newfolder-cancel="1" aria-label="Cancel">' + ICON.x + '</button></span>'
        : '<button class="fav-newfolder-btn" data-fav-newfolder="1">' + ICON.folderPlus + ' New folder</button>') +
      '</div>';
    // Rename / delete for the selected folder
    if (favView !== 'all' && favView !== 'unfiled') {
      var cf = folders.filter(function (f) { return f.id === favView; })[0];
      if (cf) h += '<div class="fav-folder-actions"><span>Showing <b>' + esc(cf.name) + '</b></span>' +
        '<button data-fav-renamefolder="' + esc(cf.id) + '">Rename</button>' +
        '<button data-fav-delfolder="' + esc(cf.id) + '">Delete folder</button></div>';
    }
    if (!shown.length) h += '<p style="color:var(--muted);margin:14px 0 0;font-size:15px">Nothing filed here yet. Use the folder menu on any favorite to move it in.</p>';
    else h += '<div class="grid g3" style="margin-top:16px">' + shown.map(function (s) { var a = bySlug[s.slug]; return a ? favCard(a, s.folder || '') : ''; }).join('') + '</div>';
    h += '</section></div>';
    el('main').innerHTML = h; syncButtons(); window.scrollTo(0, 0);
  }

  /* ---------- search ---------- */
  function searchArticles(q) { q = q.trim().toLowerCase(); if (!q) return [];
    var terms = q.split(/\s+/).slice(0, 6);
    return ARTICLES.map(function (a) { var hay = (a.title + ' ' + (a.excerpt || '') + ' ' + (a.content || '') + ' ' + (a.category ? a.category.name : '') + ' ' + (a.tags || []).map(function (t) { return t.name; }).join(' ')).toLowerCase();
      var s = 0; terms.forEach(function (t) { if (a.title.toLowerCase().indexOf(t) >= 0) s += 10; if (hay.indexOf(t) >= 0) s += 2; }); return { a: a, s: s }; })
      .filter(function (o) { return o.s > 0; }).sort(function (p, q2) { return q2.s - p.s; }).map(function (o) { return o.a; }); }
  function renderSuggest(input, results) {
    var box = input.parentNode.querySelector('.suggest'); if (box) box.remove(); if (!results.length) return;
    box = document.createElement('div'); box.className = 'suggest';
    box.innerHTML = results.slice(0, 6).map(function (a) { return '<a href="#' + esc(a.slug) + '" data-open="' + esc(a.slug) + '"><span style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(a.title) + '</span>' + (a.category ? '<span class="cat">' + esc(a.category.name) + '</span>' : '') + '</a>'; }).join('');
    input.parentNode.appendChild(box);
  }
  function runSearch(q) {
    var results = searchArticles(q);
    var h = '<div class="content"><section class="module"><div class="module-head"><h2>Search</h2><a href="#" data-home="1" class="link-orange">Back home</a></div>' +
      '<p style="color:var(--muted);margin:0 0 16px;font-size:15px">' + results.length + ' result' + (results.length === 1 ? '' : 's') + ' for "' + esc(q) + '"</p>' +
      (results.length ? '<div class="grid g3">' + results.map(function (a) { return articleBlock(a); }).join('') + '</div>' : '<p style="color:var(--muted)">No articles matched.</p>') +
      '</section></div>';
    el('main').innerHTML = h; syncButtons(); window.scrollTo(0, 0);
  }

  /* ---------- modal ---------- */
  function openModal(slug, push) {
    var a = bySlug[slug]; if (!a) return;
    recordHistory(a);
    if (push !== false) { try { history.pushState({ m: slug }, '', '#' + slug); } catch (e) {} }
    document.body.classList.add('modal-open');
    var rel = related(a), nx = nextArticle(a);
    var adCtx = a.title + ' ' + (a.content || '') + ' ' + (a.tags || []).map(function (t) { return t.name; }).join(' ');
    var adPair = pickTwoAds(adCtx);
    el('modal-host').innerHTML =
      '<div class="modal"><div class="modal-backdrop" data-close="1"></div><div class="modal-panel"><div class="modal-card">' +
      '<div class="modal-top"><div class="t">' + catBadge(a.category) + '<span class="tt">' + esc(a.title) + '</span></div>' +
      '<div style="display:flex;gap:8px;align-items:center">' +
      '<button class="btn btn-sm ' + (isFav(a.id) ? 'btn-primary' : 'btn-outline') + '" data-fav="' + esc(a.slug) + '" data-variant="pill">' + (isFav(a.id) ? ICON.starFill + ' Favorited' : ICON.star + ' Favorite') + '</button>' +
      '<button class="btn btn-sm ' + (isRead(a.id) ? 'btn-primary' : 'btn-outline') + '" data-read="' + esc(a.slug) + '" data-variant="pill">' + (isRead(a.id) ? ICON.bookFill + ' Pinned' : ICON.book + ' Pin') + '</button>' +
      '<button class="icon-btn" data-share="' + esc(a.slug) + '" title="Share" aria-label="Share">' + ICON.share + '</button>' +
      '<button class="icon-btn" data-close="1" aria-label="Close">' + ICON.x + '</button></div></div>' +
      '<div class="modal-body"><div class="reader" data-article="' + esc(a.slug) + '">' +
      '<div class="clip-hint">' + ICON.clip + ' Tip: highlight any text to turn it into a shareable quote image.</div>' +
      '<h1>' + esc(a.title) + '</h1><div class="rmeta">' + (a.author ? '<span>By ' + esc(a.author) + '</span>' : '') +
      '<span>' + fmtDate(a.publishedAt) + '</span><span>' + ICON.clock + (a.readMinutes || 1) + ' min read</span><span>' + ICON.eye + (a.views || 0) + ' views</span></div>' +
      (a.coverImage ? '<img src="' + esc(a.coverImage) + '" alt="" style="margin-top:24px;border-radius:14px;aspect-ratio:16/9;width:100%;object-fit:cover">' : '') +
      '<div style="margin:24px 0">' + houseAdRender(adPair.top, 'inarticle') + '</div><div class="prose">' + (a.content || '') + '</div>' +
      ((a.tags && a.tags.length) ? '<div style="margin-top:32px;padding-top:24px;border-top:1px solid var(--border);display:flex;flex-wrap:wrap;gap:8px">' + a.tags.map(function (t) { return '<span class="badge" style="border:1px solid var(--border)">#' + esc(t.name) + '</span>'; }).join('') + '</div>' : '') +
      '<div style="margin:32px 0;display:flex;justify-content:center">' + houseAdRender(adPair.bottom, 'rectangle') + '</div>' +
      (nx ? '<div class="hero next" data-open="' + esc(nx.slug) + '"><div><div class="lbl">Read next</div><div class="nt">' + esc(nx.title) + '</div></div><span style="color:var(--orange)">' + ICON.arrow + '</span></div>' : '') +
      (rel.length ? '<div style="margin-top:32px"><h2 style="font-size:15px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:800;margin:0 0 14px">If you read this, you might like…</h2><div class="grid g3">' +
        rel.map(function (r) { return '<div class="ablock sm" data-open="' + esc(r.slug) + '" style="cursor:pointer"><span class="accent" style="background:' + (r.category ? r.category.color : 'var(--orange)') + '"></span><div class="body">' + (r.category ? '<span style="font-size:12.5px;font-weight:700;color:' + r.category.color + '">' + esc(r.category.name) + '</span>' : '') + '<h3 style="padding-right:0">' + esc(r.title) + '</h3></div></div>'; }).join('') + '</div></div>' : '') +
      '</div></div></div></div></div>';
    var body = el('modal-host').querySelector('.modal-body'); if (body) body.scrollTop = 0;
  }
  function closeModal(pop) {
    el('modal-host').innerHTML = ''; document.body.classList.remove('modal-open');
    var f = el('clip-fab'); if (f) f.hidden = true;
    if (pop !== false && (location.hash || (history.state && history.state.m))) { try { history.pushState('', '', location.pathname + location.search); } catch (e) {} }
  }

  /* ---------- text selection -> clip ---------- */
  function currentClipContext() {
    var sel = window.getSelection(); if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
    var node = sel.anchorNode; node = node && node.nodeType === 3 ? node.parentNode : node;
    var reader = node && node.closest ? node.closest('.reader') : null;
    if (!reader) { var f = sel.focusNode; f = f && f.nodeType === 3 ? f.parentNode : f; reader = f && f.closest ? f.closest('.reader') : null; }
    if (!reader) return null;
    var prose = reader.querySelector('.prose'); if (!prose) return null;
    // Clamp to the article prose so title/byline/ads are never captured, and
    // keep block breaks so a heading doesn't merge into the paragraph below.
    var text = extractClipText(sel, prose);
    if (text.replace(/\s+/g, '').length < 4) return null;
    return { text: text, slug: reader.getAttribute('data-article') || '', rect: sel.getRangeAt(0).getBoundingClientRect() };
  }
  function updateClipFab() {
    var fab = el('clip-fab'); if (!fab) return;
    var ctx = currentClipContext();
    if (!ctx) { fab.hidden = true; return; }
    fab.innerHTML = ICON.clip + '<span>Clip</span>'; fab.hidden = false;
    var top = ctx.rect.top - 46; if (top < 60) top = ctx.rect.bottom + 10;
    var left = ctx.rect.left + ctx.rect.width / 2 - 44;
    left = Math.max(8, Math.min(left, window.innerWidth - 100));
    fab.style.top = top + 'px'; fab.style.left = left + 'px';
    fab.setAttribute('data-slug', ctx.slug); fab.setAttribute('data-text', ctx.text);
  }

  /* ---------- clippings view ---------- */
  var clipView = 'cards';
  var clipCustOpen = false;
  function isComicClip(c) { return c.kind === 'comic' || !!c.image; }
  function clipImageFor(c) {
    return isComicClip(c) ? c.image : makeQuoteImage({ quote: c.quote, title: c.title, author: c.author, url: location.host + location.pathname + '#' + (c.slug || ''), slug: c.slug, theme: clipTheme });
  }
  // Icon-only action whose label slides out on hover (keeps the 3-col cards tidy).
  function clipIcon(attr, val, icon, label, danger) {
    return '<button class="clip-ico' + (danger ? ' clip-ico-del' : '') + '" ' + attr + '="' + esc(val) + '" title="' + esc(label) + '" aria-label="' + esc(label) + '">' +
      icon + '<span class="clip-ico-lbl">' + esc(label) + '</span></button>';
  }
  function clipActions(c) {
    if (isComicClip(c)) {
      return '<div class="clip-actions">' +
        clipIcon('data-download-clip', c.id, ICON.download, 'Download image') +
        clipIcon('data-del-clip', c.id, ICON.trash2, 'Delete', true) + '</div>';
    }
    return '<div class="clip-actions">' +
      clipIcon('data-download-clip', c.id, ICON.download, 'Download image') +
      (c.slug && bySlug[c.slug] ? clipIcon('data-open', c.slug, ICON.arrow, 'Open article') : '') +
      clipIcon('data-copy-clip', c.id, ICON.copy, 'Copy quote') +
      clipIcon('data-del-clip', c.id, ICON.trash2, 'Delete', true) + '</div>';
  }
  // Simple enlarge-on-click lightbox for clip images (reuses the comic overlay styles).
  function openZoomLightbox(src, alt) {
    el('dialog-host').innerHTML = '<div class="comic-lb"><div class="comic-lb-bg" data-lb-close="1"></div>' +
      '<button class="comic-lb-x" data-lb-close="1" aria-label="Close">' + ICON.x + '</button>' +
      '<div class="comic-lb-inner"><img src="' + esc(src) + '" alt="' + esc(alt || '') + '"></div></div>';
    document.body.classList.add('modal-open');
  }
  function renderClippings() {
    var list = getClippings();
    var h = '<div class="content"><section class="module"><div class="module-head"><h2>Your RS News Clippings</h2>';
    if (list.length) {
      // Mini-swatch preview of each quote-image look: [body, footer strip].
      var sw = { dark: '#2b333d', light: '#f7f0e2', rs: '#f7edd8' };
      var swBot = { dark: '#141a21', light: '#e8dec9', rs: '#2b333c' };
      h += '<div class="clip-head-tools">' +
        '<div class="clip-customize">' +
          '<button class="clip-cust-btn" data-clip-customize="1"><span class="clip-cust-dot" style="background:' + sw[clipTheme] + '"></span>Customize</button>' +
          (clipCustOpen ? (
            '<div class="clip-cust-pop">' +
            '<div class="clip-cust-title">Quote clipping style</div>' +
            ['dark', 'light', 'rs'].map(function (t) {
              var lbl = t === 'rs' ? 'RS' : (t.charAt(0).toUpperCase() + t.slice(1));
              return '<button class="clip-cust-opt' + (clipTheme === t ? ' active' : '') + '" data-clip-theme="' + t + '">' +
                '<span class="clip-cust-sw"><span style="background:' + sw[t] + '"></span><span style="background:' + swBot[t] + '"></span></span>' + lbl +
                (clipTheme === t ? '<span class="clip-cust-check">✓</span>' : '') + '</button>';
            }).join('') +
            '<div class="clip-cust-note">Applies to quote images. Remembered next time.</div>' +
            '</div>'
          ) : '') +
        '</div>' +
        '<div class="clip-view-toggle">' +
        '<button class="' + (clipView === 'cards' ? 'active' : '') + '" data-clipview="cards">Cards</button>' +
        '<button class="' + (clipView === 'images' ? 'active' : '') + '" data-clipview="images">Images</button></div></div>';
    }
    h += '</div>';
    if (!list.length) {
      h += '<p style="color:var(--muted);margin:0;font-size:16px">No clippings yet. Open an article, <b>highlight</b> a passage, then click <b>Clip</b> to turn it into a shareable quote image you can download.</p>';
    } else if (clipView === 'images') {
      // Masonry (Pinterest-style): images keep their natural height and tile.
      h += '<div class="clip-img-masonry">' + list.map(function (c) {
        var img = clipImageFor(c);
        return '<div class="clip-img-card"><img class="clip-zoomable" data-clip-zoom="' + esc(c.id) + '" src="' + esc(img) + '" alt="' + esc(isComicClip(c) ? (c.title || 'Comic') : 'Quote image') + '" loading="lazy">' + clipActions(c) + '</div>';
      }).join('') + '</div>';
    } else {
      h += '<div class="clip-grid clip-grid-3">' + list.map(function (c) {
        if (isComicClip(c)) {
          return '<div class="clip-card clip-card-comic"><div class="clip-comic-row clip-tap" data-clip-zoom="' + esc(c.id) + '">' +
            '<img class="clip-comic-thumb" src="' + esc(c.image) + '" alt="' + esc(c.title || 'Comic') + '" loading="lazy">' +
            '<div><span class="clip-comic-badge">Comic</span>' +
            '<div class="clip-comic-title">' + esc(c.title || 'Backroom Humor') + '</div></div></div>' +
            clipActions(c) + '</div>';
        }
        var q = c.quote.length > 200 ? c.quote.slice(0, 197) + '…' : c.quote;
        return '<div class="clip-card"><div class="clip-tap" data-clip-zoom="' + esc(c.id) + '"><div class="clip-quote">&ldquo;' + esc(q) + '&rdquo;</div>' +
          '<div class="clip-meta">' + esc(c.title || '') + (c.author ? ' &middot; ' + esc(c.author) : '') + '</div></div>' +
          clipActions(c) + '</div>';
      }).join('') + '</div>';
    }
    h += '</section></div>';
    el('main').innerHTML = h; window.scrollTo(0, 0);
    // Once logo + parchment load, repaint so the quote images show them.
    if (list.length) ensureQuoteAssets(function () { if (el('main').querySelector('[data-clipview]')) renderClippings(); });
  }

  /* ---------- events ---------- */
  document.addEventListener('click', function (e) {
    if (e.target.closest('#collapse-btn')) { toggleCollapse(); return; }
    if (e.target.closest('#hamburger')) { el('shell').classList.add('mobileopen'); return; }
    if (e.target.closest('#sidebar-backdrop')) { closeDrawer(); return; }
    if (e.target.closest('#theme-btn')) { toggleTheme(); return; }
    var sc = e.target.closest('[data-scroll]');
    if (sc) { e.preventDefault(); var track = sc.parentNode.querySelector('.car-track');
      if (track) track.scrollBy({ left: parseInt(sc.getAttribute('data-scroll'), 10) * track.clientWidth * 0.85, behavior: 'smooth' }); return; }
    // Share + clippings + dialog controls
    if (e.target.closest('[data-dlg-close]')) { e.preventDefault(); closeDialog(); return; }
    var shareBtn = e.target.closest('[data-share]'); if (shareBtn) { e.preventDefault(); e.stopPropagation(); openShare(shareBtn.getAttribute('data-share')); return; }
    var copyLink = e.target.closest('[data-copy-link]'); if (copyLink) { e.preventDefault(); if (navigator.clipboard) navigator.clipboard.writeText(copyLink.getAttribute('data-copy-link')); toast('Link copied!'); return; }
    var nativeShare = e.target.closest('[data-native-share]'); if (nativeShare) { e.preventDefault(); var ns = nativeShare.getAttribute('data-native-share'), na = bySlug[ns]; if (navigator.share) navigator.share({ title: na ? na.title : 'RSNews Hub', url: shareUrlFor(ns) }).catch(function () {}); return; }
    var clipSave = e.target.closest('[data-clip-save]'); if (clipSave) { e.preventDefault();
      if (dialogData && !dialogData.saved) {
        saveClipping({ id: 'c' + Date.now(), quote: dialogData.text, title: dialogData.o.title, author: dialogData.o.author, slug: dialogData.slug, ts: Date.now() });
        dialogData.saved = true;
        clipSave.className = 'btn btn-outline btn-sm'; clipSave.disabled = true; clipSave.innerHTML = ICON.check + ' Saved';
        var note = clipSave.closest('.dlg-body').querySelector('.dlg-note'); if (note) note.innerHTML = 'Saved to your Clippings. Great for sharing on social.';
        toast('Saved to Clippings');
      }
      return; }
    if (e.target.closest('[data-clip-download]')) { e.preventDefault(); if (dialogData && dialogData.img) downloadDataUrl(dialogData.img, clipFileName(dialogData.o)); toast('Image downloaded'); return; }
    if (e.target.closest('[data-clip-copy]')) { e.preventDefault(); if (dialogData && navigator.clipboard) navigator.clipboard.writeText(clipShareText(dialogData.o)); toast('Quote copied'); return; }
    var dlClip = e.target.closest('[data-download-clip]'); if (dlClip) { e.preventDefault(); var dc = getClippings().filter(function (x) { return x.id === dlClip.getAttribute('data-download-clip'); })[0];
      if (dc && isComicClip(dc)) { downloadImage(dc.image, comicFileName(dc.title)); }
      else if (dc) { downloadDataUrl(makeQuoteImage({ quote: dc.quote, title: dc.title, author: dc.author, url: location.host + location.pathname + '#' + (dc.slug || ''), slug: dc.slug, theme: clipTheme }), 'rsnews-clip-' + (dc.slug || 'quote') + '.png'); }
      toast('Image downloaded'); return; }
    var copyClip = e.target.closest('[data-copy-clip]'); if (copyClip) { e.preventDefault(); var cc = getClippings().filter(function (x) { return x.id === copyClip.getAttribute('data-copy-clip'); })[0];
      if (cc && navigator.clipboard) navigator.clipboard.writeText(clipShareText(cc)); toast('Quote copied'); return; }
    var clipViewBtn = e.target.closest('[data-clipview]'); if (clipViewBtn) { e.preventDefault(); clipView = clipViewBtn.getAttribute('data-clipview'); renderClippings(); return; }
    var custBtn = e.target.closest('[data-clip-customize]'); if (custBtn) { e.preventDefault(); clipCustOpen = !clipCustOpen; renderClippings(); return; }
    var themeBtn = e.target.closest('[data-clip-theme]'); if (themeBtn) { e.preventDefault(); clipTheme = themeBtn.getAttribute('data-clip-theme'); try { localStorage.setItem(CLIPTHEME_KEY, clipTheme); } catch (x) {} clipCustOpen = false; renderClippings(); return; }
    if (clipCustOpen && !e.target.closest('.clip-customize')) { clipCustOpen = false; if (el('main').querySelector('[data-clipview]')) renderClippings(); /* fall through */ }
    var clipZoom = e.target.closest('[data-clip-zoom]'); if (clipZoom) { e.preventDefault(); var zc = getClippings().filter(function (x) { return x.id === clipZoom.getAttribute('data-clip-zoom'); })[0]; if (zc) openZoomLightbox(clipImageFor(zc), zc.title || 'Clip'); return; }
    if (e.target.closest('[data-industry-open]')) { e.preventDefault(); openIndustryDialog(); return; }
    if (e.target.closest('[data-industry-archive]')) { e.preventDefault(); renderIndustryArchive(); return; }
    var pollVote = e.target.closest('[data-poll-vote]'); if (pollVote) { e.preventDefault(); var pp = pollVote.getAttribute('data-poll-vote').split(':'); castPollVote(pp[0], pp[1]); return; }
    if (e.target.closest('[data-polls-archive]')) { e.preventDefault(); renderPollsArchive(); return; }
    if (e.target.closest('[data-quiz-open]')) { e.preventDefault(); openQuizModal(); return; }
    if (e.target.closest('[data-quiz-submit]')) { e.preventDefault(); submitQuiz(); return; }
    if (e.target.closest('[data-comics-archive]')) { e.preventDefault(); renderComicsArchive(); return; }
    var fbtn = e.target.closest('[data-feature]'); if (fbtn) { e.preventDefault(); e.stopPropagation();
      if (featureItems.length) { featureIdx = (featureIdx + parseInt(fbtn.getAttribute('data-feature'), 10) + featureItems.length) % featureItems.length;
        var fhost = el('feature-showcase'); if (fhost) fhost.innerHTML = featureShowcaseInner(); } return; }
    if (e.target.closest('[data-lb-close]')) { e.preventDefault(); closeComicLightbox(); return; }
    if (e.target.closest('[data-comic-dl]')) { e.preventDefault(); if (lightboxComic) downloadImage(lightboxComic.src, comicFileName(lightboxComic.title)); toast('Image downloaded'); return; }
    var comicSave = e.target.closest('[data-comic-save]'); if (comicSave) { e.preventDefault();
      if (!comicSave.disabled && lightboxComic) {
        var dup = getClippings().some(function (x) { return (x.kind === 'comic' || x.image) && x.image === lightboxComic.src; });
        if (dup) { comicSave.disabled = true; comicSave.innerHTML = ICON.check + ' You’ve already got that'; toast('Already in Clippings'); return; }
        saveClipping({ id: 'c' + Date.now(), kind: 'comic', title: lightboxComic.title, image: lightboxComic.src, ts: Date.now() });
        comicSave.disabled = true; comicSave.innerHTML = ICON.check + ' Saved to clippings'; toast('Saved to Clippings');
      }
      return; }
    var comicZoom = e.target.closest('.comic-frame img, .comic-card img'); if (comicZoom) { e.preventDefault(); openComicLightbox(comicZoom.getAttribute('src'), comicZoom.getAttribute('alt')); return; }
    var delClip = e.target.closest('[data-del-clip]'); if (delClip) { e.preventDefault(); removeClipping(delClip.getAttribute('data-del-clip')); renderClippings(); return; }
    var sExp = e.target.closest('[data-strip-expand]'); if (sExp) { e.preventDefault(); stripExpanded = !stripExpanded; renderStrip(); return; }
    var sClr = e.target.closest('[data-strip-clear]'); if (sClr) { e.preventDefault(); stripConfirmClear = true; renderStrip(); return; }
    var sYes = e.target.closest('[data-strip-clear-yes]'); if (sYes) { e.preventDefault(); stripConfirmClear = false; clearRead(); return; }
    var sNo = e.target.closest('[data-strip-clear-no]'); if (sNo) { e.preventDefault(); stripConfirmClear = false; renderStrip(); return; }
    var fFolder = e.target.closest('[data-favfolder]'); if (fFolder) { e.preventDefault(); favView = fFolder.getAttribute('data-favfolder'); favNewOpen = false; renderFavorites(); return; }
    var fNew = e.target.closest('[data-fav-newfolder]'); if (fNew) { e.preventDefault(); favNewOpen = true; renderFavorites(); var ni = el('main').querySelector('[data-fav-newfolder-input]'); if (ni) ni.focus(); return; }
    var fAdd = e.target.closest('[data-fav-newfolder-add]'); if (fAdd) { e.preventDefault(); var ai = el('main').querySelector('[data-fav-newfolder-input]'); var nid = addFavFolder(ai ? ai.value : ''); favNewOpen = false; if (nid) favView = nid; renderFavorites(); return; }
    var fCancel = e.target.closest('[data-fav-newfolder-cancel]'); if (fCancel) { e.preventDefault(); favNewOpen = false; renderFavorites(); return; }
    var fRen = e.target.closest('[data-fav-renamefolder]'); if (fRen) { e.preventDefault(); var rn = prompt('Rename folder'); if (rn) renameFavFolder(fRen.getAttribute('data-fav-renamefolder'), rn); renderFavorites(); return; }
    var fDel = e.target.closest('[data-fav-delfolder]'); if (fDel) { e.preventDefault(); if (confirm('Delete this folder? The favorites inside it move back to Unfiled — the articles stay favorited.')) { removeFavFolder(fDel.getAttribute('data-fav-delfolder')); favView = 'all'; } renderFavorites(); return; }
    var t = e.target.closest('[data-open],[data-close],[data-fav],[data-read],[data-unread],[data-cat],[data-topic],[data-home],[data-history],[data-clippings],[data-favorites],[data-clearhistory]');
    if (!t) return;
    if (t.hasAttribute('data-clippings')) { e.preventDefault(); setActive(t); renderClippings(); closeDrawer(); window.scrollTo(0, 0); return; }
    if (t.hasAttribute('data-favorites')) { e.preventDefault(); setActive(t); favView = 'all'; favNewOpen = false; renderFavorites(); closeDrawer(); window.scrollTo(0, 0); return; }
    if (t.hasAttribute('data-fav')) { e.preventDefault(); e.stopPropagation(); var onFavPage = !!el('main').querySelector('[data-page="favorites"]'); toggleFav(t.getAttribute('data-fav')); if (onFavPage) renderFavorites(); return; }
    if (t.hasAttribute('data-read')) { e.preventDefault(); e.stopPropagation(); toggleRead(t.getAttribute('data-read')); return; }
    if (t.hasAttribute('data-unread')) { e.preventDefault(); e.stopPropagation(); removeRead(t.getAttribute('data-unread')); return; }
    if (t.hasAttribute('data-open')) { e.preventDefault(); openModal(t.getAttribute('data-open')); return; }
    if (t.hasAttribute('data-close')) { e.preventDefault(); closeModal(); return; }
    if (t.hasAttribute('data-cat')) { e.preventDefault(); var c = CATEGORIES.filter(function (x) { return x.slug === t.getAttribute('data-cat'); })[0]; runSearch(c ? c.name : t.getAttribute('data-cat')); return; }
    if (t.hasAttribute('data-topic')) { e.preventDefault(); runSearch(t.getAttribute('data-topic')); return; }
    if (t.hasAttribute('data-history')) { e.preventDefault(); setActive(t); renderHistory(); closeDrawer(); window.scrollTo(0, 0); return; }
    if (t.hasAttribute('data-clearhistory')) { e.preventDefault(); clearHistory(); renderHistory(); return; }
    if (t.hasAttribute('data-home')) { e.preventDefault(); if (t.classList.contains('side-item')) setActive(t); renderHome(); closeDrawer(); window.scrollTo(0, 0); return; }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeComicLightbox(); closeModal(); closeDrawer(); } });
  window.addEventListener('popstate', function () { var hs = (location.hash || '').replace('#', ''); if (hs && bySlug[hs]) openModal(hs, false); else closeModal(false); });
  document.addEventListener('input', function (e) { if (!e.target.matches('[data-search]')) return; var i = e.target, q = i.value;
    if (q.trim().length < 2) { var b = i.parentNode.querySelector('.suggest'); if (b) b.remove(); return; } renderSuggest(i, searchArticles(q)); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.matches && e.target.matches('[data-search]')) { e.preventDefault(); var q = e.target.value.trim(); var b = e.target.parentNode.querySelector('.suggest'); if (b) b.remove(); if (q) runSearch(q); } });
  document.addEventListener('click', function (e) { if (!e.target.closest('.search')) document.querySelectorAll('.suggest').forEach(function (b) { b.remove(); }); });
  // Move a favorite into a folder (native select) + add folder on Enter.
  document.addEventListener('change', function (e) { if (e.target.matches && e.target.matches('[data-fav-setfolder]')) { setFavFolder(e.target.getAttribute('data-fav-setfolder'), e.target.value); renderFavorites(); } });
  document.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.matches && e.target.matches('[data-fav-newfolder-input]')) { e.preventDefault(); var nid = addFavFolder(e.target.value); favNewOpen = false; if (nid) favView = nid; renderFavorites(); } });

  /* ---------- init ---------- */
  initTheme();
  initSidebar();
  window.addEventListener('resize', refreshCarousels, { passive: true });
  document.addEventListener('selectionchange', updateClipFab);
  document.addEventListener('scroll', function () { var f = el('clip-fab'); if (f) f.hidden = true; }, true);
  (function () {
    var fab = el('clip-fab'); if (!fab) return;
    fab.addEventListener('mousedown', function (e) { e.preventDefault(); }); // keep the selection alive
    fab.addEventListener('click', function () {
      openClip(this.getAttribute('data-text'), this.getAttribute('data-slug'));
      this.hidden = true; try { window.getSelection().removeAllRanges(); } catch (e) {}
    });
  })();
  renderStrip();
  renderHome();
  var hs = (location.hash || '').replace('#', '');
  if (hs && bySlug[hs]) openModal(hs, false);
})();
