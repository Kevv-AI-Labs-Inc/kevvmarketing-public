#!/usr/bin/env node

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const appDir = path.join(process.cwd(), "src", "app");
const srcDir = path.join(process.cwd(), "src");

const ROUTE_FILE_RE = /^(page|route)\.(?:js|jsx|ts|tsx|mdx)$/;
const SOURCE_FILE_RE = /\.(?:js|jsx|ts|tsx|mdx)$/;
const STATIC_ASSET_RE = /\.(?:svg|png|jpg|jpeg|webp|ico|gif|txt|xml)$/i;
const INTERNAL_PATH_PATTERNS = [
  /href\s*=\s*["'`]([^"'`]+)["'`]/g,
  /href\s*:\s*["'`]([^"'`]+)["'`]/g,
  /router\.(?:push|replace|prefetch)\(\s*["'`]([^"'`]+)["'`]/g,
  /redirect\(\s*["'`]([^"'`]+)["'`]/g,
  /callbackUrl\s*[:=]\s*["'`]([^"'`]+)["'`]/g,
];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
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

function isRouteGroup(segment) {
  return /^\([^/]+\)$/.test(segment);
}

function normalizeSegments(relativeDir) {
  if (!relativeDir || relativeDir === ".") {
    return [];
  }

  return relativeDir
    .split(path.sep)
    .filter(Boolean)
    .filter((segment) => !isRouteGroup(segment))
    .filter((segment) => !segment.startsWith("@"));
}

function normalizeRoutePath(segments) {
  return segments.length === 0 ? "/" : `/${segments.join("/")}`;
}

function routePatternToRegex(routePath) {
  if (routePath === "/") {
    return /^\/$/;
  }

  const regexSegments = routePath
    .slice(1)
    .split("/")
    .map((segment) => {
      if (/^\[\[\.\.\.[^/]+\]\]$/.test(segment)) {
        return "(?:/(?:.+))?";
      }
      if (/^\[\.\.\.[^/]+\]$/.test(segment)) {
        return "/.+";
      }
      if (/^\[[^/]+\]$/.test(segment)) {
        return "/[^/]+";
      }
      return `/${escapeRegex(segment)}`;
    })
    .join("");

  return new RegExp(`^${regexSegments}$`);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeReferencedPath(rawPath) {
  const pathname = rawPath.split(/[?#]/, 1)[0];

  if (!pathname.startsWith("/")) {
    return null;
  }

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/mailto:") ||
    pathname.startsWith("/tel:")
  ) {
    return null;
  }

  if (STATIC_ASSET_RE.test(pathname)) {
    return null;
  }

  return pathname;
}

function collectMatches(content, pattern) {
  const matches = [];

  for (const match of content.matchAll(pattern)) {
    const value = match[1]?.trim();
    if (value) {
      matches.push(value);
    }
  }

  return matches;
}

async function main() {
  const files = await walk(appDir);
  const routeEntries = files
    .filter((file) => ROUTE_FILE_RE.test(path.basename(file)))
    .map((file) => {
      const relativeDir = path.relative(appDir, path.dirname(file));
      const segments = normalizeSegments(relativeDir);
      const kind = path.basename(file).startsWith("page.") ? "page" : "route";

      return {
        kind,
        file,
        routePath: normalizeRoutePath(segments),
      };
    });

  const collisions = new Map();
  for (const entry of routeEntries) {
    const key = `${entry.kind}:${entry.routePath}`;
    const group = collisions.get(key) ?? [];
    group.push(entry.file);
    collisions.set(key, group);
  }

  const duplicateRoutes = [...collisions.entries()]
    .filter(([, filesForRoute]) => filesForRoute.length > 1)
    .map(([key, filesForRoute]) => ({ key, filesForRoute }));

  const pageRoutes = routeEntries.filter((entry) => entry.kind === "page");
  const staticPagePaths = new Set(
    pageRoutes
      .map((entry) => entry.routePath)
      .filter((routePath) => !routePath.includes("[")),
  );
  const dynamicPageMatchers = pageRoutes
    .filter((entry) => entry.routePath.includes("["))
    .map((entry) => ({
      routePath: entry.routePath,
      matcher: routePatternToRegex(entry.routePath),
    }));

  const sourceFiles = (await walk(srcDir)).filter((file) => SOURCE_FILE_RE.test(file));
  const missingReferences = new Map();

  for (const file of sourceFiles) {
    const content = await readFile(file, "utf8");
    const referencedPaths = INTERNAL_PATH_PATTERNS.flatMap((pattern) =>
      collectMatches(content, pattern),
    )
      .map(normalizeReferencedPath)
      .filter(Boolean);

    for (const referencedPath of referencedPaths) {
      const exists =
        staticPagePaths.has(referencedPath) ||
        dynamicPageMatchers.some(({ matcher }) => matcher.test(referencedPath));

      if (exists) {
        continue;
      }

      const group = missingReferences.get(referencedPath) ?? new Set();
      group.add(file);
      missingReferences.set(referencedPath, group);
    }
  }

  if (duplicateRoutes.length > 0 || missingReferences.size > 0) {
    if (duplicateRoutes.length > 0) {
      console.error("Route collisions detected:");
      for (const collision of duplicateRoutes) {
        console.error(`- ${collision.key}`);
        for (const file of collision.filesForRoute) {
          console.error(`  - ${path.relative(process.cwd(), file)}`);
        }
      }
    }

    if (missingReferences.size > 0) {
      console.error("Internal route references without a matching page:");
      for (const [routePath, filesForRoute] of [...missingReferences.entries()].sort()) {
        console.error(`- ${routePath}`);
        for (const file of [...filesForRoute].sort()) {
          console.error(`  - ${path.relative(process.cwd(), file)}`);
        }
      }
    }

    process.exit(1);
  }

  console.log(
    `Route audit passed: ${pageRoutes.length} pages, ${
      routeEntries.length - pageRoutes.length
    } route handlers.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
