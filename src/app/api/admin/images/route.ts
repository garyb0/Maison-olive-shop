import { jsonError, jsonOk } from "@/lib/http";
import { requireAdmin } from "@/lib/permissions";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

const IMAGES_DIR = path.join(process.cwd(), "public", "Logo");

/**
 * GET /api/admin/images - Liste toutes les images dans public/Logo/
 * Retourne un tableau d'objets { name, url, size }
 */
export async function GET() {
  try {
    await requireAdmin();

    // Vérifier si le dossier existe
    try {
      await fs.access(IMAGES_DIR);
    } catch {
      // Le dossier n'existe pas, retourner une liste vide
      return jsonOk({ images: [] });
    }

    const files = await fs.readdir(IMAGES_DIR);
    const imageExtensions = [".png", ".jpg", ".jpeg", ".gif", ".webp"];

    const images = files
      .filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return imageExtensions.includes(ext);
      })
      .map((file) => ({
        name: file,
        url: `/Logo/${file}`,
        size: path.extname(file).toUpperCase().replace(".", ""),
      }));

    return jsonOk({ images });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }
    console.error("Erreur lors de la lecture des images:", error);
    return jsonError("Failed to list images", 500);
  }
}

/**
 * POST /api/admin/images - Upload une image vers public/Logo/
 * Attend un FormData avec un fichier dans le champ "image"
 */
export async function POST(request: Request) {
  try {
    await requireAdmin();

    const formData = await request.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return jsonError("Aucun fichier fourni", 400);
    }

    // Valider le type de fichier
    const validTypes = ["image/png", "image/jpeg", "image/gif", "image/webp"] as const;
    if (!validTypes.includes(file.type as (typeof validTypes)[number])) {
      return jsonError("Type de fichier non valide. Seuls PNG, JPG, GIF et WebP sont acceptes.", 400);
    }

    // Valider la taille (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return jsonError("Fichier trop volumineux. Taille maximale: 5MB", 400);
    }

    const extensionByMime: Record<(typeof validTypes)[number], string> = {
      "image/png": ".png",
      "image/jpeg": ".jpg",
      "image/gif": ".gif",
      "image/webp": ".webp",
    };
    const allowedExtensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp"]);

    // Nettoyer le nom du fichier + eviter les collisions
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const explicitExt = path.extname(sanitizedName).toLowerCase();
    const fallbackExt = extensionByMime[file.type as (typeof validTypes)[number]];
    if (!fallbackExt) {
      return jsonError("Type de fichier non valide", 400);
    }
    if (explicitExt && !allowedExtensions.has(explicitExt)) {
      return jsonError("Extension de fichier non valide", 400);
    }

    // Normalize extension from MIME to avoid trusting spoofed filename extensions.
    const extension = fallbackExt;
    if (!allowedExtensions.has(extension)) {
      return jsonError("Extension de fichier non valide", 400);
    }

    const baseName = path.basename(sanitizedName, explicitExt).replace(/\.+$/, "") || "image";
    let finalName = `${baseName}${extension}`;
    let filePath = path.join(IMAGES_DIR, finalName);

    // S'assurer que le dossier existe
    await fs.mkdir(IMAGES_DIR, { recursive: true });

    try {
      await fs.access(filePath);
      finalName = `${baseName}-${Date.now()}-${randomUUID().slice(0, 8)}${extension}`;
      filePath = path.join(IMAGES_DIR, finalName);
    } catch {
      // file does not exist, we can keep the current filename
    }

    // Écrire le fichier
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(filePath, buffer);

    return jsonOk({
      image: {
        name: finalName,
        url: `/Logo/${finalName}`,
        size: path.extname(finalName).toUpperCase().replace(".", ""),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }
    console.error("Erreur lors de l'upload de l'image:", error);
    return jsonError("Failed to upload image", 500);
  }
}
