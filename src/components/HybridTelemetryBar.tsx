import type { User } from "firebase/auth";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cloud,
  Cpu,
  Download,
  Loader2,
  ShieldCheck,
  Sparkles,
  Wifi,
  WifiOff,
} from "lucide-react";
import type { LocalModelStatus } from "../services/aiService";
import type { RoutingMode, TelemetrySnapshot } from "../types/models";
import { AuthControl } from "./AuthControl";

interface HybridTelemetryBarProps {
  online: boolean;
  user: User | null;
  firebaseConfigured: boolean;
  appCheckEnabled: boolean;
  authBusy: "guest" | "google" | null;
  route: RoutingMode;
  telemetry: TelemetrySnapshot | null;
  running: boolean;
  localStatus: LocalModelStatus | null;
  downloadProgress: number | null;
  syncing: boolean;
  pendingCount: number;
  onRouteChange: (route: RoutingMode) => void;
  onPrepareLocal: () => void;
  onGuest: () => void;
  onGoogle: () => void;
  onSignOut: () => void;
}

const ROUTE_OPTIONS: Array<{
  value: RoutingMode;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  {
    value: "auto",
    label: "Auto Hybrid",
    shortLabel: "Auto",
    description: "Gemini Nano first, automatic Cloud fallback for long or unavailable cases.",
  },
  {
    value: "local",
    label: "Force Local",
    shortLabel: "Local",
    description: "Deterministic demo mode: always use Gemini Nano 4 on this device.",
  },
  {
    value: "cloud",
    label: "Force Cloud",
    shortLabel: "Cloud",
    description: "Deterministic demo mode: always use Firebase AI Logic in the cloud.",
  },
];

function tokenLabel(tokens: number): string {
  return tokens >= 1_000 ? `${(tokens / 1_000).toFixed(1)}k` : String(tokens);
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
        <Sparkles className="h-5 w-5 text-emerald-300" aria-hidden="true" />
        <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-emerald-500 text-[8px] font-bold text-white">
          4
        </span>
      </div>
      <div className="leading-tight">
        <div className="flex items-center gap-2">
          <span className="text-[17px] font-semibold tracking-tight text-slate-900">NanoStudy</span>
          <span className="hidden rounded-full bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-white sm:inline">
            Hybrid
          </span>
        </div>
        <p className="text-[11px] text-slate-500">Hybrid AI Study Workspace</p>
      </div>
    </div>
  );
}

function NetworkPill({
  online,
  user,
  syncing,
  pendingCount,
}: {
  online: boolean;
  user: User | null;
  syncing: boolean;
  pendingCount: number;
}) {
  if (!online) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
        <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
        Offline Mode • Local IndexedDB
      </span>
    );
  }

  const label = !user
    ? "Online • Local Workspace"
    : syncing || pendingCount > 0
      ? "Online • Sync Active"
      : "Online • Cloud Synced";

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
      <Wifi className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}

function SyncChip({
  user,
  online,
  syncing,
  pendingCount,
}: {
  user: User | null;
  online: boolean;
  syncing: boolean;
  pendingCount: number;
}) {
  if (!user) return null;

  if (!online) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-white px-2 py-1 text-[10px] font-semibold text-amber-700"
        title="Changes are stored in IndexedDB and will sync when the connection returns."
      >
        <Cloud className="h-3 w-3" aria-hidden="true" />
        {pendingCount > 0 ? `${pendingCount} queued` : "Local queue"}
      </span>
    );
  }

  if (syncing) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-1 text-[10px] font-semibold text-sky-700">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        Syncing…
      </span>
    );
  }

  if (pendingCount > 0) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700"
        title="Local changes waiting to be pushed to Firestore."
      >
        <Cloud className="h-3 w-3" aria-hidden="true" />
        {pendingCount} pending
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-white px-2 py-1 text-[10px] font-semibold text-emerald-700">
      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
      Cloud synced
    </span>
  );
}

function TelemetryBadge({
  running,
  telemetry,
}: {
  running: boolean;
  telemetry: TelemetrySnapshot | null;
}) {
  if (running) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-violet-700">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        Routing inference…
      </span>
    );
  }

  if (!telemetry) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-200/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-slate-600">
        <Activity className="h-3.5 w-3.5" aria-hidden="true" />
        Awaiting inference
      </span>
    );
  }

  if (telemetry.source === "ON_DEVICE") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-emerald-800">
        <Cpu className="h-3.5 w-3.5" aria-hidden="true" />
        On-device • Gemini Nano 4
      </span>
    );
  }

  if (telemetry.source === "IN_CLOUD") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-sky-800">
        <Cloud className="h-3.5 w-3.5" aria-hidden="true" />
        Cloud fallback • Firebase AI Logic
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-amber-800">
      <Activity className="h-3.5 w-3.5" aria-hidden="true" />
      Hybrid router • Source not reported
    </span>
  );
}

