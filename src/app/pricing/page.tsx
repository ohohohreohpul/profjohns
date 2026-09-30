import { Suspense } from "react";
import { PricingPageContent } from "@/components/billing/pricing-page-content";
import { PageLoader } from "@/components/brand/page-loader";

export const metadata = {
  title: "Pricing — ProfJohns",
  description: "Simple, honest pricing for ProfJohns. Free and Pro plans.",
};

export default function PricingPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <PricingPageContent />
    </Suspense>
  );
}