"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

type SupportMessage = {
  id: string;
  senderType: "CUSTOMER" | "ADMIN" | "SYSTEM";
  content: string;
  createdAt?: string;
};

type SupportConversation = {
  id: string;
  status: "WAITING" | "OPEN" | "ASSIGNED" | "CLOSED";
  customerEmail: string;
  customerName: string;
  closedAt?: string | null;
  messages: SupportMessage[];
};

type Props = {
  language: "fr" | "en";
  user?: { firstName?: string; lastName?: string; email?: string; role?: string } | null;
};

type SupportStatePayload = {
  adminAvailable?: boolean;
  activeConversation?: SupportConversation | null;
};

const STORAGE_KEY = "support_conv";
const AVATAR_URL = "/Logo/Olive.png";

function loadGuestSession(): { id: string; email: string; name: string; token: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as Record<string, unknown>).id === "string" &&
      typeof (parsed as Record<string, unknown>).email === "string"
    ) {
      return {
        id: String((parsed as Record<string, unknown>).id),
        email: String((parsed as Record<string, unknown>).email),
        name: typeof (parsed as Record<string, unknown>).name === "string" ? String((parsed as Record<string, unknown>).name) : "",
        token: typeof (parsed as Record<string, unknown>).token === "string" ? String((parsed as Record<string, unknown>).token) : "",
      };
    }
  } catch {
    // ignore
  }
  return null;
}

function saveGuestSession(id: string, email: string, name: string, token: string) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ id, email, name, token }));
  } catch {
    // ignore
  }
}

function clearGuestSession() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

