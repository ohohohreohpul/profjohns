"use client";

import { Suspense } from "react";
import { DocEditor } from "@/components/home/doc-editor";
import { PageLoader } from "@/components/brand/page-loader";

export default function DocPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <DocEditor />
    </Suspense>
  );
}
