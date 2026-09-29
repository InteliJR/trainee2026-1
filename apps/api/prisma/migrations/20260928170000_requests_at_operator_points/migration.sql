ALTER TABLE "collection_requests" ALTER COLUMN "address_id" DROP NOT NULL;
ALTER TABLE "collection_requests" ADD COLUMN "collection_point_id" UUID;
CREATE INDEX "collection_requests_collection_point_id_desired_at_idx" ON "collection_requests"("collection_point_id", "desired_at");
ALTER TABLE "collection_requests" ADD CONSTRAINT "collection_requests_collection_point_id_fkey" FOREIGN KEY ("collection_point_id") REFERENCES "collection_points"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
