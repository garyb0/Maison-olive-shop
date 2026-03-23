type CheckResult = {
  name: string;
  ok: boolean;
  details?: string;
};

async function checkHealth(baseUrl: string): Promise<CheckResult> {
  try {
    const res = await fetch(`${baseUrl}/api/health`);
    if (!res.ok) {
      return { name: "health", ok: false, details: `HTTP ${res.status}` };
    }

    const payload = (await res.json()) as { ok?: boolean };
    return { name: "health", ok: payload?.ok === true, details: JSON.stringify(payload) };
  } catch (error) {
    return {
      name: "health",
      ok: false,
      details: error instanceof Error ? error.message : "unknown error",
    };
  }
}

async function checkUnauthorized(baseUrl: string, path: string): Promise<CheckResult> {
  try {
    const res = await fetch(`${baseUrl}${path}`);
    const ok = res.status === 401 || res.status === 403;
    return { name: `authz:${path}`, ok, details: `HTTP ${res.status}` };
  } catch (error) {
    return {
      name: `authz:${path}`,
      ok: false,
      details: error instanceof Error ? error.message : "unknown error",
    };
  }
}

async function main() {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");

  const checks: CheckResult[] = [];
  checks.push(await checkHealth(baseUrl));
  checks.push(await checkUnauthorized(baseUrl, "/api/admin/orders"));
  checks.push(await checkUnauthorized(baseUrl, "/api/admin/customers"));
  checks.push(await checkUnauthorized(baseUrl, "/api/admin/taxes"));

  let hasFailure = false;
  console.log(`Smoke check target: ${baseUrl}`);
  for (const c of checks) {
    if (!c.ok) hasFailure = true;
    console.log(`${c.ok ? "✅" : "❌"} ${c.name}${c.details ? ` -> ${c.details}` : ""}`);
  }

  if (hasFailure) {
    process.exit(1);
  }
}

void main();
