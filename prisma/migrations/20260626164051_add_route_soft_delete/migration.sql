-- AlterTable
ALTER TABLE "routes" ADD COLUMN     "deleted_at" TIMESTAMPTZ(6),
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "routes_is_active_idx" ON "routes"("is_active");
