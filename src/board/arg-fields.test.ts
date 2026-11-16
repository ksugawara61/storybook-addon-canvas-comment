import { describe, expect, it } from "vitest";
import { toArgFields } from "./arg-fields.ts";

describe("toArgFields", () => {
  it("picks an input for each prop from its control and type", () => {
    const { fields, unsupported } = toArgFields(
      {
        children: {
          control: { type: "text" },
          description: "The button label",
          table: { type: { summary: "ReactNode" } },
          type: { name: "string", required: true },
        },
        count: { control: { max: 10, min: 0, type: "range" } },
        disabled: { type: { name: "boolean" } },
        variant: {
          control: { type: "select" },
          options: ["primary", "secondary"],
          table: { type: { summary: '"primary" | "secondary"' } },
        },
      },
      { children: "Save changes", variant: "primary" },
    );

    expect(fields).toEqual([
      {
        defaultSummary: "",
        defaultValue: "Save changes",
        description: "The button label",
        kind: "text",
        max: undefined,
        min: undefined,
        name: "children",
        options: [],
        required: true,
        step: undefined,
        typeSummary: "ReactNode",
      },
      expect.objectContaining({ kind: "number", max: 10, min: 0, name: "count" }),
      expect.objectContaining({
        defaultValue: undefined,
        kind: "boolean",
        name: "disabled",
        typeSummary: "boolean",
      }),
      expect.objectContaining({
        defaultValue: "primary",
        kind: "select",
        name: "variant",
        options: [
          { label: "primary", value: "primary" },
          { label: "secondary", value: "secondary" },
        ],
        typeSummary: '"primary" | "secondary"',
      }),
    ]);
    expect(unsupported).toEqual([]);
  });

  it("shows the type as written and the component's default", () => {
    const { fields } = toArgFields({
      tone: {
        control: { type: "radio" },
        options: ["danger", "info"],
        table: { defaultValue: { summary: '"info"' }, type: { summary: "union" } },
        type: { name: "enum", raw: '"danger" | "info"', value: ["danger", "info"] },
      },
    });
    expect(fields[0]).toMatchObject({
      defaultSummary: '"info"',
      kind: "select",
      typeSummary: '"danger" | "info"',
    });
  });

  it("edits ReactNode props such as children as text", () => {
    const { fields, unsupported } = toArgFields(
      {
        children: {
          control: { type: "object" },
          table: { type: { summary: "ReactNode" } },
          type: { name: "other", value: "ReactNode" },
        },
        icon: {
          control: { type: "object" },
          type: { name: "other", value: "ReactNode" },
        },
      },
      { children: "You can cancel any time", icon: { type: "svg" } },
    );
    expect(fields.map((field) => [field.name, field.kind])).toEqual([
      ["children", "text"],
    ]);
    expect(unsupported).toEqual(["icon"]);
  });

  it("reads options from an enum type and labels from the control", () => {
    const { fields } = toArgFields({
      size: {
        control: { labels: { sm: "Small" }, type: "radio" },
        type: { name: "enum", value: ["sm", "lg"] },
      },
    });
    expect(fields[0]?.options).toEqual([
      { label: "Small", value: "sm" },
      { label: "lg", value: "lg" },
    ]);
  });

  it("lists functions, objects and multi-selects as unsupported", () => {
    const { fields, unsupported } = toArgFields({
      onClick: { action: "clicked", type: { name: "function" } },
      onHover: { type: { name: "function" } },
      style: { control: { type: "object" }, type: { name: "object" } },
      tags: { control: { type: "check" }, options: ["a", "b"] },
    });
    expect(fields).toEqual([]);
    expect(unsupported).toEqual(["onClick", "onHover", "style", "tags"]);
  });

  it("skips props with the control or table disabled", () => {
    const { fields, unsupported } = toArgFields({
      hidden: { table: { disable: true }, type: { name: "string" } },
      internal: { control: false, type: { name: "string" } },
    });
    expect(fields).toEqual([]);
    expect(unsupported).toEqual([]);
  });

  it("falls back to the story's value when the type is unknown", () => {
    const { fields, unsupported } = toArgFields(
      { flag: {}, label: { type: { name: "other" } }, data: {} },
      { data: { a: 1 }, flag: true, label: "Hi" },
    );
    expect(fields.map((field) => [field.name, field.kind])).toEqual([
      ["flag", "boolean"],
      ["label", "text"],
    ]);
    expect(unsupported).toEqual(["data"]);
  });
});
