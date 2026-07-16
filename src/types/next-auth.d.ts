import type { Role } from "@/generated/prisma/client"
import type { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface User {
    role: Role
    isSuperAdmin: boolean
  }

  interface Session {
    user: {
      id: string
      role: Role
      isSuperAdmin: boolean
    } & DefaultSession["user"]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: Role
    isSuperAdmin: boolean
  }
}