function RouteSwitcher({
  route,
  onChange,
}: {
  route: RoutingMode;
  onChange: (route: RoutingMode) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Demo routing mode"
      className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm"
    >
      {ROUTE_OPTIONS.map((option) => {
        const active = route === option.value;
        const activeClass =
          option.value === "local"
            ? "bg-emerald-600 text-white shadow-sm"
            : option.value === "cloud"
              ? "bg-sky-600 text-white shadow-sm"
              : "bg-slate-900 text-white shadow-sm";

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            title={option.description}
            className={`rounded-md px-2 py-1 text-[10px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900 ${
              active ? activeClass : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            }`}
          >
            <span className="hidden sm:inline">{option.label}</span>
            <span className="sm:hidden">{option.shortLabel}</span>
          </button>
        );
      })}
    </div>
  );
}

function LocalModelChip({
  status,
  downloadProgress,
  onPrepare,
}: {
  status: LocalModelStatus | null;
  downloadProgress: number | null;
  onPrepare: () => void;
}) {
  if (downloadProgress !== null) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        Downloading Nano {downloadProgress}%
      </span>
    );
  }

  if (status === "available") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-white px-2 py-1 text-[10px] font-semibold text-emerald-700"
        title="Gemini Nano 4 is ready for on-device inference."
      >
        <Cpu className="h-3 w-3" aria-hidden="true" />
        Nano ready
      </span>
    );
  }

  if (status === "downloadable" || status === "downloading") {
    return (
      <button
        type="button"
        onClick={onPrepare}
        title="Download Gemini Nano 4 once. This is a one-time, multi-gigabyte download managed by Chrome."
        className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700 transition hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber-600"
      >
        <Download className="h-3 w-3" aria-hidden="true" />
        {status === "downloading" ? "Nano downloading…" : "Enable Nano"}
      </button>
    );
  }

  if (status === "unavailable") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700"
        title="Gemini Nano is unavailable here. Use Chrome 139+ on desktop, enable the Prompt API flag, and download the model in chrome://components. Cloud fallback still works."
      >
        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
        Nano unavailable
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-500">
      <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
      Checking Nano…
    </span>
  );
}

export function HybridTelemetryBar({
  online,
  user,
  firebaseConfigured,
  appCheckEnabled,
  authBusy,
  route,
  telemetry,
  running,
  localStatus,
  downloadProgress,
  syncing,
  pendingCount,
  onRouteChange,
  onPrepareLocal,
  onGuest,
  onGoogle,
  onSignOut,
}: HybridTelemetryBarProps) {
  const reason = running
    ? `Running ${route === "auto" ? "hybrid" : route === "local" ? "on-device" : "cloud"} inference…`
    : telemetry?.reason ?? "Run an AI action to see the routing decision, model, and latency.";

  return (
    <header className="shrink-0 border-b border-slate-200/80 bg-white">
      <div className="mx-auto max-w-[1800px] px-3 py-3 sm:px-5 lg:px-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Brand />

          <div className="flex flex-wrap items-center gap-2">
            <NetworkPill online={online} user={user} syncing={syncing} pendingCount={pendingCount} />
            <SyncChip user={user} online={online} syncing={syncing} pendingCount={pendingCount} />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <AuthControl
              user={user}
              firebaseConfigured={firebaseConfigured}
              busy={authBusy}
              onGuest={onGuest}
              onGoogle={onGoogle}
              onSignOut={onSignOut}
            />
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-2.5 py-2">
          <span className="hidden text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400 md:inline">
            Hybrid telemetry
          </span>

          <TelemetryBadge running={running} telemetry={telemetry} />

          {telemetry && !running && telemetry.source !== "ON_DEVICE" && (
            <span className="rounded-md bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-600 ring-1 ring-slate-200">
              {telemetry.model}
            </span>
          )}

          {telemetry && !running && (
            <span className="rounded-md bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-600 ring-1 ring-slate-200">
              {telemetry.latencyMs} ms
            </span>
          )}

          {telemetry && !running && (
            <span className="hidden rounded-md bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-500 ring-1 ring-slate-200 lg:inline">
              ~{tokenLabel(telemetry.estimatedTokens)} tok
            </span>
          )}

          <span className="min-w-0 flex-1 truncate text-[11px] text-slate-500" title={reason}>
            {reason}
          </span>

          <span
            className="hidden items-center gap-1 text-[10px] font-medium text-slate-400 xl:inline-flex"
            title={appCheckEnabled ? "Firebase App Check is active." : "Firebase App Check is not active."}
          >
            <ShieldCheck
              className={`h-3 w-3 ${appCheckEnabled ? "text-emerald-500" : "text-slate-300"}`}
              aria-hidden="true"
            />
            App Check
          </span>

          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <LocalModelChip
              status={localStatus}
              downloadProgress={downloadProgress}
              onPrepare={onPrepareLocal}
            />
            <RouteSwitcher route={route} onChange={onRouteChange} />
          </div>
        </div>
      </div>
    </header>
  );
}
