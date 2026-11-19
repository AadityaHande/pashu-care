import type { HealthReport, RiskAssessment, Severity, SurveillanceSettings } from "./types";

export const DEFAULT_SURVEILLANCE_SETTINGS: SurveillanceSettings = {
  priorityScore: 55,
  clusterWindowDays: 14,
  minimumClusterReports: 3,
  matchingSymptomMinimum: 1,
  followUpReminderDays: 2,
  vaccinationReminderDays: 14,
  escalationAfterHours: 24,
  escalationPriorityOnly: true,
};
const severityPoints: Record<Severity, number> = { LOW: 5, MEDIUM: 20, HIGH: 50, CRITICAL: 65 };

/** Transparent demonstration triage rules. These are not clinically validated. */
export function assessPreliminaryRisk(input: {
  severity: Severity; symptoms: string[]; mortality: boolean; mortalityCount?: number;
  location: string; healthHistoryCount?: number;
}, reportId: string, now = new Date(), settings: SurveillanceSettings = DEFAULT_SURVEILLANCE_SETTINGS): RiskAssessment {
  let score = severityPoints[input.severity];
  const reasons = [`Reported severity: ${input.severity.toLowerCase()}`];
  if (input.mortality) { score += 35; reasons.push(`Mortality reported${input.mortalityCount ? ` (${input.mortalityCount})` : ""}`); }
  if (input.symptoms.length >= 3) { score += 6; reasons.push("Multiple symptoms selected"); }
  if ((input.healthHistoryCount ?? 0) > 1) { score += 5; reasons.push("Previous animal health records are available for veterinary review"); }
  if (input.symptoms.some((s) => ["High temperature", "Difficulty breathing", "Loss of appetite"].includes(s))) { score += 7; reasons.push("A selected symptom is configured for timely veterinary review"); }
  score = Math.min(score, 100);
  const riskLevel = score >= 80 ? "CRITICAL" : score >= 55 ? "HIGH" : score >= 25 ? "MODERATE" : "LOW";
  const priority = score >= settings.priorityScore || input.mortality ? "PRIORITY" : "NORMAL";
  reasons.push(priority === "PRIORITY" ? "Routed to the priority veterinary queue by the configured demonstration rules" : "Routed to the normal veterinary queue by the configured demonstration rules");
  return { id: `RISK-${reportId}`, reportId, riskLevel, priority, score, reasons, evaluatedAt: now.toISOString(), isIllustrative: true };
}

const normaliseLocation = (value: string) => value.trim().toLowerCase().replace(/[,\s]+/g, " ");
const daysBetween = (a: string, b: Date) => (b.getTime() - new Date(a).getTime()) / 86_400_000;
const haversineKm = (aLat: number, aLng: number, bLat: number, bLng: number) => {
  const rad = (n: number) => n * Math.PI / 180;
  const dLat = rad(bLat - aLat), dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};
export function detectPossibleCluster(
  candidate: Pick<HealthReport, "id" | "location" | "symptoms" | "submittedAt"> & { latitude?: number; longitude?: number },
  existing: HealthReport[], now = new Date(), settings: SurveillanceSettings = DEFAULT_SURVEILLANCE_SETTINGS
): { matchedReportIds: string[]; matchedSymptoms: string[]; possible: boolean; method: "COORDINATE" | "AREA_LABEL" | "NONE" } {
  const area = normaliseLocation(candidate.location);
  if (!area || !candidate.symptoms.length) return { matchedReportIds: [], matchedSymptoms: [], possible: false, method: "NONE" };
  let method: "COORDINATE" | "AREA_LABEL" | "NONE" = "AREA_LABEL";
  const matches = existing.filter((report) => {
    const elapsedDays = daysBetween(report.submittedAt, now);
    const recent = elapsedDays >= 0 && elapsedDays <= settings.clusterWindowDays;
    const coordinateMatch = candidate.latitude != null && candidate.longitude != null && report.latitude != null && report.longitude != null && haversineKm(candidate.latitude, candidate.longitude, report.latitude, report.longitude) <= 5;
    const labelMatch = normaliseLocation(report.location) === area;
    const sharedSymptom = report.symptoms.some((symptom) => candidate.symptoms.includes(symptom));
    const matched = recent && (coordinateMatch || labelMatch) && sharedSymptom;
    if (matched && coordinateMatch) method = "COORDINATE";
    return matched;
  });
  const symptomCounts = candidate.symptoms.filter((symptom) => matches.some((report) => report.symptoms.includes(symptom)));
  const possible = matches.length + 1 >= settings.minimumClusterReports && symptomCounts.length >= settings.matchingSymptomMinimum;
  return { matchedReportIds: matches.map((r) => r.id), matchedSymptoms: symptomCounts, possible, method };
}
