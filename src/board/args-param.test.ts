import { describe, expect, it } from "vitest";
import {
  decodeArgValue,
  encodeArgValue,
  getArg,
  isSafeArgString,
  parseArgsParam,
  setArgRaw,
} from "./args-param.ts";

describe("parseArgsParam", () => {
  it("splits args on ; and each arg on its first :", () => {
    expect(parseArgsParam("label:Save;disabled:!true;obj.key:a:b")).toEqual([
      { key: "label", raw: "Save" },
      { key: "disabled", raw: "!true" },
      { key: "obj.key", raw: "a:b" },
    ]);
  });

  it("skips empty parts", () => {
    expect(parseArgsParam(" ;label:Save; ")).toEqual([
      { key: "label", raw: "Save" },
    ]);
    expect(parseArgsParam("")).toEqual([]);
  });
});

describe("decodeArgValue / encodeArgValue", () => {
  it.each([
    ["!true", true],
    ["!false", false],
    ["!null", null],
    ["!undefined", undefined],
    ["42", 42],
    ["-1.5", -1.5],
    ["!hex(ff0000)", "#ff0000"],
    ["Add to cart", "Add to cart"],
  ])("decodes %s", (raw, value) => {
    expect(decodeArgValue(raw)).toBe(value);
  });

  it.each([
    [true, "!true"],
    [false, "!false"],
    [null, "!null"],
    [undefined, "!undefined"],
    [3, "3"],
    ["#ff0000", "!hex(ff0000)"],
    ["Add to cart", "Add to cart"],
  ])("encodes %s", (value, raw) => {
    expect(encodeArgValue(value)).toBe(raw);
  });

  it("does not encode values the URL format cannot hold", () => {
    expect(encodeArgValue("a;b")).toBeUndefined();
    expect(encodeArgValue("!important")).toBeUndefined();
    expect(encodeArgValue(Number.NaN)).toBeUndefined();
  });
});

describe("isSafeArgString", () => {
  it("accepts what Storybook applies from the URL", () => {
    expect(isSafeArgString("Add to cart")).toBe(true);
    expect(isSafeArgString("my_value-2")).toBe(true);
    expect(isSafeArgString("#fff")).toBe(true);
  });

  it("rejects what Storybook drops", () => {
    expect(isSafeArgString("Save!")).toBe(false);
    expect(isSafeArgString("<b>")).toBe(false);
  });
});

describe("getArg", () => {
  it("returns the raw and decoded value of an arg", () => {
    expect(getArg("label:Save;disabled:!true", "disabled")).toEqual({
      raw: "!true",
      value: true,
    });
    expect(getArg("label:Save", "disabled")).toBeUndefined();
  });
});

describe("setArgRaw", () => {
  it("replaces an arg in place", () => {
    expect(setArgRaw("label:Save;disabled:!true", "label", "Cancel")).toBe(
      "label:Cancel;disabled:!true",
    );
  });

  it("appends a new arg", () => {
    expect(setArgRaw("label:Save", "disabled", "!true")).toBe(
      "label:Save;disabled:!true",
    );
    expect(setArgRaw("", "label", "Save")).toBe("label:Save");
  });

  it("removes an arg when the value is undefined", () => {
    expect(setArgRaw("label:Save;disabled:!true", "label", undefined)).toBe(
      "disabled:!true",
    );
    expect(setArgRaw("label:Save", "size", undefined)).toBe("label:Save");
  });

  it("keeps args it does not understand", () => {
    expect(setArgRaw("obj.key:a;items[0]:b", "label", "Save")).toBe(
      "obj.key:a;items[0]:b;label:Save",
    );
  });
});
