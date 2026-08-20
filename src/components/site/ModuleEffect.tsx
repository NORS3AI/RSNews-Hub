'use client';
import { useEffect, useRef } from 'react';

// A lightweight festive overlay drawn on a <canvas> behind a module's content.
// Deliberately cheap: ~45 particles, a single requestAnimationFrame loop, paused
// whenever the module scrolls out of view, and reduced to a still frame for
// anyone who prefers reduced motion. No images or network — pure code, so it
// costs zero bandwidth. The host element must be `position: relative`; this fills
// it and never intercepts clicks (pointer-events: none).

const DEFAULT_CONFETTI = ['#E97D34', '#f7edd8', '#b23b2e'];

type Particle = { x: number; y: number; r: number; vx: number; vy: number; a: number; va: number; c: string };

export default function ModuleEffect({ effect, colors }: { effect: 'snow' | 'confetti'; colors?: string[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const colorKey = (colors ?? []).join(',');

  useEffect(() => {
    const canvas = ref.current;
    const host = canvas?.parentElement;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !host || !ctx) return;

    const palette = colors && colors.length ? colors : DEFAULT_CONFETTI;
    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0, h = 0;

    const resize = () => {
      w = host.clientWidth; h = host.clientHeight;
      canvas.width = Math.max(1, w * dpr); canvas.height = Math.max(1, h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(host);

    const spawn = (fromTop: boolean): Particle => ({
      x: rand(0, Math.max(1, w)),
      y: fromTop ? -10 : rand(0, Math.max(1, h)),
      r: effect === 'snow' ? rand(1.2, 3.4) : rand(4, 9),
      vx: effect === 'snow' ? rand(-0.3, 0.3) : rand(-0.7, 0.7),
      vy: effect === 'snow' ? rand(0.4, 1.1) : rand(1.2, 2.8),
      a: rand(0, Math.PI * 2),
      va: effect === 'snow' ? 0 : rand(-0.12, 0.12),
      c: effect === 'snow' ? 'rgba(255,255,255,0.9)' : palette[Math.floor(Math.random() * palette.length)],
    });
    const COUNT = effect === 'snow' ? 46 : 40;
    const parts: Particle[] = Array.from({ length: COUNT }, () => spawn(false));

    const draw = (p: Particle) => {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c;
      if (effect === 'snow') { ctx.beginPath(); ctx.arc(0, 0, p.r, 0, Math.PI * 2); ctx.fill(); }
      else ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.62);
      ctx.restore();
    };

    // Reduced motion: render a gentle still frame and stop animating — but keep
    // repainting it on resize, since resizing the canvas clears its bitmap (the
    // default ResizeObserver only resizes). Otherwise the overlay blanks out for
    // good after the first responsive reflow.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      ro.disconnect();
      const renderStill = () => { resize(); ctx.clearRect(0, 0, w, h); parts.forEach(draw); };
      const stillRo = new ResizeObserver(renderStill); stillRo.observe(host);
      renderStill();
      return () => stillRo.disconnect();
    }

    let raf = 0;
    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        p.x += p.vx; p.y += p.vy; p.a += p.va;
        if (effect === 'snow') p.x += Math.sin(p.y / 32) * 0.3;
        if (p.y > h + 14 || p.x < -20 || p.x > w + 20) Object.assign(p, spawn(true));
        draw(p);
      }
      raf = requestAnimationFrame(tick);
    };
    const start = () => { if (!raf) raf = requestAnimationFrame(tick); };
    const stop = () => { if (raf) { cancelAnimationFrame(raf); raf = 0; } };

    // Only animate while the module is on screen.
    const io = new IntersectionObserver((entries) => { entries[0]?.isIntersecting ? start() : stop(); }, { threshold: 0 });
    io.observe(host);

    return () => { stop(); ro.disconnect(); io.disconnect(); };
  }, [effect, colorKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 z-0 h-full w-full" />;
}
