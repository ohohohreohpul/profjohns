import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";
import { PageLoader } from "@/components/brand/page-loader";

export default function SignupPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <AuthForm mode="signup" />
    </Suspense>
  );
}
