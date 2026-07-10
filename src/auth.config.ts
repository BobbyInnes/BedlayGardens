import type { NextAuthConfig } from "next-auth"
import type { Role } from "@/generated/prisma/client"

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user
      const { pathname } = request.nextUrl

      const isPortal = pathname.startsWith("/portal")
      const isStaff = pathname.startsWith("/staff")
      const isAdmin = pathname.startsWith("/admin")

      if (isAdmin) return isLoggedIn && auth.user.role === "ADMIN"
      if (isStaff)
        return isLoggedIn && (auth.user.role === "STAFF" || auth.user.role === "ADMIN")
      if (isPortal) return isLoggedIn

      return true
    },
    jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.id = user.id
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as Role
        session.user.id = token.id as string
      }
      return session
    },
  },
  providers: [],
} satisfies NextAuthConfig
