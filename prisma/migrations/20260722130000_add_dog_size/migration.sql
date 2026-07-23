-- CreateEnum
CREATE TYPE "DogSize" AS ENUM ('MINIATURE', 'SMALL', 'MEDIUM', 'LARGE', 'GIANT');

-- AlterTable
ALTER TABLE "Dog" ADD COLUMN     "size" "DogSize";
