import { promises as dns } from "node:dns";

type CheckLevel = "PASS" | "WARN" | "FAIL";

type CheckResult = {
  level: CheckLevel;
  name: string;
  details: string;
};

const DEFAULT_DOMAIN = "chezolive.ca";
const EXPECTED_MX = ["mx1.privateemail.com", "mx2.privateemail.com"];
const EXPECTED_CNAMES: Record<string, string> = {
  mail: "privateemail.com",
  autoconfig: "privateemail.com",
  autodiscover: "privateemail.com",
};
const EXPECTED_SPF = "v=spf1 include:spf.privateemail.com ~all";
const EXPECTED_DMARC = "v=DMARC1; p=none; rua=mailto:support@chezolive.ca";

dns.setServers(["1.1.1.1", "8.8.8.8"]);

function parseArgs() {
  const args = process.argv.slice(2);
  let domain = DEFAULT_DOMAIN;
  let dkimHost: string | null = null;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--dkim-host") {
      dkimHost = args[i + 1] ?? null;
      i += 1;
      continue;
    }

    if (!arg.startsWith("--")) {
      domain = arg;
    }
  }

  return { domain, dkimHost };
}

function logResult(result: CheckResult) {
  console.log(`${result.level} ${result.name} -> ${result.details}`);
}

function flattenTxtRecords(records: string[][]) {
  return records.map((parts) => parts.join(""));
}

async function checkMx(domain: string): Promise<CheckResult> {
  try {
    const records = await dns.resolveMx(domain);
    const exchanges = records
      .map((record) => record.exchange.toLowerCase().replace(/\.$/, ""))
      .sort();
    const hasExpected = EXPECTED_MX.every((mx) => exchanges.includes(mx));
    const hasOldForwarding = exchanges.some((mx) => mx.includes("eforward"));

    if (!hasExpected) {
      return {
        level: "FAIL",
        name: "MX",
        details: `expected ${EXPECTED_MX.join(", ")} but found ${exchanges.join(", ") || "none"}`,
      };
    }

    if (hasOldForwarding) {
      return {
        level: "FAIL",
        name: "MX",
        details: `old forwarding MX still present: ${exchanges.join(", ")}`,
      };
    }

    return {
      level: "PASS",
      name: "MX",
      details: exchanges.join(", "),
    };
  } catch (error) {
    return {
      level: "FAIL",
      name: "MX",
      details: error instanceof Error ? error.message : "lookup failed",
    };
  }
}

async function checkTxtRecord(name: string, expectedValue: string, label: string): Promise<CheckResult> {
  try {
    const records = flattenTxtRecords(await dns.resolveTxt(name));
    const match = records.some((record) => record.trim() === expectedValue);

    if (!match) {
      return {
        level: "FAIL",
        name: label,
        details: `expected "${expectedValue}" but found ${records.join(" | ") || "none"}`,
      };
    }

    return {
      level: "PASS",
      name: label,
      details: expectedValue,
    };
  } catch (error) {
    return {
      level: "FAIL",
      name: label,
      details: error instanceof Error ? error.message : "lookup failed",
    };
  }
}

async function checkCname(host: string, expectedValue: string): Promise<CheckResult> {
  try {
    const records = await dns.resolveCname(host);
    const normalized = records.map((record) => record.toLowerCase().replace(/\.$/, ""));
    const match = normalized.includes(expectedValue);

    if (!match) {
      return {
        level: "FAIL",
        name: `CNAME ${host}`,
        details: `expected ${expectedValue} but found ${normalized.join(", ") || "none"}`,
      };
    }

    return {
      level: "PASS",
      name: `CNAME ${host}`,
      details: expectedValue,
    };
  } catch (error) {
    return {
      level: "FAIL",
      name: `CNAME ${host}`,
      details: error instanceof Error ? error.message : "lookup failed",
    };
  }
}

async function checkDkim(dkimHost: string | null): Promise<CheckResult> {
  if (!dkimHost) {
    return {
      level: "WARN",
      name: "DKIM",
      details: "not checked yet; rerun with --dkim-host <selector._domainkey.domain>",
    };
  }

  try {
    const records = flattenTxtRecords(await dns.resolveTxt(dkimHost));
    const hasDkim = records.some((record) => record.toLowerCase().includes("v=dkim1"));

    if (!hasDkim) {
      return {
        level: "FAIL",
        name: "DKIM",
        details: `no DKIM TXT record found on ${dkimHost}`,
      };
    }

    return {
      level: "PASS",
      name: "DKIM",
      details: `record found on ${dkimHost}`,
    };
  } catch (error) {
    return {
      level: "FAIL",
      name: "DKIM",
      details: error instanceof Error ? error.message : "lookup failed",
    };
  }
}

async function main() {
  const { domain, dkimHost } = parseArgs();
  const results: CheckResult[] = [];

  results.push(await checkMx(domain));
  results.push(await checkTxtRecord(domain, EXPECTED_SPF, "SPF"));
  results.push(await checkTxtRecord(`_dmarc.${domain}`, EXPECTED_DMARC, "DMARC"));

  for (const [host, expectedValue] of Object.entries(EXPECTED_CNAMES)) {
    results.push(await checkCname(`${host}.${domain}`, expectedValue));
  }

  results.push(await checkDkim(dkimHost));

  console.log(`Private Email DNS check for ${domain}`);
  for (const result of results) {
    logResult(result);
  }

  if (results.some((result) => result.level === "FAIL")) {
    process.exitCode = 1;
  }
}

void main();
