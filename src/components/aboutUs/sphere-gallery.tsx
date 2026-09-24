"use client";

import * as React from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
   * Every photograph the item came with, where HR sent more than one - a club
   * with three pictures of itself, a benefit laid out beside four.
   *
   * The first is the one the wall shows; the dialog gives the whole run as a
   * strip you push sideways. Use it instead of `image`, not beside it.
   */
  images?: string[];
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
  /**
   * A person's job, set under their name in the dialog, which lays the panel
   * out across rather than down when it is there.
   *
   * Nothing sets it at the moment: the Academy posters were the only wall that
   * did, and they have been taken out. Kept because the layout it asks for is
   * the right one for any wall of people, and rebuilding it would cost more
   * than carrying it.
   */
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

/**
 * Tile width as a share of the sphere's own radius.
 *
 * The reference's own figure was 0.16, and on this page that drew a wall of
 * pictures too small to see what they were of: at the widest stage the sphere
 * is held to a 540 radius, so every photograph sat at 86px across the middle
 * of the turn before the perspective took the back ones down to sixty. Raised
 * so a tile is read as a photograph rather than a swatch. The spread is
 * untouched - the sphere is the same size, the things on it are bigger.
 */
const TILE = 0.22;

/**
 * And never narrower than this, for the same reason the lockups have a floor.
 *
 * The share above is the reference's, and the reference is a desktop: it is
 * taken of a radius that is itself already held at `BOUNDS.x`, so on a phone
 * the two floors compound. A 390 screen gives the stage 342, the radius comes
 * out at 123 and is held up to 130, and 22% of that is a picture of a person
 * 29 pixels across - front tiles about 58, back ones 19. What the wall reads
 * as at that size is not a wall of photographs, it is confetti: twelve specks
 * scattered over an empty screen, which is what a phone had been showing.
 *
 * The note under LOGO_MIN says a photograph survives being small because it is
 * still a picture of someone. That holds down to a point, and 29px is well
 * under it. At the floor below, the same phone draws the front of the sphere
 * at about 128px and the back at 43, which is a wall.
 */
const TILE_MIN = 64;

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
const LOGO_MIN = 116;

const PERSPECTIVE = 1100;

/**
 * How much bigger than its own box the stage draws a tile, at the most.
 *
 * `sizes` is the one thing on an <Image> that has to be told the truth, and
 * on this wall the truth is not the box: a tile at the front of the turn sits
 * a whole radius nearer the reader than the middle of the sphere, and the
 * perspective draws it at P/(P-r) - 1.89 with the numbers above, since the
 * radius is held at very nearly half the perspective at every stage this is
 * shown on. The hover takes it 8% further again, and the hover is exactly
 * when someone is looking closely at one.
 */
const FRONT = 2.05;

/**
 * And how much of a photograph is cut away before it is drawn.
 *
 * The tiles are 3:4 portraits and almost every picture HR sent is landscape,
 * so `object-cover` fills the box out of the middle of the frame and throws
 * the sides away. The widest of them are 16:9: what covers a 3:4 box is
 * (16/9)/(3/4) times as wide as the box, and the rest of the file is never
 * seen. Sized for that worst case - a portrait original asks for more than it
 * needs, but the optimiser never serves past a file's own width, and none of
 * these is over 1200.
 *
 * The two together are what was missing. `sizes` said 160px, so the browser
 * took a 384px file, and the front of the sphere drew it across 713 device
 * pixels on a 2560 screen - a picture at half the resolution it was being
 * shown at, which is what reads as a bad photograph rather than as a small
 * one.
 */
const COVER = (16 / 9) / (3 / 4);

