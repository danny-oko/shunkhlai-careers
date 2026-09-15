"use client";

import * as React from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useReducedMotion } from "@/components/landing/use-scroll-progress";
import { cn } from "@/lib/utils";

export type WallItem = {
  title: string;
  /** Shown in the dialog. Absent while HR's copy for it is still to come. */
  body?: string;
  /** A real photograph, where there is one. Otherwise a placeholder is used. */
  image?: string;
  /**
   * A wide transparent lockup — a club's logo — instead of a photograph.
   *
   * It is artwork, not a picture of something, so it is drawn whole on a light
   * plate rather than cropped to fill the tile: a wordmark with its sides cut
   * off is no longer the mark. The plate is there for the dark theme, where
   * the navy half of every lockup would otherwise disappear into the ground.
   */
  logo?: string;
  /** A second line under the title in the dialog. */
  subtitle?: string;
  /** Set on the Academy voices — the person's job, under their name. */
  role?: string;
};

/**
 * The reference site ships its own numbers, and these are them: a sphere of
 * radius 250 carrying planes of 90, turned by the wheel at 2e-4 a tick under a
 * 0.94 friction and an 0.11 smoothing, with a slow turn of 0.001 left running
 * when nothing is touching it.
 *
 * What differs here is where the turn comes from. That site takes the wheel and
 * calls preventDefault on it, so the page cannot be scrolled past the sphere at
 * all; this one is a section of a longer page, so the turn is read off how far
 * the page has been scrolled through the section's own runway instead.
 */
/**
 * The sphere as shares of the stage it is given, not as pixels.
 *
 * Fixed at 540 it was drawn for a wide desktop and every screen below one was
 * wrong: on a laptop the outer tiles sat past the window, and on a phone they
 * were a screen and a half out either side. The stage is measured instead and
 * these are what the sphere takes of it — a third of the width across, a fifth
 * of the height up, and the depth matched to the width so the turn keeps its
 * roundness. The bounds stop a tall narrow stage from collapsing it and a very
 * wide one from throwing it past the page's own measure.
 */
const SPREAD = { x: 0.36, y: 0.2, z: 0.36 };
const BOUNDS = { x: [130, 540], y: [60, 200], z: [130, 540] } as const;

/** Tile width as a share of the sphere's own radius, after the reference. */
const TILE = 0.16;

/**
 * What a lockup tile takes of that instead.
 *
 * A photograph reads at a glance from any size; a wordmark has to be read, and
 * at the photograph's width these are about eighty pixels across with the name
 * set in a fifth of that. Wider, and shallow rather than portrait, because the
 * lockups are around five to one — a portrait tile would be mostly plate.
 */
const LOGO_TILE = 1.8;

/**
 * And never narrower than this, whatever the stage.
 *
 * The sphere is sized off the box it is given, and on a phone that box is a
 * quarter the width of a desktop one: the share above came out at 38px across,
 * which is a wordmark drawn at four pixels tall. A photograph survives being
 * small — it is still a picture of someone — so the walls that carry them
 * never needed a floor. A name that cannot be read is not a small name, it is
 * a blank, so these have one.
 */
const LOGO_MIN = 92;

const PERSPECTIVE = 1100;
/** How far it tips as it turns. Small: it is what swings tiles off the top. */
const TIP = 0.06;

/**
 * How much of the sphere's height the tiles are spread over, 1 being pole to
 * pole.
 *
 * Not 1, and this is the fix for two faults at once. A point at a pole sits on
 * the axis the sphere turns about, so it has no circle to travel — the first
 * and last tile stood still while the rest went round. And the poles are the
 * top and bottom of the shape, which is what was being cut off by the header
 * and the foot of the screen. Held to the middle three-quarters, every tile
 * keeps a travelling circle of at least 0.72 of the full one, and the whole
 * thing fits between the header and the bottom edge.
 */
const BAND = 0.75;

/** Kept turning when the scroll is still, as the reference's autoSpeed does. */
const IDLE = 0.05;
/** Share of the gap closed each frame — the reference's `smoothing`. */
const SMOOTHING = 0.11;
/** How many turns the sphere makes over the section's runway. */
const TURNS = 1.6;

