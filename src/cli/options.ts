/** A small argv parser shared by the board CLIs. */
export type OptionSpec<T> = {
  flags?: Record<string, (options: T) => void>;
  values?: Record<string, (options: T, value: string) => void>;
};

export const parseOptions = <T>(
  args: string[],
  defaults: T,
  spec: OptionSpec<T>,
): T | "help" => {
  const options = { ...defaults };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? "";
    if (arg === "--") {
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      return "help";
    }
    const flag = spec.flags?.[arg];
    if (flag) {
      flag(options);
      continue;
    }
    const readValue = spec.values?.[arg];
    if (!readValue) {
      throw new Error(`Unknown option: ${arg}`);
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${arg} requires a value.`);
    }
    readValue(options, value);
    index += 1;
  }
  return options;
};

export const parseInteger = (
  value: string,
  option: string,
  { allowZero }: { allowZero: boolean },
): number => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < (allowZero ? 0 : 1)) {
    throw new Error(
      `${option} must be a ${allowZero ? "non-negative" : "positive"} integer.`,
    );
  }
  return parsed;
};

/** Runs a CLI's main function and turns a thrown error into a message and an exit code. */
export const runCli = (main: () => Promise<void>): void => {
  void (async () => {
    try {
      await main();
    } catch (error: unknown) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = error instanceof CliError ? error.exitCode : 1;
    }
  })();
};

export class CliError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode: number) {
    super(message);
    this.exitCode = exitCode;
  }
}
