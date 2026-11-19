export type Role = "FARMER" | "VETERINARIAN";
export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type Priority = "NORMAL" | "PRIORITY";
export type CaseStatus = "OPEN" | "IN_PROGRESS" | "CLOSED";
export type ReportStatus = "SUBMITTED" | "VALIDATED" | "NEEDS_CORRECTION" | "REVIEWED" | "ARCHIVED" | "QUEUED_OFFLINE";
export type RiskLevel = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
export type Locale = "en" | "mr" | "hi";

export interface DemoUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone?: string;
}
export interface Farm {
  id: string;
  farmerId: string;
  name: string;
  village: string;
  district: string;
  areaAcres: number;
  latitude?: number;
  longitude?: number;
}
export interface Animal {
  id: string;
  farmId: string;
  farmerId: string;
  tagId: string;
  name: string;
  species: "Cattle" | "Buffalo" | "Goat" | "Sheep";
  breed: string;
  sex: "Female" | "Male";
  ageYears: number;
  healthStatus: "Healthy" | "Under observation" | "Treatment ongoing";
  notes: string;
  createdAt: string;
  latitude?: number;
  longitude?: number;
  photoDataUrl?: string;
}
export interface RiskAssessment {
  id: string;
  reportId: string;
  riskLevel: RiskLevel;
  priority: Priority;
  score: number;
  reasons: string[];
  evaluatedAt: string;
  isIllustrative: boolean;
}
export interface HealthReport {
  id: string;
  animalId: string;
  farmerId: string;
  farmId: string;
  symptoms: string[];
  onsetDate: string;
  severity: Severity;
  mortality: boolean;
  mortalityCount?: number;
  location: string;
  notes: string;
  status: ReportStatus;
  submittedAt: string;
  assessment: RiskAssessment;
  caseId: string;
  clusterId?: string;
  latitude?: number;
  longitude?: number;
  photoDataUrl?: string;
  voiceTranscript?: string;
}
export interface PossibleCluster {
  id: string;
  area: string;
  reportIds: string[];
  symptoms: string[];
  windowDays: number;
  detectedAt: string;
  status: "NEEDS_REVIEW" | "REVIEWED";
  centroidLatitude?: number;
  centroidLongitude?: number;
}
export interface VeterinaryCase {
  id: string;
  reportId: string;
  animalId: string;
  farmerId: string;
  veterinarianId: string;
  priority: Priority;
  status: CaseStatus;
  assessment: string;
  treatment: string;
  recommendation: string;
  followUpRequired: boolean;
  followUpDate?: string;
  followUpNotes: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
}
export interface Vaccination {
  id: string;
  animalId: string;
  vaccineName: string;
  administeredOn?: string;
  dueOn: string;
  administeredBy?: string;
  notes: string;
  status: "COMPLETED" | "DUE" | "OVERDUE";
}
export interface HealthRecord {
  id: string;
  animalId: string;
  date: string;
  type: string;
  notes: string;
  recordedBy: string;
}
export interface AlertItem {
  id: string;
  recipientId: string;
  type: "CASE" | "PRIORITY" | "CLUSTER" | "VACCINATION" | "ADVISORY" | "FOLLOW_UP" | "ESCALATION";
  title: string;
  message: string;
  relatedId?: string;
  createdAt: string;
  readAt?: string;
}
export interface CropRotationPlan {
  id: string;
  farmId: string;
  fieldName: string;
  previousCrop: string;
  plannedCrop: string;
  season: string;
  suggestion: string;
}
export interface PendingHealthReport {
  id: string;
  farmerId: string;
  queuedAt: string;
  payload: {
    animalId: string;
    symptoms: string[];
    onsetDate: string;
    severity: Severity;
    mortality: boolean;
    mortalityCount?: number;
    location: string;
    notes: string;
    latitude?: number;
    longitude?: number;
    photoDataUrl?: string;
    voiceTranscript?: string;
  };
}
export interface AuditLog {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: Role;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  createdAt: string;
}
export interface SurveillanceSettings {
  priorityScore: number;
  clusterWindowDays: number;
  minimumClusterReports: number;
  matchingSymptomMinimum: number;
  followUpReminderDays: number;
  vaccinationReminderDays: number;
  escalationAfterHours: number;
  escalationPriorityOnly: boolean;
}
export interface EscalationRule {
  id: string;
  name: string;
  enabled: boolean;
  condition: "PRIORITY_UNREVIEWED" | "FOLLOW_UP_OVERDUE" | "VACCINATION_OVERDUE" | "CLUSTER_UNREVIEWED";
  afterHours: number;
  notifyRole: Role;
  description: string;
}
export interface AppData {
  users: DemoUser[];
  farms: Farm[];
  animals: Animal[];
  reports: HealthReport[];
  clusters: PossibleCluster[];
  cases: VeterinaryCase[];
  vaccinations: Vaccination[];
  healthRecords: HealthRecord[];
  alerts: AlertItem[];
  cropPlans: CropRotationPlan[];
  auditLogs: AuditLog[];
  pendingReports: PendingHealthReport[];
  surveillanceSettings: SurveillanceSettings;
  escalationRules: EscalationRule[];
  counters: { report: number; case: number; alert: number; animal: number; vaccine: number };
}
