import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import Credentials from "next-auth/providers/credentials"
import Resend from "next-auth/providers/resend"
import bcrypt from "bcryptjs"

import { authConfig } from "@/auth.config"
import { prisma } from "@/lib/prisma"
import { logAudit } from "@/lib/audit"

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email
        const password = credentials?.password
        if (typeof email !== "string" || typeof password !== "string") {
          return null
        }

        const user = await prisma.user.findUnique({ where: { email } })
        if (!user || !user.passwordHash || !user.active) return null

        const passwordValid = await bcrypt.compare(password, user.passwordHash)
        if (!passwordValid) return null

        return {
          id: user.id,
          email: user.email,
          forename: user.forename,
          surname: user.surname,
          role: user.role,
          isSuperAdmin: user.isSuperAdmin,
        }
      },
    }),
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.EMAIL_FROM ?? "Bedlay Gardens <onboarding@resend.dev>",
    }),
  ],
  events: {
    async signIn({ user, account }) {
      if (!user.id) return
      await logAudit({
        actorId: user.id,
        action: "LOGIN",
        entity: "User",
        entityId: user.id,
        meta: `Logged in via ${account?.provider === "resend" ? "email link" : "password"}`,
      })
    },
  },
})
