// Shared analytics event shapes. The client sends the lightweight `ClientEvent`
// and the server enriches it (visitor/user/device/path) before storing.

export type EventType =
  | 'pageview'
  | 'impression'   // something was shown + actually in view (viewability + dwell)
  | 'click'
  | 'article_open'
  | 'read'         // active reading time + scroll depth for an article
  | 'clip'         // clippings actions (save/download/delete/expand/view)
  | 'save'         // favorite / read-later / pin
  | 'recommend'    // end-of-article endorsement (props.action: add|remove)
  | 'search'
  | 'video'        // video-ad playback progress (props.quartile: 0|25|50|75|100)
  | 'ad_expand'    // a reader opened an ad in the zoom overlay (readability signal)
  | 'nav'          // carousel arrows, module nav, etc.
  | 'theme';       // active/selected UI theme (props.theme: light|dark|rs)

export type SubjectType = 'ad' | 'article' | 'module' | 'clip' | 'search' | 'hub';

// Sent from the browser. Keep it small; the server fills in the rest.
export type ClientEvent = {
  type: EventType;
  subjectType?: SubjectType;
  subjectId?: string;
  sessionId?: string;
  pageType?: string;
  placement?: string;
  path?: string;
  value?: number; // dwellMs / scrollPct / activeMs, per event type
  props?: Record<string, unknown>;
};

export const EVENT_TYPES: EventType[] = ['pageview', 'impression', 'click', 'article_open', 'read', 'clip', 'save', 'recommend', 'search', 'video', 'ad_expand', 'nav', 'theme'];
