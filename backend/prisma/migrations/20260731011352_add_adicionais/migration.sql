-- CreateTable
CREATE TABLE "Adicional" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "preco" DOUBLE PRECISION NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "esgotado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Adicional_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemPedidoAdicional" (
    "id" SERIAL NOT NULL,
    "itemPedidoId" INTEGER NOT NULL,
    "adicionalId" INTEGER NOT NULL,
    "quantidade" INTEGER NOT NULL DEFAULT 1,
    "precoUnitarioCongelado" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ItemPedidoAdicional_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ProdutoAdicionais" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_ProdutoAdicionais_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "ItemPedidoAdicional_itemPedidoId_idx" ON "ItemPedidoAdicional"("itemPedidoId");

-- CreateIndex
CREATE INDEX "_ProdutoAdicionais_B_index" ON "_ProdutoAdicionais"("B");

-- AddForeignKey
ALTER TABLE "ItemPedidoAdicional" ADD CONSTRAINT "ItemPedidoAdicional_itemPedidoId_fkey" FOREIGN KEY ("itemPedidoId") REFERENCES "ItemPedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemPedidoAdicional" ADD CONSTRAINT "ItemPedidoAdicional_adicionalId_fkey" FOREIGN KEY ("adicionalId") REFERENCES "Adicional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProdutoAdicionais" ADD CONSTRAINT "_ProdutoAdicionais_A_fkey" FOREIGN KEY ("A") REFERENCES "Adicional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProdutoAdicionais" ADD CONSTRAINT "_ProdutoAdicionais_B_fkey" FOREIGN KEY ("B") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
