import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

type DogClaimInput = {
  publicToken: string;
  name: string;
  photoUrl?: string | null;
  ageLabel?: string;
  ownerPhone: string;
  importantNotes?: string;
  publicProfileEnabled?: boolean;
  showPhotoPublic?: boolean;
  showAgePublic?: boolean;
  showPhonePublic?: boolean;
  showNotesPublic?: boolean;
};

type DogPatchInput = {
  name?: string;
  photoUrl?: string | null;
  ageLabel?: string;
  ownerPhone?: string;
  importantNotes?: string;
  publicProfileEnabled?: boolean;
  showPhotoPublic?: boolean;
  showAgePublic?: boolean;
  showPhonePublic?: boolean;
  showNotesPublic?: boolean;
  isActive?: boolean;
};

type AdminDogPatchInput = {
  isActive?: boolean;
  releaseClaim?: boolean;
};

function createDogToken() {
  return randomBytes(12).toString("base64url");
}

const dogSelect = {
  id: true,
  userId: true,
  publicToken: true,
  name: true,
  photoUrl: true,
  ageLabel: true,
  ownerPhone: true,
  importantNotes: true,
  publicProfileEnabled: true,
  showPhotoPublic: true,
  showAgePublic: true,
  showPhonePublic: true,
  showNotesPublic: true,
  isActive: true,
  claimedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

const adminDogSelect = {
  ...dogSelect,
  user: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
    },
  },
} as const;

export class DogProfileNotFoundError extends Error {
  constructor() {
    super("DOG_PROFILE_NOT_FOUND");
  }
}

export class DogProfileOwnershipError extends Error {
  constructor() {
    super("DOG_PROFILE_NOT_FOUND");
  }
}

export class DogProfileAlreadyClaimedError extends Error {
  constructor() {
    super("DOG_PROFILE_ALREADY_CLAIMED");
  }
}

export class DogProfilePublicPhoneRequiredError extends Error {
  constructor() {
    super("DOG_PROFILE_PUBLIC_PHONE_REQUIRED");
  }
}

export class AdminDogProfileNotFoundError extends Error {
  constructor() {
    super("DOG_PROFILE_NOT_FOUND");
  }
}

export async function getDogProfileByPublicToken(publicToken: string) {
  return prisma.dogProfile.findUnique({
    where: { publicToken },
    select: dogSelect,
  });
}

export async function getDogProfilesForUser(userId: string) {
  return prisma.dogProfile.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: dogSelect,
  });
}

export async function getAdminDogProfiles() {
  return prisma.dogProfile.findMany({
    orderBy: [{ claimedAt: "desc" }, { createdAt: "desc" }],
    select: adminDogSelect,
  });
}

export async function claimDogProfileForUser(userId: string, input: DogClaimInput) {
  return prisma.$transaction(async (tx) => {
    const dog = await tx.dogProfile.findUnique({
      where: { publicToken: input.publicToken },
      select: dogSelect,
    });

    if (!dog) {
      throw new DogProfileNotFoundError();
    }

    if (dog.userId && dog.userId !== userId) {
      throw new DogProfileAlreadyClaimedError();
    }

    return tx.dogProfile.update({
      where: { publicToken: input.publicToken },
      data: {
        userId,
        name: input.name,
        photoUrl: input.photoUrl ?? null,
        ageLabel: input.ageLabel ?? null,
        ownerPhone: input.ownerPhone,
        importantNotes: input.importantNotes ?? null,
        publicProfileEnabled: input.publicProfileEnabled ?? true,
        showPhotoPublic: input.showPhotoPublic ?? false,
        showAgePublic: input.showAgePublic ?? false,
        showPhonePublic: input.showPhonePublic ?? false,
        showNotesPublic: input.showNotesPublic ?? false,
        isActive: true,
        claimedAt: dog.claimedAt ?? new Date(),
      },
      select: dogSelect,
    });
  });
}

