-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "timezone" VARCHAR NOT NULL DEFAULT 'UTC';

-- AlterTable
ALTER TABLE "trips" ALTER COLUMN "trip_date" SET DATA TYPE TIMESTAMPTZ(6);
