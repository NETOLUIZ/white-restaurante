-- AlterTable
ALTER TABLE "Empresa" ADD COLUMN     "valorMarmita" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "EmpresaFuncionario" (
    "id" SERIAL NOT NULL,
    "tenantId" TEXT NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmpresaFuncionario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmpresaFuncionario_tenantId_idx" ON "EmpresaFuncionario"("tenantId");

-- CreateIndex
CREATE INDEX "EmpresaFuncionario_empresaId_idx" ON "EmpresaFuncionario"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "EmpresaFuncionario_empresaId_nome_key" ON "EmpresaFuncionario"("empresaId", "nome");

-- AddForeignKey
ALTER TABLE "EmpresaFuncionario" ADD CONSTRAINT "EmpresaFuncionario_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpresaFuncionario" ADD CONSTRAINT "EmpresaFuncionario_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
