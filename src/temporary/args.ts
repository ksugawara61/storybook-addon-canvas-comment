import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Arguments of `npx storybook-addon-canvas-comments <dev|build> [options]`. */
export type TemporaryArgs = {
  addonOptions: Record<string, unknown>;
  command: "build" | "dev";
  configDir: string;
  /** Passed through to `storybook dev` / `storybook build`. */
  storybookArgs: string[];
};

const COMMANDS = new Set(["build", "dev"]);

/** Reads `--addon-options`: a JSON object, or the path of a JSON file that holds one. */
const parseAddonOptions = (value: string, cwd: string): Record<string, unknown> => {
  const isJson = value.trimStart().startsWith("{");
  let source = value;
  if (!isJson) {
    try {
      source = readFileSync(resolve(cwd, value), "utf8");
    } catch {
      throw new Error(
        `--addon-options must be JSON, such as '{"board":false}', or a JSON file. Could not read ${value}.`,
      );
    }
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new Error(
      isJson
        ? `--addon-options must be JSON, such as '{"board":false}'.`
        : `--addon-options: ${value} is not valid JSON.`,
    );
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("--addon-options must be a JSON object.");
  }
  return parsed as Record<string, unknown>;
};

/**
 * Reads the command, the config directory and the addon options, and keeps every other
 * argument for Storybook. `-h` is not help: it is `--host` for `storybook dev`.
 */
export const parseTemporaryArgs = (
  args: string[],
  cwd: string = process.cwd(),
): TemporaryArgs | "help" => {
  const [command, ...rest] = args;
  if (!command || command === "--help" || command === "help") {
    return "help";
  }
  if (!COMMANDS.has(command)) {
    throw new Error(`Unknown command "${command}". Expected dev or build.`);
  }

  const parsed: TemporaryArgs = {
    addonOptions: {},
    command: command as TemporaryArgs["command"],
    configDir: ".storybook",
    storybookArgs: [],
  };

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index] ?? "";
    if (arg === "--") {
      parsed.storybookArgs.push(...rest.slice(index + 1));
      break;
    }
    if (arg === "--help") {
      return "help";
    }
    const [name, inlineValue] = arg.startsWith("--")
      ? (arg.split(/=(.*)/s, 2) as [string, string | undefined])
      : [arg, undefined];
    if (name !== "-c" && name !== "--config-dir" && name !== "--addon-options") {
      parsed.storybookArgs.push(arg);
      continue;
    }
    const value = inlineValue ?? rest[index + 1];
    if (value === undefined || (inlineValue === undefined && value.startsWith("-"))) {
      throw new Error(`${name} requires a value.`);
    }
    if (inlineValue === undefined) {
      index += 1;
    }
    if (name === "--addon-options") {
      parsed.addonOptions = parseAddonOptions(value, cwd);
    } else {
      parsed.configDir = value;
    }
  }
  return parsed;
};
