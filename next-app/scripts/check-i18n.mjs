import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const srcRoot = path.join(projectRoot, "src");
const localeRoot = path.join(srcRoot, "i18n", "locales");

const allowedPickTextFiles = new Set([
  path.join(srcRoot, "i18n", "copy.ts"),
]);

const allowedTextFiles = new Set([
  path.join(srcRoot, "i18n", "copy.ts"),
  path.join(srcRoot, "lib", "db", "schema.ts"),
]);

const allowedLocaleTernaryFiles = new Set([
  path.join(srcRoot, "i18n", "copy.ts"),
  path.join(srcRoot, "i18n", "share-pages.ts"),
  path.join(srcRoot, "components", "LocaleToggleButton.tsx"),
]);

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function collectLeafPaths(node, prefix = "") {
  return Object.entries(node).flatMap(([key, value]) => {
    const nextPath = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      return [nextPath];
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return collectLeafPaths(value, nextPath);
    }
    return [];
  });
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return walk(fullPath);
      }
      return fullPath;
    }),
  );

  return files.flat();
}

function rel(filePath) {
  return path.relative(projectRoot, filePath);
}

async function main() {
  const zh = await readJson(path.join(localeRoot, "zh.json"));
  const en = await readJson(path.join(localeRoot, "en.json"));
  const zhKeys = new Set(collectLeafPaths(zh));
  const enKeys = new Set(collectLeafPaths(en));
  const missingInEn = [...zhKeys].filter((key) => !enKeys.has(key));
  const missingInZh = [...enKeys].filter((key) => !zhKeys.has(key));

  const problems = [];

  if (missingInEn.length > 0) {
    problems.push(`Missing in en.json:\n${missingInEn.map((key) => `  - ${key}`).join("\n")}`);
  }
  if (missingInZh.length > 0) {
    problems.push(`Missing in zh.json:\n${missingInZh.map((key) => `  - ${key}`).join("\n")}`);
  }

  const files = (await walk(srcRoot)).filter((filePath) => /\.(ts|tsx)$/.test(filePath));

  for (const filePath of files) {
    const content = await fs.readFile(filePath, "utf8");

    if (!allowedPickTextFiles.has(filePath) && content.includes("pickText(")) {
      problems.push(`Disallowed pickText() usage in ${rel(filePath)}`);
    }

    if (!allowedTextFiles.has(filePath) && /(^|[^.\w])text\(/.test(content)) {
      problems.push(`Disallowed text() usage in ${rel(filePath)}`);
    }

    if (
      !allowedLocaleTernaryFiles.has(filePath) &&
      /locale\s*===\s*["']zh["']/.test(content)
    ) {
      problems.push(`Disallowed locale ternary in ${rel(filePath)}`);
    }
  }

  if (problems.length > 0) {
    console.error("\n[i18n-check] Found problems:\n");
    for (const problem of problems) {
      console.error(problem);
      console.error("");
    }
    process.exit(1);
  }

  console.log("[i18n-check] Passed");
}

main().catch((error) => {
  console.error("[i18n-check] Failed with unexpected error");
  console.error(error);
  process.exit(1);
});
