/*
  Warnings:

  - Added the required column `slug` to the `Usuarios_Redirect` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Usuarios_Redirect" ADD COLUMN     "slug" TEXT NOT NULL;
