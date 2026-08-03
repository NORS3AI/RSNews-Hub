import * as React from 'react';

type P = React.SVGProps<SVGSVGElement>;
const base = (props: P) => ({
  width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  ...props,
});

export const Search = (p: P) => (<svg {...base(p)}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>);
export const Sun = (p: P) => (<svg {...base(p)}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4" /></svg>);
export const Moon = (p: P) => (<svg {...base(p)}><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></svg>);
export const Menu = (p: P) => (<svg {...base(p)}><path d="M4 6h16M4 12h16M4 18h16" /></svg>);
export const X = (p: P) => (<svg {...base(p)}><path d="M18 6 6 18M6 6l12 12" /></svg>);
export const ArrowRight = (p: P) => (<svg {...base(p)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>);
export const ArrowLeft = (p: P) => (<svg {...base(p)}><path d="M19 12H5M11 6l-6 6 6 6" /></svg>);
export const Clock = (p: P) => (<svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>);
export const Eye = (p: P) => (<svg {...base(p)}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>);
export const Bell = (p: P) => (<svg {...base(p)}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>);
export const Archive = (p: P) => (<svg {...base(p)}><rect x="2" y="4" width="20" height="5" rx="1" /><path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9M10 13h4" /></svg>);
export const Tag = (p: P) => (<svg {...base(p)}><path d="M12 2H2v10l9.3 9.3a1 1 0 0 0 1.4 0l8.6-8.6a1 1 0 0 0 0-1.4Z" /><circle cx="7" cy="7" r="1.2" /></svg>);
export const Layers = (p: P) => (<svg {...base(p)}><path d="m12 2 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 17l9 5 9-5" /></svg>);
export const Users = (p: P) => (<svg {...base(p)}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11" /></svg>);
export const FileText = (p: P) => (<svg {...base(p)}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M9 13h6M9 17h6" /></svg>);
export const Grid = (p: P) => (<svg {...base(p)}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>);
export const Trash = (p: P) => (<svg {...base(p)}><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6" /></svg>);
export const Edit = (p: P) => (<svg {...base(p)}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4Z" /></svg>);
export const Plus = (p: P) => (<svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>);
export const Check = (p: P) => (<svg {...base(p)}><path d="M20 6 9 17l-5-5" /></svg>);
export const Home = (p: P) => (<svg {...base(p)}><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" /></svg>);
export const Logout = (p: P) => (<svg {...base(p)}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>);
export const Sparkles = (p: P) => (<svg {...base(p)}><path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3ZM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z" /></svg>);
export const Ban = (p: P) => (<svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="m5.6 5.6 12.8 12.8" /></svg>);
export const Pause = (p: P) => (<svg {...base(p)}><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>);
export const Star = (p: P) => (<svg {...base(p)}><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9L12 3.5Z" /></svg>);
export const StarFilled = (p: P) => (<svg {...base({ ...p, fill: 'currentColor', stroke: 'currentColor' })}><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9L12 3.5Z" strokeWidth="1" strokeLinejoin="round" /></svg>);
export const ChevronRight = (p: P) => (<svg {...base(p)}><path d="m9 6 6 6-6 6" /></svg>);
export const ChevronUp = (p: P) => (<svg {...base(p)}><path d="m6 15 6-6 6 6" /></svg>);
export const ChevronDown = (p: P) => (<svg {...base(p)}><path d="m6 9 6 6 6-6" /></svg>);
