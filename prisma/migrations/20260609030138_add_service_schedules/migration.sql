-- CreateTable
CREATE TABLE "service_schedules" (
    "id" BIGSERIAL NOT NULL,
    "client_id" BIGINT NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "pickup_time" TIME(0) NOT NULL,
    "return_time" TIME(0),
    "label" VARCHAR(100),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "service_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_schedules_client_id_idx" ON "service_schedules"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_schedules_client_id_day_of_week_pickup_time_key" ON "service_schedules"("client_id", "day_of_week", "pickup_time");

-- AddForeignKey
ALTER TABLE "service_schedules" ADD CONSTRAINT "service_schedules_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