export async function updateDogProfileForUser(userId: string, dogId: string, input: DogPatchInput) {
  const dog = await prisma.dogProfile.findFirst({
    where: { id: dogId, userId },
    select: { id: true, ownerPhone: true },
  });

  if (!dog) {
    throw new DogProfileOwnershipError();
  }

  if (input.showPhonePublic === true && !dog.ownerPhone && !input.ownerPhone) {
    throw new DogProfilePublicPhoneRequiredError();
  }

  return prisma.dogProfile.update({
    where: { id: dogId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.photoUrl !== undefined ? { photoUrl: input.photoUrl ?? null } : {}),
      ...(input.ageLabel !== undefined ? { ageLabel: input.ageLabel ?? null } : {}),
      ...(input.ownerPhone !== undefined ? { ownerPhone: input.ownerPhone } : {}),
      ...(input.importantNotes !== undefined ? { importantNotes: input.importantNotes ?? null } : {}),
      ...(input.publicProfileEnabled !== undefined ? { publicProfileEnabled: input.publicProfileEnabled } : {}),
      ...(input.showPhotoPublic !== undefined ? { showPhotoPublic: input.showPhotoPublic } : {}),
      ...(input.showAgePublic !== undefined ? { showAgePublic: input.showAgePublic } : {}),
      ...(input.showPhonePublic !== undefined ? { showPhonePublic: input.showPhonePublic } : {}),
      ...(input.showNotesPublic !== undefined ? { showNotesPublic: input.showNotesPublic } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
    select: dogSelect,
  });
}

export async function updateDogProfileByAdmin(
  dogId: string,
  input: AdminDogPatchInput,
  actorUserId: string,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.dogProfile.findUnique({
      where: { id: dogId },
      select: adminDogSelect,
    });

    if (!existing) {
      throw new AdminDogProfileNotFoundError();
    }

    let updated = existing;

    if (input.releaseClaim) {
      updated = await tx.dogProfile.update({
        where: { id: dogId },
        data: {
          userId: null,
          name: null,
          photoUrl: null,
          ageLabel: null,
          ownerPhone: null,
          importantNotes: null,
          publicProfileEnabled: true,
          showPhotoPublic: false,
          showAgePublic: false,
          showPhonePublic: false,
          showNotesPublic: false,
          claimedAt: null,
          isActive: input.isActive ?? true,
        },
        select: adminDogSelect,
      });

      await tx.auditLog.create({
        data: {
          actorUserId,
          action: "ADMIN_DOG_TOKEN_RELEASED",
          entity: "DogProfile",
          entityId: dogId,
          metadata: JSON.stringify({
            publicToken: existing.publicToken,
            previousUserId: existing.userId,
            previousName: existing.name,
          }),
        },
      });

      return updated;
    }

    if (input.isActive !== undefined && input.isActive !== existing.isActive) {
      updated = await tx.dogProfile.update({
        where: { id: dogId },
        data: { isActive: input.isActive },
        select: adminDogSelect,
      });

      await tx.auditLog.create({
        data: {
          actorUserId,
          action: "ADMIN_DOG_STATUS_UPDATED",
          entity: "DogProfile",
          entityId: dogId,
          metadata: JSON.stringify({
            publicToken: existing.publicToken,
            from: existing.isActive,
            to: input.isActive,
          }),
        },
      });
    }

    return updated;
  });
}

export async function createAdminDogTokenBatch(count: number, actorUserId: string) {
  const existingTokens = new Set(
    (
      await prisma.dogProfile.findMany({
        select: { publicToken: true },
      })
    ).map((dog) => dog.publicToken),
  );

  return prisma.$transaction(async (tx) => {
    const created: Array<Awaited<ReturnType<typeof tx.dogProfile.create>>> = [];

    while (created.length < count) {
      const publicToken = createDogToken();
      if (existingTokens.has(publicToken)) {
        continue;
      }

      existingTokens.add(publicToken);

      const dog = await tx.dogProfile.create({
        data: { publicToken },
        select: adminDogSelect,
      });

      created.push(dog);
    }

    await tx.auditLog.create({
      data: {
        actorUserId,
        action: "ADMIN_DOG_BATCH_CREATED",
        entity: "DogProfile",
        entityId: created[0]?.id ?? "batch",
        metadata: JSON.stringify({
          count: created.length,
          tokens: created.map((dog) => dog.publicToken),
        }),
      },
    });

    return created;
  });
}
