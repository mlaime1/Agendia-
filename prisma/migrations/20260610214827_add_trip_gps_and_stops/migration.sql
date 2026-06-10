-- AlterTable
ALTER TABLE "route_stops" ADD COLUMN     "lat" DECIMAL(10,7),
ADD COLUMN     "lng" DECIMAL(10,7);

-- AlterTable
ALTER TABLE "trips" ADD COLUMN     "end_lat" DECIMAL(10,7),
ADD COLUMN     "end_lng" DECIMAL(10,7),
ADD COLUMN     "ended_at" TIMESTAMPTZ(6),
ADD COLUMN     "start_lat" DECIMAL(10,7),
ADD COLUMN     "start_lng" DECIMAL(10,7),
ADD COLUMN     "started_at" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "trip_stops" (
    "id" BIGSERIAL NOT NULL,
    "trip_id" BIGINT NOT NULL,
    "lat" DECIMAL(10,7) NOT NULL,
    "lng" DECIMAL(10,7) NOT NULL,
    "stopped_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_stops_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "trip_stops_trip_id_idx" ON "trip_stops"("trip_id");

-- AddForeignKey
ALTER TABLE "trip_stops" ADD CONSTRAINT "trip_stops_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
