-- CreateTable
CREATE TABLE "Bairro" (
    "id" SERIAL NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "taxaEntrega" DOUBLE PRECISION NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bairro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Bairro_tenantId_idx" ON "Bairro"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Bairro_tenantId_nome_key" ON "Bairro"("tenantId", "nome");

-- AddForeignKey
ALTER TABLE "Bairro" ADD CONSTRAINT "Bairro_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
