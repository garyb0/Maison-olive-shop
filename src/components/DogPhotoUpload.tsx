"use client";

import { useRef, useState } from "react";
import type { Language } from "@/lib/i18n";

type Props = {
  language: Language;
  value: string;
  onChange: (url: string) => void;
};

const MAX_DIMENSION = 1200;
const JPEG_QUALITY = 0.72;
const WEBP_QUALITY = 0.72;

function getFileExtension(type: string) {
  if (type === "image/webp") return "webp";
  if (type === "image/png") return "png";
  if (type === "image/gif") return "gif";
  return "jpg";
}

async function compressImage(file: File) {
  const imageUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("IMAGE_LOAD_FAILED"));
      img.src = imageUrl;
    });

    const scale = Math.min(1, MAX_DIMENSION / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("CANVAS_NOT_AVAILABLE");
    }

    context.drawImage(image, 0, 0, width, height);

    const preferWebp = file.type !== "image/gif" && file.type !== "image/svg+xml";
    const outputType = preferWebp ? "image/webp" : "image/jpeg";
    const quality = preferWebp ? WEBP_QUALITY : JPEG_QUALITY;

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => {
        if (!result) {
          reject(new Error("IMAGE_COMPRESSION_FAILED"));
          return;
        }

        resolve(result);
      }, outputType, quality);
    });

    const extension = getFileExtension(blob.type || outputType);
    const baseName = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_") || "dog-photo";

    return new File([blob], `${baseName}.${extension}`, {
      type: blob.type || outputType,
    });
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
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
      const compressed = await compressImage(file);
      const formData = new FormData();
      formData.append("image", compressed);

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
      setError(language === "fr" ? "Impossible de preparer la photo." : "Unable to prepare the photo.");
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
              fontSize: "2rem",
            }}
          >
            🐶
          </div>
        )}

        <div style={{ display: "grid", gap: 8 }}>
          <input
            ref={inputRef}
            accept="image/png,image/jpeg,image/webp"
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
              ? "La photo est reduite automatiquement pour prendre moins d'espace."
              : "The photo is automatically reduced to use less storage."}
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
