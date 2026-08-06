// Server-side HTML sanitization for editor-authored content (articles, pages).
//
// Article/page bodies are stored as HTML and rendered with dangerouslySetInnerHTML.
// Content is authored by ADMIN *and EDITOR* accounts — EDITOR is lower-trust and
// can't manage users, so a malicious/compromised editor must not be able to plant
// stored XSS that runs in every reader's (and full admin's) browser. We sanitize
// on write with a strict allowlist: formatting tags only, no scripts, no event
// handlers, no inline styles, no `javascript:` URLs.

import sanitizeHtml from 'sanitize-html';

// Structured markers the article composer emits for its block elements. These
// are inert data-attributes (no scripts, no styles, no handlers): the reader's
// ArticleContent renderer expands them into ad slots / author cards / poll+quiz
// embeds, and TipTap re-reads them to reconstruct the elements when editing. We
// allowlist them explicitly so a lower-trust EDITOR still can't smuggle in
// executable markup — every value is rendered as escaped text, a CSS hook, or an
// image src (which never executes JS), so none of them is an XSS surface.
const COMPOSER_DIV_ATTRS = [
  'data-ad-slot', 'data-ad-id', 'data-ad-label',
  'data-spacer', 'data-size',
  'data-poll', 'data-quiz', 'data-label',
  'data-author', 'data-name', 'data-title', 'data-avatar', 'data-bio', 'data-inhouse',
];

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr',
    'ul', 'ol', 'li', 'a', 'blockquote', 'code', 'pre',
    'strong', 'em', 'b', 'i', 'u', 's', 'span', 'sup', 'sub',
    'img', 'figure', 'figcaption', 'div',
    'table', 'thead', 'tbody', 'tr', 'th', 'td', 'caption',
  ],
  allowedAttributes: {
    a: ['href', 'name', 'target', 'rel', 'data-button'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    blockquote: ['data-pullquote'],
    div: COMPOSER_DIV_ATTRS,
    // still no `style`/`on*` anywhere, and `class` is constrained to the two
    // composer values below — inline style/handlers stay an injection surface.
  },
  // Only these exact class names survive (composer button + pull-quote); every
  // other class is dropped, so no arbitrary class can ride in.
  allowedClasses: {
    a: ['a-btn'],
    blockquote: ['pullquote'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { img: ['http', 'https', 'data'] },
  // External links open safely (no window.opener, no referrer leak). The
  // composer's own button carries class="a-btn"; the transform preserves it.
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer nofollow', target: '_blank' }),
  },
  disallowedTagsMode: 'discard',
};

/** Sanitize editor-authored HTML to a safe subset. Returns clean HTML. */
export function sanitizeArticleHtml(dirty: string): string {
  return sanitizeHtml(dirty ?? '', OPTIONS);
}
