import Link from "next/link"
import { ArrowRight } from "lucide-react"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card"
import { formatPriceWithSuffix } from "@/lib/format"
import type { PricingModel } from "@/generated/prisma/client"

export function ServiceCard({
  name,
  slug,
  description,
  basePricePence,
  pricingModel,
}: {
  name: string
  slug: string
  description: string
  basePricePence: number
  pricingModel: PricingModel
}) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle className="text-lg">{name}</CardTitle>
        <CardDescription className="line-clamp-3">{description}</CardDescription>
      </CardHeader>
      <CardContent className="mt-auto">
        <p className="text-2xl font-semibold text-primary">
          {formatPriceWithSuffix(basePricePence, pricingModel)}
        </p>
      </CardContent>
      <CardFooter>
        <Link
          href={`/services#${slug}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          Learn more <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </CardFooter>
    </Card>
  )
}
