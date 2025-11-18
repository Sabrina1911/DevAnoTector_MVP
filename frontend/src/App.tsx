// frontend/src/App.tsx
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
//import jsPDF from "jspdf";

import type {
  // Role,
  Affect,
  // EngineerPatient,
  // ClinicianPatient,
} from "./types";
import RolePanel from "./components/panels/RolePanel";
import ClinicianRolePanel from "./components/panels/ClinicianRolePanel";
import EngineerRolePanel from "./components/panels/EngineerRolePanel";

// 👉 reusable chart with multi-series legend toggles
// import RiskChart from "./components/RiskChart";





// =============================
// Helpers
// =============================




// =============================
// A) Per-Run Logging (Task 238)
// =============================



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

  const [isClinicianRolePanelVisible, setIsClinicianRolePanelVisible] = useState(false);
  const [isEngineerRolePanelVisible, setIsEngineerRolePanelVisible] = useState(false);

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
      <button onClick={
        (evt) => {
          setIsClinicianRolePanelVisible(true)
          setIsEngineerRolePanelVisible(false)
        }
      }>Clinician View</button>
      <button onClick={
        (evt) => {
          setIsClinicianRolePanelVisible(false)
          setIsEngineerRolePanelVisible(true)
        }
      }>Engineer View</button>

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
        { isClinicianRolePanelVisible && (

          

         <ClinicianRolePanel 
          affect={affect}
          themeObj={themeObj}
          autoRun={autoRun}
          isDark={isDark}
          rememberSelection={rememberSelection}
          coilOffsetDeg={coilOffsetDeg}
          setCoilOffsetDeg={setCoilOffsetDeg}
          chargeRateC={chargeRateC}
          setChargeRateC={setChargeRateC}
          tempC={tempC}
          setTempC={setTempC}
          load_mA={load_mA}
          setLoad_mA={setLoad_mA}
          handleSelectionChange={handleSelectionChange}
         />

        )
        
        
        }


        { isEngineerRolePanelVisible && (
         <EngineerRolePanel 
          affect={affect}
          themeObj={themeObj}
          autoRun={autoRun}
          isDark={isDark}
          rememberSelection={rememberSelection}
          coilOffsetDeg={coilOffsetDeg}
          setCoilOffsetDeg={setCoilOffsetDeg}
          chargeRateC={chargeRateC}
          setChargeRateC={setChargeRateC}
          tempC={tempC}
          setTempC={setTempC}
          load_mA={load_mA}
          setLoad_mA={setLoad_mA}
          handleSelectionChange={handleSelectionChange}
         />

        )
        
        
        }
        
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

