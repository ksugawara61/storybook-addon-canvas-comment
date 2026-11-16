import { mkdir, mkdtemp, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  libraryStoriesEntries,
  libraryStorySource,
  listExportedComponents,
  resolveLibraryComponents,
  writeLibraryStories,
} from "./library.ts";

let projectDir: string;

const writeFiles = async (files: Record<string, string>) => {
  for (const [path, content] of Object.entries(files)) {
    await mkdir(join(projectDir, path, ".."), { recursive: true });
    await writeFile(join(projectDir, path), content);
  }
};

beforeEach(async () => {
  projectDir = await mkdtemp(join(tmpdir(), "canvas-comments-library-"));
  await writeFiles({
    "node_modules/@acme/ui/package.json": JSON.stringify({
      exports: { ".": "./src/index.ts" },
      name: "@acme/ui",
    }),
    "node_modules/@acme/ui/src/badge.ts":
      "export const Badge = (props: { label: string }) => props.label;\n",
    "node_modules/@acme/ui/src/index.ts": [
      'export { Badge } from "./badge";',
      'export * from "./panel";',
      'export type { PanelProps } from "./panel";',
      "export function Button(props: { label: string }) { return props.label; }",
      "export const COLORS = { primary: '#000' };",
      "export const useButton = () => 0;",
      "export type ButtonProps = { label: string };",
      "export interface Theme { color: string }",
      "export const ThemeProvider = (props: { children: unknown }) => props.children;",
      "",
    ].join("\n"),
    "node_modules/@acme/ui/src/panel.ts": [
      "export type PanelProps = { title: string };",
      "export class Panel { props: PanelProps = { title: '' }; }",
      "",
    ].join("\n"),
    "package.json": JSON.stringify({ name: "app" }),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("listExportedComponents", () => {
  it("lists the capitalized value exports that can be called or constructed", () => {
    expect(listExportedComponents("@acme/ui", projectDir)).toEqual([
      "Badge",
      "Button",
      "Panel",
      "ThemeProvider",
    ]);
  });

  it("throws for a module it cannot resolve", () => {
    expect(() => listExportedComponents("@acme/missing", projectDir)).toThrow(
      /Could not resolve "@acme\/missing"/,
    );
  });
});

describe("resolveLibraryComponents", () => {
  it("leaves out excluded exports, and keeps listed names that can be imported", () => {
    expect(
      resolveLibraryComponents(
        { components: "auto", exclude: ["ThemeProvider"], name: "@acme/ui" },
        projectDir,
      ),
    ).toEqual(["Badge", "Button", "Panel"]);
    expect(
      resolveLibraryComponents(
        { components: ["Button", "Button", "not-a-name", "Badge"], name: "@acme/ui" },
        projectDir,
      ),
    ).toEqual(["Button", "Badge"]);
  });
});

describe("libraryStorySource", () => {
  it("imports the component and hides the story from the sidebar, docs and tests", () => {
    expect(
      libraryStorySource({ importPath: "@acme/ui", name: "Acme" }, "Button", {
        label: "Save",
      }),
    ).toBe(
      [
        "// Written by storybook-addon-canvas-comments for the board's component library. Do not edit.",
        'import { Button as Component } from "@acme/ui";',
        "",
        "export default {",
        "  component: Component,",
        '  tags: ["canvas-comments-library","!autodocs","!test"],',
        '  title: "Canvas Comments Library/Acme/Button",',
        "};",
        "",
        'export const Default = { args: {"label":"Save"} };',
        "",
      ].join("\n"),
    );
  });
});

describe("writeLibraryStories", () => {
  it("writes a story per component, removes stale ones and leaves unchanged ones alone", async () => {
    const directory = await writeLibraryStories(
      { args: { Button: { label: "Save" } }, components: ["Badge", "Button"], name: "@acme/ui" },
      projectDir,
    );
    if (directory === undefined) {
      throw new Error("expected a directory");
    }
    expect(directory).toContain(
      join("node_modules", ".cache", "storybook-addon-canvas-comments", "library"),
    );
    expect((await readdir(directory)).sort()).toEqual([
      "Badge.stories.js",
      "Button.stories.js",
    ]);
    expect(await readFile(join(directory, "Button.stories.js"), "utf8")).toContain(
      'args: {"label":"Save"}',
    );

    const before = await stat(join(directory, "Button.stories.js"));
    await writeLibraryStories(
      { args: { Button: { label: "Save" } }, components: ["Button"], name: "@acme/ui" },
      projectDir,
    );
    expect(await readdir(directory)).toEqual(["Button.stories.js"]);
    expect((await stat(join(directory, "Button.stories.js"))).mtimeMs).toBe(
      before.mtimeMs,
    );
  });

  it("returns no directory without components", async () => {
    expect(
      await writeLibraryStories({ components: [], name: "@acme/ui" }, projectDir),
    ).toBeUndefined();
  });
});

describe("libraryStoriesEntries", () => {
  it("returns a stories entry per library, and skips a failing one with a warning", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const entries = await libraryStoriesEntries(
      [
        { components: "auto", name: "@acme/ui" },
        { components: "auto", name: "@acme/missing" },
        { name: "Stories", titlePrefix: "UI/" },
      ],
      projectDir,
    );

    expect(entries).toEqual([
      { directory: expect.stringContaining("acme-ui-"), files: "*.stories.js" },
    ]);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Skipped the design system "@acme/missing"'),
    );
  });
});
