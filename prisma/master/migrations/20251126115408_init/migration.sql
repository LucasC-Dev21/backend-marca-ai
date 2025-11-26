/*
  Warnings:

  - You are about to drop the column `sufixo` on the `Tenants` table. All the data in the column will be lost.
  - You are about to drop the `Usuarios_Redirect` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Usuarios_Redirect" DROP CONSTRAINT "Usuarios_Redirect_tenantId_fkey";

-- DropIndex
DROP INDEX "Tenants_sufixo_key";

-- AlterTable
ALTER TABLE "Tenants" DROP COLUMN "sufixo",
ADD COLUMN     "telefone" TEXT;

-- DropTable
DROP TABLE "Usuarios_Redirect";

-- CreateTable
CREATE TABLE "Clientes_Redirect" (
    "userId" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "dbName" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Clientes_Redirect_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Clientes_Redirect_email_key" ON "Clientes_Redirect"("email");

-- AddForeignKey
ALTER TABLE "Clientes_Redirect" ADD CONSTRAINT "Clientes_Redirect_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
