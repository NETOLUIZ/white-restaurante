-- CreateEnum
CREATE TYPE "TipoTenant" AS ENUM ('RESTAURANTE', 'MERCANTIL');

-- AlterTable
ALTER TABLE "Produto" ADD COLUMN     "codigoBarras" TEXT,
ADD COLUMN     "custo" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "tipo" "TipoTenant" NOT NULL DEFAULT 'RESTAURANTE';

-- CreateIndex
CREATE UNIQUE INDEX "Produto_tenantId_codigoBarras_key" ON "Produto"("tenantId", "codigoBarras");

