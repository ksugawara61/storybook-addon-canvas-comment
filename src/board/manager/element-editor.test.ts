// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import type { ElementEdit } from "../board-schema.ts";
import { query, renderStory } from "../../test/dom.ts";
import { applyEdits } from "./element-editor.ts";

const createEdit = (overrides?: Partial<ElementEdit>): ElementEdit => ({
  createdAt: "2026-11-15T00:00:00.000Z",
  dx: 12,
  dy: 4,
  frameId: "frame-1",
  id: "edit-1",
  label: 'button "Save"',
  note: "",
  remove: false,
  selector: "#storybook-root > button",
  ...overrides,
});

const button = () => query("#storybook-root > button") as HTMLElement;

describe("applyEdits", () => {
  it("previews a move with a translate", () => {
    renderStory("<button>Save</button>");

    applyEdits(document, [createEdit()], undefined);

    expect(button().style.translate).toBe("12px 4px");
    expect(button().style.opacity).toBe("");
  });

  it("fades an element to remove without moving it, and restores it when unmarked", () => {
    renderStory("<button>Save</button>");

    applyEdits(document, [createEdit({ remove: true })], undefined);
    expect(button().style.translate).toBe("");
    expect(button().style.opacity).toBe("0.3");

    applyEdits(document, [], undefined);
    expect(button().style.opacity).toBe("");
  });
});
