-- CreateEnum
CREATE TYPE "job_status" AS ENUM ('uploaded', 'processing', 'erp_creating', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "shipment_status" AS ENUM ('pending', 'erp_created', 'pdf_generated', 'failed');

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "customer_code" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "default_ship_via" INTEGER,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "job_number" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "uploaded_file_name" TEXT NOT NULL,
    "status" "job_status" NOT NULL,
    "total_shipments" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "erp_shipment_id" TEXT,
    "erp_system" TEXT,
    "kit_data" JSONB NOT NULL,
    "recipient_name" TEXT NOT NULL,
    "recipient_company" TEXT,
    "shipping_address" JSONB NOT NULL,
    "status" "shipment_status" NOT NULL,
    "erp_response" JSONB,
    "pdf_path" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_items" (
    "id" TEXT NOT NULL,
    "shipment_id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "custom_properties" JSONB,

    CONSTRAINT "shipment_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_customer_code_key" ON "customers"("customer_code");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_customer_id_job_number_key" ON "jobs"("customer_id", "job_number");

-- CreateIndex
CREATE INDEX "shipments_erp_shipment_id_idx" ON "shipments"("erp_shipment_id");

-- CreateIndex
CREATE INDEX "shipments_job_id_status_idx" ON "shipments"("job_id", "status");

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_items" ADD CONSTRAINT "shipment_items_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
