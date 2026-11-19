import type { AppData, DemoUser, PendingHealthReport, Severity } from "./types";
import { audit } from "./enhancements";
import { assessPreliminaryRisk, detectPossibleCluster } from "./surveillance";

export type ReportInput = {
  animalId: string; symptoms: string[]; onsetDate: string; severity: Severity;
  mortality: boolean; mortalityCount?: number; location: string; notes: string;
  latitude?: number; longitude?: number; photoDataUrl?: string; voiceTranscript?: string;
};

export function createReportInData(current: AppData, farmer: DemoUser, input: ReportInput, now = new Date()): AppData {
  const animal = current.animals.find(a => a.id === input.animalId && a.farmerId === farmer.id);
  if (!animal) return current;
  const idScope = farmer.id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 28) || "farmer";
  const eventNonce = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const reportId = `RPT-${idScope}-${eventNonce}`;
  const caseId = `CASE-${idScope}-${eventNonce}`;
  const submittedAt = now.toISOString();
  const risk = assessPreliminaryRisk({ ...input, healthHistoryCount: current.healthRecords.filter(h => h.animalId === animal.id).length }, reportId, now, current.surveillanceSettings);
  const clusterMatch = detectPossibleCluster({ id: reportId, location: input.location, symptoms: input.symptoms, submittedAt, latitude: input.latitude, longitude: input.longitude }, current.reports, now, current.surveillanceSettings);
  const clusterId = clusterMatch.possible ? `CLUSTER-${idScope}-${eventNonce}` : undefined;
  const report = {
    id: reportId, animalId: animal.id, farmerId: farmer.id, farmId: animal.farmId,
    symptoms: input.symptoms, onsetDate: input.onsetDate, severity: input.severity,
    mortality: input.mortality, mortalityCount: input.mortalityCount, location: input.location,
    notes: input.notes, status: "VALIDATED" as const, submittedAt, assessment: risk,
    caseId, clusterId, latitude: input.latitude, longitude: input.longitude,
    photoDataUrl: input.photoDataUrl, voiceTranscript: input.voiceTranscript,
  };
  const veterinary = current.users.find(u => u.role === "VETERINARIAN");
  const caseItem = {
    id: caseId, reportId, animalId: animal.id, farmerId: farmer.id,
    veterinarianId: veterinary?.id ?? "", priority: risk.priority, status: "OPEN" as const,
    assessment: "", treatment: "", recommendation: "", followUpRequired: false,
    followUpNotes: "", createdAt: submittedAt, updatedAt: submittedAt,
  };
  const alerts = [...current.alerts];
  let nextAlert = current.counters.alert;
  const addAlert = (recipientId: string, type: "PRIORITY" | "CLUSTER" | "ADVISORY", title: string, message: string, relatedId: string) => {
    alerts.unshift({ id: `ALT-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, recipientId, type, title, message, relatedId, createdAt: submittedAt });
    nextAlert += 1;
  };
  if (caseItem.veterinarianId && risk.priority === "PRIORITY") addAlert(caseItem.veterinarianId, "PRIORITY", "New priority veterinary case", `${caseId} has been routed for earlier review. ${animal.name} · ${input.location}.`, caseId);
  if (caseItem.veterinarianId && clusterMatch.possible && clusterId) addAlert(caseItem.veterinarianId, "CLUSTER", "Possible cluster needs review", `${clusterMatch.matchedReportIds.length + 1} similar reports are grouped in ${input.location}. Review the supporting reports.`, clusterId);
  if (!caseItem.veterinarianId) addAlert(farmer.id, "ADVISORY", "Veterinarian not assigned yet", `${caseId} is saved. An approved veterinarian account must be provisioned before the case can be assigned for review.`, caseId);
  let next: AppData = {
    ...current,
    reports: [report, ...current.reports],
    cases: [caseItem, ...current.cases],
    clusters: clusterMatch.possible && clusterId ? [...current.clusters, {
      id: clusterId, area: input.location, reportIds: [...clusterMatch.matchedReportIds, reportId],
      symptoms: clusterMatch.matchedSymptoms, windowDays: current.surveillanceSettings.clusterWindowDays,
      detectedAt: submittedAt, status: "NEEDS_REVIEW",
      centroidLatitude: input.latitude, centroidLongitude: input.longitude,
    }] : current.clusters,
    alerts,
    animals: current.animals.map(a => a.id === animal.id && risk.priority === "PRIORITY" ? { ...a, healthStatus: "Under observation" } : a),
    counters: { ...current.counters, report: current.counters.report + 1, case: current.counters.case + 1, alert: nextAlert },
  };
  next = audit(next, farmer, "REPORT_SUBMITTED", "HealthReport", reportId, `Submitted report for ${animal.name}; preliminary queue: ${risk.priority.toLowerCase()}.`);
  next = audit(next, farmer, "CASE_CREATED", "VeterinaryCase", caseId, `Created ${risk.priority.toLowerCase()} veterinary case from ${reportId}.`);
  return next;
}

export function queueReport(data: AppData, farmer: DemoUser, input: ReportInput): AppData {
  const pending: PendingHealthReport = { id: `PENDING-${farmer.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, farmerId: farmer.id, queuedAt: new Date().toISOString(), payload: input };
  const next = { ...data, pendingReports: [...data.pendingReports, pending] };
  return audit(next, farmer, "REPORT_QUEUED_OFFLINE", "PendingHealthReport", pending.id, "Saved a report in the device recovery queue for synchronization when connectivity returns.");
}

export function updateCaseInData(current: AppData, actor: DemoUser, input: {
  caseId: string; assessment: string; treatment: string; recommendation: string;
  status: "OPEN" | "IN_PROGRESS" | "CLOSED"; followUpRequired: boolean;
  followUpDate?: string; followUpNotes: string;
  addVaccination: boolean; vaccineName: string; vaccineDue: string; veterinarianId: string;
}): AppData {
  const existing = current.cases.find(c => c.id === input.caseId);
  if (!existing || actor.role !== "VETERINARIAN") return current;
  const now = new Date().toISOString();
  const updated = { ...existing, veterinarianId: input.veterinarianId || existing.veterinarianId, assessment: input.assessment, treatment: input.treatment, recommendation: input.recommendation, status: input.status, followUpRequired: input.followUpRequired, followUpDate: input.followUpDate, followUpNotes: input.followUpNotes, updatedAt: now, closedAt: input.status === "CLOSED" ? now : undefined };
  const nextAlertId = current.counters.alert;
  const createAlertId = () => `ALT-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const alerts = [{ id: createAlertId(), recipientId: existing.farmerId, type: "CASE" as const, title: input.status === "CLOSED" ? "Veterinary case closed" : "Veterinary case updated", message: `${existing.id} has been updated by the veterinarian. ${input.recommendation || "Open PashuCare to review the case update."}`, relatedId: existing.id, createdAt: now }];
  if (updated.veterinarianId !== existing.veterinarianId) {
    const assignedVet = current.users.find(u => u.id === updated.veterinarianId && u.role === "VETERINARIAN");
    if (assignedVet) alerts.push({ id: createAlertId(), recipientId: assignedVet.id, type: "CASE" as const, title: "Veterinary case assigned to you", message: `${existing.id} has been assigned to your veterinary workspace.`, relatedId: existing.id, createdAt: now });
  }
  const newRecord = input.assessment.trim() ? { id: `HR-${actor.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, animalId: existing.animalId, date: now.slice(0, 10), type: input.status === "CLOSED" ? "Veterinary case closure" : "Veterinary assessment", notes: input.assessment, recordedBy: actor.name } : null;
  const newVaccination = input.addVaccination && input.vaccineName.trim() ? { id: `VAC-${actor.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, animalId: existing.animalId, vaccineName: input.vaccineName.trim(), administeredOn: now.slice(0, 10), dueOn: input.vaccineDue || now.slice(0, 10), administeredBy: actor.name, notes: `Updated from ${existing.id}`, status: "COMPLETED" as const } : null;
  let next: AppData = {
    ...current,
    cases: current.cases.map(c => c.id === existing.id ? updated : c),
    reports: current.reports.map(r => r.id === existing.reportId ? { ...r, status: input.status === "CLOSED" ? "ARCHIVED" : "REVIEWED" } : r),
    alerts: [...alerts, ...current.alerts],
    healthRecords: newRecord ? [newRecord, ...current.healthRecords] : current.healthRecords,
    vaccinations: newVaccination ? [newVaccination, ...current.vaccinations] : current.vaccinations,
    counters: { ...current.counters, alert: nextAlertId + alerts.length, vaccine: current.counters.vaccine + (newVaccination ? 1 : 0) },
  };
  return audit(next, actor, "CASE_UPDATED", "VeterinaryCase", existing.id, `Saved assessment and changed case status to ${input.status}.`);
}
