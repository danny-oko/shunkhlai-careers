import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * Scoped to `/news/**`, so a mistyped slug lands on the newsroom's own paper
 * rather than on the site-wide 404.
 */
export default function NewsNotFound() {
  return (
    <main
      data-newsroom
      className="flex flex-1 items-center bg-background pt-16 text-foreground"
    >
      <div className="mx-auto w-full max-w-6xl px-6 py-24 lg:px-10">
        <div className="border-y border-border py-16 text-center">
          <p className="news-kicker">404</p>
          <h1 className="news-headline mt-4 text-3xl sm:text-4xl">
            Мэдээ олдсонгүй
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
            Хаяг буруу бичигдсэн эсвэл мэдээ хасагдсан байж магадгүй.
          </p>
          <Link
            href="/news"
            className="mt-7 inline-flex items-center gap-1.5 text-[0.6875rem] font-semibold tracking-[0.14em] uppercase focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            style={{ color: "var(--paper-accent)" }}
          >
            <ArrowLeft aria-hidden className="size-3.5" />
            Бүх мэдээ
          </Link>
        </div>
      </div>
    </main>
  );
}
