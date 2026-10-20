-- Mirrors backend/prisma/contract.prisma (no foreign keys, same as the contract).
-- The Intake table comes from backend/prisma/intake.sql; the Document RLS policy from backend/prisma/rls.sql.
-- If contract.prisma changes, update this file too.
CREATE TABLE IF NOT EXISTS "Case"(id SERIAL PRIMARY KEY,"userId" INT NOT NULL,title TEXT NOT NULL,"caseType" TEXT,"legalRoute" TEXT,status TEXT NOT NULL DEFAULT 'ACTIVE',description TEXT,"createdAt" TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS "Party"(id SERIAL PRIMARY KEY,"caseId" INT NOT NULL,name TEXT NOT NULL,role TEXT NOT NULL,"createdAt" TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS "Dependent"(id SERIAL PRIMARY KEY,"caseId" INT NOT NULL,name TEXT NOT NULL,relation TEXT,age INT,"createdAt" TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS "Proceeding"(id SERIAL PRIMARY KEY,"caseId" INT NOT NULL,"courtName" TEXT,"caseNumber" TEXT,"proceedingType" TEXT,status TEXT NOT NULL DEFAULT 'ONGOING',"filedAt" TIMESTAMPTZ,"createdAt" TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS "Order"(id SERIAL PRIMARY KEY,"proceedingId" INT NOT NULL,"orderType" TEXT,"orderDate" TIMESTAMPTZ,amount NUMERIC,description TEXT,"createdAt" TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS "Payment"(id SERIAL PRIMARY KEY,"orderId" INT NOT NULL,amount NUMERIC NOT NULL,"paymentDate" TIMESTAMPTZ NOT NULL,status TEXT NOT NULL DEFAULT 'RECEIVED',reference TEXT,notes TEXT,"createdAt" TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS "Document"(id SERIAL PRIMARY KEY,"caseId" INT NOT NULL,"fileName" TEXT NOT NULL,"originalName" TEXT NOT NULL,"mimeType" TEXT NOT NULL,"fileSize" INT NOT NULL,"storagePath" TEXT NOT NULL,"documentType" TEXT,"uploadedBy" INT NOT NULL,"createdAt" TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS "User"(id SERIAL PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL UNIQUE,password TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'OWNER',"createdAt" TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS "CalculatorRun"(id SERIAL PRIMARY KEY,"caseId" INT NOT NULL,"userId" INT NOT NULL,"formulaVersion" TEXT NOT NULL,"inputData" TEXT NOT NULL,"resultData" TEXT NOT NULL,"createdAt" TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS "AuditLog"(id SERIAL PRIMARY KEY,"userId" INT NOT NULL,action TEXT NOT NULL,"entityType" TEXT NOT NULL,"entityId" INT,metadata TEXT,"createdAt" TIMESTAMPTZ NOT NULL DEFAULT now());
