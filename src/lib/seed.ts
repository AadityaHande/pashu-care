import type { AppData, HealthReport, RiskAssessment } from "./types";

const ago = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
};
const dateOnlyAgo = (days: number) => ago(days).slice(0, 10);

function risk(id: string, reportId: string, level: RiskAssessment["riskLevel"], priority: RiskAssessment["priority"], score: number, reasons: string[]): RiskAssessment {
  return { id, reportId, riskLevel: level, priority, score, reasons, evaluatedAt: ago(2), isIllustrative: true };
}

export function createSeedData(): AppData {
  const users = [
    { id: "farmer-01", name: "Ramesh Patil", email: "farmer@pashucare.demo", role: "FARMER" as const },
    { id: "farmer-02", name: "Sita Jadhav", email: "sita@pashucare.demo", role: "FARMER" as const },
    { id: "vet-01", name: "Dr. Ananya Deshmukh", email: "vet@pashucare.demo", role: "VETERINARIAN" as const }
  ];

  const farms = [
    { id: "farm-01", farmerId: "farmer-01", name: "Green Valley Farm", village: "Pashan", district: "Pune", areaAcres: 4.5 },
    { id: "farm-02", farmerId: "farmer-02", name: "Jadhav Dairy Farm", village: "Pashan", district: "Pune", areaAcres: 3.2 },
    { id: "farm-03", farmerId: "farmer-02", name: "Sahyadri Livestock", village: "Sus", district: "Pune", areaAcres: 5.1 }
  ];

  const animals = [
    { id: "animal-01", farmId: "farm-01", farmerId: "farmer-01", tagId: "MH-PUN-001", name: "Gauri", species: "Cattle" as const, breed: "Gir", sex: "Female" as const, ageYears: 4, healthStatus: "Under observation" as const, notes: "Regular health monitoring.", createdAt: ago(180) },
    { id: "animal-02", farmId: "farm-01", farmerId: "farmer-01", tagId: "MH-PUN-002", name: "Nandi", species: "Cattle" as const, breed: "Sahiwal", sex: "Male" as const, ageYears: 3, healthStatus: "Healthy" as const, notes: "Active and healthy.", createdAt: ago(150) },
    { id: "animal-03", farmId: "farm-01", farmerId: "farmer-01", tagId: "MH-PUN-003", name: "Laxmi", species: "Buffalo" as const, breed: "Murrah", sex: "Female" as const, ageYears: 5, healthStatus: "Healthy" as const, notes: "Good milk yield.", createdAt: ago(300) },
    { id: "animal-04", farmId: "farm-01", farmerId: "farmer-01", tagId: "MH-PUN-004", name: "Champa", species: "Goat" as const, breed: "Osmanabadi", sex: "Female" as const, ageYears: 2, healthStatus: "Treatment ongoing" as const, notes: "Follow-up due next week.", createdAt: ago(90) },
    { id: "animal-05", farmId: "farm-02", farmerId: "farmer-02", tagId: "MH-PUN-005", name: "Moti", species: "Cattle" as const, breed: "Gir", sex: "Female" as const, ageYears: 3, healthStatus: "Under observation" as const, notes: "Recent symptoms reported.", createdAt: ago(200) },
    { id: "animal-06", farmId: "farm-03", farmerId: "farmer-02", tagId: "MH-PUN-006", name: "Badal", species: "Sheep" as const, breed: "Deccani", sex: "Male" as const, ageYears: 2, healthStatus: "Healthy" as const, notes: "Routine check completed.", createdAt: ago(130) }
  ];

  const reports: HealthReport[] = [
    {
      id: "RPT-00038", animalId: "animal-05", farmerId: "farmer-02", farmId: "farm-02", symptoms: ["High temperature", "Loss of appetite"], onsetDate: dateOnlyAgo(4), severity: "HIGH", mortality: false, location: "Pashan, Pune", notes: "Reduced feed intake since yesterday.", status: "VALIDATED", submittedAt: ago(3),
      assessment: risk("RISK-38", "RPT-00038", "HIGH", "PRIORITY", 64, ["Reported severity: high", "Multiple symptoms require timely review", "Priority queue routing"]), caseId: "CASE-00021", clusterId: "CLUSTER-01"
    },
    {
      id: "RPT-00037", animalId: "animal-01", farmerId: "farmer-01", farmId: "farm-01", symptoms: ["High temperature", "Nasal discharge"], onsetDate: dateOnlyAgo(3), severity: "HIGH", mortality: false, location: "Pashan, Pune", notes: "Farmer reports lethargy.", status: "VALIDATED", submittedAt: ago(2),
      assessment: risk("RISK-37", "RPT-00037", "HIGH", "PRIORITY", 61, ["Reported severity: high", "Selected symptoms require timely veterinary review"]), caseId: "CASE-00020", clusterId: "CLUSTER-01"
    },
    {
      id: "RPT-00036", animalId: "animal-02", farmerId: "farmer-01", farmId: "farm-01", symptoms: ["High temperature", "Loss of appetite"], onsetDate: dateOnlyAgo(5), severity: "MEDIUM", mortality: false, location: "Pashan, Pune", notes: "Observation reported.", status: "REVIEWED", submittedAt: ago(5),
      assessment: risk("RISK-36", "RPT-00036", "MODERATE", "NORMAL", 42, ["Reported severity: medium", "Multiple symptoms selected"]), caseId: "CASE-00019", clusterId: "CLUSTER-01"
    },
    {
      id: "RPT-00035", animalId: "animal-04", farmerId: "farmer-01", farmId: "farm-01", symptoms: ["Skin irritation"], onsetDate: dateOnlyAgo(2), severity: "MEDIUM", mortality: false, location: "Pashan, Pune", notes: "Small affected area noted.", status: "VALIDATED", submittedAt: ago(1),
      assessment: risk("RISK-35", "RPT-00035", "MODERATE", "NORMAL", 26, ["Reported severity: medium", "Normal veterinary queue routing"]), caseId: "CASE-00018"
    },
    {
      id: "RPT-00034", animalId: "animal-03", farmerId: "farmer-01", farmId: "farm-01", symptoms: ["Limping"], onsetDate: dateOnlyAgo(8), severity: "LOW", mortality: false, location: "Baner, Pune", notes: "Mild limping after grazing.", status: "REVIEWED", submittedAt: ago(7),
      assessment: risk("RISK-34", "RPT-00034", "LOW", "NORMAL", 12, ["Reported severity: low", "Normal veterinary queue routing"]), caseId: "CASE-00017"
    }
  ];

  const clusters = [{ id: "CLUSTER-01", area: "Pashan, Pune", reportIds: ["RPT-00036", "RPT-00037", "RPT-00038"], symptoms: ["High temperature", "Loss of appetite"], windowDays: 14, detectedAt: ago(1), status: "NEEDS_REVIEW" as const }];

  const cases = [
    { id: "CASE-00021", reportId: "RPT-00038", animalId: "animal-05", farmerId: "farmer-02", veterinarianId: "vet-01", priority: "PRIORITY" as const, status: "OPEN" as const, assessment: "", treatment: "", recommendation: "", followUpRequired: false, followUpNotes: "", createdAt: ago(3), updatedAt: ago(3) },
    { id: "CASE-00020", reportId: "RPT-00037", animalId: "animal-01", farmerId: "farmer-01", veterinarianId: "vet-01", priority: "PRIORITY" as const, status: "IN_PROGRESS" as const, assessment: "Needs clinical examination and repeat observation.", treatment: "Supportive care as per examination.", recommendation: "Monitor temperature and feed intake.", followUpRequired: true, followUpDate: dateOnlyAgo(-2), followUpNotes: "Reassess clinical progress.", createdAt: ago(2), updatedAt: ago(1) },
    { id: "CASE-00019", reportId: "RPT-00036", animalId: "animal-02", farmerId: "farmer-01", veterinarianId: "vet-01", priority: "NORMAL" as const, status: "CLOSED" as const, assessment: "No urgent concern identified during review.", treatment: "No treatment recorded.", recommendation: "Continue routine observation.", followUpRequired: false, followUpNotes: "", createdAt: ago(5), updatedAt: ago(4), closedAt: ago(4) }
  ];

  const vaccinations = [
    { id: "VAC-0001", animalId: "animal-01", vaccineName: "FMD Booster", administeredOn: dateOnlyAgo(150), dueOn: dateOnlyAgo(-7), administeredBy: "Dr. Ananya Deshmukh", notes: "Routine booster schedule.", status: "DUE" as const },
    { id: "VAC-0002", animalId: "animal-02", vaccineName: "HS Vaccine", administeredOn: dateOnlyAgo(210), dueOn: dateOnlyAgo(20), administeredBy: "Dr. Ananya Deshmukh", notes: "Next routine review.", status: "COMPLETED" as const },
    { id: "VAC-0003", animalId: "animal-03", vaccineName: "FMD Vaccine", administeredOn: dateOnlyAgo(340), dueOn: dateOnlyAgo(4), administeredBy: "Dr. Ananya Deshmukh", notes: "Reminder pending.", status: "OVERDUE" as const },
    { id: "VAC-0004", animalId: "animal-04", vaccineName: "PPR Vaccine", administeredOn: dateOnlyAgo(70), dueOn: dateOnlyAgo(-18), administeredBy: "Dr. Ananya Deshmukh", notes: "Upcoming vaccination.", status: "DUE" as const }
  ];

  const healthRecords = [
    { id: "HR-01", animalId: "animal-01", date: dateOnlyAgo(2), type: "Veterinary observation", notes: "Temperature monitoring advised.", recordedBy: "Dr. Ananya Deshmukh" },
    { id: "HR-02", animalId: "animal-01", date: dateOnlyAgo(30), type: "Routine check", notes: "Routine health check recorded.", recordedBy: "Dr. Ananya Deshmukh" },
    { id: "HR-03", animalId: "animal-03", date: dateOnlyAgo(15), type: "Routine check", notes: "No abnormal observations.", recordedBy: "Dr. Ananya Deshmukh" },
    { id: "HR-04", animalId: "animal-04", date: dateOnlyAgo(1), type: "Follow-up", notes: "Continue observation until follow-up.", recordedBy: "Dr. Ananya Deshmukh" }
  ];

  const alerts = [
    { id: "ALT-01", recipientId: "vet-01", type: "CLUSTER" as const, title: "Possible cluster needs review", message: "Three related reports are grouped in Pashan, Pune. Review the supporting reports.", relatedId: "CLUSTER-01", createdAt: ago(1) },
    { id: "ALT-02", recipientId: "vet-01", type: "PRIORITY" as const, title: "Priority case awaiting review", message: "CASE-00021 has been routed to the priority veterinary queue.", relatedId: "CASE-00021", createdAt: ago(3) },
    { id: "ALT-03", recipientId: "farmer-01", type: "CASE" as const, title: "Veterinary case updated", message: "CASE-00020 is in progress. A follow-up has been scheduled.", relatedId: "CASE-00020", createdAt: ago(1) },
    { id: "ALT-04", recipientId: "farmer-01", type: "VACCINATION" as const, title: "Vaccination due soon", message: "FMD Booster for Gauri is due soon.", relatedId: "VAC-0001", createdAt: ago(1) }
  ];

  const cropPlans = [
    { id: "CROP-01", farmId: "farm-01", fieldName: "North Field", previousCrop: "Soybean", plannedCrop: "Wheat", season: "Rabi", suggestion: "A cereal crop can follow a legume in this illustrative rotation plan. Confirm local agronomy guidance before use." }
  ];

  return {
    users, farms, animals, reports, clusters, cases, vaccinations, healthRecords, alerts, cropPlans,
    auditLogs: [
      { id: "AUD-0001", actorId: "vet-01", actorName: "Dr. Ananya Deshmukh", actorRole: "VETERINARIAN", action: "CASE_UPDATED", entityType: "VeterinaryCase", entityId: "CASE-00020", summary: "Recorded assessment and scheduled follow-up.", createdAt: ago(1) },
      { id: "AUD-0002", actorId: "farmer-01", actorName: "Ramesh Patil", actorRole: "FARMER", action: "REPORT_SUBMITTED", entityType: "HealthReport", entityId: "RPT-00037", summary: "Submitted a livestock health report.", createdAt: ago(2) },
      { id: "AUD-0003", actorId: "vet-01", actorName: "Dr. Ananya Deshmukh", actorRole: "VETERINARIAN", action: "CLUSTER_FLAGGED", entityType: "PossibleCluster", entityId: "CLUSTER-01", summary: "Possible cluster flagged for veterinary review.", createdAt: ago(1) }
    ],
    pendingReports: [],
    surveillanceSettings: {
      priorityScore: 55, clusterWindowDays: 14, minimumClusterReports: 3,
      matchingSymptomMinimum: 1, followUpReminderDays: 2,
      vaccinationReminderDays: 14, escalationAfterHours: 24, escalationPriorityOnly: true
    },
    escalationRules: [
      { id: "ESC-01", name: "Priority case not reviewed", enabled: true, condition: "PRIORITY_UNREVIEWED", afterHours: 4, notifyRole: "VETERINARIAN", description: "Raise an escalation when a priority case remains open without assessment." },
      { id: "ESC-02", name: "Overdue follow-up", enabled: true, condition: "FOLLOW_UP_OVERDUE", afterHours: 0, notifyRole: "VETERINARIAN", description: "Flag follow-ups whose scheduled date has passed." },
      { id: "ESC-03", name: "Overdue vaccination", enabled: true, condition: "VACCINATION_OVERDUE", afterHours: 0, notifyRole: "FARMER", description: "Notify the farmer when a recorded vaccination due date has passed." },
      { id: "ESC-04", name: "Unreviewed possible cluster", enabled: true, condition: "CLUSTER_UNREVIEWED", afterHours: 12, notifyRole: "VETERINARIAN", description: "Remind the veterinary team about an unreviewed possible cluster." }
    ],
    counters: { report: 39, case: 22, alert: 5, animal: 7, vaccine: 5 }
  };
}
