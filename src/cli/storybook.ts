import { spawn } from "node:child_process";
import { readFileSync, realpathSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseTemporaryArgs } from "../temporary/args.ts";
import {
  MARKER_FILE,
  prepareTemporaryConfigDir,
} from "../temporary/config-dir.ts";
import { runCli } from "./options.ts";

const HELP = `Usage:
  npx storybook-addon-canvas-comments <dev|build> [options] [storybook options]

Runs your Storybook with Canvas Comments, without adding the addon to
package.json or .storybook/main.*. The addon runs from the npx cache.

It writes a config directory next to yours (.storybook-canvas-comments), which
loads your main config and adds the addon to it, and runs your project's own
"storybook dev" or "storybook build" with it. The directory is deleted when
Storybook exits. Comments and boards are saved where they are with the addon
installed: .storybook/canvas-comments/ in the current directory.

Options:
  -c, --config-dir <dir>      Your Storybook config directory. Defaults to .storybook.
  --addon-options <json|file> The addon's preset options, as JSON such as
                              '{"board":false}', or the path of a JSON file.
                              Use a file for designSystems.
  --help                      Show this help.

Every other option is passed to Storybook, such as -p 6006 or --no-open.

Examples:
  npx storybook-addon-canvas-comments dev -p 6006
  npx storybook-addon-canvas-comments dev --addon-options '{"board":false}'
  npx storybook-addon-canvas-comments dev --addon-options canvas-comments.json
`;

// dist/cli/storybook.js (or src/cli/storybook.ts) → the package directory.
const addonDir = realpathSync(fileURLToPath(new URL("../..", import.meta.url)));

/** Directories Vite has to serve from outside the project: the addon and its dependencies. */
const addonAllowDirs = (): string[] => {
  const { dependencies = {} } = JSON.parse(
    readFileSync(join(addonDir, "package.json"), "utf8"),
  ) as { dependencies?: Record<string, string> };
  const require = createRequire(join(addonDir, "package.json"));
  const dirs = [addonDir];
  for (const name of Object.keys(dependencies)) {
    try {
      let dir = dirname(realpathSync(require.resolve(name)));
      while (!dir.endsWith(join("node_modules", name)) && dirname(dir) !== dir) {
        dir = dirname(dir);
      }
      dirs.push(dir);
    } catch {
      // A dependency that cannot be resolved is reported by Vite when it is imported.
    }
  }
  return dirs;
};

/** The project's own Storybook CLI, so the version matches the project. */
const resolveStorybookBin = (cwd: string): string => {
  const require = createRequire(join(cwd, "package.json"));
  let packageJson: string;
  try {
    packageJson = require.resolve("storybook/package.json");
  } catch {
    throw new Error(
      `Storybook is not installed in ${cwd}. Run this command in a project that has the "storybook" package.`,
    );
  }
  const { bin } = JSON.parse(readFileSync(packageJson, "utf8")) as {
    bin?: string | Record<string, string>;
  };
  const relativeBin = typeof bin === "string" ? bin : bin?.storybook;
  if (!relativeBin) {
    throw new Error(`Could not find the storybook CLI in ${packageJson}.`);
  }
  return join(dirname(packageJson), relativeBin);
};

const main = async () => {
  const args = parseTemporaryArgs(process.argv.slice(2));
  if (args === "help") {
    console.log(HELP);
    return;
  }

  const cwd = process.cwd();
  const storybookBin = resolveStorybookBin(cwd);
  const temporaryDir = await prepareTemporaryConfigDir({
    addonDir,
    addonOptions: args.addonOptions,
    allowDirs: addonAllowDirs(),
    configDir: resolve(cwd, args.configDir),
  });

  let removed = false;
  const removeTemporaryDir = () => {
    if (removed) {
      return;
    }
    removed = true;
    // Synchronous, so it also runs from the "exit" handler.
    try {
      readFileSync(join(temporaryDir, MARKER_FILE));
      rmSync(temporaryDir, { force: true, recursive: true });
    } catch {
      // Already gone.
    }
  };
  process.on("exit", removeTemporaryDir);

  console.error(
    `[canvas-comments] Temporary mode: running "storybook ${args.command}" with the addon from ${addonDir}`,
  );

  const child = spawn(
    process.execPath,
    [storybookBin, args.command, "--config-dir", temporaryDir, ...args.storybookArgs],
    { stdio: "inherit" },
  );

  // Ctrl+C reaches Storybook too, since it shares the terminal. Wait for it to exit,
  // and pass on a signal sent to this process only.
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
    process.on(signal, () => {
      child.kill(signal);
    });
  }

  const exitCode = await new Promise<number>((resolveExit, reject) => {
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      resolveExit(code ?? (signal ? 1 : 0));
    });
  });
  removeTemporaryDir();
  process.exitCode = exitCode;
};

runCli(main);
