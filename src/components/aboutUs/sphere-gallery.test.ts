import { describe, expect, it } from "vitest";

import { turnStep } from "@/components/aboutUs/sphere-gallery";

/**
 * The bug these are about: a tile could slide under a stationary pointer while
 * the wall turned, the sphere would stop dead, and because only the turn could
 * have carried that tile away it stayed pinned there. Every turn the scroll
 * asked for in the meantime was banked, and the moment the pointer moved off
 * the wall spent all of it at once.
 *
 * So what is checked is not a frame, it is the banking: that a hold cannot
 * store up travel, and that letting go cannot cost more than an ordinary
 * frame.
 */

/** A reader scrolling steadily: the target advances the same each frame. */
const SCROLL = 0.02;

function run(frames: number, heldDuring: (frame: number) => boolean) {
  let state = { shown: 0, idle: 0 };
  let target = 0;
  const steps: number[] = [];

  for (let frame = 0; frame < frames; frame += 1) {
    target += SCROLL;
    const before = state.shown;
    state = turnStep(state, target, heldDuring(frame));
    steps.push(state.shown - before);
  }

  return { state, steps };
}

describe("the sphere's turn", () => {
  const never = () => false;

  it("moves with the scroll while a tile is held", () => {
    // The whole point of the fix: a held tile must not pin itself, and it can
    // only be carried away by the turn.
    const { steps } = run(90, (frame) => frame >= 30);
    const whileHeld = steps.slice(40, 90);

    expect(Math.min(...whileHeld)).toBeGreaterThan(0);
  });

  it("banks nothing, so letting go costs no more than any other frame", () => {
    const free = run(180, never);
    const held = run(180, (frame) => frame >= 40 && frame < 120);

    // 120 is the first frame after the hold - the one that used to spend
    // eighty frames of scrolling in a single step.
    expect(held.steps[120]).toBeLessThanOrEqual(Math.max(...free.steps) + 1e-9);
  });

  it("comes to a stop under the pointer once the scroll has settled", () => {
    // Nothing scrolling and a tile held: the drift is paused, so the sphere
    // finishes arriving at where the drift had got to and then holds there
    // for as long as the tile is read.
    //
    // It does not stop on the frame the hold starts, and cannot: the easing
    // always trails its target by a frame's worth of drift divided by the
    // smoothing, about 0.0076 radians, and that is the distance it has left
    // to travel when the target stops moving. What matters is that the travel
    // ends, which is what the last fifty frames are for.
    let state = { shown: 0, idle: 0 };
    for (let frame = 0; frame < 400; frame += 1) {
      state = turnStep(state, 0, false);
    }

    let moved = 0;
    for (let frame = 0; frame < 400; frame += 1) {
      const before = state.shown;
      state = turnStep(state, 0, true);
      if (frame >= 350) moved += Math.abs(state.shown - before);
    }

    expect(moved).toBeLessThan(1e-9);
  });

  it("drifts on its own when nothing is held", () => {
    let state = { shown: 0, idle: 0 };
    for (let frame = 0; frame < 120; frame += 1) {
      state = turnStep(state, 0, false);
    }

    expect(state.shown).toBeGreaterThan(0);
  });
});
