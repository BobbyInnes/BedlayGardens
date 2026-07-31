// Template for one-off scripts that fix data directly against the database
// (skipping admin actions, so nothing would otherwise land in the audit
// log). Copy this file, rename it, make your change, call logAdhocFix once
// per logical operation (not per row), run it, then delete your copy — the
// audit log entry is the permanent record, the script itself is disposable.
//
// Run with: npx tsx --env-file=.env scripts/your-copy.ts
import { PrismaNeon } from "@prisma/adapter-neon"
import { PrismaClient } from "@/generated/prisma/client"
import { logAdhocFix } from "@/lib/audit"

async function main() {
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL })
  const prisma = new PrismaClient({ adapter })

  // 1. Make the change.
  // const before = await prisma.someModel.findUnique({ where: { id } })
  // const after = await prisma.someModel.update({ where: { id }, data: { ... } })

  // 2. Log it — capture as much as you reasonably have on hand: what changed,
  //    why, the before/after state, and every affected id.
  await logAdhocFix({
    entity: "SomeModel",
    entityId: "id-of-the-primary-record-affected",
    summary: "One-line description of what this script did",
    reason: "Why this was needed — the prompt/incident/decision that triggered it",
    before: { example: "value before" },
    after: { example: "value after" },
    affectedIds: ["id1", "id2"],
    source: "scripts/your-copy.ts, run interactively via Claude Code",
  })

  await prisma.$disconnect()
}

main()
