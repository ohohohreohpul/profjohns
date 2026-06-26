import { Mark, mergeAttributes } from "@tiptap/core";

/**
 * Inline citation mark carrying the cited paper's id. Rendered as a styled
 * span so an in-text citation reads inline while the paperId travels with the
 * text — the references list + export derive the cited set by walking these
 * marks, so there is a single source of truth.
 */
export const Citation = Mark.create({
  name: "citation",
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
    return [{ tag: "span[data-paper-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { class: "lattice-citation" }),
      0,
    ];
  },
});
