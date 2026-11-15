import { describe, expect, it } from "vitest";
import {
  buildLibrary,
  componentNameFromTitle,
  type DesignSystem,
  filterLibrary,
  type IndexEntryLike,
  normalizeDesignSystems,
  parseDesignSystems,
} from "./design-system.ts";

const story = (id: string, title: string, name: string): IndexEntryLike => ({
  id,
  name,
  title,
  type: "story",
});

const toIndex = (entries: IndexEntryLike[]) =>
  Object.fromEntries(entries.map((entry) => [entry.id, entry]));

const localSystem: DesignSystem = {
  importPath: "@example/ui",
  name: "Example UI",
  ref: undefined,
  titlePrefix: "UI/",
};

describe("normalizeDesignSystems", () => {
  it("defaults importPath to the name and drops entries without a name", () => {
    expect(
      normalizeDesignSystems([
        { name: "@acme/ui", ref: "ui" },
        { name: " " },
        "not an object",
      ]),
    ).toEqual([
      { importPath: "@acme/ui", name: "@acme/ui", ref: "ui", titlePrefix: "" },
    ]);
  });

  it("reads the JSON the preset passes to the manager, and ignores broken JSON", () => {
    expect(parseDesignSystems('[{"name":"Example UI","titlePrefix":"UI/"}]'))
      .toEqual([{ ...localSystem, importPath: "Example UI" }]);
    expect(parseDesignSystems("{")).toEqual([]);
    expect(parseDesignSystems(undefined)).toEqual([]);
  });
});

describe("componentNameFromTitle", () => {
  it.each([
    ["UI/Alert", "Alert"],
    ["UI/Forms/TextField", "TextField"],
    ["buttons/primary-button", "PrimaryButton"],
    ["data-display/count_badge", "CountBadge"],
    ["layout/card", "Card"],
  ])("names %s as %s", (title, expected) => {
    expect(componentNameFromTitle(title)).toBe(expected);
  });
});

describe("buildLibrary", () => {
  const index = toIndex([
    story("ui-alert--info", "UI/Alert", "Info"),
    story("ui-alert--warning", "UI/Alert", "Warning"),
    story("ui-badge--default", "UI/Badge", "Default"),
    story("example-signupform--default", "Example/SignupForm", "Default"),
    { id: "ui-alert--docs", name: "Docs", title: "UI/Alert", type: "docs" },
  ]);

  it("groups the stories under the title prefix by component", () => {
    const [group] = buildLibrary([localSystem], index, undefined);

    expect(group?.status).toBe("ready");
    expect(group?.components).toEqual([
      {
        componentName: "Alert",
        designSystem: "Example UI",
        importPath: "@example/ui",
        refId: undefined,
        stories: [
          { name: "Info", storyId: "ui-alert--info" },
          { name: "Warning", storyId: "ui-alert--warning" },
        ],
        title: "UI/Alert",
      },
      expect.objectContaining({ componentName: "Badge" }),
    ]);
  });

  it("reads a composed Storybook's index for a design system with ref", () => {
    const remote: DesignSystem = {
      importPath: "@acme/ui",
      name: "@acme/ui",
      ref: "ui",
      titlePrefix: "",
    };
    const refIndex = toIndex([
      story("buttons-primary-button--default", "buttons/primary-button", "Default"),
    ]);

    expect(
      buildLibrary([remote], index, { ui: { index: refIndex } })[0],
    ).toMatchObject({
      components: [{ componentName: "PrimaryButton", refId: "ui" }],
      status: "ready",
    });
    expect(buildLibrary([remote], index, { ui: {} })[0]?.status).toBe(
      "loading",
    );
    expect(buildLibrary([remote], index, {})[0]?.status).toBe("missing");
    expect(
      buildLibrary([remote], index, { ui: { indexError: new Error("CORS") } })[0]
        ?.status,
    ).toBe("missing");
  });
});

describe("filterLibrary", () => {
  it("keeps the stories whose component or story name matches every word", () => {
    const groups = buildLibrary(
      [localSystem],
      toIndex([
        story("ui-alert--info", "UI/Alert", "Info"),
        story("ui-alert--warning", "UI/Alert", "Warning"),
        story("ui-badge--default", "UI/Badge", "Default"),
      ]),
      undefined,
    );

    expect(
      filterLibrary(groups, "alert warn")[0]?.components.map((component) => ({
        name: component.componentName,
        stories: component.stories.map((item) => item.name),
      })),
    ).toEqual([{ name: "Alert", stories: ["Warning"] }]);
  });
});
