"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Filter,
  Loader2,
  Pencil,
  Plus,
  Search,
  TestTube2,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { useIndexerStore, type IndexerTestPayload } from "@/hooks/use-indexer-store";
import {
  INDEXER_FETCH_MODE_LABELS,
  INDEXER_TYPE_LABELS,
  parseCategories,
  type IndexerDto,
  type IndexerFetchMode,
  type IndexerInput,
  type IndexerTestResult,
  type IndexerType,
} from "@/lib/indexers";
import { cn } from "@/lib/utils";

type FormState = {
  name: string;
  type: IndexerType;
  baseUrl: string;
  apiKey: string;
  username: string;
  password: string;
  fetchMode: IndexerFetchMode;
  categories: string;
  enabled: boolean;
};

type StatusFilter = "all" | "enabled" | "disabled";
type FetchFilter = "all" | IndexerFetchMode;
type TestFilter = "all" | "passed" | "failed" | "untested";
type ModalState =
  | { mode: "create"; indexer?: undefined }
  | { mode: "edit"; indexer: IndexerDto };

const emptyForm: FormState = {
  name: "",
  type: "torznab",
  baseUrl: "",
  apiKey: "",
  username: "",
  password: "",
  fetchMode: "direct",
  categories: "",
  enabled: true,
};

function formFromDto(dto: IndexerDto): FormState {
  return {
    name: dto.name,
    type: dto.type,
    baseUrl: dto.baseUrl,
    apiKey: "",
    username: "",
    password: "",
    fetchMode: dto.fetchMode,
    categories: dto.categories.join(", "),
    enabled: dto.enabled,
  };
}

export function IndexerSettings({
  initialIndexers,
}: {
  initialIndexers: IndexerDto[];
}) {
  const indexers = useIndexerStore((state) => state.indexers);
  const setIndexers = useIndexerStore((state) => state.setIndexers);
  const removeIndexer = useIndexerStore((state) => state.remove);
  const updateIndexer = useIndexerStore((state) => state.update);

  const [modal, setModal] = useState<ModalState | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [fetchFilter, setFetchFilter] = useState<FetchFilter>("all");
  const [testFilter, setTestFilter] = useState<TestFilter>("all");
  const [listError, setListError] = useState<string | null>(null);

  useEffect(() => {
    setIndexers(initialIndexers);
  }, [initialIndexers, setIndexers]);

  const filteredIndexers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return indexers.filter((indexer) => {
      const matchesQuery =
        !normalizedQuery ||
        [
          indexer.name,
          indexer.baseUrl,
          indexer.description ?? "",
          indexer.categories.join(" "),
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "enabled" ? indexer.enabled : !indexer.enabled);
      const matchesFetch = fetchFilter === "all" || indexer.fetchMode === fetchFilter;
      const matchesTest =
        testFilter === "all" ||
        (testFilter === "passed" && indexer.lastTestStatus === "ok") ||
        (testFilter === "failed" &&
          Boolean(indexer.lastTestStatus) &&
          indexer.lastTestStatus !== "ok") ||
        (testFilter === "untested" && !indexer.lastTestStatus);

      return matchesQuery && matchesStatus && matchesFetch && matchesTest;
    });
  }, [fetchFilter, indexers, query, statusFilter, testFilter]);

  const enabledCount = indexers.filter((indexer) => indexer.enabled).length;
  const presetCount = indexers.filter((indexer) => indexer.presetKey).length;

  async function handleToggle(indexer: IndexerDto) {
    setListError(null);
    try {
      await updateIndexer(indexer.id, { enabled: !indexer.enabled });
    } catch (error) {
      setListError(error instanceof Error ? error.message : "Update failed.");
    }
  }

  async function handleDelete(indexer: IndexerDto) {
    if (indexer.presetKey) {
      setListError("Built-in indexers stay in the list. Disable them instead.");
      return;
    }

    setListError(null);
    try {
      await removeIndexer(indexer.id);
    } catch (error) {
      setListError(error instanceof Error ? error.message : "Delete failed.");
    }
  }

  return (
    <section className="space-y-4">
      <div className="border-2 border-foreground bg-card p-4 shadow-line">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black">Indexers</h1>
            <p className="mt-1 max-w-3xl text-sm font-semibold text-muted-foreground">
              Built-in presets can search through native Cardigann support where
              available. Add custom Torznab endpoints for anything not covered.
            </p>
          </div>
          <Button onClick={() => setModal({ mode: "create" })}>
            <Plus className="size-4" />
            Add custom
          </Button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Metric label="Total" value={indexers.length} />
          <Metric label="Enabled" value={enabledCount} />
          <Metric label="Built-in" value={presetCount} />
        </div>
      </div>

      <div className="border-2 border-foreground bg-card p-4 shadow-line">
        <div className="flex items-center gap-2 text-sm font-black uppercase text-muted-foreground">
          <Filter className="size-4" />
          Filters
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px_180px_160px]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className={cn(inputClass, "pl-9")}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, URL, category"
              value={query}
            />
          </label>

          <select
            className={inputClass}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            value={statusFilter}
          >
            <option value="all">All status</option>
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
          </select>

          <select
            className={inputClass}
            onChange={(event) => setFetchFilter(event.target.value as FetchFilter)}
            value={fetchFilter}
          >
            <option value="all">All fetch modes</option>
            <option value="direct">Direct</option>
            <option value="flaresolverr">FlareSolverr</option>
          </select>

          <select
            className={inputClass}
            onChange={(event) => setTestFilter(event.target.value as TestFilter)}
            value={testFilter}
          >
            <option value="all">All tests</option>
            <option value="passed">Passed</option>
            <option value="failed">Failed</option>
            <option value="untested">Untested</option>
          </select>
        </div>

        {listError ? (
          <p className="mt-4 border-2 border-destructive bg-background px-3 py-2 text-sm font-bold text-destructive">
            {listError}
          </p>
        ) : null}
      </div>

      <div className="grid gap-3">
        {filteredIndexers.length === 0 ? (
          <div className="border-2 border-dashed border-foreground bg-card p-6 shadow-line">
            <p className="font-black">No indexers match these filters</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Clear a filter or add a custom Torznab endpoint.
            </p>
          </div>
        ) : null}

        {filteredIndexers.map((indexer) => (
          <IndexerRow
            indexer={indexer}
            key={indexer.id}
            onDelete={() => void handleDelete(indexer)}
            onEdit={() => setModal({ mode: "edit", indexer })}
            onToggle={() => void handleToggle(indexer)}
          />
        ))}
      </div>

      {modal ? <IndexerModal modal={modal} onClose={() => setModal(null)} /> : null}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-2 border-foreground bg-background p-3">
      <div className="text-xs font-black uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-black tabular-nums">{value}</div>
    </div>
  );
}

