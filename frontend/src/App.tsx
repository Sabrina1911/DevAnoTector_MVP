// frontend/src/App.tsx
import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import type { CSSProperties, ReactNode } from "react";
import jsPDF from "jspdf";

// 👉 reusable chart with multi-series legend toggles
import RiskChart from "./components/RiskChart";

// =============================
// Types
// =============================
type Role = "clinician" | "engineer";
type Affect = "both" | "clinician" | "engineer";

type Baseline = {
  coilOffsetDeg: number;
  chargeRateC: number;
  tempC: number;
  load_mA: number;
};

type EngineerPatient = {
  id: string;
  displayName: string;
  deviceModel: string;
  sex: "male" | "female";
  age: number;
  baseline: Baseline;
  history?: string[];
  factors?: { misalign?: number; rate?: number; temp?: number; load?: number };
};

type ClinicianPatient = {
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

type Result = {
  status: "GREEN" | "AMBER" | "RED";
  score: number; // 0..1
  telemetry: { efficiency: number };
  rationale: string[];
};

type SweepPoint = { deg: number; score: number };

const API = "http://localhost:5050";

// =============================
// Helpers
// =============================
const stamp = () =>
  new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

// cache to avoid refetch flicker
const patientsCache: Record<Role, (EngineerPatient | ClinicianPatient)[] | undefined> = {
  clinician: undefined,
  engineer: undefined,
};

function toast(msg: string) {
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

// =============================
// A) Per-Run Logging (Task 238)
// =============================
type RunLog = {
  ts: string;
  role: Role;
  profileId: string;
  compareId?: string;
  inputs: { coilOffsetDeg: number; chargeRateC: number; tempC: number; load_mA: number };
  outputs: { score: number; status: "GREEN" | "AMBER" | "RED" };
};
const LOG_KEY = "wpt_runs_v1";
const loadLogs = (): RunLog[] => {
  try {
    return JSON.parse(localStorage.getItem(LOG_KEY) || "[]");
  } catch {
    return [];
  }
};
const saveLogs = (rows: RunLog[]) => localStorage.setItem(LOG_KEY, JSON.stringify(rows));
const appendLog = (row: RunLog) => {
  const rows = loadLogs();
  rows.push(row);
  saveLogs(rows);
};
const exportLogsCSV = () => {
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
const clearLogs = () => localStorage.removeItem(LOG_KEY);

// =============================
// App — Spacious Dual-Panel
// =============================
export default function App() {
  // Theme
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const pageBg = theme === "dark" ? "#0b0f17" : "#f8fafc";
  const textFg = theme === "dark" ? "#e5e7eb" : "#0b1220";
  const subFg = theme === "dark" ? "#94a3b8" : "#475569";
  const cardBg = theme === "dark" ? "#0f172a" : "#ffffff";
  const cardFg = theme === "dark" ? "#f8fafc" : "#0b1220";
  const gridCol = theme === "dark" ? "#374151" : "#e5e7eb";
  const bandFill = {
    green: theme === "dark" ? "rgba(34,197,94,0.08)" : "rgba(34,197,94,0.10)",
    amber: theme === "dark" ? "rgba(245,158,11,0.08)" : "rgba(245,158,11,0.10)",
    red: theme === "dark" ? "rgba(239,68,68,0.08)" : "rgba(239,68,68,0.10)",
  };
  const isDark = theme === "dark";

  // memoize theme object so RolePanels don't remount
  const themeObj = useMemo(
    () => ({ pageBg, textFg, subFg, cardBg, cardFg, gridCol, bandFill }),
    [pageBg, textFg, subFg, cardBg, cardFg, gridCol, bandFill]
  );

  // Layout
  const [isWide, setIsWide] = useState<boolean>(
    typeof window !== "undefined" ? window.innerWidth >= 1024 : true
  );
  useEffect(() => {
    const onResize = () => setIsWide(window.innerWidth >= 1024);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Shared sliders
  const [coilOffsetDeg, setCoilOffsetDeg] = useState(5);
  const [chargeRateC, setChargeRateC] = useState(1.0);
  const [tempC, setTempC] = useState(37.0);
  const [load_mA, setLoad_mA] = useState(200);

  // Auto-run + Affect
  const [autoRun, setAutoRun] = useState(true);
  const [affect, setAffect] = useState<Affect>("both");

  // New: Remember selection gate (default OFF)
  const [rememberSelection, setRememberSelection] = useState(false);

  // Disable sliders until at least one selection is made
  const [hasAnySelection, setHasAnySelection] = useState(false);
  const handleSelectionChange = (has: boolean) => {
    if (has) setHasAnySelection(true); // one-way gate
  };

  function applyPreset(kind: "nominal" | "fast" | "highTemp") {
    if (kind === "nominal") {
      setCoilOffsetDeg(5);
      setChargeRateC(1.0);
      setTempC(37.0);
      setLoad_mA(200);
    } else if (kind === "fast") {
      setCoilOffsetDeg(8);
      setChargeRateC(1.6);
      setTempC(37.5);
      setLoad_mA(240);
    } else {
      setCoilOffsetDeg(8);
      setChargeRateC(1.2);
      setTempC(39.0);
      setLoad_mA(220);
    }
  }

  const btn = (filled = false): CSSProperties => ({
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid",
    borderColor: isDark ? "#334155" : "#cbd5e1",
    background: filled ? (isDark ? "#0b1220" : "#ffffff") : isDark ? "transparent" : "#ffffff",
    color: isDark ? cardFg : "#0b1220",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 13,
  });

  const pill: CSSProperties = {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid " + (isDark ? "#334155" : "#cbd5e1"),
    background: "transparent",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 12,
  };

  const sliderDisabled = !hasAnySelection;

  return (
    <main
      style={{
        width: "100vw",
        minHeight: "100vh",
        margin: 0,
        padding: "24px 32px",
        boxSizing: "border-box",
        background: pageBg,
        color: textFg,
        overflowX: "hidden",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <header style={{ textAlign: "center", marginBottom: 28 }}>
        <h1 style={{ margin: "0 0 8px 0", fontWeight: 800, fontSize: "1.9rem" }}>
          <span style={{ marginRight: 8 }}>⚙️</span>What-If Simulator
        </h1>
        <div style={{ color: subFg, fontSize: 13 }}>
          Dual-panel view — PHI (Clinician) | De-identified (Engineer)
        </div>
      </header>

      {/* Row 1: Theme + Auto-run + Affect + Remember */}
      <section
        style={{
          display: "grid",
          gridTemplateRows: "auto auto",
          rowGap: 6,
          justifyItems: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <button
            aria-label="Toggle theme"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            style={btn(true)}
          >
            Theme: {isDark ? "Dark" : "Light"}
          </button>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              color: subFg,
              fontSize: 13,
            }}
          >
            <input
              type="checkbox"
              checked={autoRun}
              onChange={(e) => setAutoRun(e.target.checked)}
              aria-label="Auto-run simulations"
            />
            Auto-run
          </label>

          {/* NEW: Remember selection toggle */}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              color: subFg,
              fontSize: 13,
            }}
          >
            <input
              type="checkbox"
              checked={rememberSelection}
              onChange={(e) => setRememberSelection(e.target.checked)}
              aria-label="Remember last selection"
            />
            Remember selection
          </label>

          <div
            role="group"
            aria-label="Which panel slider changes affect"
            style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}
          >
            <span style={{ color: subFg, fontSize: 12 }}>Affect:</span>
            {(["both", "clinician", "engineer"] as Affect[]).map((a) => (
              <button
                key={a}
                onClick={() => setAffect(a)}
                style={{
                  ...pill,
                  background: affect === a ? (isDark ? "#111827" : "#e5e7eb") : "transparent",
                  color: affect === a ? (isDark ? "#f9fafb" : "#0b1220") : isDark ? cardFg : "#0b1220",
                }}
                aria-pressed={affect === a}
              >
                {a === "both" ? "Both" : a[0].toUpperCase() + a.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Presets */}
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            justifyContent: "center",
            marginBottom: 10,
          }}
        >
          <button style={btn(true)} onClick={() => applyPreset("nominal")} aria-label="Apply nominal preset">
            Preset: Nominal
          </button>
          <button style={btn(true)} onClick={() => applyPreset("fast")} aria-label="Apply fast charge preset">
            Preset: Fast
          </button>
          <button style={btn(true)} onClick={() => applyPreset("highTemp")} aria-label="Apply high temperature preset">
            Preset: High Temp
          </button>
        </div>
      </section>

      {/* Sliders group */}
      <section
        style={{
          position: "relative",
          maxWidth: "1100px",
          margin: "0 auto 20px auto",
          display: "grid",
          gap: 18,
          gridTemplateColumns: isWide ? "repeat(4, 1fr)" : "repeat(2, 1fr)",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "-22px",
            left: 0,
            fontSize: 13,
            color: subFg,
            fontWeight: 600,
          }}
        >
          Simulation Parameters
        </div>

        <Field label={`Coil Misalignment: ${coilOffsetDeg}°`}>
          <input
            type="range"
            min={0}
            max={30}
            value={coilOffsetDeg}
            onChange={(e) => setCoilOffsetDeg(Number(e.target.value))}
            aria-label="Coil misalignment"
            disabled={sliderDisabled}
          />
        </Field>
        <Field label={`Charge Rate: ${chargeRateC} C`}>
          <input
            type="range"
            min={0.2}
            max={2}
            step={0.1}
            value={chargeRateC}
            onChange={(e) => setChargeRateC(Number(e.target.value))}
            aria-label="Charge rate"
            disabled={sliderDisabled}
          />
        </Field>
        <Field label={`Temperature: ${tempC} °C`}>
          <input
            type="range"
            min={15}
            max={60}
            value={tempC}
            onChange={(e) => setTempC(Number(e.target.value))}
            aria-label="Temperature"
            disabled={sliderDisabled}
          />
        </Field>
        <Field label={`Load: ${load_mA} mA`}>
          <input
            type="range"
            min={0}
            max={500}
            value={load_mA}
            onChange={(e) => setLoad_mA(Number(e.target.value))}
            aria-label="Load current"
            disabled={sliderDisabled}
          />
        </Field>

        {sliderDisabled && (
          <div
            style={{
              gridColumn: "1 / -1",
              textAlign: "center",
              color: subFg,
              fontSize: 12,
              marginTop: -8,
            }}
          >
            Select a profile in <b>Clinician</b> or <b>Engineer</b> to enable sliders.
          </div>
        )}
      </section>

      <div style={{ borderTop: "1px solid rgba(148,163,184,0.2)", margin: "8px 0 24px 0" }} />

      {/* Panels */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isWide ? "1fr 1fr" : "1fr",
          gap: 40,
          alignItems: "start",
          marginBottom: 24,
        }}
      >
        <RolePanel
          key="clinician"
          title="Clinician View (PHI)"
          role="clinician"
          affect={affect}
          theme={themeObj}
          sliders={{ coilOffsetDeg, chargeRateC, tempC, load_mA }}
          onAdoptBaseline={(b) => {
            setCoilOffsetDeg(b.coilOffsetDeg);
            setChargeRateC(b.chargeRateC);
            setTempC(b.tempC);
            setLoad_mA(b.load_mA);
          }}
          autoRun={autoRun}
          onSelectionChange={handleSelectionChange}
          highlightActive={affect === "both" || affect === "clinician"}
          isDark={isDark}
          remember={rememberSelection}   // <-- NEW
        />
        <RolePanel
          key="engineer"
          title="Engineer View (De-Identified)"
          role="engineer"
          affect={affect}
          theme={themeObj}
          sliders={{ coilOffsetDeg, chargeRateC, tempC, load_mA }}
          onAdoptBaseline={(b) => {
            setCoilOffsetDeg(b.coilOffsetDeg);
            setChargeRateC(b.chargeRateC);
            setTempC(b.tempC);
            setLoad_mA(b.load_mA);
          }}
          autoRun={autoRun}
          onSelectionChange={handleSelectionChange}
          highlightActive={affect === "both" || affect === "engineer"}
          isDark={isDark}
          remember={rememberSelection}   // <-- NEW
        />
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 12 }}>{label}</span>
      {children}
    </label>
  );
}

// =============================
// Role Panel (overlays + compare + exports + RiskChart)
// =============================
function RolePanel({
  title,
  role,
  affect,
  theme,
  sliders,
  onAdoptBaseline,
  autoRun,
  onSelectionChange,
  highlightActive,
  isDark,
  remember,             // <-- NEW
}: {
  title: string;
  role: Role;
  affect: Affect;
  theme: {
    pageBg: string;
    textFg: string;
    subFg: string;
    cardBg: string;
    cardFg: string;
    gridCol: string;
    bandFill: { green: string; amber: string; red: string };
  };
  sliders: { coilOffsetDeg: number; chargeRateC: number; tempC: number; load_mA: number };
  onAdoptBaseline: (b: Baseline) => void;
  autoRun: boolean;
  onSelectionChange: (hasSelection: boolean) => void;
  highlightActive: boolean;
  isDark: boolean;
  remember: boolean;     // <-- NEW
}) {
  const { coilOffsetDeg, chargeRateC, tempC, load_mA } = sliders;
  const { cardBg, cardFg, subFg, gridCol } = theme;

  // --- panel-scoped mount flag ---
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  function safeSet<T>(setter: (v: T) => void, v: T) {
    if (mountedRef.current) setter(v);
  }

  // Compare helpers
  const STOP = new Set([
    "the","a","an","and","or","to","of","in","on","under","over","at","for",
    "with","past","last","this","that","no","none","not","issues","issue",
    "stable","occasionally","occasional","spikes","above","below","up","down",
    "degree","degrees","deg","°","c","celsius"
  ]);
  function deviceFamily(model: string = ""): string {
    const m = model.trim().toUpperCase();
    return m.replace(/-?F\b/g, "");
  }
  function historyKeywords(history: string[] = []): Set<string> {
    const kw = new Set<string>();
    for (const line of history) {
      line.toLowerCase()
        .replace(/[\d\.]+/g, " ")
        .replace(/[^\w\s]/g, " ")
        .split(/\s+/)
        .forEach((w) => {
          if (!w || w.length < 4) return;
          if (STOP.has(w)) return;
          kw.add(w);
        });
    }
    return kw;
  }
  function jaccard(a: Set<string>, b: Set<string>): number {
    if (!a.size && !b.size) return 1;
    let inter = 0;
    for (const w of a) if (b.has(w)) inter++;
    const union = a.size + b.size - inter;
    return union ? inter / union : 0;
  }

  const [patients, setPatients] = useState<(EngineerPatient | ClinicianPatient)[]>([]);
  const [patientId, setPatientId] = useState<string>("");
  const [compareId, setCompareId] = useState<string>(""); // engineer only

  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);

  // Curves
  const [curveCoil, setCurveCoil] = useState<SweepPoint[]>([]);
  const [curveCharge, setCurveCharge] = useState<SweepPoint[]>([]);
  const [curveTemp, setCurveTemp] = useState<SweepPoint[]>([]);
  const [curveLoad, setCurveLoad] = useState<SweepPoint[]>([]);
  const [curveFinal, setCurveFinal] = useState<SweepPoint[]>([]);
  const [curveB, setCurveB] = useState<SweepPoint[]>([]); // engineer compare
  const [curveLoading, setCurveLoading] = useState(false);

  const panelTargeted = affect === "both" || affect === role;

  // Effective inputs for this panel (respect Affect routing)
  type Held = { coilOffsetDeg: number; chargeRateC: number; tempC: number; load_mA: number };
  const [heldInputs, setHeldInputs] = useState<Held>({ coilOffsetDeg, chargeRateC, tempC, load_mA });
  useEffect(() => {
    if (panelTargeted) setHeldInputs({ coilOffsetDeg, chargeRateC, tempC, load_mA });
  }, [panelTargeted, coilOffsetDeg, chargeRateC, tempC, load_mA]);

  const effCoil = panelTargeted ? coilOffsetDeg : heldInputs.coilOffsetDeg;
  const effCharge = panelTargeted ? chargeRateC : heldInputs.chargeRateC;
  const effTemp = panelTargeted ? tempC : heldInputs.tempC;
  const effLoad = panelTargeted ? load_mA : heldInputs.load_mA;

  // =============================
  // B) Persist last compared pair (Task 242) — gated by `remember`
  // =============================
  const COMPARE_KEY = `wpt_last_${role}_v1`;

  // restore on mount if remember==true
  useEffect(() => {
    if (!remember) return;
    try {
      const saved = JSON.parse(localStorage.getItem(COMPARE_KEY) || "{}");
      if (saved.patientId) setPatientId(String(saved.patientId));
      if (role === "engineer" && saved.compareId) setCompareId(String(saved.compareId));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remember]);

  // save changes if remember==true
  useEffect(() => {
    if (!remember) return;
    localStorage.setItem(COMPARE_KEY, JSON.stringify({ patientId, compareId }));
  }, [remember, patientId, compareId]);

  // if user turns remember OFF, clear stored selection
  useEffect(() => {
    if (remember) return;
    localStorage.removeItem(COMPARE_KEY);
  }, [remember]);

  // Fetch patients (cache-backed)
  useEffect(() => {
    let mounted = true;
    const hydrate = (list: any[]) => {
      if (!mounted) return;
      const arr = (list || []) as (EngineerPatient | ClinicianPatient)[];
      patientsCache[role] = arr;
      setPatients(arr);
    };
    if (patientsCache[role]) {
      hydrate(patientsCache[role]!);
      return () => {};
    }
    (async () => {
      try {
        const r = await fetch(`${API}/patients`, { headers: { "x-role": role } });
        if (!r.ok) {
          toast(`Failed to fetch patients (HTTP ${r.status})`);
          return;
        }
        const data = await r.json();
        hydrate(data);
      } catch (e) {
        console.error(e);
        toast("Network error while fetching patients");
      }
    })();
    return () => {
      mounted = false;
    };
  }, [role]);

  const selected = useMemo(
    () =>
      patients.find((p) => String(p.id) === String(patientId)) as
        | EngineerPatient
        | ClinicianPatient
        | undefined,
    [patients, patientId]
  );

  // Baseline (per selected patient)
  const baselineRef = useRef<Baseline | null>(null);
  useEffect(() => {
    if (selected?.baseline) {
      baselineRef.current = { ...selected.baseline };
      setCurveCoil([]);
      setCurveCharge([]);
      setCurveTemp([]);
      setCurveLoad([]);
      setCurveFinal([]);
      setCurveB([]);
      setResult(null);
    }
  }, [selected]);

  // Engineer list
  const engineerPatients: EngineerPatient[] = useMemo(
    () => patients.filter((p: any) => (p as EngineerPatient).displayName) as EngineerPatient[],
    [patients]
  );

  // Smart compare candidates
  const compareCandidates: EngineerPatient[] = useMemo(() => {
    if (role !== "engineer") return [];
    const sel = engineerPatients.find((p) => String(p.id) === String(patientId));
    if (!sel) return [];

    const selFam = deviceFamily(sel.deviceModel);
    const selAge = sel.age ?? 0;
    const selKW = historyKeywords(sel.history);

    const AGE_WINDOW = 3;
    const MIN_HISTORY_SIM = 0.45;
    const MAX_RESULTS = 5;

    return engineerPatients
      .filter((p) => String(p.id) !== String(sel.id))
      .filter((p) => deviceFamily(p.deviceModel) === selFam)
      .filter((p) => Math.abs((p.age ?? 0) - selAge) <= AGE_WINDOW)
      .map((p) => {
        const scoreHist = jaccard(selKW, historyKeywords(p.history));
        const scoreAge = 1 - Math.min(Math.abs((p.age ?? 0) - selAge), AGE_WINDOW) / AGE_WINDOW;
        const score = 0.7 * scoreHist + 0.3 * scoreAge;
        return { p, score, scoreHist, scoreAge };
      })
      .filter((x) => x.scoreHist >= MIN_HISTORY_SIM)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RESULTS)
      .map((x) => x.p);
  }, [role, engineerPatients, patientId]);

  // Adopt baseline once per newly selected patient
  const lastAdoptedRef = useRef<string>("");
  useEffect(() => {
    if (!selected) return;
    const id = String(selected.id);
    if (lastAdoptedRef.current === id) return;
    onAdoptBaseline(selected.baseline);
    lastAdoptedRef.current = id;
  }, [selected, onAdoptBaseline]);

  // Has-changed flags vs baseline
  const [changed, setChanged] = useState({ coil: false, charge: false, temp: false, load: false });
  useEffect(() => {
    const b = baselineRef.current;
    if (!b || !panelTargeted) return;
    setChanged({
      coil: effCoil !== b.coilOffsetDeg,
      charge: effCharge !== b.chargeRateC,
      temp: effTemp !== b.tempC,
      load: effLoad !== b.load_mA,
    });
  }, [panelTargeted, effCoil, effCharge, effTemp, effLoad]);

  // Helper to fetch a sweep
  async function fetchSweep(params: {
    patientId: string;
    chargeRateC: number;
    tempC: number;
    load_mA: number;
    signal: AbortSignal;
  }): Promise<SweepPoint[]> {
    const { patientId, chargeRateC, tempC, load_mA, signal } = params;
    const r = await fetch(`${API}/simulate/sweep`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-role": role },
      body: JSON.stringify({
        patientId,
        chargeRateC,
        tempC,
        load_mA,
        from: 0,
        to: 20,
        step: 1,
      }),
      signal,
    });
    if (!r.ok) return [];
    const j = await r.json();
    return j.data || [];
  }

  // Debounced overlays (per-slider) + compare curve
  useEffect(() => {
    if (!patientId || !autoRun) return;
    const base = baselineRef.current;
    if (!base) return;

    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        safeSet(setCurveLoading, true);

        if (changed.coil) {
          const data = await fetchSweep({
            patientId,
            chargeRateC: base.chargeRateC,
            tempC: base.tempC,
            load_mA: base.load_mA,
            signal: ctrl.signal,
          });
          safeSet(setCurveCoil, data);
        } else setCurveCoil([]);

        if (changed.charge) {
          const data = await fetch(`${API}/simulate/sweep`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-role": role },
            body: JSON.stringify({
              patientId,
              chargeRateC: effCharge,
              tempC: base.tempC,
              load_mA: base.load_mA,
              from: 0,
              to: 20,
              step: 1,
            }),
            signal: ctrl.signal,
          });
          safeSet(setCurveCharge, data.ok ? (await data.json()).data || [] : []);
        } else setCurveCharge([]);

        if (changed.temp) {
          const data = await fetch(`${API}/simulate/sweep`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-role": role },
            body: JSON.stringify({
              patientId,
              chargeRateC: base.chargeRateC,
              tempC: effTemp,
              load_mA: base.load_mA,
              from: 0,
              to: 20,
              step: 1,
            }),
            signal: ctrl.signal,
          });
          safeSet(setCurveTemp, data.ok ? (await data.json()).data || [] : []);
        } else setCurveTemp([]);

        if (changed.load) {
          const data = await fetch(`${API}/simulate/sweep`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-role": role },
            body: JSON.stringify({
              patientId,
              chargeRateC: base.chargeRateC,
              tempC: base.tempC,
              load_mA: effLoad,
              from: 0,
              to: 20,
              step: 1,
            }),
            signal: ctrl.signal,
          });
          safeSet(setCurveLoad, data.ok ? (await data.json()).data || [] : []);
        } else setCurveLoad([]);

        if (role === "engineer" && compareId) {
          const data = await fetchSweep({
            patientId: compareId,
            chargeRateC: base.chargeRateC,
            tempC: base.tempC,
            load_mA: base.load_mA,
            signal: ctrl.signal,
          });
          safeSet(setCurveB, data);
        } else setCurveB([]);
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          safeSet(setCurveCoil, []);
          safeSet(setCurveCharge, []);
          safeSet(setCurveTemp, []);
          safeSet(setCurveLoad, []);
          safeSet(setCurveB, []);
          toast("Network error while fetching overlays");
        }
      } finally {
        safeSet(setCurveLoading, false);
      }
    }, 200);

    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [patientId, compareId, role, autoRun, changed, effCharge, effTemp, effLoad]);

  // Manual Run: compute "Final" curve with ALL current inputs
  const runSimulation = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-role": role },
        body: JSON.stringify({
          patientId,
          coilOffsetDeg: effCoil,
          chargeRateC: effCharge,
          tempC: effTemp,
          load_mA: effLoad,
        }),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        toast(`Simulation failed (HTTP ${res.status})${msg ? " — " + msg.slice(0, 120) : ""}`);
        return;
      }
      const json = await res.json();
      safeSet(setResult, json);

      // ✅ Log this run
      appendLog({
        ts: new Date().toISOString(),
        role,
        profileId: patientId,
        compareId,
        inputs: { coilOffsetDeg: effCoil, chargeRateC: effCharge, tempC: effTemp, load_mA: effLoad },
        outputs: { score: Number(json?.score ?? 0), status: json?.status },
      });

      const ctrl = new AbortController();
      const rFinal = await fetch(`${API}/simulate/sweep`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-role": role },
        body: JSON.stringify({
          patientId,
          chargeRateC: effCharge,
          tempC: effTemp,
          load_mA: effLoad,
          from: 0,
          to: 20,
          step: 1,
        }),
        signal: ctrl.signal,
      });
      const jFinal = rFinal.ok ? await rFinal.json() : { data: [] };
      safeSet(setCurveFinal, jFinal.data || []);
    } catch (e) {
      console.error(e);
      toast("Network error while running simulation");
    } finally {
      safeSet(setLoading, false);
    }
  }, [patientId, role, effCoil, effCharge, effTemp, effLoad, compareId]);

  // === Exports (CSV / PDF) ===
  const hasAnyCurve =
    curveCoil.length || curveCharge.length || curveTemp.length || curveLoad.length || curveFinal.length || curveB.length;

  type SeriesRow = { key: string; label: string; data: SweepPoint[] };

  function downloadCSV() {
    if (!patientId || !hasAnyCurve) return;

    const series: SeriesRow[] = [
      { key: "coil", label: "Coil changed", data: curveCoil },
      { key: "charge", label: "Charge rate changed", data: curveCharge },
      { key: "temp", label: "Temperature changed", data: curveTemp },
      { key: "load", label: "Load changed", data: curveLoad },
      { key: "final", label: "Final (Run)", data: curveFinal },
      { key: "compare", label: "Compare profile", data: curveB },
    ].filter((s) => s.data.length > 0);

    const degSet = new Set<number>();
    series.forEach((s) => s.data.forEach((p) => degSet.add(p.deg)));
    const degs = Array.from(degSet).sort((a, b) => a - b);

    const toMap = (arr: SweepPoint[]) => {
      const m = new Map<number, number>();
      arr.forEach((p) => m.set(p.deg, p.score));
      return m;
    };
    const lookups = series.map((s) => [s.label, toMap(s.data)] as const);

    const header = ["deg", ...lookups.map(([label]) => label)];
    const rows: string[][] = [header];
    for (const d of degs) {
      rows.push([String(d), ...lookups.map(([, m]) => (m.get(d) ?? "").toString())]);
    }

    const csv = rows.map((r) => r.join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${role}_curves_${patientId}${compareId ? `_vs_${compareId}` : ""}_${stamp()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast("CSV exported");
  }

  function downloadPDF() {
    if (!patientId || !hasAnyCurve) return;

    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("What-If Simulator — Risk vs Misalignment", 14, 16);

    doc.setFontSize(11);
    const meta = [
      `Role: ${role}`,
      `Primary: ${patientId}${compareId ? `  •  Compare: ${compareId}` : ""}`,
      `Inputs — Coil: ${effCoil}°, Charge: ${effCharge}C, Temp: ${effTemp}°C, Load: ${effLoad} mA`,
    ];
    meta.forEach((t, i) => doc.text(t, 14, 26 + i * 6));

    const series: SeriesRow[] = [
      { key: "coil", label: "Coil", data: curveCoil },
      { key: "charge", label: "Charge", data: curveCharge },
      { key: "temp", label: "Temp", data: curveTemp },
      { key: "load", label: "Load", data: curveLoad },
      { key: "final", label: "Final", data: curveFinal },
      { key: "compare", label: "Compare", data: curveB },
    ].filter((s) => s.data.length > 0);

    const degSet = new Set<number>();
    series.forEach((s) => s.data.forEach((p) => degSet.add(p.deg)));
    const degs = Array.from(degSet).sort((a, b) => a - b);

    const toMap = (arr: SweepPoint[]) => {
      const m = new Map<number, number>();
      arr.forEach((p) => m.set(p.deg, p.score));
      return m;
    };
    const lookups = series.map((s) => [s.label, toMap(s.data)] as const);

    let y = 52;
    doc.setFontSize(10);
    const header = ["deg", ...lookups.map(([label]) => label)];
    doc.text(header.join("   "), 14, y);
    y += 6;

    for (let i = 0; i < degs.length; i++) {
      const d = degs[i];
      const row = [
        String(d).padEnd(3, " "),
        ...lookups.map(([, m]) => {
          const v = m.get(d);
          return (v == null ? "" : v.toFixed(2)).padEnd(6, " ");
        }),
      ].join("   ");
      doc.text(row, 14, y);
      y += 6;
      if (y > 270) break;
    }

    doc.save(`${role}_curves_${patientId}${compareId ? `_vs_${compareId}` : ""}_${stamp()}.pdf`);
    toast("PDF exported");
  }

  // --- styles
  const statusColor =
    result?.status === "GREEN" ? "#16a34a" : result?.status === "AMBER" ? "#f59e0b" : result?.status === "RED" ? "#dc2626" : "#9ca3af";

  const cardStyle: CSSProperties = {
    padding: 20,
    borderRadius: 12,
    background: cardBg,
    color: cardFg,
    border: "1px solid rgba(148,163,184,0.2)",
    boxShadow: `0 2px 8px rgba(0,0,0,0.15)${highlightActive ? ", 0 0 8px rgba(59,130,246,0.30)" : ""}`,
  };
  const btnStyle: CSSProperties = {
    padding: "8px 12px",
    borderRadius: 10,
    border: `1px solid ${isDark ? "#334155" : "#cbd5e1"}`,
    background: isDark ? "transparent" : "#ffffff",
    color: isDark ? cardFg : "#0b1220",
    fontWeight: 600,
  };
  const btnDisabled: CSSProperties = {
    opacity: isDark ? 0.5 : 1,
    background: isDark ? "transparent" : "#eef2f7",
    color: isDark ? cardFg : "#64748b",
    border: `1px solid ${isDark ? "#334155" : "#cbd5e1"}`,
    cursor: "not-allowed",
  };

  // ---------- UI ----------
  return (
    <section style={{ display: "grid", gap: 12 }}>
      <h3 style={{ margin: 0 }}>{title}</h3>

      {/* Selection */}
      <div style={{ display: "grid", gap: 8, position: "relative", zIndex: 1 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: subFg }}>{role === "clinician" ? "Patient (PHI):" : "Research Profile:"}</span>
          <select
            aria-label={role === "clinician" ? "Select patient" : "Select research profile"}
            value={patientId}
            onChange={(e) => {
              const id = String(e.target.value);
              setPatientId(id);
              setCompareId("");
              setResult(null);
              setCurveCoil([]);
              setCurveCharge([]);
              setCurveTemp([]);
              setCurveLoad([]);
              setCurveFinal([]);
              setCurveB([]);
              onSelectionChange(Boolean(id));
            }}
          >
            <option value="">— Select —</option>
            {patients.map((p: any) => (
              <option key={String(p.id)} value={String(p.id)}>
                {role === "clinician" ? `${p.name} • ${p.deviceModel}` : `${p.displayName} • ${p.deviceModel}`}
              </option>
            ))}
          </select>
        </label>

        {role === "engineer" && patientId && (
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: subFg }}>Compare:</span>
            <select aria-label="Select compare profile" value={compareId} onChange={(e) => setCompareId(String(e.target.value))}>
              <option value="">— None —</option>
              {compareCandidates.map((p) => (
                <option key={String(p.id)} value={String(p.id)}>
                  {p.displayName} • {p.deviceModel} • {p.age}y
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {/* Details */}
      {selected && (
        <div style={cardStyle}>
          {role === "clinician" ? (
            <>
              <div style={{ fontWeight: 600 }}>Patient: {(selected as ClinicianPatient).name}</div>
              <div style={{ color: subFg, fontSize: 12 }}>
                DOB: {(selected as ClinicianPatient).dob} • {(selected as ClinicianPatient).address}
              </div>
              <div style={{ color: subFg, fontSize: 12 }}>Device: {selected.deviceModel}</div>
            </>
          ) : (
            <>
              <div style={{ fontWeight: 600 }}>Profile: {(selected as EngineerPatient).displayName}</div>
              <div style={{ color: subFg, fontSize: 12 }}>
                Device: {selected.deviceModel} • Age {(selected as EngineerPatient).age}
              </div>
            </>
          )}
          {selected.history?.length ? (
            <ul style={{ marginTop: 8, paddingLeft: 18 }}>
              {selected.history.map((h: string, i: number) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      {/* Readouts */}
      {result && (
        <div style={cardStyle}>
          <div
            aria-live="polite"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: statusColor,
              }}
            />
            <span>Status: {result.status}</span>
            <span>• Score: {Number.isFinite(result.score) ? result.score.toFixed(2) : "—"}</span>
            <span>
              • Efficiency: {Number.isFinite(result.telemetry?.efficiency) ? result.telemetry.efficiency.toFixed(2) : "—"}
            </span>
          </div>
          {result.rationale?.length ? (
            <ul style={{ marginTop: 8 }}>
              {result.rationale.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      {/* Chart (RiskChart with legend toggles + multi-series) */}
      <section style={{ height: 420 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Risk vs Misalignment</div>

        {!patientId ? (
          <div style={{ padding: 20, border: "1px dashed #64748b", borderRadius: 12, color: subFg, minHeight: 260 }}>
            Select a profile to see the risk curve.
          </div>
        ) : curveLoading ? (
          <div>Loading overlays…</div>
        ) : (
          <div style={{ border: `1px solid ${gridCol}`, borderRadius: 12, padding: 8 }}>
            {(() => {
              // Build multi-series array (like your old chart)
              const series: Array<{
                key: string;
                label: string;
                stroke: string;
                dashed?: boolean;
                data: { misalignDeg: number; score: number }[];
              }> = [];

              if (curveCoil.length) {
                series.push({
                  key: "coil",
                  label: "Coil changed",
                  stroke: "#3b82f6",
                  data: curveCoil.map(({ deg, score }) => ({ misalignDeg: deg, score })),
                });
              }
              if (curveCharge.length) {
                series.push({
                  key: "charge",
                  label: "Charge rate changed",
                  stroke: "#22c55e",
                  data: curveCharge.map(({ deg, score }) => ({ misalignDeg: deg, score })),
                });
              }
              if (curveTemp.length) {
                series.push({
                  key: "temp",
                  label: "Temperature changed",
                  stroke: "#f59e0b",
                  data: curveTemp.map(({ deg, score }) => ({ misalignDeg: deg, score })),
                });
              }
              if (curveLoad.length) {
                series.push({
                  key: "load",
                  label: "Load changed",
                  stroke: "#a855f7",
                  data: curveLoad.map(({ deg, score }) => ({ misalignDeg: deg, score })),
                });
              }
              if (curveFinal.length) {
                series.push({
                  key: "final",
                  label: "Final (Run)",
                  stroke: "#06b6d4",
                  data: curveFinal.map(({ deg, score }) => ({ misalignDeg: deg, score })),
                });
              }
              let compareLabel: string | undefined;
              if (curveB.length) {
                if (role === "engineer" && compareId) {
                  compareLabel =
                    engineerPatients.find((p) => String(p.id) === String(compareId))?.displayName ?? compareId;
                }
                series.push({
                  key: "compare",
                  label: "Compare",
                  stroke: "#94a3b8",
                  dashed: true,
                  data: curveB.map(({ deg, score }) => ({ misalignDeg: deg, score })),
                });
              }

              return (
                <RiskChart
                  series={series}
                  compareLabel={compareLabel}
                  bands={theme.bandFill}
                  gridColor={gridCol}
                  fg={cardFg}
                />
              );
            })()}
          </div>
        )}

        {role === "engineer" && patientId && !compareId && (
          <div style={{ marginTop: 6, fontSize: 12, color: subFg }}>
            Tip: choose a “Compare” profile to see a dashed curve.
          </div>
        )}
      </section>

      {/* Actions */}
      <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 24, flexWrap: "wrap" }}>
        <button
          aria-label="Run simulation"
          aria-busy={loading}
          onClick={runSimulation}
          disabled={!patientId || loading}
          style={{ ...btnStyle, ...((!patientId || loading) ? btnDisabled : {}) }}
          title={panelTargeted ? "" : "Affect is set to the other panel; manual Run still works."}
        >
          {loading ? "Running…" : "Run"}
        </button>

        <button
          aria-label="Reset to patient baseline"
          onClick={() => selected && onAdoptBaseline(selected.baseline)}
          disabled={!selected || !panelTargeted}
          style={{ ...btnStyle, ...((!selected || !panelTargeted) ? btnDisabled : {}) }}
          title={!panelTargeted ? "Switch Affect to this panel to apply its baseline to the shared sliders." : ""}
        >
          Reset to Baseline
        </button>

        {/* Exports */}
        <button
          aria-label="Download CSV"
          onClick={downloadCSV}
          disabled={!patientId || !hasAnyCurve}
          style={{ ...btnStyle, ...((!patientId || !hasAnyCurve) ? btnDisabled : {}) }}
        >
          CSV
        </button>
        <button
          aria-label="Download PDF"
          onClick={downloadPDF}
          disabled={!patientId || !hasAnyCurve}
          style={{ ...btnStyle, ...((!patientId || !hasAnyCurve) ? btnDisabled : {}) }}
        >
          PDF
        </button>

        {/* Logs actions */}
        <button onClick={exportLogsCSV} style={btnStyle}>Export Logs</button>
        <button onClick={clearLogs} style={btnStyle}>Clear Logs</button>
      </div>
    </section>
  );
}
