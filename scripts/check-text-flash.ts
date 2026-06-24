import fs from "node:fs/promises";
import path from "node:path";
import { chromium, type Page } from "playwright";

type CliOptions = {
  url: string;
  paths: string[];
  runs: number;
  durationMs: number;
  sampleMs: number;
  stableAfterMs: number;
  tolerancePx: number;
  maxCls: number;
};

type TextMetric = {
  text: string;
  fontSize: string;
  fontFamily: string;
  width: number;
  height: number;
  top: number;
};

type ProbeSample = {
  t: number;
  readyState: string;
  fontsStatus: string;
  rows: Record<string, TextMetric | null>;
};

type LayoutShiftEntry = {
  t: number;
  value: number;
};

type ProbeResult = {
  samples: ProbeSample[];
  shifts: LayoutShiftEntry[];
};

type RunReport = {
  target: string;
  run: number;
  cacheMode: "normal" | "hard";
  status: number | null;
  consoleErrors: string[];
  pageErrors: string[];
  layoutShiftAfterStable: number;
  violations: string[];
  requestSignals: string[];
};

const defaultPaths = [
  "/",
  "/boutique",
  "/products/sac-transport-respirant-gris",
  "/cart",
  "/app",
];

const selectorEntries = [
  ["brand", ".nav-brand-name, .brand"],
  ["heroH1", "main h1, h1"],
  ["heroCopy", "main h1 ~ p, main section p, section p"],
  ["navLink", "nav a"],
  ["productCard", "article a, article strong, article h3"],
  ["footerTitle", "footer h2"],
  ["supportButton", "button[aria-label='Aide'], button"],
] as const;

