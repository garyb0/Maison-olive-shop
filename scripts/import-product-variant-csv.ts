import fs from "node:fs";
import {
  getPositionalScriptArgs,
  loadEnvForTarget,
  resolveEnvTargetFromArgs,
  resolveProjectPath,
} from "./db-utils";

function readArgValue(name: string) {
  const prefix = `${name}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length).trim() : "";
}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

async function resolveActorUserId(prisma: typeof import("../src/lib/prisma").prisma) {
  const actorId = readArgValue("--actor-id");
  if (actorId) {
    const admin = await prisma.user.findFirst({
      where: { id: actorId, role: "ADMIN" },
      select: { id: true },
    });
    if (!admin) throw new Error(`Admin actor id not found: ${actorId}`);
    return admin.id;
  }

  const actorEmail = readArgValue("--actor-email");
  if (actorEmail) {
    const admin = await prisma.user.findFirst({
      where: { email: actorEmail, role: "ADMIN" },
      select: { id: true },
    });
    if (!admin) throw new Error(`Admin actor email not found: ${actorEmail}`);
    return admin.id;
  }

  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true },
  });
  if (!admin) throw new Error("No ADMIN user found for audit log actor.");
  console.log(`Using admin actor: ${admin.email}`);
  return admin.id;
}

async function main() {
  const envTarget = resolveEnvTargetFromArgs();
  loadEnvForTarget(envTarget);

  const [csvPathArg] = getPositionalScriptArgs();
  if (!csvPathArg) {
    throw new Error(
      "Usage: npx tsx scripts/import-product-variant-csv.ts <csv-path> --env=development|production [--dry-run|--apply] [--actor-email=email]",
    );
  }

  const dryRun = !hasFlag("--apply") || hasFlag("--dry-run");
  const csvPath = resolveProjectPath(csvPathArg);
  const csvText = fs.readFileSync(csvPath, "utf8");

  const { importAdminProductVariantCsv } = await import("../src/lib/admin");
  const { prisma } = await import("../src/lib/prisma");

  try {
    const actorUserId = dryRun ? "dry-run" : await resolveActorUserId(prisma);
    const result = await importAdminProductVariantCsv(csvText, actorUserId, { dryRun });

    console.log(JSON.stringify({
      env: envTarget,
      csvPath,
      dryRun,
      import: result,
    }, null, 2));

    if (result.errors.length > 0) {
      process.exitCode = 1;
      return;
    }

    if (dryRun) {
      console.log("Dry-run only. Re-run with --apply after reviewing the preview.");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
