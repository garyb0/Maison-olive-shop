"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { NavIcon } from "@/components/NavIcon";

type SupportMessage = {
  id: string;
  senderType: "CUSTOMER" | "ADMIN" | "SYSTEM";
  content: string;
  readAt?: string | null;
  createdAt?: string;
};

type SupportConversation = {
  id: string;
  status: "WAITING" | "OPEN" | "ASSIGNED" | "CLOSED";
  customerEmail: string;
  customerName: string;
  closedAt?: string | null;
  lastMessageAt?: string | null;
  messages: SupportMessage[];
  unreadCount?: number;
  lastMessagePreview?: string;
};

type InboxPayload = {
  adminAvailable?: boolean;
  activeConversation?: SupportConversation | null;
  conversations?: SupportConversation[];
};

type ConversationPayload = {
  conversation?: SupportConversation;
  error?: string;
};

type Props = {
  language: "fr" | "en";
  supportEmail: string;
};

const ACTIVE_STATUSES = ["WAITING", "OPEN", "ASSIGNED"];
const ADMIN_AVATAR_URL = "/images/chez-olive/olive-head.png";

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function formatMessageTime(value: string | undefined, language: "fr" | "en") {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat(language === "fr" ? "fr-CA" : "en-CA", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function formatThreadDate(value: string | null | undefined, language: "fr" | "en") {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat(language === "fr" ? "fr-CA" : "en-CA", {
      month: "short",
      day: "numeric",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function getStatusLabel(status: SupportConversation["status"], language: "fr" | "en") {
  const fr: Record<SupportConversation["status"], string> = {
    WAITING: "Message envoyé",
    OPEN: "Conversation ouverte",
    ASSIGNED: "Réponse de l'équipe",
    CLOSED: "Terminée",
  };
  const en: Record<SupportConversation["status"], string> = {
    WAITING: "Message sent",
    OPEN: "Conversation open",
    ASSIGNED: "Team reply",
    CLOSED: "Closed",
  };
  return (language === "fr" ? fr : en)[status];
}

function sortConversations(conversations: SupportConversation[]) {
  const activeRank = (status: SupportConversation["status"]) => (ACTIVE_STATUSES.includes(status) ? 0 : 1);
  const timestamp = (conversation: SupportConversation) =>
    new Date(conversation.lastMessageAt ?? conversation.messages.at(-1)?.createdAt ?? 0).getTime();

  return [...conversations].sort((a, b) => {
    const rankDelta = activeRank(a.status) - activeRank(b.status);
    if (rankDelta !== 0) return rankDelta;
    return timestamp(b) - timestamp(a);
  });
}

export function AccountSupportClient({ language, supportEmail }: Props) {
  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adminAvailable, setAdminAvailable] = useState(false);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closeConfirming, setCloseConfirming] = useState(false);
  const [error, setError] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [readMarking, setReadMarking] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);
  const inboxAbortRef = useRef<AbortController | null>(null);

  const t = {
    title: language === "fr" ? "Messages" : "Messages",
    subtitle:
      language === "fr"
        ? "Tes échanges avec l'équipe Chez Olive."
        : "Your conversations with the Chez Olive team.",
    empty: language === "fr" ? "Écris-nous, on te répond ici." : "Message us, we will reply here.",
    input: language === "fr" ? "Écris ton message" : "Write your message",
    send: language === "fr" ? "Envoyer" : "Send",
    sending: language === "fr" ? "Envoi..." : "Sending...",
    newConversation: language === "fr" ? "Nouvelle conversation" : "New conversation",
    closed: language === "fr" ? "Conversation terminée" : "Conversation closed",
    readonly:
      language === "fr"
        ? "Cette conversation reste visible, mais elle est fermée."
        : "This conversation remains visible, but it is closed.",
    recent: language === "fr" ? "Discussions" : "Threads",
    help: language === "fr" ? "Centre d'aide" : "Help center",
    email: language === "fr" ? "Courriel" : "Email",
    synced: language === "fr" ? "Synchronisé" : "Synced",
    unavailable:
      language === "fr"
        ? "Impossible de charger les messages pour le moment."
        : "Unable to load messages right now.",
    failed:
      language === "fr"
        ? "Impossible d'envoyer le message pour le moment."
        : "Unable to send the message right now.",
    online: language === "fr" ? "Réponse ici" : "Reply here",
    offline: language === "fr" ? "On répondra ici" : "We will reply here",
    waitingTitle: language === "fr" ? "Ton message est bien ici" : "Your message is here",
    waitingCopy:
      language === "fr"
        ? "L'équipe n'a pas encore répondu dans ce billet. Sa réponse apparaîtra dans cette discussion."
        : "The team has not replied in this thread yet. Their reply will appear in this conversation.",
    closeTicket: language === "fr" ? "Fermer le billet" : "Close ticket",
    closeConfirmTitle: language === "fr" ? "Fermer ce billet ?" : "Close this ticket?",
    closeConfirmCopy:
      language === "fr"
        ? "La discussion restera visible en lecture seule. Tu pourras nous réécrire si besoin."
        : "The conversation will remain visible as read-only. You can message us again if needed.",
    confirmClose: language === "fr" ? "Oui, fermer" : "Yes, close",
    cancel: language === "fr" ? "Annuler" : "Cancel",
    closing: language === "fr" ? "Fermeture..." : "Closing...",
    closeFailed:
      language === "fr"
        ? "Impossible de fermer le billet pour le moment."
        : "Unable to close the ticket right now.",
  };

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedId) ?? null,
    [conversations, selectedId],
  );
  const isClosed = selectedConversation?.status === "CLOSED";
  const canSend = draft.trim().length > 0 && !sending && !closing && !isClosed;

  const mergeConversation = (conversation: SupportConversation) => {
    setConversations((current) => {
      const withoutCurrent = current.filter((item) => item.id !== conversation.id);
      return sortConversations([conversation, ...withoutCurrent]);
    });
    setSelectedId(conversation.id);
    setCloseConfirming(false);
  };

  const loadInbox = async (keepSelection = true) => {
    inboxAbortRef.current?.abort();
    const controller = new AbortController();
    inboxAbortRef.current = controller;

    try {
      const response = await fetch("/api/support/conversations", {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("LOAD_FAILED");
      const payload = (await response.json()) as InboxPayload;
      const nextConversations = sortConversations(payload.conversations ?? []);
      setAdminAvailable(Boolean(payload.adminAvailable));
      setConversations(nextConversations);
      setLastSyncedAt(new Date());
      setError("");

      setSelectedId((current) => {
        if (keepSelection && current && nextConversations.some((conversation) => conversation.id === current)) {
          return current;
        }
        return payload.activeConversation?.id ?? nextConversations[0]?.id ?? null;
      });
    } catch (error) {
      if (isAbortError(error)) return;
      setError(t.unavailable);
    } finally {
      if (inboxAbortRef.current === controller) {
        inboxAbortRef.current = null;
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadInbox(false);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void loadInbox(true);
    }, 5000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadInbox(true);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      inboxAbortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const container = messagesRef.current;
    if (!container) return;
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  }, [selectedConversation?.id, selectedConversation?.messages.length]);

  useEffect(() => {
    if (!selectedConversation || (selectedConversation.unreadCount ?? 0) <= 0 || readMarking) return;

    const markRead = async () => {
      setReadMarking(true);
      try {
        const response = await fetch(`/api/support/conversations/${selectedConversation.id}/read`, {
          method: "POST",
        });
        const payload = (await response.json().catch(() => ({}))) as ConversationPayload;
        if (response.ok && payload.conversation) {
          mergeConversation(payload.conversation);
        }
      } finally {
        setReadMarking(false);
      }
    };

    void markRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversation?.id, selectedConversation?.unreadCount, readMarking]);

  const startNewConversation = () => {
    setSelectedId(null);
    setDraft("");
    setError("");
    setCloseConfirming(false);
  };

  const submit = async () => {
    if (!canSend) return;

    setSending(true);
    setError("");
    try {
      const endpoint = selectedConversation
        ? `/api/support/conversations/${selectedConversation.id}/messages`
        : "/api/support/conversations";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selectedConversation ? { content: draft.trim() } : { message: draft.trim() }),
      });
      const payload = (await response.json().catch(() => ({}))) as ConversationPayload;
      if (!response.ok || !payload.conversation) {
        throw new Error(payload.error ?? "SEND_FAILED");
      }

      mergeConversation(payload.conversation);
      setDraft("");
      setLastSyncedAt(new Date());
    } catch {
      setError(t.failed);
    } finally {
      setSending(false);
    }
  };

  const closeSelectedConversation = async () => {
    if (!selectedConversation || isClosed || closing) return;

    setClosing(true);
    setError("");
    try {
      const response = await fetch(`/api/support/conversations/${selectedConversation.id}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "RESOLVED" }),
      });
      const payload = (await response.json().catch(() => ({}))) as ConversationPayload;
      if (!response.ok || !payload.conversation) {
        throw new Error(payload.error ?? "CLOSE_FAILED");
      }

      mergeConversation(payload.conversation);
      setDraft("");
      setLastSyncedAt(new Date());
    } catch {
      setError(t.closeFailed);
    } finally {
      setClosing(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  };

  const messages = selectedConversation?.messages ?? [];
  const hasTeamReply = messages.some((message) => message.senderType !== "CUSTOMER");
  const isWaitingForTeam =
    Boolean(selectedConversation) &&
    !isClosed &&
    messages.length > 0 &&
    !hasTeamReply &&
    messages.at(-1)?.senderType === "CUSTOMER";

  return (
    <div className="account-support-page account-support-inbox">
      <section className="account-support-inbox-hero">
        <div>
          <p className="account-home-hero__eyebrow">Support</p>
          <h1>{t.title}</h1>
          <p className="small account-section-copy">{t.subtitle}</p>
        </div>
        <div className="account-support-inbox-status" aria-live="polite">
          <span className={adminAvailable ? "account-support-dot" : "account-support-dot account-support-dot--muted"} />
          <strong>{adminAvailable ? t.online : t.offline}</strong>
          {lastSyncedAt ? (
            <small>
              {t.synced} {formatMessageTime(lastSyncedAt.toISOString(), language)}
            </small>
          ) : null}
        </div>
      </section>

      <section className="account-support-inbox-shell" aria-label={language === "fr" ? "Messagerie support" : "Support messaging"}>
        <aside className="account-support-thread-list" aria-label={t.recent}>
          <div className="account-support-thread-list__head">
            <strong>{t.recent}</strong>
            <button className="account-support-new-btn" onClick={startNewConversation} type="button">
              <NavIcon name="support" size={16} />
              {t.newConversation}
            </button>
          </div>

          {loading ? <div className="account-support-thread-empty">...</div> : null}
          {!loading && conversations.length === 0 ? (
            <button className="account-support-thread account-support-thread--empty active" onClick={startNewConversation} type="button">
              <strong>{language === "fr" ? "Nouvelle demande" : "New request"}</strong>
              <span>{t.empty}</span>
            </button>
          ) : null}
          {conversations.map((conversation) => (
            <button
              className={`account-support-thread${conversation.id === selectedId ? " active" : ""}`}
              key={conversation.id}
              onClick={() => {
                setSelectedId(conversation.id);
                setCloseConfirming(false);
              }}
              type="button"
            >
              <span className="account-support-thread__top">
                <strong>{getStatusLabel(conversation.status, language)}</strong>
                {conversation.unreadCount && conversation.unreadCount > 0 ? (
                  <em>{conversation.unreadCount}</em>
                ) : null}
              </span>
              <span>{conversation.lastMessagePreview || conversation.messages.at(-1)?.content || t.empty}</span>
              <small>{formatThreadDate(conversation.lastMessageAt ?? conversation.messages.at(-1)?.createdAt, language)}</small>
            </button>
          ))}
        </aside>

        <div className="account-support-chat-panel">
          <header className="account-support-chat-head">
            <div>
              <p className="account-home-hero__eyebrow">{selectedConversation ? getStatusLabel(selectedConversation.status, language) : "Support"}</p>
              <h2>{selectedConversation ? (language === "fr" ? "Discussion avec l'équipe" : "Conversation with the team") : t.empty}</h2>
            </div>
            <div className="account-support-chat-links">
              {selectedConversation && !isClosed ? (
                <button
                  className="account-support-close-btn"
                  disabled={closing}
                  onClick={() => setCloseConfirming(true)}
                  type="button"
                >
                  {t.closeTicket}
                </button>
              ) : null}
              <Link href="/faq">{t.help}</Link>
              <a href={`mailto:${supportEmail}`}>{t.email}</a>
            </div>
          </header>

          {closeConfirming && selectedConversation && !isClosed ? (
            <div className="account-support-close-confirm" role="alert">
              <div>
                <strong>{t.closeConfirmTitle}</strong>
                <span>{t.closeConfirmCopy}</span>
              </div>
              <button
                className="btn btn-danger"
                disabled={closing}
                onClick={() => void closeSelectedConversation()}
                type="button"
              >
                {closing ? t.closing : t.confirmClose}
              </button>
              <button
                className="btn btn-secondary"
                disabled={closing}
                onClick={() => setCloseConfirming(false)}
                type="button"
              >
                {t.cancel}
              </button>
            </div>
          ) : null}

          <div className="account-support-messages" ref={messagesRef}>
            {!selectedConversation && !loading ? (
              <div className="account-support-empty-state">
                <NavIcon name="support" size={28} />
                <strong>{t.empty}</strong>
              </div>
            ) : null}

            {isWaitingForTeam ? (
              <div className="account-support-team-waiting" role="status">
                <NavIcon name="support" size={20} />
                <div>
                  <strong>{t.waitingTitle}</strong>
                  <span>{t.waitingCopy}</span>
                </div>
              </div>
            ) : null}

            {messages.map((message) => (
              <article
                className={`account-support-message account-support-message--${message.senderType.toLowerCase()}`}
                key={message.id}
              >
                {message.senderType !== "CUSTOMER" ? (
                  <Image
                    alt=""
                    aria-hidden="true"
                    className="account-support-message__avatar"
                    height={32}
                    src={ADMIN_AVATAR_URL}
                    width={32}
                  />
                ) : null}
                <div className="account-support-message__bubble">
                  {message.senderType !== "CUSTOMER" ? (
                    <span className="account-support-message__author">
                      {language === "fr" ? "Équipe Chez Olive" : "Chez Olive team"}
                    </span>
                  ) : null}
                  <p>{message.content}</p>
                  <time>{formatMessageTime(message.createdAt, language)}</time>
                </div>
              </article>
            ))}
          </div>

          {isClosed ? (
            <div className="account-support-readonly">
              <strong>{t.closed}</strong>
              <span>{t.readonly}</span>
              <button className="btn btn-secondary" onClick={startNewConversation} type="button">
                {t.newConversation}
              </button>
            </div>
          ) : (
            <div className="account-support-composer">
              {error ? <div className="account-support-error">{error}</div> : null}
              <textarea
                className="account-support-textarea"
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t.input}
                rows={3}
                value={draft}
              />
              <button className="btn account-support-send" disabled={!canSend} onClick={() => void submit()} type="button">
                {sending ? t.sending : t.send}
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
