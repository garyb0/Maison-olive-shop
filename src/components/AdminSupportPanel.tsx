"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Message = {
  id: string;
  senderType: "CUSTOMER" | "ADMIN" | "SYSTEM";
  content: string;
  readAt?: string | null;
  createdAt?: string;
};

type SupportOrderSummary = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  deliveryStatus: string;
  totalCents: number;
  currency: string;
  createdAt?: string;
};

type InternalNote = {
  id: string;
  content: string;
  createdAt?: string;
  adminName?: string;
};

type Conversation = {
  id: string;
  customerEmail: string;
  customerName: string;
  status: "WAITING" | "OPEN" | "ASSIGNED" | "CLOSED";
  assignedAdminId?: string | null;
  assignedAdminName?: string;
  assignedToMe?: boolean;
  lastMessageAt?: string;
  unreadCount?: number;
  lastMessagePreview?: string;
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT" | string;
  tags?: string[];
  aiSummary?: string | null;
  aiIntent?: string | null;
  aiEnabled?: boolean;
  closedReason?: string | null;
  closedNote?: string | null;
  reopenedAt?: string | null;
  slaDueAt?: string | null;
  slaStatus?: "ok" | "watch" | "overdue" | "closed" | string;
  needsReply?: boolean;
  waitMinutes?: number;
  internalNotes?: InternalNote[];
  customerContext?: {
    account: { id: string; email: string; name: string; role: string } | null;
    linkedOrder: SupportOrderSummary | null;
    recentOrders: SupportOrderSummary[];
    supportHistoryCount: number;
  };
  messages: Message[];
};

type QuickReply = {
  id: string;
  title: string;
  content: string;
  category: string;
  language: "fr" | "en" | string;
  isActive: boolean;
  sortOrder: number;
};

type SupportSettingsPayload = {
  uiSettings?: {
    displayName?: string;
  };
  supportHealth?: {
    ok: boolean;
    missingTables?: string[];
  };
};

type AiSuggestion = {
  summary: string;
  intent: string;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT" | string;
  tags: string[];
  draftReply: string;
  confidence: number;
  needsHumanReview: string[];
  generatedAt: string;
  model: string;
  provider: "openai";
};

type Props = {
  language: "fr" | "en";
};

const STATUS_ICON: Record<string, string> = {
  WAITING: "⏳",
  OPEN: "🟢",
  ASSIGNED: "👤",
  CLOSED: "✓",
};

function getStatusText(status: Conversation["status"], language: "fr" | "en") {
  if (language === "fr") {
    switch (status) {
      case "WAITING":
        return "En attente";
      case "OPEN":
        return "Ouverte";
      case "ASSIGNED":
        return "Prise en charge";
      case "CLOSED":
        return "Fermée";
      default:
        return status;
    }
  }

  switch (status) {
    case "WAITING":
      return "Waiting";
    case "OPEN":
      return "Open";
    case "ASSIGNED":
      return "Assigned";
    case "CLOSED":
      return "Closed";
    default:
      return status;
  }
}

function getPriorityLabel(priority: string | undefined, language: "fr" | "en") {
  switch (priority) {
    case "URGENT":
      return language === "fr" ? "Urgent" : "Urgent";
    case "HIGH":
      return language === "fr" ? "Élevée" : "High";
    case "LOW":
      return language === "fr" ? "Basse" : "Low";
    default:
      return language === "fr" ? "Normale" : "Normal";
  }
}

function getPriorityTone(priority: string | undefined) {
  switch (priority) {
    case "URGENT":
      return "urgent";
    case "HIGH":
      return "high";
    case "LOW":
      return "low";
    default:
      return "normal";
  }
}

