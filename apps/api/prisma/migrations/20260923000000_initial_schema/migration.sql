-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('MORADOR', 'COLETOR', 'OPERADOR');

-- CreateEnum
CREATE TYPE "CollectorOrigin" AS ENUM ('CUSTOM');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('SCHEDULED', 'PENDING', 'ASSIGNED', 'IN_SERVICE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'SYNCED', 'ERROR');

-- CreateEnum
CREATE TYPE "StatusSource" AS ENUM ('LOCAL', 'ECOROTA');

-- CreateEnum
CREATE TYPE "MaterialType" AS ENUM ('PAPER', 'PLASTIC', 'GLASS', 'METAL', 'ELECTRONICS', 'ORGANIC', 'OTHER');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addresses" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "complement" TEXT,
    "district" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" CHAR(2) NOT NULL,
    "zip_code" TEXT NOT NULL,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "reference" TEXT,
    "photo_url" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collector_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "ecorota_collector_id" TEXT,
    "origin" "CollectorOrigin" NOT NULL DEFAULT 'CUSTOM',
    "available" BOOLEAN NOT NULL DEFAULT false,
    "availability_shift" TEXT,
    "sync_status" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collector_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_requests" (
    "id" UUID NOT NULL,
    "resident_id" UUID NOT NULL,
    "address_id" UUID NOT NULL,
    "collector_profile_id" UUID,
    "ecorota_request_id" TEXT,
    "external_reference" TEXT NOT NULL,
    "external_point_id" TEXT,
    "external_collector_id" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "sync_status" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "desired_at" TIMESTAMP(3) NOT NULL,
    "cancellation_reason" TEXT,
    "completion_photo_url" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collection_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_materials" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "material_type" "MaterialType" NOT NULL,
    "estimated_quantity" DECIMAL(10,2),
    "unit" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_status_history" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "changed_by_user_id" UUID,
    "source" "StatusSource" NOT NULL,
    "from_status" "RequestStatus",
    "to_status" "RequestStatus" NOT NULL,
    "reason" TEXT,
    "external_event_id" TEXT,
    "generation" INTEGER,
    "revision" INTEGER,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "points_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "points" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "points_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_state" (
    "key" TEXT NOT NULL,
    "generation" INTEGER NOT NULL,
    "last_revision" INTEGER NOT NULL,
    "last_snapshot_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_state_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "addresses_user_id_idx" ON "addresses"("user_id");

-- CreateIndex
CREATE INDEX "addresses_user_id_is_default_idx" ON "addresses"("user_id", "is_default");

-- CreateIndex
CREATE UNIQUE INDEX "collector_profiles_user_id_key" ON "collector_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "collector_profiles_ecorota_collector_id_key" ON "collector_profiles"("ecorota_collector_id");

-- CreateIndex
CREATE INDEX "collector_profiles_available_idx" ON "collector_profiles"("available");

-- CreateIndex
CREATE UNIQUE INDEX "collection_requests_ecorota_request_id_key" ON "collection_requests"("ecorota_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "collection_requests_external_reference_key" ON "collection_requests"("external_reference");

-- CreateIndex
CREATE INDEX "collection_requests_resident_id_status_idx" ON "collection_requests"("resident_id", "status");

-- CreateIndex
CREATE INDEX "collection_requests_address_id_desired_at_idx" ON "collection_requests"("address_id", "desired_at");

-- CreateIndex
CREATE INDEX "collection_requests_collector_profile_id_status_idx" ON "collection_requests"("collector_profile_id", "status");

-- CreateIndex
CREATE INDEX "collection_requests_desired_at_idx" ON "collection_requests"("desired_at");

-- CreateIndex
CREATE INDEX "request_materials_request_id_idx" ON "request_materials"("request_id");

-- CreateIndex
CREATE UNIQUE INDEX "request_status_history_external_event_id_key" ON "request_status_history"("external_event_id");

-- CreateIndex
CREATE INDEX "request_status_history_request_id_occurred_at_idx" ON "request_status_history"("request_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "request_status_history_generation_revision_key" ON "request_status_history"("generation", "revision");

-- CreateIndex
CREATE INDEX "points_logs_user_id_created_at_idx" ON "points_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "points_logs_request_id_idx" ON "points_logs"("request_id");

-- CreateIndex
CREATE UNIQUE INDEX "points_logs_user_id_request_id_key" ON "points_logs"("user_id", "request_id");

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collector_profiles" ADD CONSTRAINT "collector_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_requests" ADD CONSTRAINT "collection_requests_resident_id_fkey" FOREIGN KEY ("resident_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_requests" ADD CONSTRAINT "collection_requests_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "addresses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_requests" ADD CONSTRAINT "collection_requests_collector_profile_id_fkey" FOREIGN KEY ("collector_profile_id") REFERENCES "collector_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_materials" ADD CONSTRAINT "request_materials_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "collection_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_status_history" ADD CONSTRAINT "request_status_history_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "collection_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_status_history" ADD CONSTRAINT "request_status_history_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_logs" ADD CONSTRAINT "points_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_logs" ADD CONSTRAINT "points_logs_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "collection_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Supabase Security
-- O frontend não acessa estas tabelas diretamente. Sem policies públicas,
-- as APIs anônima e autenticada do Supabase permanecem bloqueadas.
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "addresses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "collector_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "collection_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "request_materials" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "request_status_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "points_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "system_state" ENABLE ROW LEVEL SECURITY;
