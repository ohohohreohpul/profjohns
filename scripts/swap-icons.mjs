// One-shot script: replaces all lucide-react imports with @phosphor-icons/react
// using aliases so JSX usage doesn't need to change.
// Run: node scripts/swap-icons.mjs

import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";

// Lucide name → Phosphor name (same name = no alias needed in JSX)
const MAP = {
  X: "X",
  Sparkles: "Sparkle",
  Send: "PaperPlaneTilt",
  Loader2: "CircleNotch",
  AlertCircle: "WarningCircle",
  Plus: "Plus",
  MousePointer2: "Cursor",
  Hand: "Hand",
  Container: "Package",
  Maximize2: "ArrowsOutSimple",
  Copy: "Copy",
  Trash2: "Trash",
  Play: "Play",
  Unlink: "LinkBreak",
  MousePointerClick: "CursorClick",
  BookOpen: "BookOpen",
  FileText: "FileText",
  ExternalLink: "ArrowSquareOut",
  Quote: "Quotes",
  Check: "Check",
  Upload: "Upload",
  ArrowLeft: "ArrowLeft",
  Network: "Graph",
  Search: "MagnifyingGlass",
  ArrowUpRight: "ArrowUpRight",
  ThumbsUp: "ThumbsUp",
  ThumbsDown: "ThumbsDown",
  Unlock: "LockOpen",
  Bookmark: "BookmarkSimple",
  Clock: "Clock",
  Layers: "Stack",
  Image: "Image",
  Link2: "Link",
  ListTree: "TreeStructure",
  PanelLeftClose: "SidebarSimple",
  PanelLeftOpen: "SidebarSimple",
  Library: "Books",
  BarChart3: "ChartBar",
  Plug: "Plug",
  Lock: "Lock",
  Telescope: "Binoculars",
  PenLine: "PencilSimpleLine",
  ImageOff: "ImageBroken",
  Bold: "TextB",
  Italic: "TextItalic",
  List: "List",
  ListOrdered: "ListNumbers",
  ChevronDown: "CaretDown",
  Wand2: "MagicWand",
  GitCompare: "GitDiff",
  ListFilter: "Funnel",
  Lightbulb: "Lightbulb",
  Heading2: "TextHTwo",
  Pilcrow: "Paragraph",
  Minimize2: "ArrowsInSimple",
  Type: "TextT",
  Code2: "Code",
  Strikethrough: "TextStrikethrough",
  GitBranch: "GitBranch",
  ChevronRight: "CaretRight",
  ChevronLeft: "CaretLeft",
  Download: "Download",
  ArrowRight: "ArrowRight",
  ChevronsUpDown: "CaretUpDown",
  Coins: "Coins",
  Cpu: "Cpu",
  Bot: "Robot",
  Compass: "Compass",
  RotateCw: "ArrowClockwise",
  FolderOpen: "FolderOpen",
  Undo2: "ArrowCounterClockwise",
  Redo2: "ArrowClockwise",
  PanelsTopLeft: "Layout",
  Highlighter: "Highlighter",
  StickyNote: "NoteBlank",
  GripVertical: "DotsSixVertical",
  Minus: "Minus",
  BookMarked: "BookBookmark",
};

function walk(dir) {
  let results = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === ".git") continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) results.push(...walk(full));
    else if (extname(full) === ".tsx" || extname(full) === ".ts") results.push(full);
  }
  return results;
}

function processFile(filepath) {
  let content = readFileSync(filepath, "utf8");
  if (!content.includes('"lucide-react"')) return false;

  let changed = content;

  // Handle multi-line imports: import {\n  Foo,\n  Bar,\n} from "lucide-react";
  // Also handle: import { Foo, Bar } from "lucide-react";
  // Also handle: import { Foo, type LucideIcon } from "lucide-react";
  // Also handle aliased: import { Image as ImageIcon } from "lucide-react";
  // Also handle: import { MousePointer2, Hand, type LucideIcon } from "lucide-react";

  const importRegex = /import\s*\{([^}]+)\}\s*from\s*"lucide-react";?/g;

  changed = changed.replace(importRegex, (match, importBody) => {
    // Parse each imported name
    const lines = importBody
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const phosphorImports = [];

    for (const line of lines) {
      // Handle "type LucideIcon"
      if (line.startsWith("type ")) {
        const typeName = line.replace("type ", "").trim();
        if (typeName === "LucideIcon") {
          phosphorImports.push("type Icon");
        } else {
          phosphorImports.push(`type ${typeName}`);
        }
        continue;
      }

      // Handle "Image as ImageIcon" (alias)
      const aliasMatch = line.match(/^(\w+)\s+as\s+(\w+)$/);
      let lucideName, aliasName;
      if (aliasMatch) {
        lucideName = aliasMatch[1];
        aliasName = aliasMatch[2];
      } else {
        lucideName = line;
        aliasName = null;
      }

      const phosphorName = MAP[lucideName];
      if (!phosphorName) {
        console.warn(`  WARNING: No mapping for "${lucideName}" in ${filepath}`);
        phosphorImports.push(line);
        continue;
      }

      if (phosphorName === lucideName && !aliasName) {
        // Same name, no alias needed
        phosphorImports.push(phosphorName);
      } else if (aliasName) {
        // Keep the same alias: PhosphorName as aliasName
        phosphorImports.push(`${phosphorName} as ${aliasName}`);
      } else {
        // Different name, alias to keep JSX unchanged
        phosphorImports.push(`${phosphorName} as ${lucideName}`);
      }
    }

    // Format the import block
    if (phosphorImports.length === 1) {
      return `import { ${phosphorImports[0]} } from "@phosphor-icons/react";`;
    }
    // Multi-line if original was multi-line, single-line if original was single-line
    const wasMultiLine = importBody.includes("\n");
    if (wasMultiLine) {
      return `import {\n  ${phosphorImports.join(",\n  ")},\n} from "@phosphor-icons/react";`;
    } else {
      return `import { ${phosphorImports.join(", ")} } from "@phosphor-icons/react";`;
    }
  });

  if (changed !== content) {
    writeFileSync(filepath, changed, "utf8");
    return true;
  }
  return false;
}

const srcDir = join(process.cwd(), "src");
const files = walk(srcDir);
let count = 0;
for (const f of files) {
  if (processFile(f)) {
    console.log(`  SWAPPED: ${f}`);
    count++;
  }
}
console.log(`\nDone. ${count} files updated.`);
