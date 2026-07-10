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
    signIn({ user }) {
      // The Credentials provider already checks `active` in its `authorize()`
      // before returning a user, so this only matters for the Resend
      // magic-link provider — which otherwise has no way to block a banned
      // customer, since it never calls `authorize()`.
      if (user && "active" in user && user.active === false) return false
      return true
    },
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
