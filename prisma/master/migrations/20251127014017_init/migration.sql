/*
  Warnings:

  - Added the required column `nomeEmpresa` to the `Tenants` table without a default value. This is not possible if the table is not empty.
  - Added the required column `senha` to the `Tenants` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Clientes_Redirect" ALTER COLUMN "slug" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Tenants" ADD COLUMN     "nomeEmpresa" TEXT NOT NULL,
ADD COLUMN     "senha" TEXT NOT NULL;
