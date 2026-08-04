/* RSNews Hub — static preview app. All client-side, data from data.js. */
(function () {
  'use strict';
  var DATA = window.__DATA__ || { articles: [], categories: [] };
  var ARTICLES = DATA.articles || [];
  var CATEGORIES = DATA.categories || [];
  var bySlug = {};
  ARTICLES.forEach(function (a) { bySlug[a.slug] = a; });
  var STAR_KEY = 'rsnews_stars_v1';

  /* ---------- helpers ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function el(id) { return document.getElementById(id); }
  function fmtDate(iso) { if (!iso) return ''; try { return new Date(iso).toLocaleDateString('en-US',
    { year: 'numeric', month: 'short', day: 'numeric' }); } catch (e) { return ''; } }
  var ICON = {
    search: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
    star: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9L12 3.5Z"/></svg>',
    starFill: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9L12 3.5Z"/></svg>',
    starSm: '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9L12 3.5Z"/></svg>',
    x: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    clock: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    eye: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
    arrow: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    spark: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3Z"/></svg>'
  };

  /* ---------- stars ---------- */
  function getStars() { try { return JSON.parse(localStorage.getItem(STAR_KEY) || '[]'); } catch (e) { return []; } }
  function setStars(v) { try { localStorage.setItem(STAR_KEY, JSON.stringify(v)); } catch (e) {} }
  function isStarred(id) { return getStars().some(function (s) { return s.id === id; }); }
  function toggleStar(slug) {
    var a = bySlug[slug]; if (!a) return;
    var stars = getStars();
    if (isStarred(a.id)) stars = stars.filter(function (s) { return s.id !== a.id; });
    else stars = [{ id: a.id, title: a.title, slug: a.slug }].concat(stars);
    setStars(stars); renderStrip(); syncStarButtons();
  }
  function removeStar(id) { setStars(getStars().filter(function (s) { return s.id !== id; })); renderStrip(); syncStarButtons(); }

  function renderStrip() {
    var wrap = el('strip'); if (!wrap) return;
    var stars = getStars();
    if (!stars.length) { wrap.innerHTML = ''; wrap.style.display = 'none'; return; }
    wrap.style.display = 'block';
    var chips = stars.map(function (s) {
      return '<div class="chip"><span data-open="' + esc(s.slug) + '" style="display:flex;align-items:center;gap:6px;min-width:0">' +
        '<span style="color:var(--brand-500);flex-shrink:0">' + ICON.starSm + '</span>' +
        '<span class="chip-title">' + esc(s.title) + '</span></span>' +
        '<span class="chip-x" data-unstar="' + esc(s.id) + '" title="Unstar">' + ICON.x + '</span></div>';
    }).join('');
    wrap.innerHTML = '<div class="strip"><div class="container"><div class="strip-inner">' +
      '<span class="strip-label">' + ICON.starSm + '<span class="hide-lg-none">Starred</span></span>' +
      '<div class="chips">' + chips + '</div></div></div></div>';
  }
  function syncStarButtons() {
    document.querySelectorAll('[data-star]').forEach(function (btn) {
      var a = bySlug[btn.getAttribute('data-star')]; if (!a) return;
      var on = isStarred(a.id);
      btn.classList.toggle('on', on);
      btn.innerHTML = on ? ICON.starFill : ICON.star;
    });
  }

  /* ---------- cards ---------- */
  function starBtn(slug) { return '<button class="star-btn" data-star="' + esc(slug) + '" aria-label="Star">' + ICON.star + '</button>'; }
  function catBadge(c) { return c ? '<span class="badge" style="background:' + c.color + '22;color:' + c.color + '">' + esc(c.name) + '</span>' : ''; }

  function articleCard(a, opts) {
    opts = opts || {};
    var compact = opts.compact;
    return '<article class="card card-hover acard' + (compact ? ' compact' : '') + '">' +
      starBtn(a.slug) +
      '<a href="#' + esc(a.slug) + '" data-open="' + esc(a.slug) + '" style="display:flex;flex-direction:column;height:100%">' +
      (a.coverImage && !compact ? '<img class="cover" src="' + esc(a.coverImage) + '" alt="" loading="lazy">' : '') +
      '<div class="body"><div>' + catBadge(a.category) + '</div>' +
      '<h3>' + esc(a.title) + '</h3>' +
      (!compact && a.excerpt ? '<p class="excerpt">' + esc(a.excerpt) + '</p>' : '') +
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
    var scored = ARTICLES.filter(function (x) { return x.id !== a.id; }).map(function (x) {
      var score = 0;
      (x.tags || []).forEach(function (t) { if (tagset[t.slug]) score += 3; });
      if (a.category && x.category && a.category.slug === x.category.slug) score += 2;
      return { x: x, score: score };
    }).sort(function (p, q) { return q.score - p.score || (q.x.views || 0) - (p.x.views || 0); });
    return scored.slice(0, 3).map(function (s) { return s.x; });
  }
  function nextArticle(a) {
    var older = ARTICLES.filter(function (x) { return x.id !== a.id &&
      new Date(x.publishedAt) < new Date(a.publishedAt); })
      .sort(function (p, q) { return new Date(q.publishedAt) - new Date(p.publishedAt); });
    return older[0] || null;
  }

  /* ---------- home ---------- */
  function renderHome() {
    var sorted = ARTICLES.slice().sort(function (p, q) { return new Date(q.publishedAt) - new Date(p.publishedAt); });
    var featured = sorted.filter(function (a) { return a.featured; });
    var lead = featured[0] || sorted[0];
    if (!lead) { el('main').innerHTML = '<div class="container" style="padding:64px 16px;color:var(--muted)">No articles yet.</div>'; return; }
    var used = {}; used[lead.id] = 1;
    var support = featured.slice(1).concat(sorted).filter(function (a) { if (used[a.id]) return false; used[a.id] = 1; return true; }).slice(0, 2);
    support.forEach(function (a) { used[a.id] = 1; });
    var trending = ARTICLES.slice().sort(function (p, q) { return (q.views || 0) - (p.views || 0); }).slice(0, 4);
    var recommend = trending.slice(0, 3);
    var latest = sorted.filter(function (a) { return !used[a.id]; });

    var html = '<div class="container" style="padding:24px 0 8px">';

    /* Headline (fixed) */
    html += '<section class="headline"><div class="headline-grid">' +
      '<article class="card card-hover lead">' + starBtn(lead.slug) +
      '<a href="#' + esc(lead.slug) + '" data-open="' + esc(lead.slug) + '"><div class="lead-inner">' +
      '<div class="cover">' + (lead.coverImage ? '<img src="' + esc(lead.coverImage) + '" alt="" style="height:100%;width:100%;object-fit:cover">' : '') + '</div>' +
      '<div class="content"><div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">' +
      '<span class="badge" style="background:var(--brand-100);color:var(--brand-700)">Headline</span>' +
      (lead.category ? '<span style="font-size:12px;font-weight:600;color:' + lead.category.color + '">' + esc(lead.category.name) + '</span>' : '') + '</div>' +
      '<h1>' + esc(lead.title) + '</h1>' + (lead.excerpt ? '<p class="excerpt" style="margin-top:8px">' + esc(lead.excerpt) + '</p>' : '') +
      '<div style="margin-top:16px;color:var(--brand-600);font-weight:600;font-size:14px;display:flex;align-items:center;gap:8px">Read article ' + ICON.arrow + '</div>' +
      '</div></div></a></article>' +
      '<div class="support">' + support.map(function (a) {
        return '<article class="card card-hover acard">' + starBtn(a.slug) +
          '<a href="#' + esc(a.slug) + '" data-open="' + esc(a.slug) + '" style="display:flex;height:100%">' +
          '<div class="thumb">' + (a.coverImage ? '<img src="' + esc(a.coverImage) + '" alt="">' : '') + '</div>' +
          '<div class="body">' + (a.category ? '<span style="font-size:12px;font-weight:600;color:' + a.category.color + '">' + esc(a.category.name) + '</span>' : '') +
          '<h3>' + esc(a.title) + '</h3><span class="meta" style="margin-top:8px">' + ICON.eye + (a.views || 0) + '</span></div></a></article>';
      }).join('') + '</div>' +
      '</div></section>';

    /* Mobile search */
    html += '<div class="show-sm" style="margin-bottom:32px"><div class="search"><span class="search-icon">' + ICON.search + '</span><input type="search" placeholder="Search articles…" data-search="1"></div></div>';

    /* Recommended */
    if (recommend.length) {
      html += '<section class="section"><h2 style="color:inherit">' + '<span style="color:var(--brand-600)">' + ICON.spark + '</span> You might like</h2>' +
        '<div class="grid cols-3">' + recommend.map(function (a) { return articleCard(a); }).join('') + '</div></section>';
    }

    /* Ad — leaderboard */
    html += '<div class="section">' + ad('leaderboard') + '</div>';

    /* Categories */
    if (CATEGORIES.length) {
      html += '<section class="section"><div class="cats">' + CATEGORIES.map(function (c) {
        return '<span class="cat-chip" data-cat="' + esc(c.slug) + '" style="color:' + c.color + ';cursor:pointer">' + esc(c.name) + '<span class="count">' + (c.count || 0) + '</span></span>';
      }).join('') + '</div></section>';
    }

    /* Latest + in-grid ad */
    html += '<section class="section"><div class="section-head"><h2>Latest articles</h2></div><div class="grid cols-3">';
    latest.slice(0, 6).forEach(function (a) { html += articleCard(a); });
    if (latest.length > 3) html += '<div style="display:flex;align-items:center;justify-content:center">' + ad('rectangle') + '</div>';
    latest.slice(6).forEach(function (a) { html += articleCard(a); });
    html += '</div></section>';

    /* Trending */
    if (trending.length) {
      html += '<section class="section"><h2>Trending</h2><div class="grid cols-4">' +
        trending.map(function (a, i) { return '<div style="position:relative"><span class="rank">' + (i + 1) + '</span>' + articleCard(a, { compact: true }) + '</div>'; }).join('') +
        '</div></section>';
    }

    /* Ad rectangles row */
    html += '<div class="section grid cols-3">' + ad('rectangle') + ad('rectangle') + '<div class="hide-lg">' + ad('rectangle') + '</div></div>';

    html += '</div>';
    el('main').innerHTML = html;
    syncStarButtons();
  }

  /* ---------- search ---------- */
  function searchArticles(q) {
    q = q.trim().toLowerCase(); if (q.length < 1) return [];
    var terms = q.split(/\s+/).slice(0, 6);
    return ARTICLES.map(function (a) {
      var hay = (a.title + ' ' + (a.excerpt || '') + ' ' + (a.content || '') + ' ' + (a.category ? a.category.name : '') + ' ' +
        (a.tags || []).map(function (t) { return t.name; }).join(' ')).toLowerCase();
      var score = 0;
      terms.forEach(function (t) {
        if (a.title.toLowerCase().indexOf(t) >= 0) score += 10;
        if (hay.indexOf(t) >= 0) score += 2;
      });
      return { a: a, score: score };
    }).filter(function (s) { return s.score > 0; }).sort(function (p, q2) { return q2.score - p.score; }).map(function (s) { return s.a; });
  }
  function renderSuggest(input, results) {
    var box = input.parentNode.querySelector('.suggest');
    if (box) box.remove();
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
    var html = '<div class="container" style="padding:24px 0"><h2 style="font-size:22px;font-weight:800;margin:0 0 4px">Search</h2>' +
      '<p style="color:var(--muted);margin:0 0 20px">' + results.length + ' result' + (results.length === 1 ? '' : 's') + ' for "' + esc(q) + '" · <a href="#" data-home="1" class="link-orange">back home</a></p>';
    html += results.length ? '<div class="grid cols-3">' + results.map(function (a) { return articleCard(a); }).join('') + '</div>'
      : '<div class="card" style="padding:32px;text-align:center;color:var(--muted)">No articles matched.</div>';
    html += '</div>';
    el('main').innerHTML = html; syncStarButtons();
    window.scrollTo(0, 0);
  }

  /* ---------- modal ---------- */
  function openModal(slug, push) {
    var a = bySlug[slug]; if (!a) return;
    if (push !== false) { try { history.pushState({ m: slug }, '', '#' + slug); } catch (e) {} }
    document.body.classList.add('modal-open');
    var rel = related(a), nx = nextArticle(a);
    var host = el('modal-host');
    host.innerHTML =
      '<div class="modal"><div class="modal-backdrop" data-close="1"></div><div class="modal-panel"><div class="modal-card">' +
      '<div class="modal-top"><div class="t">' + catBadge(a.category) + '<span class="tt">' + esc(a.title) + '</span></div>' +
      '<div style="display:flex;gap:8px;align-items:center">' +
      '<button class="btn btn-sm ' + (isStarred(a.id) ? 'btn-primary' : 'btn-outline') + '" data-star="' + esc(a.slug) + '">' +
      (isStarred(a.id) ? ICON.starFill : ICON.star) + (isStarred(a.id) ? ' Starred' : ' Star') + '</button>' +
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
      (nx ? '<div class="card card-hover next" data-open="' + esc(nx.slug) + '"><div><div class="lbl">Read next</div><div class="nt">' + esc(nx.title) + '</div></div><span style="color:var(--brand-600)">' + ICON.arrow + '</span></div>' : '') +
      (rel.length ? '<div style="margin-top:32px"><h2 style="font-size:14px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:800;margin:0 0 12px">If you read this, you might like…</h2>' +
        '<div class="grid cols-3">' + rel.map(function (r) {
          return '<div class="card card-hover" data-open="' + esc(r.slug) + '" style="padding:16px;cursor:pointer">' +
            (r.category ? '<span style="font-size:12px;font-weight:600;color:' + r.category.color + '">' + esc(r.category.name) + '</span>' : '') +
            '<div style="margin-top:4px;font-weight:600;font-size:14px">' + esc(r.title) + '</div></div>';
        }).join('') + '</div></div>' : '') +
      '</div></div></div></div></div>';
    var body = host.querySelector('.modal-body'); if (body) body.scrollTop = 0;
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
    var t = e.target.closest('[data-open],[data-close],[data-star],[data-unstar],[data-cat],[data-home]');
    if (!t) return;
    if (t.hasAttribute('data-star')) { e.preventDefault(); e.stopPropagation(); toggleStar(t.getAttribute('data-star')); return; }
    if (t.hasAttribute('data-unstar')) { e.preventDefault(); e.stopPropagation(); removeStar(t.getAttribute('data-unstar')); return; }
    if (t.hasAttribute('data-open')) { e.preventDefault(); openModal(t.getAttribute('data-open')); return; }
    if (t.hasAttribute('data-close')) { e.preventDefault(); closeModal(); return; }
    if (t.hasAttribute('data-cat')) { e.preventDefault(); var slug = t.getAttribute('data-cat');
      var c = CATEGORIES.filter(function (x) { return x.slug === slug; })[0]; runSearch(c ? c.name : slug); return; }
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
  renderStrip();
  renderHome();
  var h = (location.hash || '').replace('#', '');
  if (h && bySlug[h]) openModal(h, false);
})();
