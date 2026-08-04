// Server-side HTML sanitization for editor-authored content (articles, pages).
//
// Article/page bodies are stored as HTML and rendered with dangerouslySetInnerHTML.
// Content is authored by ADMIN *and EDITOR* accounts — EDITOR is lower-trust and
// can't manage users, so a malicious/compromised editor must not be able to plant
// stored XSS that runs in every reader's (and full admin's) browser. We sanitize
// on write with a strict allowlist: formatting tags only, no scripts, no event
// handlers, no inline styles, no `javascript:` URLs.

import sanitizeHtml from 'sanitize-html';

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr',
    'ul', 'ol', 'li', 'a', 'blockquote', 'code', 'pre',
    'strong', 'em', 'b', 'i', 'u', 's', 'span', 'sup', 'sub',
    'img', 'figure', 'figcaption',
    'table', 'thead', 'tbody', 'tr', 'th', 'td', 'caption',
  ],
  allowedAttributes: {
    a: ['href', 'name', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    // no `class`/`style`/`on*` on anything — prose styling comes from the
    // container's CSS, and inline style/handlers are an injection surface.
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { img: ['http', 'https', 'data'] },
  // External links open safely (no window.opener, no referrer leak).
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer nofollow', target: '_blank' }),
  },
  disallowedTagsMode: 'discard',
};

/** Sanitize editor-authored HTML to a safe subset. Returns clean HTML. */
export function sanitizeArticleHtml(dirty: string): string {
  return sanitizeHtml(dirty ?? '', OPTIONS);
}
