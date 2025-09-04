-- CreateTable
CREATE TABLE "templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "customer_id" TEXT,
    "customer_code" TEXT,
    "elements" JSONB NOT NULL,
    "page_settings" JSONB NOT NULL,
    "styles" JSONB,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "templates_customer_id_idx" ON "templates"("customer_id");

-- CreateIndex
CREATE INDEX "templates_customer_code_idx" ON "templates"("customer_code");

-- CreateIndex
CREATE INDEX "templates_is_default_idx" ON "templates"("is_default");

-- AddForeignKey
ALTER TABLE "templates" ADD CONSTRAINT "templates_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
