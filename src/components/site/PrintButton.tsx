'use client';

// Triggers the browser's print dialog (→ "Save as PDF"). Marked data-noprint so
// it hides itself in the printed output.
export default function PrintButton({ label = 'Print / Save as PDF' }: { label?: string }) {
  return (
    <button data-noprint onClick={() => window.print()} className="btn-primary btn-sm">
      {label}
    </button>
  );
}
