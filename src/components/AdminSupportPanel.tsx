"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

type Message = {
  id: string;
  senderType: "CUSTOMER" | "ADMIN" | "SYSTEM";
  content: string;
  createdAt?: string;
};

type Conversation = {
  id: string;
  customerEmail: string;
  customerName: string;
  status: "WAITING" | "OPEN" | "ASSIGNED" | "CLOSED";
  lastMessageAt?: string;
  messages: Message[];
};

type Props = {
  language: "fr" | "en";
};

const STATUS_LABEL: Record<string, string> = {
  WAITING: "⏳",
  OPEN: "🟢",
  ASSIGNED: "👤",
  CLOSED: "✓",
};

const QUICK_REPLIES_KEY = "admin_quick_replies";
const ADMIN_NAME_KEY = "admin_display_name";

const DEFAULT_QUICK_REPLIES_FR = (name: string) => [
  `Bonjour ! Je suis ${name} de l'équipe Maison Olive. Comment puis-je vous aider aujourd'hui ? 🫒`,
  `Bonjour ! ${name} à votre service. Je suis là pour vous aider !`,
  `Merci pour votre message ! Je vérifie ça pour vous et reviens vers vous dans quelques instants.`,
  `Votre commande est actuellement en cours de traitement. Vous recevrez une confirmation par email sous peu.`,
  `Je comprends votre situation. Laissez-moi vérifier ça avec notre équipe et je vous reviens très rapidement.`,
  `Avez-vous d'autres questions ? Je suis disponible pour vous aider !`,
  `Merci pour votre patience. Votre satisfaction est notre priorité chez Maison Olive.`,
  `Cette conversation est maintenant terminée. N'hésitez pas à nous recontacter si vous avez d'autres questions. Bonne journée ! 🫒`,
];

const DEFAULT_QUICK_REPLIES_EN = (name: string) => [
  `Hello! I'm ${name} from the Maison Olive team. How can I help you today? 🫒`,
  `Hi there! ${name} here at your service. I'm here to help!`,
  `Thank you for your message! Let me check on that for you and I'll be right back.`,
  `Your order is currently being processed. You will receive a confirmation email shortly.`,
  `I understand your situation. Let me check with our team and get back to you very quickly.`,
  `Do you have any other questions? I'm here to help!`,
  `Thank you for your patience. Your satisfaction is our priority at Maison Olive.`,
  `This conversation is now closed. Don't hesitate to contact us again if you have other questions. Have a great day! 🫒`,
];

function formatTime(dateStr?: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function formatRelativeTime(dateStr?: string, language: "fr" | "en" = "fr"): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return language === "fr" ? "à l'instant" : "just now";
    }
    if (diffMins < 60) {
      return language === "fr"
        ? `il y a ${diffMins}min`
        : `${diffMins}m ago`;
    }
    if (diffHours < 24) {
      return language === "fr"
        ? `il y a ${diffHours}h`
        : `${diffHours}h ago`;
    }
    if (diffDays === 1) {
      return language === "fr" ? "hier" : "yesterday";
    }
    if (diffDays < 7) {
      return language === "fr"
        ? `il y a ${diffDays}j`
        : `${diffDays}d ago`;
    }
    return d.toLocaleDateString(language === "fr" ? "fr-CA" : "en-CA", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

function formatDateLabel(dateStr: string, language: "fr" | "en"): string {
  try {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const toDateStr = (dt: Date) => dt.toDateString();
    if (toDateStr(d) === toDateStr(today)) return language === "fr" ? "Aujourd'hui" : "Today";
    if (toDateStr(d) === toDateStr(yesterday)) return language === "fr" ? "Hier" : "Yesterday";
    return d.toLocaleDateString(language === "fr" ? "fr-CA" : "en-CA", { weekday: "long", month: "long", day: "numeric" });
  } catch {
    return "";
  }
}

function playBeep() {
  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    // ignore — AudioContext not available
  }
}

function loadQuickReplies(): string[] {
  try {
    const raw = localStorage.getItem(QUICK_REPLIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
      return parsed as string[];
    }
  } catch {
    // ignore
  }
  return [];
}

