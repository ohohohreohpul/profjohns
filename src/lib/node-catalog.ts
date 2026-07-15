import {
  MagnifyingGlass as Search,
  Cpu,
  TextT as Type,
  Package as Container,
  PencilSimpleLine as PenLine,
  FileText,
  BookOpen,
  Image as ImageIcon,
  Books as Library,
  Link as Link2,
  Robot as Bot,
  type Icon,
} from "@phosphor-icons/react";

export type NodeKind =
  | "explorer"
  | "processor"
  | "block"
  | "text"
  | "shell"
  | "writing"
  | "assistant"
  | "paper"
  | "media"
  | "library"
  | "link";

export interface NodeDefinition {
  kind: NodeKind;
  label: string;
  description: string;
  icon: Icon;
  isPrimary: boolean;
  /** Semantic accent (CSS var) for this node's identity. */
  accent: string;
}

export const NODE_DEFINITIONS: Record<NodeKind, NodeDefinition> = {
  explorer: {
    kind: "explorer",
    label: "Sources",
    description: "Find & gather — search arXiv/Semantic Scholar, paste a link, or ask.",
    icon: Search,
    isPrimary: false,
    accent: "var(--color-node-explorer)",
  },
  processor: {
    kind: "processor",
    label: "Synthesize",
    description: "AI over your connected sources — summarize, compare, find gaps.",
    icon: Cpu,
    isPrimary: false,
    accent: "var(--color-node-processor)",
  },
  block: {
    kind: "block",
    label: "Note",
    description: "A free-standing note — type, format, and drag anywhere.",
    icon: Type,
    isPrimary: false,
    accent: "var(--color-node-block)",
  },
  shell: {
    kind: "shell",
    label: "Group",
    description: "Frame and organize related nodes together.",
    icon: Container,
    isPrimary: false,
    accent: "var(--color-node-shell)",
  },
  writing: {
    kind: "writing",
    label: "Draft",
    description: "Your document — write by hand or with the AI writer; cite & export.",
    icon: PenLine,
    isPrimary: true,
    accent: "var(--color-node-writing)",
  },
  text: {
    kind: "text",
    label: "Text",
    description: "A longer text area for notes and drafts.",
    icon: FileText,
    isPrimary: false,
    accent: "var(--color-node-text)",
  },
  assistant: {
    kind: "assistant",
    label: "Assistant",
    description: "Canvas-wide AI chat — ask across everything, create nodes.",
    icon: Bot,
    isPrimary: false,
    accent: "var(--color-node-assistant)",
  },
  paper: {
    kind: "paper",
    label: "Paper",
    description: "A single source — feeds its paper into connected nodes.",
    icon: BookOpen,
    isPrimary: false,
    accent: "var(--color-node-reader)",
  },
  media: {
    kind: "media",
    label: "Image",
    description: "A figure, scan, or diagram — upload or drop an image to study and cite.",
    icon: ImageIcon,
    isPrimary: false,
    accent: "var(--color-node-media)",
  },
  library: {
    kind: "library",
    label: "Library",
    description: "Pulls this project's saved & uploaded sources onto the canvas.",
    icon: Library,
    isPrimary: false,
    accent: "var(--color-node-reader)",
  },
  link: {
    kind: "link",
    label: "Link",
    description: "Bring any web page in — preview it, read it, and cite it like a source.",
    icon: Link2,
    isPrimary: false,
    accent: "var(--color-node-link)",
  },
};

export const NODE_ORDER: NodeKind[] = [
  "explorer",
  "library",
  "link",
  "processor",
  "media",
  "block",
  "text",
  "shell",
  "writing",
  "assistant",
];

export const CORE_ORDER: NodeKind[] = [
  "explorer",
  "library",
  "link",
  "processor",
  "media",
  "block",
  "text",
  "shell",
  "assistant",
  "writing",
];

export const ADVANCED_ORDER: NodeKind[] = [];

export const SUGGESTED_NEXT: Record<NodeKind, NodeKind[]> = {
  explorer: ["processor", "shell", "text", "writing"],
  processor: ["shell", "text", "writing", "block"],
  block: ["shell", "processor", "text", "writing"],
  text: ["shell", "processor", "writing"],
  shell: ["shell", "processor", "text", "writing", "block"],
  writing: ["processor", "shell", "text"],
  assistant: [],
  paper: ["processor", "writing", "shell"],
  media: ["processor", "writing", "shell"],
  library: ["processor", "writing"],
  link: ["processor", "writing", "shell"],
};