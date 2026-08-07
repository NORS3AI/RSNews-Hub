'use client';
import { useRef, useState } from 'react';
import { Play, Pause, Headphones } from '@/components/icons';

// Compact "Listen to article" player: a play/pause pill with a scrubber and time
// that appear once you start. Rendered only when the article has ready audio.
function fmt(s: number): string {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export default function ListenButton({ src }: { src: string }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);

  const toggle = () => {
    const a = ref.current; if (!a) return;
    if (a.paused) { a.play(); setStarted(true); } else a.pause();
  };
  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const a = ref.current; if (!a) return;
    a.currentTime = (Number(e.target.value) / 100) * (a.duration || 0);
  };

  return (
    <div className="inline-flex items-center gap-2.5 rounded-full border border-[var(--border)] bg-[var(--card)] py-1 pl-1 pr-3 align-middle">
      <button type="button" onClick={toggle} aria-label={playing ? 'Pause article' : 'Listen to article'}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-600 text-white transition hover:bg-brand-700">
        {playing ? <Pause width={16} height={16} /> : <Play width={16} height={16} />}
      </button>
      {!started ? (
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--fg)]"><Headphones width={15} height={15} /> Listen</span>
      ) : (
        <span className="flex items-center gap-2">
          <input type="range" min={0} max={100} value={dur ? (t / dur) * 100 : 0} onChange={seek}
            className="h-1 w-28 cursor-pointer accent-brand-600 sm:w-40" aria-label="Seek" />
          <span className="w-16 shrink-0 text-xs tabular-nums text-[var(--muted)]">{fmt(t)} / {fmt(dur)}</span>
        </span>
      )}
      <audio ref={ref} src={src} preload="none"
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
        onEnded={() => { setPlaying(false); setT(0); }} />
    </div>
  );
}
