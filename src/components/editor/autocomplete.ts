import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/**
 * Inline autocomplete (Jenni-style ghost text). When the caret is idle at the
 * end of what you've written, a short AI continuation appears in grey; Tab
 * accepts it, Escape or typing dismisses it. Debounced; stale requests are
 * discarded. Toggle via the `setAutocompleteEnabled` command.
 */

const key = new PluginKey<AutocompleteState>("autocomplete");

const DEBOUNCE_MS = 550;
const MIN_PREFIX = 12; // don't suggest until there's a little context
const MAX_PREFIX = 2000;

interface AutocompleteState {
  text: string | null;
  pos: number;
}

interface AutocompleteOptions {
  /** Returns a short continuation of `prefix`, or "" for no suggestion. */
  fetchSuggestion: (prefix: string) => Promise<string>;
}

interface AutocompleteStorage {
  enabled: boolean;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    autocomplete: {
      setAutocompleteEnabled: (enabled: boolean) => ReturnType;
    };
  }
  interface Storage {
    autocomplete: AutocompleteStorage;
  }
}

function ghostWidget(text: string): HTMLElement {
  const span = document.createElement("span");
  span.className = "tiptap-ghost";
  span.textContent = text;
  span.setAttribute("contenteditable", "false");
  return span;
}

export const Autocomplete = Extension.create<AutocompleteOptions, AutocompleteStorage>({
  name: "autocomplete",

  addOptions() {
    return { fetchSuggestion: async () => "" };
  },

  addStorage() {
    return { enabled: true };
  },

  addCommands() {
    return {
      setAutocompleteEnabled:
        (enabled: boolean) =>
        ({ editor }) => {
          editor.storage.autocomplete.enabled = enabled;
          if (!enabled) {
            editor.view.dispatch(editor.state.tr.setMeta(key, { type: "clear" }));
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const ext = this;

    return [
      new Plugin<AutocompleteState>({
        key,

        state: {
          init: () => ({ text: null, pos: 0 }),
          apply(tr, value) {
            const meta = tr.getMeta(key) as
              | { type: "set"; text: string; pos: number }
              | { type: "clear" }
              | undefined;
            if (meta?.type === "set") return { text: meta.text, pos: meta.pos };
            if (meta?.type === "clear") return { text: null, pos: 0 };
            // Any real edit invalidates a pending suggestion.
            if (tr.docChanged && value.text) return { text: null, pos: 0 };
            return value;
          },
        },

        // Clear the ghost the moment the doc or selection moves (unless the
        // transaction is itself setting/clearing it).
        appendTransaction(transactions, oldState, newState) {
          const current = key.getState(newState);
          if (!current?.text) return null;
          const selfMeta = transactions.some((t) => t.getMeta(key));
          if (selfMeta) return null;
          const moved =
            transactions.some((t) => t.docChanged) ||
            !oldState.selection.eq(newState.selection);
          return moved ? newState.tr.setMeta(key, { type: "clear" }) : null;
        },

        props: {
          decorations(state) {
            const s = key.getState(state);
            if (!s?.text) return null;
            return DecorationSet.create(state.doc, [
              Decoration.widget(s.pos, () => ghostWidget(s.text as string), {
                side: 1,
                ignoreSelection: true,
              }),
            ]);
          },

          handleKeyDown(view, event) {
            const s = key.getState(view.state);
            if (!s?.text) return false;
            if (event.key === "Tab") {
              event.preventDefault();
              view.dispatch(
                view.state.tr
                  .insertText(s.text, s.pos)
                  .setMeta(key, { type: "clear" }),
              );
              return true;
            }
            if (event.key === "Escape") {
              view.dispatch(view.state.tr.setMeta(key, { type: "clear" }));
              return true;
            }
            return false;
          },
        },

        view() {
          let timer: ReturnType<typeof setTimeout> | null = null;
          let reqId = 0;

          const schedule = (view: import("@tiptap/pm/view").EditorView) => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(async () => {
              if (!ext.storage.enabled) return;
              const { state } = view;
              const sel = state.selection;
              if (!sel.empty) return;
              const pos = sel.from;
              const prefix = state.doc.textBetween(
                Math.max(0, pos - MAX_PREFIX),
                pos,
                "\n",
                "\n",
              );
              if (prefix.trim().length < MIN_PREFIX) return;

              const myReq = ++reqId;
              let suggestion = "";
              try {
                suggestion = await ext.options.fetchSuggestion(prefix);
              } catch {
                return;
              }
              if (myReq !== reqId || !suggestion.trim()) return;
              // The caret must still be where we asked from.
              const now = view.state.selection;
              if (!now.empty || now.from !== pos) return;
              view.dispatch(
                view.state.tr.setMeta(key, { type: "set", text: suggestion, pos }),
              );
            }, DEBOUNCE_MS);
          };

          return {
            update(view, prev) {
              if (!ext.storage.enabled) return;
              const moved =
                !prev.doc.eq(view.state.doc) ||
                !prev.selection.eq(view.state.selection);
              if (moved) {
                reqId++; // invalidate any in-flight request
                schedule(view);
              }
            },
            destroy() {
              if (timer) clearTimeout(timer);
            },
          };
        },
      }),
    ];
  },
});
