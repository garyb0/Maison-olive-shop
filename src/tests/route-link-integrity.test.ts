import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();
const appDir = path.join(projectRoot, "src", "app");
const scanRoots = [
  path.join(projectRoot, "src", "app"),
  path.join(projectRoot, "src", "components"),
  path.join(projectRoot, "src", "lib"),
];

type RouteDefinition = {
  file: string;
  route: string;
  pattern: RegExp;
};

type LinkReference = {
  file: string;
  rawValue: string;
  normalizedPath: string;
};

function walkFiles(dir: string, predicate: (filePath: string) => boolean): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath, predicate));
      continue;
    }

    if (predicate(fullPath)) {
      files.push(fullPath);
    }
  }

  return files;
}

function routeFromPageFile(filePath: string): string {
  const relativeDir = path.relative(appDir, path.dirname(filePath));
  if (!relativeDir) {
    return "/";
  }

  const segments = relativeDir
    .split(path.sep)
    .filter(Boolean)
    .filter((segment) => !segment.startsWith("("))
    .filter((segment) => !segment.startsWith("@"));

  return `/${segments.join("/")}`;
}

function routePatternFromRoute(route: string): RegExp {
  if (route === "/") {
    return /^\/$/;
  }

  const escapedSegments = route
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      if (/^\[\[\.\.\..+\]\]$/.test(segment)) {
        return "(?:.+)?";
      }

      if (/^\[\.\.\..+\]$/.test(segment)) {
        return ".+";
      }

      if (/^\[.+\]$/.test(segment)) {
        return "[^/]+";
      }

      return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    });

  return new RegExp(`^/${escapedSegments.join("/")}$`);
}

function collectPageRoutes(): RouteDefinition[] {
  return walkFiles(appDir, (filePath) => path.basename(filePath) === "page.tsx").map((filePath) => {
    const route = routeFromPageFile(filePath);
    return {
      file: path.relative(projectRoot, filePath),
      route,
      pattern: routePatternFromRoute(route),
    };
  });
}

function normalizeInternalPath(rawValue: string): string | null {
  if (!rawValue) {
    return null;
  }

  if (
    rawValue.startsWith("mailto:") ||
    rawValue.startsWith("http://") ||
    rawValue.startsWith("https://") ||
    rawValue.startsWith("#")
  ) {
    return null;
  }

  const substituted = rawValue.replace(/\$\{[^}]+\}/g, "x");

  if (!substituted.startsWith("/")) {
    return null;
  }

  if (substituted.startsWith("/api/")) {
    return null;
  }

  const [pathname] = substituted.split(/[?#]/, 1);
  if (!pathname) {
    return "/";
  }

  return pathname !== "/" ? pathname.replace(/\/+$/, "") : "/";
}

function collectInternalLinks(): LinkReference[] {
  const sourceFiles = scanRoots.flatMap((root) =>
    walkFiles(root, (filePath) => /\.(ts|tsx)$/.test(filePath)),
  );

  const patterns = [
    /href\s*=\s*"([^"]+)"/g,
    /href\s*=\s*'([^']+)'/g,
    /href\s*:\s*"([^"]+)"/g,
    /href\s*:\s*'([^']+)'/g,
    /router\.(?:push|replace)\(\s*"([^"]+)"/g,
    /router\.(?:push|replace)\(\s*'([^']+)'/g,
    /redirect\(\s*"([^"]+)"/g,
    /redirect\(\s*'([^']+)'/g,
    /window\.location\.href\s*=\s*"([^"]+)"/g,
    /window\.location\.href\s*=\s*'([^']+)'/g,
    /href\s*=\s*\{`([^`]+)`\}/g,
    /router\.(?:push|replace)\(\s*`([^`]+)`/g,
    /redirect\(\s*`([^`]+)`/g,
    /window\.location\.href\s*=\s*`([^`]+)`/g,
  ];

  const links: LinkReference[] = [];

  for (const filePath of sourceFiles) {
    const content = fs.readFileSync(filePath, "utf8");

    for (const pattern of patterns) {
      for (const match of content.matchAll(pattern)) {
        const rawValue = match[1];
        const normalizedPath = normalizeInternalPath(rawValue);
        if (!normalizedPath) {
          continue;
        }

        links.push({
          file: path.relative(projectRoot, filePath),
          rawValue,
          normalizedPath,
        });
      }
    }
  }

  return links;
}

describe("internal route references", () => {
  it("point to an existing app route", () => {
    const pageRoutes = collectPageRoutes();
    const links = collectInternalLinks();

    const brokenLinks = links.filter(
      (link) => !pageRoutes.some((route) => route.pattern.test(link.normalizedPath)),
    );

    expect(
      brokenLinks,
      brokenLinks.length
        ? `Broken internal routes:\n${brokenLinks
            .map((link) => `- ${link.normalizedPath} (${link.rawValue}) in ${link.file}`)
            .join("\n")}`
        : undefined,
    ).toEqual([]);
  });
});
