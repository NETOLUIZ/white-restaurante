-- AlterTable
ALTER TABLE "Configuracao" ADD COLUMN "whatsappInstancia" TEXT;
ALTER TABLE "Configuracao" ADD COLUMN "whatsappToken" TEXT;
ALTER TABLE "Configuracao" ADD COLUMN "whatsappConectado" BOOLEAN NOT NULL DEFAULT false;
