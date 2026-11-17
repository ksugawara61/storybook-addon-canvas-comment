import { lstat, mkdir, mkdtemp, readFile, readlink, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createWrapperMain,
  findMainFile,
  MARKER_FILE,
  prepareTemporaryConfigDir,
  removeTemporaryConfigDir,
  temporaryConfigDirFor,
} from "./config-dir.ts";

let projectDir: string;
let configDir: string;

beforeEach(async () => {
  projectDir = await mkdtemp(join(tmpdir(), "canvas-comments-temporary-"));
  configDir = join(projectDir, ".storybook");
  await mkdir(join(configDir, "decorators"), { recursive: true });
  await writeFile(join(configDir, "main.ts"), "export default { addons: [] };\n");
  await writeFile(join(configDir, "preview.ts"), "export default {};\n");
  await writeFile(join(configDir, "preview-head.html"), "<style></style>\n");
  await writeFile(join(configDir, "decorators", "theme.ts"), "export {};\n");
});

afterEach(async () => {
  await rm(projectDir, { force: true, recursive: true });
});

type WrapperConfig = {
  addons: unknown[];
  stories?: unknown;
  viteFinal: (config: Record<string, unknown>, options: unknown) => Promise<unknown>;
};

// Inside the repository, so the wrapper's `import("vite")` resolves as it does in a project.
const cacheDir = fileURLToPath(new URL("../../node_modules/.cache", import.meta.url));

/** Writes `mainSource` as the project's main, generates the wrapper for it, and imports the wrapper. */
const loadWrapper = async (mainSource: string): Promise<WrapperConfig> => {
  await mkdir(cacheDir, { recursive: true });
  const dir = await mkdtemp(join(cacheDir, "canvas-comments-wrapper-"));
  cleanup.push(dir);
  const mainFile = join(dir, "main.mjs");
  await writeFile(mainFile, mainSource);
  const wrapperFile = join(dir, "wrapper.mjs");
  await writeFile(
    wrapperFile,
    createWrapperMain({
      addonDir: "/npx/node_modules/storybook-addon-canvas-comments",
      addonOptions: { board: false },
      allowDirs: ["/npx/node_modules/storybook-addon-canvas-comments"],
      mainFile,
    }),
  );
  return ((await import(/* @vite-ignore */ pathToFileURL(wrapperFile).href)) as { default: WrapperConfig })
    .default;
};

const cleanup: string[] = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
});

describe("findMainFile", () => {
  it("finds main with any extension Storybook accepts", async () => {
    expect(await findMainFile(configDir)).toBe(join(configDir, "main.ts"));
    await rm(join(configDir, "main.ts"));
    await writeFile(join(configDir, "main.cjs"), "module.exports = {};\n");
    expect(await findMainFile(configDir)).toBe(join(configDir, "main.cjs"));
  });

  it("explains a missing config directory or main file", async () => {
    await expect(findMainFile(join(projectDir, "missing"))).rejects.toThrow(
      "No Storybook config directory",
    );
    await rm(join(configDir, "main.ts"));
    await expect(findMainFile(configDir)).rejects.toThrow("No main file");
  });
});

describe("temporaryConfigDirFor", () => {
  it("is a sibling of the config directory, so ../ paths in main stay the same", () => {
    expect(temporaryConfigDirFor("/app/.storybook")).toBe("/app/.storybook-canvas-comments");
  });
});

