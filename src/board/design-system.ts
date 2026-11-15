/**
 * A design system whose components can be dragged from the board's component library onto frames.
 * Set with the preset option `designSystems`.
 */
export type DesignSystemOption = {
  /** Module the components are imported from, written into the instructions. Defaults to `name`. */
  importPath?: string;
  /** Shown in the component library, such as `@acme/ui`. */
  name: string;
  /**
   * Id of a composed Storybook (`refs` in `.storybook/main.ts`) that holds the design system's stories.
   * Leave it out when the stories are in this Storybook.
   */
  ref?: string;
  /** Only stories whose title starts with this, such as `UI/`. Leave it out to use every story. */
  titlePrefix?: string;
};

export type DesignSystem = {
  importPath: string;
  name: string;
  ref: string | undefined;
  titlePrefix: string;
};

/** One story of a component: a variant to drag onto a frame. */
export type LibraryStory = {
  name: string;
  storyId: string;
};

export type LibraryComponent = {
  componentName: string;
  designSystem: string;
  importPath: string;
  refId: string | undefined;
  stories: LibraryStory[];
  title: string;
};

export type LibraryGroup = {
  components: LibraryComponent[];
  designSystem: DesignSystem;
  /** ready: the index is loaded / loading: a composed Storybook is still loading / missing: no such ref */
  status: "loading" | "missing" | "ready";
};

/** The parts of a Storybook index entry the library uses. */
export type IndexEntryLike = {
  id: string;
  name: string;
  title?: string;
  type: string;
};

export type RefLike = {
  index?: Record<string, IndexEntryLike>;
  indexError?: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const optionalString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;

export const normalizeDesignSystems = (raw: unknown): DesignSystem[] =>
  (Array.isArray(raw) ? raw : []).flatMap((item): DesignSystem[] => {
    const name = isRecord(item) ? optionalString(item.name) : undefined;
    if (!isRecord(item) || !name) {
      return [];
    }
    return [
      {
        importPath: optionalString(item.importPath) ?? name,
        name,
        ref: optionalString(item.ref),
        titlePrefix: typeof item.titlePrefix === "string" ? item.titlePrefix : "",
      },
    ];
  });

/** Reads the design systems the preset passed to the manager as a JSON string. */
export const parseDesignSystems = (json: string | undefined): DesignSystem[] => {
  if (!json) {
    return [];
  }
  try {
    return normalizeDesignSystems(JSON.parse(json));
  } catch {
    return [];
  }
};

/**
 * Guesses the exported component name from a story title.
 * `UI/Alert` gives `Alert`, and an auto title such as `buttons/primary-button` gives `PrimaryButton`.
 */
export const componentNameFromTitle = (title: string): string => {
  const last = title.split("/").pop()?.trim() ?? "";
  const words = last.split(/[\s_-]+/).filter(Boolean);
  if (words.length <= 1) {
    const word = words[0] ?? "";
    return word.charAt(0).toUpperCase() + word.slice(1);
  }
  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("");
};

const toComponents = (
  designSystem: DesignSystem,
  entries: IndexEntryLike[],
): LibraryComponent[] => {
  const byTitle = new Map<string, LibraryComponent>();
  for (const entry of entries) {
    const title = entry.title;
    if (
      entry.type !== "story" ||
      title === undefined ||
      !title.startsWith(designSystem.titlePrefix)
    ) {
      continue;
    }
    const component = byTitle.get(title) ?? {
      componentName: componentNameFromTitle(title),
      designSystem: designSystem.name,
      importPath: designSystem.importPath,
      refId: designSystem.ref,
      stories: [],
      title,
    };
    component.stories.push({ name: entry.name, storyId: entry.id });
    byTitle.set(title, component);
  }
  return [...byTitle.values()];
};

/**
 * Lists each design system's components from the Storybook index,
 * or from the index of a composed Storybook for a design system with `ref`.
 */
export const buildLibrary = (
  designSystems: DesignSystem[],
  index: Record<string, IndexEntryLike> | undefined,
  refs: Record<string, RefLike> | undefined,
): LibraryGroup[] =>
  designSystems.map((designSystem) => {
    if (designSystem.ref === undefined) {
      return {
        components: toComponents(designSystem, Object.values(index ?? {})),
        designSystem,
        status: index ? "ready" : "loading",
      };
    }
    const ref = refs?.[designSystem.ref];
    if (!ref || ref.indexError) {
      return { components: [], designSystem, status: "missing" };
    }
    return {
      components: toComponents(designSystem, Object.values(ref.index ?? {})),
      designSystem,
      status: ref.index ? "ready" : "loading",
    };
  });

/** Keeps the components whose title or story name has every word of the query. */
export const filterLibrary = (
  groups: LibraryGroup[],
  query: string,
): LibraryGroup[] => {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return groups;
  }
  const matches = (text: string) =>
    words.every((word) => text.toLowerCase().includes(word));
  return groups.map((group) => ({
    ...group,
    components: group.components.flatMap((component) => {
      const stories = component.stories.filter((story) =>
        matches(`${component.title} ${component.componentName} ${story.name}`),
      );
      return stories.length > 0 ? [{ ...component, stories }] : [];
    }),
  }));
};
