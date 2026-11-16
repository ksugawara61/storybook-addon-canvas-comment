/**
 * Turns a story's argTypes (the component's props as Storybook knows them) into the
 * fields of the board's args editor.
 */
import type { ArgValue } from "./args-param.ts";

/** The parts of a Storybook argType the editor reads. */
export type ArgTypeLike = {
  action?: unknown;
  control?: unknown;
  description?: unknown;
  name?: unknown;
  options?: unknown;
  table?: unknown;
  type?: unknown;
};

export type ArgFieldKind = "boolean" | "color" | "number" | "select" | "text";

export type ArgOption = { label: string; value: boolean | number | string };

export type ArgField = {
  /** The component's default when the story does not set the prop, such as `"info"`. */
  defaultSummary: string;
  /** The story's own value, shown until the frame overrides it. */
  defaultValue: ArgValue;
  description: string;
  kind: ArgFieldKind;
  max?: number;
  min?: number;
  name: string;
  options: ArgOption[];
  required: boolean;
  step?: number;
  /** The prop's type, such as `"primary" | "secondary"`. */
  typeSummary: string;
};

export type ArgFields = {
  fields: ArgField[];
  /** Props the URL format cannot set, such as functions and objects. */
  unsupported: string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isPrimitive = (value: unknown): value is boolean | number | string =>
  typeof value === "boolean" ||
  typeof value === "number" ||
  typeof value === "string";

const toArgValue = (value: unknown): ArgValue =>
  value === null || value === undefined || isPrimitive(value)
    ? value
    : undefined;

const readNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const readControl = (
  control: unknown,
): { disabled: boolean; settings: Record<string, unknown>; type: string } => {
  if (control === false) {
    return { disabled: true, settings: {}, type: "" };
  }
  if (typeof control === "string") {
    return { disabled: false, settings: {}, type: control };
  }
  if (isRecord(control)) {
    return {
      disabled: control.disable === true,
      settings: control,
      type: typeof control.type === "string" ? control.type : "",
    };
  }
  return { disabled: false, settings: {}, type: "" };
};

const readOptions = (
  argType: ArgTypeLike,
  typeInfo: Record<string, unknown>,
  labels: unknown,
): ArgOption[] | undefined => {
  const values = Array.isArray(argType.options)
    ? argType.options
    : typeInfo.name === "enum" && Array.isArray(typeInfo.value)
      ? typeInfo.value
      : undefined;
  if (!values || values.length === 0 || !values.every(isPrimitive)) {
    return undefined;
  }
  const labelMap = isRecord(labels) ? labels : {};
  return values.map((value) => {
    const label = labelMap[String(value)];
    return {
      label: typeof label === "string" ? label : String(value),
      value,
    };
  });
};

const readSummary = (value: unknown): string | undefined =>
  isRecord(value) && typeof value.summary === "string" && value.summary !== ""
    ? value.summary
    : undefined;

// `raw` is the type as written, such as `"primary" | "secondary"`, where the table only says `union`.
const summarize = (
  typeInfo: Record<string, unknown>,
  table: Record<string, unknown>,
): string =>
  (typeof typeInfo.raw === "string" ? typeInfo.raw : undefined) ??
  readSummary(table.type) ??
  (typeof typeInfo.name === "string" ? typeInfo.name : "");

// Most `ReactNode` props, such as `children`, are text in a story.
const isReactNode = (
  typeInfo: Record<string, unknown>,
  typeSummary: string,
): boolean =>
  typeInfo.value === "ReactNode" ||
  /^(React\.)?ReactNode$/.test(typeSummary);

const pickKind = (
  controlType: string,
  typeName: string,
  hasOptions: boolean,
  defaultValue: ArgValue,
): ArgFieldKind | undefined => {
  switch (controlType) {
    case "boolean":
      return "boolean";
    case "number":
    case "range":
      return "number";
    case "color":
      return "color";
    case "text":
      return "text";
    case "select":
    case "radio":
    case "inline-radio":
      return hasOptions ? "select" : undefined;
    case "":
      break;
    default:
      // Multi-select, check, object, date and file controls set values the URL format does not cover here.
      return undefined;
  }
  if (hasOptions) {
    return "select";
  }
  switch (typeName) {
    case "boolean":
      return "boolean";
    case "number":
      return "number";
    case "string":
      return "text";
    case "":
    case "other":
      break;
    default:
      return undefined;
  }
  switch (typeof defaultValue) {
    case "boolean":
      return "boolean";
    case "number":
      return "number";
    case "string":
      return "text";
    default:
      return undefined;
  }
};

export const toArgFields = (
  argTypes: Record<string, ArgTypeLike>,
  initialArgs: Record<string, unknown> = {},
): ArgFields => {
  const fields: ArgField[] = [];
  const unsupported: string[] = [];
  for (const [name, argType] of Object.entries(argTypes)) {
    if (!isRecord(argType)) {
      continue;
    }
    const control = readControl(argType.control);
    const table = isRecord(argType.table) ? argType.table : {};
    if (control.disabled || table.disable === true) {
      continue;
    }
    const typeInfo = isRecord(argType.type) ? argType.type : {};
    const typeName = typeof typeInfo.name === "string" ? typeInfo.name : "";
    // Event handlers are functions, which a URL cannot set.
    if (argType.action !== undefined || typeName === "function") {
      unsupported.push(name);
      continue;
    }
    const defaultValue = toArgValue(initialArgs[name]);
    const options = readOptions(argType, typeInfo, control.settings.labels);
    const typeSummary = summarize(typeInfo, table);
    const kind =
      isReactNode(typeInfo, typeSummary) &&
      (initialArgs[name] === undefined || typeof initialArgs[name] === "string")
        ? "text"
        : pickKind(control.type, typeName, options !== undefined, defaultValue);
    if (!kind) {
      unsupported.push(name);
      continue;
    }
    fields.push({
      defaultSummary: readSummary(table.defaultValue) ?? "",
      defaultValue,
      description:
        typeof argType.description === "string" ? argType.description : "",
      kind,
      max: readNumber(control.settings.max),
      min: readNumber(control.settings.min),
      name,
      options: options ?? [],
      required: typeInfo.required === true,
      step: readNumber(control.settings.step),
      typeSummary,
    });
  }
  return { fields, unsupported };
};
