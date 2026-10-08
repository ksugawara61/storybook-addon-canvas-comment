import {
  type CanvasCommentDomMapOptions,
  type CanvasCommentDomMapStatus,
  createCanvasCommentDomMap,
} from "../dom-map";

const HELP = `Usage:
  pnpm --filter storybook-addon-canvas-comments dom-map -- [options]

Reads comments.json from disk and prints each comment with the DOM snapshot captured
when it was created. No browser or running Storybook is required.

Options:
  --comments-file <path>      Path to comments.json. Defaults to
                              .storybook/canvas-comments/comments.json relative to the
                              current working directory.
  --storybook-url <url>       Storybook URL, e.g. http://localhost:6006. Only used to
                              fill the story URLs in the output.
  --story-id <id>             Storybook story id. If omitted, maps every story that has
                              comments.
  --status <open|resolved|all>
                              Comments to include. Defaults to open.
  --include-dom-tree          Include the DOM subtree rooted at each comment target.
  --help                      Show this help.
`;

const parseStatus = (value: string): CanvasCommentDomMapStatus => {
  if (value === "open" || value === "resolved" || value === "all") {
    return value;
  }

  throw new Error(
    `Invalid --status "${value}". Expected open, resolved, or all.`,
  );
};

const HELP_OPTIONS = new Set(["--help", "-h"]);

const FLAG_OPTION_READERS = {
  "--include-dom-tree": (options: CanvasCommentDomMapOptions) => {
    options.includeDomTree = true;
  },
} satisfies Record<string, (options: CanvasCommentDomMapOptions) => void>;

const VALUE_OPTION_READERS = {
  "--comments-file": (options: CanvasCommentDomMapOptions, value: string) => {
    options.commentsFile = value;
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
} satisfies Record<
  string,
  (options: CanvasCommentDomMapOptions, value: string) => void
>;

const isFlagOption = (
  value: string,
): value is keyof typeof FLAG_OPTION_READERS => value in FLAG_OPTION_READERS;

const isValueOption = (
  value: string,
): value is keyof typeof VALUE_OPTION_READERS => value in VALUE_OPTION_READERS;

const readRequiredValue = (args: string[], index: number, option: string) => {
  const value = args[index + 1];

  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value.`);
  }

  return value;
};

const parseArgs = (args: string[]): CanvasCommentDomMapOptions | "help" => {
  const options: CanvasCommentDomMapOptions = {};

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

  return options;
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));

  if (options === "help") {
    console.log(HELP);
    return;
  }

  const result = await createCanvasCommentDomMap(options);
  console.log(JSON.stringify(result, null, 2));
};

void (async () => {
  try {
    await main();
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
})();
