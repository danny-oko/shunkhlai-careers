import Link from "next/link";

import { GradientRule } from "@/components/brand/gradient-rule";

const columns = [
  {
    title: "Карьер",
    links: [
      { href: "/careers", label: "Нээлттэй ажлын байр" },
      { href: "/about", label: "Бидний тухай" },
      { href: "/about#academy", label: "Сургалт, хөгжил" },
      { href: "/about#benefits", label: "Хөнгөлөлт, хангамж" },
    ],
  },
  {
    title: "Компани",
    links: [
      { href: "/about#history", label: "Бидний түүх" },
      { href: "/about#values", label: "Үнэт зүйл" },
      { href: "/about#life", label: "Ажилтны түүх" },
      { href: "/about#clubs", label: "Хобби клубууд" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border/70 bg-secondary/40">
      <div className="mx-auto max-w-6xl px-6 py-14 lg:px-10">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <p className="text-lg font-semibold tracking-[-0.02em]">
              Шунхлай ХХК
            </p>
            <GradientRule className="mt-4 max-w-[5rem] rounded-full" />
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Хөдөлмөр — хөгжлийн хөдөлгүүр. 1993 оноос хойш Монгол улсын
              эрчим хүч, логистикийн дэд бүтцийг бүтээж байна.
            </p>
          </div>

          {columns.map((column) => (
            <div key={column.title}>
              <p className="text-[0.8125rem] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                {column.title}
              </p>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-brand"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-border/70 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Шунхлай ХХК
          </p>
          <p className="text-sm text-muted-foreground">
            Капитал Хаус, Чингисийн өргөн чөлөө 48/1, Улаанбаатар
          </p>
        </div>
      </div>
    </footer>
  );
}
