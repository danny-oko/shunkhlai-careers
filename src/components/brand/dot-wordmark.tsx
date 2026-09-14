"use client";

import * as React from "react";

/**
 * The brand name across the foot of the page, drawn as a dot screen.
 *
 * Same idiom as the country on the opening screen
 * (public/brand/mongolia-dots.svg): the shape is never painted, it is punched
 * out of a grid of dots. Here the grid is an SVG pattern and the shape is live
 * text rather than an exported image, so one declaration serves both themes,
 * every viewport width and any change to the name — the reference this was
 * built from ships it as a flat PNG and pays for that at every breakpoint.
 *
 * `textLength` is what makes it span the page exactly. Without it the mark
 * would be one fixed size and the fit would depend on the web font having
 * arrived — which, under `display: swap`, on first paint it has not.
 */

/** Everything is measured against a 1000-unit box; `textLength` maps the word
 *  onto it whatever the word is, so this is a unit of measure, not a size. */
const BOX_WIDTH = 1000;

/**
 * What an uppercase glyph runs, as a share of an em. Geist's Cyrillic caps
 * measure 0.696 averaged over this word, so this is set deliberately over the
 * true figure: it picks a font size about 6% too small, and `textLength` then
 * pulls the word back out to the full box. Erring that way is the point — the
 * mark widens into a display cut rather than being squeezed narrow, which is
 * the proportion a dot screen wants. Erring the other way would compress it.
 */
const AVERAGE_ADVANCE = 0.74;

/**
 * Й's breve is the highest ink in the alphabet — higher than any cap — so the
 * box is sized off that and not off cap height. Cropping it is the one mistake
 * this layout can make that nothing else would catch: it would take the top
 * off one accent and nothing else, which reads as a rendering fault rather
 * than as a design. Measured at 0.90em in Geist; the rest is clearance.
 *
 * Under the baseline is air, not ink — enough that the grid closes off instead
 * of ending on a cut row of dots against the bottom of the page.
 */
const ACCENT_HEIGHT = 0.96;
const UNDER_BASELINE = 0.1;

/**
 * The screen, in ems so a shorter word does not get a finer grid. What decides
 * whether this reads as a halftone or as noise is the pitch against the stem,
 * not against the letter: three dots to a stem is the least that still holds
 * together as a stroke, and at 800 a Geist stem is about 0.095em, which is
 * where the pitch below comes from. Dots at 26% of it leave the grid open
 * enough to see through, which is the whole effect.
 *
 * The weight is part of the same sum. At 600 the stems are two dots across and
 * the word reads as an outline rather than as a screened solid; going heavier
 * is what buys the third dot.
 */
const DOT_PITCH = 0.031;
const DOT_RADIUS = 0.26;
const WEIGHT = 800;

/**
 * The scatter, in the same 1000-unit space as everything above, so the pointer
 * throws the mark the same distance at every window width.
 *
 * REACH is how far the pointer is felt — a quarter of the word — and PUSH how
 * far the dots nearest it are thrown: about a fifth of the height of the mark,
 * far enough that the grid comes apart rather than merely rippling.
 *
 * SWIRL bends each dot off the straight line away from the pointer, and every
 * dot carries its own throw distance and its own direction of spin. Without
 * those two the dots leave along clean radii and come back along the same
 * ones, which reads as a hole being pushed through the word. With them they
 * break up and drift back, which is the thing being asked for.
 *
 * SPRING and FRICTION are not free. This integrator —
 *
 *   v = FRICTION * (v + SPRING * (target - x));  x += v
 *
 * — oscillates unless it is critically damped, which for a given friction f
 * means a spring of exactly (1 + f - sqrt(4f)) / f. Anything above that and
 * the dots sail past home and swing back through it: at 0.86 friction the
 * overshoot was a third of the throw, and the mark wobbled like jelly as it
 * settled. The pair below is a shade under critical at 0.70 friction, so the
 * dots come home and stop dead, still taking about two thirds of a second
 * about it — slow enough to watch them merge, which is the point of it.
 *
 * Every dot is sprung to a target rather than shoved by an accumulating force.
 * That is what makes "back exactly where it was" true by construction: with
 * the pointer gone the target is its home, and nothing can leave a dot resting
 * half a pixel off the grid it was cut from.
 */
