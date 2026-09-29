import { Mark, mergeAttributes } from "@tiptap/core";

/**
 * E0.3 — visible "unsupported citation" mark. Emitted alongside a `citation`
 * mark when the trust layer judged a drafted citation's source does not back
 * the claim (audit status `unsupported`). Renders as a visibly flagged span so
 * a fabricated or weak citation is SEEN, never laundered as a clean citation.
 *
 * Pairs with `citation-mark.ts`: a flagged piece carries both marks; the
 * `citation` mark keeps the paperId the references/export pipeline reads, while
 * this mark carries the visual warning. TipTap silently drops marks that have
 * no registered extension, so this MUST be mounted in the editor's extensions
 * (see doc-editor.tsx) or the flag is invisible.
 */
export const Unsupported = Mark.create({
  name: "unsupported",
  inclusive: false,

  addAttributes() {
    return {
      paperId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-paper-id"),
        renderHTML: (attrs) =>
          attrs.paperId ? { "data-paper-id": attrs.paperId } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-unsupported]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        class: "lattice-unsupported",
        "data-unsupported": "",
      }),
      0,
    ];
  },
});