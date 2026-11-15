// Checks a packed tarball before it is published.
// Projects that install the package must not need `allowBuilds`, so the
// tarball has to ship the built dist/ and declare no install-time scripts.
//
// Usage: node .github/scripts/verify-package.mjs <package.tgz>
import { execFileSync } from "node:child_process";

const tarball = process.argv[2];
if (!tarball) {
  console.error("Usage: node verify-package.mjs <package.tgz>");
  process.exit(2);
}

const files = new Set(
  execFileSync("tar", ["-tzf", tarball], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean)
    .map((file) => file.replace(/^package\//, "")),
);
const pkg = JSON.parse(
  execFileSync("tar", ["-xzOf", tarball, "package/package.json"], { encoding: "utf8" }),
);

const errors = [];

const entries = [
  pkg.main,
  pkg.types,
  ...Object.values(pkg.exports ?? {}).flatMap((entry) =>
    typeof entry === "string" ? [entry] : Object.values(entry),
  ),
  ...Object.values(pkg.bin ?? {}),
  "dist/manager.js",
  "dist/board-manager.js",
  "dist/preview.js",
];
for (const entry of new Set(entries)) {
  const file = entry.replace(/^\.\//, "");
  if (!files.has(file)) errors.push(`missing ${file}`);
}

for (const script of ["preinstall", "install", "postinstall", "prepare"]) {
  if (pkg.scripts?.[script]) {
    errors.push(`scripts.${script} runs when the package is installed`);
  }
}

if (errors.length > 0) {
  console.error(`${tarball}:\n${errors.map((error) => `  - ${error}`).join("\n")}`);
  process.exit(1);
}
console.log(`${tarball}: ${files.size} files, dist/ is built, no install-time scripts`);