const REACH = 260;
const PUSH = 88;
const SWIRL = 0.45;
const SPRING = 0.038;
const FRICTION = 0.7;
/** Below this, in units, the run is over and the dots are snapped home. */
const AT_REST = 0.04;

type Dot = {
  hx: number;
  hy: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** How far this dot throws, relative to its neighbours. */
  reach: number;
  /** Which way it curves out, and back. -1 to 1. */
  spin: number;
};

/**
 * One screen per page is the assumption — the pattern is referenced by id, and
 * two marks would share the first one. They are identical, so nothing breaks;
 * pass an `id` if a page ever needs two that differ.
 */
export function DotWordmark({
  text,
  className,
  id = "dot-wordmark-screen",
  pitch: pitchEm = DOT_PITCH,
}: {
  text: string;
  className?: string;
  id?: string;
  /** Grid pitch in ems. Coarsen it where the mark is drawn small: the whole
      SVG scales, dots included, and below about 2 device pixels apart they
      close up into a grey smear instead of reading as a screen. */
  pitch?: number;
}) {
  // Rounded only to keep the emitted attributes readable; the fit is exact
  // either way, because `textLength` and not the font size is what sets it.
  const round = (value: number) => Number(value.toFixed(2));
  const fontSize = round(BOX_WIDTH / (text.length * AVERAGE_ADVANCE));
  const baseline = round(fontSize * ACCENT_HEIGHT);
  const pitch = round(fontSize * pitchEm);
  const boxHeight = round(baseline + fontSize * UNDER_BASELINE);

  const frameRef = React.useRef<HTMLDivElement>(null);
  const { mounted, painted } = useScatter({
    text,
    frameRef,
    fontSize,
    baseline,
    boxHeight,
    pitch,
  });

  return (
    <div ref={frameRef} className={`relative ${className ?? ""}`}>
    <svg
      aria-hidden
      focusable="false"
      viewBox={`0 0 ${BOX_WIDTH} ${boxHeight}`}
      // Handed over to the canvas once that has something to show. Invisible
      // rather than removed: the box it occupies is what gives the canvas,
      // which is absolutely placed over it, a height to fill.
      className={`block w-full ${painted ? "invisible" : ""}`}
    >
      <defs>
        <pattern id={id} width={pitch} height={pitch} patternUnits="userSpaceOnUse">
          <circle
            cx={pitch / 2}
            cy={pitch / 2}
            r={round(pitch * DOT_RADIUS)}
            fill="currentColor"
          />
        </pattern>
      </defs>

      {/* The pattern is anchored to the box, not to each glyph, so the dots
          line up in one grid across the whole word — the giveaway that this is
          a screen laid over the type rather than a texture inside it.

          The anchor is start-at-zero for plainness only: with `textLength` set
          the word occupies 0 to BOX_WIDTH whichever anchor is used, so there
          is nothing to centre. */}
      <text
        x={0}
        y={baseline}
        textAnchor="start"
        textLength={BOX_WIDTH}
        lengthAdjust="spacingAndGlyphs"
        fontSize={fontSize}
        fontWeight={WEIGHT}
        fill={`url(#${id})`}
      >
        {text}
      </text>
    </svg>

      {/* Only mounted where the pointer can actually reach it; see useScatter. */}
      {mounted && (
        <canvas
          aria-hidden
          className="absolute inset-0 block h-full w-full"
          data-dot-canvas
        />
      )}
    </div>
  );
}

