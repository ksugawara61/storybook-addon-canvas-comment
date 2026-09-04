import { describe, expect, it } from "vitest";
import { canvasCommentsPlugin } from "./vite-plugin.ts";

describe("canvasCommentsPlugin", () => {
  const plugin = canvasCommentsPlugin({ projectRoot: "/project" });
  const transform = plugin.transform as (code: string, id: string) => unknown;

  it.each([
    {
      code: "const x = 1;",
      id: "/project/src/utils.ts",
      name: "returns null for non-JSX files",
    },
    {
      code: "const X = () => <div/>;",
      id: "/project/node_modules/pkg/index.tsx",
      name: "returns null for node_modules paths",
    },
    {
      code: "const x = 1;",
      id: "/project/src/utils.tsx",
      name: "returns null for files without component patterns",
    },
  ])("$name", ({ code, id }) => {
    expect(transform.call(plugin, code, id)).toBeNull();
  });

  it("appends metadata for component files", () => {
    const code = "export function Button() { return <div />; }";
    const result = transform.call(
      plugin,
      code,
      "/project/src/components/Button.tsx",
    ) as {
      code: string;
    };
    expect(result).not.toBeNull();
    expect(result.code).toContain('source="src/components/Button.tsx"');
    expect(result.code).toContain('component="Button"');
  });

  it("uses custom projectRoot for relative paths", () => {
    const customPlugin = canvasCommentsPlugin({ projectRoot: "/custom/root" });
    const customTransform = customPlugin.transform as (
      code: string,
      id: string,
    ) => unknown;
    const code = "export const Card = () => <div />;";
    const result = customTransform.call(
      customPlugin,
      code,
      "/custom/root/packages/ui/Card.tsx",
    ) as {
      code: string;
    };
    expect(result.code).toContain('source="packages/ui/Card.tsx"');
  });
});
