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
        token.isSuperAdmin = user.isSuperAdmin ?? false
        token.forename = user.forename
        token.surname = user.surname
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as Role
        session.user.id = token.id as string
        session.user.isSuperAdmin = (token.isSuperAdmin as boolean) ?? false
        session.user.forename = token.forename as string
        session.user.surname = token.surname as string
        // `name` no longer exists on the User model (split into
        // forename/surname), but NextAuth's own DefaultSession["user"] still
        // declares it, and a good number of call sites across the app still
        // read session.user.name expecting a display name (portal/staff/admin
        // layout headers, the portal welcome message, several audit-log
        // entries). Rather than touching every one of those, keep `name`
        // populated here as a derived field so they keep working.
        session.user.name = `${token.forename ?? ""} ${token.surname ?? ""}`.trim() || null
      }
      return session
    },
  },
  providers: [],
} satisfies NextAuthConfig