function IndexerRow({
  indexer,
  onEdit,
  onDelete,
  onToggle,
}: {
  indexer: IndexerDto;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const test = useIndexerStore((state) => state.test);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<IndexerTestResult | null>(null);

  async function handleTest() {
    setTesting(true);
    setResult(null);
    try {
      setResult(await test(indexerToTestPayload(indexer)));
    } catch (error) {
      setResult({
        ok: false,
        message: error instanceof Error ? error.message : "Test failed.",
      });
    } finally {
      setTesting(false);
    }
  }

  return (
    <article className="border-2 border-foreground bg-card p-4 shadow-line">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-black leading-tight">{indexer.name}</span>
            <Badge>{INDEXER_TYPE_LABELS[indexer.type]}</Badge>
            <Badge>{INDEXER_FETCH_MODE_LABELS[indexer.fetchMode]}</Badge>
            {indexer.presetKey ? <Badge>Built-in</Badge> : null}
            {indexer.hasApiKey ? <Badge>API key</Badge> : null}
            {indexer.hasLoginCredentials ? <Badge>Login</Badge> : null}
            {indexer.requiresApiKey && !indexer.hasApiKey ? (
              <Badge tone="warning">Needs key</Badge>
            ) : null}
          </div>

          {indexer.description ? (
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              {indexer.description}
            </p>
          ) : null}

          <p className="mt-2 break-all text-sm font-semibold text-muted-foreground">
            {indexer.baseUrl}
          </p>

          {indexer.categories.length ? (
            <p className="mt-1 text-xs font-bold text-muted-foreground">
              Categories: {indexer.categories.join(", ")}
            </p>
          ) : null}

          <TestStatus result={result} indexer={indexer} testing={testing} />
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <label className="flex h-9 cursor-pointer items-center gap-2 border-2 border-foreground bg-background px-3 text-xs font-black uppercase">
            <input
              checked={indexer.enabled}
              className="size-4 accent-foreground"
              onChange={onToggle}
              type="checkbox"
            />
            {indexer.enabled ? "On" : "Off"}
          </label>

          <Button
            disabled={testing}
            onClick={() => void handleTest()}
            size="sm"
            variant="outline"
          >
            {testing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <TestTube2 className="size-4" />
            )}
            Test
          </Button>
          <Button onClick={onEdit} size="sm" variant="outline">
            <Pencil className="size-4" />
            Edit
          </Button>
          {!indexer.presetKey ? (
            <Button onClick={onDelete} size="sm" variant="outline">
              <Trash2 className="size-4" />
              Delete
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function IndexerModal({ modal, onClose }: { modal: ModalState; onClose: () => void }) {
  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/35 p-4 pt-10"
      role="dialog"
    >
      <div className="w-full max-w-3xl border-2 border-foreground bg-card p-4 shadow-line">
        <IndexerForm mode={modal.mode} indexer={modal.indexer} onClose={onClose} />
      </div>
    </div>
  );
}

function IndexerForm({
  mode,
  indexer,
  onClose,
}: {
  mode: "create" | "edit";
  indexer?: IndexerDto;
  onClose: () => void;
}) {
  const createIndexer = useIndexerStore((state) => state.create);
  const updateIndexer = useIndexerStore((state) => state.update);
  const test = useIndexerStore((state) => state.test);

  const [form, setForm] = useState<FormState>(
    indexer ? formFromDto(indexer) : emptyForm,
  );
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<IndexerTestResult | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toInput(): IndexerInput {
    return {
      name: form.name.trim(),
      type: form.type,
      baseUrl: form.baseUrl.trim(),
      apiKey: form.apiKey || undefined,
      username: form.username || undefined,
      password: form.password || undefined,
      fetchMode: form.fetchMode,
      enabled: form.enabled,
      categories: parseCategories(form.categories),
    };
  }

  function toTestPayload(): IndexerTestPayload {
    return {
      id: indexer?.id,
      name: form.name.trim() || "Indexer",
      type: form.type,
      baseUrl: form.baseUrl.trim(),
      apiKey: form.apiKey ? form.apiKey : undefined,
      username: form.username ? form.username : undefined,
      password: form.password ? form.password : undefined,
      fetchMode: form.fetchMode,
      categories: parseCategories(form.categories),
    };
  }

  async function handleTest() {
    if (!form.baseUrl.trim()) {
      setError("Enter a base URL before testing.");
      return;
    }
    setError(null);
    setResult(null);
    setTesting(true);
    try {
      setResult(await test(toTestPayload()));
    } catch (testError) {
      setResult({
        ok: false,
        message: testError instanceof Error ? testError.message : "Test failed.",
      });
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    if (!form.name.trim() || !form.baseUrl.trim()) {
      setError("Name and base URL are required.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      if (mode === "create") {
        await createIndexer(toInput());
      } else if (indexer) {
        await updateIndexer(indexer.id, toInput());
      }
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black">
            {mode === "create" ? "Add custom indexer" : `Edit ${indexer?.name}`}
          </h2>
          {mode === "edit" && indexer?.description ? (
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              {indexer.description}
            </p>
          ) : null}
        </div>
        <Button aria-label="Close" onClick={onClose} size="icon" variant="ghost">
          <X className="size-5" />
        </Button>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <input
            className={inputClass}
            onChange={(event) => update("name", event.target.value)}
            placeholder="My Tracker"
            value={form.name}
          />
        </Field>

        <Field label="Type">
          <select
            className={inputClass}
            onChange={(event) => update("type", event.target.value as IndexerType)}
            value={form.type}
          >
            {Object.entries(INDEXER_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <Field className="sm:col-span-2" label="Base URL">
          <input
            className={inputClass}
            onChange={(event) => update("baseUrl", event.target.value)}
            placeholder="https://tracker.example/api"
            value={form.baseUrl}
          />
        </Field>

        <Field
          label="API key"
          hint={
            mode === "edit" && indexer?.hasApiKey
              ? "Leave blank to keep the stored key."
              : "Optional, if the indexer requires one."
          }
        >
          <input
            autoComplete="off"
            className={inputClass}
            onChange={(event) => update("apiKey", event.target.value)}
            placeholder={mode === "edit" && indexer?.hasApiKey ? "Stored key" : ""}
            type="password"
            value={form.apiKey}
          />
        </Field>

        <Field
          label="Username"
          hint={
            mode === "edit" && indexer?.hasLoginCredentials
              ? "Leave blank to keep the stored username."
              : "Optional, for indexers with login."
          }
        >
          <input
            autoComplete="off"
            className={inputClass}
            onChange={(event) => update("username", event.target.value)}
            placeholder={
              mode === "edit" && indexer?.hasLoginCredentials ? "Stored username" : ""
            }
            value={form.username}
          />
        </Field>

        <Field
          label="Password"
          hint={
            mode === "edit" && indexer?.hasLoginCredentials
              ? "Leave blank to keep the stored password."
              : "Optional, for indexers with login."
          }
        >
          <input
            autoComplete="off"
            className={inputClass}
            onChange={(event) => update("password", event.target.value)}
            placeholder={
              mode === "edit" && indexer?.hasLoginCredentials ? "Stored password" : ""
            }
            type="password"
            value={form.password}
          />
        </Field>

        <Field label="Fetch mode">
          <select
            className={inputClass}
            onChange={(event) =>
              update("fetchMode", event.target.value as IndexerFetchMode)
            }
            value={form.fetchMode}
          >
            {Object.entries(INDEXER_FETCH_MODE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <Field
          className="sm:col-span-2"
          label="Categories"
          hint="Category ids, comma-separated, for example 2000, 5000."
        >
          <input
            className={inputClass}
            onChange={(event) => update("categories", event.target.value)}
            placeholder="2000, 5000"
            value={form.categories}
          />
        </Field>

        <label className="flex cursor-pointer items-center gap-2 text-sm font-bold sm:col-span-2">
          <input
            checked={form.enabled}
            className="size-4 accent-foreground"
            onChange={(event) => update("enabled", event.target.checked)}
            type="checkbox"
          />
          Enabled for searches
        </label>
      </div>

      {result ? <TestResultBanner result={result} /> : null}

      {error ? (
        <p className="mt-4 border-2 border-destructive bg-background px-3 py-2 text-sm font-bold text-destructive">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button disabled={testing} onClick={() => void handleTest()} variant="outline">
          {testing ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <TestTube2 className="size-4" />
          )}
          Test
        </Button>
        <Button disabled={saving} onClick={() => void handleSave()}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : null}
          {mode === "create" ? "Add indexer" : "Save changes"}
        </Button>
      </div>
    </>
  );
}

const inputClass =
  "h-10 w-full border-2 border-foreground bg-background px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-ring";

function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn("flex flex-col gap-1", className)}>
      <span className="text-xs font-black uppercase text-muted-foreground">
        {label}
      </span>
      {children}
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

function Badge({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "warning";
}) {
  return (
    <span
      className={cn(
        "border-2 border-foreground bg-background px-2 py-0.5 text-[10px] font-black uppercase",
        tone === "warning" && "border-destructive text-destructive",
      )}
    >
      {children}
    </span>
  );
}

function TestResultBanner({ result }: { result: IndexerTestResult }) {
  return (
    <div
      className={cn(
        "mt-4 flex items-center gap-2 border-2 border-foreground px-3 py-2 text-sm font-bold",
        result.ok
          ? "bg-secondary text-secondary-foreground"
          : "border-destructive bg-background text-destructive",
      )}
    >
      {result.ok ? (
        <CheckCircle2 className="size-4" />
      ) : (
        <AlertTriangle className="size-4" />
      )}
      {result.message}
    </div>
  );
}

function TestStatus({
  result,
  indexer,
  testing,
}: {
  result: IndexerTestResult | null;
  indexer: IndexerDto;
  testing: boolean;
}) {
  if (testing) {
    return (
      <p className="mt-2 flex items-center gap-2 text-xs font-bold text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        Testing indexer
      </p>
    );
  }

  const effective: IndexerTestResult | null =
    result ??
    (indexer.lastTestStatus
      ? { ok: indexer.lastTestStatus === "ok", message: lastTestSummary(indexer) }
      : null);

  if (!effective) {
    return (
      <p className="mt-2 text-xs font-bold text-muted-foreground">Not tested yet.</p>
    );
  }

  return (
    <p
      className={cn(
        "mt-2 flex items-center gap-2 text-xs font-bold",
        effective.ok ? "text-foreground" : "text-destructive",
      )}
    >
      {effective.ok ? (
        <CheckCircle2 className="size-3.5" />
      ) : (
        <AlertTriangle className="size-3.5" />
      )}
      {effective.message}
    </p>
  );
}

function lastTestSummary(indexer: IndexerDto): string {
  if (indexer.lastTestStatus === "ok") {
    return "Last test passed.";
  }
  return indexer.lastTestStatus ?? "Not tested yet.";
}

function indexerToTestPayload(indexer: IndexerDto): IndexerTestPayload {
  return {
    id: indexer.id,
    name: indexer.name,
    type: indexer.type,
    baseUrl: indexer.baseUrl,
    fetchMode: indexer.fetchMode,
    categories: indexer.categories,
  };
}
