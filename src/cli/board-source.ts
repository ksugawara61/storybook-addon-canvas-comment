import { boardPathsFromFile, createBoardPaths } from "../board/api.ts";
import { type BoardSource, fsBoardSource } from "../board/board-watch.ts";
import { BoardApiClient } from "../board/board-api-client.ts";

export const BOARD_SOURCE_HELP = `  --board-file <path>         Path to board.json, which holds the review status
                              too. Defaults to .storybook/canvas-comments/board.json
                              relative to the current working directory.
  --api-url <url>             Use a hosted board API (Cloudflare Pages + R2)
                              instead of board.json. Takes the same comments URL
                              as the other CLIs, e.g.
                              https://<host>/api/canvas-comments/<app>/comments,
                              or the board URL ending in /board. Sends
                              CF_ACCESS_CLIENT_ID / CF_ACCESS_CLIENT_SECRET as
                              Cloudflare Access headers when they are set.`;

/** board.json by default, `--board-file`, or the hosted API with `--api-url`. */
export const openBoardSource = (options: {
  apiUrl?: string;
  boardFile?: string;
}): BoardSource => {
  if (options.apiUrl && options.boardFile) {
    throw new Error("Pass either --board-file or --api-url, not both.");
  }
  if (options.apiUrl) {
    return new BoardApiClient(options.apiUrl);
  }
  return fsBoardSource(
    options.boardFile ? boardPathsFromFile(options.boardFile) : createBoardPaths(),
  );
};
