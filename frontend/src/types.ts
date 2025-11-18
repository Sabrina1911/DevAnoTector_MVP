// =============================
// Types
// =============================
export type Role = "clinician" | "engineer";
export type Affect = "both" | "clinician" | "engineer";

export type Baseline = {
  coilOffsetDeg: number;
  chargeRateC: number;
  tempC: number;
  load_mA: number;
};

export type EngineerPatient = {
  id: string;
  displayName: string;
  deviceModel: string;
  sex: "male" | "female";
  age: number;
  baseline: Baseline;
  history?: string[];
  factors?: { misalign?: number; rate?: number; temp?: number; load?: number };
};

export type ClinicianPatient = {
  id: string;
  name: string;
  sex: string;
  dob: string;
  address: string;
  deviceModel: string;
  history?: string[];
  baseline: Baseline;
  factors?: { misalign?: number; rate?: number; temp?: number; load?: number };
};

export type Result = {
  status: "GREEN" | "AMBER" | "RED";
  score: number; // 0..1
  telemetry: { efficiency: number };
  rationale: string[];
};

export type SweepPoint = { deg: number; score: number };

export type RunLog = {
  ts: string;
  role: Role;
  profileId: string;
  compareId?: string;
  inputs: { coilOffsetDeg: number; chargeRateC: number; tempC: number; load_mA: number };
  outputs: { score: number; status: "GREEN" | "AMBER" | "RED" };
};