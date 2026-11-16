/**
 * Reads and writes the `args` URL param of a story, such as `label:Save;disabled:!true`.
 * It handles the flat values the board's args editor sets; other entries (nested keys,
 * dates, colors) are kept as they were typed.
 */

export type ArgValue = boolean | null | number | string | undefined;

export type ArgsEntry = { key: string; raw: string };

// Storybook drops URL args whose keys or string values have other characters.
const SAFE_PATTERN = /^[a-zA-Z0-9 _-]*$/;
const NUMBER_PATTERN = /^-?[0-9]+(\.[0-9]+)?$/;
const HEX_PATTERN = /^#([a-f0-9]{3,4}|[a-f0-9]{6}|[a-f0-9]{8})$/i;

export const parseArgsParam = (args: string): ArgsEntry[] =>
  args
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const index = part.indexOf(":");
      return index === -1
        ? { key: part, raw: "" }
        : { key: part.slice(0, index).trim(), raw: part.slice(index + 1) };
    })
    .filter((entry) => entry.key !== "");

export const stringifyArgsParam = (entries: ArgsEntry[]): string =>
  entries.map((entry) => `${entry.key}:${entry.raw}`).join(";");

/** The value Storybook reads from a raw URL arg value. */
export const decodeArgValue = (raw: string): ArgValue => {
  switch (raw) {
    case "!true":
      return true;
    case "!false":
      return false;
    case "!null":
      return null;
    case "!undefined":
      return undefined;
  }
  if (raw.startsWith("!hex(") && raw.endsWith(")")) {
    return `#${raw.slice(5, -1)}`;
  }
  return NUMBER_PATTERN.test(raw) ? Number(raw) : raw;
};

/** The raw URL arg value for a value, or `undefined` when the URL format cannot hold it. */
export const encodeArgValue = (value: ArgValue): string | undefined => {
  if (value === undefined) {
    return "!undefined";
  }
  if (value === null) {
    return "!null";
  }
  if (typeof value === "boolean") {
    return `!${value}`;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : undefined;
  }
  if (HEX_PATTERN.test(value)) {
    return `!hex(${value.slice(1)})`;
  }
  // `;` separates args and a leading `!` marks a special value, so neither can be written.
  return value.includes(";") || value.startsWith("!") ? undefined : value;
};

/** Whether Storybook applies this string value, or drops it as a potentially unsafe URL arg. */
export const isSafeArgString = (value: string): boolean =>
  SAFE_PATTERN.test(value) ||
  NUMBER_PATTERN.test(value) ||
  HEX_PATTERN.test(value);

export const getArg = (
  args: string,
  key: string,
): { raw: string; value: ArgValue } | undefined => {
  const entry = parseArgsParam(args).find((item) => item.key === key);
  return entry ? { raw: entry.raw, value: decodeArgValue(entry.raw) } : undefined;
};

/**
 * Sets one arg and keeps the others in place. A raw value of `undefined` removes the arg,
 * so the story's own value applies again.
 */
export const setArgRaw = (
  args: string,
  key: string,
  raw: string | undefined,
): string => {
  const entries = parseArgsParam(args);
  const index = entries.findIndex((entry) => entry.key === key);
  if (raw === undefined) {
    return index === -1
      ? stringifyArgsParam(entries)
      : stringifyArgsParam(entries.filter((_, i) => i !== index));
  }
  if (index === -1) {
    return stringifyArgsParam([...entries, { key, raw }]);
  }
  return stringifyArgsParam(
    entries.map((entry, i) => (i === index ? { key, raw } : entry)),
  );
};
