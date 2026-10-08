import {
  type CanvasCommentDomMapStatus,
  createCanvasCommentDomMap,
} from "../dom-map.ts";
import { ApiClient } from "../storage/api-client.ts";
import { resolveCommentsFile } from "../storage/fs-adapter.ts";
import { FsReviewStore } from "../storage/review-store.ts";
import type { ReviewState, ReviewStatus } from "../types.ts";

const HELP = `Usage:
  pnpm --filter storybook-addon-canvas-comments wait-comments -- [options]

Blocks until the user clicks "Complete review" in the Storybook UI, then prints the
open canvas comments (dom-map JSON) to stdout and exits. Designed for a
coding agent that started Storybook and wants to detect when review is complete
before moving on to follow-up work.

Options:
  --api-url <url>             Watch a hosted comments API instead of a local file,
                              e.g. https://example.pages.dev/api/canvas-comments/curio/comments.
  --comments-file <path>      Path to comments.json, which holds the review status
                              too. Defaults to .storybook/canvas-comments/comments.json
                              relative to the current working directory.
  --poll-interval-ms <ms>     Poll interval while waiting. Defaults to 2000.
  --timeout-ms <ms>           Give up after this long (exit 1). Defaults to 0
                              (wait indefinitely).
  --no-reset                  Do not reset the review status to "reviewing" on start.
                              By default the status is reset so a stale "completed"
                              from a previous round is not detected immediately.
  --status <open|resolved|all>
                              Comments to include in the output. Defaults to open.
  --story-id <id>             Restrict output to a single story id.
  --include-dom-tree          Include a bounded DOM tree in the JSON output.
  --help                      Show this help.
`;

type WaitOptions = {
  apiUrl?: string;
  commentsFile?: string;
  pollIntervalMs: number;
  timeoutMs: number;
  reset: boolean;
  status: CanvasCommentDomMapStatus;
  storyId?: string;
  includeDomTree: boolean;
};

const DEFAULT_OPTIONS: WaitOptions = {
  includeDomTree: false,
  pollIntervalMs: 2000,
  reset: true,
  status: "open",
  timeoutMs: 0,
};

const HELP_OPTIONS = new Set(["--help", "-h"]);

const parsePositiveInteger = (value: string, option: string) => {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${option} must be a positive integer.`);
  }

  return parsed;
};

const parseNonNegativeInteger = (value: string, option: string) => {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${option} must be a non-negative integer.`);
  }

  return parsed;
};

const parseStatus = (value: string): CanvasCommentDomMapStatus => {
  if (value === "open" || value === "resolved" || value === "all") {
    return value;
  }

  throw new Error(
    `Invalid --status "${value}". Expected open, resolved, or all.`,
  );
};

const FLAG_OPTION_READERS = {
  "--include-dom-tree": (options: WaitOptions) => {
    options.includeDomTree = true;
  },
  "--no-reset": (options: WaitOptions) => {
    options.reset = false;
  },
} satisfies Record<string, (options: WaitOptions) => void>;

const VALUE_OPTION_READERS = {
  "--api-url": (options: WaitOptions, value: string) => {
    options.apiUrl = value;
  },
  "--comments-file": (options: WaitOptions, value: string) => {
    options.commentsFile = value;
  },
  "--poll-interval-ms": (options: WaitOptions, value: string) => {
    options.pollIntervalMs = parsePositiveInteger(value, "--poll-interval-ms");
  },
  "--status": (options: WaitOptions, value: string) => {
    options.status = parseStatus(value);
  },
  "--story-id": (options: WaitOptions, value: string) => {
    options.storyId = value;
  },
  "--timeout-ms": (options: WaitOptions, value: string) => {
    options.timeoutMs = parseNonNegativeInteger(value, "--timeout-ms");
  },
} satisfies Record<string, (options: WaitOptions, value: string) => void>;

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

const parseArgs = (args: string[]): WaitOptions | "help" => {
  const options: WaitOptions = { ...DEFAULT_OPTIONS };

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

const delay = (ms: number) =>
  new Promise<void>((resolveDelay) => {
    setTimeout(resolveDelay, ms);
  });

type ReviewSource = {
  read(): Promise<ReviewState>;
  write(status: ReviewStatus): Promise<ReviewState>;
};

const createReviewSource = (
  options: WaitOptions,
): { location: string; store: ReviewSource } => {
  if (options.apiUrl) {
    const client = new ApiClient(options.apiUrl);
    return {
      location: options.apiUrl,
      store: {
        read: () => client.readReview(),
        write: (status) => client.writeReview(status),
      },
    };
  }

  const commentsFile = resolveCommentsFile(options.commentsFile);
  return { location: commentsFile, store: new FsReviewStore(commentsFile) };
};

const waitForCompletion = async (options: WaitOptions) => {
  const { location, store } = createReviewSource(options);

  if (options.reset) {
    await store.write("reviewing");
  }

  const startedAt = Date.now();
  process.stderr.write(
    `Waiting for review completion (polling ${location} every ${options.pollIntervalMs}ms)...\n`,
  );

  while (true) {
    const state = await store.read();

    if (state.status === "completed") {
      process.stderr.write("Review completed. Resolving open comments...\n");
      return;
    }

    if (options.timeoutMs > 0 && Date.now() - startedAt >= options.timeoutMs) {
      throw new Error(
        `Timed out after ${options.timeoutMs}ms waiting for review completion.`,
      );
    }

    await delay(options.pollIntervalMs);
  }
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));

  if (options === "help") {
    console.log(HELP);
    return;
  }

  await waitForCompletion(options);

  const result = await createCanvasCommentDomMap({
    apiUrl: options.apiUrl,
    commentsFile: options.commentsFile,
    includeDomTree: options.includeDomTree,
    status: options.status,
    storyId: options.storyId,
  });
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
