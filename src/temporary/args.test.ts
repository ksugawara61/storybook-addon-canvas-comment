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
    expect(() => parseTemporaryArgs(["dev", "--addon-options", "[]"])).toThrow(
      "must be a JSON object",
    );
  });
});
