-- AlterTable
ALTER TABLE "Configuracao" ADD COLUMN "mercadoPagoAccessToken" TEXT;

-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN "pagamentoConfirmado" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "pagamentoExternoId" TEXT;
