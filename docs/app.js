/* RSNews Hub — static preview app. Client-side, data from data.js.
   Favorites (star) + To-read (open book, pins to top strip) + theme toggle. */
(function () {
  'use strict';
  var DATA = window.__DATA__ || { articles: [], categories: [] };
  var ARTICLES = DATA.articles || [];
  var CATEGORIES = DATA.categories || [];
  var bySlug = {};
  ARTICLES.forEach(function (a) { bySlug[a.slug] = a; });
  var FAV_KEY = 'rsnews_favorites_v1';
  var READ_KEY = 'rsnews_toread_v1';
  var HIST_KEY = 'rsnews_history_v1';
  var HIST_MAX = 50;
  var THEME_KEY = 'rsnews_theme';

  /* ---------- helpers ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function el(id) { return document.getElementById(id); }
  function fmtDate(iso) { if (!iso) return ''; try { return new Date(iso).toLocaleDateString('en-US',
    { year: 'numeric', month: 'short', day: 'numeric' }); } catch (e) { return ''; } }
  var ICON = {
    search: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
    star: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9L12 3.5Z"/></svg>',
    starFill: '<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9L12 3.5Z"/></svg>',
    book: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M12 6.6C9.5 5.1 6 4.8 3 5.7V19c3-.9 6.5-.6 9 .9 2.5-1.5 6-1.8 9-.9V5.7c-3-.9-6.5-.6-9 .9Z"/><path d="M12 6.6V20"/></svg>',
    bookFill: '<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"><path d="M12 6.6C9.5 5.1 6 4.8 3 5.7V19c3-.9 6.5-.6 9 .9 2.5-1.5 6-1.8 9-.9V5.7c-3-.9-6.5-.6-9 .9Z"/><path d="M12 6.6V20" stroke="#fff" stroke-width="1.4"/></svg>',
    bookSm: '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 6.6C9.5 5.1 6 4.8 3 5.7V19c3-.9 6.5-.6 9 .9 2.5-1.5 6-1.8 9-.9V5.7c-3-.9-6.5-.6-9 .9Z"/></svg>',
    x: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    clock: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    clockLg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" stroke-width="2" stroke-linecap="round" style="display:inline;vertical-align:-3px"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    eye: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
    arrow: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    spark: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3Z"/></svg>',
    sun: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/></svg>',
    moon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>'
  };

  /* ---------- theme ---------- */
  function applyTheme(t) {
    document.documentElement.classList.toggle('dark', t === 'dark');
    var b = el('theme-btn'); if (b) b.innerHTML = t === 'dark' ? ICON.sun : ICON.moon;
  }
  function initTheme() {
    var t; try { t = localStorage.getItem(THEME_KEY); } catch (e) {}
    if (!t) t = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    applyTheme(t);
  }
  function toggleTheme() {
    var dark = document.documentElement.classList.contains('dark');
    var t = dark ? 'light' : 'dark';
    try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
    applyTheme(t);
  }

  /* ---------- lists (favorites + to-read) ---------- */
  function read(key) { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { return []; } }
  function write(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }
  function inList(key, id) { return read(key).some(function (s) { return s.id === id; }); }
  function toggleList(key, slug) {
    var a = bySlug[slug]; if (!a) return;
    var list = read(key);
    if (inList(key, a.id)) list = list.filter(function (s) { return s.id !== a.id; });
    else list = [{ id: a.id, title: a.title, slug: a.slug }].concat(list);
    write(key, list);
  }
  function isFav(id) { return inList(FAV_KEY, id); }
  function isRead(id) { return inList(READ_KEY, id); }

  /* ---------- history (last accessed) ---------- */
  function getHistory() { return read(HIST_KEY); }
  function recordHistory(a) {
    if (!a) return;
    var list = read(HIST_KEY).filter(function (s) { return s.id !== a.id; });
    list.unshift({ id: a.id, title: a.title, slug: a.slug, ts: Date.now() });
    if (list.length > HIST_MAX) list = list.slice(0, HIST_MAX);
    write(HIST_KEY, list);
  }
  function clearHistory() { write(HIST_KEY, []); }
  function timeAgo(ts) {
    if (!ts) return '';
    var s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
    if (s < 60) return 'just now';
    var m = Math.floor(s / 60); if (m < 60) return m + ' min ago';
    var h = Math.floor(m / 60); if (h < 24) return h + (h === 1 ? ' hour ago' : ' hours ago');
    var d = Math.floor(h / 24); if (d < 7) return d + (d === 1 ? ' day ago' : ' days ago');
    try { return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); } catch (e) { return ''; }
  }
  function toggleFav(slug) { toggleList(FAV_KEY, slug); syncButtons(); }
  function toggleRead(slug) { toggleList(READ_KEY, slug); renderStrip(); syncButtons(); }
  function removeRead(id) { write(READ_KEY, read(READ_KEY).filter(function (s) { return s.id !== id; })); renderStrip(); syncButtons(); }

  function renderStrip() {
    var wrap = el('strip'); if (!wrap) return;
    var list = read(READ_KEY);
    if (!list.length) { wrap.innerHTML = ''; wrap.style.display = 'none'; return; }
    wrap.style.display = 'block';
    var chips = list.map(function (s) {
      return '<div class="chip"><span data-open="' + esc(s.slug) + '" style="display:flex;align-items:center;gap:6px;min-width:0">' +
        '<span style="color:var(--orange);flex-shrink:0">' + ICON.bookSm + '</span>' +
        '<span class="chip-title">' + esc(s.title) + '</span></span>' +
        '<span class="chip-x" data-unread="' + esc(s.id) + '" title="Remove from to-read">' + ICON.x + '</span></div>';
    }).join('');
    wrap.innerHTML = '<div class="strip"><div class="container"><div class="strip-inner">' +
      '<span class="strip-label">' + ICON.bookSm + '<span class="show-lg-none-inline" style="display:inline">To read</span></span>' +
      '<div class="chips">' + chips + '</div></div></div></div>';
  }
  function syncButtons() {
    document.querySelectorAll('[data-fav]').forEach(function (btn) {
      var a = bySlug[btn.getAttribute('data-fav')]; if (!a) return;
      var on = isFav(a.id); btn.classList.toggle('on', on);
      if (btn.getAttribute('data-variant') === 'pill') btn.innerHTML = (on ? ICON.starFill : ICON.star) + (on ? ' Favorited' : ' Favorite');
      else btn.innerHTML = on ? ICON.starFill : ICON.star;
    });
    document.querySelectorAll('[data-read]').forEach(function (btn) {
      var a = bySlug[btn.getAttribute('data-read')]; if (!a) return;
      var on = isRead(a.id); btn.classList.toggle('on', on);
      if (btn.getAttribute('data-variant') === 'pill') btn.innerHTML = (on ? ICON.bookFill : ICON.book) + (on ? ' To read' : ' Read later');
      else btn.innerHTML = on ? ICON.bookFill : ICON.book;
    });
  }

  /* ---------- cards ---------- */
  function acts(slug) {
    return '<div class="acts">' +
      '<button class="iconbtn" data-fav="' + esc(slug) + '" title="Add to favorites" aria-label="Favorite">' + ICON.star + '</button>' +
      '<button class="iconbtn" data-read="' + esc(slug) + '" title="Save to read later (pins to top)" aria-label="Read later">' + ICON.book + '</button>' +
      '</div>';
  }
  function catBadge(c) { return c ? '<span class="badge" style="background:' + c.color + '22;color:' + c.color + '">' + esc(c.name) + '</span>' : ''; }

  function articleCard(a, opts) {
    opts = opts || {};
    var cls = 'card-hover acard' + (opts.compact ? ' compact' : '') + (opts.tile ? ' tile' : ' card');
    var cover = (opts.cover && a.coverImage) ? '<img class="cover" src="' + esc(a.coverImage) + '" alt="" loading="lazy">' : '';
    var accent = (a.category ? a.category.color : 'var(--orange)');
    return '<article class="' + cls + '">' + acts(a.slug) +
      '<a href="#' + esc(a.slug) + '" data-open="' + esc(a.slug) + '" style="display:flex;flex-direction:column;height:100%">' + cover +
      (cover ? '' : '<span style="display:block;height:4px;background:' + accent + '"></span>') +
      '<div class="body"><div>' + catBadge(a.category) + '</div>' +
      '<h3>' + esc(a.title) + '</h3>' +
      (!opts.compact && a.excerpt ? '<p class="excerpt">' + esc(a.excerpt) + '</p>' : '') +
      '<div class="meta"><span>' + fmtDate(a.publishedAt) + '</span>' +
      '<span>' + ICON.clock + (a.readMinutes || 1) + ' min</span>' +
      '<span>' + ICON.eye + (a.views || 0) + '</span></div>' +
      '</div></a></article>';
  }

  function ad(kind) {
    var meta = { leaderboard: '728 × 90', rectangle: '300 × 250', inarticle: 'In-article' }[kind] || '';
    return '<div class="ad ad-' + kind + '"><div class="ad-inner"><span class="ad-label">Advertisement</span><span class="ad-size">' + meta + '</span></div></div>';
  }

  /* ---------- recommendations ---------- */
  function related(a) {
    var tagset = {}; (a.tags || []).forEach(function (t) { tagset[t.slug] = 1; });
    return ARTICLES.filter(function (x) { return x.id !== a.id; }).map(function (x) {
      var score = 0; (x.tags || []).forEach(function (t) { if (tagset[t.slug]) score += 3; });
      if (a.category && x.category && a.category.slug === x.category.slug) score += 2;
      return { x: x, score: score };
    }).sort(function (p, q) { return q.score - p.score || (q.x.views || 0) - (p.x.views || 0); }).slice(0, 3).map(function (s) { return s.x; });
  }
  function nextArticle(a) {
    return ARTICLES.filter(function (x) { return x.id !== a.id && new Date(x.publishedAt) < new Date(a.publishedAt); })
      .sort(function (p, q) { return new Date(q.publishedAt) - new Date(p.publishedAt); })[0] || null;
  }

  /* ---------- home ---------- */
  function renderHome() {
    var sorted = ARTICLES.slice().sort(function (p, q) { return new Date(q.publishedAt) - new Date(p.publishedAt); });
    var featured = sorted.filter(function (a) { return a.featured; });
    var lead = featured[0] || sorted[0];
    if (!lead) { el('main').innerHTML = '<div class="container" style="padding:64px 16px;color:#fff">No articles yet.</div>'; return; }
    // Pick 2 supporting stories; only lead + those 2 are excluded from "latest".
    var excl = {}; excl[lead.id] = 1;
    var support = [];
    featured.slice(1).concat(sorted).forEach(function (a) {
      if (!excl[a.id] && support.length < 2) { excl[a.id] = 1; support.push(a); }
    });
    var trending = ARTICLES.slice().sort(function (p, q) { return (q.views || 0) - (p.views || 0); }).slice(0, 5);
    var recommend = trending.slice(0, 3);
    var latest = sorted.filter(function (a) { return !excl[a.id]; });

    var html = '<div class="container" style="padding:24px 0 8px">';

    /* Headline (fixed, large) */
    html += '<section class="headline"><div class="headline-grid">' +
      '<article class="card card-hover lead">' + acts(lead.slug) +
      '<a href="#' + esc(lead.slug) + '" data-open="' + esc(lead.slug) + '"><div class="lead-inner">' +
      (lead.coverImage ? '<div class="cover"><img src="' + esc(lead.coverImage) + '" alt="" style="height:100%;width:100%;object-fit:cover"></div>'
        : '<div class="cover lead-decor"><span class="decor-mark">RS</span></div>') +
      '<div class="content"><div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">' +
      '<span class="badge" style="background:var(--orange-soft);color:var(--orange)">Headline</span>' +
      (lead.category ? '<span style="font-size:12px;font-weight:600;color:' + lead.category.color + '">' + esc(lead.category.name) + '</span>' : '') + '</div>' +
      '<h1>' + esc(lead.title) + '</h1>' + (lead.excerpt ? '<p class="excerpt" style="margin-top:10px">' + esc(lead.excerpt) + '</p>' : '') +
      '<div style="margin-top:16px;color:var(--orange);font-weight:700;font-size:14px;display:flex;align-items:center;gap:8px">Read article ' + ICON.arrow + '</div>' +
      '</div></div></a></article>' +
      '<div class="support">' + support.map(function (a) {
        return '<article class="card card-hover acard">' + acts(a.slug) +
          '<a href="#' + esc(a.slug) + '" data-open="' + esc(a.slug) + '" style="display:flex;height:100%">' +
          (a.coverImage ? '<div class="thumb"><img src="' + esc(a.coverImage) + '" alt=""></div>' : '') +
          '<div class="body">' + (a.category ? '<span style="font-size:12px;font-weight:600;color:' + a.category.color + '">' + esc(a.category.name) + '</span>' : '') +
          '<h3>' + esc(a.title) + '</h3><span class="meta" style="margin-top:8px">' + ICON.eye + (a.views || 0) + '</span></div></a></article>';
      }).join('') + '</div>' +
      '</div></section>';

    /* Mobile search */
    html += '<div class="show-sm" style="margin-bottom:24px"><div class="search"><span class="search-icon">' + ICON.search + '</span><input type="search" placeholder="Search articles…" data-search="1"></div></div>';

    /* Feature region: big Latest module (left) + rail of nested modules (right) */
    html += '<div class="feature">';

    // Left: large module containing a nested grid + a nested ad tile
    var leftItems = latest.slice(0, 8);
    html += '<section class="module"><div class="module-head"><h2>Latest articles</h2><a class="link-orange" href="#" data-home="1">View all</a></div>' +
      '<div class="grid cols-2">';
    leftItems.slice(0, 2).forEach(function (a) { html += articleCard(a, { tile: true, cover: true }); });
    html += '<div class="tile" style="grid-column:1/-1;display:flex;align-items:center;justify-content:center;padding:14px">' + ad('rectangle') + '</div>';
    leftItems.slice(2).forEach(function (a) { html += articleCard(a, { tile: true, cover: true }); });
    html += '</div></section>';

    // Right rail: recommended, trending, categories (each a module = module-in-module)
    html += '<div class="rail">';
    if (recommend.length) {
      html += '<section class="module"><div class="module-head"><h2><span style="color:var(--orange)">' + ICON.spark + '</span> You might like</h2></div><div class="grid" style="gap:12px">' +
        recommend.map(function (a) { return articleCard(a, { tile: true, compact: true }); }).join('') + '</div></section>';
    }
    if (trending.length) {
      html += '<section class="module"><div class="module-head"><h2>Trending</h2></div><div>' +
        trending.map(function (a, i) {
          return '<div class="mini" data-open="' + esc(a.slug) + '"><span class="n">' + (i + 1) + '</span>' +
            '<span class="mt">' + esc(a.title) + '</span><span class="mv">' + ICON.eye + (a.views || 0) + '</span></div>';
        }).join('') + '</div></section>';
    }
    if (CATEGORIES.length) {
      html += '<section class="module"><div class="module-head"><h2>Categories</h2></div><div class="cats">' +
        CATEGORIES.map(function (c) { return '<span class="cat-chip" data-cat="' + esc(c.slug) + '" style="color:' + c.color + '">' + esc(c.name) + '<span class="count">' + (c.count || 0) + '</span></span>'; }).join('') +
        '</div></section>';
    }
    html += '<section class="module" style="display:flex;justify-content:center">' + ad('rectangle') + '</section>';
    html += '</div>'; // rail
    html += '</div>'; // feature

    /* Leaderboard ad */
    html += '<section class="module section" style="display:flex;justify-content:center">' + ad('leaderboard') + '</section>';

    html += '</div>';
    el('main').innerHTML = html;
    syncButtons();
  }

  /* ---------- search ---------- */
  function searchArticles(q) {
    q = q.trim().toLowerCase(); if (q.length < 1) return [];
    var terms = q.split(/\s+/).slice(0, 6);
    return ARTICLES.map(function (a) {
      var hay = (a.title + ' ' + (a.excerpt || '') + ' ' + (a.content || '') + ' ' + (a.category ? a.category.name : '') + ' ' +
        (a.tags || []).map(function (t) { return t.name; }).join(' ')).toLowerCase();
      var score = 0;
      terms.forEach(function (t) { if (a.title.toLowerCase().indexOf(t) >= 0) score += 10; if (hay.indexOf(t) >= 0) score += 2; });
      return { a: a, score: score };
    }).filter(function (s) { return s.score > 0; }).sort(function (p, q2) { return q2.score - p.score; }).map(function (s) { return s.a; });
  }
  function renderSuggest(input, results) {
    var box = input.parentNode.querySelector('.suggest'); if (box) box.remove();
    if (!results.length) return;
    box = document.createElement('div'); box.className = 'suggest';
    box.innerHTML = results.slice(0, 6).map(function (a) {
      return '<a href="#' + esc(a.slug) + '" data-open="' + esc(a.slug) + '"><span style="font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(a.title) + '</span>' +
        (a.category ? '<span class="cat">' + esc(a.category.name) + '</span>' : '') + '</a>';
    }).join('');
    input.parentNode.appendChild(box);
  }
  function runSearch(q) {
    var results = searchArticles(q);
    var html = '<div class="container" style="padding:24px 0"><section class="module"><div class="module-head"><h2>Search</h2><a href="#" data-home="1" class="link-orange">Back home</a></div>' +
      '<p style="color:var(--muted);margin:0 0 16px">' + results.length + ' result' + (results.length === 1 ? '' : 's') + ' for "' + esc(q) + '"</p>';
    html += results.length ? '<div class="grid cols-3">' + results.map(function (a) { return articleCard(a, { tile: true, cover: true }); }).join('') + '</div>'
      : '<p style="color:var(--muted)">No articles matched.</p>';
    html += '</section></div>';
    el('main').innerHTML = html; syncButtons(); window.scrollTo(0, 0);
  }

  /* ---------- history view ---------- */
  function renderHistory() {
    var list = getHistory();
    var html = '<div class="container" style="padding:24px 0"><section class="module">' +
      '<div class="module-head"><h2>' + ICON.clockLg + ' Your history</h2>' +
      (list.length ? '<button class="btn btn-outline btn-sm" data-clearhistory="1">Clear history</button>' : '') + '</div>';
    if (!list.length) {
      html += '<p style="color:var(--muted);margin:0">No history yet. Open a few articles and they\'ll show up here — handy for finding one you clicked away from.</p>';
    } else {
      html += '<p style="color:var(--muted);margin:0 0 16px">The last ' + list.length + ' article' + (list.length === 1 ? '' : 's') + ' you opened, most recent first.</p><div>';
      html += list.map(function (s) {
        var a = bySlug[s.slug];
        return '<div class="mini" data-open="' + esc(s.slug) + '" style="border-radius:12px">' +
          '<span style="color:var(--muted);flex-shrink:0">' + ICON.clock + '</span>' +
          '<span class="mt">' + esc(s.title) + (a && a.category ? ' <span style="color:' + a.category.color + ';font-weight:600;font-size:12px">· ' + esc(a.category.name) + '</span>' : '') + '</span>' +
          '<span class="mv">' + esc(timeAgo(s.ts)) + '</span></div>';
      }).join('') + '</div>';
    }
    html += '</section></div>';
    el('main').innerHTML = html; window.scrollTo(0, 0);
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
      '<button class="icon-btn" data-close="1" aria-label="Close">' + ICON.x + '</button></div></div>' +
      '<div class="modal-body"><div class="reader">' +
      '<h1>' + esc(a.title) + '</h1>' +
      '<div class="rmeta">' + (a.author ? '<span>By ' + esc(a.author) + '</span>' : '') +
      '<span>' + fmtDate(a.publishedAt) + '</span><span>' + ICON.clock + (a.readMinutes || 1) + ' min read</span><span>' + ICON.eye + (a.views || 0) + ' views</span></div>' +
      (a.coverImage ? '<img src="' + esc(a.coverImage) + '" alt="" style="margin-top:24px;border-radius:12px;aspect-ratio:16/9;width:100%;object-fit:cover">' : '') +
      '<div style="margin:24px 0">' + ad('inarticle') + '</div>' +
      '<div class="prose">' + (a.content || '') + '</div>' +
      ((a.tags && a.tags.length) ? '<div style="margin-top:32px;padding-top:24px;border-top:1px solid var(--border);display:flex;flex-wrap:wrap;gap:8px">' +
        a.tags.map(function (t) { return '<span class="badge" style="border:1px solid var(--border)">#' + esc(t.name) + '</span>'; }).join('') + '</div>' : '') +
      '<div style="margin:32px 0;display:flex;justify-content:center">' + ad('rectangle') + '</div>' +
      (nx ? '<div class="card card-hover next" data-open="' + esc(nx.slug) + '"><div><div class="lbl">Read next</div><div class="nt">' + esc(nx.title) + '</div></div><span style="color:var(--orange)">' + ICON.arrow + '</span></div>' : '') +
      (rel.length ? '<div style="margin-top:32px"><h2 style="font-size:14px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:800;margin:0 0 12px">If you read this, you might like…</h2>' +
        '<div class="grid cols-3">' + rel.map(function (r) {
          return '<div class="tile card-hover" data-open="' + esc(r.slug) + '" style="padding:16px;cursor:pointer">' +
            (r.category ? '<span style="font-size:12px;font-weight:600;color:' + r.category.color + '">' + esc(r.category.name) + '</span>' : '') +
            '<div style="margin-top:4px;font-weight:600;font-size:14px">' + esc(r.title) + '</div></div>';
        }).join('') + '</div></div>' : '') +
      '</div></div></div></div></div>';
    var body = el('modal-host').querySelector('.modal-body'); if (body) body.scrollTop = 0;
  }
  function closeModal(pop) {
    el('modal-host').innerHTML = '';
    document.body.classList.remove('modal-open');
    if (pop !== false && (location.hash || (history.state && history.state.m))) {
      try { history.pushState('', '', location.pathname + location.search); } catch (e) {}
    }
  }

  /* ---------- events ---------- */
  document.addEventListener('click', function (e) {
    var themeBtn = e.target.closest('#theme-btn'); if (themeBtn) { toggleTheme(); return; }
    var t = e.target.closest('[data-open],[data-close],[data-fav],[data-read],[data-unread],[data-cat],[data-home],[data-history],[data-clearhistory]');
    if (!t) return;
    if (t.hasAttribute('data-history')) { e.preventDefault(); renderHistory(); window.scrollTo(0, 0); return; }
    if (t.hasAttribute('data-clearhistory')) { e.preventDefault(); clearHistory(); renderHistory(); return; }
    if (t.hasAttribute('data-fav')) { e.preventDefault(); e.stopPropagation(); toggleFav(t.getAttribute('data-fav')); return; }
    if (t.hasAttribute('data-read')) { e.preventDefault(); e.stopPropagation(); toggleRead(t.getAttribute('data-read')); return; }
    if (t.hasAttribute('data-unread')) { e.preventDefault(); e.stopPropagation(); removeRead(t.getAttribute('data-unread')); return; }
    if (t.hasAttribute('data-open')) { e.preventDefault(); openModal(t.getAttribute('data-open')); return; }
    if (t.hasAttribute('data-close')) { e.preventDefault(); closeModal(); return; }
    if (t.hasAttribute('data-cat')) { e.preventDefault(); var c = CATEGORIES.filter(function (x) { return x.slug === t.getAttribute('data-cat'); })[0]; runSearch(c ? c.name : t.getAttribute('data-cat')); return; }
    if (t.hasAttribute('data-home')) { e.preventDefault(); renderHome(); window.scrollTo(0, 0); return; }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
  window.addEventListener('popstate', function () {
    var h = (location.hash || '').replace('#', '');
    if (h && bySlug[h]) openModal(h, false); else closeModal(false);
  });
  document.addEventListener('input', function (e) {
    if (!e.target.matches('[data-search]')) return;
    var input = e.target, q = input.value;
    if (q.trim().length < 2) { var b = input.parentNode.querySelector('.suggest'); if (b) b.remove(); return; }
    renderSuggest(input, searchArticles(q));
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.matches && e.target.matches('[data-search]')) {
      e.preventDefault(); var q = e.target.value.trim();
      var b = e.target.parentNode.querySelector('.suggest'); if (b) b.remove();
      if (q) runSearch(q);
    }
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.search')) document.querySelectorAll('.suggest').forEach(function (b) { b.remove(); });
  });

  /* ---------- init ---------- */
  initTheme();
  renderStrip();
  renderHome();
  var h = (location.hash || '').replace('#', '');
  if (h && bySlug[h]) openModal(h, false);
})();
