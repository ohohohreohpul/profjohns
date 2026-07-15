import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";
import { PageLoader } from "@/components/brand/page-loader";

export default function LoginPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <AuthForm mode="login" />
    </Suspense>
  );
}