/**
 * Points spread evenly over the band.
 *
 * The even spread is the whole trick: a random scatter clumps, and a clump on a
 * sphere reads as a mistake in the maths rather than as a composition. This is
 * the Fibonacci sphere — walk the height in equal steps and turn by the golden
 * angle at each one, and the points land at equal distances with no two ever in
 * a row.
 */
const spherePoints = (count: number) => {
  const golden = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: count }, (_, index) => {
    // The half-step keeps the first and last off the poles exactly; BAND then
    // holds the whole spread clear of them.
    const y = (1 - ((index + 0.5) / count) * 2) * BAND;
    const ring = Math.sqrt(Math.max(1 - y * y, 0));
    const theta = golden * index;
    return { x: Math.cos(theta) * ring, y, z: Math.sin(theta) * ring };
  });
};

/**
 * How each tile varies off that size, so the wall is not a grid of identical
 * stamps. These are the sizes at the sphere's middle; the perspective takes
 * them from about two thirds at the back to nearly twice at the front.
 */
const VARY = [0.95, 1.07, 0.86, 1.03, 0.9, 1.11, 0.99, 0.82, 1.05, 0.93];

const mock = (index: number) =>
  `/brand/mock-${String((index % 12) + 1).padStart(2, "0")}.jpg`;

const picture = (item: WallItem, index: number) => item.image ?? mock(index);

const PENDING = "Дэлгэрэнгүй мэдээлэл удахгүй нэмэгдэнэ.";

/**
 * Light in both themes: the lockups are drawn for a white ground.
 *
 * With the edge, which is not decoration — the page this sits on is white too,
 * so an unruled white plate has no outline at all and the wall reads as empty
 * until a logo happens to fall on something darker.
 */
const PLATE = "bg-white ring-1 ring-black/10";

/**
 * A tile's box on the sphere: how wide it is, and how it hangs off its point.
 *
 * Hung by half its own height, the point the frame loop puts it on is the
 * middle of the tile. A lockup is half as tall as it is wide; a photograph is
 * taller than wide and keeps the half-width drop the first two walls were
 * built with.
 */
const box = (item: WallItem, index: number, tile: number) => {
  const vary = VARY[index % VARY.length];
  const width = Math.round(
    vary * (item.logo ? Math.max(tile * LOGO_TILE, LOGO_MIN) : tile),
  );
  return {
    width,
    marginLeft: -width / 2,
    marginTop: item.logo ? -width / 4 : -width / 2,
  };
};

/**
 * The box an item's picture is drawn in — portrait and edge to edge for a
 * photograph, shallow and plated for a lockup.
 */
const frame = (item: WallItem) =>
  item.logo ? `aspect-[2/1] ${PLATE}` : "aspect-[3/4]";

/**
 * The picture itself, at whichever of the two treatments the item asks for.
 *
 * `pad` is the lockup's margin inside its plate and is ignored by a
 * photograph, which has none: it is cropped to the box on purpose.
 */
const Visual = ({
  item,
  index,
  sizes,
  pad,
}: {
  item: WallItem;
  index: number;
  sizes: string;
  pad: string;
}) => (
  <Image
    src={item.logo ?? picture(item, index)}
    alt=""
    aria-hidden
    fill
    sizes={sizes}
    className={item.logo ? `object-contain ${pad}` : "object-cover"}
  />
);

/**
 * What opens when a picture is picked.
 *
 * A voice — one of the Academy posters, which comes with a portrait, a job and
 * something the person said — is laid out across rather than down: the poster
 * on one side at the shape it was made in, the words beside it. Stacked, the
 * portrait ate the whole panel and pushed the quote below the fold, so the
 * thing you opened it for arrived last and in single file.
 *
 * Everything else has no portrait, so it keeps the plain stacked panel.
 */
