-- DropForeignKey
ALTER TABLE "ItemPedido" DROP CONSTRAINT "ItemPedido_tamanhoMarmitaId_fkey";

-- DropIndex
DROP INDEX "Admin_email_key";

-- DropIndex
DROP INDEX "Atendente_email_key";

-- DropIndex
DROP INDEX "CategoriaProduto_nome_key";

-- DropIndex
DROP INDEX "Cliente_telefone_key";

-- DropIndex
DROP INDEX "Cupom_codigo_key";

-- DropIndex
DROP INDEX "Empresa_login_key";

-- DropIndex
DROP INDEX "Entregador_email_key";

-- DropIndex
DROP INDEX "Garcom_email_key";

-- DropIndex
DROP INDEX "Mesa_numero_key";

-- DropIndex
DROP INDEX "Pedido_codigoAcompanhamento_key";

-- DropIndex
DROP INDEX "Subcategoria_categoriaId_nome_key";

-- AlterTable
ALTER TABLE "Adicional" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Admin" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Atendente" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Banner" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Caixa" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "CategoriaProduto" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Complemento" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
CREATE SEQUENCE configuracao_id_seq;
ALTER TABLE "Configuracao" ADD COLUMN     "tenantId" TEXT NOT NULL,
ALTER COLUMN "id" SET DEFAULT nextval('configuracao_id_seq');
ALTER SEQUENCE configuracao_id_seq OWNED BY "Configuracao"."id";

-- AlterTable
ALTER TABLE "Cupom" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Empresa" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Entregador" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Garcom" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ItemPedido" ADD COLUMN     "tenantId" TEXT NOT NULL,
DROP COLUMN "tamanhoMarmitaId",
ADD COLUMN     "tamanhoMarmitaId" INTEGER;

-- AlterTable
ALTER TABLE "Mesa" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Produto" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Proteina" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Subcategoria" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "TamanhoMarmita" DROP CONSTRAINT "TamanhoMarmita_pkey",
ADD COLUMN     "slug" TEXT NOT NULL,
ADD COLUMN     "tenantId" TEXT NOT NULL,
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "TamanhoMarmita_pkey" PRIMARY KEY ("id");

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "Adicional_tenantId_idx" ON "Adicional"("tenantId");

-- CreateIndex
CREATE INDEX "Admin_tenantId_idx" ON "Admin"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_tenantId_email_key" ON "Admin"("tenantId", "email");

-- CreateIndex
CREATE INDEX "Atendente_tenantId_idx" ON "Atendente"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Atendente_tenantId_email_key" ON "Atendente"("tenantId", "email");

-- CreateIndex
CREATE INDEX "Banner_tenantId_idx" ON "Banner"("tenantId");

-- CreateIndex
CREATE INDEX "Caixa_tenantId_idx" ON "Caixa"("tenantId");

-- CreateIndex
CREATE INDEX "CategoriaProduto_tenantId_idx" ON "CategoriaProduto"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "CategoriaProduto_tenantId_nome_key" ON "CategoriaProduto"("tenantId", "nome");

-- CreateIndex
CREATE INDEX "Cliente_tenantId_idx" ON "Cliente"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_tenantId_telefone_key" ON "Cliente"("tenantId", "telefone");

-- CreateIndex
CREATE INDEX "Complemento_tenantId_idx" ON "Complemento"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Configuracao_tenantId_key" ON "Configuracao"("tenantId");

-- CreateIndex
CREATE INDEX "Cupom_tenantId_idx" ON "Cupom"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Cupom_tenantId_codigo_key" ON "Cupom"("tenantId", "codigo");

-- CreateIndex
CREATE INDEX "Empresa_tenantId_idx" ON "Empresa"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Empresa_tenantId_login_key" ON "Empresa"("tenantId", "login");

-- CreateIndex
CREATE INDEX "Entregador_tenantId_idx" ON "Entregador"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Entregador_tenantId_email_key" ON "Entregador"("tenantId", "email");

-- CreateIndex
CREATE INDEX "Garcom_tenantId_idx" ON "Garcom"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Garcom_tenantId_email_key" ON "Garcom"("tenantId", "email");

-- CreateIndex
CREATE INDEX "ItemPedido_tenantId_idx" ON "ItemPedido"("tenantId");

-- CreateIndex
CREATE INDEX "Mesa_tenantId_idx" ON "Mesa"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Mesa_tenantId_numero_key" ON "Mesa"("tenantId", "numero");

-- CreateIndex
CREATE INDEX "Pedido_tenantId_idx" ON "Pedido"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Pedido_tenantId_codigoAcompanhamento_key" ON "Pedido"("tenantId", "codigoAcompanhamento");

-- CreateIndex
CREATE INDEX "Produto_tenantId_idx" ON "Produto"("tenantId");

-- CreateIndex
CREATE INDEX "Proteina_tenantId_idx" ON "Proteina"("tenantId");

-- CreateIndex
CREATE INDEX "Subcategoria_tenantId_idx" ON "Subcategoria"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Subcategoria_tenantId_categoriaId_nome_key" ON "Subcategoria"("tenantId", "categoriaId", "nome");

-- CreateIndex
CREATE INDEX "TamanhoMarmita_tenantId_idx" ON "TamanhoMarmita"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TamanhoMarmita_tenantId_slug_key" ON "TamanhoMarmita"("tenantId", "slug");

-- AddForeignKey
ALTER TABLE "Configuracao" ADD CONSTRAINT "Configuracao_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admin" ADD CONSTRAINT "Admin_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Garcom" ADD CONSTRAINT "Garcom_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Atendente" ADD CONSTRAINT "Atendente_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoriaProduto" ADD CONSTRAINT "CategoriaProduto_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subcategoria" ADD CONSTRAINT "Subcategoria_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Produto" ADD CONSTRAINT "Produto_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Adicional" ADD CONSTRAINT "Adicional_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cupom" ADD CONSTRAINT "Cupom_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemPedido" ADD CONSTRAINT "ItemPedido_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemPedido" ADD CONSTRAINT "ItemPedido_tamanhoMarmitaId_fkey" FOREIGN KEY ("tamanhoMarmitaId") REFERENCES "TamanhoMarmita"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proteina" ADD CONSTRAINT "Proteina_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complemento" ADD CONSTRAINT "Complemento_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TamanhoMarmita" ADD CONSTRAINT "TamanhoMarmita_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Banner" ADD CONSTRAINT "Banner_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mesa" ADD CONSTRAINT "Mesa_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Caixa" ADD CONSTRAINT "Caixa_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Empresa" ADD CONSTRAINT "Empresa_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entregador" ADD CONSTRAINT "Entregador_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