/** What one tile asks the optimiser for, in CSS pixels. */
const demand = (width: number, logo: boolean) =>
  // A lockup is `object-contain` on its own plate, so nothing is cut off it
  // and the box is the whole of it.
  `${Math.round(width * FRONT * (logo ? 1 : COVER))}px`;

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
 * One frame of the turn.
 *
 * A hold pauses the drift and nothing else. It used to stop the sphere dead,
 * and that was a trap rather than a feature: the tiles move, so one slides
 * under a pointer that has not gone anywhere, the sphere stops, and the tile
 * that stopped it is now pinned under the pointer for good - the only thing
 * that could have carried it away was the turn. Scrolling did nothing, the
 * wall sat frozen, and the moment the pointer moved off, every turn the
 * scroll had banked up in the meantime was spent at once and the wall took
 * off. What was meant as "this is being looked at" read as a wall that jams
 * and then bolts.
 *
 * Following the target through a hold fixes both ends of it. There is nothing
 * left to bank, so there is nothing to spend; and a reader who is scrolling
 * always sees the wall move, so a tile cannot pin itself. What the hold still
 * does is exactly what it is for: with the scroll settled the target stops
 * moving, the drift is paused, and the sphere stands still under the pointer
 * for as long as it is being read.
 *
 * Exported for the test beside it, which is about the banking rather than
 * about any one frame.
 */
export function turnStep(
  state: { shown: number; idle: number },
  target: number,
  held: boolean,
) {
  const idle = held ? state.idle : state.idle + IDLE / 60;
  return {
    idle,
    shown: state.shown + (target + idle - state.shown) * SMOOTHING,
  };
}

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

/** An item's photographs, in order. Empty when it has none of its own. */
const photos = (item: WallItem) =>
  item.images ?? (item.image ? [item.image] : []);

/** The one the wall shows, standing in with a placeholder where there is none. */
const picture = (item: WallItem, index: number) => photos(item)[0] ?? mock(index);

const PENDING = "Дэлгэрэнгүй мэдээлэл удахгүй нэмэгдэнэ.";

/**
 * The dialog's picture column.
 *
 * `sm:max-w-md` is 28rem, and above 1440 the page scales its own root with the
 * window - so on a 2560 screen that column is nearer 800px than 448. A rem
 * here would not catch it: lengths in `sizes` resolve against the browser's
 * initial font size, as they do in a media query, not against the root the
 * page has set.
 */
