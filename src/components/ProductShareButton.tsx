"use client";

import { useMemo, useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  Mail,
  MessageCircle,
  Send,
  Share2,
  Smartphone,
  X,
} from "lucide-react";
import type { Language } from "@/lib/i18n";
import {
  buildEmailShareUrl,
  buildFacebookSendDialogUrl,
  buildFacebookShareUrl,
  buildMessengerFallbackUrl,
  buildProductShareText,
  buildProductShareUrl,
  buildSmsShareUrl,
  buildWhatsAppShareUrl,
} from "@/lib/product-share";

type ProductShareButtonProps = {
  slug: string;
  name: string;
  priceLabel: string;
  language: Language;
  variant?: "card" | "product";
};

function getProductShareOrigin() {
  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin;
  }

  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://chezolive.ca";
}

function getFacebookSendConfig() {
  return {
    appId: process.env.NEXT_PUBLIC_FACEBOOK_APP_ID?.trim() ?? "",
    redirectUrl: process.env.NEXT_PUBLIC_FACEBOOK_SEND_REDIRECT_URL?.trim() || "https://chezolive.ca/boutique",
  };
}

function getShareErrorName(error: unknown) {
  return error instanceof Error ? error.name : "";
}

function getShareErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "";
}

function isMobileOrNativeMessengerContext() {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  const maybeNativeWindow = window as Window & {
    Capacitor?: {
      isNativePlatform?: () => boolean;
    };
  };

  if (document.documentElement.classList.contains("is-capacitor-native")) {
    return true;
  }

  if (maybeNativeWindow.Capacitor?.isNativePlatform?.() === true) {
    return true;
  }

  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function getShareButtonLabels(language: Language, variant: "card" | "product") {
  return {
    primary: variant === "product"
      ? language === "fr"
        ? "Partager ce produit"
        : "Share this product"
      : language === "fr"
        ? "Partager"
        : "Share",
    title: language === "fr" ? "Envoyer à quelqu’un" : "Send to someone",
    close: language === "fr" ? "Fermer le partage" : "Close sharing",
    message: language === "fr" ? "Message à envoyer" : "Message to send",
    native: language === "fr" ? "Envoyer avec mon téléphone" : "Send with my phone",
    sms: "SMS",
    messenger: "Messenger",
    whatsapp: "WhatsApp",
    email: language === "fr" ? "Courriel" : "Email",
    facebook: "Facebook",
    copy: language === "fr" ? "Copier" : "Copy",
    copied: language === "fr" ? "Copié" : "Copied",
    messengerDialogOpened: language === "fr"
      ? "Choisis le destinataire dans Messenger."
      : "Choose the recipient in Messenger.",
    messengerReadyTitle: language === "fr" ? "Messenger prêt" : "Messenger ready",
    messengerReadyBody: language === "fr"
      ? "Le message est copié. Ouvre Messenger, choisis la personne, puis colle le message."
      : "The message is copied. Open Messenger, choose the person, then paste the message.",
    messengerOpen: language === "fr" ? "Ouvrir Messenger" : "Open Messenger",
    messengerCopyAgain: language === "fr" ? "Copier encore" : "Copy again",
    messengerGuideClose: language === "fr" ? "Fermer" : "Close",
    messengerChoose: language === "fr"
      ? "Choisis Messenger dans la fenêtre de partage."
      : "Choose Messenger in the share sheet.",
    messengerSheetTitle: language === "fr" ? "Choisir Messenger" : "Choose Messenger",
    nativeSheetTitle: language === "fr" ? "Partager le produit" : "Share product",
    messengerCopied: language === "fr"
      ? "Message copié. Colle-le dans Messenger."
      : "Message copied. Paste it in Messenger.",
    copyUnavailable: language === "fr" ? "Copie non disponible" : "Copy unavailable",
    nativeUnavailable: language === "fr" ? "Partage téléphone non disponible" : "Phone share unavailable",
  };
}

export function ProductShareButton({
  slug,
  name,
  priceLabel,
  language,
  variant = "card",
}: ProductShareButtonProps) {
  const productUrl = useMemo(() => buildProductShareUrl(slug, getProductShareOrigin()), [slug]);
  const defaultMessage = useMemo(
    () => buildProductShareText({ language, name, priceLabel, url: productUrl }),
    [language, name, priceLabel, productUrl],
  );
  const [composerOpen, setComposerOpen] = useState(false);
  const [draftMessage, setDraftMessage] = useState(defaultMessage);
  const [statusMessage, setStatusMessage] = useState("");
  const [messengerGuideOpen, setMessengerGuideOpen] = useState(false);
  const outboundMessage = draftMessage.trim() || productUrl;
  const labels = useMemo(() => getShareButtonLabels(language, variant), [language, variant]);
  const facebookSendConfig = useMemo(() => getFacebookSendConfig(), []);
  const facebookUrl = useMemo(() => buildFacebookShareUrl(productUrl), [productUrl]);
  const facebookSendDialogUrl = useMemo(() => {
    if (!facebookSendConfig.appId) return "";
    return buildFacebookSendDialogUrl({
      appId: facebookSendConfig.appId,
      link: productUrl,
      redirectUri: facebookSendConfig.redirectUrl,
    });
  }, [facebookSendConfig, productUrl]);
  const smsUrl = useMemo(() => buildSmsShareUrl(outboundMessage), [outboundMessage]);
  const messengerUrl = useMemo(() => buildMessengerFallbackUrl(), []);
  const whatsAppUrl = useMemo(() => buildWhatsAppShareUrl(outboundMessage), [outboundMessage]);
  const emailSubject = language === "fr" ? `${name} chez Chez Olive` : `${name} at Chez Olive`;
  const emailUrl = useMemo(
    () => buildEmailShareUrl(emailSubject, outboundMessage),
    [emailSubject, outboundMessage],
  );
  const composerId = `product-share-${slug.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const messageId = `${composerId}-message`;
  const hasNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const shouldUseMobileMessengerFlow = isMobileOrNativeMessengerContext();

  const shareWithCapacitor = async (dialogTitle: string) => {
    try {
      const { Share } = await import("@capacitor/share");
      const canShare = await Share.canShare().catch(() => ({ value: true }));
      if (!canShare.value) return false;

      await Share.share({
        title: name,
        text: outboundMessage,
        url: productUrl,
        dialogTitle,
      });
      return true;
    } catch (error) {
      const message = getShareErrorMessage(error).toLowerCase();
      if (getShareErrorName(error) === "AbortError" || message.includes("cancel")) {
        return true;
      }
      return false;
    }
  };

  const handleToggleComposer = () => {
    setStatusMessage("");
    setMessengerGuideOpen(false);
    setComposerOpen((current) => !current);
  };

  const handleNativeShare = async () => {
    setStatusMessage("");

    if (shouldUseMobileMessengerFlow) {
      const sharedWithCapacitor = await shareWithCapacitor(labels.nativeSheetTitle);
      if (sharedWithCapacitor) {
        setComposerOpen(false);
        return;
      }
    }

    if (!hasNativeShare) {
      setStatusMessage(labels.nativeUnavailable);
      return;
    }

    try {
      await navigator.share({
        title: name,
        text: outboundMessage,
        url: productUrl,
      });
      setComposerOpen(false);
    } catch (error) {
      if (getShareErrorName(error) !== "AbortError") {
        setStatusMessage(labels.nativeUnavailable);
      }
    }
  };

  const handleCopy = async () => {
    setStatusMessage("");

    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      setStatusMessage(labels.copyUnavailable);
      return;
    }

    await navigator.clipboard.writeText(outboundMessage);
    setStatusMessage(labels.copied);
  };

  const copyMessengerMessage = async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      setStatusMessage(labels.copyUnavailable);
      return false;
    }

    await navigator.clipboard.writeText(outboundMessage);
    setStatusMessage(labels.messengerCopied);
    return true;
  };

  const handleOpenMessengerFallback = () => {
    if (typeof window !== "undefined") {
      window.open(messengerUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleMessengerShare = async () => {
    setStatusMessage(labels.messengerChoose);

    if (shouldUseMobileMessengerFlow) {
      const sharedWithCapacitor = await shareWithCapacitor(labels.messengerSheetTitle);
      if (sharedWithCapacitor) {
        setComposerOpen(false);
        return;
      }

      try {
        if (hasNativeShare) {
          await navigator.share({
            title: name,
            text: outboundMessage,
            url: productUrl,
          });
          setComposerOpen(false);
          return;
        }
      } catch (error) {
        if (getShareErrorName(error) === "AbortError") {
          return;
        }
      }

      const copied = await copyMessengerMessage();
      if (copied) {
        setMessengerGuideOpen(true);
      }
      return;
    }

    if (facebookSendDialogUrl) {
      if (typeof window !== "undefined") {
        window.open(facebookSendDialogUrl, "_blank", "noopener,noreferrer");
        setStatusMessage(labels.messengerDialogOpened);
      }
      return;
    }

    const copied = await copyMessengerMessage();
    if (copied) {
      setMessengerGuideOpen(true);
    }
  };

  return (
    <div className={`product-share product-share--${variant}`}>
      <button
        type="button"
        className="product-share__primary"
        onClick={handleToggleComposer}
        aria-controls={composerId}
        aria-expanded={composerOpen}
      >
        <Share2 aria-hidden="true" size={17} strokeWidth={2.4} />
        <span>{labels.primary}</span>
      </button>

      {composerOpen ? (
        <div className="product-share__composer" id={composerId}>
          <div className="product-share__composer-head">
            <strong>{labels.title}</strong>
            <button
              type="button"
              className="product-share__close"
              onClick={() => setComposerOpen(false)}
              aria-label={labels.close}
            >
              <X aria-hidden="true" size={16} strokeWidth={2.4} />
            </button>
          </div>

          <label className="product-share__label" htmlFor={messageId}>
            {labels.message}
          </label>
          <textarea
            id={messageId}
            className="product-share__message"
            value={draftMessage}
            onChange={(event) => {
              setDraftMessage(event.target.value);
              setStatusMessage("");
              setMessengerGuideOpen(false);
            }}
            rows={variant === "product" ? 4 : 3}
          />

          <div className="product-share__actions">
            {hasNativeShare ? (
              <button type="button" className="product-share__action product-share__action--wide" onClick={handleNativeShare}>
                <Smartphone aria-hidden="true" size={16} strokeWidth={2.4} />
                <span>{labels.native}</span>
              </button>
            ) : null}
            <a className="product-share__action" href={smsUrl}>
              <MessageCircle aria-hidden="true" size={16} strokeWidth={2.4} />
              <span>{labels.sms}</span>
            </a>
            <button type="button" className="product-share__action" onClick={handleMessengerShare}>
              <MessageCircle aria-hidden="true" size={16} strokeWidth={2.4} />
              <span>{labels.messenger}</span>
            </button>
            <a className="product-share__action" href={whatsAppUrl} target="_blank" rel="noopener noreferrer">
              <Send aria-hidden="true" size={16} strokeWidth={2.4} />
              <span>{labels.whatsapp}</span>
            </a>
            <a className="product-share__action" href={emailUrl}>
              <Mail aria-hidden="true" size={16} strokeWidth={2.4} />
              <span>{labels.email}</span>
            </a>
            <a className="product-share__action" href={facebookUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink aria-hidden="true" size={16} strokeWidth={2.4} />
              <span>{labels.facebook}</span>
            </a>
            <button type="button" className="product-share__action" onClick={handleCopy}>
              {statusMessage === labels.copied ? (
                <Check aria-hidden="true" size={16} strokeWidth={2.4} />
              ) : (
                <Copy aria-hidden="true" size={16} strokeWidth={2.4} />
              )}
              <span>{labels.copy}</span>
            </button>
          </div>

          {messengerGuideOpen ? (
            <div className="product-share__messenger-guide">
              <strong>{labels.messengerReadyTitle}</strong>
              <p>{labels.messengerReadyBody}</p>
              <div className="product-share__messenger-actions">
                <button type="button" className="product-share__action" onClick={handleOpenMessengerFallback}>
                  <ExternalLink aria-hidden="true" size={16} strokeWidth={2.4} />
                  <span>{labels.messengerOpen}</span>
                </button>
                <button type="button" className="product-share__action" onClick={copyMessengerMessage}>
                  <Copy aria-hidden="true" size={16} strokeWidth={2.4} />
                  <span>{labels.messengerCopyAgain}</span>
                </button>
                <button type="button" className="product-share__action" onClick={() => setMessengerGuideOpen(false)}>
                  <X aria-hidden="true" size={16} strokeWidth={2.4} />
                  <span>{labels.messengerGuideClose}</span>
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <span className="product-share__status" role="status" aria-live="polite">
        {statusMessage}
      </span>
    </div>
  );
}
