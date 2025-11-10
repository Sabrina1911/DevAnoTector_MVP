// backend/src/index.ts
import express, { Request } from "express";
import cors from "cors";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import phiPatientsJson from "./data/patients.phi.json";
import researchPatientsJson from "./data/patients.research.json";


const prisma = new PrismaClient();


// import phiPatientsJson from "./data/patients.phi.json";
// import researchPatientsJson from "./data/patients.research.json";

// ---------------- Types ----------------
type Factors = { misalign?: number; rate?: number; temp?: number; load?: number };

type PatientBase = {
  id: string;
  deviceModel: string;
  history?: string[];
  baseline: { coilOffsetDeg: number; chargeRateC: number; tempC: number; load_mA: number };
  factors?: Factors;
};

type PhiPatient = PatientBase & {
  name: string; sex: "male" | "female"; dob: string; address: string;
};

type ResearchPatient = PatientBase & {
  sex: "male" | "female"; age: number; displayName: string;
};

// Cast JSON into typed arrays
const phiPatients = phiPatientsJson as PhiPatient[];
const researchPatients = researchPatientsJson as ResearchPatient[];

// --------------- App setup --------------
const app = express();
app.use(cors());
app.use(express.json());

// --------------- Role helper ------------
type Role = "clinician" | "engineer";
function getRole(req: Request): Role {
  const h = (req.header("x-role") || "").toLowerCase();
  return h === "clinician" ? "clinician" : "engineer";
}

// --------------- Patients API -----------
// --------------- Patients API -----------
app.get("/patients", async (req, res) => {
  const role = getRole(req);

  try {
    if (role === "clinician") {
      const patients = await prisma.phiPatient.findMany();

      return res.json(
        patients.map((p) => ({
          id: p.id,
          name: p.name,
          sex: p.sex,
          dob: p.dob, // DateTime from Prisma, will serialize as ISO string
          address: p.address,
          deviceModel: p.deviceModel,
          history: JSON.parse(p.historyJson),

          baseline: {
            coilOffsetDeg: p.coilOffsetDeg,
            chargeRateC: p.chargeRateC,
            tempC: p.tempC,
            load_mA: p.load_mA,
          },
          factors: {
            misalign: p.factorMisalign,
            rate: p.factorRate,
            temp: p.factorTemp,
            load: p.factorLoad,
          },
        }))
      );
    }

    // Engineer view: research (de-identified) patients
    const patients = await prisma.researchPatient.findMany();

    return res.json(
      patients.map((p) => ({
        id: p.id,
        displayName: p.displayName,
        sex: p.sex,
        age: p.age,
        deviceModel: p.deviceModel,
        history: JSON.parse(p.historyJson),

        baseline: {
          coilOffsetDeg: p.coilOffsetDeg,
          chargeRateC: p.chargeRateC,
          tempC: p.tempC,
          load_mA: p.load_mA,
        },
        factors: {
          misalign: p.factorMisalign,
          rate: p.factorRate,
          temp: p.factorTemp,
          load: p.factorLoad,
        },
      }))
    );
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to load patients" });
  }
});


// ------- Simulation schema & helpers ----
const InputSchema = z.object({
  patientId: z.string().optional(),
  coilOffsetDeg: z.number().min(0).max(30).optional(),
  chargeRateC:   z.number().min(0.2).max(2).optional(),
  tempC:         z.number().min(15).max(60).optional(),
  load_mA:       z.number().min(0).max(500).optional()
});
type Inputs = {
  coilOffsetDeg: number; chargeRateC: number; tempC: number; load_mA: number;
};

// Merge patient baseline (by role) + UI overrides
// Merge patient baseline + UI overrides
function buildInputs(
  body: Partial<z.infer<typeof InputSchema>>,
  baselineFromDb?: Inputs
): Inputs {
  let base: Inputs = { coilOffsetDeg: 5, chargeRateC: 1, tempC: 37, load_mA: 200 };

  if (baselineFromDb) {
    base = { ...base, ...baselineFromDb };
  }

  return {
    coilOffsetDeg: body.coilOffsetDeg ?? base.coilOffsetDeg,
    chargeRateC:   body.chargeRateC   ?? base.chargeRateC,
    tempC:         body.tempC         ?? base.tempC,
    load_mA:       body.load_mA       ?? base.load_mA,
  };
}


