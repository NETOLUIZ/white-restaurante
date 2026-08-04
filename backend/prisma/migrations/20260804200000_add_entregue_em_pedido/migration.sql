-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN     "entregueEm" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Pedido_entregadorId_statusEntrega_formaPagamento_entregueEm_idx" ON "Pedido"("entregadorId", "statusEntrega", "formaPagamento", "entregueEm");
