import { BOARD_SOURCE_HELP, openBoardSource } from "./board-source.ts";
import { parseOptions, runCli } from "./options.ts";

const HELP = `Usage:
  canvas-comments-board-resolve (--ids <id,id,...> | --all) [options]

Removes board instructions that have been applied to the code: element edits,
components to add, and notes. Frames stay, so the board shows the stories as the
code now renders them. A Storybook board page that is open picks up the change
within a few seconds.

Prints the removed items as JSON.

Options:
  --ids <id,id,...>           Ids of the items to remove, from the "items" of
                              canvas-comments-wait-board --format json.
                              Repeat the option or separate ids with commas.
  --all                       Remove every instruction on every board.
${BOARD_SOURCE_HELP}
  --help                      Show this help.
`;

type Options = {
  all: boolean;
  apiUrl?: string;
  boardFile?: string;
  ids: string[];
};

const main = async () => {
  const options = parseOptions<Options>(
    process.argv.slice(2),
    { all: false, ids: [] },
    {
      flags: {
        "--all": (current) => {
          current.all = true;
        },
      },
      values: {
        "--api-url": (current, value) => {
          current.apiUrl = value;
        },
        "--board-file": (current, value) => {
          current.boardFile = value;
        },
        "--ids": (current, value) => {
          current.ids = [
            ...current.ids,
            ...value
              .split(",")
              .map((id) => id.trim())
              .filter(Boolean),
          ];
        },
      },
    },
  );

  if (options === "help") {
    console.log(HELP);
    return;
  }

  if (options.all === (options.ids.length > 0)) {
    throw new Error("Pass either --ids <id,id,...> or --all.");
  }

  const resolved = await openBoardSource(options).resolve(
    options.all ? undefined : new Set(options.ids),
  );

  const missing = options.ids.filter(
    (id) => !resolved.some((item) => item.id === id),
  );
  if (missing.length > 0) {
    process.stderr.write(
      `Not found (already removed?): ${missing.join(", ")}\n`,
    );
  }
  console.log(JSON.stringify({ resolved }, null, 2));
};

runCli(main);