describe("createWrapperMain", () => {
  it("imports the project's main by file URL", () => {
    const source = createWrapperMain({
      addonDir: "/addon",
      addonOptions: {},
      allowDirs: [],
      mainFile: "/app/.storybook/main.ts",
    });
    expect(source).toContain(
      `import * as projectMain from ${JSON.stringify(pathToFileURL("/app/.storybook/main.ts").href)};`,
    );
  });

  it("adds the addon after the project's addons and keeps the rest of the config", async () => {
    const config = await loadWrapper(
      'export default { addons: ["@storybook/addon-docs"], stories: ["../src/**/*.stories.tsx"] };\n',
    );
    expect(config).toMatchObject({
      addons: [
        "@storybook/addon-docs",
        {
          name: "/npx/node_modules/storybook-addon-canvas-comments",
          options: { board: false },
        },
      ],
      stories: ["../src/**/*.stories.tsx"],
    });
  });

  it("reads a main with named exports and no addons", async () => {
    const config = await loadWrapper("export const stories = [];\n");
    expect(config.addons).toHaveLength(1);
    expect(config.stories).toEqual([]);
  });

  it("adds nothing when the project already registers the addon", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const config = await loadWrapper(
      'export default { addons: [{ name: "storybook-addon-canvas-comments" }] };\n',
    );
    expect(config.addons).toEqual([{ name: "storybook-addon-canvas-comments" }]);
    const viteConfig = { root: "/app" };
    expect(await config.viteFinal(viteConfig, {})).toBe(viteConfig);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("already in the addons"));
    warn.mockRestore();
  });

  it("runs the project's viteFinal, then dedupes storybook and allows the addon's directories", async () => {
    const config = await loadWrapper(
      'export default { viteFinal: (config) => ({ ...config, base: "/sb/" }) };\n',
    );
    const workspace = await mkdtemp(join(tmpdir(), "canvas-comments-workspace-"));
    cleanup.push(workspace);
    await writeFile(join(workspace, "package.json"), "{}");
    expect(await config.viteFinal({ root: workspace }, {})).toMatchObject({
      base: "/sb/",
      resolve: { dedupe: ["storybook"] },
      server: {
        fs: { allow: [workspace, "/npx/node_modules/storybook-addon-canvas-comments"] },
      },
    });
  });

  it("keeps an fs.allow the project set, without adding the workspace root", async () => {
    const config = await loadWrapper("export default {};\n");
    expect(await config.viteFinal({ server: { fs: { allow: ["/shared"] } } }, {})).toMatchObject({
      server: {
        fs: { allow: ["/shared", "/npx/node_modules/storybook-addon-canvas-comments"] },
      },
    });
  });
});

describe("prepareTemporaryConfigDir", () => {
  const prepare = () =>
    prepareTemporaryConfigDir({
      addonDir: "/npx/node_modules/storybook-addon-canvas-comments",
      addonOptions: {},
      allowDirs: [],
      configDir,
    });

  it("writes the wrapper main and links every other file of the config directory", async () => {
    const temporaryDir = await prepare();
    expect(temporaryDir).toBe(join(projectDir, ".storybook-canvas-comments"));
    expect(await readFile(join(temporaryDir, "main.mjs"), "utf8")).toContain(
      pathToFileURL(join(configDir, "main.ts")).href,
    );
    await expect(lstat(join(temporaryDir, "main.ts"))).rejects.toThrow();
    expect(await readlink(join(temporaryDir, "preview.ts"))).toBe(join(configDir, "preview.ts"));
    expect(await readlink(join(temporaryDir, "decorators"))).toBe(join(configDir, "decorators"));
    expect(await readFile(join(temporaryDir, "preview-head.html"), "utf8")).toBe(
      "<style></style>\n",
    );
    expect(await readFile(join(temporaryDir, ".gitignore"), "utf8")).toBe("*\n");
  });

  it("replaces a directory left behind by an earlier run", async () => {
    const temporaryDir = await prepare();
    await writeFile(join(temporaryDir, "stale.txt"), "");
    await prepare();
    await expect(lstat(join(temporaryDir, "stale.txt"))).rejects.toThrow();
  });

  it("does not touch a directory it did not write", async () => {
    const existing = temporaryConfigDirFor(configDir);
    await mkdir(existing);
    await writeFile(join(existing, "keep.txt"), "");
    await expect(prepare()).rejects.toThrow("was not written by the temporary mode");
    expect(await readFile(join(existing, "keep.txt"), "utf8")).toBe("");
  });
});

describe("removeTemporaryConfigDir", () => {
  it("removes the links without touching the original files", async () => {
    const temporaryDir = await prepareTemporaryConfigDir({
      addonDir: "/addon",
      addonOptions: {},
      allowDirs: [],
      configDir,
    });
    await removeTemporaryConfigDir(temporaryDir);
    await expect(lstat(join(temporaryDir, MARKER_FILE))).rejects.toThrow();
    expect(await readFile(join(configDir, "decorators", "theme.ts"), "utf8")).toBe("export {};\n");
  });

  it("does nothing when the directory does not exist", async () => {
    await expect(removeTemporaryConfigDir(join(projectDir, "missing"))).resolves.toBeUndefined();
  });
});
