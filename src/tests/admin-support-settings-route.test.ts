export {};

const {
  requireAdminMock,
  getSupportAdminUiSettingsMock,
  getSupportNotificationPreferencesMock,
  getSupportSystemHealthMock,
  hasSupportEmailProviderConfiguredMock,
  parseSupportAdminUiSettingsInputMock,
  parseSupportNotificationPreferencesInputMock,
  updateSupportAdminUiSettingsMock,
  updateSupportNotificationPreferencesMock,
  sendSupportSettingsTestEmailMock,
} = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  getSupportAdminUiSettingsMock: vi.fn(),
  getSupportNotificationPreferencesMock: vi.fn(),
  getSupportSystemHealthMock: vi.fn(),
  hasSupportEmailProviderConfiguredMock: vi.fn(),
  parseSupportAdminUiSettingsInputMock: vi.fn(),
  parseSupportNotificationPreferencesInputMock: vi.fn(),
  updateSupportAdminUiSettingsMock: vi.fn(),
  updateSupportNotificationPreferencesMock: vi.fn(),
  sendSupportSettingsTestEmailMock: vi.fn(),
}));

vi.mock("@/lib/permissions", () => ({
  requireAdmin: (...args: unknown[]) => requireAdminMock(...args),
}));

vi.mock("@/lib/support-notification-preferences", () => ({
  getSupportAdminUiSettings: (...args: unknown[]) => getSupportAdminUiSettingsMock(...args),
  getSupportNotificationPreferences: (...args: unknown[]) => getSupportNotificationPreferencesMock(...args),
  getSupportSystemHealth: (...args: unknown[]) => getSupportSystemHealthMock(...args),
  hasSupportEmailProviderConfigured: (...args: unknown[]) => hasSupportEmailProviderConfiguredMock(...args),
  parseSupportAdminUiSettingsInput: (...args: unknown[]) => parseSupportAdminUiSettingsInputMock(...args),
  parseSupportNotificationPreferencesInput: (...args: unknown[]) => parseSupportNotificationPreferencesInputMock(...args),
  updateSupportAdminUiSettings: (...args: unknown[]) => updateSupportAdminUiSettingsMock(...args),
  updateSupportNotificationPreferences: (...args: unknown[]) => updateSupportNotificationPreferencesMock(...args),
  sendSupportSettingsTestEmail: (...args: unknown[]) => sendSupportSettingsTestEmailMock(...args),
}));

const adminUser = {
  id: "admin_1",
  email: "admin@chezolive.ca",
  firstName: "Admin",
  lastName: "Olive",
  role: "ADMIN",
};

const preferences = {
  emailNewConversation: true,
  emailNewMessage: false,
  emailConversationAssigned: true,
  emailDigest: "daily",
};

const uiSettings = {
  displayName: "Admin Olive",
  quickReplies: ["Bonjour, je regarde ça pour vous."],
};

const supportHealth = {
  ok: true,
  missingTables: [],
};

