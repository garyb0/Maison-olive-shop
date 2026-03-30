"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  user?: { firstName?: string; email?: string; role?: string } | null;
};

type QuickActionType = "track" | "products" | "faq" | "human";
type ResetConversationOptions = { preserveGuestInfo?: boolean; closeWidget?: boolean };

const STORAGE_KEY = "support_conv";
const COOLDOWN_KEY = "support_conv_cooldown";
const PROMO_CLAIMED_KEY = "support_promo_claimed";
const PROMO_DISMISSED_KEY = "support_promo_dismissed";
const SPAM_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const AVATAR_URL = "/Logo/Olive.png";
const WELCOME_DELAY = 1800; // 1.8 seconds
const LEAD_CAPTURE_THRESHOLD = 2; // Show after 2 customer messages
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function loadGuestSession(): { id: string; email: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "id" in parsed &&
      "email" in parsed &&
      typeof (parsed as Record<string, unknown>).id === "string" &&
      typeof (parsed as Record<string, unknown>).email === "string"
    ) {
      return parsed as { id: string; email: string };
    }
  } catch {
    // ignore
  }
  return null;
}

function saveGuestSession(id: string, email: string) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ id, email }));
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

function loadFlag(key: string) {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function saveFlag(key: string, value: boolean) {
  try {
    if (value) localStorage.setItem(key, "1");
    else localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function getCooldownRemaining(): number {
  try {
    const raw = localStorage.getItem(COOLDOWN_KEY);
    if (!raw) return 0;
    const ts = Number(raw);
    if (isNaN(ts)) return 0;
    const remaining = ts + SPAM_COOLDOWN_MS - Date.now();
    return remaining > 0 ? remaining : 0;
  } catch {
    return 0;
  }
}

function setCooldownNow() {
  try {
    localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

function clearCooldown() {
  try {
    localStorage.removeItem(COOLDOWN_KEY);
  } catch {
    // ignore
  }
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

function formatCooldownMinutes(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function SupportChatWidget({ language, user }: Props) {
  if (user?.role === "ADMIN") {
    return null;
  }

  return <SupportChatWidgetInner language={language} user={user} />;
}

function SupportChatWidgetInner({ language, user }: Props) {

  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [adminAvailable, setAdminAvailable] = useState(false);
  const [conversation, setConversation] = useState<SupportConversation | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [unread, setUnread] = useState(0);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showLeadCapture, setShowLeadCapture] = useState(false);
  const [leadEmail, setLeadEmail] = useState("");
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [leadError, setLeadError] = useState("");
  const [promoClaimed, setPromoClaimed] = useState(false);
  const [promoDismissed, setPromoDismissed] = useState(false);
  const [customerMessageCount, setCustomerMessageCount] = useState(0);
  const [localSystemMessages, setLocalSystemMessages] = useState<SupportMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessageCount = useRef(0);
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const welcomeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const conversationRef = useRef<SupportConversation | null>(null);
  const resetConversationStateRef = useRef<(options?: ResetConversationOptions) => void>(() => undefined);
  const originalTitleRef = useRef(typeof document !== "undefined" ? document.title : "Maison Olive");
  const [showTyping, setShowTyping] = useState(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const knownEmail = useMemo(() => (user?.email || conversation?.customerEmail || guestEmail).trim(), [user?.email, conversation?.customerEmail, guestEmail]);

  const resetConversationState = useCallback((options?: ResetConversationOptions) => {
    const preserveGuestInfo = options?.preserveGuestInfo ?? false;
    const closeWidget = options?.closeWidget ?? false;

    const preservedGuestName = preserveGuestInfo && !user
      ? guestName.trim() || conversation?.customerName || ""
      : "";
    const preservedGuestEmail = preserveGuestInfo && !user
      ? guestEmail.trim() || conversation?.customerEmail || ""
      : "";

    clearGuestSession();
    clearCooldown();
    setConversation(null);
    setDraft("");
    setError("");
    setUnread(0);
    prevMessageCount.current = 0;
    setCooldownRemaining(0);
    setShowWelcome(false);
    setShowLeadCapture(false);
    setLeadEmail("");
    setLeadError("");
    setCustomerMessageCount(0);
    setLocalSystemMessages([]);

    if (!user) {
      setGuestName(preservedGuestName);
      setGuestEmail(preservedGuestEmail);
    }

    if (closeWidget) {
      setOpen(false);
    }
  }, [conversation?.customerEmail, conversation?.customerName, guestEmail, guestName, user]);

  useEffect(() => {
    conversationRef.current = conversation;
  }, [conversation]);

  useEffect(() => {
    resetConversationStateRef.current = resetConversationState;
  }, [resetConversationState]);


  useEffect(() => {
    setPromoClaimed(loadFlag(PROMO_CLAIMED_KEY));
    setPromoDismissed(loadFlag(PROMO_DISMISSED_KEY));
  }, []);

  const t = {
    title: language === "fr" ? "Olive - Support" : "Olive - Support",
    subtitle: adminAvailable
      ? language === "fr" ? "En ligne - un conseiller répond" : "Agent responding"
      : language === "fr" ? "Réponse rapide" : "Replying soon",
    namePlaceholder: language === "fr" ? "Ton prénom" : "Your name",
    emailPlaceholder: language === "fr" ? "Ton email" : "Your email",
    msgPlaceholder: language === "fr" ? "Écris ton message ici..." : "Write your message here...",
    send: language === "fr" ? "Envoyer" : "Send",
    toggle: language === "fr" ? "Besoin d'aide ?" : "Need help?",
    closed: language === "fr" ? "Cette conversation est terminée." : "This conversation has ended.",
    newChat: language === "fr" ? "Démarrer un nouveau chat" : "Start a new chat",
    cooldownMsg: language === "fr"
      ? `Merci de patienter encore ${formatCooldownMinutes(cooldownRemaining)} avant d'ouvrir un nouveau chat.`
      : `Please wait ${formatCooldownMinutes(cooldownRemaining)} before starting a new chat.`,
    errorFill: language === "fr" ? "Merci de remplir ton nom et email." : "Please fill in your name and email.",
    errorSend: language === "fr" ? "Impossible d'envoyer. Réessaie." : "Could not send. Please retry.",
    welcome: language === "fr" ? "Bonjour, je suis Olive 🫒 Je peux t'aider avec une commande, un produit ou la livraison." : "Hi, I'm Olive 🫒 I can help with orders, products, or delivery.",
    messageSentAck: language === "fr" ? "Message reçu. Un conseiller te répondra sous peu." : "Message received. An advisor will reply shortly.",
    leadCaptureTitle: language === "fr" ? "Un petit cadeau pour toi ✨" : "A little gift for you ✨",
    leadCaptureText: language === "fr" ? "Laisse ton email et on t'envoie un code promo de 10% pour ta prochaine commande." : "Share your email and we'll send you a 10% promo code for your next order.",
    trackOrder: language === "fr" ? "Suivre ma commande" : "Track my order",
    viewProducts: language === "fr" ? "Voir les produits" : "View products",
    faq: language === "fr" ? "Livraison et retours" : "Delivery and returns",
    talkToHuman: language === "fr" ? "Parler à un humain" : "Talk to an advisor",
    connectedNameLabel: language === "fr" ? "Connecté (nom)" : "Signed in (name)",
    connectedEmailLabel: language === "fr" ? "Connecté (email)" : "Signed in (email)",
    identityLocked: language === "fr" ? "Ces informations viennent de ton compte et ne peuvent pas être modifiées ici." : "These details come from your account and cannot be edited here.",
  };

  const authenticatedDisplayName = useMemo(() => {
    const userName = (user?.firstName ?? "").trim();
    const conversationName = (conversation?.customerName ?? "").trim();
    if (userName) return userName;
    if (conversationName) return conversationName;
    return language === "fr" ? "Client connecté" : "Signed-in customer";
  }, [conversation?.customerName, language, user?.firstName]);

  // Cooldown ticker
  useEffect(() => {
    const tick = () => {
      const remaining = getCooldownRemaining();
      setCooldownRemaining(remaining);
      if (remaining <= 0 && cooldownTimerRef.current) {
        clearInterval(cooldownTimerRef.current);
        cooldownTimerRef.current = null;
      }
    };
    tick();
    cooldownTimerRef.current = setInterval(tick, 1000);
    return () => {
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    };
  }, []);

  // On mount: restore guest session from localStorage
  useEffect(() => {
    if (user) return; // logged-in user: handled by state API polling
    const session = loadGuestSession();
    if (session) {
      setGuestEmail(session.email);
      // Load the conversation immediately
      void fetchGuestConversation(session.id);
    }
  }, [user]);

  useEffect(() => {
    if (conversation?.status !== "CLOSED") return;
    resetConversationState({ preserveGuestInfo: true, closeWidget: true });
  }, [conversation?.status, resetConversationState]);

  const fetchGuestConversation = async (id: string) => {
    try {
      const res = await fetch(`/api/support/conversations/${id}`);
      if (!res.ok) {
        // Conversation not found or deleted - clear storage
        resetConversationState({ preserveGuestInfo: true });
        return;
      }
      const data = await res.json();
      const conv = data.conversation as SupportConversation;
      setConversation(conv);
      prevMessageCount.current = conv.messages?.length ?? 0;
      // Count customer messages
      const customerMsgs = conv.messages?.filter((m) => m.senderType === "CUSTOMER").length ?? 0;
      setCustomerMessageCount(customerMsgs);
    } catch {
      // silent
    }
  };

  // Show welcome message after 2 seconds when chat opens
  useEffect(() => {
    if (open && !conversation && !showWelcome) {
      welcomeTimerRef.current = setTimeout(() => {
        setShowWelcome(true);
      }, WELCOME_DELAY);
    }
    return () => {
      if (welcomeTimerRef.current) clearTimeout(welcomeTimerRef.current);
    };
  }, [open, conversation, showWelcome]);

  // Polling — stabilized to depend ONLY on open and user
  useEffect(() => {
    let isMounted = true;

    const poll = async () => {
      if (!isMounted) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }

      const currentUser = user;
      const isOpen = open;
      const currentConv = conversationRef.current;

      if (currentUser) {
        // Authenticated: use state API
        try {
          const res = await fetch("/api/support/state");
          if (!res.ok || !isMounted) return;
          const data = await res.json();
          setAdminAvailable(Boolean(data.adminAvailable));
          if (data.activeConversation) {
            const conv = data.activeConversation as SupportConversation;
            const newCount = conv.messages?.length ?? 0;
            if (!isOpen && newCount > prevMessageCount.current) {
              const lastSender = conv.messages?.[newCount - 1]?.senderType;
              if (lastSender !== "CUSTOMER") setUnread((u) => u + (newCount - prevMessageCount.current));
            }
            // Admin replied — clear typing indicator
            if (newCount > prevMessageCount.current) {
              const lastSender = conv.messages?.[newCount - 1]?.senderType;
              if (lastSender === "ADMIN") {
                setShowTyping(false);
                if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
              }
            }
            prevMessageCount.current = newCount;
            setConversation(conv);
            // Count customer messages
            const customerMsgs = conv.messages?.filter((m) => m.senderType === "CUSTOMER").length ?? 0;
            setCustomerMessageCount(customerMsgs);
          } else if (currentConv) {
            resetConversationStateRef.current({ closeWidget: true });
          }
        } catch {
          // silent
        }
      } else {
        // Guest: poll adminAvailable + specific conversation if exists
        try {
          const stateRes = await fetch("/api/support/state");
          if (stateRes.ok && isMounted) {
            const stateData = await stateRes.json();
            setAdminAvailable(Boolean(stateData.adminAvailable));
          }
        } catch {
          // silent
        }

        const session = loadGuestSession();
        if (session && isMounted) {
          try {
            const res = await fetch(`/api/support/conversations/${session.id}`);
            if (!res.ok || !isMounted) return;
            const data = await res.json();
            const conv = data.conversation as SupportConversation;
            const newCount = conv.messages?.length ?? 0;
            if (!isOpen && newCount > prevMessageCount.current) {
              const lastSender = conv.messages?.[newCount - 1]?.senderType;
              if (lastSender !== "CUSTOMER") setUnread((u) => u + (newCount - prevMessageCount.current));
            }
            prevMessageCount.current = newCount;
            setConversation(conv);
            // Count customer messages
            const customerMsgs = conv.messages?.filter((m) => m.senderType === "CUSTOMER").length ?? 0;
            setCustomerMessageCount(customerMsgs);
          } catch {
            // silent
          }
        }
      }
    };

    void poll();
    const intervalMs = open ? 5000 : 20000;
    const id = window.setInterval(() => void poll(), intervalMs);
    return () => {
      isMounted = false;
      window.clearInterval(id);
    };
  }, [open, user]);

  // Document title notification when unread messages arrive
  useEffect(() => {
    if (unread > 0 && !open) {
      document.title = `💬 (${unread}) ${originalTitleRef.current}`;
    } else {
      document.title = originalTitleRef.current;
    }
  }, [unread, open]);

  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => {
        // Scroll only the messages container — NOT the whole page
        const container = messagesEndRef.current?.parentElement;
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      }, 80);
    }
  }, [open, conversation?.messages?.length, localSystemMessages.length]);

  const startNewChat = () => {
    const remaining = getCooldownRemaining();
    if (remaining > 0) {
      setCooldownRemaining(remaining);
      return;
    }
    resetConversationState();
  };

  const handleQuickAction = async (action: QuickActionType) => {
    let messageContent = "";
    if (action === "track") {
      messageContent = language === "fr" ? "Je voudrais suivre ma commande" : "I'd like to track my order";
    } else if (action === "products") {
      messageContent = language === "fr" ? "Montrez-moi vos produits" : "Show me your products";
    } else if (action === "faq") {
      messageContent = language === "fr" ? "J'ai une question FAQ" : "I have a FAQ question";
    } else if (action === "human") {
      messageContent = language === "fr" ? "Je veux parler a un humain" : "I want to talk to an agent";
    }

    const missingGuestInfo = !conversation && !user && (!guestName.trim() || !guestEmail.trim());
    if (missingGuestInfo) {
      setDraft(messageContent);
      setError(t.errorFill);
      return;
    }

    await submitMessage(messageContent);
  };

  const submitMessage = async (messageContent: string) => {
    if (!messageContent.trim()) return;
    if (!conversation && !user && (!guestName.trim() || !guestEmail.trim())) {
      setError(t.errorFill);
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      let res: Response;

      if (conversation) {
        // Send message to existing conversation
        const body = user
          ? { content: messageContent }
          : { content: messageContent, guestEmail: guestEmail.trim() };

        res = await fetch(`/api/support/conversations/${conversation.id}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        // Create new conversation and set cooldown
        res = await fetch("/api/support/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: user ? undefined : guestName.trim(),
            email: user ? undefined : guestEmail.trim(),
            message: messageContent,
          }),
        });
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "FAILED");

      const conv = data.conversation as SupportConversation;
      setConversation(conv);
      prevMessageCount.current = conv?.messages?.length ?? 0;
      setCustomerMessageCount((prev) => prev + 1);

      // Persist guest session so reload doesn't lose the conversation
      if (!user && conv?.id) {
        saveGuestSession(conv.id, guestEmail.trim() || conv.customerEmail);
        // Set anti-spam cooldown when a new conversation is created
        if (!conversation) {
          setCooldownNow();
          setCooldownRemaining(SPAM_COOLDOWN_MS);
          // Restart ticker
          if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
          cooldownTimerRef.current = setInterval(() => {
            const remaining = getCooldownRemaining();
            setCooldownRemaining(remaining);
            if (remaining <= 0 && cooldownTimerRef.current) {
              clearInterval(cooldownTimerRef.current);
              cooldownTimerRef.current = null;
            }
          }, 1000);
        }
      }

      setDraft("");

      // Show typing indicator — admin is preparing a response
      setShowTyping(true);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => setShowTyping(false), 30000);

      // Check if we should show lead capture
      setLocalSystemMessages((prev) => [
        ...prev,
        {
          id: "local-system-" + Date.now().toString() + "-" + Math.random().toString(36).slice(2, 8),
          senderType: "SYSTEM",
          content: t.messageSentAck,
          createdAt: new Date().toISOString(),
        },
      ]);

      if (customerMessageCount + 1 >= LEAD_CAPTURE_THRESHOLD && !showLeadCapture && !promoClaimed && !promoDismissed) {
        setTimeout(() => {
          setShowLeadCapture(true);
        }, 1200);
      }
    } catch {
      setError(t.errorSend);
    } finally {
      setSubmitting(false);
    }
  };

  const claimPromoCode = async () => {
    const emailToUse = (knownEmail || leadEmail).trim();
    if (!EMAIL_REGEX.test(emailToUse)) {
      setLeadError(language === "fr" ? "Entre une adresse email valide." : "Enter a valid email address.");
      return;
    }

    setLeadSubmitting(true);
    setLeadError("");
    try {
      const res = await fetch("/api/support/promo-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailToUse, language }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "FAILED");

      saveFlag(PROMO_CLAIMED_KEY, true);
      saveFlag(PROMO_DISMISSED_KEY, true);
      setPromoClaimed(true);
      setPromoDismissed(true);
      setShowLeadCapture(false);
      setLeadEmail("");
      setLocalSystemMessages((prev) => [
        ...prev,
        {
          id: "local-system-" + Date.now().toString() + "-" + Math.random().toString(36).slice(2, 8),
          senderType: "SYSTEM",
          content: language === "fr"
            ? `Ton code promo ${data.code ?? "OLIVE10"} est prêt 🎉 Utilise-le au paiement.`
            : `Your promo code ${data.code ?? "OLIVE10"} is ready 🎉 Use it at checkout.`,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch {
      setLeadError(language === "fr" ? "Impossible d'envoyer le code pour le moment." : "Could not send the code right now.");
    } finally {
      setLeadSubmitting(false);
    }
  };

  const submit = async () => {
    await submitMessage(draft);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  const canSend =
    draft.trim().length > 0 &&
    (
      !!conversation ||
      !!user ||
      (guestName.trim().length > 0 && guestEmail.trim().length > 0)
    );

  const isClosed = conversation?.status === "CLOSED";
  const guestInfoMissing = !user && !conversation && (!guestName.trim() || !guestEmail.trim());
  const showQuickActions = !isClosed && !conversation;

  return (
    <>
      {/* Floating button */}
      <button
        className="support-float-btn"
        type="button"
        aria-label={t.toggle}
        onClick={() => { setOpen((v) => !v); setUnread(0); }}
      >
        {open ? (
          <span className="support-float-icon">✕</span>
        ) : (
          <>
            <span className="support-float-label">{t.toggle}</span>
            {unread > 0 && <span className="support-badge">{unread}</span>}
          </>
        )}
      </button>

      {/* Chat window */}
      {open && (
        <div className="support-window" role="dialog" aria-label={t.title}>
          {/* Header */}
          <div className="support-win-header">
            <div className="support-win-header-info">
              <img
                src={AVATAR_URL}
                alt="Olive"
                className="support-win-avatar-img"
              />
              <div>
                <div className="support-win-title">{t.title}</div>
                <div className="support-win-status">{t.subtitle}</div>
              </div>
            </div>
            <button className="support-win-close" type="button" onClick={() => setOpen(false)} aria-label="Fermer">✕</button>
          </div>

          {/* Authenticated identity (read-only) */}
          {user && (
            <div className="support-win-guest">
              <input
                className="input"
                aria-label={t.connectedNameLabel}
                value={authenticatedDisplayName}
                readOnly
                disabled
              />
              <input
                className="input"
                type="email"
                aria-label={t.connectedEmailLabel}
                value={knownEmail}
                readOnly
                disabled
              />
              <p className="small" style={{ margin: 0 }}>
                🔒 {t.identityLocked}
              </p>
            </div>
          )}

          {/* Guest fields - only if no conversation yet */}
          {!user && !conversation && (
            <div className="support-win-guest">
              <input
                className="input"
                placeholder={t.namePlaceholder}
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                autoComplete="name"
              />
              <input
                className="input"
                type="email"
                placeholder={t.emailPlaceholder}
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
          )}

          {/* Messages */}
          <div className="support-win-messages" aria-live="polite" aria-label={language === "fr" ? "Messages du support" : "Support messages"}>
            {(!conversation || conversation.messages.length === 0) && !showWelcome && (
              <div className="support-win-empty support-msg-fade-in">
                <img
                  src={AVATAR_URL}
                  alt="Olive"
                  className="support-win-empty-avatar"
                />
                <p>{language === "fr" ? "Choisis un raccourci ou écris-moi ton message." : "Choose a shortcut or send your message."}</p>
              </div>
            )}

            {/* Welcome message */}
            {showWelcome && (!conversation || conversation.messages.length === 0) && (
              <div className="support-msg support-msg-admin support-msg-fade-in">
                <img
                  src={AVATAR_URL}
                  alt="Olive"
                  className="support-msg-avatar-img"
                />
                <div className="support-msg-bubble">{t.welcome}</div>
              </div>
            )}

            {conversation?.messages.map((msg, idx) => (
              <div
                key={msg.id}
                className={`support-msg ${
                  msg.senderType === "CUSTOMER"
                    ? "support-msg-customer"
                    : msg.senderType === "ADMIN"
                    ? "support-msg-admin"
                    : "support-msg-system"
                } support-msg-fade-in`}
                style={{
                  animationDelay: `${idx * 0.05}s`,
                }}
              >
                {msg.senderType === "ADMIN" && (
                  <img
                    src={AVATAR_URL}
                    alt="Olive"
                    className="support-msg-avatar-img"
                  />
                )}
                <div className="support-msg-body">
                  <div className="support-msg-bubble">{msg.content}</div>
                  {msg.createdAt && (
                    <span className="support-msg-time">{formatTime(msg.createdAt)}</span>
                  )}
                </div>
              </div>
            ))}

            {localSystemMessages.map((msg, idx) => (
              <div
                key={msg.id}
                className="support-msg support-msg-system support-msg-fade-in"
                style={{ animationDelay: `${idx * 0.03}s` }}
              >
                <div className="support-msg-body">
                  <div className="support-msg-bubble">{msg.content}</div>
                  {msg.createdAt && (
                    <span className="support-msg-time" style={{ textAlign: "center" }}>{formatTime(msg.createdAt)}</span>
                  )}
                </div>
              </div>
            ))}

            {/* Lead capture banner */}
            {showLeadCapture && conversation && !isClosed && !promoClaimed && (
              <div className="support-lead-capture support-msg-fade-in">
                <div className="support-lead-icon">✨</div>
                <div className="support-lead-content">
                  <p className="support-lead-title">{t.leadCaptureTitle}</p>
                  <p className="support-lead-text">{knownEmail ? (language === "fr" ? "On peut envoyer ton code promo à l'adresse déjà liée à cette conversation." : "We can send your promo code to the email already linked to this conversation.") : t.leadCaptureText}</p>
                  <div className="support-lead-form">
                    {!knownEmail && (
                      <input
                        type="email"
                        className="support-lead-email"
                        placeholder={t.emailPlaceholder}
                        value={leadEmail}
                        onChange={(e) => setLeadEmail(e.target.value)}
                      />
                    )}
                    <button className="support-lead-btn" type="button" onClick={() => void claimPromoCode()} disabled={leadSubmitting}>
                      {leadSubmitting ? "..." : language === "fr" ? "Recevoir" : "Send"}
                    </button>
                  </div>
                  {leadError && <p className="err">{leadError}</p>}
                </div>
                <button
                  className="support-lead-close"
                  onClick={() => { saveFlag(PROMO_DISMISSED_KEY, true); setPromoDismissed(true); setShowLeadCapture(false); }}
                >
                  X
                </button>
              </div>
            )}

            {/* Quick action buttons */}
            {showQuickActions && (
              <div className="support-quick-actions support-msg-fade-in">
                <p className="small" style={{ margin: 0 }}>
                  {language === "fr" ? "Raccourcis utiles — pour aller plus vite, commence ici." : "Helpful shortcuts — start here for a faster reply."}
                </p>
                <button
                  className={`support-quick-btn${guestInfoMissing ? " support-quick-btn--locked" : ""}`}
                  onClick={() => void handleQuickAction("track")}
                  disabled={submitting || guestInfoMissing}
                  title={guestInfoMissing ? (language === "fr" ? "Remplis ton prénom et email d'abord" : "Fill in your name and email first") : undefined}
                >
                  {t.trackOrder}
                </button>
                <button
                  className={`support-quick-btn${guestInfoMissing ? " support-quick-btn--locked" : ""}`}
                  onClick={() => void handleQuickAction("products")}
                  disabled={submitting || guestInfoMissing}
                  title={guestInfoMissing ? (language === "fr" ? "Remplis ton prénom et email d'abord" : "Fill in your name and email first") : undefined}
                >
                  {t.viewProducts}
                </button>
                <button
                  className={`support-quick-btn${guestInfoMissing ? " support-quick-btn--locked" : ""}`}
                  onClick={() => void handleQuickAction("faq")}
                  disabled={submitting || guestInfoMissing}
                  title={guestInfoMissing ? (language === "fr" ? "Remplis ton prénom et email d'abord" : "Fill in your name and email first") : undefined}
                >
                  {t.faq}
                </button>
                <button
                  className={`support-quick-btn${guestInfoMissing ? " support-quick-btn--locked" : ""}`}
                  onClick={() => void handleQuickAction("human")}
                  disabled={submitting || guestInfoMissing}
                  title={guestInfoMissing ? (language === "fr" ? "Remplis ton prénom et email d'abord" : "Fill in your name and email first") : undefined}
                >
                  {t.talkToHuman}
                </button>
                {guestInfoMissing && (
                  <p className="support-quick-hint">
                    ⬆️ {language === "fr"
                      ? "Remplis ton prénom + email pour utiliser ces raccourcis."
                      : "Fill in your name + email to use these shortcuts."}
                  </p>
                )}
              </div>
            )}

            {/* Typing indicator — shown while waiting for admin response */}
            {showTyping && conversation && !isClosed && (
              <div className="support-msg support-msg-admin support-msg-fade-in">
                <img src={AVATAR_URL} alt="Olive" className="support-msg-avatar-img" />
                <div className="support-typing-bubble">
                  <span className="support-typing-dot" />
                  <span className="support-typing-dot" />
                  <span className="support-typing-dot" />
                </div>
              </div>
            )}

            {isClosed && (
              <div className="support-win-closed">{t.closed}</div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Error */}
          {error && <div className="support-win-error">{error}</div>}

          {/* Closed state - New chat button */}
          {isClosed && (
            <div className="support-win-restart">
              {cooldownRemaining > 0 ? (
                <p className="support-win-cooldown">{t.cooldownMsg}</p>
              ) : (
                <button
                  className="btn support-win-newchat-btn"
                  type="button"
                  onClick={startNewChat}
                >
                  {t.newChat}
                </button>
              )}
            </div>
          )}

          {/* Compose - only when conversation is not closed */}
          {!isClosed && (
            <div className="support-win-compose">
              <textarea
                className="support-win-textarea"
                rows={2}
                placeholder={t.msgPlaceholder}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKey}
                disabled={submitting}
              />
              <button
                className="support-win-send"
                type="button"
                onClick={() => void submit()}
                disabled={submitting || !canSend}
                aria-label={t.send}
              >
                {submitting ? "..." : "➤"}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
