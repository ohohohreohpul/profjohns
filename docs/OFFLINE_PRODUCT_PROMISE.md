# Offline Product Promise (SYNC-003)

## Decision: Local-first editing with optional cloud sync

**Revised claim:**

> Local-first editing with optional cloud synchronization. AI and research
> search require an internet connection.

## What this means

### Works offline (no internet required)
- Creating and editing canvases (nodes, edges, documents)
- Writing and editing documents (TipTap editor)
- Organizing sources and highlights
- All localStorage-backed state

### Requires internet
- AI features (writing, summarizing, auditing, voice profiling)
- Research search (OpenAlex, arXiv, Semantic Scholar, Wikipedia)
- PDF extraction (server-side via unpdf)
- CLIP figure search (Replicate)
- URL reading / link preview
- Cloud synchronization
- Background agent (scheduled source watch)
- Authentication

## What was removed from claims

The following claims are no longer made:
- "Fully offline" — the app depends on OpenRouter, Supabase, Replicate,
  and external research indexes
- "Nothing leaves your device" — AI features send content to vendors
- "Native macOS and Windows" — the app is web-only for launch

## Future full-offline path (not for initial launch)

A true offline product would require:
- Local source index (replacing Supabase pgvector)
- Local PDF processing (replacing server-side unpdf — possible with pdf.js)
- Local embedding model (replacing the Suplicate CLIP and Supabase embed function)
- Local or user-provided writing model (replacing OpenRouter)
- Offline job queue (for background tasks)
- Desktop packaging (Electron or Tauri)
- Encrypted local database (replacing localStorage)
- Synchronization when connectivity returns
