"use client";

import { useRef, useState } from "react";
import type { Language } from "@/lib/i18n";
import { compressImageFile, formatImageBytes } from "@/lib/client-image-compression";

type Props = {
  language: Language;
  value: string;
  onChange: (url: string) => void;
};

const MAX_SOURCE_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_DOG_UPLOAD_BYTES = 2 * 1024 * 1024;
const VALID_DOG_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function canUploadDogImageAsIs(file: File) {
  return VALID_DOG_IMAGE_TYPES.has(file.type) && file.size <= MAX_DOG_UPLOAD_BYTES;
}

export function DogPhotoUpload({ language, value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const pickFile = () => {
    inputRef.current?.click();
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError("");

    try {
      if (!VALID_DOG_IMAGE_TYPES.has(file.type)) {
        setError(language === "fr" ? "Choisis une photo JPG, PNG ou WebP." : "Choose a JPG, PNG, or WebP photo.");
        return;
      }

      if (file.size > MAX_SOURCE_IMAGE_BYTES) {
        setError(
          language === "fr"
            ? `Photo trop lourde. Maximum: ${formatImageBytes(MAX_SOURCE_IMAGE_BYTES)}.`
            : `Photo is too large. Maximum: ${formatImageBytes(MAX_SOURCE_IMAGE_BYTES)}.`,
        );
        return;
      }

      let imageFile = file;

      if (!canUploadDogImageAsIs(file)) {
        try {
          imageFile = await compressImageFile(file, {
            fileNamePrefix: "dog-photo",
            initialQuality: 0.76,
            maxDimension: 1200,
            minDimension: 560,
            targetMaxBytes: MAX_DOG_UPLOAD_BYTES,
          });
        } catch {
          if (!canUploadDogImageAsIs(file)) {
            throw new Error("IMAGE_PREPARE_FAILED");
          }
        }
      }

      if (imageFile.size > MAX_DOG_UPLOAD_BYTES) {
        setError(
          language === "fr"
            ? "Cette photo reste trop lourde apres compression."
            : "This photo is still too large after compression.",
        );
        return;
      }

      const formData = new FormData();
      formData.append("image", imageFile, imageFile.name);

      const response = await fetch("/api/account/dogs/photo", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json().catch(() => ({}))) as {
        image?: { url: string };
        error?: string;
      };

      if (!response.ok || !payload.image?.url) {
        setError(payload.error ?? (language === "fr" ? "Upload impossible." : "Unable to upload photo."));
        return;
      }

      onChange(payload.image.url);
    } catch {
      setError(
        language === "fr"
          ? "Impossible de lire cette photo. Essaie une capture/export JPG ou une PNG plus petite."
          : "Unable to read this photo. Try a JPG export or a smaller PNG.",
      );
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  return (
    <div className="field" style={{ gridColumn: "1 / -1" }}>
      <label>{language === "fr" ? "Photo du chien" : "Dog photo"}</label>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center" }}>
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={language === "fr" ? "Apercu photo du chien" : "Dog photo preview"}
            src={value}
            style={{
              width: 96,
              height: 96,
              objectFit: "cover",
              borderRadius: 18,
              border: "1px solid var(--border)",
            }}
          />
        ) : (
          <div
            style={{
              width: 96,
              height: 96,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 18,
              border: "1px dashed var(--border)",
              background: "rgba(239, 244, 227, 0.55)",
              color: "var(--muted)",
              fontSize: "0.82rem",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Photo
          </div>
        )}

        <div style={{ display: "grid", gap: 8 }}>
          <input
            ref={inputRef}
            accept="image/*"
            hidden
            onChange={handleUpload}
            type="file"
          />
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-secondary" disabled={uploading} onClick={pickFile} type="button">
              {uploading
                ? language === "fr"
                  ? "Compression..."
                  : "Compressing..."
                : language === "fr"
                  ? "Ajouter une photo"
                  : "Add a photo"}
            </button>
            {value ? (
              <button className="btn btn-secondary" onClick={() => onChange("")} type="button">
                {language === "fr" ? "Retirer" : "Remove"}
              </button>
            ) : null}
          </div>
          <p className="small" style={{ margin: 0 }}>
            {language === "fr"
              ? `Reduction automatique. Source max: ${formatImageBytes(MAX_SOURCE_IMAGE_BYTES)}.`
              : `Automatic reduction. Source max: ${formatImageBytes(MAX_SOURCE_IMAGE_BYTES)}.`}
          </p>
          {error ? (
            <p className="small" style={{ margin: 0, color: "#8f3b2e" }}>
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