/**
 * The same mark again as loose dots, so the pointer can push through it.
 *
 * A pattern fill cannot do this: it is one repeating tile, and there is no
 * such thing as the nth dot of it to move. So on a pointer device the SVG
 * hands over to a canvas holding every dot as its own body — a few thousand of
 * them, which is why this is a canvas and not a few thousand elements.
 *
 * Where the ink is, is not worked out from the letterforms. The word is
 * stamped into the canvas once and the grid is sampled against what came out,
 * so the dots land exactly where the pattern would have shown them, whatever
 * the font turns out to be.
 *
 * `mounted` says a canvas is wanted at all — false on a touch screen and under
 * reduced motion, where the SVG is left alone. `painted` says it has the mark
 * on it and the SVG may step aside; the two are separate because a copy of
 * this that is display:none at the current breakpoint has no width to build
 * against, and hiding its SVG on intent alone would leave nothing behind when
 * the breakpoint changed.
 */
function useScatter({
  text,
  frameRef,
  fontSize,
  baseline,
  boxHeight,
  pitch,
}: {
  text: string;
  frameRef: React.RefObject<HTMLDivElement | null>;
  fontSize: number;
  baseline: number;
  boxHeight: number;
  pitch: number;
}) {
  const [mounted, setMounted] = React.useState(false);
  const [painted, setPainted] = React.useState(false);

  React.useEffect(() => {
    const frame = frameRef.current;
    if (!frame || typeof window.matchMedia !== "function") return;

    // A scatter that answers the pointer is nothing on a screen that has no
    // pointer to answer, and is exactly the kind of thing reduced motion is
    // asking not to be given. Both keep the SVG and cost nothing.
    const wanted =
      window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!wanted) return;

    // A one-shot capability probe, not a render-driven update: `matchMedia` is
    // unavailable during SSR, so this cannot be lazy initial state, and the
    // answer is read once rather than subscribed to. The cascading render the
    // rule guards against is the single mount that turns the canvas on.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    return () => setMounted(false);
  }, [frameRef]);

  React.useEffect(() => {
    const frame = frameRef.current;
    const canvas = frame?.querySelector<HTMLCanvasElement>("[data-dot-canvas]");
    if (!mounted || !frame || !canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;
    const ctx = context;

    let dots: Dot[] = [];
    let pointer: { x: number; y: number } | null = null;
    let ink = "currentColor";
    let raf = 0;
    // The observers are disconnected on cleanup, but the font promise below
    // cannot be, and it resolves against a canvas that is no longer anywhere.
    let live = true;

    const paint = () => {
      ctx.clearRect(0, 0, BOX_WIDTH, boxHeight);
      ctx.fillStyle = ink;
      // One path for every dot and a single fill: a few thousand separate
      // fills is the difference between this costing a millisecond a frame
      // and costing ten.
      ctx.beginPath();
      const r = pitch * DOT_RADIUS;
      for (const dot of dots) {
        ctx.moveTo(dot.x + r, dot.y);
        ctx.arc(dot.x, dot.y, r, 0, Math.PI * 2);
      }
      ctx.fill();
    };

    const build = () => {
      if (!live) return;
      const width = frame.clientWidth;
      // Zero at the breakpoint where this copy of the mark is display:none.
      // The observer below brings it back if that ever changes.
      if (!width) {
        setPainted(false);
        return;
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(((width * boxHeight) / BOX_WIDTH) * dpr);

      const scale = canvas.width / BOX_WIDTH;
      const style = getComputedStyle(canvas);
      ink = style.color;

      // Stamp the word solid, purely to find out which cells it covers. The
      // horizontal squeeze is what `textLength` does in the SVG, applied here
      // by hand so the two land on the same glyph positions.
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.font = `${WEIGHT} ${fontSize}px ${style.fontFamily}`;
      ctx.textBaseline = "alphabetic";
      const natural = ctx.measureText(text).width || BOX_WIDTH;
      ctx.setTransform((scale * BOX_WIDTH) / natural, 0, 0, scale, 0, 0);
      ctx.fillStyle = "#000";
      ctx.fillText(text, 0, baseline);

      const stamp = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const next: Dot[] = [];
      for (let y = pitch / 2; y < boxHeight; y += pitch) {
        for (let x = pitch / 2; x < BOX_WIDTH; x += pitch) {
          const px = Math.round(x * scale);
          const py = Math.round(y * scale);
          if (px >= canvas.width || py >= canvas.height) continue;
          if (stamp[(py * canvas.width + px) * 4 + 3] > 128) {
            next.push({
              hx: x,
              hy: y,
              x,
              y,
              vx: 0,
              vy: 0,
              reach: 0.5 + Math.random(),
              spin: Math.random() * 2 - 1,
            });
          }
        }
      }

      dots = next;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      paint();
      setPainted(true);
    };

    const step = () => {
      let moving = false;

      for (const dot of dots) {
        let tx = dot.hx;
        let ty = dot.hy;

        if (pointer) {
          const dx = dot.hx - pointer.x;
          const dy = dot.hy - pointer.y;
          const away = Math.hypot(dx, dy);
          if (away < REACH) {
            // Squared falloff: firm right under the pointer, and gone by the
            // edge of the reach rather than stopping on a visible ring.
            const t = 1 - away / REACH;
            const throwTo = PUSH * t * t * dot.reach;
            const nx = dx / (away || 1);
            const ny = dy / (away || 1);
            // Straight out, plus a turn across it — the perpendicular is just
            // the outward direction rotated a quarter turn.
            const swirl = SWIRL * dot.spin;
            tx += (nx - ny * swirl) * throwTo;
            ty += (ny + nx * swirl) * throwTo;
          }
        }

        dot.vx = (dot.vx + (tx - dot.x) * SPRING) * FRICTION;
        dot.vy = (dot.vy + (ty - dot.y) * SPRING) * FRICTION;
        dot.x += dot.vx;
        dot.y += dot.vy;

        if (
          !moving &&
          (Math.abs(dot.vx) > AT_REST ||
            Math.abs(dot.vy) > AT_REST ||
            Math.abs(dot.x - dot.hx) > AT_REST ||
            Math.abs(dot.y - dot.hy) > AT_REST)
        ) {
          moving = true;
        }
      }

      paint();

      if (pointer || moving) {
        raf = requestAnimationFrame(step);
        return;
      }

      // Settled with the pointer gone: put every dot back on its cell exactly
      // and stop, rather than leaving a spring to converge forever.
      for (const dot of dots) {
        dot.x = dot.hx;
        dot.y = dot.hy;
        dot.vx = 0;
        dot.vy = 0;
      }
      paint();
      raf = 0;
    };

    const run = () => {
      if (!raf) raf = requestAnimationFrame(step);
    };

    const onMove = (event: PointerEvent) => {
      const box = frame.getBoundingClientRect();
      if (!box.width || !box.height) return;
      pointer = {
        x: ((event.clientX - box.left) / box.width) * BOX_WIDTH,
        y: ((event.clientY - box.top) / box.height) * boxHeight,
      };
      run();
    };

    const onLeave = () => {
      pointer = null;
      run();
    };

    build();
    frame.addEventListener("pointermove", onMove);
    frame.addEventListener("pointerleave", onLeave);

    const observer = new ResizeObserver(build);
    observer.observe(frame);
    // The mark is set in a web font and in whichever colour the theme is on,
    // and both can land after the first build.
    document.fonts?.ready.then(build).catch(() => {});
    const theme = new MutationObserver(build);
    theme.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });

    return () => {
      live = false;
      cancelAnimationFrame(raf);
      frame.removeEventListener("pointermove", onMove);
      frame.removeEventListener("pointerleave", onLeave);
      observer.disconnect();
      theme.disconnect();
      setPainted(false);
    };
  }, [mounted, frameRef, text, fontSize, baseline, boxHeight, pitch]);

  return { mounted, painted };
}
