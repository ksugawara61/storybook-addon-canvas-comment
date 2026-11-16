/**
 * The manager provides `react` as a global but not `react/jsx-runtime`,
 * so this file uses the classic JSX runtime (see src/manager.tsx).
 */
/** @jsxRuntime classic */
import React, { useEffect, useMemo, useState } from "react";
import { useTheme } from "storybook/theming";
import { type ArgField, toArgFields } from "../arg-fields.ts";
import {
  type ArgValue,
  encodeArgValue,
  getArg,
  isSafeArgString,
  setArgRaw,
} from "../args-param.ts";
import { useStoryArgTypes } from "./story-arg-types.ts";
import { inputStyle, type Theme } from "./styles.ts";

// Above this many props, a filter helps find one.
const FILTER_THRESHOLD = 8;

type Props = {
  args: string;
  /** Names the inputs, such as the frame or component name. */
  label: string;
  onChange: (args: string) => void;
  refId?: string;
  storyId: string;
};

/**
 * Edits a story's args with one input per prop, from the story's argTypes.
 * The raw `label:Save;disabled:!true` string stays available for what the inputs do not cover.
 */
export const ArgsEditor = ({
  args,
  label,
  onChange,
  refId = "",
  storyId,
}: Props) => {
  const theme = useTheme();
  const story = useStoryArgTypes(storyId, refId);
  const [filter, setFilter] = useState("");
  const { fields, unsupported } = useMemo(
    () =>
      story
        ? toArgFields(story.argTypes, story.initialArgs)
        : { fields: [], unsupported: [] },
    [story],
  );
  const query = filter.trim().toLowerCase();
  const shown = query
    ? fields.filter((field) => field.name.toLowerCase().includes(query))
    : fields;
  const hasFields = fields.length > 0;

  const raw = (
    <RawArgsInput
      args={args}
      label={`Args for ${label}`}
      onChange={onChange}
      theme={theme}
    />
  );
  if (!hasFields) {
    return (
      <div>
        {raw}
        <p style={hintStyle(theme)}>
          {story
            ? "This story has no props to set from the URL."
            : "Props appear here once the story loads. Until then, type args in Storybook's URL format, such as label:Save;disabled:!true."}
        </p>
      </div>
    );
  }

  return (
    <div>
      {fields.length > FILTER_THRESHOLD ? (
        <input
          aria-label={`Filter props of ${label}`}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filter props"
          style={{ ...inputStyle(theme), marginBottom: 6 }}
          type="search"
          value={filter}
        />
      ) : null}
      <div style={{ display: "grid", gap: 6 }}>
        {shown.map((field) => (
          <ArgRow
            args={args}
            field={field}
            key={field.name}
            onChange={onChange}
            owner={label}
            theme={theme}
          />
        ))}
      </div>
      {unsupported.length > 0 ? (
        <p style={hintStyle(theme)}>
          Not settable from the URL: {unsupported.join(", ")}
        </p>
      ) : null}
      <details style={{ marginTop: 6 }}>
        <summary
          style={{ color: theme.textMutedColor, cursor: "pointer", fontSize: 11 }}
        >
          Raw args
        </summary>
        <div style={{ marginTop: 4 }}>{raw}</div>
      </details>
    </div>
  );
};

