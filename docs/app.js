/* RSNews Hub — static preview. Sidebar nav, module-forward layout,
   favorites (★) + read-later (📖) + history, flat orange (#E97D34). */
(function () {
  'use strict';
  var DATA = window.__DATA__ || { articles: [], categories: [] };
  var ARTICLES = DATA.articles || [];
  var CATEGORIES = DATA.categories || [];
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
    book: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M12 6.6C9.5 5.1 6 4.8 3 5.7V19c3-.9 6.5-.6 9 .9 2.5-1.5 6-1.8 9-.9V5.7c-3-.9-6.5-.6-9 .9Z"/><path d="M12 6.6V20"/></svg>',
    bookFill: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"><path d="M12 6.6C9.5 5.1 6 4.8 3 5.7V19c3-.9 6.5-.6 9 .9 2.5-1.5 6-1.8 9-.9V5.7c-3-.9-6.5-.6-9 .9Z"/></svg>',
    bookSm: '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 6.6C9.5 5.1 6 4.8 3 5.7V19c3-.9 6.5-.6 9 .9 2.5-1.5 6-1.8 9-.9V5.7c-3-.9-6.5-.6-9 .9Z"/></svg>',
    x: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    clock: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    clockLg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" stroke-width="2" stroke-linecap="round" style="display:inline;vertical-align:-4px"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    eye: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
    arrow: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>',
    share: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>',
    clip: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12"/></svg>',
    download: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>',
    copy: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    trash2: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6"/></svg>',
    check: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'
  };

  /* ---------- theme ---------- */
  function applyTheme(t) {
    document.documentElement.classList.toggle('dark', t === 'dark');
    var b = el('theme-btn'); if (b) b.innerHTML = (t === 'dark' ? ICON.sun : ICON.moon) + '<span class="side-label">' + (t === 'dark' ? 'Light mode' : 'Dark mode') + '</span>';
  }
  function initTheme() {
    var t; try { t = localStorage.getItem(THEME_KEY); } catch (e) {}
    if (!t) t = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    applyTheme(t);
  }
  function toggleTheme() {
    var t = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
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
  function makeQuoteImage(o) {
    var W = 1080, H = 1080, pad = 96, canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H; var ctx = canvas.getContext('2d');
    var g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#2b333d'); g.addColorStop(1, '#141a21');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#E97D34'; ctx.fillRect(pad, pad, 96, 12);
    ctx.textBaseline = 'top'; ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(233,125,52,.92)'; ctx.font = '900 200px Georgia, serif';
    ctx.fillText('“', pad - 12, pad - 8);
    var quote = (o.quote || '').replace(/\s+/g, ' ').trim();
    if (quote.length > 340) quote = quote.slice(0, 337).replace(/\s+\S*$/, '') + '…';
    var maxW = W - pad * 2, size = 62, lines = [], lineH = 0;
    var quoteTop = pad + 210, quoteBottom = H - 330;
    while (size >= 30) {
      ctx.font = '700 ' + size + 'px ui-sans-serif, system-ui, Arial, sans-serif';
      lines = wrapText(ctx, '“' + quote + '”', maxW); lineH = size * 1.32;
      if (lines.length * lineH <= (quoteBottom - quoteTop)) break; size -= 3;
    }
    ctx.fillStyle = '#f4f1ea'; ctx.font = '700 ' + size + 'px ui-sans-serif, system-ui, Arial, sans-serif';
    var y = quoteTop; lines.forEach(function (ln) { ctx.fillText(ln, pad, y); y += lineH; });
    var by = H - 300;
    ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(pad, by); ctx.lineTo(W - pad, by); ctx.stroke();
    ctx.fillStyle = '#E97D34'; roundRect(ctx, pad, by + 34, 68, 68, 15); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '900 32px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('RS', pad + 34, by + 34 + 36); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillStyle = '#fff'; ctx.font = '800 32px ui-sans-serif, Arial'; ctx.fillText('RSNews Hub', pad + 86, by + 40);
    ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.font = '500 24px ui-sans-serif, Arial'; ctx.fillText(o.url || '', pad + 86, by + 78);
    var ty = by + 130; ctx.fillStyle = '#f4f1ea'; ctx.font = '800 34px ui-sans-serif, Arial';
    var titleLines = wrapText(ctx, o.title || '', maxW).slice(0, 2);
    titleLines.forEach(function (l, i) { ctx.fillText(l, pad, ty + i * 42); });
    if (o.author) { ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.font = '500 27px ui-sans-serif, Arial';
      ctx.fillText('— ' + o.author, pad, ty + titleLines.length * 42 + 8); }
    return canvas.toDataURL('image/png');
  }
  function clipFileName(o) { return 'rsnews-clip-' + (o.slug || 'quote') + '.png'; }
  function downloadDataUrl(dataUrl, name) {
    var a = document.createElement('a'); a.href = dataUrl; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  }
  function clipShareText(o) {
    return '“' + (o.quote || '') + '” — ' + (o.title || '') + '\n' + shareUrlFor(o.slug || '');
  }
  function openClip(text, slug) {
    var a = bySlug[slug] || {}; text = (text || '').replace(/\s+/g, ' ').trim();
    if (text.length < 4) { toast('Select some text first'); return; }
    var o = { quote: text, title: a.title || '', author: a.author || '', url: (location.host + location.pathname + '#' + (slug || '')), slug: slug };
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

  function renderStrip() {
    var wrap = el('strip'); if (!wrap) return;
    var list = read(READ_KEY);
    if (!list.length) { wrap.innerHTML = ''; return; }
    var chips = list.map(function (s) {
      return '<div class="chip"><span data-open="' + esc(s.slug) + '" style="display:flex;align-items:center;gap:6px;min-width:0">' +
        '<span style="color:var(--orange);flex-shrink:0">' + ICON.bookSm + '</span><span class="chip-title">' + esc(s.title) + '</span></span>' +
        '<span class="chip-x" data-unread="' + esc(s.id) + '" title="Remove">' + ICON.x + '</span></div>';
    }).join('');
    wrap.innerHTML = '<div class="strip-wrap"><div class="strip"><div class="strip-inner">' +
      '<span class="strip-label">' + ICON.bookSm + ' To read</span><div class="chips">' + chips + '</div></div></div></div>';
  }
  function syncButtons() {
    document.querySelectorAll('[data-fav]').forEach(function (b) {
      var a = bySlug[b.getAttribute('data-fav')]; if (!a) return; var on = isFav(a.id); b.classList.toggle('on', on);
      if (b.getAttribute('data-variant') === 'pill') b.innerHTML = (on ? ICON.starFill : ICON.star) + (on ? ' Favorited' : ' Favorite');
      else b.innerHTML = on ? ICON.starFill : ICON.star;
    });
    document.querySelectorAll('[data-read]').forEach(function (b) {
      var a = bySlug[b.getAttribute('data-read')]; if (!a) return; var on = isRead(a.id); b.classList.toggle('on', on);
      if (b.getAttribute('data-variant') === 'pill') b.innerHTML = (on ? ICON.bookFill : ICON.book) + (on ? ' To read' : ' Read later');
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
    var top = a.coverImage ? '<img src="' + esc(a.coverImage) + '" alt="" loading="lazy" style="aspect-ratio:16/9;width:100%;object-fit:cover">'
      : '<span class="accent" style="background:' + accent + '"></span>';
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
  function renderHome() {
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
      '<div style="margin-top:16px;display:flex;justify-content:center">' + ad('leaderboard') + '</div></section>';
    h += '<div class="rail" style="display:flex;flex-direction:column;gap:20px">' +
      '<section class="module"><div class="module-head"><h2>Trending</h2></div>' +
      trending.map(function (a, i) { return '<div class="mini" data-open="' + esc(a.slug) + '"><span class="n">' + (i + 1) + '</span><span class="mt">' + esc(a.title) + '</span><span class="mv">' + ICON.eye + (a.views || 0) + '</span></div>'; }).join('') +
      '</section>' +
      '<section class="module"><div class="module-head"><h2>Categories</h2></div><div class="cats">' +
      CATEGORIES.map(function (c) { return '<span class="cat-chip" data-cat="' + esc(c.slug) + '" style="color:' + c.color + '">' + esc(c.name) + '<span class="count">' + (c.count || 0) + '</span></span>'; }).join('') +
      '</div></section>' +
      '<section class="module" style="display:flex;justify-content:center">' + ad('rectangle') + '</section>' +
      '</div>';
    h += '</div>';

    /* You might like — swipeable carousel */
    var youMightLike = ARTICLES.slice().sort(function (p, q) { return (q.views || 0) - (p.views || 0); });
    if (youMightLike.length) {
      h += '<section class="module"><div class="module-head"><h2>You might like</h2>' +
        '</div>' +
        carousel(youMightLike, function (a) { return articleBlock(a); }) + '</section>';
    }

    /* Full-width leaderboard ad */
    h += '<div class="module" style="display:flex;justify-content:center">' + ad('leaderboard') + '</div>';

    /* Category spotlights — a module per popular category */
    var topCats = CATEGORIES.slice().sort(function (p, q) { return (q.count || 0) - (p.count || 0); }).slice(0, 3);
    topCats.forEach(function (c, idx) {
      var items = ARTICLES.filter(function (a) { return a.category && a.category.slug === c.slug; }).slice(0, 10);
      if (!items.length) return;
      h += '<section class="module"><div class="module-head"><h2 style="color:' + c.color + '">In ' + esc(c.name) + '</h2>' +
        '<span class="cat-chip" data-cat="' + esc(c.slug) + '" style="color:' + c.color + '">See all ' + (c.count || 0) + '</span></div>' +
        carousel(items, function (a) { return articleBlock(a); }) + '</section>';
      // Sprinkle an ad between the two spotlights
      if (idx === 0) h += '<div class="module" style="display:flex;justify-content:center">' + ad('leaderboard') + '</div>';
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
    h += '<div class="module" style="display:flex;justify-content:center">' + ad('leaderboard') + '</div>';

    /* Quick reads — short articles */
    var quick = sorted.slice().sort(function (p, q) { return (p.readMinutes || 1) - (q.readMinutes || 1); });
    h += '<section class="module"><div class="module-head"><h2>Quick reads</h2><span class="link-orange" style="cursor:default">5 min or less</span></div>' +
      carousel(quick, function (a) { return articleBlock(a, { sm: true }); }, 250) + '</section>';

    /* More to explore — swipeable */
    h += '<section class="module"><div class="module-head"><h2>More to explore</h2></div>' +
      carousel(sorted, function (a) { return articleBlock(a, { sm: true }); }, 250) + '</section>';

    /* Ad rectangles row */
    h += '<div class="row" style="grid-template-columns:1fr"><div class="grid g3">' +
      '<div class="module" style="display:flex;justify-content:center">' + ad('rectangle') + '</div>' +
      '<div class="module" style="display:flex;justify-content:center">' + ad('rectangle') + '</div>' +
      '<div class="module" style="display:flex;justify-content:center">' + ad('rectangle') + '</div>' +
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
    el('modal-host').innerHTML =
      '<div class="modal"><div class="modal-backdrop" data-close="1"></div><div class="modal-panel"><div class="modal-card">' +
      '<div class="modal-top"><div class="t">' + catBadge(a.category) + '<span class="tt">' + esc(a.title) + '</span></div>' +
      '<div style="display:flex;gap:8px;align-items:center">' +
      '<button class="btn btn-sm ' + (isFav(a.id) ? 'btn-primary' : 'btn-outline') + '" data-fav="' + esc(a.slug) + '" data-variant="pill">' + (isFav(a.id) ? ICON.starFill + ' Favorited' : ICON.star + ' Favorite') + '</button>' +
      '<button class="btn btn-sm ' + (isRead(a.id) ? 'btn-primary' : 'btn-outline') + '" data-read="' + esc(a.slug) + '" data-variant="pill">' + (isRead(a.id) ? ICON.bookFill + ' To read' : ICON.book + ' Read later') + '</button>' +
      '<button class="icon-btn" data-share="' + esc(a.slug) + '" title="Share" aria-label="Share">' + ICON.share + '</button>' +
      '<button class="icon-btn" data-close="1" aria-label="Close">' + ICON.x + '</button></div></div>' +
      '<div class="modal-body"><div class="reader" data-article="' + esc(a.slug) + '">' +
      '<div class="clip-hint">' + ICON.clip + ' Tip: highlight any text to turn it into a shareable quote image.</div>' +
      '<h1>' + esc(a.title) + '</h1><div class="rmeta">' + (a.author ? '<span>By ' + esc(a.author) + '</span>' : '') +
      '<span>' + fmtDate(a.publishedAt) + '</span><span>' + ICON.clock + (a.readMinutes || 1) + ' min read</span><span>' + ICON.eye + (a.views || 0) + ' views</span></div>' +
      (a.coverImage ? '<img src="' + esc(a.coverImage) + '" alt="" style="margin-top:24px;border-radius:14px;aspect-ratio:16/9;width:100%;object-fit:cover">' : '') +
      '<div style="margin:24px 0">' + ad('inarticle') + '</div><div class="prose">' + (a.content || '') + '</div>' +
      ((a.tags && a.tags.length) ? '<div style="margin-top:32px;padding-top:24px;border-top:1px solid var(--border);display:flex;flex-wrap:wrap;gap:8px">' + a.tags.map(function (t) { return '<span class="badge" style="border:1px solid var(--border)">#' + esc(t.name) + '</span>'; }).join('') + '</div>' : '') +
      '<div style="margin:32px 0;display:flex;justify-content:center">' + ad('rectangle') + '</div>' +
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
    var text = sel.toString().replace(/\s+/g, ' ').trim(); if (text.length < 4) return null;
    var node = sel.anchorNode; node = node && node.nodeType === 3 ? node.parentNode : node;
    var prose = node && node.closest ? node.closest('.reader .prose') : null;
    var reader = node && node.closest ? node.closest('.reader') : null;
    if (!prose || !reader) return null;
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
  function clipActions(c) {
    return '<div class="clip-actions">' +
      '<button class="btn btn-primary btn-sm" data-download-clip="' + esc(c.id) + '">' + ICON.download + ' Image</button>' +
      (c.slug && bySlug[c.slug] ? '<button class="btn btn-outline btn-sm" data-open="' + esc(c.slug) + '">Open article</button>' : '') +
      '<button class="btn btn-outline btn-sm" data-copy-clip="' + esc(c.id) + '">' + ICON.copy + ' Copy quote</button>' +
      '<button class="btn btn-outline btn-sm btn-del" data-del-clip="' + esc(c.id) + '" title="Delete">' + ICON.trash2 + '</button></div>';
  }
  function renderClippings() {
    var list = getClippings();
    var h = '<div class="content"><section class="module"><div class="module-head"><h2>Your clippings</h2>';
    if (list.length) {
      h += '<div class="clip-view-toggle">' +
        '<button class="' + (clipView === 'cards' ? 'active' : '') + '" data-clipview="cards">Cards</button>' +
        '<button class="' + (clipView === 'images' ? 'active' : '') + '" data-clipview="images">Images</button></div>';
    }
    h += '</div>';
    if (!list.length) {
      h += '<p style="color:var(--muted);margin:0;font-size:16px">No clippings yet. Open an article, <b>highlight</b> a passage, then click <b>Clip</b> to turn it into a shareable quote image you can download.</p>';
    } else if (clipView === 'images') {
      h += '<div class="clip-img-grid">' + list.map(function (c) {
        var img = makeQuoteImage({ quote: c.quote, title: c.title, author: c.author, url: location.host + location.pathname + '#' + (c.slug || ''), slug: c.slug });
        return '<div class="clip-img-card"><img src="' + img + '" alt="Quote image" loading="lazy">' + clipActions(c) + '</div>';
      }).join('') + '</div>';
    } else {
      h += '<div class="clip-grid">' + list.map(function (c) {
        var q = c.quote.length > 200 ? c.quote.slice(0, 197) + '…' : c.quote;
        return '<div class="clip-card"><div class="clip-quote">&ldquo;' + esc(q) + '&rdquo;</div>' +
          '<div class="clip-meta">' + esc(c.title || '') + (c.author ? ' &middot; ' + esc(c.author) : '') + '</div>' +
          clipActions(c) + '</div>';
      }).join('') + '</div>';
    }
    h += '</section></div>';
    el('main').innerHTML = h; window.scrollTo(0, 0);
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
      if (dc) downloadDataUrl(makeQuoteImage({ quote: dc.quote, title: dc.title, author: dc.author, url: location.host + location.pathname + '#' + (dc.slug || ''), slug: dc.slug }), 'rsnews-clip-' + (dc.slug || 'quote') + '.png'); toast('Image downloaded'); return; }
    var copyClip = e.target.closest('[data-copy-clip]'); if (copyClip) { e.preventDefault(); var cc = getClippings().filter(function (x) { return x.id === copyClip.getAttribute('data-copy-clip'); })[0];
      if (cc && navigator.clipboard) navigator.clipboard.writeText(clipShareText(cc)); toast('Quote copied'); return; }
    var clipViewBtn = e.target.closest('[data-clipview]'); if (clipViewBtn) { e.preventDefault(); clipView = clipViewBtn.getAttribute('data-clipview'); renderClippings(); return; }
    var delClip = e.target.closest('[data-del-clip]'); if (delClip) { e.preventDefault(); removeClipping(delClip.getAttribute('data-del-clip')); renderClippings(); return; }
    var t = e.target.closest('[data-open],[data-close],[data-fav],[data-read],[data-unread],[data-cat],[data-topic],[data-home],[data-history],[data-clippings],[data-clearhistory]');
    if (!t) return;
    if (t.hasAttribute('data-clippings')) { e.preventDefault(); setActive(t); renderClippings(); closeDrawer(); window.scrollTo(0, 0); return; }
    if (t.hasAttribute('data-fav')) { e.preventDefault(); e.stopPropagation(); toggleFav(t.getAttribute('data-fav')); return; }
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
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeModal(); closeDrawer(); } });
  window.addEventListener('popstate', function () { var hs = (location.hash || '').replace('#', ''); if (hs && bySlug[hs]) openModal(hs, false); else closeModal(false); });
  document.addEventListener('input', function (e) { if (!e.target.matches('[data-search]')) return; var i = e.target, q = i.value;
    if (q.trim().length < 2) { var b = i.parentNode.querySelector('.suggest'); if (b) b.remove(); return; } renderSuggest(i, searchArticles(q)); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.matches && e.target.matches('[data-search]')) { e.preventDefault(); var q = e.target.value.trim(); var b = e.target.parentNode.querySelector('.suggest'); if (b) b.remove(); if (q) runSearch(q); } });
  document.addEventListener('click', function (e) { if (!e.target.closest('.search')) document.querySelectorAll('.suggest').forEach(function (b) { b.remove(); }); });

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
