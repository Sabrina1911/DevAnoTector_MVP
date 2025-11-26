import type { ClinicianPatient, EngineerPatient, Role, RunLog } from "./types";

export const stamp = () =>
  new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

// cache to avoid refetch flicker
export const patientsCache: Record<Role, (EngineerPatient | ClinicianPatient)[] | undefined> = {
  clinician: undefined,
  engineer: undefined,
};

export const API = "http://localhost:5050";

export function toast(msg: string) {
  const el = document.createElement("div");
  el.textContent = msg;
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
  el.style.cssText = [
    "position:fixed",
    "bottom:24px",
    "right:24px",
    "background:#111827",
    "color:white",
    "padding:8px 12px",
    "border-radius:8px",
    "font-size:12px",
    "z-index:9999",
    "opacity:0.95",
    "box-shadow:0 4px 14px rgba(0,0,0,0.25)",
    "pointer-events:none",
  ].join(";");
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1800);
}



export const LOG_KEY = "wpt_runs_v1";
export const loadLogs = (): RunLog[] => {
  try {
    return JSON.parse(localStorage.getItem(LOG_KEY) || "[]");
  } catch {
    return [];
  }
};
export const saveLogs = (rows: RunLog[]) => localStorage.setItem(LOG_KEY, JSON.stringify(rows));
export const appendLog = (row: RunLog) => {
  const rows = loadLogs();
  rows.push(row);
  saveLogs(rows);
};
export const exportLogsCSV = () => {
  const rows = loadLogs();
  const header = [
    "ts",
    "role",
    "profileId",
    "compareId",
    "coilOffsetDeg",
    "chargeRateC",
    "tempC",
    "load_mA",
    "score",
    "status",
  ];
  const lines = [header.join(",")].concat(
    rows.map((r) =>
      [
        r.ts,
        r.role,
        r.profileId,
        r.compareId ?? "",
        r.inputs.coilOffsetDeg,
        r.inputs.chargeRateC,
        r.inputs.tempC,
        r.inputs.load_mA,
        r.outputs.score,
        r.outputs.status,
      ].join(",")
    )
  );
  const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `wpt_runs_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
};
export const clearLogs = () => localStorage.removeItem(LOG_KEY);