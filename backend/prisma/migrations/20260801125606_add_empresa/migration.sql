-- AlterEnum
ALTER TYPE "TipoPedido" ADD VALUE 'EMPRESA';

-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN     "empresaId" INTEGER;

-- AlterTable
ALTER TABLE "Produto" ADD COLUMN     "disponivelEmpresa" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Empresa" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "senha" TEXT NOT NULL,
    "cotaDiaria" INTEGER NOT NULL DEFAULT 20,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "senhaAlteradaEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Empresa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Empresa_login_key" ON "Empresa"("login");

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;