const ArgRow = ({
  args,
  field,
  onChange,
  owner,
  theme,
}: {
  args: string;
  field: ArgField;
  onChange: (args: string) => void;
  /** The frame or component the arg belongs to, to tell same-named inputs apart. */
  owner: string;
  theme: Theme;
}) => {
  const current = getArg(args, field.name);
  const overridden = current !== undefined;
  const set = (value: ArgValue) => {
    const raw = encodeArgValue(value);
    if (raw !== undefined) {
      onChange(setArgRaw(args, field.name, raw));
    }
  };
  const reset = () => onChange(setArgRaw(args, field.name, undefined));
  const title = [field.typeSummary, field.description]
    .filter(Boolean)
    .join("\n");

  return (
    <div>
      <div
        style={{
          alignItems: "baseline",
          display: "flex",
          gap: 6,
          marginBottom: 2,
        }}
      >
        <span
          style={{
            color: overridden ? theme.color.defaultText : theme.textMutedColor,
            flex: 1,
            fontSize: 11,
            fontWeight: overridden ? 700 : 400,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={title || undefined}
        >
          {field.name}
          {field.required ? <span style={{ color: "#dc2626" }}> *</span> : null}
          {field.typeSummary ? (
            <span style={{ color: theme.textMutedColor, fontWeight: 400 }}>
              {" "}
              {field.typeSummary}
            </span>
          ) : null}
        </span>
        {overridden ? (
          <button
            aria-label={`Reset ${field.name} of ${owner}`}
            onClick={reset}
            style={{
              background: "transparent",
              border: 0,
              color: theme.color.secondary,
              cursor: "pointer",
              fontSize: 11,
              padding: 0,
            }}
            title="Use the story's value"
            type="button"
          >
            Reset
          </button>
        ) : null}
      </div>
      <ArgControl
        current={current?.value}
        field={field}
        name={`${field.name} of ${owner}`}
        overridden={overridden}
        set={set}
        theme={theme}
      />
      {field.description ? (
        <div
          style={{
            color: theme.textMutedColor,
            fontSize: 10,
            marginTop: 2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={field.description}
        >
          {field.description}
        </div>
      ) : null}
    </div>
  );
};

const ArgControl = ({
  current,
  field,
  name,
  overridden,
  set,
  theme,
}: {
  current: ArgValue;
  field: ArgField;
  /** The accessible name of the input. */
  name: string;
  overridden: boolean;
  set: (value: ArgValue) => void;
  theme: Theme;
}) => {
  const value = overridden
    ? current
    : (field.defaultValue ?? (field.defaultSummary === "true" || undefined));
  switch (field.kind) {
    case "boolean":
      return (
        <label
          style={{ alignItems: "center", display: "flex", gap: 6 }}
        >
          <input
            aria-label={name}
            checked={value === true}
                onChange={(event) => set(event.target.checked)}
            type="checkbox"
          />
          <span style={{ color: theme.textMutedColor, fontSize: 11 }}>
            {value === true ? "true" : "false"}
          </span>
        </label>
      );
    case "select": {
      const index = overridden
        ? field.options.findIndex((option) => option.value === current)
        : -1;
      return (
        <select
          aria-label={name}
            onChange={(event) => {
            const option = field.options[Number(event.target.value)];
            if (option) {
              set(option.value);
            }
          }}
          style={inputStyle(theme)}
          value={index === -1 ? "" : String(index)}
        >
          <option value="">
            {placeholderOf(field)
              ? `(default: ${placeholderOf(field)})`
              : "(default)"}
          </option>
          {field.options.map((option, i) => (
            <option key={String(option.value)} value={String(i)}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }
    case "number":
      return (
        <DraftInput
            name={name}
          onCommit={(text) => {
            if (text.trim() === "") {
              return;
            }
            const next = Number(text);
            if (Number.isFinite(next)) {
              set(next);
            }
          }}
          placeholder={placeholderOf(field)}
          theme={theme}
          type="number"
          validate={() => undefined}
          value={overridden && typeof current === "number" ? String(current) : ""}
          inputProps={{ max: field.max, min: field.min, step: field.step }}
        />
      );
    case "color":
    case "text":
      return (
        <DraftInput
            name={name}
          onCommit={(text) => {
            if (text !== "") {
              set(text);
            }
          }}
          placeholder={placeholderOf(field)}
          theme={theme}
          type="text"
          validate={(text) => {
            if (text === "" || isSafeArgString(text)) {
              return undefined;
            }
            return encodeArgValue(text) === undefined
              ? "Cannot contain ; or start with !"
              : "Storybook ignores URL args with characters other than letters, numbers, spaces, _ and -.";
          }}
          value={overridden && current !== undefined && current !== null ? String(current) : ""}
        />
      );
  }
};

/** The value the story renders with when the frame does not override it. */
const placeholderOf = (field: ArgField): string =>
  field.defaultValue === undefined || field.defaultValue === null
    ? field.defaultSummary.replace(/^"(.*)"$/, "$1")
    : String(field.defaultValue);

/** An input that applies its value on blur or Enter, so the frame does not reload on every key. */
const DraftInput = ({
  inputProps,
  name,
  onCommit,
  placeholder,
  theme,
  type,
  validate,
  value,
}: {
  inputProps?: { max?: number; min?: number; step?: number };
  name: string;
  onCommit: (text: string) => void;
  placeholder: string;
  theme: Theme;
  type: "number" | "text";
  validate: (text: string) => string | undefined;
  value: string;
}) => {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const problem = validate(draft);
  const commit = () => {
    if (draft !== value) {
      onCommit(draft);
    }
  };
  return (
    <div>
      <input
        aria-invalid={problem ? true : undefined}
        aria-label={name}
        onBlur={commit}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            commit();
          }
        }}
        placeholder={placeholder}
        style={{
          ...inputStyle(theme),
          ...(problem ? { borderColor: "#dc2626" } : {}),
        }}
        type={type}
        value={draft}
        {...inputProps}
      />
      {problem ? (
        <div style={{ color: "#dc2626", fontSize: 10, marginTop: 2 }}>
          {problem}
        </div>
      ) : null}
    </div>
  );
};

const RawArgsInput = ({
  args,
  label,
  onChange,
  theme,
}: {
  args: string;
  label: string;
  onChange: (args: string) => void;
  theme: Theme;
}) => {
  const [draft, setDraft] = useState(args);
  useEffect(() => setDraft(args), [args]);
  const commit = () => {
    if (draft !== args) {
      onChange(draft);
    }
  };
  return (
    <input
      aria-label={label}
      onBlur={commit}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          commit();
        }
      }}
      placeholder="label:Save;disabled:!true"
      style={inputStyle(theme)}
      value={draft}
    />
  );
};

const hintStyle = (theme: Theme) => ({
  color: theme.textMutedColor,
  fontSize: 10,
  margin: "4px 0 0",
});
