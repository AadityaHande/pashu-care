import type { AppData, AuditLog, DemoUser, PendingHealthReport, Role, Vaccination } from "./types";

export function audit(data: AppData, actor: DemoUser, action: string, entityType: string, entityId: string, summary: string): AppData {
  const entry: AuditLog = { id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, actorId: actor.id, actorName: actor.name, actorRole: actor.role, action, entityType, entityId, summary, createdAt: new Date().toISOString() };
  return { ...data, auditLogs: [entry, ...(data.auditLogs ?? [])].slice(0, 500) };
}

export function getDemoUserForRole(users: DemoUser[], role: Role) { return users.find((u) => u.role === role) ?? null; }

export function applyQueuedReports(data: AppData, submit: (current: AppData, user: DemoUser, queued: PendingHealthReport) => AppData): AppData {
  if (!data.pendingReports?.length) return data;
  let next = data;
  const queue = [...data.pendingReports];
  for (const pending of queue) {
    const farmer = next.users.find((u) => u.id === pending.farmerId && u.role === "FARMER");
    if (farmer) next = submit(next, farmer, pending);
  }
  return { ...next, pendingReports: [] };
}

export function processEscalations(data: AppData, now = new Date()): AppData {
  let alerts = [...data.alerts];
  const rules = data.escalationRules ?? [];
  const alreadyAlerted = new Set(alerts.filter(a => a.type === "ESCALATION").map(a => `${a.relatedId}:${a.title}`));
  const add = (recipientId: string, title: string, message: string, relatedId: string) => {
    if (alreadyAlerted.has(`${relatedId}:${title}`)) return;
    const user = data.users.find(u => u.id === recipientId);
    if (!user) return;
    alerts.unshift({ id: `ALT-ESC-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, recipientId, type: "ESCALATION", title, message, relatedId, createdAt: now.toISOString() });
    alreadyAlerted.add(`${relatedId}:${title}`);
  };
  for (const rule of rules.filter(r => r.enabled)) {
    if (rule.condition === "PRIORITY_UNREVIEWED") {
      data.cases.filter(c => (!data.surveillanceSettings.escalationPriorityOnly || c.priority === "PRIORITY") && c.status === "OPEN" && (now.getTime() - new Date(c.createdAt).getTime()) / 3600000 >= (rule.afterHours || data.surveillanceSettings.escalationAfterHours))
        .forEach(c => add(rule.notifyRole === "FARMER" ? c.farmerId : c.veterinarianId, rule.name, `${c.id} is still awaiting veterinary review.`, c.id));
    } else if (rule.condition === "FOLLOW_UP_OVERDUE") {
      data.cases.filter(c => c.followUpRequired && c.followUpDate && c.followUpDate < now.toISOString().slice(0, 10) && c.status !== "CLOSED")
        .forEach(c => add(c.veterinarianId, rule.name, `${c.id} has a follow-up date in the past.`, c.id));
    } else if (rule.condition === "VACCINATION_OVERDUE") {
      data.vaccinations.filter(v => v.dueOn < now.toISOString().slice(0, 10) && v.status !== "COMPLETED")
        .forEach(v => { const animal = data.animals.find(a => a.id === v.animalId); if (animal) add(animal.farmerId, rule.name, `${v.vaccineName} for ${animal.name} is overdue.`, v.id); });
    } else if (rule.condition === "CLUSTER_UNREVIEWED") {
      data.clusters.filter(c => c.status === "NEEDS_REVIEW" && (now.getTime() - new Date(c.detectedAt).getTime()) / 3600000 >= rule.afterHours)
        .forEach(c => add(rule.notifyRole === "FARMER" ? data.users.find(u => u.role === "FARMER")?.id ?? "" : data.users.find(u => u.role === "VETERINARIAN")?.id ?? "", rule.name, `${c.id} in ${c.area} still needs veterinary review.`, c.id));
    }
  }
  return { ...data, alerts };
}

export function downloadCsv(filename: string, rows: Array<Record<string, string | number | boolean | null | undefined>>) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = [headers.map(escape).join(","), ...rows.map(row => headers.map(key => escape(row[key])).join(","))].join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
}

export function processRemindersAndEscalations(data: AppData, now = new Date()): AppData {
  const today = now.toISOString().slice(0, 10);
  const end = new Date(now.getTime() + data.surveillanceSettings.vaccinationReminderDays * 86400000).toISOString().slice(0, 10);
  const alerts = [...data.alerts];
  const has = (type: string, relatedId: string, recipientId: string) => alerts.some(a => a.type === type && a.relatedId === relatedId && a.recipientId === recipientId);
  let counter = data.counters.alert;
  const add = (recipientId: string, type: AlertLogType, title: string, message: string, relatedId: string) => {
    if (has(type, relatedId, recipientId)) return;
    alerts.unshift({ id: `ALT-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, recipientId, type, title, message, relatedId, createdAt: now.toISOString() });
    counter += 1;
  };
  type AlertLogType = "VACCINATION" | "FOLLOW_UP";
  const vaccinations = data.vaccinations.map(v => {
    const status: Vaccination["status"] = v.dueOn < today ? "OVERDUE" : v.dueOn <= end ? "DUE" : "COMPLETED";
    const animal = data.animals.find(a => a.id === v.animalId);
    if (animal && status === "OVERDUE") add(animal.farmerId, "VACCINATION", "Vaccination overdue", `${v.vaccineName} for ${animal.name} is overdue. Contact the veterinarian to arrange the next step.`, v.id);
    else if (animal && status === "DUE") add(animal.farmerId, "VACCINATION", "Vaccination due soon", `${v.vaccineName} for ${animal.name} is approaching its due date.`, v.id);
    return { ...v, status };
  });
  data.cases.filter(c => c.followUpRequired && c.followUpDate && c.status !== "CLOSED" && c.followUpDate <= new Date(now.getTime() + data.surveillanceSettings.followUpReminderDays * 86400000).toISOString().slice(0, 10))
    .forEach(c => add(c.veterinarianId, "FOLLOW_UP", "Veterinary follow-up reminder", `${c.id} has a follow-up scheduled for ${c.followUpDate}.`, c.id));
  const next = { ...data, vaccinations, alerts, counters: { ...data.counters, alert: counter } };
  return processEscalations(next, now);
}
