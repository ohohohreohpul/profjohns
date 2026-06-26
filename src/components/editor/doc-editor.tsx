"use client";

import * as React from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import {
  TextB as Bold,
  TextItalic as Italic,
  TextHOne as H1,
  TextHTwo as H2,
  ListBullets as Bullets,
  ListNumbers as Numbers,
  Quotes as Quote,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useCanvasStore } from "@/store/canvas-store";
import { emptyDocContent } from "@/lib/document";
import { Citation } from "./citation-mark";

/**
 * Registry of live editors keyed by node id, so the Writing surface (cite,
 * AI write/edit) can drive the same editor instance the user is typing in —
 * without prop-drilling the editor through unrelated components.
 */
const editors = new Map<string, Editor>();
export function getDocEditor(nodeId: string): Editor | undefined {
  return editors.get(nodeId);
}

const SYNC_DEBOUNCE_MS = 150;

export function DocEditor({
  nodeId,
  compact = false,
}: {
  nodeId: string;
  compact?: boolean;
}) {
  const setDocContent = useCanvasStore((s) => s.setDocContent);
  const storeContent = useCanvasStore((s) => s.docs[nodeId]?.content);

  // Seed once. ensureDoc is idempotent; reading it here avoids a mount race
  // with the parent's ensureDoc effect (child effects run before parent's).
  const seed = React.useRef<ReturnType<typeof emptyDocContent>>(undefined);
  if (!seed.current) {
    const s = useCanvasStore.getState();
    if (!s.docs[nodeId]) s.ensureDoc(nodeId, s.direction);
    seed.current = useCanvasStore.getState().docs[nodeId]?.content ?? emptyDocContent();
  }

  const writing = React.useRef(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2] } }),
      Citation,
      Placeholder.configure({
        placeholder: compact
          ? "Just start typing — ⌘B bold, ⌘I italic, Enter for a new paragraph"
          : "Write… draft from your sources with the AI writer, or type here.",
      }),
    ],
    content: seed.current,
    editorProps: {
      attributes: {
        // `nodrag`/`nopan` must be on the editable element itself so React Flow
        // doesn't consume the pointerdown (which steals focus from the caret).
        class: cn(
          "tiptap-doc nodrag nopan max-w-none outline-none",
          compact ? "min-h-[180px] text-[13.5px] leading-[1.7]" : "min-h-[320px]",
        ),
      },
    },
    onUpdate: ({ editor }) => {
      writing.current = true;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setDocContent(nodeId, editor.getJSON());
        writing.current = false;
      }, SYNC_DEBOUNCE_MS);
    },
  });

  // Register / unregister the live editor for the surface's cite + AI actions.
  React.useEffect(() => {
    if (!editor) return;
    editors.set(nodeId, editor);
    return () => {
      if (editors.get(nodeId) === editor) editors.delete(nodeId);
    };
  }, [editor, nodeId]);

  // Resync from the store ONLY when this editor didn't cause the change and
  // isn't focused (i.e. the other editor instance or an AI action wrote it).
  React.useEffect(() => {
    if (!editor || !storeContent) return;
    if (writing.current || editor.isFocused) return;
    if (JSON.stringify(editor.getJSON()) !== JSON.stringify(storeContent)) {
      editor.commands.setContent(storeContent, { emitUpdate: false });
    }
  }, [editor, storeContent]);

  return (
    <div
      className="nodrag nopan nowheel"
      // Keep clicks for the caret from reaching React Flow's node handlers.
      onPointerDownCapture={(e) => e.stopPropagation()}
    >
      {editor && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}

function ToolButton({
  active,
  onClick,
  label,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      // Keep the editor selection on click.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "grid size-7 place-items-center rounded-md text-grey-500 transition-colors hover:bg-grey-100 hover:text-ink",
        active && "bg-grey-100 text-ink",
      )}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  // Re-render on selection/content change so active states stay accurate.
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => {
    editor.on("selectionUpdate", force);
    editor.on("transaction", force);
    return () => {
      editor.off("selectionUpdate", force);
      editor.off("transaction", force);
    };
  }, [editor]);

  const c = () => editor.chain().focus();
  return (
    <div className="mb-2 flex flex-wrap items-center gap-0.5 rounded-lg border border-grey-200 bg-paper/80 p-1">
      <ToolButton label="Bold" active={editor.isActive("bold")} onClick={() => c().toggleBold().run()}>
        <Bold className="size-4" />
      </ToolButton>
      <ToolButton label="Italic" active={editor.isActive("italic")} onClick={() => c().toggleItalic().run()}>
        <Italic className="size-4" />
      </ToolButton>
      <span className="mx-0.5 h-5 w-px bg-grey-200" />
      <ToolButton label="Heading" active={editor.isActive("heading", { level: 1 })} onClick={() => c().toggleHeading({ level: 1 }).run()}>
        <H1 className="size-4" />
      </ToolButton>
      <ToolButton label="Subheading" active={editor.isActive("heading", { level: 2 })} onClick={() => c().toggleHeading({ level: 2 }).run()}>
        <H2 className="size-4" />
      </ToolButton>
      <span className="mx-0.5 h-5 w-px bg-grey-200" />
      <ToolButton label="Bullet list" active={editor.isActive("bulletList")} onClick={() => c().toggleBulletList().run()}>
        <Bullets className="size-4" />
      </ToolButton>
      <ToolButton label="Numbered list" active={editor.isActive("orderedList")} onClick={() => c().toggleOrderedList().run()}>
        <Numbers className="size-4" />
      </ToolButton>
      <ToolButton label="Quote" active={editor.isActive("blockquote")} onClick={() => c().toggleBlockquote().run()}>
        <Quote className="size-4" />
      </ToolButton>
    </div>
  );
}
