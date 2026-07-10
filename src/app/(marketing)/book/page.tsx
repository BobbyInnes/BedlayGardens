import type { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Book a Stay",
  description: "Online booking for Bedlay Gardens Kennels is coming soon.",
}

export default function BookPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        Online booking is coming soon
      </h1>
      <p className="mt-4 text-muted-foreground">
        We&rsquo;re putting the finishing touches on live availability and online
        payment. In the meantime, get in touch and we&rsquo;ll help you book a stay
        directly.
      </p>
      <Button className="mt-8" asChild>
        <Link href="/contact">Contact us to book</Link>
      </Button>
    </div>
  )
}
