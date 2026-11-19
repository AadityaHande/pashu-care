import type { AppData } from "./types";

const STORAGE_KEY = "pashucare-v3";
const LEGACY_KEYS = ["pashucare-demo-v2", "pashucare-demo-v1"];

function keyFor(scope?: string) {
  if (!scope || scope === "demo") return STORAGE_KEY;
  return `${STORAGE_KEY}:${scope.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

export function loadDemoData(fallback: AppData, scope?: string): AppData {
  if (typeof window === "undefined") return fallback;
  try {
    const key = keyFor(scope);
    const raw = window.localStorage.getItem(key) || (scope ? null : LEGACY_KEYS.map((item) => window.localStorage.getItem(item)).find(Boolean) || null);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<AppData>;
    if (!parsed || !Array.isArray(parsed.animals) || !Array.isArray(parsed.reports) || !Array.isArray(parsed.cases)) return fallback;
    return {
      ...fallback,
      ...parsed,
      users: parsed.users ?? fallback.users,
      farms: parsed.farms ?? fallback.farms,
      clusters: parsed.clusters ?? fallback.clusters,
      vaccinations: parsed.vaccinations ?? fallback.vaccinations,
      healthRecords: parsed.healthRecords ?? fallback.healthRecords,
      alerts: parsed.alerts ?? fallback.alerts,
      cropPlans: parsed.cropPlans ?? fallback.cropPlans,
      auditLogs: parsed.auditLogs ?? fallback.auditLogs,
      pendingReports: parsed.pendingReports ?? fallback.pendingReports,
      surveillanceSettings: { ...fallback.surveillanceSettings, ...(parsed.surveillanceSettings ?? {}) },
      escalationRules: parsed.escalationRules ?? fallback.escalationRules,
      counters: { ...fallback.counters, ...(parsed.counters ?? {}) },
    } as AppData;
  } catch {
    return fallback;
  }
}

export function saveDemoData(data: AppData, scope?: string): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(keyFor(scope), JSON.stringify(data)); } catch { /* Firebase is the durable store; local cache is best-effort. */ }
}

export function clearDemoData(scope?: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(keyFor(scope));
  if (!scope) LEGACY_KEYS.forEach((key) => window.localStorage.removeItem(key));
}
