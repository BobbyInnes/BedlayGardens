"use client"

import { useActionState, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { loginWithPassword, loginWithMagicLink, type LoginState } from "@/app/(marketing)/login/actions"

const initialState: LoginState = { status: "idle" }

export function LoginForm() {
  const [passwordState, passwordAction, passwordPending] = useActionState(
    loginWithPassword,
    initialState
  )
  const [magicLinkState, magicLinkAction, magicLinkPending] = useActionState(
    loginWithMagicLink,
    initialState
  )
  const [tab, setTab] = useState("password")

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [magicEmail, setMagicEmail] = useState("")

  // On a failed login, clear only the password — keep the email so the
  // customer doesn't have to retype it while they fix their password.
  // Adjusted during render (React's recommended pattern for this) rather
  // than in an effect, by comparing against the previously seen state.
  const [seenPasswordState, setSeenPasswordState] = useState(passwordState)
  if (passwordState !== seenPasswordState) {
    setSeenPasswordState(passwordState)
    if (passwordState.status === "error") {
      setPassword("")
    }
  }

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="w-full">
        <TabsTrigger value="password" className="flex-1">
          Password
        </TabsTrigger>
        <TabsTrigger value="magic-link" className="flex-1">
          Email link
        </TabsTrigger>
      </TabsList>

      <TabsContent value="password" className="mt-6">
        <form action={passwordAction} className="space-y-5" autoComplete="off">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={passwordPending} className="w-full">
            {passwordPending ? "Logging in…" : "Log in"}
          </Button>
          {passwordState.status === "error" && (
            <p className="text-sm text-destructive" role="alert">
              {passwordState.message}
            </p>
          )}
        </form>
      </TabsContent>

      <TabsContent value="magic-link" className="mt-6">
        <form action={magicLinkAction} className="space-y-5" autoComplete="off">
          <div className="space-y-2">
            <Label htmlFor="magic-email">Email</Label>
            <Input
              id="magic-email"
              name="email"
              type="email"
              required
              autoComplete="off"
              value={magicEmail}
              onChange={(e) => setMagicEmail(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={magicLinkPending} className="w-full">
            {magicLinkPending ? "Sending…" : "Email me a sign-in link"}
          </Button>
          {magicLinkState.status === "error" && (
            <p className="text-sm text-destructive" role="alert">
              {magicLinkState.message}
            </p>
          )}
          {magicLinkState.status === "success" && (
            <p className="text-sm font-medium text-primary" role="status">
              Check your email for a sign-in link.
            </p>
          )}
        </form>
      </TabsContent>
    </Tabs>
  )
}
