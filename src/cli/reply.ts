import {
  type ReplyToCanvasCommentOptions,
  replyToCanvasComment,
} from "../reply-comment.ts";
import type { CanvasCommentReplyAuthor } from "../types.ts";

const HELP = `Usage:
  pnpm --filter storybook-addon-canvas-comments reply -- --comment-id <id> --body <text> [options]

Appends a reply to a canvas comment in comments.json (or the hosted API) and prints the updated comment
as JSON. No browser or running Storybook is required, so a coding agent can explain
in plain words what it changed for the comment.

Options:
  --comment-id <id>           Id of the comment to reply to. Required.
  --body <text>               Reply text. Required.
  --author <agent|reviewer>   Who wrote the reply. Defaults to agent.
                              A reviewer reply resets the review status to "reviewing".
  --resolve                   Also mark the comment resolved.
  --comments-file <path>      Path to comments.json. Defaults to
                              .storybook/canvas-comments/comments.json relative to the
                              current working directory.
  --api-url <url>             Reply through a hosted comments API instead of a local
                              file, e.g.
                              https://example.pages.dev/api/canvas-comments/curio/comments.
  --help                      Show this help.

Environment:
  CF_ACCESS_CLIENT_ID, CF_ACCESS_CLIENT_SECRET
                              Cloudflare Access service token sent with --api-url
                              requests. Set both, or neither.
`;

type ParsedOptions = Partial<ReplyToCanvasCommentOptions>;

const parseAuthor = (value: string): CanvasCommentReplyAuthor => {
  if (value === "agent" || value === "reviewer") {
    return value;
  }

  throw new Error(`Invalid --author "${value}". Expected agent or reviewer.`);
};

const HELP_OPTIONS = new Set(["--help", "-h"]);

const FLAG_OPTION_READERS = {
  "--resolve": (options: ParsedOptions) => {
    options.resolve = true;
  },
} satisfies Record<string, (options: ParsedOptions) => void>;

const VALUE_OPTION_READERS = {
  "--api-url": (options: ParsedOptions, value: string) => {
    options.apiUrl = value;
  },
  "--author": (options: ParsedOptions, value: string) => {
    options.author = parseAuthor(value);
  },
  "--body": (options: ParsedOptions, value: string) => {
    options.body = value;
  },
  "--comment-id": (options: ParsedOptions, value: string) => {
    options.commentId = value;
  },
  "--comments-file": (options: ParsedOptions, value: string) => {
    options.commentsFile = value;
  },
} satisfies Record<string, (options: ParsedOptions, value: string) => void>;

const isFlagOption = (
  value: string,
): value is keyof typeof FLAG_OPTION_READERS => value in FLAG_OPTION_READERS;

const isValueOption = (
  value: string,
): value is keyof typeof VALUE_OPTION_READERS => value in VALUE_OPTION_READERS;

const readRequiredValue = (args: string[], index: number, option: string) => {
  const value = args[index + 1];

  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${option} requires a value.`);
  }

  return value;
};

const requireOptions = (
  options: ParsedOptions,
): ReplyToCanvasCommentOptions => {
  const { body, commentId } = options;

  if (!commentId) {
    throw new Error("--comment-id is required.");
  }

  if (body === undefined) {
    throw new Error("--body is required.");
  }

  return { ...options, body, commentId };
};

const parseArgs = (args: string[]): ReplyToCanvasCommentOptions | "help" => {
  const options: ParsedOptions = {};

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

  return requireOptions(options);
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));

  if (options === "help") {
    console.log(HELP);
    return;
  }

  const comment = await replyToCanvasComment(options);
  console.log(JSON.stringify(comment, null, 2));
};

void (async () => {
  try {
    await main();
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
})();
