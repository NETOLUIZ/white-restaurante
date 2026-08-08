-- CreateTable
CREATE TABLE "AvaliacaoProduto" (
    "id" SERIAL NOT NULL,
    "tenantId" TEXT NOT NULL,
    "pedidoId" INTEGER NOT NULL,
    "produtoId" INTEGER NOT NULL,
    "nota" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AvaliacaoProduto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AvaliacaoProduto_tenantId_idx" ON "AvaliacaoProduto"("tenantId");

-- CreateIndex
CREATE INDEX "AvaliacaoProduto_produtoId_idx" ON "AvaliacaoProduto"("produtoId");

-- CreateIndex
CREATE UNIQUE INDEX "AvaliacaoProduto_pedidoId_produtoId_key" ON "AvaliacaoProduto"("pedidoId", "produtoId");

-- AddForeignKey
ALTER TABLE "AvaliacaoProduto" ADD CONSTRAINT "AvaliacaoProduto_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvaliacaoProduto" ADD CONSTRAINT "AvaliacaoProduto_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvaliacaoProduto" ADD CONSTRAINT "AvaliacaoProduto_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
