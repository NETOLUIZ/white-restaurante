/*
  Warnings:

  - You are about to drop the `_ProdutoAdicionais` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `produtoId` to the `Adicional` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "_ProdutoAdicionais" DROP CONSTRAINT "_ProdutoAdicionais_A_fkey";

-- DropForeignKey
ALTER TABLE "_ProdutoAdicionais" DROP CONSTRAINT "_ProdutoAdicionais_B_fkey";

-- AlterTable
ALTER TABLE "Adicional" ADD COLUMN     "produtoId" INTEGER NOT NULL;

-- DropTable
DROP TABLE "_ProdutoAdicionais";

-- CreateIndex
CREATE INDEX "Adicional_produtoId_idx" ON "Adicional"("produtoId");

-- AddForeignKey
ALTER TABLE "Adicional" ADD CONSTRAINT "Adicional_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
