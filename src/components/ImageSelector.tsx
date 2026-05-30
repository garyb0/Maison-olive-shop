"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { compressImageFile, formatImageBytes } from "@/lib/client-image-compression";

export type ImageInfo = {
  name: string;
  url: string;
  size: string;
};

type ImageSelectorProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
  language: "fr" | "en";
};

const MAX_SOURCE_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_ADMIN_IMAGE_BYTES = 2.2 * 1024 * 1024;
const MAX_ADMIN_DIRECT_UPLOAD_BYTES = 5 * 1024 * 1024;
const VALID_ADMIN_IMAGE_TYPES = new Set(["image/gif", "image/jpeg", "image/png", "image/webp"]);

export function ImageSelector({ isOpen, onClose, onSelect, language }: ImageSelectorProps) {
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      void fetchImages();
    }
  }, [isOpen]);

  const fetchImages = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/images");
      const data = (await res.json()) as { error?: string; images?: ImageInfo[] };

      if (!res.ok) {
        throw new Error(data.error || "Erreur lors du chargement des images");
      }

      setImages(data.images || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (!VALID_ADMIN_IMAGE_TYPES.has(file.type)) {
        throw new Error(language === "fr" ? "Choisis une image PNG, JPG, GIF ou WebP." : "Choose a PNG, JPG, GIF, or WebP image.");
      }

      if (file.size > MAX_SOURCE_IMAGE_BYTES) {
        throw new Error(
          language === "fr"
            ? `Image trop lourde. Maximum: ${formatImageBytes(MAX_SOURCE_IMAGE_BYTES)}.`
            : `Image is too large. Maximum: ${formatImageBytes(MAX_SOURCE_IMAGE_BYTES)}.`,
        );
      }

      let imageFile = file;

      if (file.type !== "image/gif" && file.size > MAX_ADMIN_IMAGE_BYTES) {
        try {
          imageFile = await compressImageFile(file, {
            fileNamePrefix: "catalog-image",
            initialQuality: 0.78,
            maxDimension: 1600,
            minDimension: 720,
            targetMaxBytes: MAX_ADMIN_IMAGE_BYTES,
          });
        } catch {
          if (file.size > MAX_ADMIN_DIRECT_UPLOAD_BYTES) {
            throw new Error(
              language === "fr"
                ? "Impossible de lire cette image. Essaie un export JPG ou PNG plus petit."
                : "Unable to read this image. Try a smaller JPG or PNG export.",
            );
          }
        }
      }

      if (imageFile.size > MAX_ADMIN_DIRECT_UPLOAD_BYTES) {
        throw new Error(
          language === "fr"
            ? "Cette image reste trop lourde apres compression."
            : "This image is still too large after compression.",
        );
      }

      const formData = new FormData();
      formData.append("image", imageFile, imageFile.name);

      const res = await fetch("/api/admin/images", {
        method: "POST",
        body: formData,
      });

      const data = (await res.json()) as { error?: string; image?: { url?: string } };

      if (!res.ok || !data.image?.url) {
        throw new Error(data.error || "Erreur lors de l'upload");
      }

      setSuccessMessage(language === "fr" ? "Image téléchargée avec succès!" : "Image uploaded successfully!");
      await fetchImages();
      onSelect(data.image.url);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSelect = (url: string) => {
    onSelect(url);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: "#fff",
          borderRadius: "8px",
          padding: "24px",
          maxWidth: "700px",
          width: "90%",
          maxHeight: "80vh",
          overflow: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h3 style={{ margin: 0 }}>{language === "fr" ? "Choisir une image" : "Choose an image"}</h3>
          <button
            aria-label={language === "fr" ? "Fermer" : "Close"}
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "24px",
              cursor: "pointer",
              padding: "0 8px",
            }}
            type="button"
          >
            ×
          </button>
        </div>

        {error ? (
          <div
            style={{
              backgroundColor: "#fee2e2",
              color: "#dc2626",
              padding: "12px",
              borderRadius: "4px",
              marginBottom: "16px",
            }}
          >
            {error}
          </div>
        ) : null}

        {successMessage ? (
          <div
            style={{
              backgroundColor: "#dcfce7",
              color: "#16a34a",
              padding: "12px",
              borderRadius: "4px",
              marginBottom: "16px",
            }}
          >
            {successMessage}
          </div>
        ) : null}

        <div style={{ marginBottom: "20px", padding: "16px", backgroundColor: "#f9fafb", borderRadius: "8px" }}>
          <p style={{ margin: "0 0 8px 0", fontWeight: "500" }}>
            {language === "fr" ? "Télécharger une nouvelle image" : "Upload a new image"}
          </p>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleUpload}
              disabled={uploading}
              style={{ flex: 1 }}
            />
            {uploading ? <span>{language === "fr" ? "Upload..." : "Uploading..."}</span> : null}
          </div>
          <p style={{ margin: "8px 0 0 0", fontSize: "12px", color: "#666" }}>
            {language === "fr"
              ? `PNG, JPG, GIF, WebP. Reduction automatique jusqu'a ${formatImageBytes(MAX_SOURCE_IMAGE_BYTES)}.`
              : `PNG, JPG, GIF, WebP. Automatic reduction up to ${formatImageBytes(MAX_SOURCE_IMAGE_BYTES)}.`}
          </p>
        </div>

        <div>
          <p style={{ margin: "0 0 12px 0", fontWeight: "500" }}>
            {language === "fr" ? "Images disponibles:" : "Available images:"}
          </p>

          {loading ? <p>{language === "fr" ? "Chargement..." : "Loading..."}</p> : null}

          {!loading && images.length === 0 ? (
            <p style={{ color: "#666" }}>
              {language === "fr" ? "Aucune image trouvée dans public/Logo/" : "No images found in public/Logo/"}
            </p>
          ) : null}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
              gap: "12px",
            }}
          >
            {images.map((image) => (
              <button
                key={image.url}
                onClick={() => handleSelect(image.url)}
                style={{
                  cursor: "pointer",
                  border: "2px solid #e5e7eb",
                  borderRadius: "8px",
                  padding: "8px",
                  textAlign: "center",
                  transition: "border-color 0.2s",
                  background: "#fff",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#3b82f6")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e5e7eb")}
                type="button"
              >
                <Image
                  src={image.url}
                  alt={image.name}
                  width={120}
                  height={80}
                  style={{
                    width: "100%",
                    height: "80px",
                    objectFit: "contain",
                    borderRadius: "4px",
                    marginBottom: "8px",
                  }}
                />
                <span
                  style={{
                    display: "block",
                    margin: 0,
                    fontSize: "11px",
                    color: "#666",
                    wordBreak: "break-all",
                    lineHeight: "1.3",
                  }}
                >
                  {image.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
