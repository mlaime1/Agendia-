/*
  Warnings:

  - Changed the type of `billing_cycle` on the `clients` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `period_type` on the `summaries` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('weekly', 'biweekly', 'monthly');

-- CreateEnum
CREATE TYPE "PeriodType" AS ENUM ('weekly', 'biweekly', 'monthly', 'manual');

-- AlterTable
ALTER TABLE "clients" DROP COLUMN "billing_cycle",
ADD COLUMN     "billing_cycle" "BillingCycle" NOT NULL;

-- AlterTable
ALTER TABLE "summaries" DROP COLUMN "period_type",
ADD COLUMN     "period_type" "PeriodType" NOT NULL;
