import Link from "next/link";

// Rendered for notFound() (e.g. an unknown or malformed chart slug) and any
// unmatched URL.
export default function NotFound() {
  return (
    <div className="pt-12 text-center">
      <h1 className="font-display text-2xl font-semibold">Not found</h1>
      <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">
        That chart or page doesn&apos;t exist. Try searching for something instead.
      </p>
      <Link href="/" className="mt-4 inline-block text-sm text-blue-600 underline dark:text-blue-400">
        Back to search
      </Link>
    </div>
  );
}
