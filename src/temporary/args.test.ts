import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseTemporaryArgs } from "./args.ts";

describe("parseTemporaryArgs", () => {
  it("defaults to the .storybook config directory and no addon options", () => {
    expect(parseTemporaryArgs(["dev"])).toEqual({
      addonOptions: {},
      command: "dev",
      configDir: ".storybook",
      storybookArgs: [],
    });
  });

  it("passes every other option to Storybook, including -h (--host)", () => {
    expect(parseTemporaryArgs(["dev", "-p", "6006", "-h", "0.0.0.0", "--no-open"])).toMatchObject({
      storybookArgs: ["-p", "6006", "-h", "0.0.0.0", "--no-open"],
    });
  });

  it("reads the config directory in each form", () => {
    expect(parseTemporaryArgs(["build", "-c", "sb"])).toMatchObject({
      command: "build",
      configDir: "sb",
      storybookArgs: [],
    });
    expect(parseTemporaryArgs(["dev", "--config-dir", "sb"])).toMatchObject({ configDir: "sb" });
    expect(parseTemporaryArgs(["dev", "--config-dir=sb"])).toMatchObject({ configDir: "sb" });
  });

  it("reads the addon options as JSON", () => {
    expect(
      parseTemporaryArgs(["dev", "--addon-options", '{"board":false}', "-p", "6006"]),
    ).toMatchObject({ addonOptions: { board: false }, storybookArgs: ["-p", "6006"] });
    expect(parseTemporaryArgs(["dev", '--addon-options={"apiUrl":"https://x.dev"}'])).toMatchObject(
      { addonOptions: { apiUrl: "https://x.dev" } },
    );
  });

  it("reads the addon options from a JSON file, relative to the working directory", async () => {
    const dir = await mkdtemp(join(tmpdir(), "canvas-comments-args-"));
    try {
      const designSystems = [{ importPath: "@acme/ui", name: "Acme", titlePrefix: "UI/" }];
      await writeFile(join(dir, "canvas-comments.json"), JSON.stringify({ designSystems }));
      expect(
        parseTemporaryArgs(["dev", "--addon-options", "canvas-comments.json"], dir),
      ).toMatchObject({ addonOptions: { designSystems } });
      await writeFile(join(dir, "broken.json"), "{");
      expect(() => parseTemporaryArgs(["dev", "--addon-options", "broken.json"], dir)).toThrow(
        "broken.json is not valid JSON",
      );
      await writeFile(join(dir, "list.json"), "[]");
      expect(() => parseTemporaryArgs(["dev", "--addon-options", "list.json"], dir)).toThrow(
        "must be a JSON object",
      );
      expect(() => parseTemporaryArgs(["dev", "--addon-options", "missing.json"], dir)).toThrow(
        "Could not read missing.json",
      );
    } finally {
      await rm(dir, { force: true, recursive: true });
    }
  });

  it("passes everything after -- to Storybook as is", () => {
    expect(parseTemporaryArgs(["dev", "--", "-c", "other", "--help"])).toMatchObject({
      configDir: ".storybook",
      storybookArgs: ["-c", "other", "--help"],
    });
  });

  it("returns help without a command or with --help", () => {
    expect(parseTemporaryArgs([])).toBe("help");
    expect(parseTemporaryArgs(["--help"])).toBe("help");
    expect(parseTemporaryArgs(["dev", "--help"])).toBe("help");
  });

  it("rejects an unknown command, a missing value and invalid addon options", () => {
    expect(() => parseTemporaryArgs(["start"])).toThrow('Unknown command "start"');
    expect(() => parseTemporaryArgs(["dev", "-c"])).toThrow("-c requires a value.");
    expect(() => parseTemporaryArgs(["dev", "-c", "-p"])).toThrow("-c requires a value.");
    expect(() => parseTemporaryArgs(["dev", "--addon-options", "{"])).toThrow("must be JSON");
  });
});
