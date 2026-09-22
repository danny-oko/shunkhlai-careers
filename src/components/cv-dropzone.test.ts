// @vitest-environment jsdom

import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CvDropzone } from "./cv-dropzone";

/** The dropzone the CV card and the apply sheet share: picks, drops, and the identity lock. */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function render(onFileChange: (file: File | null) => void, { locked = false, disabled = false } = {}) {
  const zone = React.createElement(CvDropzone, { file: null, onFileChange, disabled });
  // IdentityLock is a disabled <fieldset> around the controls.
  act(() => root.render(locked ? React.createElement("fieldset", { disabled: true }, zone) : zone));
  return host.querySelector<HTMLElement>('[role="button"]')!;
}

function drop(target: HTMLElement, file: File) {
  const event = new Event("drop", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", { value: { files: [file] } });
  act(() => {
    target.dispatchEvent(event);
  });
}

const pdf = () => new File([new Uint8Array([1])], "cv.pdf", { type: "application/pdf" });

describe("CvDropzone", () => {
  it("hands a dropped file to the caller", () => {
    const onFileChange = vi.fn();
    drop(render(onFileChange), pdf());
    expect(onFileChange).toHaveBeenCalledWith(expect.objectContaining({ name: "cv.pdf" }));
  });

  it("ignores a drop inside the identity lock (a disabled fieldset) and when disabled", () => {
    const onFileChange = vi.fn();
    drop(render(onFileChange, { locked: true }), pdf());
    drop(render(onFileChange, { disabled: true }), pdf());
    expect(onFileChange).not.toHaveBeenCalled();
  });

  it("opens the picker on click, but not inside the identity lock", () => {
    const click = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
    const locked = render(vi.fn(), { locked: true });
    act(() => locked.click());
    expect(click).not.toHaveBeenCalled();
    const open = render(vi.fn());
    act(() => open.click());
    expect(click).toHaveBeenCalledTimes(1);
    click.mockRestore();
  });

  it("speaks Mongolian and shows the limits from apply-schema", () => {
    const zone = render(vi.fn());
    expect(zone.textContent).toContain("CV-гээ энд чирж оруулах эсвэл");
    expect(zone.textContent).toContain("PDF, DOC эсвэл DOCX · 5 MB хүртэл");
    expect(zone.textContent).not.toMatch(/Drop|browse|max/);
    expect(host.querySelector("input")!.accept).toBe(".pdf,.doc,.docx");
  });

  it("shows a picked file's name and size, with a Mongolian remove label", () => {
    act(() => root.render(React.createElement(CvDropzone, { file: pdf(), onFileChange: vi.fn() })));
    expect(host.textContent).toContain("cv.pdf");
    expect(host.textContent).toContain("1 B");
    expect(host.textContent).toContain("cv.pdf файлыг хасах");
  });
});
