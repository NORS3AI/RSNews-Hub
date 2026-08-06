// Lightweight, dependency-free tag suggester — pulls the most salient words from
// the title + body so writers never have to think up tags by hand.
const STOP = new Set('the a an and or but of to in on for with at by from as is are was were be been it its this that these those you your we our they their he she his her i me my not no so if then than will can could would should may might just about into over out up down more most some any all how what when where who why which also has have had do does did get got new now one two per via vs he\'s she\'s don\'t'.split(' '));

export function suggestTags(title: string, html: string, max = 6): string[] {
  const body = html.replace(/<[^>]+>/g, ' ');
  const all = `${title} ${body}`.toLowerCase().match(/[a-z][a-z0-9'-]{2,}/g) || [];
  const titleWords = new Set((title.toLowerCase().match(/[a-z][a-z0-9'-]{2,}/g) || []).filter((w) => !STOP.has(w)));
  const freq = new Map<string, number>();
  for (const w of all) { if (w.length < 3 || STOP.has(w)) continue; freq.set(w, (freq.get(w) || 0) + 1); }
  return [...freq.entries()]
    .map(([w, c]) => [w, c + (titleWords.has(w) ? 3 : 0)] as [string, number])
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([w]) => w);
}
