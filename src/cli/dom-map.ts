import {
  type CanvasCommentDomMapOptions,
  type CanvasCommentDomMapStatus,
  createCanvasCommentDomMap,
  parseViewport,
} from "../dom-map";

const HELP = `Usage:
  pnpm --filter storybook-addon-canvas-comments dom-map -- --storybook-url <url> [options]

Options:
  --storybook-url <url>       Running Storybook URL, for example http://localhost:6006
  --story-id <id>             Storybook story id. If omitted, maps every story that has comments.
  --status <open|resolved|all>
                              Comments to include. Defaults to open.
  --viewport <width>x<height> Browser viewport. Defaults to 390x844.
  --include-dom-tree          Include a bounded #storybook-root DOM tree in the JSON output.
  --skip-loading-wait         Do not wait for common loading indicators/text to disappear.
  --timeout-ms <ms>           Story load timeout. Defaults to 15000.
  --max-dom-depth <number>    DOM tree depth when --include-dom-tree is set. Defaults to 6.
  --max-dom-children <number> DOM children per node when --include-dom-tree is set. Defaults to 20.
  --max-text-length <number>  Text truncation length. Defaults to 240.
  --help                      Show this help.
`;

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options === "help") {
    console.log(HELP);
    return;
  }

  const result = await createCanvasCommentDomMap(options);
  console.log(JSON.stringify(result, null, 2));
}

const HELP_OPTIONS = new Set(["--help", "-h"]);

const FLAG_OPTION_READERS = {
  "--include-dom-tree": (options: CanvasCommentDomMapOptions) => {
    options.includeDomTree = true;
  },
  "--skip-loading-wait": (options: CanvasCommentDomMapOptions) => {
    options.skipLoadingWait = true;
  },
} satisfies Record<string, (options: CanvasCommentDomMapOptions) => void>;

const VALUE_OPTION_READERS = {
  "--max-dom-children": (
    options: CanvasCommentDomMapOptions,
    value: string,
  ) => {
    options.maxDomChildren = parsePositiveInteger(value, "--max-dom-children");
  },
  "--max-dom-depth": (options: CanvasCommentDomMapOptions, value: string) => {
    options.maxDomDepth = parsePositiveInteger(value, "--max-dom-depth");
  },
  "--max-text-length": (options: CanvasCommentDomMapOptions, value: string) => {
    options.maxTextLength = parsePositiveInteger(value, "--max-text-length");
  },
  "--status": (options: CanvasCommentDomMapOptions, value: string) => {
    options.status = parseStatus(value);
  },
  "--story-id": (options: CanvasCommentDomMapOptions, value: string) => {
    options.storyId = value;
  },
  "--storybook-url": (options: CanvasCommentDomMapOptions, value: string) => {
    options.storybookUrl = value;
  },
  "--timeout-ms": (options: CanvasCommentDomMapOptions, value: string) => {
    options.timeoutMs = parsePositiveInteger(value, "--timeout-ms");
  },
  "--viewport": (options: CanvasCommentDomMapOptions, value: string) => {
    options.viewport = parseViewport(value);
  },
} satisfies Record<
  string,
  (options: CanvasCommentDomMapOptions, value: string) => void
>;

function parseArgs(args: string[]): CanvasCommentDomMapOptions | "help" {
  const options: CanvasCommentDomMapOptions = {
    storybookUrl: "",
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--") {
      continue;
    }

    if (HELP_OPTIONS.has(arg)) {
      return "help";
    }

    if (isFlagOption(arg)) {
      FLAG_OPTION_READERS[arg](options);
      continue;
    }

    if (isValueOption(arg)) {
      VALUE_OPTION_READERS[arg](options, readRequiredValue(args, index, arg));
      index += 1;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  if (!options.storybookUrl) {
    throw new Error("--storybook-url is required.");
  }

  return options;
}

function isFlagOption(
  value: string,
): value is keyof typeof FLAG_OPTION_READERS {
  return value in FLAG_OPTION_READERS;
}

function isValueOption(
  value: string,
): value is keyof typeof VALUE_OPTION_READERS {
  return value in VALUE_OPTION_READERS;
}

function readRequiredValue(args: string[], index: number, option: string) {
  const value = args[index + 1];

  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value.`);
  }

  return value;
}

function parseStatus(value: string): CanvasCommentDomMapStatus {
  if (value === "open" || value === "resolved" || value === "all") {
    return value;
  }

  throw new Error(
    `Invalid --status "${value}". Expected open, resolved, or all.`,
  );
}

function parsePositiveInteger(value: string, option: string) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${option} must be a positive integer.`);
  }

  return parsed;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
