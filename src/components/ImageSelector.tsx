"use client";

import Image from "next/image";
import { useEffect, useState, useRef } from "react";

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

export function ImageSelector({ isOpen, onClose, onSelect, language }: ImageSelectorProps) {
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      fetchImages();
    }
  }, [isOpen]);

  const fetchImages = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/images");
      const data = await res.json();
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
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch("/api/admin/images", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de l'upload");
      }

      setSuccessMessage(
        language === "fr" ? "Image téléchargée avec succès!" : "Image uploaded successfully!"
      );
      // Rafraîchir la liste
      await fetchImages();
      // Sélectionner la nouvelle image
      onSelect(data.image.url);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setUploading(false);
      // Reset the input
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
          <h3 style={{ margin: 0 }}>
            {language === "fr" ? "📁 Choisir une image" : "📁 Choose an image"}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "24px",
              cursor: "pointer",
              padding: "0 8px",
            }}
          >
            ×
          </button>
        </div>

        {error && (
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
        )}

        {successMessage && (
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
        )}

        {/* Upload section */}
        <div style={{ marginBottom: "20px", padding: "16px", backgroundColor: "#f9fafb", borderRadius: "8px" }}>
          <p style={{ margin: "0 0 8px 0", fontWeight: "500" }}>
            {language === "fr" ? "Télécharger une nouvelle image" : "Upload a new image"}
          </p>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
              onChange={handleUpload}
              disabled={uploading}
              style={{ flex: 1 }}
            />
            {uploading && <span>{language === "fr" ? "Upload..." : "Uploading..."}</span>}
          </div>
          <p style={{ margin: "8px 0 0 0", fontSize: "12px", color: "#666" }}>
            {language === "fr"
              ? "Formats acceptés: PNG, JPG, GIF, WebP, SVG (max 5MB)"
              : "Accepted formats: PNG, JPG, GIF, WebP, SVG (max 5MB)"}
          </p>
        </div>

        {/* Images grid */}
        <div>
          <p style={{ margin: "0 0 12px 0", fontWeight: "500" }}>
            {language === "fr" ? "Images disponibles:" : "Available images:"}
          </p>

          {loading && <p>{language === "fr" ? "Chargement..." : "Loading..."}</p>}

          {!loading && images.length === 0 && (
            <p style={{ color: "#666" }}>
              {language === "fr"
                ? "Aucune image trouvée dans public/Logo/"
                : "No images found in public/Logo/"}
            </p>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
              gap: "12px",
            }}
          >
            {images.map((image) => (
              <div
                key={image.url}
                onClick={() => handleSelect(image.url)}
                style={{
                  cursor: "pointer",
                  border: "2px solid #e5e7eb",
                  borderRadius: "8px",
                  padding: "8px",
                  textAlign: "center",
                  transition: "border-color 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#3b82f6")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e5e7eb")}
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
                <p
                  style={{
                    margin: 0,
                    fontSize: "11px",
                    color: "#666",
                    wordBreak: "break-all",
                    lineHeight: "1.3",
                  }}
                >
                  {image.name}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

