import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-grey-50 px-6">
      <div className="w-full max-w-sm text-center">
        <h1 className="mb-2 text-xl font-semibold tracking-tight text-ink">
          Page not found
        </h1>
        <p className="mb-6 text-[13px] text-grey-500">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/canvas"
          className="inline-block rounded-xl bg-ink px-4 py-2.5 text-[13.5px] font-semibold text-paper transition-colors hover:bg-grey-800"
        >
          Go to workspace
        </Link>
      </div>
    </div>
  );
}
