-- CreateTable
CREATE TABLE "SangriaEntregador" (
    "id" SERIAL NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entregadorId" INTEGER NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SangriaEntregador_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SangriaEntregador_tenantId_idx" ON "SangriaEntregador"("tenantId");

-- CreateIndex
CREATE INDEX "SangriaEntregador_entregadorId_idx" ON "SangriaEntregador"("entregadorId");

-- AddForeignKey
ALTER TABLE "SangriaEntregador" ADD CONSTRAINT "SangriaEntregador_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SangriaEntregador" ADD CONSTRAINT "SangriaEntregador_entregadorId_fkey" FOREIGN KEY ("entregadorId") REFERENCES "Entregador"("id") ON DELETE CASCADE ON UPDATE CASCADE;