function Details({
  item,
  index,
  onClose,
}: {
  item: WallItem | null;
  index: number;
  onClose: () => void;
}) {
  const voice = !!item?.role;

  return (
    <Dialog open={!!item} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        className={cn(
          "overflow-hidden p-0",
          voice ? "sm:max-w-2xl" : "sm:max-w-md",
        )}
      >
        {item && (
          <div className={cn(voice && "sm:grid sm:grid-cols-[minmax(0,17rem)_1fr]")}>
            <div
              className={cn(
                "relative",
                voice
                  ? "aspect-4/5 max-h-[42vh] sm:max-h-none"
                  : "aspect-16/10",
                item.logo && PLATE,
              )}
            >
              <Visual
                item={item}
                index={index}
                sizes="(max-width: 640px) 100vw, 272px"
                pad="p-8"
              />
            </div>

            <DialogHeader
              className={cn(
                "px-6 pt-1 pb-6",
                voice && "justify-center gap-0 px-7 py-8",
              )}
            >
              <DialogTitle className="text-lg">{item.title}</DialogTitle>

              {(item.role ?? item.subtitle) && (
                <DialogDescription className="mt-1 text-xs tracking-[0.08em] uppercase">
                  {item.role ?? item.subtitle}
                </DialogDescription>
              )}

              {item.role ? (
                <p className="mt-5 text-base leading-relaxed text-pretty">
                  {item.body}
                </p>
              ) : (
                <DialogDescription
                  className={cn(
                    "leading-relaxed text-pretty",
                    item.body || "text-muted-foreground/70 italic",
                  )}
                >
                  {item.body ?? PENDING}
                </DialogDescription>
              )}
            </DialogHeader>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function SphereGallery({
  items,
  /** 0 at the top of the section's runway, 1 at the end of it. */
  progress,
  className,
}: {
  items: WallItem[];
  progress: number;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const isReduced = useReducedMotion();
  const points = React.useMemo(
    () => spherePoints(items.length),
    [items.length],
  );
  const [opened, setOpened] = React.useState<number | null>(null);
  const [stage, setStage] = React.useState({ w: 0, h: 0 });
  const turn = React.useRef({ shown: 0, target: 0 });

  // The sphere is sized off the box it is given, so it is right on a phone and
  // on a 2560 screen without a breakpoint for either.
  React.useEffect(() => {
    const box = ref.current;
    if (!box || typeof ResizeObserver === "undefined") return;

    const watch = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setStage({ w: width, h: height });
    });
    watch.observe(box);
    return () => watch.disconnect();
  }, []);

  const hold = (value: number, [low, high]: readonly [number, number]) =>
    Math.min(Math.max(value, low), high);

  const radius = React.useMemo(
    () => ({
      x: hold(stage.w * SPREAD.x, BOUNDS.x),
      y: hold(stage.h * SPREAD.y, BOUNDS.y),
      z: hold(stage.w * SPREAD.z, BOUNDS.z),
    }),
    [stage.w, stage.h],
  );
  const tile = radius.x * TILE;

  // Read by the frame loop, so holding a tile does not restart it: the loop
  // closes over this ref once and checks it sixty times a second.
  const held = React.useRef(false);

  React.useEffect(() => {
    turn.current.target = progress * TURNS * Math.PI * 2;
  }, [progress]);

  React.useEffect(() => {
    held.current = opened !== null;
  }, [opened]);

  // Handed to the loop through a ref, so a window drag re-sizes the sphere
  // without tearing down and rebuilding the frame loop on every pixel.
  const scale = React.useRef(radius);

  React.useEffect(() => {
    scale.current = radius;
  }, [radius]);

  React.useEffect(() => {
    const box = ref.current;
    if (!box || isReduced) return;

    let frame = 0;
    let idle = 0;
    const tiles = [...box.children] as HTMLElement[];

    const draw = () => {
      const state = turn.current;

      // Held under the pointer — or with a picture open — the sphere stands
      // still: what is being looked at should not slide out from under the
      // look. The scroll keeps moving the target while it waits, and the
      // smoothing eases it back on once the hold is let go.
      if (!held.current) {
        idle += IDLE / 60;
        state.shown += (state.target + idle - state.shown) * SMOOTHING;
      }

      const ry = state.shown;
      const rx = Math.sin(state.shown * 0.5) * TIP;
      const cy = Math.cos(ry);
      const sy = Math.sin(ry);
      const cx = Math.cos(rx);
      const sx = Math.sin(rx);

      tiles.forEach((tile, index) => {
        const p = points[index];
        if (!p) return;
        const x = p.x * cy + p.z * sy;
        const zy = -p.x * sy + p.z * cy;
        const y = p.y * cx - zy * sx;
        const z = p.y * sx + zy * cx;

        // Translated only, never rotated, so every tile keeps facing the
        // reader; the perspective on the stage does the growing and shrinking.
        const r = scale.current;
        tile.style.transform = `translate3d(${(x * r.x).toFixed(1)}px, ${(y * r.y).toFixed(1)}px, ${(z * r.z).toFixed(1)}px)`;
        // The far side recedes, but only so far: on the white ground a tile at
        // a tenth of its colour is not a distant picture, it is a blank.
        tile.style.opacity = (0.45 + 0.55 * ((z + 1) / 2) ** 1.4).toFixed(3);
        tile.style.zIndex = String(Math.round((z + 1) * 500));
      });

      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [points, isReduced]);

  const details = (
    <Details
      item={opened === null ? null : items[opened]}
      index={opened ?? 0}
      onClose={() => setOpened(null)}
    />
  );

  if (isReduced) {
    return (
      <div className={cn("grid grid-cols-2 gap-5 sm:grid-cols-4", className)}>
        {items.map((item, index) => (
          <button
            key={item.title}
            type="button"
            onClick={() => setOpened(index)}
            className="text-left"
          >
            <span
              className={cn(
                "relative block overflow-hidden rounded-[3px]",
                frame(item),
              )}
            >
              <Visual
                item={item}
                index={index}
                sizes="(max-width: 640px) 45vw, 22vw"
                pad="p-[6%]"
              />
            </span>
            <span className="mt-2 block text-[0.6875rem] text-muted-foreground">
              {item.title}
            </span>
          </button>
        ))}
        {details}
      </div>
    );
  }

  return (
    <>
      {/* The sphere cannot be reached by keyboard and moves on its own, so it
          is decoration; these are the same pictures as buttons, opening the
          same dialog. */}
      <ul className="sr-only">
        {items.map((item, index) => (
          <li key={item.title}>
            <button type="button" onClick={() => setOpened(index)}>
              {item.title}
            </button>
          </li>
        ))}
      </ul>

      <div
        ref={ref}
        aria-hidden
        className={cn("relative", className)}
        style={{
          perspective: `${PERSPECTIVE}px`,
          transformStyle: "preserve-3d",
        }}
      >
        {items.map((item, index) => (
          <div
            key={item.title}
            onPointerEnter={() => {
              held.current = true;
            }}
            onPointerLeave={() => {
              held.current = opened !== null;
            }}
            onClick={() => setOpened(index)}
            className="group absolute top-1/2 left-1/2 cursor-pointer will-change-transform"
            style={box(item, index, tile)}
          >
            {/* The lift is on the inner box: the outer one's transform is
                rewritten every frame by the loop and would swallow it. */}
            <div
              className={cn(
                "relative overflow-hidden rounded-[3px] shadow-[0_10px_30px_-14px_rgb(0_0_0/0.4)] transition-[scale,box-shadow] duration-300 ease-out group-hover:scale-[1.08] group-hover:shadow-[0_22px_50px_-20px_rgb(0_0_0/0.5)]",
                frame(item),
              )}
            >
              <Visual
                item={item}
                index={index}
                sizes={item.logo ? "300px" : "160px"}
                pad="p-[6%]"
              />
            </div>

            {/* Under its own picture rather than at the foot of the stage:
                named where it is, the caption belongs to the tile the eye is
                already on. `top-full` keeps it out of the tile's own box, so
                it cannot push the picture off its point on the sphere. */}
            <p className="absolute inset-x-[-3rem] top-full mt-2 text-center text-[0.6875rem] leading-snug tracking-[0.04em] text-muted-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              {item.title}
            </p>
          </div>
        ))}
      </div>

      {details}
    </>
  );
}
