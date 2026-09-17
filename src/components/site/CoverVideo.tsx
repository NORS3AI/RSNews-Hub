'use client';
import { useEffect, useRef } from 'react';

// A cover VIDEO that behaves like a tasteful hero background: muted, looping,
// autoplaying inline, no controls. `poster` (the still cover image) shows before
// the video paints and is what social/email/cards use instead. Respects
// prefers-reduced-motion: for those viewers we don't autoplay — we pause on the
// poster and expose native controls so they can play it themselves.
export default function CoverVideo({
  src, poster, className, style,
}: { src: string; poster?: string | null; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { v.autoplay = false; v.controls = true; try { v.pause(); } catch { /* noop */ } }
  }, []);

  return (
    <video
      ref={ref}
      src={src}
      poster={poster || undefined}
      className={className}
      style={style}
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      // No download / PiP clutter on a background-style cover.
      controlsList="nodownload noplaybackrate"
      disablePictureInPicture
    />
  );
}
