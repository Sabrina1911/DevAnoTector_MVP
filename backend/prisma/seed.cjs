// prisma/seed.cjs
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function seedPhiPatients() {
  const dataDir = path.join(__dirname, '..', 'src', 'data');
  const phiPath = path.join(dataDir, 'patients.phi.json');

  const raw = fs.readFileSync(phiPath, 'utf8');
  const patients = JSON.parse(raw);

  for (const p of patients) {
    await prisma.phiPatient.upsert({
      where: { id: p.id },
      update: {},
      create: {
        id: p.id,
        name: p.name,
        sex: p.sex,
        dob: new Date(p.dob),
        address: p.address,
        deviceModel: p.deviceModel,

        coilOffsetDeg: p.baseline.coilOffsetDeg,
        chargeRateC: p.baseline.chargeRateC,
        tempC: p.baseline.tempC,
        load_mA: p.baseline.load_mA,

        factorMisalign: p.factors.misalign,
        factorRate: p.factors.rate,
        factorTemp: p.factors.temp,
        factorLoad: p.factors.load,

        historyJson: JSON.stringify(p.history),
      },
    });
  }
}

async function seedResearchPatients() {
  const dataDir = path.join(__dirname, '..', 'src', 'data');
  const researchPath = path.join(dataDir, 'patients.research.json');

  const raw = fs.readFileSync(researchPath, 'utf8');
  const patients = JSON.parse(raw);

  for (const p of patients) {
    await prisma.researchPatient.upsert({
      where: { id: p.id },
      update: {},
      create: {
        id: p.id,
        sex: p.sex,
        age: p.age,
        deviceModel: p.deviceModel,
        displayName: p.displayName,

        coilOffsetDeg: p.baseline.coilOffsetDeg,
        chargeRateC: p.baseline.chargeRateC,
        tempC: p.baseline.tempC,
        load_mA: p.baseline.load_mA,

        factorMisalign: p.factors.misalign,
        factorRate: p.factors.rate,
        factorTemp: p.factors.temp,
        factorLoad: p.factors.load,

        historyJson: JSON.stringify(p.history),
      },
    });
  }
}

async function main() {
  await seedPhiPatients();
  await seedResearchPatients();
  console.log('Seed completed');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
