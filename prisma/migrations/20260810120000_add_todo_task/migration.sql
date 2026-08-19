-- CreateTable
CREATE TABLE "ToDoTask" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "assignedToId" TEXT,
    "createdById" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToDoTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ToDoTask_assignedToId_idx" ON "ToDoTask"("assignedToId");

-- CreateIndex
CREATE INDEX "ToDoTask_completed_idx" ON "ToDoTask"("completed");

-- AddForeignKey
ALTER TABLE "ToDoTask" ADD CONSTRAINT "ToDoTask_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToDoTask" ADD CONSTRAINT "ToDoTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
