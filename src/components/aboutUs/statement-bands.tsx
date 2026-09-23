"use client";

import * as React from "react";
import Image from "next/image";

import { FeatherLattice } from "@/components/brand/feather-lattice";
import { SectionRule } from "@/components/brand/section-rule";
import { useScrollProgress } from "@/components/landing/use-scroll-progress";
import { PrinciplePanel } from "@/components/aboutUs/academy-principle";
import { mission, values, vision } from "@/lib/company";
import { cn } from "@/lib/utils";

type Step = {
  id: string;
  word: string;
  image: string;
  /** The two statements carry a sentence; the values carry their five names. */
  statement?: string;
  list?: string[];
  /**
   * Set both edges straight rather than leaving the right one ragged.
   *
   * Only worth asking for where the sentence makes a block — four full lines
   * closing on a straight edge read as a set column. Justify two lines, or the
   * one-line values, and there is a single stretched line and nothing under it
   * to square up with, which reads as a spacing fault rather than as setting.
   */
  justify?: boolean;
};

/**
 * TODO(HR): the three grounds are placeholders — flat brand-coloured fields
 * with nothing in them, standing in until real photography arrives. Replace
 * the files in `public/brand`, keeping the names, and nothing here changes.
 */
const STEPS: Step[] = [
  {
    id: "mission",
    word: mission.label,
    statement: mission.statement,
    image: "/brand/statement-bg-1.jpg",
  },
  {
    id: "vision",
    word: vision.label,
    statement: vision.statement,
    justify: true,
    image: "/brand/statement-bg-2.jpg",
  },
  {
    id: "values",
    word: "Үнэт зүйл",
    list: values.map((value) => value.mn),
    image: "/brand/statement-bg-3.jpg",
  },
];

/**
 * The ground the closing two beats stand on: HR's own key visual, the four
 * "People of energy" portraits in a two-by-two - the office, the depot, the
 * laboratory and the station, which is the company the panel is about to
 * describe, and the only real photography on this screen.
 *
 * Not a fourth STEP. The three above arrive on the line, one per beat, and
 * hand over to each other; this one arrives behind the word once the line is
 * finished with, and it is still there when the word has gone.
 */
const PRINCIPLE_GROUND = "/academy/principle-ground.jpg";

/** Height of one word in the roller. The slack keeps descenders off the line. */
const SLOT = "1.25em";

/**
 * Share of a step spent standing on the line while the word and the sentence
 * are read in; the rest is spent travelling up to make room for the next.
 */
const HOLD = 0.55;
/** Share of a step over which the word fills in from the left. */
const SWEEP = 0.5;

const clamp = (value: number) => Math.min(Math.max(value, 0), 1);

/**
 * The two custom properties `.gleam-in` reads: a band of light travelling
 * through the type as it arrives, driven by the scroll rather than a clock.
 * The sheen is the cool one — the page's own rule is that orange on navy
 * reads as a smudge and only a blue-white reads as light.
 */
const gleam = (t: number) =>
  ({
    "--gleam": t.toFixed(3),
    "--gleam-heat": Math.sin(t * Math.PI).toFixed(3),
  }) as React.CSSProperties;

// The floor is what a 320px screen needs: at 1.85rem the word plus the kicker
// beside it came to 328 of the 272px such a window gives, and the row wrapped
// the word onto its own line, away from the hairline it is supposed to cross.
const WORD_SIZE = "text-[clamp(1.35rem,6.5vw,3.5rem)]";
/**
 * Type for the big word. The cap is low for the length of the Mongolian —
 * "Эрхэм зорилго" is thirteen characters where the reference's "MISSION" is
 * seven, and at the reference's size it would run into the sentence beside it.
 */
const WORD = `${WORD_SIZE} w-fit leading-none font-semibold tracking-[-0.04em] whitespace-nowrap uppercase`;

/** How much of the ground each neighbouring step still owns, 1 at its own. */
const near = (position: number, index: number) =>
  clamp(1 - Math.abs(position - index));

/**
 * One setting for both kinds of statement, so a sentence and a value read at
 * the same size in the same measure and start on the same edge. The values
 * carried numerals until the two were asked to match exactly: in the line they
 * pushed the values in by the width of the number, and hung outside it they
 * needed a gutter wider than the gap the column now sits on.
 */
const SAYING = "type-section leading-[1.3] font-semibold tracking-tight";

