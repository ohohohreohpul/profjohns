"use client";

import * as React from "react";
import {
  Binoculars as Telescope,
  Plus,
  CircleNotch as Loader2,
  Play,
  Trash as Trash2,
  Check,
  X,
  Clock,
  WarningCircle as AlertCircle,
} from "@phosphor-icons/react";
import { SurfaceScaffold } from "@/components/workspace/workspace-shell";
import { useAuth } from "@/lib/auth/auth-context";
import { useAgentStore, defaultAgentIdFor } from "@/store/agent-store";
import { agentSystemPrompt } from "@/lib/agents";
import { PROVIDER_ORDER, PROVIDER_LABEL, type SourceProvider } from "@/lib/sources-client";
import { type StandingTask, type Finding, type Schedule } from "@/lib/watch";
import { runTaskClient } from "@/lib/watch-run";
import {
  loadStandingTasks,
  saveStandingTask,
  deleteStandingTask,
  loadFindings,
  insertFindings,
  setFindingStatus,
  knownFindingSourceIds,
} from "@/lib/db/repo";
import { cn } from "@/lib/utils";

function newTaskId(): string {
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `task-${uuid}`;
}

const SCHEDULES: { value: Schedule; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "manual", label: "Manual only" },
];

export function WatchSurface() {
  const { enabled, user, loading: authLoading } = useAuth();
  const agents = useAgentStore((s) => s.agents);

  const [tasks, setTasks] = React.useState<StandingTask[]>([]);
  const [findings, setFindings] = React.useState<Finding[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [running, setRunning] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const signedIn = enabled && !!user;

  const refresh = React.useCallback(async () => {
    const [t, f] = await Promise.all([loadStandingTasks(), loadFindings()]);
    setTasks(t ?? []);
    setFindings(f ?? []);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    void useAgentStore.persist.rehydrate();
    if (authLoading) return;
    if (!signedIn) {
      setLoading(false);
      return;
    }
    void refresh();
  }, [authLoading, signedIn, refresh]);

  async function runNow(task: StandingTask) {
    if (running) return;
    setRunning(task.id);
    setError(null);
    try {
      const agent =
        agents.find((a) => a.id === (task.agentId ?? defaultAgentIdFor("scout"))) ??
        agents.find((a) => a.id === defaultAgentIdFor("scout"));
      const known = await knownFindingSourceIds(task.id);
      const results = await runTaskClient(task, {
        persona: agent ? agentSystemPrompt(agent) : undefined,
        knownIds: known,
      });
      await insertFindings(task.id, results);
      await saveStandingTask({ ...task, lastRunAt: Date.now() });
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Run failed.");
    } finally {
      setRunning(null);
    }
  }

  async function toggle(task: StandingTask) {
    await saveStandingTask({ ...task, enabled: !task.enabled });
    void refresh();
  }

  async function remove(task: StandingTask) {
    await deleteStandingTask(task.id);
    void refresh();
  }

  async function decide(finding: Finding, status: "kept" | "dismissed") {
    await setFindingStatus(finding.id, status);
    setFindings((fs) => fs.map((f) => (f.id === finding.id ? { ...f, status } : f)));
  }

  if (!authLoading && !signedIn) {
    return (
      <SurfaceScaffold title="Watch" description="Standing searches that run in the background">
        <div className="mx-auto max-w-md rounded-xl border border-grey-200 bg-paper p-6 text-center shadow-sm">
          <Telescope className="mx-auto size-6 text-grey-300" />
          <p className="mt-2 text-[14px] font-medium text-ink">Sign in to set up standing searches</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-grey-500">
            Standing tasks run server-side and collect new sources while you&apos;re away —
            they need an account to store your watches and findings.
          </p>
        </div>
      </SurfaceScaffold>
    );
  }

  const newFindings = findings.filter((f) => f.status === "new");

  return (
    <SurfaceScaffold
      title="Watch"
      description="Standing searches that gather new sources while you're away"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        {error && (
          <p className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50/50 px-3 py-2 text-[12px] text-red-600">
            <AlertCircle className="size-3.5 shrink-0" />
            {error}
          </p>
        )}

        <NewTaskForm
          onCreate={async (draft) => {
            const now = Date.now();
            await saveStandingTask({
              id: newTaskId(),
              topic: draft.topic,
              sources: draft.sources,
              schedule: draft.schedule,
              agentId: defaultAgentIdFor("scout"),
              enabled: true,
              createdAt: now,
              updatedAt: now,
            });
            void refresh();
          }}
        />

        {/* Tasks */}
        <section>
          <h2 className="mb-2 font-display text-[13px] font-semibold uppercase tracking-wider text-grey-400">
            Standing searches
          </h2>
          {loading ? (
            <p className="text-[13px] text-grey-400">Loading…</p>
          ) : tasks.length === 0 ? (
            <p className="rounded-xl border border-dashed border-grey-200 px-4 py-6 text-center text-[13px] text-grey-400">
              No standing searches yet. Create one above.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {tasks.map((task) => {
                const count = findings.filter(
                  (f) => f.taskId === task.id && f.status === "new",
                ).length;
                return (
                  <div
                    key={task.id}
                    data-testid={`task-${task.id}`}
                    className="flex items-center gap-3 rounded-xl border border-grey-200 bg-paper p-3.5 shadow-sm"
                  >
                    <Telescope className="size-4 shrink-0 text-node-explorer" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-medium text-ink">{task.topic}</p>
                      <p className="mt-0.5 flex items-center gap-2 text-[11px] text-grey-400">
                        <span className="capitalize">{task.schedule}</span>
                        <span>·</span>
                        <span>{task.sources.map((s) => PROVIDER_LABEL[s]).join(", ") || "all sources"}</span>
                        {count > 0 && (
                          <span className="rounded-full bg-emerald-50 px-1.5 font-medium text-emerald-700">
                            {count} new
                          </span>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => toggle(task)}
                      title={task.enabled ? "Enabled" : "Paused"}
                      className={cn(
                        "shrink-0 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                        task.enabled
                          ? "bg-grey-100 text-grey-700 hover:bg-grey-200"
                          : "text-grey-400 hover:bg-grey-100",
                      )}
                    >
                      {task.enabled ? "On" : "Paused"}
                    </button>
                    <button
                      onClick={() => runNow(task)}
                      disabled={running === task.id}
                      data-testid={`task-run-${task.id}`}
                      className="flex shrink-0 items-center gap-1 rounded-md bg-ink px-2.5 py-1.5 text-[11px] font-medium text-paper transition-colors hover:bg-grey-800 disabled:opacity-40"
                    >
                      {running === task.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Play className="size-3.5" />
                      )}
                      Run now
                    </button>
                    <button
                      onClick={() => remove(task)}
                      aria-label="Delete task"
                      className="grid size-7 shrink-0 place-items-center rounded-md text-grey-400 transition-colors hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Findings inbox */}
        <section>
          <h2 className="mb-2 flex items-center gap-2 font-display text-[13px] font-semibold uppercase tracking-wider text-grey-400">
            <Clock className="size-3.5" />
            New findings
            {newFindings.length > 0 && (
              <span className="rounded-full bg-grey-100 px-1.5 text-[11px] font-medium tabular-nums text-grey-600">
                {newFindings.length}
              </span>
            )}
          </h2>
          {newFindings.length === 0 ? (
            <p className="rounded-xl border border-dashed border-grey-200 px-4 py-6 text-center text-[13px] text-grey-400">
              Nothing new. Run a search or wait for the next scheduled sweep.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {newFindings.map((f) => (
                <div
                  key={f.id}
                  className="flex items-start gap-3 rounded-xl border border-grey-200 bg-paper p-3.5 shadow-sm"
                >
                  {f.score != null && (
                    <span className="mt-0.5 shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-emerald-700">
                      {f.score}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium leading-snug text-ink">
                      {f.url ? (
                        <a href={f.url} target="_blank" rel="noreferrer" className="hover:underline">
                          {f.title}
                        </a>
                      ) : (
                        f.title
                      )}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-grey-400">
                      {[f.authors, f.year].filter(Boolean).join(" · ")}
                    </p>
                    {f.why && <p className="mt-1 text-[11px] italic leading-snug text-grey-500">{f.why}</p>}
                  </div>
                  <button
                    onClick={() => decide(f, "kept")}
                    aria-label="Keep"
                    className="grid size-7 shrink-0 place-items-center rounded-md text-grey-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
                  >
                    <Check className="size-4" />
                  </button>
                  <button
                    onClick={() => decide(f, "dismissed")}
                    aria-label="Dismiss"
                    className="grid size-7 shrink-0 place-items-center rounded-md text-grey-400 transition-colors hover:bg-grey-100 hover:text-ink"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </SurfaceScaffold>
  );
}

function NewTaskForm({
  onCreate,
}: {
  onCreate: (draft: { topic: string; sources: SourceProvider[]; schedule: Schedule }) => Promise<void>;
}) {
  const [topic, setTopic] = React.useState("");
  const [sources, setSources] = React.useState<SourceProvider[]>(["openalex"]);
  const [schedule, setSchedule] = React.useState<Schedule>("daily");
  const [busy, setBusy] = React.useState(false);

  function toggleSource(s: SourceProvider) {
    setSources((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  async function submit() {
    if (!topic.trim() || busy) return;
    setBusy(true);
    try {
      await onCreate({ topic: topic.trim(), sources, schedule });
      setTopic("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-grey-200 bg-paper p-4 shadow-sm">
      <div className="flex items-center gap-2 rounded-lg border border-grey-200 bg-grey-50/70 px-3 py-2 transition-colors focus-within:border-grey-300 focus-within:bg-paper">
        <Telescope className="size-4 shrink-0 text-grey-400" />
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          data-testid="watch-topic"
          placeholder="What should I keep watching for? (e.g. 'LLM agents for clinical triage')"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-grey-400"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1">
          {PROVIDER_ORDER.map((s) => (
            <button
              key={s}
              onClick={() => toggleSource(s)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                sources.includes(s)
                  ? "border-ink bg-ink text-paper"
                  : "border-grey-200 text-grey-600 hover:border-grey-300",
              )}
            >
              {PROVIDER_LABEL[s]}
            </button>
          ))}
        </div>
        <select
          value={schedule}
          onChange={(e) => setSchedule(e.target.value as Schedule)}
          className="rounded-md border border-grey-200 bg-paper px-2.5 py-1.5 text-[12px] text-ink outline-none focus:border-grey-400"
        >
          {SCHEDULES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <button
          onClick={submit}
          disabled={!topic.trim() || busy}
          data-testid="watch-create"
          className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-ink px-3.5 py-2 text-[12.5px] font-medium text-paper transition-colors hover:bg-grey-800 disabled:opacity-40"
        >
          <Plus className="size-4" />
          Add watch
        </button>
      </div>
    </section>
  );
}
