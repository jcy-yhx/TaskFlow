-- Step 1: Add column as nullable first
ALTER TABLE "Workspace" ADD COLUMN "joinCode" TEXT;

-- Step 2: Generate unique join codes for existing rows
UPDATE "Workspace" SET "joinCode" = upper(substring(md5(random()::text || id::text) from 1 for 8)) WHERE "joinCode" IS NULL;

-- Step 3: Make it NOT NULL and UNIQUE
ALTER TABLE "Workspace" ALTER COLUMN "joinCode" SET NOT NULL;
CREATE UNIQUE INDEX "Workspace_joinCode_key" ON "Workspace"("joinCode");