async function getPatientDefaults(
  role: Role,
  patientId: string
): Promise<{ baseline?: Inputs; factors?: Factors }> {
  if (role === "clinician") {
    const p = await prisma.phiPatient.findUnique({ where: { id: patientId } });
    if (!p) return {};

    const baseline: Inputs = {
      coilOffsetDeg: p.coilOffsetDeg,
      chargeRateC: p.chargeRateC,
      tempC: p.tempC,
      load_mA: p.load_mA,
    };

    const factors: Factors = {
      misalign: p.factorMisalign,
      rate: p.factorRate,
      temp: p.factorTemp,
      load: p.factorLoad,
    };

    return { baseline, factors };
  }

  const p = await prisma.researchPatient.findUnique({ where: { id: patientId } });
  if (!p) return {};

  const baseline: Inputs = {
    coilOffsetDeg: p.coilOffsetDeg,
    chargeRateC: p.chargeRateC,
    tempC: p.tempC,
    load_mA: p.load_mA,
  };

  const factors: Factors = {
    misalign: p.factorMisalign,
    rate: p.factorRate,
    temp: p.factorTemp,
    load: p.factorLoad,
  };

  return { baseline, factors };
}



// ------------- Weighted simulate --------
function simulate(inputs: Inputs, factors?: Factors) {
  const { coilOffsetDeg, chargeRateC, tempC, load_mA } = inputs;

  const theta = (Math.PI / 180) * coilOffsetDeg;
  const efficiency = Math.max(0, Math.cos(theta));

  const misalignRisk = 1 - efficiency;                 // 0..1
  const rateRisk     = Math.max(0, chargeRateC - 1);   // 0 at 1C, grows above
  const tempRisk     = Math.max(0, (tempC - 37) / 23); // crude 0..~1
  const loadRisk     = Math.min(1, load_mA / 500);     // 0..1

  // Base weights
  let w = { misalign: 0.45, rate: 0.25, temp: 0.20, load: 0.10 };

  // Apply per-patient sensitivity + normalize (thresholds stay fair)
  if (factors) {
    w.misalign *= factors.misalign ?? 1;
    w.rate     *= factors.rate     ?? 1;
    w.temp     *= factors.temp     ?? 1;
    w.load     *= factors.load     ?? 1;
    const s = w.misalign + w.rate + w.temp + w.load;
    w = { misalign: w.misalign/s, rate: w.rate/s, temp: w.temp/s, load: w.load/s };
  }

  const score = w.misalign*misalignRisk + w.rate*rateRisk + w.temp*tempRisk + w.load*loadRisk;

  let status: "GREEN" | "AMBER" | "RED" = "GREEN";
  if (score >= 0.65) status = "RED";
  else if (score >= 0.35) status = "AMBER";

  return {
    status,
    score: Number(score.toFixed(2)),
    telemetry: { efficiency: Number(efficiency.toFixed(2)) },
    rationale: [
      `Misalignment ${coilOffsetDeg}° → efficiency ${efficiency.toFixed(2)}`,
      `Charge ${chargeRateC}C, Temp ${tempC}°C, Load ${load_mA} mA`,
      ...(factors ? [
        `Weights M/R/T/L: ${w.misalign.toFixed(2)}/${w.rate.toFixed(2)}/${w.temp.toFixed(2)}/${w.load.toFixed(2)}`
      ] : [])
    ]
  };
}

// --------------- Simulate API -----------
app.post("/simulate", async (req, res) => {
  const parsed = InputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const body = parsed.data;
  const role = getRole(req);

  let baselineFromDb: Inputs | undefined;
  let factors: Factors | undefined;

  if (body.patientId) {
    const defaults = await getPatientDefaults(role, body.patientId);
    baselineFromDb = defaults.baseline;
    factors = defaults.factors;
  }

  const inputs = buildInputs(body, baselineFromDb);
  return res.json(simulate(inputs, factors));
});



// --------- Simulate sweep (for charts) --
app.post("/simulate/sweep", async (req, res) => {
  const parsed = InputSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const body = parsed.data as any;
  const from = Math.max(0, Number(body.from ?? 0));
  const to   = Math.max(from, Number(body.to ?? 20));
  const stepRaw = Number(body.step ?? 1);
  const step = stepRaw > 0 ? stepRaw : 1;

  const role = getRole(req);

  let baselineFromDb: Inputs | undefined;
  let factors: Factors | undefined;

  if (body.patientId) {
    const defaults = await getPatientDefaults(role, body.patientId);
    baselineFromDb = defaults.baseline;
    factors = defaults.factors;
  }

  const inputsBase = buildInputs(body, baselineFromDb);

  const data: { deg: number; score: number }[] = [];
  for (let deg = from; deg <= to; deg += step) {
    const out = simulate({ ...inputsBase, coilOffsetDeg: deg }, factors);
    data.push({ deg, score: out.score });
  }

  res.json({ patientId: body.patientId ?? null, from, to, step, data });
});


// --------------- Start server -----------
const port = process.env.PORT || 5050;
app.listen(port, () => console.log(`API listening on :${port}`));

export { simulate };
