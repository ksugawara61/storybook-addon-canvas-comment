import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import type TypeScript from "typescript";
import {
  type DesignSystemOption,
  LIBRARY_TAG,
  libraryTitlePrefix,
} from "./design-system.ts";

/** Where the preset writes the stories of libraries without stories, under the directory Storybook runs in. */
export const LIBRARY_CACHE_RELATIVE_PATH =
  "node_modules/.cache/storybook-addon-canvas-comments/library";

/** A design system option with `components`: a library without stories. */
export type LibraryOption = DesignSystemOption & {
  components: "auto" | string[];
};

export const isLibraryOption = (
  option: DesignSystemOption,
): option is LibraryOption =>
  typeof option.name === "string" &&
  option.name.trim() !== "" &&
  (option.components === "auto" || Array.isArray(option.components));

/** A component name that can be imported by name and used as a JSX tag. */
const COMPONENT_NAME = /^[A-Z][A-Za-z0-9_$]*$/;

const loadTypeScript = (fromDir: string): typeof TypeScript => {
  // Prefer the project's TypeScript, so the addon needs no dependency on it.
  for (const base of [join(fromDir, "package.json"), import.meta.url]) {
    try {
      return createRequire(base)("typescript") as typeof TypeScript;
    } catch {
      // Try the next place.
    }
  }
  throw new Error(
    'components: "auto" reads the exports with TypeScript, which is not installed. Install typescript or list the components.',
  );
};

/**
 * Lists the components a module exports: value exports with a capitalized name that can be called
 * or constructed, such as function components, `forwardRef` / `memo` components and classes.
 * Reads the module's TypeScript source or its type declarations.
 */
export const listExportedComponents = (
  importPath: string,
  fromDir: string,
): string[] => {
  const ts = loadTypeScript(fromDir);
  const compilerOptions: TypeScript.CompilerOptions = {
    allowJs: true,
    jsx: ts.JsxEmit.Preserve,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    noEmit: true,
    resolveJsonModule: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2022,
  };
  const resolved = ts.resolveModuleName(
    importPath,
    join(fromDir, "canvas-comments-library.ts"),
    compilerOptions,
    ts.sys,
  ).resolvedModule;
  if (!resolved) {
    throw new Error(
      `Could not resolve "${importPath}" from ${fromDir}. List its components in \`components\` instead of "auto".`,
    );
  }
  const program = ts.createProgram([resolved.resolvedFileName], compilerOptions);
  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile(resolved.resolvedFileName);
  const moduleSymbol = sourceFile && checker.getSymbolAtLocation(sourceFile);
  if (!sourceFile || !moduleSymbol) {
    return [];
  }
  const valueFlags =
    ts.SymbolFlags.Function | ts.SymbolFlags.Variable | ts.SymbolFlags.Class;
  const isComponent = (symbol: TypeScript.Symbol): boolean => {
    const target =
      symbol.flags & ts.SymbolFlags.Alias
        ? checker.getAliasedSymbol(symbol)
        : symbol;
    if (!COMPONENT_NAME.test(symbol.name) || !(target.flags & valueFlags)) {
      return false;
    }
    const type = checker.getTypeOfSymbolAtLocation(target, sourceFile);
    return (
      type.getCallSignatures().length > 0 ||
      type.getConstructSignatures().length > 0
    );
  };
  return checker
    .getExportsOfModule(moduleSymbol)
    .filter(isComponent)
    .map((symbol) => symbol.name)
    .sort((a, b) => a.localeCompare(b));
};

/** The story the preset writes for one component. */
export const libraryStorySource = (
  option: Pick<DesignSystemOption, "importPath" | "name">,
  componentName: string,
  args: Record<string, unknown> | undefined,
): string => {
  const importPath = option.importPath?.trim() || option.name.trim();
  const meta = {
    tags: [LIBRARY_TAG, "!autodocs", "!test"],
    title: `${libraryTitlePrefix(option.name.trim())}${componentName}`,
  };
  return [
    "// Written by storybook-addon-canvas-comments for the board's component library. Do not edit.",
    `import { ${componentName} as Component } from ${JSON.stringify(importPath)};`,
    "",
    "export default {",
    "  component: Component,",
    `  tags: ${JSON.stringify(meta.tags)},`,
    `  title: ${JSON.stringify(meta.title)},`,
    "};",
    "",
    `export const Default = { args: ${JSON.stringify(args ?? {})} };`,
    "",
  ].join("\n");
};

const directoryName = (name: string): string => {
  const slug = name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const hash = createHash("sha256").update(name).digest("hex").slice(0, 8);
  return `${slug || "library"}-${hash}`;
};

const writeIfChanged = async (path: string, content: string): Promise<void> => {
  try {
    if ((await readFile(path, "utf8")) === content) {
      return;
    }
  } catch {
    // Not written yet.
  }
  await writeFile(path, content);
};

/** Resolves a library's component names: the listed ones, or the exports for "auto". */
export const resolveLibraryComponents = (
  option: LibraryOption,
  fromDir: string,
): string[] => {
  const exclude = new Set(option.exclude ?? []);
  const names =
    option.components === "auto"
      ? listExportedComponents(option.importPath?.trim() || option.name.trim(), fromDir)
      : option.components;
  return [...new Set(names)].filter(
    (name) => COMPONENT_NAME.test(name) && !exclude.has(name),
  );
};

/**
 * Writes a story for each component of a library without stories, and removes stale ones.
 * Returns the directory that holds them, to add to Storybook's `stories`, or undefined without components.
 * The files are rewritten only when their content changes, so Storybook does not re-index.
 */
export const writeLibraryStories = async (
  option: LibraryOption,
  workingDir: string,
): Promise<string | undefined> => {
  const directory = resolve(
    workingDir,
    LIBRARY_CACHE_RELATIVE_PATH,
    directoryName(option.name.trim()),
  );
  const components = resolveLibraryComponents(option, workingDir);
  const fileNames = new Set(
    components.map((name) => `${name}.stories.js`),
  );
  await mkdir(directory, { recursive: true });
  const stale = (await readdir(directory)).filter((file) => !fileNames.has(file));
  await Promise.all(
    stale.map((file) => rm(join(directory, file), { force: true })),
  );
  await Promise.all(
    components.map((name) =>
      writeIfChanged(
        join(directory, `${name}.stories.js`),
        libraryStorySource(option, name, option.args?.[name]),
      ),
    ),
  );
  return components.length > 0 ? directory : undefined;
};

/** The `stories` entries for the libraries without stories. A library that fails is skipped with a warning. */
export const libraryStoriesEntries = async (
  options: DesignSystemOption[],
  workingDir: string,
): Promise<{ directory: string; files: string }[]> => {
  const directories = await Promise.all(
    options.filter(isLibraryOption).map(async (option) => {
      try {
        return await writeLibraryStories(option, workingDir);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(
          `[storybook-addon-canvas-comments] Skipped the design system "${option.name}": ${message}`,
        );
        return undefined;
      }
    }),
  );
  return directories
    .filter((directory): directory is string => directory !== undefined)
    .map((directory) => ({ directory, files: "*.stories.js" }));
};
