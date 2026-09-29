-- CreateEnum
CREATE TYPE "CollectionPointKind" AS ENUM ('HABITUAL', 'ADDITIONAL');

-- CreateTable
CREATE TABLE "collection_points" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "CollectionPointKind" NOT NULL,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "circuit" INTEGER NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "collection_points_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "collection_points_active_circuit_idx" ON "collection_points"("active", "circuit");

-- CreateIndex
CREATE INDEX "collection_points_created_by_user_id_idx" ON "collection_points"("created_by_user_id");

-- AddForeignKey
ALTER TABLE "collection_points" ADD CONSTRAINT "collection_points_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "collection_points" ENABLE ROW LEVEL SECURITY;
