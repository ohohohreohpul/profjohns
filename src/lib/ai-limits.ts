/**
 * Input minimums shared by the AI route (server validation) and the UI
 * (disabling buttons), so a button is never enabled for a request the server
 * will reject.
 */

/** A draft shorter than this can't yield meaningful title suggestions. */
export const MIN_TITLE_DRAFT_CHARS = 20;