function formatTime(dateStr?: string, language: "fr" | "en" = "fr") {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleTimeString(language === "fr" ? "fr-CA" : "en-CA", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function getCustomerDisplayName(user?: Props["user"], conversation?: SupportConversation | null) {
  const accountName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
  if (accountName) return accountName;
  return conversation?.customerName ?? "";
}

function getConversationStatusLabel(
  status: SupportConversation["status"] | undefined,
  language: "fr" | "en",
) {
  if (!status) return "";

  if (language === "fr") {
    switch (status) {
      case "WAITING":
        return "Message Reçu";
      case "OPEN":
        return "Conversation ouverte";
      case "ASSIGNED":
        return "Equipe en cours";
      case "CLOSED":
        return "Conversation terminée";
      default:
        return "";
    }
  }

  switch (status) {
    case "WAITING":
      return "Message received";
    case "OPEN":
      return "Conversation open";
    case "ASSIGNED":
      return "Team replying";
    case "CLOSED":
      return "Conversation closed";
    default:
      return "";
  }
}

export function SupportChatWidget({ language, user }: Props) {
  const [open, setOpen] = useState(false);
  const [conversation, setConversation] = useState<SupportConversation | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingConversation, setLoadingConversation] = useState(true);
  const [adminAvailable, setAdminAvailable] = useState(false);
  const [unread, setUnread] = useState(0);
  const [hadNetworkIssue, setHadNetworkIssue] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);
  const previousMessageCount = useRef(0);

  const t = {
    title: language === "fr" ? "Support Chez Olive" : "Chez Olive Support",
    subtitleAvailable:
      language === "fr" ? "Notre équipe peut vous répondre ici" : "Our team can reply to you here",
    subtitleOffline:
      language === "fr" ? "Laissez-nous un message, on reviendra vers vous" : "Leave us a message and we'll get back to you",
    floating: language === "fr" ? "Aide" : "Help",
    floatingActive: language === "fr" ? "Discussion ouverte" : "Chat open",
    guestIntro:
      language === "fr"
        ? "Laissez votre prénom, votre email et votre message. On vous répondra ici avec douceur."
        : "Leave your name, email, and message. We'll reply right here.",
    signedInIntro:
      language === "fr"
        ? "Posez votre question. Notre équipe vous répondra ici."
        : "Ask your question and our team will reply here.",
    guestReplyIntro:
      language === "fr"
        ? "Vous pouvez continuer la conversation ici en tout temps."
        : "You can keep the conversation going here anytime.",
    name: language === "fr" ? "Prénom" : "Name",
    email: "Email",
    placeholder:
      language === "fr"
        ? "Bonjour, j'ai besoin d'aide avec..."
        : "Hello, I need help with...",
    send: language === "fr" ? "Envoyer" : "Send",
    sending: language === "fr" ? "Envoi..." : "Sending...",
    start: language === "fr" ? "Envoyer le premier message" : "Send first message",
    newConversation: language === "fr" ? "Nouvelle conversation" : "New conversation",
    closed: language === "fr" ? "Cette conversation est terminée." : "This conversation is closed.",
    empty:
      language === "fr"
        ? "Une fois votre message envoyé, la conversation apparaîtra ici."
        : "Once you send your message, the conversation will appear here.",
    errorIdentity:
      language === "fr"
        ? "Merci d'indiquer votre prénom et votre email."
        : "Please enter your name and email.",
    errorSend:
      language === "fr"
        ? "Impossible d'envoyer votre message pour le moment."
        : "Unable to send your message right now.",
    errorPolling:
      language === "fr"
        ? "La connexion semble capricieuse. Vous pouvez réessayer dans un instant."
        : "The connection seems unstable. Please try again in a moment.",
    signedInAs: language === "fr" ? "Connecte en tant que" : "Signed in as",
    loading: language === "fr" ? "Chargement..." : "Loading...",
  };

  const signedInName = useMemo(() => getCustomerDisplayName(user, conversation), [user, conversation]);
  const canSendGuestIdentity = guestName.trim().length > 0 && guestEmail.trim().length > 0;
  const canSend = draft.trim().length > 0 && (Boolean(user) || canSendGuestIdentity || Boolean(conversation));
  const isClosed = conversation?.status === "CLOSED";
  const statusLabel = getConversationStatusLabel(conversation?.status, language);

  const fetchGuestConversation = async (id: string, token: string) => {
    if (!token) {
      clearGuestSession();
      setConversation(null);
      previousMessageCount.current = 0;
      return;
    }

    const response = await fetch(`/api/support/conversations/${id}?token=${encodeURIComponent(token)}`);
    if (!response.ok) {
      clearGuestSession();
      setConversation(null);
      previousMessageCount.current = 0;
      return;
    }

    const payload = (await response.json()) as { conversation?: SupportConversation };
    const nextConversation = payload.conversation ?? null;
    setConversation(nextConversation);
  };

  useEffect(() => {
    if (user) return;
    const session = loadGuestSession();
    if (!session) {
      setLoadingConversation(false);
      return;
    }
    if (!session.token) {
      clearGuestSession();
      setLoadingConversation(false);
      return;
    }

    setGuestName(session.name);
    setGuestEmail(session.email);
    void fetchGuestConversation(session.id, session.token).finally(() => setLoadingConversation(false));
  }, [user]);

  useEffect(() => {
    let active = true;

    const poll = async () => {
      try {
        const stateResponse = await fetch("/api/support/state");
        if (!stateResponse.ok || !active) return;
        const state = (await stateResponse.json()) as SupportStatePayload;
        setAdminAvailable(Boolean(state.adminAvailable));
        setHadNetworkIssue(false);

        if (user) {
          const nextConversation = state.activeConversation ?? null;
          if (!active) return;
          setConversation(nextConversation);
          if (!nextConversation) {
            previousMessageCount.current = 0;
          }
          return;
        }

        const session = loadGuestSession();
        if (session?.id && session.token) {
          await fetchGuestConversation(session.id, session.token);
        }
      } catch {
        if (active) {
          setHadNetworkIssue(true);
        }
      } finally {
        if (active) {
          setLoadingConversation(false);
        }
      }
    };

    void poll();
    const interval = window.setInterval(() => {
      void poll();
    }, open ? 5000 : 15000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [open, user]);

  useEffect(() => {
    const nextCount = conversation?.messages.length ?? 0;
    const previousCount = previousMessageCount.current;

    if (!open && conversation && nextCount > previousCount) {
      const newMessages = conversation.messages.slice(previousCount);
      const unreadIncrement = newMessages.filter((message) => message.senderType !== "CUSTOMER").length;
      if (unreadIncrement > 0) {
        setUnread((current) => current + unreadIncrement);
      }
    }

    previousMessageCount.current = nextCount;
  }, [conversation, open]);

  useEffect(() => {
    if (!open) return;
    setUnread(0);
    const container = messagesRef.current;
    if (!container) return;
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  }, [open, conversation?.messages.length]);

  const resetConversation = () => {
    clearGuestSession();
    setConversation(null);
    setDraft("");
    setError("");
    previousMessageCount.current = 0;
  };

  const submit = async () => {
    if (!draft.trim()) return;

    if (!user && !conversation && !canSendGuestIdentity) {
      setError(t.errorIdentity);
      return;
    }

    setLoading(true);
    setError("");

    try {
      let response: Response;
      const guestSession = !user ? loadGuestSession() : null;

      if (conversation) {
        if (!user && !guestSession?.token) {
          clearGuestSession();
          setConversation(null);
          setError(t.errorSend);
          return;
        }

        response = await fetch(`/api/support/conversations/${conversation.id}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            user
              ? { content: draft.trim() }
              : { content: draft.trim(), guestEmail: guestEmail.trim(), guestToken: guestSession?.token },
          ),
        });
      } else {
        response = await fetch("/api/support/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: user ? undefined : guestName.trim(),
            email: user ? undefined : guestEmail.trim(),
            message: draft.trim(),
          }),
        });
      }

      const payload = (await response.json().catch(() => ({}))) as {
        conversation?: SupportConversation;
        guestAccessToken?: string;
        error?: string;
      };
      if (!response.ok || !payload.conversation) {
        setError(payload.error ?? t.errorSend);
        return;
      }

      setConversation(payload.conversation);
      if (!user) {
        const guestToken = payload.guestAccessToken ?? guestSession?.token ?? "";
        if (!guestToken) {
          setError(t.errorSend);
          return;
        }
        saveGuestSession(payload.conversation.id, guestEmail.trim(), guestName.trim(), guestToken);
      }
      setDraft("");
    } catch {
      setError(t.errorSend);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <>
      <button
        className="support-lite-float"
        type="button"
        aria-label={open ? t.floatingActive : t.floating}
        onClick={() => {
          setOpen((current) => !current);
          setUnread(0);
        }}
      >
        <span className="support-lite-float__icon">💬</span>
        <span className="support-lite-float__text">
          <span className="support-lite-float__label">{open ? t.floatingActive : t.floating}</span>
          <span className="support-lite-float__meta">
            {unread > 0
              ? language === "fr"
                ? `${unread} nouveau${unread > 1 ? "x" : ""}`
                : `${unread} new`
              : adminAvailable
                ? language === "fr"
                  ? "Reponse ici"
                  : "Reply here"
                : language === "fr"
                  ? "Message hors ligne"
                  : "Offline message"}
          </span>
        </span>
        {unread > 0 ? <span className="support-lite-float__badge">{unread}</span> : null}
      </button>

      {open ? (
        <section className="support-lite-window" aria-label={t.title} role="dialog">
          <header className="support-lite-header">
            <div className="support-lite-header__identity">
              <Image alt="Olive" className="support-lite-avatar" src={AVATAR_URL} width={48} height={48} />
              <div>
                <strong className="support-lite-title">{t.title}</strong>
                <p className="support-lite-subtitle">
                  {adminAvailable ? t.subtitleAvailable : t.subtitleOffline}
                </p>
                {statusLabel ? <span className="support-lite-status">{statusLabel}</span> : null}
              </div>
            </div>
            <button className="support-lite-close" onClick={() => setOpen(false)} type="button">
              ✕
            </button>
          </header>

          <div className="support-lite-body">
            {user ? (
              <div className="support-lite-identity-card">
                <p className="support-lite-identity-label">{t.signedInAs}</p>
                <strong>{signedInName}</strong>
                <span>{user.email}</span>
              </div>
            ) : !conversation ? (
              <div className="support-lite-guest-grid">
                <p className="support-lite-intro">{t.guestIntro}</p>
                <input
                  className="input"
                  placeholder={t.name}
                  value={guestName}
                  onChange={(event) => setGuestName(event.target.value)}
                />
                <input
                  className="input"
                  placeholder={t.email}
                  autoComplete="email"
                  type="email"
                  value={guestEmail}
                  onChange={(event) => setGuestEmail(event.target.value)}
                />
              </div>
            ) : null}

            {user ? <p className="support-lite-intro">{t.signedInIntro}</p> : null}
            {!user && conversation ? <p className="support-lite-intro">{t.guestReplyIntro}</p> : null}

            <div className="support-lite-messages" ref={messagesRef}>
              {loadingConversation && !conversation ? (
                <div className="support-lite-empty">{t.loading}</div>
              ) : null}

              {!loadingConversation && !conversation ? (
                <div className="support-lite-empty">{t.empty}</div>
              ) : null}

              {conversation?.messages.map((message) => (
                <article
                  className={`support-lite-message support-lite-message--${message.senderType.toLowerCase()}`}
                  key={message.id}
                >
                  {message.senderType !== "CUSTOMER" ? (
                    <Image alt="Olive" className="support-lite-message__avatar" src={AVATAR_URL} width={36} height={36} />
                  ) : null}
                  <div className="support-lite-message__content">
                    <div className="support-lite-message__bubble">{message.content}</div>
                    <span className="support-lite-message__time">{formatTime(message.createdAt, language)}</span>
                  </div>
                </article>
              ))}
            </div>

            {isClosed ? <div className="support-lite-closed">{t.closed}</div> : null}
            {hadNetworkIssue ? <div className="support-lite-error support-lite-error--muted">{t.errorPolling}</div> : null}
            {error ? <div className="support-lite-error">{error}</div> : null}
          </div>

          {isClosed ? (
            <div className="support-lite-footer support-lite-footer--closed">
              <button className="btn btn-secondary" onClick={resetConversation} type="button">
                {t.newConversation}
              </button>
            </div>
          ) : (
            <div className="support-lite-footer">
              <textarea
                className="support-lite-textarea"
                disabled={loading}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={onKeyDown}
                placeholder={t.placeholder}
                rows={3}
                value={draft}
              />
              <button className="btn" disabled={loading || !canSend} onClick={() => void submit()} type="button">
                {loading ? t.sending : conversation ? t.send : t.start}
              </button>
            </div>
          )}
        </section>
      ) : null}
    </>
  );
}

