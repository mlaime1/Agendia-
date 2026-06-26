-- CreateEnum
CREATE TYPE "payment_status_enum" AS ENUM ('pending', 'partial', 'paid');

-- AlterTable
ALTER TABLE "summaries" ADD COLUMN     "paid_amount" DECIMAL NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "trips" ADD COLUMN     "paid_amount" DECIMAL NOT NULL DEFAULT 0,
ADD COLUMN     "payment_status" "payment_status_enum" NOT NULL DEFAULT 'pending';

-- CreateTable
CREATE TABLE "payments" (
    "id" BIGSERIAL NOT NULL,
    "trip_id" BIGINT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "method" VARCHAR NOT NULL,
    "paid_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" VARCHAR,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payments_trip_id_idx" ON "payments"("trip_id");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