function Statement({ step }: { step: Step }) {
  if (!step.list) {
    // Balanced where it is not justified: `text-balance` evens the lines of a
    // short sentence, which is the ragged edge's own way of looking set.
    //
    // And justified only from `xl`, which is the width the row closes on one
    // line at and the only width both edges flush was ever for. Below it the
    // sentence drops onto its own line inside `max-w-md`, and at 21px in the
    // ~342px a phone leaves that is four or five words a line: justification
    // then has nowhere to put the slack but between them, and the paragraph
    // opens up rivers wide enough to read down instead of across. One ragged
    // edge is what a measure that short wants.
    //
    // Which edge is ragged is decided a level up, not here: below `xl` the
    // block is set flush right under a right-set word, so the left one gives.
    return (
      <p
        className={cn(
          SAYING,
          step.justify ? "text-pretty xl:text-justify" : "text-balance",
        )}
      >
        {step.statement}
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {step.list.map((line) => (
        <li key={line} className={cn(SAYING, "text-pretty")}>
          {line}
        </li>
      ))}
    </ul>
  );
}

/**
 * The words stacked in one column, moved up by one slot per step.
 *
 * Drawn three times over the two windows: ghosted above the line, ghosted
 * again below it, and a lit copy over that one clipped to however much of the
 * word has been swept in. All three take the same position, so a word crossing
 * the line always meets itself on it.
 *
 * The words are set to the right of the column — they all end on one vertical
 * line, which is the edge they change on and the edge the sentence is measured
 * from. The sweep still fills each word from its own left, so it is read in
 * the order it is written.
 *
 * The travel is a percentage of the roller's own height, not a pixel count, so
 * it stays exactly one word per step at every type size with nothing measured.
 */
function Roller({
  position,
  sweep,
  heading,
  className,
}: {
  position: number;
  /** How much of each word is lit. Omitted for the ghost copies. */
  sweep?: (index: number) => number;
  heading?: boolean;
  className: string;
}) {
  const Tag = heading ? "h2" : "span";

  return (
    <div
      className={cn("absolute right-0", className)}
      style={{
        transform: `translate3d(0, ${(-position * 100) / STEPS.length}%, 0)`,
      }}
    >
      {STEPS.map((step, index) => (
        <Tag
          key={step.id}
          className={cn(WORD, "ml-auto flex items-center")}
          style={{
            height: SLOT,
            clipPath: sweep
              ? `inset(0 ${(1 - sweep(index)) * 100}% 0 0)`
              : undefined,
          }}
        >
          {/* The light rides on the inside: `.gleam-in` paints through the
              text with background-clip, which wants a plain box, and the slot
              above it is a flex box that has to stay one. */}
          <span
            className={sweep ? "gleam-in" : undefined}
            style={sweep ? gleam(sweep(index)) : undefined}
          >
            {step.word}
          </span>
        </Tag>
      ))}
    </div>
  );
}

/**
 * Two beats after the three statements: one for the word, one for what is
 * behind it.
 *
 * The section used to be exactly as long as it had statements. It carries the
 * Academy's principle now, out of a section of its own and into the end of
 * this one, and the word is the hinge: "Бидний" has labelled every one of the
 * three, and at the end of them it steps off the row, comes forward into the
 * middle of the screen, and breaks apart to leave the principle standing where
 * it stood.
 *
 * The beat after that is the principle's own, and it is not spare: the panel
 * only finishes arriving at the very end of the word's beat, so without a beat
 * of its own it would be fully up for the last pixel of the runway and gone.
 */
const BEATS = STEPS.length + 2;

/** Cubic ease-out: away quickly, settling in. What arrives on screen takes it. */
const ease = (t: number) => 1 - (1 - t) ** 3;

/**
 * Smoothstep: still at both ends, quickest in the middle.
 *
 * The word's own travel takes this and not the ease above, and the difference
 * is the whole reading of the beat. Under an ease-out the word is four fifths
 * of the way up to full size within a tenth of its beat: it does not come
 * forward, it pops, and everything left is a pause and then a burst - which
 * is what "it scatters before it has grown" looks like. Settling in at both
 * ends spends the travel where it was asked for, in the travelling.
 */
const advance = (t: number) => t * t * (3 - 2 * t);

/**
 * The word's beat, as shares of it: it comes forward into the middle over the
 * first half, stands clear at full size for a fifth of the beat, and only then
 * breaks up, with the panel behind it arriving as the pieces go.
 *
 * The standing is not slack. It is the beat that says the growing has finished
 * before the scattering starts, and without it the two movements run into each
 * other and read as one.
 */
const GROW = 0.5;
const BREAK = { from: 0.68, span: 0.32 };
/**
 * And the share of that break the letters are gone by.
 *
 * They travel for the whole of it and fade over the first half, so the burst
 * still carries out to its full spread while the word itself is already off
 * the screen. Fading over the whole break instead, the letters were still at
 * a third of their weight with the panel behind them fully arrived, and six
 * grey letters lay across the copy like a watermark nobody asked for.
 */
const FADE = 0.5;
/**
 * The panel waits for them. It opens where the letters reach about a tenth of
 * their weight, which is the last moment before the two would be read at once.
 */
const REVEAL = { from: 0.82, span: 0.18 };

/**
 * And how long the panel then has to draw itself.
 *
 * Its own beat, near enough: the band running out and the three cards coming
 * up behind it are given from the moment the panel appears to most of the way
 * through the beat after the word's, which is the one the section keeps for
 * the panel and where nothing else moves. Inside `REVEAL` alone the whole
 * thing would be over in about twenty pixels of scroll.
 */
const PANEL_DRAW = 0.78;
/** And how quickly the statements give up the screen once that beat opens. */
const HAND_OVER = 0.22;

/**
 * The ground's own arrival, in shares of the word's beat.
 *
 * It opens just after the word does and has finished by the time the word
 * has, so the two read as one movement - the word coming forward and the
 * picture coming up behind it - rather than as a word and then a slide.
 */
const GROUND = { from: 0.12, span: 0.46 };

/**
 * And where it stops being the subject: exactly as the panel opens, which is
 * why it takes the panel's own beat rather than one of its own. Until then it
 * is the picture and nothing is done to it; from there it blurs back into a
 * ground for the principle to be read on. Softened any earlier and the word
 * scatters over a picture that is already going.
 */
const SOFTEN = REVEAL;

/**
 * How far out of focus, standing behind the word and standing under the panel.
 *
 * Zero at rest. The picture is the client's own key visual and it arrives as
 * it was delivered - the second number is for the state where it has stopped
 * being looked at and has copy over it.
 */
const HAZE = { rest: 0, under: 18 };

/**
 * And how much ink it carries at each of those. None while it is the picture;
 * under the panel it is a contrast figure rather than a taste, because the
 * brightest part of the photograph is a white wall and the panel's muted copy
 * has to hold 4.5:1 over it. 85% gives that copy 5.3:1 and the heading 10.5:1.
 */
const VEIL = { rest: 0, under: 0.85 };

/**
 * The picture's own proportion, which is how the band at its foot is found on
 * a screen of any shape: it is drawn whole, so its box is as tall as the
 * screen or as wide, whichever runs out first, and the band is a fraction of
 * that box rather than of the window.
 */
const RATIO = 3 / 2;

/**
 * And the bar it is drawn under: `h-16` on <SiteHeader>, which is fixed over
 * every page and therefore over this one.
 *
 * Drawn to the top of the window instead, the picture is whole and the top of
 * it is still not visible - the bar sits on the head of the man at the back of
 * the group. So the box the picture is fitted into is the window less the bar,
 * and the strip behind the bar is left as ink, which is the ground the bar is
 * over everywhere else in this section anyway.
 */
const BAR_REM = 4;

/** `h-16` on <SiteHeader> in whatever a rem is at this window. */
function barPx(): number {
  if (typeof window === "undefined") return BAR_REM * 16;
  const root = parseFloat(getComputedStyle(document.documentElement).fontSize);
  return BAR_REM * (Number.isFinite(root) ? root : 16);
}

/**
 * Where the word lands in it: the middle of the picture.
 *
 * The picture is four portraits in a two-by-two, and the word crosses all
 * four of them at full size - so there is no quiet band to put it in the way
 * the single key visual had one. The middle is the one place that reads as
 * placed rather than as parked in a corner, and the shade below is what makes
 * it hold there.
 */
const SPOT = { x: 0.5, y: 0.5 };

/**
 * The pool of shade the word stands in.
 *
 * Across the band the word occupies, the picture runs from a blown-out office
 * wall to a near-black workshop floor: white type holds on three quarters of
 * it and disappears on the fourth, and navy does the opposite. Neither colour
 * can carry the word on its own, so the ground is darkened under it instead -
 * an ellipse the width of the word, deep enough that white clears 3:1 over
 * even the wall (0.72 of ink takes it from 0.96 to 0.28 relative luminance,
 * which is 3.2:1), and gone well before the edges of the frame. Each of the
 * four portraits carries its own white lettering, so white is the picture's
 * own colour for type over it.
 */
const WORD_SHADE =
  "radial-gradient(52% 20% at 50% 50%, rgba(4,18,36,0.72) 0%, rgba(4,18,36,0.62) 45%, rgba(4,18,36,0) 100%)";

/**
 * Where each letter of "Бидний" goes when the word breaks up.
 *
 * In ems of the word's own size rather than pixels, and applied inside the
 * transform that scales it, so the burst is the same shape on a phone as on a
 * desktop instead of being a shrug at one size and a scatter at the other.
 */
const SCATTER = [
  { x: -1.55, y: -0.6, turn: -24 },
  { x: -0.9, y: 0.85, turn: 15 },
  { x: -0.3, y: -0.95, turn: -11 },
  { x: 0.35, y: 0.9, turn: 19 },
  { x: 1.05, y: -0.75, turn: -17 },
  { x: 1.65, y: 0.5, turn: 26 },
];

/**
 * Where the outro word starts, measured rather than guessed.
 *
 * It has to begin exactly where the label it replaces sits, at exactly that
 * label's size, or the hand-over is two words rather than one word moving.
 * Neither is knowable up front: the label is placed by a wrapping flex row
 * whose position changes at `xl`, and both are set in a web font at fluid
 * sizes. So the label's own box is read off the layout, against the pinned
 * screen's box, and the word is told where it came from.
 *
 * Sizes are taken from `offset*`, positions from the rects. The word carries a
 * transform, and a rect would hand back the size that transform had already
 * drawn it at - which is the size being measured for, so it would chase
 * itself. `offsetHeight` is the untransformed layout box and cannot.
 */
function useWordOrigin(
  screenRef: React.RefObject<HTMLElement | null>,
  labelRef: React.RefObject<HTMLElement | null>,
  wordRef: React.RefObject<HTMLElement | null>,
) {
  // The screen is measured here too, because the word's destination is a
  // place in the picture rather than the middle of the window, and the picture
  // is drawn whole inside that window - so where it lands can only be worked
  // out from the window's own shape. See SPOT.
  const [origin, setOrigin] = React.useState({
    x: 0,
    y: 0,
    scale: 0.2,
    stage: { width: 0, height: 0 },
    bar: BAR_REM * 16,
  });

  React.useLayoutEffect(() => {
    const screen = screenRef.current;

    const measure = () => {
      const label = labelRef.current;
      const word = wordRef.current;
      if (!screen || !label || !word || !word.offsetHeight) return;

      const stage = screen.getBoundingClientRect();
      const box = label.getBoundingClientRect();

      setOrigin({
        x: box.left + box.width / 2 - (stage.left + stage.width / 2),
        y: box.top + box.height / 2 - (stage.top + stage.height / 2),
        scale: Math.min(box.height / word.offsetHeight, 1),
        stage: { width: stage.width, height: stage.height },
        bar: barPx(),
      });
    };

    measure();
    if (!screen) return;

    const observer = new ResizeObserver(measure);
    observer.observe(screen);
    // The measurement is of type that has not necessarily arrived yet.
    document.fonts?.ready.then(measure).catch(() => {});
    return () => observer.disconnect();
  }, [screenRef, labelRef, wordRef]);

  return origin;
}

/**
 * Эрхэм зорилго, алсын хараа, үнэт зүйл — one screen, scrolled through.
 *
 * The section is five screens tall and its contents are pinned for all of
 * them, so a screen of scrolling moves the piece on by one beat rather than
 * moving the page. A hairline runs across the middle of the window and the
 * subject rides up through it.
 *
 * Each of the three statements is two beats, as the reference's are. The word
 * arrives on the line and stands there while it fills in from the left and the
 * sentence beside it is drawn in behind a soft edge; only then does it travel
 * up and the next one arrive. Reaching the line and being read are separate
 * movements — run as one, the word is gone before the sentence has been
 * finished.
 *
 * Both sides of the line are clipped to exactly one word, so the line always
 * has one word above it and one below and nothing queues behind either. The
 * words change in place rather than piling up.
 *
 * The sentence sits beside the word on a wide screen, as in the reference, and
 * drops underneath it below `xl` — side by side, the Mongolian is long enough
 * that the two would meet in the middle.
 *
 * The last two beats are the Academy's: the label steps out of the row, takes
 * the middle of the screen, and breaks apart, and the 70/20/10 principle is
 * standing behind it. The ground changes with it - the three placeholder
 * fields give way to HR's key visual, which comes up behind the word and is
 * then blurred back into a ground for the panel to be read on. That principle had a section of its own
 * under this one and no longer does — arriving out of the thing that was
 * saying "Бидний" all along is what makes it the company's own account of how
 * its people grow rather than a chart further down the page.
 *
 * Under reduced motion the runway is dropped and the four are laid out as four
 * plain screens instead.
 *
 * Anchors: the vision and the values were tabs of the culture section below
 * and are linked by those hashes from the hero rail and the site footer, so
 * each step carries a landing point at the scroll position that shows it.
 */
export function StatementBands() {
  const ref = React.useRef<HTMLDivElement>(null);
  const screenRef = React.useRef<HTMLDivElement>(null);
  const labelRef = React.useRef<HTMLParagraphElement>(null);
  const wordRef = React.useRef<HTMLParagraphElement>(null);
  const { progress, isReduced } = useScrollProgress(ref);
  const origin = useWordOrigin(screenRef, labelRef, wordRef);

  // Where we are in the whole run, in beats.
  const phase = progress * BEATS;

  // Where we are in the statements. Held just inside the last one so the
  // closing word does not travel off the line at the very bottom, and it stays
  // there for the two beats after them.
  const run = Math.min(phase, STEPS.length - 0.0001);
  const current = Math.floor(run);
  const local = run - current;

  // Stands on the line for the first beat of the step, then moves up.
  const position = Math.min(
    current + clamp((local - HOLD) / (1 - HOLD)),
    STEPS.length - 1,
  );

  // What is being read is whatever is nearest the line, not whichever step the
  // scroll is technically in: for the last quarter of a step the next word has
  // already travelled up to the line, and keying off the step would leave the
  // sentence of the one before it sitting beside the new word.
  const lead = Math.round(position);
  const sweep = (index: number) =>
    index < lead ? 1 : index > lead ? 0 : clamp((run - lead) / SWEEP);

  // The line is one draw across the whole run, not one per word: it sets off
  // with the first word and is finished only once the last sentence is, so it
  // reads as the three being written together rather than as three separate
  // strokes. DRAWN_BY is the point in the run the closing sweep ends at —
  // past it there is still scroll left, and the line would otherwise sit
  // unfinished through the end of the section.
  const draw = clamp(run / (STEPS.length - 1 + SWEEP));

  // The closing beat the word has to itself. The one after it is the panel's,
  // and needs no number: nothing moves on it.
  const outro = clamp(phase - STEPS.length);

  // The statements hand the screen over at the top of the word's beat.
  const statements = 1 - ease(clamp(outro / HAND_OVER));

  // The word: out to the middle and up to full size, held there, then broken
  // apart. `advance` and not `ease` - see the note on it.
  const grown = advance(clamp(outro / GROW));
  const scale = origin.scale + (1 - origin.scale) * grown;
  const word = clamp(outro / 0.1);

  // The break is read off three ways: the letters travel on the eased number,
  // which throws them out and lets them settle, and fade on a plain one that
  // is spent over the first half of it. Fading on the eased number, they were
  // three quarters gone a third of the way through and the scatter was over
  // before it had been seen; fading over the whole break, they outlived the
  // panel arriving behind them.
  const breaking = clamp((outro - BREAK.from) / BREAK.span);
  const broken = ease(breaking);
  const scattered = clamp(breaking / FADE);

  // And what is behind it, which arrives as the last of the letters go and
  // then stands for the rest of the run.
  const principle = ease(clamp((outro - REVEAL.from) / REVEAL.span));

  // The panel's own drawing, measured from the moment it appears rather than
  // from the start of the beat, and running on into the beat after it.
  const panel = clamp(
    (phase - (STEPS.length + REVEAL.from)) / PANEL_DRAW,
  );

  // The ground behind both: up with the word, out of focus under the panel.
  const ground = ease(clamp((outro - GROUND.from) / GROUND.span));
  const soften = ease(clamp((outro - SOFTEN.from) / SOFTEN.span));

  // The picture is drawn whole in the window below the bar, so its box is that
  // height times its own proportion, or the window's width, whichever fits -
  // and the band the word lands in is a fraction of that box. The landing is
  // given against the middle of the window, which the box's own middle sits
  // half a bar below.
  const below = Math.max(origin.stage.height - origin.bar, 0);
  const frame = {
    width: Math.min(origin.stage.width, below * RATIO),
    height: Math.min(below, origin.stage.width / RATIO),
  };
  const landing = {
    x: frame.width * (SPOT.x - 0.5),
    y: origin.bar / 2 + frame.height * (SPOT.y - 0.5),
  };

  /** Lifted as it arrives, so the panel enters rather than switches on. */
  const rise = (shown: number) => ({
    opacity: shown,
    transform: `translate3d(0, ${((1 - shown) * 24).toFixed(2)}px, 0)`,
  });

  // One gap on either side of the word. The sentence is held inside the row
  // rather than allowed to run past its right edge, which is what would happen
  // on a narrow window behind the longest of the three words.
  if (isReduced) {
    return (
      <section className="relative isolate">
        <SectionRule />
        {STEPS.map((step) => (
          <article
            key={step.id}
            id={step.id}
            className="relative isolate flex min-h-[70svh] scroll-mt-16 flex-col justify-center overflow-hidden px-6 py-section text-ink-foreground lg:px-10"
          >
            <Image
              src={step.image}
              alt=""
              aria-hidden
              fill
              sizes="100vw"
              className="-z-20 object-cover"
            />
            <div aria-hidden className="absolute inset-0 -z-10 bg-ink/55" />
        {/* The brandbook's feather ground. The placeholder photographs are flat
            fields of colour, and over a flat field flat type reads as a slide
            rather than a screen. */}
        <FeatherLattice className="-z-10 opacity-[0.18]" tone="brand" />

            <div className="mx-auto w-full max-w-6xl">
              <p className="type-eyebrow font-medium tracking-[0.16em] text-white/55 uppercase">
                Бидний
              </p>
              <h2 className={cn(WORD, "mt-4")}>{step.word}</h2>
              <div className="mt-8 max-w-md">
                <Statement step={step} />
              </div>
            </div>
          </article>
        ))}

        {/* The same panel the run closes on, laid out rather than revealed.
            There is no word to break apart here because there is no movement
            to break it with. */}
        <article className="relative isolate overflow-hidden bg-ink py-section">
          {/* The ground the panel is read on there too, at the state the
              runway leaves it in - there is no beat here to bring it in on. */}
          <Image
            src={PRINCIPLE_GROUND}
            alt=""
            aria-hidden
            fill
            sizes="100vw"
            className="-z-20 scale-[1.06] object-contain blur-[18px]"
          />
          <div
            aria-hidden
            className="absolute inset-0 -z-10"
            style={{ backgroundColor: "var(--ink)", opacity: VEIL.under }}
          />
          <FeatherLattice className="opacity-[0.18]" tone="brand" />
          <PrinciplePanel />
        </article>
      </section>
    );
  }

  return (
    <section ref={ref} className="relative isolate h-[500svh]">
      {/* On the section, not the pinned screen — inside, it would sit at the
          top of the window for the whole run. */}
      <SectionRule />

      {/* One landing point per step, at the scroll position that shows it. */}
      {STEPS.map((step, index) => (
        <span
          key={step.id}
          id={step.id}
          aria-hidden
          className="absolute inset-x-0 block h-0"
          style={{ top: `${(index * 100) / BEATS}%` }}
        />
      ))}

      {/* Ink under the grounds, so a photograph that has not arrived yet leaves
          the type on the colour it was drawn for rather than on the page. */}
      <div
        ref={screenRef}
        className="sticky top-0 h-svh overflow-hidden bg-ink text-ink-foreground"
        style={
          {
            // What the type settles to once the light has passed: not the flat
            // white it was, but that white carrying a little of the sheen, so
            // the screen keeps a colour of its own at rest.
            "--gleam-base":
              "color-mix(in oklab, var(--sheen-cool) 30%, var(--ink-foreground))",
            "--gleam-sheen": "var(--sheen-cool)",
          } as React.CSSProperties
        }
      >
        {STEPS.map((step, index) => (
          <Image
            key={step.id}
            src={step.image}
            alt=""
            aria-hidden
            fill
            priority={index === 0}
            sizes="100vw"
            className="-z-20 object-cover"
            style={{ opacity: near(position, index) * (1 - ground) }}
          />
        ))}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-ink/55"
          style={{ opacity: 1 - ground }}
        />

        {/* The closing ground, over the three it replaces and under everything
            that is read. It carries its own veil rather than borrowing the one
            above: that one is a fixed 55% over flat placeholder fields, and
            this is a photograph that has to go from being looked at to being
            read over. */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 overflow-hidden"
          style={{ opacity: ground }}
        >
          {/* The picture's own box: the window less the bar over it. The veil
              below is not inset with it - it is what the panel is read on and
              has to cover the whole screen. */}
          <div className="absolute inset-x-0 bottom-0" style={{ top: origin.bar }}>
            <Image
              src={PRINCIPLE_GROUND}
              alt=""
              fill
              sizes="100vw"
              // Whole, not cropped to the box. It is a composed picture -
              // four portraits in a two-by-two, each with its own lettering -
              // and a window that crops it takes a different piece at every
              // size, cutting one of the four in half.
              className="object-contain"
              style={{
                // Still while it is the picture; pushed on only as it softens,
                // so it is moving when the panel lands on it.
                transform: `scale(${(1 + 0.06 * soften).toFixed(3)})`,
                filter: `blur(${(HAZE.rest + (HAZE.under - HAZE.rest) * soften).toFixed(2)}px)`,
              }}
            />
          </div>
          {/* The shade the word stands in: only under the word, and only for
              as long as the word is there - once the panel starts to land, the
              veil below covers the whole screen and this would double it. */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{ backgroundImage: WORD_SHADE, opacity: 1 - soften }}
          />
          {/* Nothing else over it until the panel wants it. */}
          <div
            className="absolute inset-0"
            style={{
              backgroundColor: "var(--ink)",
              opacity: VEIL.rest + (VEIL.under - VEIL.rest) * soften,
            }}
          />
        </div>
        {/* The brandbook's feather ground. The placeholder photographs are flat
            fields of colour, and over a flat field flat type reads as a slide
            rather than a screen. */}
        <FeatherLattice className="-z-10 opacity-[0.18]" tone="brand" />

        {/* The line the words cross. It goes with them. */}
        <div
          aria-hidden
          // Not the brand gradient: the section rules above and below it are
          // already that orange, and a third orange rule across the middle read
          // as the page having been ruled twice by mistake.
          className="absolute inset-x-0 top-1/2 h-px bg-white/25"
          style={{
            transform: `scaleX(${draw})`,
            transformOrigin: "left",
            opacity: statements,
          }}
        />

        <div
          inert={statements < 0.02}
          style={{ opacity: statements }}
          className="absolute inset-0 mx-auto max-w-6xl px-6 lg:px-10"
        >
          {/* One row across the line, laid out rather than placed: the kicker,
              the column the words run in, and the sentence. The gap is the flex
              gap. Placing the three by hand needed the word's width, and a
              width can only be had by measuring — which left the row sitting in
              its unmeasured places whenever the measurement did not land, the
              kicker underneath the word. */}
          <div className="absolute inset-x-6 top-1/2 flex flex-wrap items-start gap-x-8 lg:inset-x-10">
            {/* The label travels with the word below `xl`, and only there.
                Everything in this row is set against the right gutter until
                the sentence joins it, because that is the edge the words
                change on. The label was the one piece left behind: held at
                the left gutter while the word sat against the right one, it
                opened a gap between the two of 90px on a phone, 252 at 768
                and 425 at 1024 — on a laptop, nearly half the screen of
                nothing between a word and the label that names it, which read
                as two unrelated things rather than as one line. Given the same
                `ml-auto`, the pair closes up and travels to the gutter
                together; at `xl` both release it and the row packs from the
                left as it always did.

                It is also where the closing word comes from, so it carries a
                ref: see <useWordOrigin>. */}
            <p
              ref={labelRef}
              aria-hidden
              className="mt-[0.9em] ml-auto shrink-0 type-eyebrow font-medium tracking-[0.16em] text-white/55 uppercase xl:ml-0"
            >
              Бидний
            </p>

            <div className={cn(WORD_SIZE, "relative shrink-0")}>
              {/* All three words in one grid cell, so the column is as wide as
                  the widest of them and never changes width. Sized to the word
                  at the line instead, the column breathed in and out by the
                  157px between the longest word and the shortest, and took the
                  sentence with it — the reader was following a column that
                  would not stand still. Fixed, the words change on one edge and
                  the sentence beside them never moves. */}
              <span
                aria-hidden
                className="invisible grid justify-items-end"
                style={{ height: SLOT }}
              >
                {STEPS.map((step) => (
                  <span
                    key={step.id}
                    className={cn(WORD, "col-start-1 row-start-1")}
                  >
                    {step.word}
                  </span>
                ))}
              </span>

              {/* Above the line: the word just read, and only that one. The
                  window matches the one below it, so the line has a word on
                  either side of it and the pair sits square on it; given the
                  whole half-screen the words already read stacked up above it
                  instead, and the piece read as a list growing off the top
                  rather than as one word handing over to the next. A screen
                  wide because the words it carries are not all as wide as this
                  column, and a word must not be cut off at its edge; it hangs
                  off the column's right edge, which is the edge the words are
                  set to. */}
              <div
                aria-hidden
                className="absolute right-0 bottom-full h-[1.25em] w-screen overflow-hidden"
              >
                <Roller position={position} className="top-full text-white/25" />
              </div>

              {/* Below the line: the word being read, and only that one. */}
              <div className="absolute top-0 right-0 h-[1.25em] w-screen overflow-hidden">
                {/* The unlit bed the swept copy is drawn over. Same words, so
                    it is kept away from assistive tech. */}
                <div aria-hidden className="absolute inset-0">
                  <Roller position={position} className="top-0 text-white/25" />
                </div>
                <Roller
                  position={position}
                  sweep={sweep}
                  heading
                  className="top-0 text-white"
                />
              </div>
            </div>

            {/* Level with the word, not under it: 8px is where the sentence's
                capitals land on the word's, worked from the face's own
                metrics — cap 0.69em on a 1.30em content box, the word at 56px
                centred in a 1.25em slot, the sentence at 24px on 1.3 leading.
                `basis-full` drops it onto its own line below `xl`, where the
                Mongolian is long enough that the two would meet in the middle.

                On that own line it takes the right gutter too, so the label,
                the word and the sentence all close on the one edge instead of
                the block sliding back to the left under a word set against the
                right. At 1024 that puts its left edge within 3px of the word's
                by itself. The gap above it was a flat 80px, which is about
                right under a 56px word and half a screen of air under a 28px
                one, so it is the fluid step now and shrinks with the type. */}
            <div className="relative mt-block ml-auto max-w-md basis-full text-right xl:mt-2 xl:ml-0 xl:basis-0 xl:grow xl:text-left">
              {STEPS.map((step, index) => (
                <div
                  key={step.id}
                  inert={index !== lead}
                  className={cn(
                    "gleam-in transition-opacity duration-300 ease-out",
                    index > 0 && "absolute inset-x-0 top-0",
                  )}
                  style={{
                    ...gleam(sweep(index)),
                    opacity: index === lead ? 1 : 0,
                    // Drawn in behind a soft edge, in reading order, over the
                    // same beat the word is swept in on.
                    maskImage: `linear-gradient(105deg, #000 ${sweep(index) * 180 - 70}%, transparent ${sweep(index) * 180 - 20}%)`,
                  }}
                >
                  <Statement step={step} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* What the word gives way to. Under it in the stack, so the word
            breaks apart over the panel rather than beside it. */}
        <div className="absolute inset-0 flex items-center">
          <PrinciplePanel
            inert={principle < 0.02}
            style={rise(principle)}
            progress={panel}
          />
        </div>

        {/* And the word itself, over everything.
            
            Always rendered, because it is what <useWordOrigin> measures
            against, and held at nothing until its beat opens. Decorative
            throughout: it is the same word as the label it steps out of, and
            at this size it is a picture of the company saying it rather than
            a second thing to read. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <p
            ref={wordRef}
            className="type-display font-semibold tracking-[-0.04em] whitespace-nowrap text-white uppercase"
            style={{
              opacity: word,
              // From the label it steps out of to the middle of the picture.
              // Both ends are places on the screen, so the travel is one
              // interpolation between them and the scale rides on top.
              transform: `translate3d(${(origin.x * (1 - grown) + landing.x * grown).toFixed(2)}px, ${(origin.y * (1 - grown) + landing.y * grown).toFixed(2)}px, 0) scale(${scale.toFixed(4)})`,
            }}
          >
            {/* Letters rather than a word, because they have to leave in six
                directions. Together they read as one until they go, and the
                key carries the index because "и" is in it twice. */}
            {["Б", "и", "д", "н", "и", "й"].map((letter, index) => (
              <span
                key={`${letter}-${index}`}
                className="inline-block"
                style={{
                  transform: `translate(${SCATTER[index].x * broken}em, ${SCATTER[index].y * broken}em) rotate(${SCATTER[index].turn * broken}deg)`,
                  opacity: 1 - scattered,
                }}
              >
                {letter}
              </span>
            ))}
          </p>
        </div>
      </div>
    </section>
  );
}
