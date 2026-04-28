import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { env } from "../src/lib/env";
import { isLocalhostSiteUrl } from "../src/lib/site-url";

const DEFAULT_BATCH_SIZE = 1010;

function createToken() {
  return randomBytes(12).toString("base64url");
}

function toCsv(rows: string[][]) {
  return rows
    .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","))
    .join("\n");
}

async function main() {
  if (isLocalhostSiteUrl(env.siteUrl) && process.env.ALLOW_LOCALHOST_QR_EXPORTS !== "true") {
    throw new Error(
      "Refusing to generate vendor-ready QR exports while NEXT_PUBLIC_SITE_URL still points to localhost. Set the real public domain first, or override intentionally with ALLOW_LOCALHOST_QR_EXPORTS=true.",
    );
  }

  const argValue = process.argv[2];
  const requestedSize = argValue ? Number(argValue) : DEFAULT_BATCH_SIZE;
  const batchSize = Number.isFinite(requestedSize) && requestedSize > 0 ? Math.floor(requestedSize) : DEFAULT_BATCH_SIZE;

  const existingTokens = new Set(
    (
      await prisma.dogProfile.findMany({
        select: { publicToken: true },
      })
    ).map((dog) => dog.publicToken),
  );

  const createdRows: Array<{
    index: number;
    publicToken: string;
    relativeUrl: string;
    fullUrl: string;
  }> = [];

  while (createdRows.length < batchSize) {
    const publicToken = createToken();
    if (existingTokens.has(publicToken)) {
      continue;
    }

    existingTokens.add(publicToken);

    const dog = await prisma.dogProfile.create({
      data: {
        publicToken,
      },
      select: {
        publicToken: true,
      },
    });

    createdRows.push({
      index: createdRows.length + 1,
      publicToken: dog.publicToken,
      relativeUrl: `/dog/${dog.publicToken}`,
      fullUrl: `${env.siteUrl}/dog/${dog.publicToken}`,
    });
  }

  const outputDir = join(process.cwd(), "output");
  await mkdir(outputDir, { recursive: true });

  const stamp = new Date().toISOString().replaceAll(":", "-");
  const csvPath = join(outputDir, `dog-qr-links-${batchSize}-${stamp}.csv`);
  const txtPath = join(outputDir, `dog-qr-links-${batchSize}-${stamp}.txt`);

  const csv = toCsv([
    ["index", "publicToken", "relativeUrl", "fullUrl"],
    ...createdRows.map((row) => [
      String(row.index),
      row.publicToken,
      row.relativeUrl,
      row.fullUrl,
    ]),
  ]);

  const txt = createdRows.map((row) => row.fullUrl).join("\n");

  await writeFile(csvPath, csv, "utf8");
  await writeFile(txtPath, txt, "utf8");

  console.log(
    JSON.stringify({
      created: createdRows.length,
      siteUrl: env.siteUrl,
      csvPath,
      txtPath,
      firstLink: createdRows[0]?.fullUrl ?? null,
      lastLink: createdRows.at(-1)?.fullUrl ?? null,
    }),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
