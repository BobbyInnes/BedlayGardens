import { LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { signOutAction } from "@/app/portal/actions"

export function LogoutButton() {
  return (
    <form action={signOutAction}>
      <Button type="submit" variant="ghost" size="sm" className="gap-1.5">
        <LogOut className="size-4" aria-hidden="true" />
        Log out
      </Button>
    </form>
  )
}
