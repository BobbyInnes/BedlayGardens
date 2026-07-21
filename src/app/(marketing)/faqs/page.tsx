import type { Metadata } from "next"
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion"
import { prisma } from "@/lib/prisma"

export const metadata: Metadata = {
  title: "FAQs",
  description: "Frequently asked questions about boarding, daycare, and dog walking at Bedlay Gardens LTD.",
}

export const revalidate = 60

export default async function FaqsPage() {
  const faqs = await prisma.faq.findMany({ orderBy: { sortOrder: "asc" } })

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Frequently Asked Questions
        </h1>
      </div>

      {faqs.length > 0 ? (
        <>
          <h2 className="sr-only">Questions</h2>
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq) => (
              <AccordionItem key={faq.id} value={faq.id}>
                <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
                <AccordionContent>{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </>
      ) : (
        <p className="text-center text-muted-foreground">No FAQs yet.</p>
      )}
    </div>
  )
}