describe("admin support settings routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    requireAdminMock.mockResolvedValue(adminUser);
    getSupportNotificationPreferencesMock.mockResolvedValue(preferences);
    getSupportAdminUiSettingsMock.mockResolvedValue(uiSettings);
    getSupportSystemHealthMock.mockResolvedValue(supportHealth);
    hasSupportEmailProviderConfiguredMock.mockReturnValue(true);
    parseSupportNotificationPreferencesInputMock.mockImplementation((payload: unknown) => {
      const candidate = payload as Partial<typeof preferences> | null;
      return typeof candidate?.emailNewConversation === "boolean" ? payload : null;
    });
    parseSupportAdminUiSettingsInputMock.mockImplementation((payload: unknown) => {
      const candidate = payload as Partial<typeof uiSettings> | null;
      return candidate && ("displayName" in candidate || "quickReplies" in candidate) ? payload : null;
    });
    updateSupportNotificationPreferencesMock.mockResolvedValue(preferences);
    updateSupportAdminUiSettingsMock.mockResolvedValue(uiSettings);
    sendSupportSettingsTestEmailMock.mockResolvedValue({ sent: true, to: adminUser.email });
  });

  it("retourne les preferences serveur et l'etat du fournisseur email", async () => {
    const { GET } = await import("@/app/api/admin/support/settings/route");

    const response = await GET();
    const payload = (await response.json()) as {
      preferences?: typeof preferences;
      uiSettings?: typeof uiSettings;
      supportHealth?: typeof supportHealth;
      emailProviderConfigured?: boolean;
    };

    expect(response.status).toBe(200);
    expect(payload.preferences).toEqual(preferences);
    expect(payload.uiSettings).toEqual(uiSettings);
    expect(payload.supportHealth).toEqual(supportHealth);
    expect(payload.emailProviderConfigured).toBe(true);
    expect(getSupportNotificationPreferencesMock).toHaveBeenCalledWith("admin_1");
    expect(getSupportAdminUiSettingsMock).toHaveBeenCalledWith(adminUser);
  });

  it("sauvegarde les preferences serveur apres validation du payload", async () => {
    const { PATCH } = await import("@/app/api/admin/support/settings/route");
    const request = new Request("http://localhost:3101/api/admin/support/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(preferences),
    });

    const response = await PATCH(request);
    const payload = (await response.json()) as { preferences?: typeof preferences };

    expect(response.status).toBe(200);
    expect(payload.preferences).toEqual(preferences);
    expect(parseSupportNotificationPreferencesInputMock).toHaveBeenCalledWith(preferences);
    expect(updateSupportNotificationPreferencesMock).toHaveBeenCalledWith("admin_1", preferences);
    expect(getSupportAdminUiSettingsMock).toHaveBeenCalledWith(adminUser);
  });

  it("sauvegarde les reglages UI admin serveur", async () => {
    const { PATCH } = await import("@/app/api/admin/support/settings/route");
    const request = new Request("http://localhost:3101/api/admin/support/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(uiSettings),
    });

    const response = await PATCH(request);
    const payload = (await response.json()) as { uiSettings?: typeof uiSettings };

    expect(response.status).toBe(200);
    expect(payload.uiSettings).toEqual(uiSettings);
    expect(updateSupportAdminUiSettingsMock).toHaveBeenCalledWith(adminUser, uiSettings);
  });

  it("refuse un payload de preferences invalide", async () => {
    parseSupportNotificationPreferencesInputMock.mockReturnValueOnce(null);
    const { PATCH } = await import("@/app/api/admin/support/settings/route");

    const response = await PATCH(
      new Request("http://localhost:3101/api/admin/support/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailDigest: "weekly" }),
      }),
    );
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Invalid support notification settings payload");
    expect(updateSupportNotificationPreferencesMock).not.toHaveBeenCalled();
  });

  it("bloque la sauvegarde quand la table de reglages support manque", async () => {
    getSupportSystemHealthMock.mockResolvedValueOnce({
      ok: false,
      missingTables: ["SupportNotificationPreference"],
    });
    const { PATCH } = await import("@/app/api/admin/support/settings/route");

    const response = await PATCH(
      new Request("http://localhost:3101/api/admin/support/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferences),
      }),
    );
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(409);
    expect(payload.error).toContain("Support settings table missing");
    expect(updateSupportNotificationPreferencesMock).not.toHaveBeenCalled();
  });

  it("envoie un courriel de test quand le fournisseur email est configure", async () => {
    const { POST } = await import("@/app/api/admin/support/settings/test-email/route");

    const response = await POST();
    const payload = (await response.json()) as { sent?: boolean; to?: string };

    expect(response.status).toBe(200);
    expect(payload).toEqual({ sent: true, to: adminUser.email });
    expect(sendSupportSettingsTestEmailMock).toHaveBeenCalledWith(adminUser);
  });

  it("bloque le courriel de test quand la table de reglages support manque", async () => {
    getSupportSystemHealthMock.mockResolvedValueOnce({
      ok: false,
      missingTables: ["SupportNotificationPreference"],
    });
    const { POST } = await import("@/app/api/admin/support/settings/test-email/route");

    const response = await POST();
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(409);
    expect(payload.error).toContain("Support settings table missing");
    expect(sendSupportSettingsTestEmailMock).not.toHaveBeenCalled();
  });

  it("retourne un diagnostic clair si aucun fournisseur email n'est configure", async () => {
    sendSupportSettingsTestEmailMock.mockResolvedValueOnce({
      sent: false,
      reason: "EMAIL_PROVIDER_NOT_CONFIGURED",
    });
    const { POST } = await import("@/app/api/admin/support/settings/test-email/route");

    const response = await POST();
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(409);
    expect(payload.error).toBe("Email provider is not configured");
  });
});
