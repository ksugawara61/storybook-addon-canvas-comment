import { BoardWaitTimeoutError, waitForBoard } from "../board/board-watch.ts";
import { BOARD_SOURCE_HELP, openBoardSource } from "./board-source.ts";
import { CliError, parseInteger, parseOptions, runCli } from "./options.ts";

const HELP = `Usage:
  canvas-comments-wait-board [options]

Blocks until the user clicks "Send to agent" on the Storybook board, then prints
the board instructions to stdout and exits. Designed for a coding agent that
waits for the board, applies the instructions to the code, clears them with
canvas-comments-board-resolve, and waits again.

Options:
${BOARD_SOURCE_HELP}
  --format <markdown|json>    markdown (default) prints the instructions as in
                              board-instructions.md. json prints
                              { boardFile, instructions, items }, where items
                              lists the ids to pass to canvas-comments-board-resolve.
                              boardFile is the board.json path or the board API URL.
  --poll-interval-ms <ms>     Poll interval while waiting. Defaults to 2000.
  --timeout-ms <ms>           Give up after this long (exit 2). Defaults to 0
                              (wait indefinitely).
  --no-reset                  Do not reset the review status to "reviewing" on start.
                              By default the status is reset so a stale "completed"
                              from a previous round is not picked up immediately.
  --help                      Show this help.

Exit codes:
  0  The board was sent; the instructions are on stdout.
  1  An error.
  2  Timed out (--timeout-ms). Run the command again to keep waiting.
`;

type Format = "json" | "markdown";

type Options = {
  apiUrl?: string;
  boardFile?: string;
  format: Format;
  pollIntervalMs: number;
  reset: boolean;
  timeoutMs: number;
};

const parseFormat = (value: string): Format => {
  if (value === "json" || value === "markdown") {
    return value;
  }
  throw new Error(`Invalid --format "${value}". Expected markdown or json.`);
};

const main = async () => {
  const options = parseOptions<Options>(
    process.argv.slice(2),
    { format: "markdown", pollIntervalMs: 2000, reset: true, timeoutMs: 0 },
    {
      flags: {
        "--no-reset": (current) => {
          current.reset = false;
        },
      },
      values: {
        "--api-url": (current, value) => {
          current.apiUrl = value;
        },
        "--board-file": (current, value) => {
          current.boardFile = value;
        },
        "--format": (current, value) => {
          current.format = parseFormat(value);
        },
        "--poll-interval-ms": (current, value) => {
          current.pollIntervalMs = parseInteger(value, "--poll-interval-ms", {
            allowZero: false,
          });
        },
        "--timeout-ms": (current, value) => {
          current.timeoutMs = parseInteger(value, "--timeout-ms", {
            allowZero: true,
          });
        },
      },
    },
  );

  if (options === "help") {
    console.log(HELP);
    return;
  }

  const source = openBoardSource(options);

  try {
    const handoff = await waitForBoard(source, {
      onWaiting: () =>
        process.stderr.write(
          `Waiting for the board to be sent (polling ${source.location} every ${options.pollIntervalMs}ms)...\n`,
        ),
      pollIntervalMs: options.pollIntervalMs,
      reset: options.reset,
      timeoutMs: options.timeoutMs,
    });
    process.stderr.write(
      `Board sent with ${handoff.items.length} instruction(s).\n`,
    );
    process.stdout.write(
      options.format === "json"
        ? `${JSON.stringify(handoff, null, 2)}\n`
        : handoff.instructions,
    );
  } catch (error: unknown) {
    if (error instanceof BoardWaitTimeoutError) {
      throw new CliError(error.message, 2);
    }
    throw error;
  }
};

runCli(main);