const DIALOG_SIZES =
  "(max-width: 640px) 100vw, (min-width: 1440px) 900px, 448px";

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
const box = (item: WallItem, index: number, tile: number, unit: number) => {
  const vary = VARY[index % VARY.length];
  const width = Math.round(
    vary * (item.logo ? Math.max(tile * LOGO_TILE, LOGO_MIN * unit) : tile),
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
 * One photograph in the dialog, whole.
 *
 * A run can hold a portrait poster and a wide group shot one after the other,
 * so the frame cannot be the shape of either and cropping to it took the head
 * off the portraits. The picture is contained instead, and a blurred, enlarged
 * copy of itself fills whatever the contain leaves over, so nothing is cut and
 * the panel still has a ground rather than two grey bars.
 *
 * Both draw the same file, so the second costs a paint and not a download.
 */
const Photo = ({ src, sizes }: { src: string; sizes: string }) => (
  <>
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      <Image
        src={src}
        alt=""
        fill
        sizes={sizes}
        // Over-scaled so the blur's own soft edge stays outside the frame.
        className="scale-125 object-cover blur-2xl"
      />
    </div>
    <Image src={src} alt="" aria-hidden fill sizes={sizes} className="object-contain" />
  </>
);

/**
 * The item's photographs, as a strip you push sideways.
 *
 * A native scroll container with snap points rather than a carousel library:
 * a swipe on a phone, a two-finger push on a trackpad and the arrow keys all
 * already do the right thing to one, and what is under the middle is read
 * back off `scrollLeft` instead of being state the gestures have to report.
 * The arrows are for a mouse, which is the one pointer that cannot push.
 *
 * The pictures stay `aria-hidden` as they are everywhere else on the wall -
 * the title and the words beside them carry the meaning - so what a screen
 * reader gets here is the count, not five unlabelled images.
 */
function PhotoRun({ shots, sizes }: { shots: string[]; sizes: string }) {
  const stripRef = React.useRef<HTMLDivElement>(null);
  const [at, setAt] = React.useState(0);

  const go = (to: number) => {
    const strip = stripRef.current;
    if (!strip) return;
    const target = Math.min(Math.max(to, 0), shots.length - 1);
    strip.scrollTo({ left: target * strip.clientWidth, behavior: "smooth" });
  };

  return (
    <div
      role="group"
      aria-label={`${shots.length} зураг`}
      className="absolute inset-0"
    >
      <div
        ref={stripRef}
        tabIndex={0}
        // Read the position off the scroll rather than tracking the gesture,
        // so a flick that lands between two snap points still reports the one
        // it settles on.
        onScroll={(event) => {
          const strip = event.currentTarget;
          setAt(Math.round(strip.scrollLeft / strip.clientWidth));
        }}
        className="flex size-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain outline-none [-ms-overflow-style:none] [scrollbar-width:none] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset [&::-webkit-scrollbar]:hidden"
      >
        {shots.map((src) => (
          <div
            key={src}
            className="relative size-full shrink-0 snap-center overflow-hidden"
          >
            <Photo src={src} sizes={sizes} />
          </div>
        ))}
      </div>

      {/* Held off the picture by a scrim rather than a plate: these sit over
          photographs we do not choose, so a bare glyph can land on anything. */}
      {[
        { at: 0, to: at - 1, Icon: ChevronLeft, label: "Өмнөх зураг", side: "left-2" },
        { at: shots.length - 1, to: at + 1, Icon: ChevronRight, label: "Дараах зураг", side: "right-2" },
      ].map(({ at: edge, to, Icon, label, side }) => (
        <button
          key={label}
          type="button"
          onClick={() => go(to)}
          aria-label={label}
          disabled={at === edge}
          className={cn(
            "absolute top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-opacity duration-200 outline-none hover:bg-black/65 focus-visible:ring-2 focus-visible:ring-white disabled:pointer-events-none disabled:opacity-0 motion-reduce:transition-none",
            side,
          )}
        >
          <Icon className="size-4" />
        </button>
      ))}

      <ol className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
        {shots.map((src, index) => (
          <li key={src}>
            <button
              type="button"
              onClick={() => go(index)}
              aria-label={`${index + 1}-р зураг`}
              aria-current={index === at ? "true" : undefined}
              // 6px of mark, with the finger's worth of padding around it.
              className="group -m-1 block rounded-full p-1 outline-none"
            >
              <span
                className={cn(
                  "block size-1.5 rounded-full ring-1 ring-black/20 transition-colors duration-200 group-focus-visible:ring-2 group-focus-visible:ring-white motion-reduce:transition-none",
                  index === at ? "bg-white" : "bg-white/45 group-hover:bg-white/75",
                )}
              />
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

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

  // A club carries both: the lockup, which is what names it on the wall, and a
  // photograph of the club at something it actually did. On the tile the
  // wordmark has to win - at that size a group photograph is a smudge and the
  // wall would no longer say which club is which - but in the dialog the
  // picture does, because the name has already been read on the way in and is
  // set again in the title beside it. Dropping `logo` is what says so: the
  // panel then frames and plates a photograph exactly as the other walls do.
  //
  // Where HR sent more than one, all of them are here rather than only the
  // one the wall had room for - see <PhotoRun>.
  const shots = item ? photos(item) : [];
  const art = item && shots.length ? { ...item, logo: undefined } : item;

  return (
    <Dialog open={!!item} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        className={cn(
          "overflow-hidden p-0",
          voice ? "sm:max-w-2xl" : "sm:max-w-md",
        )}
      >
        {item && art && (
          <div className={cn(voice && "sm:grid sm:grid-cols-[minmax(0,17rem)_1fr]")}>
            <div
              className={cn(
                "relative overflow-hidden",
                voice
                  ? "aspect-4/5 max-h-[42vh] sm:max-h-none"
                  : // A lockup is drawn to its own shallow plate. A photograph
                    // gets a square, which is the one frame that treats a
                    // portrait and a wide group shot about equally - a run can
                    // hold both, and 16/10 left the portraits tiny.
                    art.logo
                    ? `aspect-16/10 ${PLATE}`
                    : "aspect-square",
              )}
            >
              {art.logo ? (
                <Visual
                  item={art}
                  index={index}
                  sizes={DIALOG_SIZES}
                  pad="p-8"
                />
              ) : shots.length > 1 ? (
                <PhotoRun
                  shots={shots}
                  sizes={DIALOG_SIZES}
                />
              ) : (
                <Photo
                  src={shots[0] ?? mock(index)}
                  sizes={DIALOG_SIZES}
                />
              )}
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
  /** 0 at the top of the turning, 1 at the end of it. */
  progress,
  /**
   * The gathering, from 0 to 1.
   *
   * Past the turning the wall has been all the way round and there is nothing
   * left for it to show. Rather than leave it turning under whatever comes
   * next, every tile is drawn home to the middle of the stage, shrinking and
   * fading as it goes, so the wall ends by becoming one point that the section
   * can put its own mark on.
   *
   * It is spent on the positions the loop already computes - each one scaled
   * toward the centre - so the sphere keeps turning while it closes and the
   * two movements are one movement.
   */
  gather = 0,
  className,
}: {
  items: WallItem[];
  progress: number;
  gather?: number;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const isReduced = useReducedMotion();
  const points = React.useMemo(
    () => spherePoints(items.length),
    [items.length],
  );
  const [opened, setOpened] = React.useState<number | null>(null);
  // The stage's box, and the unit the design is drawn in.
  //
  // Every floor and ceiling below is a pixel figure taken against a 16px root,
  // and above 1440 the page scales that root with the window (see the block at
  // the top of globals.css). Measured here as a ratio, so a 2560 or a 4K screen
  // gets a sphere and tiles the same share of the window a 1440 one gets rather
  // than the same number of pixels, which is what left the wall reading as
  // confetti on a big monitor.
  const [stage, setStage] = React.useState({ w: 0, h: 0, unit: 1 });
  const turn = React.useRef({ shown: 0, target: 0 });

  // The sphere is sized off the box it is given, so it is right on a phone and
  // on a 2560 screen without a breakpoint for either.
  React.useEffect(() => {
    const box = ref.current;
    if (!box || typeof ResizeObserver === "undefined") return;

    const watch = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const root = parseFloat(getComputedStyle(document.documentElement).fontSize);
      setStage({
        w: width,
        h: height,
        unit: Number.isFinite(root) && root > 0 ? root / 16 : 1,
      });
    });
    watch.observe(box);
    return () => watch.disconnect();
  }, []);

  const hold = (value: number, [low, high]: readonly [number, number]) =>
    Math.min(Math.max(value, low), high);

  const scaled = React.useCallback(
    ([low, high]: readonly [number, number]) =>
      [low * stage.unit, high * stage.unit] as const,
    [stage.unit],
  );

  const radius = React.useMemo(
    () => ({
      x: hold(stage.w * SPREAD.x, scaled(BOUNDS.x)),
      y: hold(stage.h * SPREAD.y, scaled(BOUNDS.y)),
      z: hold(stage.w * SPREAD.z, scaled(BOUNDS.z)),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stage.w, stage.h, stage.unit],
  );
  const tile = Math.max(radius.x * TILE, TILE_MIN * stage.unit);

  // Read by the frame loop, so holding a tile does not restart it: the loop
  // closes over this ref once and checks it sixty times a second.
  const held = React.useRef(false);

  React.useEffect(() => {
    turn.current.target = progress * TURNS * Math.PI * 2;
  }, [progress]);

  // Through a ref for the same reason the radius is: the loop closes over it
  // once rather than being rebuilt every frame of the gathering.
  const pull = React.useRef(gather);

  React.useEffect(() => {
    pull.current = gather;
  }, [gather]);

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

      // Held under the pointer, or with a picture open: the drift pauses and
      // the scroll still carries. See <turnStep>.
      const next = turnStep(
        { shown: state.shown, idle },
        state.target,
        held.current,
      );
      idle = next.idle;
      state.shown = next.shown;

      const ry = state.shown;
      const rx = Math.sin(state.shown * 0.5) * TIP;
      const cy = Math.cos(ry);
      const sy = Math.sin(ry);
      const cx = Math.cos(rx);
      const sx = Math.sin(rx);

      // How much of the sphere is left, and how small a tile has been drawn
      // as it comes in. Not all the way to nothing: the tiles are gone on
      // their own fade before the last of the travel, and a tile that also
      // scaled to zero would pop at the end of it.
      const g = pull.current;
      const open = 1 - g;
      const shrink = 1 - g * 0.8;

      tiles.forEach((tile, index) => {
        const p = points[index];
        if (!p) return;
        const x = p.x * cy + p.z * sy;
        const zy = -p.x * sy + p.z * cy;
        const y = p.y * cx - zy * sx;
        const z = p.y * sx + zy * cx;

        // Translated only, never rotated, so every tile keeps facing the
        // reader; the perspective on the stage does the growing and shrinking.
        // `open` closes the three radii together, which walks every tile down
        // its own line to the middle without breaking the turn.
        const r = scale.current;
        tile.style.transform = `translate3d(${(x * r.x * open).toFixed(1)}px, ${(y * r.y * open).toFixed(1)}px, ${(z * r.z * open).toFixed(1)}px) scale(${shrink.toFixed(3)})`;
        // The far side recedes, but only so far: on the white ground a tile at
        // a tenth of its colour is not a distant picture, it is a blank.
        tile.style.opacity = (
          (0.45 + 0.55 * ((z + 1) / 2) ** 1.4) *
          Math.max(1 - g * 1.6, 0)
        ).toFixed(3);
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
              {/* A column of this grid is 45vw on a phone and 22vw from `sm`,
                  and the same 3:4 crop applies here as on the sphere - so
                  what a tile has to supply is COVER times that. There is no
                  perspective on this one, which is the whole difference. */}
              <Visual
                item={item}
                index={index}
                sizes="(max-width: 640px) 100vw, 52vw"
                pad="p-[6%]"
              />
            </span>
            <span className="mt-2 block type-kicker text-muted-foreground">
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
          perspective: `${PERSPECTIVE * stage.unit}px`,
          transformStyle: "preserve-3d",
          // Once the wall is on its way in it is no longer something to point
          // at: a tile caught under the pointer would stop the gathering dead,
          // and one caught by a click would open a dialog over the mark the
          // section is closing on.
          pointerEvents: gather > 0.02 ? "none" : undefined,
        }}
      >
        {items.map((item, index) => {
          const shape = box(item, index, tile, stage.unit);

          return (
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
              style={shape}
            >
              {/* The lift is on the inner box: the outer one's transform is
                  rewritten every frame by the loop and would swallow it. */}
              <div
                className={cn(
                  "relative overflow-hidden rounded-[3px] shadow-[0_10px_30px_-14px_rgb(0_0_0/0.4)] transition-[scale,box-shadow] duration-300 ease-out group-hover:scale-[1.08] group-hover:shadow-[0_22px_50px_-20px_rgb(0_0_0/0.5)]",
                  frame(item),
                )}
              >
                {/* Held back until the stage has been measured, which is the
                    frame after this one. Drawn before that, every tile is at
                    the floor width and asks for a file it will never show,
                    and the right one is fetched a moment later anyway. */}
                {stage.w > 0 && (
                  <Visual
                    item={item}
                    index={index}
                    sizes={demand(shape.width, !!item.logo)}
                    pad="p-[6%]"
                  />
                )}
              </div>

              {/* Under its own picture rather than at the foot of the stage:
                  named where it is, the caption belongs to the tile the eye is
                  already on. `top-full` keeps it out of the tile's own box, so
                  it cannot push the picture off its point on the sphere.

                  Set in pixels and small, not on the type scale. The caption is
                  inside the tile, so the stage's perspective grows it with
                  everything else: a tile at the front of the sphere is drawn at
                  about twice its size, and `type-kicker` - 13px on a desktop -
                  arrived there at 25, which is the size of a heading. Nine
                  lands at about eighteen where it is read, and the scale's own
                  floor could not go low enough to allow for a doubling it knows
                  nothing about. */}
              <p className="absolute inset-x-[-3rem] top-full mt-1.5 text-center text-[9px] leading-snug tracking-[0.03em] text-muted-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                {item.title}
              </p>
            </div>
          );
        })}
      </div>

      {details}
    </>
  );
}
