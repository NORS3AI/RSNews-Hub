'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { track, flush } from '@/lib/analytics/track';

export function pageTypeFor(path: string): string {
  if (path.startsWith('/admin')) return 'admin';
  if (path.startsWith('/docs/clippings')) return 'clippings';
  if (path.startsWith('/docs/search')) return 'search';
  if (path.startsWith('/docs/article/')) return 'article';
  if (path.startsWith('/docs/category/') || path.startsWith('/docs/tag/')) return 'category';
  if (path.startsWith('/docs/archive')) return 'archive';
  if (path === '/docs' || path === '/docs/') return 'home';
  return 'other';
}

function attrs(el: Element) {
  const g = (k: string) => el.getAttribute(k) || undefined;
  let props: Record<string, unknown> | undefined;
  const raw = g('data-trk-props');
  if (raw) { try { props = JSON.parse(raw); } catch { /* ignore */ } }
  return { subjectType: g('data-trk-type') as never, subjectId: g('data-trk-id'), placement: g('data-trk-place'), props };
}

type St = { acc: number; enterAt: number | null; counted: boolean; aboveFold?: boolean };

/**
 * Site-wide analytics. Emits a pageview per route, and for any element marked
 * with `data-trk-type` it records a *viewable* impression (≥50% visible for
 * ≥1s, with above-the-fold + dwell) and a click. Pointing the whole pipeline at
 * exposure→interaction means a raw click count is never read in isolation.
 */
export default function AnalyticsProvider() {
  const pathname = usePathname();

  // Pageview per route change.
  useEffect(() => {
    if (pathname.startsWith('/admin')) return; // don't self-measure the dashboard
    track({ type: 'pageview', subjectType: 'hub', pageType: pageTypeFor(pathname) });
  }, [pathname]);

  useEffect(() => {
    if (typeof window === 'undefined' || pathname.startsWith('/admin')) return;
    const pageType = pageTypeFor(pathname);
    const state = new Map<Element, St>();

    const emit = (el: Element, st: St) => {
      if (st.counted) return;
      st.counted = true;
      const a = attrs(el);
      track({ type: 'impression', subjectType: a.subjectType, subjectId: a.subjectId, placement: a.placement, pageType,
        value: Math.round(st.acc), props: { ...(a.props || {}), viewable: true, aboveFold: !!st.aboveFold, dwellMs: Math.round(st.acc) } });
    };

    const io = new IntersectionObserver((entries) => {
      const now = performance.now();
      for (const e of entries) {
        const el = e.target;
        let st = state.get(el);
        if (!st) { st = { acc: 0, enterAt: null, counted: false }; state.set(el, st); }
        const visible = e.isIntersecting && e.intersectionRatio >= 0.5;
        if (visible && st.enterAt == null) {
          st.enterAt = now;
          if (st.aboveFold === undefined) st.aboveFold = e.boundingClientRect.top < window.innerHeight;
        } else if (!visible && st.enterAt != null) {
          st.acc += now - st.enterAt; st.enterAt = null;
          if (!st.counted && st.acc >= 1000) emit(el, st);
        }
      }
    }, { threshold: [0, 0.5, 1] });

    const observeAll = (root: ParentNode) => root.querySelectorAll('[data-trk-type]').forEach((el) => { if (!state.has(el)) io.observe(el); });
    observeAll(document);

    // Catch elements added by client-side renders (modals, view switches).
    const mo = new MutationObserver((muts) => {
      for (const m of muts) m.addedNodes.forEach((n) => {
        if (n.nodeType !== 1) return;
        const el = n as Element;
        if (el.matches?.('[data-trk-type]') && !state.has(el)) io.observe(el);
        observeAll(el);
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });

    // Long-dwell finalizer so items that stay on screen still count promptly.
    const tick = setInterval(() => {
      const now = performance.now();
      state.forEach((st, el) => {
        if (st.enterAt != null && !st.counted) {
          const cur = st.acc + (now - st.enterAt);
          if (cur >= 6000) { st.acc = cur; st.enterAt = now; emit(el, st); }
        }
      });
    }, 2000);

    // Click tracking on any tracked element.
    const onClick = (ev: MouseEvent) => {
      const el = (ev.target as Element)?.closest?.('[data-trk-type]');
      if (!el) return;
      const a = attrs(el);
      track({ type: 'click', subjectType: a.subjectType, subjectId: a.subjectId, placement: a.placement, pageType, props: a.props });
    };
    document.addEventListener('click', onClick, true);

    const onHide = () => { state.forEach((st, el) => { if (st.enterAt != null) { st.acc += performance.now() - st.enterAt; st.enterAt = null; if (!st.counted && st.acc >= 1000) emit(el, st); } }); flush(true); };
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') onHide(); });

    return () => { io.disconnect(); mo.disconnect(); clearInterval(tick); document.removeEventListener('click', onClick, true); window.removeEventListener('pagehide', onHide); };
  }, [pathname]);

  return null;
}