function formatMoney(cents: number, currency: string, language: "fr" | "en") {
  return new Intl.NumberFormat(language === "fr" ? "fr-CA" : "en-CA", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

function getSlaLabel(status: string | undefined, language: "fr" | "en") {
  switch (status) {
    case "overdue":
      return language === "fr" ? "En retard" : "Overdue";
    case "watch":
      return language === "fr" ? "À surveiller" : "Watch";
    case "closed":
      return language === "fr" ? "Fermée" : "Closed";
    default:
      return language === "fr" ? "Dans les temps" : "On time";
  }
}

function getCloseReasonLabel(reason: string | null | undefined, language: "fr" | "en") {
  const labels: Record<string, { fr: string; en: string }> = {
    RESOLVED: { fr: "Résolu", en: "Resolved" },
    DELIVERY: { fr: "Livraison", en: "Delivery" },
    PRODUCT: { fr: "Produit", en: "Product" },
    PAYMENT: { fr: "Paiement", en: "Payment" },
    REFUND: { fr: "Remboursement", en: "Refund" },
    DUPLICATE: { fr: "Doublon", en: "Duplicate" },
    OTHER: { fr: "Autre", en: "Other" },
  };
  return labels[reason || "RESOLVED"]?.[language] ?? labels.RESOLVED[language];
}

const DEFAULT_QUICK_REPLIES_FR = (name: string) => [
  `Bonjour ! Je suis ${name} de l'équipe Chez Olive. Comment puis-je vous aider aujourd'hui ? 🫒`,
  `Bonjour ! ${name} à votre service. Je suis là pour vous aider !`,
  `Merci pour votre message ! Je vérifie ça pour vous et reviens vers vous dans quelques instants.`,
  `Votre commande est actuellement en cours de traitement. Vous recevrez une confirmation par email sous peu.`,
  `Je comprends votre situation. Laissez-moi vérifier ça avec notre équipe et je vous reviens très rapidement.`,
  `Avez-vous d'autres questions ? Je suis disponible pour vous aider !`,
  `Merci pour votre patience. Votre satisfaction est notre priorité chez Chez Olive.`,
  `Cette conversation est maintenant terminée. N'hésitez pas à nous recontacter si vous avez d'autres questions. Bonne journée ! 🫒`,
];

const DEFAULT_QUICK_REPLIES_EN = (name: string) => [
  `Hello! I'm ${name} from the Chez Olive team. How can I help you today? 🫒`,
  `Hi there! ${name} here at your service. I'm here to help!`,
  `Thank you for your message! Let me check on that for you and I'll be right back.`,
  `Your order is currently being processed. You will receive a confirmation email shortly.`,
  `I understand your situation. Let me check with our team and get back to you very quickly.`,
  `Do you have any other questions? I'm here to help!`,
  `Thank you for your patience. Your satisfaction is our priority at Chez Olive.`,
  `This conversation is now closed. Don't hesitate to contact us again if you have other questions. Have a great day! 🫒`,
];

function makeFallbackQuickReplies(language: "fr" | "en", name: string): QuickReply[] {
  const replies = language === "fr" ? DEFAULT_QUICK_REPLIES_FR(name) : DEFAULT_QUICK_REPLIES_EN(name);
  return replies.map((content, index) => ({
    id: `fallback-${language}-${index}`,
    title: content.slice(0, 44),
    content,
    category: index >= replies.length - 2 ? "fermeture" : "general",
    language,
    isActive: true,
    sortOrder: index + 1,
  }));
}

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

function getDefaultAdminDisplayName(language: "fr" | "en") {
  return language === "fr" ? "votre conseiller" : "your advisor";
}

export function AdminSupportPanel({ language }: Props) {
  const [items, setItems] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const prevWaitingCountRef = useRef<number | null>(null);

  // Request notification permission on mount
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Send browser notification when new waiting conversation appears
  useEffect(() => {
    const waitingCount = items.filter((c) => c.status === "WAITING").length;
    const previousWaitingCount = prevWaitingCountRef.current;

    if (previousWaitingCount === null) {
      prevWaitingCountRef.current = waitingCount;
      return;
    }

    const newWaiting = waitingCount - previousWaitingCount;

    if (newWaiting > 0) {
      playBeep();

      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        const title = language === "fr"
          ? `🔔 ${newWaiting} nouvelle conversation${newWaiting > 1 ? 's' : ''}`
          : `🔔 ${newWaiting} new conversation${newWaiting > 1 ? 's' : ''}`;

        const body = language === "fr"
          ? "Un client attend votre réponse sur Chez Olive"
          : "A customer is waiting for your response on Chez Olive";

        new Notification(title, {
          body,
          icon: "/olive-logo-3.png",
          tag: "support-notification",
          requireInteraction: true,
        });
      }
    }
    
    prevWaitingCountRef.current = waitingCount;
  }, [items, language]);

  // Quick replies state
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [adminName, setAdminName] = useState("");
  const [adminNameInput, setAdminNameInput] = useState("");
  const [newReply, setNewReply] = useState("");
  const [newReplyTitle, setNewReplyTitle] = useState("");
  const [newReplyCategory, setNewReplyCategory] = useState("general");
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [closeReason, setCloseReason] = useState("RESOLVED");
  const [closeNote, setCloseNote] = useState("");
  const [tagDraft, setTagDraft] = useState("");
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const readInFlightRef = useRef<string | null>(null);

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
    filterMine: language === "fr" ? "Mes conversations" : "Mine",
    filterUnassigned: language === "fr" ? "Non assignées" : "Unassigned",
    filterReply: language === "fr" ? "À répondre" : "Needs reply",
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

  const [filter, setFilter] = useState<"ALL" | "ACTIVE" | "MINE" | "UNASSIGNED" | "NEEDS_REPLY" | "CLOSED">("ACTIVE");
  const [closeConfirming, setCloseConfirming] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState("");
  const [settingsWarning, setSettingsWarning] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  const saveAdminDisplaySettings = async (nextDisplayName = adminName) => {
    try {
      const res = await fetch("/api/admin/support/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: nextDisplayName,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as SupportSettingsPayload & { error?: string };
      if (!res.ok) throw new Error(data.error || "FAILED");
      if (data.uiSettings?.displayName) {
        setAdminName(data.uiSettings.displayName);
        setAdminNameInput(data.uiSettings.displayName);
      }
      setSettingsWarning("");
    } catch {
      setSettingsWarning(
        language === "fr"
          ? "Réponses rapides affichées seulement dans cette session: les réglages serveur sont indisponibles."
          : "Quick replies are only available in this session: server settings are unavailable.",
      );
    }
  };

  const loadQuickReplies = useCallback(async (fallbackName: string) => {
    try {
      const res = await fetch(`/api/admin/support/quick-replies?language=${language}`);
      const data = (await res.json().catch(() => ({}))) as { quickReplies?: QuickReply[]; error?: string };
      if (!res.ok) throw new Error(data.error || "FAILED");
      setQuickReplies(data.quickReplies?.length ? data.quickReplies : makeFallbackQuickReplies(language, fallbackName));
    } catch {
      setQuickReplies(makeFallbackQuickReplies(language, fallbackName));
      setSettingsWarning(
        language === "fr"
          ? "Macros serveur indisponibles: phrases par défaut chargées pour cette session."
          : "Server macros unavailable: default phrases loaded for this session.",
      );
    }
  }, [language]);

  // Load shared admin UI settings from the server. localStorage is intentionally not used so replies stay consistent.
  useEffect(() => {
    let active = true;
    const fallbackName = getDefaultAdminDisplayName(language);

    const loadSettings = async () => {
      try {
        const res = await fetch("/api/admin/support/settings");
        const data = (await res.json().catch(() => ({}))) as SupportSettingsPayload & { error?: string };
        if (!res.ok) throw new Error(data.error || "FAILED");

        const displayName = data.uiSettings?.displayName?.trim() || fallbackName;

        if (!active) return;
        setAdminName(displayName);
        setAdminNameInput(displayName);
        void loadQuickReplies(displayName);
        setSettingsWarning(
          data.supportHealth && !data.supportHealth.ok
            ? language === "fr"
              ? `Réglages support incomplets: migration requise (${data.supportHealth.missingTables?.join(", ") || "tables manquantes"}).`
              : `Support settings incomplete: migration required (${data.supportHealth.missingTables?.join(", ") || "missing tables"}).`
            : "",
        );
      } catch {
        if (!active) return;
        setAdminName(fallbackName);
        setAdminNameInput(fallbackName);
        setQuickReplies(makeFallbackQuickReplies(language, fallbackName));
        setSettingsWarning(
          language === "fr"
            ? "Réponses rapides par défaut chargées: réglages serveur indisponibles."
            : "Default quick replies loaded: server settings are unavailable.",
        );
      }
    };

    void loadSettings();
    return () => {
      active = false;
    };
  }, [language, loadQuickReplies]);

  const saveNameAndUpdate = () => {
    const trimmed = adminNameInput.trim();
    const displayName = trimmed || getDefaultAdminDisplayName(language);
    setAdminName(displayName);
    setAdminNameInput(displayName);
    setEditingName(false);
    void saveAdminDisplaySettings(displayName);
  };

  const loadDefaults = () => {
    const defaults = makeFallbackQuickReplies(language, adminName);
    setQuickReplies(defaults);
  };

  const clearAllReplies = () => {
    quickReplies.forEach((reply) => {
      if (!reply.id.startsWith("fallback-")) {
        void fetch(`/api/admin/support/quick-replies/${reply.id}`, { method: "DELETE" });
      }
    });
    setQuickReplies([]);
  };

  const addReply = async () => {
    if (!newReply.trim()) return;
    const fallbackReply: QuickReply = {
      id: `local-${Date.now()}`,
      title: (newReplyTitle.trim() || newReply.trim().slice(0, 44)),
      content: newReply.trim(),
      category: newReplyCategory.trim() || "general",
      language,
      isActive: true,
      sortOrder: quickReplies.length + 1,
    };
    try {
      const res = await fetch("/api/admin/support/quick-replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fallbackReply),
      });
      const data = (await res.json().catch(() => ({}))) as { quickReply?: QuickReply };
      setQuickReplies((current) => [...current, data.quickReply ?? fallbackReply]);
      setSettingsWarning("");
    } catch {
      setQuickReplies((current) => [...current, fallbackReply]);
      setSettingsWarning(language === "fr" ? "Macro ajoutée localement seulement." : "Macro added locally only.");
    }
    setNewReply("");
    setNewReplyTitle("");
  };

  const deleteReply = (index: number) => {
    const target = quickReplies[index];
    setQuickReplies((current) => current.filter((_, i) => i !== index));
    if (target && !target.id.startsWith("fallback-") && !target.id.startsWith("local-")) {
      void fetch(`/api/admin/support/quick-replies/${target.id}`, { method: "DELETE" });
    }
  };

  const insertReply = (text: string) => {
    setDraft(text);
    setShowQuickReplies(false);
    // Focus textarea after insertion
    setTimeout(() => {
      draftRef.current?.focus();
    }, 50);
  };

  const selected = items.find((i) => i.id === selectedId) ?? null;

  useEffect(() => {
    setAiSuggestion(null);
    setAiError("");
    setAiLoading(false);
  }, [selectedId]);

  useEffect(() => {
    if (!selected || (selected.unreadCount ?? 0) <= 0) return;
    if (readInFlightRef.current === selected.id) return;

    let active = true;
    readInFlightRef.current = selected.id;

    const markRead = async () => {
      try {
        const res = await fetch(`/api/admin/support/conversations/${selected.id}/read`, {
          method: "POST",
        });
        const data = (await res.json().catch(() => ({}))) as { conversation?: Conversation };
        if (active && res.ok && data.conversation) {
          setItems((current) =>
            current.map((item) => (item.id === selected.id ? data.conversation as Conversation : item)),
          );
        }
      } catch {
        // The next polling cycle will keep the UI consistent.
      } finally {
        if (readInFlightRef.current === selected.id) {
          readInFlightRef.current = null;
        }
      }
    };

    void markRead();
    return () => {
      active = false;
    };
  }, [selected]);

  const load = async () => {
    try {
      const res = await fetch("/api/admin/support/conversations");
      if (!res.ok) return;
      const data = await res.json();
      const convs: Conversation[] = data.conversations ?? [];
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
  }, [items, selectedId]);

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

  const unassign = async () => {
    if (!selected) return;
    setError("");
    try {
      const res = await fetch(`/api/admin/support/conversations/${selected.id}/assign`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "FAILED");
      setItems((current) =>
        current.map((item) => (item.id === selected.id ? (data.conversation as Conversation) : item)),
      );
    } catch {
      setError(language === "fr" ? "Impossible de libérer l'assignation." : "Could not unassign.");
    }
  };

  const patchConversation = async (payload: { priority?: string; tags?: string[] }) => {
    if (!selected) return;
    setError("");
    try {
      const res = await fetch(`/api/admin/support/conversations/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "FAILED");
      setItems((current) =>
        current.map((item) => (item.id === selected.id ? (data.conversation as Conversation) : item)),
      );
    } catch {
      setError(language === "fr" ? "Impossible de mettre à jour la conversation." : "Could not update conversation.");
    }
  };

  const addTag = () => {
    if (!selected || !tagDraft.trim()) return;
    const tags = Array.from(new Set([...(selected.tags ?? []), tagDraft.trim().toLowerCase()])).slice(0, 12);
    setTagDraft("");
    void patchConversation({ tags });
  };

  const removeTag = (tag: string) => {
    if (!selected) return;
    void patchConversation({ tags: (selected.tags ?? []).filter((item) => item !== tag) });
  };

  const generateAiSuggestion = async () => {
    if (!selected) return;
    setAiLoading(true);
    setAiError("");
    try {
      const res = await fetch(`/api/admin/support/conversations/${selected.id}/ai-suggestion`, {
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as { suggestion?: AiSuggestion; error?: string };
      if (!res.ok || !data.suggestion) throw new Error(data.error || "FAILED");
      setAiSuggestion(data.suggestion);
      setItems((current) =>
        current.map((item) =>
          item.id === selected.id
            ? {
                ...item,
                aiSummary: data.suggestion?.summary ?? item.aiSummary,
                aiIntent: data.suggestion?.intent ?? item.aiIntent,
              }
            : item,
        ),
      );
      setActionMessage(language === "fr" ? "Suggestion IA prête à vérifier." : "AI suggestion ready for review.");
      setTimeout(() => setActionMessage(""), 3000);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setAiError(
        message === "Support AI disabled"
          ? language === "fr"
            ? "L'IA maison est désactivée pour le moment."
            : "House AI is disabled for now."
          : language === "fr"
            ? "Impossible de générer la suggestion IA."
            : "Could not generate the AI suggestion.",
      );
    } finally {
      setAiLoading(false);
    }
  };

  const insertAiDraft = () => {
    if (!aiSuggestion) return;
    setDraft(aiSuggestion.draftReply);
    setTimeout(() => draftRef.current?.focus(), 50);
  };

  const applyAiWorkflow = () => {
    if (!selected || !aiSuggestion) return;
    const nextTags = Array.from(new Set([...(selected.tags ?? []), ...aiSuggestion.tags])).slice(0, 12);
    void patchConversation({ priority: aiSuggestion.priority, tags: nextTags });
  };

  const addInternalNote = async () => {
    if (!selected || !noteDraft.trim()) return;
    setError("");
    try {
      const res = await fetch(`/api/admin/support/conversations/${selected.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: noteDraft.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "FAILED");
      setItems((current) =>
        current.map((item) => (item.id === selected.id ? (data.conversation as Conversation) : item)),
      );
      setNoteDraft("");
    } catch {
      setError(language === "fr" ? "Impossible d'ajouter la note interne." : "Could not add internal note.");
    }
  };

  const closeConversation = async () => {
    if (!selected) return;
    setError("");
    setCloseConfirming(null);
    try {
      const res = await fetch(`/api/admin/support/conversations/${selected.id}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: closeReason, note: closeNote }),
      });
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
      setCloseNote("");
      setCloseReason("RESOLVED");
      setActionMessage(language === "fr" ? "✓ Conversation fermée" : "✓ Conversation closed");
      setTimeout(() => setActionMessage(""), 3000);
    } catch {
      setError(language === "fr" ? "Impossible de fermer." : "Could not close.");
    }
  };

  const reopenConversation = async () => {
    if (!selected) return;
    setError("");
    try {
      const res = await fetch(`/api/admin/support/conversations/${selected.id}/reopen`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "FAILED");
      setItems((current) =>
        current.map((item) => (item.id === selected.id ? (data.conversation as Conversation) : item)),
      );
      setActionMessage(language === "fr" ? "✓ Conversation réouverte" : "✓ Conversation reopened");
      setTimeout(() => setActionMessage(""), 3000);
    } catch {
      setError(language === "fr" ? "Impossible de réouvrir." : "Could not reopen.");
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
    const matchesFilter =
      filter === "ACTIVE"
        ? c.status !== "CLOSED"
        : filter === "MINE"
          ? c.status !== "CLOSED" && Boolean(c.assignedToMe)
          : filter === "UNASSIGNED"
            ? c.status !== "CLOSED" && !c.assignedAdminId
            : filter === "NEEDS_REPLY"
              ? c.status !== "CLOSED" && Boolean(c.needsReply)
              : filter === "CLOSED"
                ? c.status === "CLOSED"
                : true;
    const searchBlob = [
      c.customerName,
      c.customerEmail,
      c.lastMessagePreview,
      c.customerContext?.linkedOrder?.orderNumber,
      ...(c.tags ?? []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const matchesSearch = !q || searchBlob.includes(q);
    return matchesFilter && matchesSearch;
  });

  const waitingCount = items.filter((c) => c.status === "WAITING").length;
  const activeCount = items.filter((c) => c.status !== "CLOSED").length;
  const closedCount = items.filter((c) => c.status === "CLOSED").length;
  const unreadTotal = items.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);
  const needsReplyCount = items.filter((c) => c.status !== "CLOSED" && c.needsReply).length;

  const renderTicketMessages = (conversation: Conversation) => (
    <div
      className="support-admin-messages"
      aria-label={language === "fr" ? "Messages du ticket" : "Ticket messages"}
    >
      {conversation.messages.length === 0 && (
        <div className="support-admin-no-msg">
          <p className="small">{t.waiting}</p>
        </div>
      )}
      {conversation.messages.map((msg, idx) => {
        const prevMsg = conversation.messages[idx - 1];
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
                  {conversation.customerName.charAt(0).toUpperCase()}
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
      {conversation.status === "CLOSED" && (
        <div className="support-win-closed">
          {t.closed} · {getCloseReasonLabel(conversation.closedReason, language)}
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );

  return (
    <section className="section" style={{ padding: 0, overflow: "hidden" }}>
      {/* Panel header */}
      <div className="support-admin-header">
        <div className="support-admin-header__intro">
          <div>
            <h2 style={{ margin: 0 }}>{t.title}</h2>
            <p className="support-admin-header__copy">
              {language === "fr"
                ? "Un espace plus simple pour répondre vite et garder le bon ton."
                : "A calmer workspace to reply quickly and keep the right tone."}
            </p>
          </div>
          <div className="support-admin-summary">
            <span className="support-admin-summary-pill">
              {activeCount} {language === "fr" ? "actives" : "active"}
            </span>
            <span className="support-admin-summary-pill support-admin-summary-pill--soft">
              {closedCount} {language === "fr" ? "fermées" : "closed"}
            </span>
            <span className={`support-admin-summary-pill${unreadTotal > 0 ? " support-admin-summary-pill--alert" : " support-admin-summary-pill--soft"}`}>
              {unreadTotal} {language === "fr" ? "non lus" : "unread"}
            </span>
            <span className={`support-admin-summary-pill${needsReplyCount > 0 ? " support-admin-summary-pill--alert" : " support-admin-summary-pill--soft"}`}>
              {needsReplyCount} {language === "fr" ? "à répondre" : "needs reply"}
            </span>
          </div>
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
            {(["ACTIVE", "MINE", "UNASSIGNED", "NEEDS_REPLY", "ALL", "CLOSED"] as const).map((f) => (
              <button
                key={f}
                type="button"
                className={`support-admin-filter-btn${filter === f ? " active" : ""}`}
                onClick={() => setFilter(f)}
              >
                {f === "ACTIVE"
                  ? t.filterOpen
                  : f === "MINE"
                    ? t.filterMine
                    : f === "UNASSIGNED"
                      ? t.filterUnassigned
                      : f === "NEEDS_REPLY"
                        ? t.filterReply
                        : f === "CLOSED"
                          ? t.filterClosed
                          : t.filterAll}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Quick replies panel */}
      {showQuickReplies && (
        <div className="support-qr-panel">
          {settingsWarning ? (
            <div className="support-admin-settings-warning">{settingsWarning}</div>
          ) : null}

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
              <div key={reply.id} className="support-qr-item">
                <button
                  type="button"
                  className="support-qr-text"
                  onClick={() => insertReply(reply.content)}
                  title={language === "fr" ? "Cliquer pour insérer" : "Click to insert"}
                >
                  <strong className="support-qr-title">{reply.title}</strong>
                  <span>{reply.content}</span>
                  <small>{reply.category}</small>
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
              placeholder={language === "fr" ? "Titre" : "Title"}
              value={newReplyTitle}
              onChange={(e) => setNewReplyTitle(e.target.value)}
              style={{ flex: "0 1 180px", minWidth: 0 }}
            />
            <input
              className="input"
              placeholder={language === "fr" ? "Catégorie" : "Category"}
              value={newReplyCategory}
              onChange={(e) => setNewReplyCategory(e.target.value)}
              style={{ flex: "0 1 140px", minWidth: 0 }}
            />
            <input
              className="input"
              placeholder={t.addReply}
              value={newReply}
              onChange={(e) => setNewReply(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void addReply(); }}
              style={{ flex: 1, minWidth: 0 }}
            />
            <button
              className="btn"
              type="button"
              onClick={() => void addReply()}
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
              placeholder={language === "fr" ? "Rechercher un client ou un email" : "Search customer or email"}
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
            const unreadCount = conv.unreadCount ?? 0;
            const preview = conv.lastMessagePreview ?? lastMsg?.content ?? "";

            return (
              <div
                key={conv.id}
                role="button"
                tabIndex={0}
                className={`support-admin-item${selectedId === conv.id ? " active" : ""}${conv.status === "CLOSED" ? " closed" : ""}${isWaiting ? " waiting" : ""}${unreadCount > 0 ? " unread" : ""}`}
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
                  <span className={`support-admin-item-status support-admin-item-status--${conv.status.toLowerCase()}`} title={conv.status}>
                    <span>{STATUS_ICON[conv.status] ?? "?"}</span>
                    <span>{getStatusText(conv.status, language)}</span>
                  </span>
                  <strong className="support-admin-item-name">{conv.customerName}</strong>
                  {lastMsgTime && (
                    <span className="support-admin-item-time">{lastMsgTime}</span>
                  )}
                </div>
                <div className="support-admin-item-email">{conv.customerEmail}</div>
                <div className="support-admin-item-meta">
                  <span className={`support-admin-priority support-admin-priority--${getPriorityTone(conv.priority)}`}>
                    {getPriorityLabel(conv.priority, language)}
                  </span>
                  {unreadCount > 0 ? (
                    <span className="support-admin-unread">
                      {unreadCount} {language === "fr" ? "non lu" : "unread"}{unreadCount > 1 && language === "fr" ? "s" : ""}
                    </span>
                  ) : null}
                  {conv.needsReply ? (
                    <span className={`support-admin-sla support-admin-sla--${conv.slaStatus ?? "ok"}`}>
                      {getSlaLabel(conv.slaStatus, language)} · {conv.waitMinutes ?? 0}min
                    </span>
                  ) : null}
                  {conv.assignedAdminName ? (
                    <span className="support-admin-tag">
                      {conv.assignedToMe
                        ? language === "fr"
                          ? "À moi"
                          : "Mine"
                        : conv.assignedAdminName}
                    </span>
                  ) : null}
                </div>
                {preview && (
                  <div className="support-admin-item-preview">
                    <span className="support-admin-item-preview-icon">{lastMsgSenderIcon}</span>
                    {preview.slice(0, 70)}
                    {preview.length > 70 ? "…" : ""}
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
                <div className="support-admin-detail-header__meta">
                  <div className="support-admin-detail-header__identity">
                    <strong>{selected.customerName}</strong>
                    <span className="small">{selected.customerEmail}</span>
                  </div>
                  <span className={`support-admin-status-pill support-admin-status-pill--${selected.status.toLowerCase()}`}>
                    {STATUS_ICON[selected.status]} {getStatusText(selected.status, language)}
                  </span>
                  <div className="support-admin-detail-tags">
                    <span className={`support-admin-priority support-admin-priority--${getPriorityTone(selected.priority)}`}>
                      {getPriorityLabel(selected.priority, language)}
                    </span>
                    {(selected.unreadCount ?? 0) > 0 ? (
                      <span className="support-admin-unread">
                        {selected.unreadCount} {language === "fr" ? "non lu" : "unread"}{(selected.unreadCount ?? 0) > 1 && language === "fr" ? "s" : ""}
                      </span>
                    ) : null}
                    {selected.tags?.map((tag) => (
                      <button className="support-admin-tag support-admin-tag--button" key={tag} type="button" onClick={() => removeTag(tag)}>
                        {tag} ×
                      </button>
                    ))}
                    {selected.assignedAdminName ? (
                      <span className="support-admin-tag">
                        {language === "fr" ? "Assignée à " : "Assigned to "}
                        {selected.assignedToMe ? (language === "fr" ? "moi" : "me") : selected.assignedAdminName}
                      </span>
                    ) : null}
                    {selected.needsReply ? (
                      <span className={`support-admin-sla support-admin-sla--${selected.slaStatus ?? "ok"}`}>
                        {getSlaLabel(selected.slaStatus, language)} · {selected.waitMinutes ?? 0}min
                      </span>
                    ) : null}
                  </div>
                  <div className="support-admin-workflow-row">
                    <select
                      className="support-admin-select"
                      value={selected.priority ?? "NORMAL"}
                      onChange={(event) => void patchConversation({ priority: event.target.value })}
                    >
                      <option value="LOW">{getPriorityLabel("LOW", language)}</option>
                      <option value="NORMAL">{getPriorityLabel("NORMAL", language)}</option>
                      <option value="HIGH">{getPriorityLabel("HIGH", language)}</option>
                      <option value="URGENT">{getPriorityLabel("URGENT", language)}</option>
                    </select>
                    <input
                      className="support-admin-tag-input"
                      placeholder={language === "fr" ? "Ajouter un tag" : "Add tag"}
                      value={tagDraft}
                      onChange={(event) => setTagDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addTag();
                        }
                      }}
                    />
                    <button className="support-admin-filter-btn" type="button" onClick={addTag} disabled={!tagDraft.trim()}>
                      {language === "fr" ? "Tag" : "Tag"}
                    </button>
                  </div>
                </div>
                <div className="row" style={{ gap: "0.5rem" }}>
                  {selected.status === "CLOSED" ? (
                    <button className="btn btn-secondary" type="button" onClick={() => void reopenConversation()} style={{ fontSize: "0.8rem" }}>
                      {language === "fr" ? "Réouvrir" : "Reopen"}
                    </button>
                  ) : selected.status !== "ASSIGNED" ? (
                    <button className="btn btn-secondary" type="button" onClick={() => void assign()} style={{ fontSize: "0.8rem" }}>
                      {t.assign}
                    </button>
                  ) : (
                    <button className="btn btn-secondary" type="button" onClick={() => void unassign()} style={{ fontSize: "0.8rem" }}>
                      {language === "fr" ? "Libérer" : "Unassign"}
                    </button>
                  )}
                  {selected.status !== "CLOSED" && (
                    <>
                      {closeConfirming === selected.id ? (
                        <div className="support-admin-close-pop">
                          <select
                            className="support-admin-select"
                            value={closeReason}
                            onChange={(event) => setCloseReason(event.target.value)}
                          >
                            {["RESOLVED", "DELIVERY", "PRODUCT", "PAYMENT", "REFUND", "DUPLICATE", "OTHER"].map((reason) => (
                              <option key={reason} value={reason}>
                                {getCloseReasonLabel(reason, language)}
                              </option>
                            ))}
                          </select>
                          <input
                            className="support-admin-tag-input"
                            placeholder={language === "fr" ? "Note interne de fermeture" : "Internal close note"}
                            value={closeNote}
                            onChange={(event) => setCloseNote(event.target.value)}
                          />
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
                        </div>
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

              <div className="support-admin-detail-scroll">
              {renderTicketMessages(selected)}

              {/* Customer context */}
              <div className="support-admin-context">
                <div className="support-admin-context__header">
                  <strong>{language === "fr" ? "Contexte client" : "Customer context"}</strong>
                  <span>
                    {language === "fr"
                      ? "Préparé pour assistance humaine et IA maison"
                      : "Prepared for human support and house AI"}
                  </span>
                </div>
                <div className="support-admin-context-grid">
                  <article className="support-admin-context-card">
                    <span>{language === "fr" ? "Compte" : "Account"}</span>
                    <strong>
                      {selected.customerContext?.account
                        ? language === "fr"
                          ? "Client connecté"
                          : "Signed-in customer"
                        : language === "fr"
                          ? "Invité"
                          : "Guest"}
                    </strong>
                    <p>
                      {selected.customerContext?.account
                        ? `${selected.customerContext.account.name} · ${selected.customerContext.account.email}`
                        : selected.customerEmail}
                    </p>
                  </article>

                  <article className="support-admin-context-card">
                    <span>{language === "fr" ? "Historique" : "History"}</span>
                    <strong>{selected.customerContext?.supportHistoryCount ?? 1}</strong>
                    <p>
                      {language === "fr"
                        ? "conversation(s) support reliée(s) à ce client."
                        : "support conversation(s) linked to this customer."}
                    </p>
                  </article>

                  <article className="support-admin-context-card">
                    <span>{language === "fr" ? "Commande liée" : "Linked order"}</span>
                    {selected.customerContext?.linkedOrder ? (
                      <>
                        <strong>{selected.customerContext.linkedOrder.orderNumber}</strong>
                        <p>
                          {formatMoney(
                            selected.customerContext.linkedOrder.totalCents,
                            selected.customerContext.linkedOrder.currency,
                            language,
                          )}{" "}
                          · {selected.customerContext.linkedOrder.status}
                        </p>
                      </>
                    ) : (
                      <>
                        <strong>{language === "fr" ? "Aucune" : "None"}</strong>
                        <p>
                          {language === "fr"
                            ? "Les commandes récentes restent disponibles ci-dessous."
                            : "Recent orders remain available below."}
                        </p>
                      </>
                    )}
                  </article>

                  <article className="support-admin-context-card">
                    <span>{language === "fr" ? "IA maison" : "House AI"}</span>
                    <strong>
                      {!selected.aiEnabled
                        ? language === "fr"
                          ? "Désactivée"
                          : "Disabled"
                        : selected.aiSummary
                        ? language === "fr"
                          ? "Résumé prêt"
                          : "Summary ready"
                        : language === "fr"
                          ? "Disponible"
                          : "Available"}
                    </strong>
                    <p>
                      {selected.aiSummary ||
                        (language === "fr"
                          ? "Aucune réponse automatique au client. Les suggestions restent internes et éditables."
                          : "No automatic customer reply. Suggestions stay internal and editable.")}
                    </p>
                    <button
                      className="support-admin-filter-btn support-admin-ai-card-btn"
                      type="button"
                      onClick={() => void generateAiSuggestion()}
                      disabled={!selected.aiEnabled || aiLoading}
                    >
                      {aiLoading
                        ? language === "fr"
                          ? "Génération..."
                          : "Generating..."
                        : language === "fr"
                          ? "Générer une suggestion IA"
                          : "Generate AI suggestion"}
                    </button>
                  </article>
                </div>
                {selected.customerContext?.recentOrders?.length ? (
                  <div className="support-admin-recent-orders">
                    <span>{language === "fr" ? "Commandes récentes" : "Recent orders"}</span>
                    {selected.customerContext.recentOrders.slice(0, 3).map((order) => (
                      <span className="support-admin-order-chip" key={order.id}>
                        {order.orderNumber} · {formatMoney(order.totalCents, order.currency, language)}
                      </span>
                    ))}
                  </div>
                ) : null}
                {selected.status === "CLOSED" ? (
                  <div className="support-admin-recent-orders">
                    <span>{language === "fr" ? "Fermeture" : "Closure"}</span>
                    <span className="support-admin-order-chip">{getCloseReasonLabel(selected.closedReason, language)}</span>
                    {selected.closedNote ? <span className="support-admin-order-chip">{selected.closedNote}</span> : null}
                  </div>
                ) : null}
              </div>

              {(aiSuggestion || aiError) && (
                <div className="support-admin-ai-panel">
                  <div className="support-admin-ai-panel__head">
                    <div>
                      <strong>{language === "fr" ? "Suggestion IA maison" : "House AI suggestion"}</strong>
                      <span>
                        {language === "fr"
                          ? "Interne seulement. Validez avant d'envoyer."
                          : "Internal only. Review before sending."}
                      </span>
                    </div>
                    {aiSuggestion ? (
                      <span className="support-admin-ai-confidence">
                        {Math.round(aiSuggestion.confidence * 100)}%
                      </span>
                    ) : null}
                  </div>
                  {aiError ? <div className="support-win-error">{aiError}</div> : null}
                  {aiSuggestion ? (
                    <>
                      <div className="support-admin-ai-grid">
                        <article>
                          <span>{language === "fr" ? "Résumé" : "Summary"}</span>
                          <p>{aiSuggestion.summary}</p>
                        </article>
                        <article>
                          <span>{language === "fr" ? "Intention" : "Intent"}</span>
                          <p>{aiSuggestion.intent}</p>
                        </article>
                        <article>
                          <span>{language === "fr" ? "Priorité suggérée" : "Suggested priority"}</span>
                          <p>{getPriorityLabel(aiSuggestion.priority, language)}</p>
                        </article>
                        <article>
                          <span>{language === "fr" ? "Tags suggérés" : "Suggested tags"}</span>
                          <p>{aiSuggestion.tags.length ? aiSuggestion.tags.join(", ") : "—"}</p>
                        </article>
                      </div>
                      <div className="support-admin-ai-draft">
                        <span>{language === "fr" ? "Brouillon proposé" : "Suggested draft"}</span>
                        <p>{aiSuggestion.draftReply}</p>
                      </div>
                      {aiSuggestion.needsHumanReview.length ? (
                        <div className="support-admin-ai-review">
                          <span>{language === "fr" ? "À vérifier" : "Review"}</span>
                          <p>{aiSuggestion.needsHumanReview.join(" · ")}</p>
                        </div>
                      ) : null}
                      <div className="support-admin-ai-actions">
                        <button className="btn btn-secondary" type="button" onClick={insertAiDraft}>
                          {language === "fr" ? "Insérer le brouillon" : "Insert draft"}
                        </button>
                        <button className="support-admin-filter-btn" type="button" onClick={applyAiWorkflow}>
                          {language === "fr" ? "Appliquer priorité/tags" : "Apply priority/tags"}
                        </button>
                      </div>
                    </>
                  ) : null}
                </div>
              )}

              <div className="support-admin-notes">
                <div className="support-admin-notes__head">
                  <strong>{language === "fr" ? "Notes internes" : "Internal notes"}</strong>
                  <span>{language === "fr" ? "Jamais visibles par le client" : "Never visible to customers"}</span>
                </div>
                {selected.internalNotes?.length ? (
                  <div className="support-admin-note-list">
                    {selected.internalNotes.map((note) => (
                      <article className="support-admin-note" key={note.id}>
                        <p>{note.content}</p>
                        <span>
                          {note.adminName || (language === "fr" ? "Admin" : "Admin")}
                          {note.createdAt ? ` · ${formatRelativeTime(note.createdAt, language)}` : ""}
                        </span>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="small" style={{ margin: 0, color: "var(--muted)" }}>
                    {language === "fr" ? "Aucune note interne pour le moment." : "No internal notes yet."}
                  </p>
                )}
                {selected.status !== "CLOSED" ? (
                  <div className="support-admin-note-compose">
                    <input
                      className="support-admin-tag-input"
                      placeholder={language === "fr" ? "Ajouter une note interne" : "Add an internal note"}
                      value={noteDraft}
                      onChange={(event) => setNoteDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void addInternalNote();
                        }
                      }}
                    />
                    <button className="support-admin-filter-btn" type="button" onClick={() => void addInternalNote()} disabled={!noteDraft.trim()}>
                      {language === "fr" ? "Note" : "Note"}
                    </button>
                  </div>
                ) : null}
              </div>

              {/* Message */}
              {error && <div className="support-win-error">{error}</div>}
              {actionMessage && <div className="support-win-ok">{actionMessage}</div>}
              </div>

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

