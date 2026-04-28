import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isRimouskiDeliveryAddress } from "@/lib/delivery-zone";
import type { DeliveryAddress } from "@/lib/types";

type DeliveryAddressInput = {
  label?: string;
  shippingLine1: string;
  shippingCity: string;
  shippingRegion: string;
  shippingPostal: string;
  shippingCountry: string;
  deliveryPhone?: string;
  deliveryInstructions?: string;
};

type SqlClient = {
  $queryRaw<T = unknown>(query: Prisma.Sql): Promise<T>;
  $executeRaw(query: Prisma.Sql): Promise<number>;
};

type DeliveryAddressRecord = {
  id: string;
  label: string;
  shippingLine1: string;
  shippingCity: string;
  shippingRegion: string;
  shippingPostal: string;
  shippingCountry: string;
  deliveryPhone: string | null;
  deliveryInstructions: string | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export class DeliveryAddressOwnershipError extends Error {
  constructor() {
    super("DELIVERY_ADDRESS_NOT_FOUND");
  }
}

export class DeliveryAddressValidationError extends Error {
  constructor() {
    super("OUTSIDE_DELIVERY_ZONE");
  }
}

export class DeliveryAddressIncompleteError extends Error {
  constructor() {
    super("DELIVERY_ADDRESS_INCOMPLETE");
  }
}

export class DeliveryAddressDuplicateError extends Error {
  readonly addressId: string;

  constructor(addressId: string) {
    super("DELIVERY_ADDRESS_DUPLICATE");
    this.addressId = addressId;
  }
}

export class DeliveryAddressLimitError extends Error {
  readonly limit: number;

  constructor(limit: number) {
    super("DELIVERY_ADDRESS_LIMIT_REACHED");
    this.limit = limit;
  }
}

export const MAX_DELIVERY_ADDRESSES_PER_USER = 3;

const normalizeLooseText = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();
const normalizePostalCodeIdentity = (value: string) => value.replace(/\s+/g, "").trim().toUpperCase();

export function normalizeDeliveryAddressIdentity(input: Pick<
  DeliveryAddressInput,
  "shippingLine1" | "shippingCity" | "shippingRegion" | "shippingPostal" | "shippingCountry"
>) {
  return {
    shippingLine1: normalizeLooseText(input.shippingLine1),
    shippingCity: normalizeLooseText(input.shippingCity),
    shippingRegion: normalizeLooseText(input.shippingRegion),
    shippingPostal: normalizePostalCodeIdentity(input.shippingPostal),
    shippingCountry: normalizeLooseText(input.shippingCountry),
  };
}

function buildDefaultDeliveryAddressLabel(input: Pick<DeliveryAddressInput, "shippingLine1" | "shippingCity">) {
  return input.shippingLine1.trim() || input.shippingCity.trim() || "Adresse";
}

export function normalizeDeliveryAddressInput(input: DeliveryAddressInput) {
  const label = input.label?.trim() || buildDefaultDeliveryAddressLabel(input);
  return {
    label,
    shippingLine1: input.shippingLine1.trim(),
    shippingCity: input.shippingCity.trim(),
    shippingRegion: input.shippingRegion.trim(),
    shippingPostal: input.shippingPostal.trim().toUpperCase(),
    shippingCountry: input.shippingCountry.trim().toUpperCase(),
    deliveryPhone: input.deliveryPhone?.trim() || undefined,
    deliveryInstructions: input.deliveryInstructions?.trim() || undefined,
  };
}

export function assertDeliveryAddressInZone(input: Pick<DeliveryAddressInput, "shippingPostal" | "shippingCountry">) {
  if (!isRimouskiDeliveryAddress({ postalCode: input.shippingPostal, country: input.shippingCountry })) {
    throw new DeliveryAddressValidationError();
  }
}

export function assertDeliveryAddressComplete(
  input: Pick<
    DeliveryAddressInput,
    "shippingLine1" | "shippingCity" | "shippingRegion" | "shippingPostal" | "shippingCountry"
  >,
) {
  if (
    !input.shippingLine1.trim() ||
    !input.shippingCity.trim() ||
    !input.shippingRegion.trim() ||
    !input.shippingPostal.trim() ||
    !input.shippingCountry.trim()
  ) {
    throw new DeliveryAddressIncompleteError();
  }
}

function isDeliveryAddressRecordComplete(
  input: Pick<
    DeliveryAddressRecord,
    "shippingLine1" | "shippingCity" | "shippingRegion" | "shippingPostal" | "shippingCountry"
  >,
) {
  return Boolean(
    input.shippingLine1.trim() &&
    input.shippingCity.trim() &&
    input.shippingRegion.trim() &&
    input.shippingPostal.trim() &&
    input.shippingCountry.trim(),
  );
}

function toDeliveryAddress(record: DeliveryAddressRecord): DeliveryAddress {
  return {
    id: record.id,
    label: record.label,
    shippingLine1: record.shippingLine1,
    shippingCity: record.shippingCity,
    shippingRegion: record.shippingRegion,
    shippingPostal: record.shippingPostal,
    shippingCountry: record.shippingCountry,
    deliveryPhone: record.deliveryPhone ?? undefined,
    deliveryInstructions: record.deliveryInstructions ?? undefined,
    lastUsedAt: record.lastUsedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function matchesDeliveryAddressIdentity(
  left: Pick<DeliveryAddressInput, "shippingLine1" | "shippingCity" | "shippingRegion" | "shippingPostal" | "shippingCountry">,
  right: Pick<DeliveryAddressInput, "shippingLine1" | "shippingCity" | "shippingRegion" | "shippingPostal" | "shippingCountry">,
) {
  const normalizedLeft = normalizeDeliveryAddressIdentity(left);
  const normalizedRight = normalizeDeliveryAddressIdentity(right);

  return (
    normalizedLeft.shippingLine1 === normalizedRight.shippingLine1 &&
    normalizedLeft.shippingCity === normalizedRight.shippingCity &&
    normalizedLeft.shippingRegion === normalizedRight.shippingRegion &&
    normalizedLeft.shippingPostal === normalizedRight.shippingPostal &&
    normalizedLeft.shippingCountry === normalizedRight.shippingCountry
  );
}

async function queryDeliveryAddresses(client: SqlClient, whereSql: Prisma.Sql) {
  return client.$queryRaw<DeliveryAddressRecord[]>(Prisma.sql`
    SELECT
      "id",
      "label",
      "shippingLine1",
      "shippingCity",
      "shippingRegion",
      "shippingPostal",
      "shippingCountry",
      "deliveryPhone",
      "deliveryInstructions",
      "lastUsedAt",
      "createdAt",
      "updatedAt"
    FROM "UserDeliveryAddress"
    ${whereSql}
  `);
}

export async function getDeliveryAddressesForUser(userId: string) {
  const addresses = await queryDeliveryAddresses(
    prisma,
    Prisma.sql`WHERE "userId" = ${userId}
      ORDER BY CASE WHEN "lastUsedAt" IS NULL THEN 1 ELSE 0 END, "lastUsedAt" DESC, "updatedAt" DESC, "createdAt" DESC`,
  );

  return addresses.filter(isDeliveryAddressRecordComplete).map(toDeliveryAddress);
}

export async function getDeliveryAddressCountForUser(userId: string, tx?: Prisma.TransactionClient) {
  const client = tx ?? prisma;
  const addresses = await queryDeliveryAddresses(
    client,
    Prisma.sql`WHERE "userId" = ${userId}`,
  );
  return addresses.filter(isDeliveryAddressRecordComplete).length;
}

export async function getDeliveryAddressForUser(userId: string, addressId: string, tx?: Prisma.TransactionClient) {
  const client = tx ?? prisma;
  const [address] = await queryDeliveryAddresses(
    client,
    Prisma.sql`WHERE "userId" = ${userId} AND "id" = ${addressId} LIMIT 1`,
  );

  if (!address) {
    throw new DeliveryAddressOwnershipError();
  }

  return address;
}

export async function findMatchingDeliveryAddressForUser(
  userId: string,
  input: Pick<DeliveryAddressInput, "shippingLine1" | "shippingCity" | "shippingRegion" | "shippingPostal" | "shippingCountry">,
  tx?: Prisma.TransactionClient,
) {
  const client = tx ?? prisma;
  const addresses = await queryDeliveryAddresses(
    client,
    Prisma.sql`WHERE "userId" = ${userId}
      ORDER BY CASE WHEN "lastUsedAt" IS NULL THEN 1 ELSE 0 END, "lastUsedAt" DESC, "updatedAt" DESC, "createdAt" DESC`,
  );

  return addresses.find((address) =>
    matchesDeliveryAddressIdentity(
      {
        shippingLine1: address.shippingLine1,
        shippingCity: address.shippingCity,
        shippingRegion: address.shippingRegion,
        shippingPostal: address.shippingPostal,
        shippingCountry: address.shippingCountry,
      },
      input,
    ),
  ) ?? null;
}

export async function createDeliveryAddressForUser(
  userId: string,
  input: DeliveryAddressInput,
  tx?: Prisma.TransactionClient,
) {
  const client = tx ?? prisma;
  const normalized = normalizeDeliveryAddressInput(input);
  assertDeliveryAddressComplete(normalized);
  assertDeliveryAddressInZone(normalized);
  const duplicate = await findMatchingDeliveryAddressForUser(userId, normalized, tx);
  if (duplicate) {
    throw new DeliveryAddressDuplicateError(duplicate.id);
  }

  const currentCount = await getDeliveryAddressCountForUser(userId, tx);
  if (currentCount >= MAX_DELIVERY_ADDRESSES_PER_USER) {
    throw new DeliveryAddressLimitError(MAX_DELIVERY_ADDRESSES_PER_USER);
  }

  const id = randomUUID();
  const now = new Date();

  await client.$executeRaw(
    Prisma.sql`
      INSERT INTO "UserDeliveryAddress" (
        "id",
        "userId",
        "label",
        "shippingLine1",
        "shippingCity",
        "shippingRegion",
        "shippingPostal",
        "shippingCountry",
        "deliveryPhone",
        "deliveryInstructions",
        "createdAt",
        "updatedAt"
      ) VALUES (
        ${id},
        ${userId},
        ${normalized.label},
        ${normalized.shippingLine1},
        ${normalized.shippingCity},
        ${normalized.shippingRegion},
        ${normalized.shippingPostal},
        ${normalized.shippingCountry},
        ${normalized.deliveryPhone ?? null},
        ${normalized.deliveryInstructions ?? null},
        ${now},
        ${now}
      )
    `,
  );

  const address = await getDeliveryAddressForUser(userId, id, tx);
  return toDeliveryAddress(address);
}

export async function updateDeliveryAddressForUser(
  userId: string,
  addressId: string,
  input: Partial<DeliveryAddressInput>,
  tx?: Prisma.TransactionClient,
) {
  const client = tx ?? prisma;
  const existing = await getDeliveryAddressForUser(userId, addressId, tx);
  const normalized = normalizeDeliveryAddressInput({
    label: input.label ?? existing.label,
    shippingLine1: input.shippingLine1 ?? existing.shippingLine1,
    shippingCity: input.shippingCity ?? existing.shippingCity,
    shippingRegion: input.shippingRegion ?? existing.shippingRegion,
    shippingPostal: input.shippingPostal ?? existing.shippingPostal,
    shippingCountry: input.shippingCountry ?? existing.shippingCountry,
    deliveryPhone: input.deliveryPhone ?? existing.deliveryPhone ?? undefined,
    deliveryInstructions: input.deliveryInstructions ?? existing.deliveryInstructions ?? undefined,
  });

  assertDeliveryAddressComplete(normalized);
  assertDeliveryAddressInZone(normalized);
  const duplicate = await findMatchingDeliveryAddressForUser(userId, normalized, tx);
  if (duplicate && duplicate.id !== addressId) {
    throw new DeliveryAddressDuplicateError(duplicate.id);
  }

  await client.$executeRaw(
    Prisma.sql`
      UPDATE "UserDeliveryAddress"
      SET
        "label" = ${normalized.label},
        "shippingLine1" = ${normalized.shippingLine1},
        "shippingCity" = ${normalized.shippingCity},
        "shippingRegion" = ${normalized.shippingRegion},
        "shippingPostal" = ${normalized.shippingPostal},
        "shippingCountry" = ${normalized.shippingCountry},
        "deliveryPhone" = ${normalized.deliveryPhone ?? null},
        "deliveryInstructions" = ${normalized.deliveryInstructions ?? null},
        "updatedAt" = ${new Date()}
      WHERE "id" = ${addressId} AND "userId" = ${userId}
    `,
  );

  const address = await getDeliveryAddressForUser(userId, addressId, tx);
  return toDeliveryAddress(address);
}

export async function deleteDeliveryAddressForUser(userId: string, addressId: string, tx?: Prisma.TransactionClient) {
  const client = tx ?? prisma;
  await getDeliveryAddressForUser(userId, addressId, tx);
  await client.$executeRaw(
    Prisma.sql`DELETE FROM "UserDeliveryAddress" WHERE "id" = ${addressId} AND "userId" = ${userId}`,
  );
}

export async function markDeliveryAddressUsed(userId: string, addressId: string, tx?: Prisma.TransactionClient) {
  const client = tx ?? prisma;
  await getDeliveryAddressForUser(userId, addressId, tx);
  await client.$executeRaw(
    Prisma.sql`
      UPDATE "UserDeliveryAddress"
      SET "lastUsedAt" = ${new Date()}, "updatedAt" = ${new Date()}
      WHERE "id" = ${addressId} AND "userId" = ${userId}
    `,
  );

  const address = await getDeliveryAddressForUser(userId, addressId, tx);
  return toDeliveryAddress(address);
}
