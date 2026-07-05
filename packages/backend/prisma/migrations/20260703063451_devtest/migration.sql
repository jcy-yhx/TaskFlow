/*
  Warnings:

  - You are about to drop the column `searchVector` on the `Task` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Task_searchVector_idx";

-- AlterTable
ALTER TABLE "Task" DROP COLUMN "searchVector";