function readNumber(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    url: "https://chezolive.ca",
    paths: [],
    runs: 20,
    durationMs: 3600,
    sampleMs: 80,
    stableAfterMs: 1000,
    tolerancePx: 1.25,
    maxCls: 0.01,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else if (arg === "--url" && next) {
      options.url = next;
      index += 1;
    } else if (arg.startsWith("--url=")) {
      options.url = arg.slice("--url=".length);
    } else if (arg === "--paths" && next) {
      options.paths = splitList(next);
      index += 1;
    } else if (arg.startsWith("--paths=")) {
      options.paths = splitList(arg.slice("--paths=".length));
    } else if (arg === "--runs" && next) {
      options.runs = readNumber(next, options.runs);
      index += 1;
    } else if (arg.startsWith("--runs=")) {
      options.runs = readNumber(arg.slice("--runs=".length), options.runs);
    } else if (arg === "--duration-ms" && next) {
      options.durationMs = readNumber(next, options.durationMs);
      index += 1;
    } else if (arg.startsWith("--duration-ms=")) {
      options.durationMs = readNumber(arg.slice("--duration-ms=".length), options.durationMs);
    } else if (arg === "--sample-ms" && next) {
      options.sampleMs = readNumber(next, options.sampleMs);
      index += 1;
    } else if (arg.startsWith("--sample-ms=")) {
      options.sampleMs = readNumber(arg.slice("--sample-ms=".length), options.sampleMs);
    } else if (arg === "--stable-after-ms" && next) {
      options.stableAfterMs = readNumber(next, options.stableAfterMs);
      index += 1;
    } else if (arg.startsWith("--stable-after-ms=")) {
      options.stableAfterMs = readNumber(arg.slice("--stable-after-ms=".length), options.stableAfterMs);
    } else if (arg === "--tolerance-px" && next) {
      options.tolerancePx = readNumber(next, options.tolerancePx);
      index += 1;
    } else if (arg.startsWith("--tolerance-px=")) {
      options.tolerancePx = readNumber(arg.slice("--tolerance-px=".length), options.tolerancePx);
    } else if (arg === "--max-cls" && next) {
      options.maxCls = readNumber(next, options.maxCls);
      index += 1;
    } else if (arg.startsWith("--max-cls=")) {
      options.maxCls = readNumber(arg.slice("--max-cls=".length), options.maxCls);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function splitList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function printHelp() {
  console.log(`Usage: npm run check:text-flash -- [options]

Options:
  --url <url>              Base URL or exact page URL. Default: https://chezolive.ca
  --paths <a,b,c>          Paths to check from the base origin. Default: main public pages.
  --runs <number>          Load count per target. Default: 20.
  --duration-ms <number>   Observation window per load. Default: 3600.
  --sample-ms <number>     Measurement interval. Default: 80.
  --stable-after-ms <n>    Ignore early first-render movement before this time. Default: 1000.
  --tolerance-px <number>  Allowed rect drift after stable time. Default: 1.25.
  --max-cls <number>       Max layout shift after stable time. Default: 0.01.
`);
}

function buildTargets(options: CliOptions) {
  const parsed = new URL(options.url);
  const hasExplicitPaths = options.paths.length > 0;
  const urlLooksExactPage = !hasExplicitPaths && (parsed.pathname !== "/" || parsed.search);

  if (urlLooksExactPage) return [parsed.toString()];

  const origin = `${parsed.protocol}//${parsed.host}`;
  return (hasExplicitPaths ? options.paths : defaultPaths).map((pagePath) => new URL(pagePath, origin).toString());
}

async function installProbe(page: Page, options: CliOptions) {
  const content = `
(() => {
  const selectors = ${JSON.stringify(selectorEntries)};
  const durationMs = ${JSON.stringify(options.durationMs)};
  const sampleMs = ${JSON.stringify(options.sampleMs)};
  window.__textFlashProbe = {
    samples: [],
    shifts: []
  };

  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput && typeof entry.value === "number") {
          window.__textFlashProbe.shifts.push({
            t: Math.round(entry.startTime),
            value: entry.value
          });
        }
      }
    }).observe({ type: "layout-shift", buffered: true });
  } catch {
  }

  const startedAt = performance.now();
  const read = () => {
    const rows = {};

    for (const [name, selector] of selectors) {
      const element = document.querySelector(selector);
      if (!element) {
        rows[name] = null;
        continue;
      }

      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      rows[name] = {
        text: (element.textContent || "").trim().replace(/\\s+/g, " ").slice(0, 90),
        fontSize: style.fontSize,
        fontFamily: style.fontFamily,
        width: Math.round(rect.width * 100) / 100,
        height: Math.round(rect.height * 100) / 100,
        top: Math.round(rect.top * 100) / 100
      };
    }

    window.__textFlashProbe.samples.push({
      t: Math.round(performance.now() - startedAt),
      readyState: document.readyState,
      fontsStatus: document.fonts ? document.fonts.status : "unsupported",
      rows
    });
  };

  read();
  const interval = window.setInterval(read, sampleMs);
  window.setTimeout(() => window.clearInterval(interval), durationMs);
})();
`;

  await page.addInitScript({ content });
}

function diffMetric(
  name: string,
  baseline: TextMetric,
  current: TextMetric,
  sample: ProbeSample,
  tolerancePx: number,
) {
  const violations: string[] = [];

  if (current.fontSize !== baseline.fontSize) {
    violations.push(`${name} font-size changed at ${sample.t}ms: ${baseline.fontSize} -> ${current.fontSize}`);
  }

  if (current.fontFamily !== baseline.fontFamily) {
    violations.push(`${name} font-family changed at ${sample.t}ms`);
  }

  for (const key of ["width", "height", "top"] as const) {
    const delta = Math.abs(current[key] - baseline[key]);
    if (delta > tolerancePx) {
      violations.push(`${name} ${key} moved ${delta.toFixed(2)}px at ${sample.t}ms`);
    }
  }

  return violations;
}

function analyzeProbe(result: ProbeResult, options: CliOptions) {
  const baseline = result.samples.find((sample) => (
    sample.t >= options.stableAfterMs &&
    Object.values(sample.rows).some(Boolean)
  ));
  const violations: string[] = [];

  if (!baseline) {
    violations.push("No measurable baseline after the stable window.");
    return { violations, layoutShiftAfterStable: 0 };
  }

  for (const sample of result.samples) {
    if (sample.t <= baseline.t) continue;

    for (const [name] of selectorEntries) {
      const baseRow = baseline.rows[name];
      const currentRow = sample.rows[name];
      if (!baseRow || !currentRow) continue;
      violations.push(...diffMetric(name, baseRow, currentRow, sample, options.tolerancePx));
    }
  }

  const layoutShiftAfterStable = result.shifts
    .filter((entry) => entry.t >= options.stableAfterMs)
    .reduce((sum, entry) => sum + entry.value, 0);

  if (layoutShiftAfterStable > options.maxCls) {
    violations.push(`Layout shift after stable window is ${layoutShiftAfterStable.toFixed(5)} > ${options.maxCls}.`);
  }

  return { violations: [...new Set(violations)], layoutShiftAfterStable };
}

async function runTarget(target: string, options: CliOptions) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
  });
  const reports: RunReport[] = [];

  for (let index = 0; index < options.runs; index += 1) {
    const cacheMode = index % 2 === 0 ? "normal" : "hard";
    const page = await context.newPage();
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const requestSignals: string[] = [];

    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });

    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    page.on("requestfinished", (request) => {
      const url = request.url();
      if (url.includes("_rsc=") || url.includes("/api/") || url.includes("/cdn-cgi/")) {
        requestSignals.push(url);
      }
    });

    if (cacheMode === "hard") {
      const cdp = await context.newCDPSession(page);
      await cdp.send("Network.enable");
      await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    }

    await installProbe(page, options);

    let status: number | null = null;
    let result: ProbeResult = { samples: [], shifts: [] };
    const violations: string[] = [];

    try {
      const response = await page.goto(target, { waitUntil: "domcontentloaded", timeout: 45_000 });
      status = response?.status() ?? null;
      await page.waitForTimeout(options.durationMs + 250);
      result = await page.evaluate(() => {
        const win = window as typeof window & { __textFlashProbe?: ProbeResult };
        return win.__textFlashProbe ?? { samples: [], shifts: [] };
      });
    } catch (error) {
      violations.push(`Navigation or probe failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (status === null || status >= 400) {
      violations.push(`Unexpected page status: ${status ?? "null"}.`);
    }

    const analysis = analyzeProbe(result, options);
    violations.push(...analysis.violations);
    violations.push(...consoleErrors.map((error) => `Console error: ${error}`));
    violations.push(...pageErrors.map((error) => `Page error: ${error}`));

    reports.push({
      target,
      run: index + 1,
      cacheMode,
      status,
      consoleErrors,
      pageErrors,
      layoutShiftAfterStable: analysis.layoutShiftAfterStable,
      violations: [...new Set(violations)],
      requestSignals: requestSignals.slice(0, 30),
    });

    await page.close();
  }

  await context.close();
  await browser.close();
  return reports;
}

async function writeReport(report: unknown) {
  const outputDir = path.join(process.cwd(), "output", "playwright");
  await fs.mkdir(outputDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = path.join(outputDir, `text-flash-${stamp}.json`);
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  return reportPath;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const targets = buildTargets(options);
  const allReports: RunReport[] = [];

  for (const target of targets) {
    console.log(`Checking ${target} (${options.runs} runs)...`);
    allReports.push(...await runTarget(target, options));
  }

  const failures = allReports.filter((report) => report.violations.length > 0);
  const reportPath = await writeReport({
    generatedAt: new Date().toISOString(),
    options,
    targets,
    runs: allReports,
    summary: {
      totalRuns: allReports.length,
      failedRuns: failures.length,
      maxLayoutShiftAfterStable: Math.max(0, ...allReports.map((report) => report.layoutShiftAfterStable)),
    },
  });

  console.log(`Report: ${reportPath}`);
  console.log(`Runs: ${allReports.length}; failures: ${failures.length}`);

  if (failures.length > 0) {
    for (const failure of failures.slice(0, 10)) {
      console.error(`\n${failure.target} run ${failure.run} (${failure.cacheMode})`);
      for (const violation of failure.violations.slice(0, 8)) {
        console.error(`- ${violation}`);
      }
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
