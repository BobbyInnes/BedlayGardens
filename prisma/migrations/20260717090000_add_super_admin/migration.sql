-- AlterTable
-- Uses IF NOT EXISTS defensively: an earlier, since-reverted attempt at this
-- same column may or may not have already been applied to this database, and
-- this makes the migration safe to run either way rather than risking a
-- drift-resolution reset.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false;