function saveQuickReplies(replies: string[]) {
  try {
    localStorage.setItem(QUICK_REPLIES_KEY, JSON.stringify(replies));
  } catch {
    // ignore
  }
}

function loadAdminName(): string {
  try {
    return localStorage.getItem(ADMIN_NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

function saveAdminName(name: string) {
  try {
    localStorage.setItem(ADMIN_NAME_KEY, name);
  } catch {
    // ignore
  }
}

export function AdminSupportPanel({ language }: Props) {
  const [items, setItems] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listScrollRestoreRef = useRef<number | null>(null);

  // Request notification permission on mount
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Send browser notification when new waiting conversation appears
  useEffect(() => {
    const waitingCount = items.filter((c) => c.status === "WAITING").length;
    const newWaiting = waitingCount - prevWaitingCountRef.current;
    
    if (newWaiting > 0 && typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      const title = language === "fr" 
        ? `🔔 ${newWaiting} nouvelle conversation${newWaiting > 1 ? 's' : ''}` 
        : `🔔 ${newWaiting} new conversation${newWaiting > 1 ? 's' : ''}`;
      
      const body = language === "fr"
        ? "Un client attend votre réponse sur Maison Olive"
        : "A customer is waiting for your response on Maison Olive";
      
      new Notification(title, {
        body,
        icon: "/olive-logo-3.png",
        tag: "support-notification",
        requireInteraction: true,
      });
    }
    
    prevWaitingCountRef.current = waitingCount;
  }, [items, language]);

  // Quick replies state
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [adminName, setAdminName] = useState("");
  const [adminNameInput, setAdminNameInput] = useState("");
  const [newReply, setNewReply] = useState("");
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const draftRef = useRef<HTMLTextAreaElement>(null);

  const t = {
    title: language === "fr" ? "Support client en direct" : "Live customer support",
    none: language === "fr" ? "Aucune conversation." : "No conversations.",
    pick: language === "fr" ? "Sélectionne une conversation à gauche." : "Select a conversation on the left.",
    assign: language === "fr" ? "Prendre en charge" : "Take over",
    close: language === "fr" ? "Fermer" : "Close",
    send: language === "fr" ? "Envoyer" : "Send",
    reply: language === "fr" ? "Écrire une réponse…" : "Write a reply…",
    closed: language === "fr" ? "Conversation terminée." : "Conversation closed.",
    waiting: language === "fr" ? "En attente" : "Waiting",
    filterAll: language === "fr" ? "Tout" : "All",
    filterOpen: language === "fr" ? "Actives" : "Active",
    filterClosed: language === "fr" ? "Fermées" : "Closed",
    quickReplies: language === "fr" ? "Réponses rapides" : "Quick replies",
    quickRepliesHint: language === "fr" ? "Cliquez sur une phrase pour l'insérer" : "Click a phrase to insert it",
    addReply: language === "fr" ? "Ajouter une phrase…" : "Add a phrase…",
    add: language === "fr" ? "Ajouter" : "Add",
    delete: language === "fr" ? "✕" : "✕",
    loadDefaults: language === "fr" ? "Charger les phrases par défaut" : "Load default phrases",
    clearAll: language === "fr" ? "Tout effacer" : "Clear all",
    yourName: language === "fr" ? "Votre prénom (affiché dans les salutations)" : "Your first name (shown in greetings)",
    namePlaceholder: language === "fr" ? "Ex: Sophie" : "e.g. Sophie",
    saveName: language === "fr" ? "Sauvegarder" : "Save",
    nameLabel: language === "fr" ? "Bonjour, je suis" : "Hello, I'm",
    changeName: language === "fr" ? "Modifier" : "Change",
    noReplies: language === "fr"
      ? "Aucune phrase sauvegardée. Chargez les phrases par défaut ou ajoutez les vôtres."
      : "No saved phrases. Load default phrases or add your own.",
  };

  // Load from localStorage on mount
  useEffect(() => {
    const stored = loadQuickReplies();
    const storedName = loadAdminName();
    const displayName = storedName || (language === "fr" ? "votre conseiller" : "your advisor");
    setAdminName(displayName);
    setAdminNameInput(storedName);

    if (stored.length > 0) {
      setQuickReplies(stored);
    } else {
      // First load — populate with defaults
      const defaults = language === "fr"
        ? DEFAULT_QUICK_REPLIES_FR(displayName)
        : DEFAULT_QUICK_REPLIES_EN(displayName);
      setQuickReplies(defaults);
      saveQuickReplies(defaults);
    }
  }, [language]);

  const saveNameAndUpdate = () => {
    const trimmed = adminNameInput.trim();
    const displayName = trimmed || (language === "fr" ? "votre conseiller" : "your advisor");
    saveAdminName(trimmed);
    setAdminName(displayName);
    setEditingName(false);
  };

  const loadDefaults = () => {
    const defaults = language === "fr"
      ? DEFAULT_QUICK_REPLIES_FR(adminName)
      : DEFAULT_QUICK_REPLIES_EN(adminName);
    setQuickReplies(defaults);
    saveQuickReplies(defaults);
  };

  const clearAllReplies = () => {
    setQuickReplies([]);
    saveQuickReplies([]);
  };

  const addReply = () => {
    if (!newReply.trim()) return;
    const updated = [...quickReplies, newReply.trim()];
    setQuickReplies(updated);
    saveQuickReplies(updated);
    setNewReply("");
  };

  const deleteReply = (index: number) => {
    const updated = quickReplies.filter((_, i) => i !== index);
    setQuickReplies(updated);
    saveQuickReplies(updated);
  };

  const insertReply = (text: string) => {
    setDraft(text);
    setShowQuickReplies(false);
    // Focus textarea after insertion
    setTimeout(() => {
      draftRef.current?.focus();
    }, 50);
  };

  const [filter, setFilter] = useState<"ALL" | "ACTIVE" | "CLOSED">("ACTIVE");
  const [closeConfirming, setCloseConfirming] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const selected = items.find((i) => i.id === selectedId) ?? null;
  const prevWaitingCountRef = useRef(0);

  const load = async () => {
    try {
      const res = await fetch("/api/admin/support/conversations");
      if (!res.ok) return;
      const data = await res.json();
      const convs: Conversation[] = data.conversations ?? [];
      const newWaiting = convs.filter((c) => c.status === "WAITING").length;
      if (newWaiting > prevWaitingCountRef.current) {
        playBeep();
      }
      prevWaitingCountRef.current = newWaiting;
      setItems(convs);
    } catch {
      // silent
    }
  };

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(id);
  }, []);

  // Auto-select first WAITING, then first active conversation — only when nothing is selected.
  // Separated from load() to avoid stale closure on selectedId.
  useEffect(() => {
    if (!selectedId && items.length > 0) {
      const first = items.find((c) => c.status === "WAITING") ?? items.find((c) => c.status !== "CLOSED");
      if (first) setSelectedId(first.id);
    }
  }, [items]);

  // Auto-scroll messages to bottom only when admin sends a message (not on every poll)
  const lastScrolledMsgCount = useRef(0);
  useEffect(() => {
    const msgCount = selected?.messages?.length ?? 0;
    // Only scroll if a NEW message was added (not on initial load or poll refresh)
    if (selectedId && msgCount > lastScrolledMsgCount.current && lastScrolledMsgCount.current > 0) {
      const container = messagesEndRef.current?.parentElement;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }
    lastScrolledMsgCount.current = msgCount;
  }, [selected?.messages?.length, selectedId]);

  const send = async () => {
    if (!selected || !draft.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/support/conversations/${selected.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: draft }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "FAILED");
      setItems((current) =>
        current.map((item) => (item.id === selected.id ? (data.conversation as Conversation) : item)),
      );
      setDraft("");
    } catch {
      setError(language === "fr" ? "Impossible d'envoyer." : "Could not send.");
    } finally {
      setSubmitting(false);
    }
  };

  const assign = async () => {
    if (!selected) return;
    setError("");
    try {
      const res = await fetch(`/api/admin/support/conversations/${selected.id}/assign`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "FAILED");
      // Update local state immediately
      setItems((current) =>
        current.map((item) => (item.id === selected.id ? (data.conversation as Conversation) : item)),
      );
      // Refresh from server to ensure consistency
      setTimeout(() => void load(), 300);
    } catch {
      setError(language === "fr" ? "Impossible d'assigner." : "Could not assign.");
    }
  };

  const closeConversation = async () => {
    if (!selected) return;
    setError("");
    setCloseConfirming(null);
    try {
      const res = await fetch(`/api/admin/support/conversations/${selected.id}/close`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "FAILED");
      setItems((current) => {
        const updated = current.map((item) => (item.id === selected.id ? (data.conversation as Conversation) : item));
        // Auto-select next active conversation
        const nextActive = updated.find(c => c.status !== "CLOSED" && c.id !== selected.id);
        if (nextActive) {
          setSelectedId(nextActive.id);
        } else {
          setSelectedId(null);
        }
        return updated;
      });
      setActionMessage(language === "fr" ? "✓ Conversation fermée" : "✓ Conversation closed");
      setTimeout(() => setActionMessage(""), 3000);
    } catch {
      setError(language === "fr" ? "Impossible de fermer." : "Could not close.");
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  const q = searchQuery.toLowerCase().trim();
  const filtered = items.filter((c) => {
    const matchesFilter = filter === "ACTIVE" ? c.status !== "CLOSED" : filter === "CLOSED" ? c.status === "CLOSED" : true;
    const matchesSearch = !q || c.customerName.toLowerCase().includes(q) || c.customerEmail.toLowerCase().includes(q);
    return matchesFilter && matchesSearch;
  });

  const waitingCount = items.filter((c) => c.status === "WAITING").length;

  return (
    <section className="section" style={{ padding: 0, overflow: "hidden" }}>
      {/* Panel header */}
      <div className="support-admin-header">
        <div>
          <h2 style={{ margin: 0 }}>{t.title}</h2>
          {waitingCount > 0 && (
            <span className="support-admin-waiting-badge">
              {waitingCount} {language === "fr" ? "en attente" : "waiting"}
            </span>
          )}
        </div>
        <div className="row" style={{ gap: "0.75rem", flexWrap: "wrap" }}>
          {/* Quick replies toggle */}
          <button
            type="button"
            className={`support-admin-filter-btn${showQuickReplies ? " active" : ""}`}
            onClick={() => setShowQuickReplies((v) => !v)}
            title={t.quickReplies}
          >
            ⚡ {t.quickReplies}
          </button>
          <div className="support-admin-filter-row">
            {(["ACTIVE", "ALL", "CLOSED"] as const).map((f) => (
              <button
                key={f}
                type="button"
                className={`support-admin-filter-btn${filter === f ? " active" : ""}`}
                onClick={() => setFilter(f)}
              >
                {f === "ACTIVE" ? t.filterOpen : f === "CLOSED" ? t.filterClosed : t.filterAll}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Quick replies panel */}
      {showQuickReplies && (
        <div className="support-qr-panel">
          {/* Admin name section */}
          <div className="support-qr-name-row">
            <span className="support-qr-name-label">
              {t.yourName}
            </span>
            {editingName ? (
              <div className="row" style={{ gap: "0.5rem", flex: 1 }}>
                <input
                  className="input"
                  placeholder={t.namePlaceholder}
                  value={adminNameInput}
                  onChange={(e) => setAdminNameInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveNameAndUpdate(); }}
                  style={{ flex: 1, minWidth: 0 }}
                  autoFocus
                />
                <button className="btn" type="button" onClick={saveNameAndUpdate} style={{ fontSize: "0.8rem", padding: "0.4rem 0.8rem" }}>
                  {t.saveName}
                </button>
              </div>
            ) : (
              <div className="row" style={{ gap: "0.5rem" }}>
                <strong className="support-qr-current-name">🧑‍💼 {adminName}</strong>
                <button
                  className="support-admin-filter-btn"
                  type="button"
                  onClick={() => setEditingName(true)}
                  style={{ fontSize: "0.75rem" }}
                >
                  {t.changeName}
                </button>
              </div>
            )}
          </div>

          {/* Phrases list */}
          <div className="support-qr-hint">{t.quickRepliesHint}</div>
          <div className="support-qr-list">
            {quickReplies.length === 0 && (
              <p className="small" style={{ padding: "0.5rem 0", color: "var(--muted)", fontStyle: "italic" }}>
                {t.noReplies}
              </p>
            )}
            {quickReplies.map((reply, index) => (
              <div key={index} className="support-qr-item">
                <button
                  type="button"
                  className="support-qr-text"
                  onClick={() => insertReply(reply)}
                  title={language === "fr" ? "Cliquer pour insérer" : "Click to insert"}
                >
                  {reply}
                </button>
                <button
                  type="button"
                  className="support-qr-delete"
                  onClick={() => deleteReply(index)}
                  aria-label={language === "fr" ? "Supprimer" : "Delete"}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* Add new phrase */}
          <div className="support-qr-add-row">
            <input
              className="input"
              placeholder={t.addReply}
              value={newReply}
              onChange={(e) => setNewReply(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addReply(); }}
              style={{ flex: 1, minWidth: 0 }}
            />
            <button
              className="btn"
              type="button"
              onClick={addReply}
              disabled={!newReply.trim()}
              style={{ fontSize: "0.82rem", padding: "0.4rem 0.8rem", flexShrink: 0 }}
            >
              {t.add}
            </button>
          </div>

          {/* Actions */}
          <div className="row" style={{ gap: "0.5rem", paddingTop: "0.5rem" }}>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={loadDefaults}
              style={{ fontSize: "0.78rem" }}
            >
              {t.loadDefaults}
            </button>
            {quickReplies.length > 0 && (
              <button
                className="btn btn-danger"
                type="button"
                onClick={clearAllReplies}
                style={{ fontSize: "0.78rem" }}
              >
                {t.clearAll}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="support-admin-body">
        {/* Left: conversation list */}
        <div className="support-admin-list" ref={listRef}>
          {/* Search input */}
          <div className="support-admin-search-wrap">
            <input
              className="support-admin-search-input"
              type="search"
              placeholder={language === "fr" ? "🔍 Rechercher..." : "🔍 Search..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {filtered.length === 0 && (
            <p className="small" style={{ padding: "1rem" }}>{t.none}</p>
          )}
          {filtered.map((conv) => {
            const lastMsg = conv.messages[conv.messages.length - 1];
            const lastMsgSenderIcon = lastMsg?.senderType === "ADMIN" ? "🫒" : lastMsg?.senderType === "CUSTOMER" ? "👤" : "";
            const lastMsgTime = lastMsg?.createdAt ? formatRelativeTime(lastMsg.createdAt, language) : "";
            const isWaiting = conv.status === "WAITING";

            return (
              <div
                key={conv.id}
                role="button"
                tabIndex={0}
                className={`support-admin-item${selectedId === conv.id ? " active" : ""}${conv.status === "CLOSED" ? " closed" : ""}${isWaiting ? " waiting" : ""}`}
                onClick={() => {
                  setSelectedId(conv.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedId(conv.id);
                  }
                }}
              >
                <div className="support-admin-item-top">
                  <span className="support-admin-item-status" title={conv.status}>
                    {STATUS_LABEL[conv.status] ?? "?"}
                  </span>
                  <strong className="support-admin-item-name">{conv.customerName}</strong>
                  {lastMsgTime && (
                    <span className="support-admin-item-time">{lastMsgTime}</span>
                  )}
                </div>
                <div className="support-admin-item-email">{conv.customerEmail}</div>
                {lastMsg && (
                  <div className="support-admin-item-preview">
                    <span className="support-admin-item-preview-icon">{lastMsgSenderIcon}</span>
                    {lastMsg.content.slice(0, 55)}
                    {lastMsg.content.length > 55 ? "…" : ""}
                  </div>
                )}
                <button
                  className="support-admin-item-quick-close"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedId(conv.id);
                    setCloseConfirming(conv.id);
                  }}
                  type="button"
                  aria-label={language === "fr" ? "Fermer" : "Close"}
                  title={language === "fr" ? "Fermer cette conversation" : "Close this conversation"}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>

        {/* Right: chat detail */}
        <div className="support-admin-detail">
          {!selected ? (
            <div className="support-admin-empty">
              <span>💬</span>
              <p>{t.pick}</p>
            </div>
          ) : (
            <>
              {/* Conversation header */}
              <div className="support-admin-detail-header">
                <div>
                  <strong>{selected.customerName}</strong>
                  <span className="small" style={{ marginLeft: 8 }}>{selected.customerEmail}</span>
                  <span className="support-admin-status-pill">{STATUS_LABEL[selected.status]} {selected.status}</span>
                </div>
                <div className="row" style={{ gap: "0.5rem" }}>
                  {selected.status !== "ASSIGNED" && selected.status !== "CLOSED" && (
                    <button className="btn btn-secondary" type="button" onClick={() => void assign()} style={{ fontSize: "0.8rem" }}>
                      {t.assign}
                    </button>
                  )}
                  {selected.status !== "CLOSED" && (
                    <>
                      {closeConfirming === selected.id ? (
                        <>
                          <span className="small" style={{ color: "var(--danger)" }}>
                            {language === "fr" ? "Confirmer ?" : "Confirm?"}
                          </span>
                          <button
                            className="btn btn-danger"
                            type="button"
                            onClick={() => void closeConversation()}
                            style={{ fontSize: "0.78rem", padding: "0.35rem 0.6rem" }}
                          >
                            {language === "fr" ? "Oui, fermer" : "Yes, close"}
                          </button>
                          <button
                            className="btn btn-secondary"
                            type="button"
                            onClick={() => setCloseConfirming(null)}
                            style={{ fontSize: "0.78rem", padding: "0.35rem 0.6rem" }}
                          >
                            {language === "fr" ? "Annuler" : "Cancel"}
                          </button>
                        </>
                      ) : (
                        <button
                          className="btn btn-danger"
                          type="button"
                          onClick={() => setCloseConfirming(selected.id)}
                          style={{ fontSize: "0.8rem" }}
                        >
                          {t.close}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="support-admin-messages">
                {selected.messages.length === 0 && (
                  <div className="support-admin-no-msg">
                    <p className="small">{t.waiting}</p>
                  </div>
                )}
                {selected.messages.map((msg, idx) => {
                  const prevMsg = selected.messages[idx - 1];
                  const showDateSep = msg.createdAt && (
                    !prevMsg?.createdAt ||
                    new Date(msg.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString()
                  );
                  return (
                    <div key={msg.id}>
                      {showDateSep && msg.createdAt && (
                        <div className="support-date-sep">
                          <span className="support-date-sep-label">{formatDateLabel(msg.createdAt, language)}</span>
                        </div>
                      )}
                      <div
                        className={`support-msg ${
                          msg.senderType === "CUSTOMER"
                            ? "support-msg-customer"
                            : msg.senderType === "ADMIN"
                            ? "support-msg-admin"
                            : "support-msg-system"
                        }`}
                      >
                        {msg.senderType === "CUSTOMER" && (
                          <div className="support-msg-avatar support-msg-avatar-customer">
                            {selected.customerName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        {msg.senderType === "ADMIN" && (
                          <div className="support-msg-avatar">🫒</div>
                        )}
                        <div className="support-msg-body">
                          <div className="support-msg-bubble">{msg.content}</div>
                          {msg.createdAt && (
                            <span className="support-msg-time">{formatTime(msg.createdAt)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {selected.status === "CLOSED" && (
                  <div className="support-win-closed">{t.closed}</div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message */}
              {error && <div className="support-win-error">{error}</div>}
              {actionMessage && <div className="support-win-ok">{actionMessage}</div>}

              {/* Compose */}
              {selected.status !== "CLOSED" && (
                <div className="support-win-compose support-admin-compose">
                  <textarea
                    ref={draftRef}
                    className="support-win-textarea"
                    rows={2}
                    placeholder={t.reply}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={handleKey}
                    disabled={submitting}
                  />
                  <button
                    className="support-win-send"
                    type="button"
                    onClick={() => void send()}
                    disabled={submitting || !draft.trim()}
                    aria-label={t.send}
                  >
                    {submitting ? "…" : "➤"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
