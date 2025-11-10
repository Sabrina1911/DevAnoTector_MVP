-- CreateTable
CREATE TABLE "PhiPatient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sex" TEXT NOT NULL,
    "dob" DATETIME NOT NULL,
    "address" TEXT NOT NULL,
    "deviceModel" TEXT NOT NULL,
    "coilOffsetDeg" INTEGER NOT NULL,
    "chargeRateC" REAL NOT NULL,
    "tempC" REAL NOT NULL,
    "load_mA" INTEGER NOT NULL,
    "factorMisalign" REAL NOT NULL,
    "factorRate" REAL NOT NULL,
    "factorTemp" REAL NOT NULL,
    "factorLoad" REAL NOT NULL,
    "historyJson" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "ResearchPatient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sex" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "deviceModel" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "coilOffsetDeg" INTEGER NOT NULL,
    "chargeRateC" REAL NOT NULL,
    "tempC" REAL NOT NULL,
    "load_mA" INTEGER NOT NULL,
    "factorMisalign" REAL NOT NULL,
    "factorRate" REAL NOT NULL,
    "factorTemp" REAL NOT NULL,
    "factorLoad" REAL NOT NULL,
    "historyJson" TEXT NOT NULL
);
