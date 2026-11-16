// Checks a packed tarball before it is published.
// Projects that install the package must not need `allowBuilds`, so the
// tarball has to ship the built dist/ and declare no install-time scripts.
//
// Usage: node .github/scripts/verify-package.mjs <package.tgz>
import { execFileSync } from "node:child_process";
import { posix } from "node:path";

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

// The Pages Functions are deployed from the shipped src/ tree, so every file they
// import, directly or not, has to be in the tarball.
const readPacked = (file) =>
  execFileSync("tar", ["-xzOf", tarball, `package/${file}`], { encoding: "utf8" });
const pending = [...files].filter(
  (file) => file.startsWith("src/cloudflare/functions/") && file.endsWith(".ts"),
);
const seen = new Set(pending);
while (pending.length > 0) {
  const file = pending.pop();
  for (const [, specifier] of readPacked(file).matchAll(/from\s+"(\.{1,2}\/[^"]+)"/g)) {
    const base = posix.normalize(posix.join(posix.dirname(file), specifier));
    // Wrangler's bundler resolves extensionless imports too.
    const imported = [base, `${base}.ts`].find((candidate) => files.has(candidate));
    if (!imported) {
      errors.push(`${file} imports ${base}, which is not in the package`);
    } else if (!seen.has(imported)) {
      seen.add(imported);
      pending.push(imported);
    }
  }
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
