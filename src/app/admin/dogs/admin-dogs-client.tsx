"use client";

import { useMemo, useState } from "react";

type DogRow = {
  id: string;
  publicToken: string;
  name: string | null;
  isActive: boolean;
  claimedAtLabel: string | null;
  createdAtLabel: string;
  ownerPhone: string | null;
  userId: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
};

type Props = {
  language: "fr" | "en";
  siteUrl: string;
  dogs: DogRow[];
};

export function AdminDogsClient({ language, siteUrl, dogs: initialDogs }: Props) {
  const [dogs, setDogs] = useState(initialDogs);
  const [search, setSearch] = useState("");
  const [claimFilter, setClaimFilter] = useState<"ALL" | "CLAIMED" | "UNCLAIMED">("ALL");
  const [activeFilter, setActiveFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [creatingBatch, setCreatingBatch] = useState(false);
  const [batchCount, setBatchCount] = useState("25");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const configuredSiteUrl = siteUrl.replace(/\/+$/, "");
  const usingLocalhost = configuredSiteUrl.includes("localhost");

  const filteredDogs = useMemo(() => {
    const query = search.trim().toLowerCase();

    return dogs.filter((dog) => {
      const matchesSearch =
        !query ||
        dog.publicToken.toLowerCase().includes(query) ||
        (dog.name ?? "").toLowerCase().includes(query) ||
        (dog.ownerEmail ?? "").toLowerCase().includes(query) ||
        (dog.ownerName ?? "").toLowerCase().includes(query);

      const matchesClaim =
        claimFilter === "ALL" || (claimFilter === "CLAIMED" ? Boolean(dog.userId) : !dog.userId);

      const matchesActive =
        activeFilter === "ALL" || (activeFilter === "ACTIVE" ? dog.isActive : !dog.isActive);

      return matchesSearch && matchesClaim && matchesActive;
    });
  }, [activeFilter, claimFilter, dogs, search]);

  const totalPages = Math.max(1, Math.ceil(filteredDogs.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedDogs = filteredDogs.slice((safePage - 1) * pageSize, safePage * pageSize);

  const claimedCount = dogs.filter((dog) => dog.userId).length;
  const activeCount = dogs.filter((dog) => dog.isActive).length;
  const unclaimedCount = dogs.filter((dog) => !dog.userId).length;
  const vendorReadyDogs = dogs.filter((dog) => !dog.userId && dog.isActive);

  const publicUrl = (token: string) => `${configuredSiteUrl}/dog/${token}`;

  const resetFilters = () => {
    setSearch("");
    setClaimFilter("ALL");
    setActiveFilter("ALL");
    setPage(1);
  };

  const copyLink = async (token: string) => {
    const target = publicUrl(token);
    try {
      await navigator.clipboard.writeText(target);
    setMessage(language === "fr" ? "Lien copié." : "Link copied.");
      setError("");
    } catch {
      setError(language === "fr" ? "Impossible de copier le lien." : "Unable to copy the link.");
    }
  };

  const downloadCsv = (rows: DogRow[], filenamePrefix = "dog-qr-links") => {
    if (filenamePrefix.includes("vendor") && usingLocalhost) {
      setError(
        language === "fr"
          ? "Le domaine QR pointe encore vers localhost. Configure le vrai domaine avant un export vendeur."
          : "The QR domain still points to localhost. Configure the real domain before vendor export.",
      );
      setMessage("");
      return;
    }

    const headers = ["publicToken", "relativeUrl", "fullUrl", "claimed", "active", "dogName", "ownerEmail"];
    const csvRows = [
      headers.join(","),
      ...rows.map((dog) =>
        [
          dog.publicToken,
          `/dog/${dog.publicToken}`,
          publicUrl(dog.publicToken),
          dog.userId ? "yes" : "no",
          dog.isActive ? "yes" : "no",
          dog.name ?? "",
          dog.ownerEmail ?? "",
        ]
          .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
          .join(","),
      ),
    ];

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `${filenamePrefix}-${rows.length}.csv`;
    link.click();
    URL.revokeObjectURL(href);
    setMessage(language === "fr" ? "Export CSV téléchargé." : "CSV export downloaded.");
    setError("");
  };

  const downloadTxt = (rows: DogRow[], filenamePrefix = "dog-qr-links") => {
    if (filenamePrefix.includes("vendor") && usingLocalhost) {
      setError(
        language === "fr"
          ? "Le domaine QR pointe encore vers localhost. Configure le vrai domaine avant un export vendeur."
          : "The QR domain still points to localhost. Configure the real domain before vendor export.",
      );
      setMessage("");
      return;
    }

    const blob = new Blob([rows.map((dog) => publicUrl(dog.publicToken)).join("\n")], {
      type: "text/plain;charset=utf-8",
    });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `${filenamePrefix}-${rows.length}.txt`;
    link.click();
    URL.revokeObjectURL(href);
    setMessage(language === "fr" ? "Export TXT téléchargé." : "TXT export downloaded.");
    setError("");
  };

  const patchDog = async (dogId: string, payload: { isActive?: boolean; releaseClaim?: boolean }) => {
    setUpdatingId(dogId);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/admin/dogs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dogId, ...payload }),
      });

      const body = (await response.json().catch(() => ({}))) as { dog?: DogRow; error?: string };

      if (!response.ok || !body.dog) {
        setError(body.error ?? (language === "fr" ? "Mise à jour impossible." : "Unable to update token."));
        return;
      }

      setDogs((current) => current.map((dog) => (dog.id === dogId ? { ...dog, ...body.dog } : dog)));
      setMessage(
        payload.releaseClaim
            ? language === "fr"
            ? "Token libéré et prêt à réutiliser."
            : "Token released and ready to reuse."
          : payload.isActive
              ? language === "fr"
                ? "Token activé."
                : "Token activated."
            : language === "fr"
              ? "Token désactivé."
              : "Token disabled.",
      );
    } catch {
      setError(language === "fr" ? "Mise à jour impossible." : "Unable to update token.");
    } finally {
      setUpdatingId(null);
    }
  };

  const createBatch = async () => {
    const count = Number(batchCount);
    if (!Number.isInteger(count) || count <= 0 || count > 500) {
      setError(language === "fr" ? "Entre un nombre valide entre 1 et 500." : "Enter a valid number between 1 and 500.");
      setMessage("");
      return;
    }

    setCreatingBatch(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/admin/dogs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count }),
      });

      const body = (await response.json().catch(() => ({}))) as { dogs?: DogRow[]; error?: string };
      if (!response.ok || !body.dogs) {
        setError(body.error ?? (language === "fr" ? "Création du lot impossible." : "Unable to create batch."));
        return;
      }

      const createdDogs = body.dogs;
      setDogs((current) => [...createdDogs, ...current]);
      setMessage(
        language === "fr"
          ? `${createdDogs.length} nouveaux tokens sont prêts.`
          : `${createdDogs.length} new tokens are ready.`,
      );
    } catch {
      setError(language === "fr" ? "Création du lot impossible." : "Unable to create batch.");
    } finally {
      setCreatingBatch(false);
    }
  };

  return (
    <>
      <section className="section">
        <h1>{language === "fr" ? "Chiens QR" : "Dog QR"}</h1>
        <p className="small">
          {language === "fr"
            ? "Pilotez les tokens QR des médailles, voyez quels colliers sont réclamés et intervenez vite au besoin."
            : "Manage dog QR medal tokens, see which collars are claimed, and step in quickly when needed."}
        </p>
        <p className="small">
          {dogs.length} tokens · {claimedCount} {language === "fr" ? "réclamés" : "claimed"} · {activeCount}{" "}
          {language === "fr" ? "actifs" : "active"}
        </p>
        <p className="small">
          {language === "fr" ? "Domaine QR configure:" : "Configured QR domain:"} <code>{configuredSiteUrl}</code>
        </p>
        {usingLocalhost ? (
          <p className="err small">
            {language === "fr"
              ? "Attention: le domaine pointe encore vers localhost. Ne donne pas ces exports au vendeur avant d'avoir mis le vrai domaine."
              : "Warning: the domain still points to localhost. Do not send these exports to your vendor until the real domain is configured."}
          </p>
        ) : null}
      </section>

      <section className="section">
        <div className="row" style={{ marginBottom: 12, gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <label className="small" htmlFor="dog-batch-count">
              {language === "fr" ? "Créer un lot de tokens" : "Create token batch"}
            </label>
            <div className="row" style={{ gap: 8, marginTop: 6 }}>
              <input
                id="dog-batch-count"
                className="input"
                type="number"
                min={1}
                max={500}
                value={batchCount}
                onChange={(event) => setBatchCount(event.target.value)}
                style={{ width: 110 }}
              />
              <button className="btn" disabled={creatingBatch} onClick={() => void createBatch()} type="button">
                {creatingBatch
                  ? language === "fr"
                    ? "Creation..."
                    : "Creating..."
                  : language === "fr"
                    ? "Generer"
                    : "Generate"}
              </button>
            </div>
          </div>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-secondary" onClick={() => downloadCsv(filteredDogs)} type="button">
              {language === "fr" ? "Exporter filtres CSV" : "Export filtered CSV"}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => downloadCsv(dogs.filter((dog) => !dog.userId), "dog-qr-unclaimed")}
              type="button"
            >
              {language === "fr" ? `Exporter ${unclaimedCount} vierges` : `Export ${unclaimedCount} blank`}
            </button>
            <button
              className="btn btn-secondary"
              disabled={usingLocalhost || vendorReadyDogs.length === 0}
              onClick={() => downloadCsv(vendorReadyDogs, "dog-qr-vendor-ready")}
              type="button"
            >
              {language === "fr" ? `Exporter ${vendorReadyDogs.length} vendeur CSV` : `Export ${vendorReadyDogs.length} vendor CSV`}
            </button>
            <button
              className="btn btn-secondary"
              disabled={usingLocalhost || vendorReadyDogs.length === 0}
              onClick={() => downloadTxt(vendorReadyDogs, "dog-qr-vendor-ready")}
              type="button"
            >
              {language === "fr" ? "Exporter TXT vendeur" : "Export vendor TXT"}
            </button>
          </div>
        </div>

        <div className="row" style={{ marginBottom: 10, gap: 8, flexWrap: "wrap" }}>
          <input
            className="input"
            placeholder={language === "fr" ? "Recherche token, chien, email" : "Search token, dog, email"}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            style={{ maxWidth: 280 }}
          />

          <select
            className="select"
            value={claimFilter}
            onChange={(event) => {
              setClaimFilter(event.target.value as typeof claimFilter);
              setPage(1);
            }}
            style={{ maxWidth: 160 }}
          >
            <option value="ALL">{language === "fr" ? "Tous statuts" : "All claim states"}</option>
            <option value="CLAIMED">{language === "fr" ? "Réclamés" : "Claimed"}</option>
            <option value="UNCLAIMED">{language === "fr" ? "Non réclamés" : "Unclaimed"}</option>
          </select>

          <select
            className="select"
            value={activeFilter}
            onChange={(event) => {
              setActiveFilter(event.target.value as typeof activeFilter);
              setPage(1);
            }}
            style={{ maxWidth: 160 }}
          >
            <option value="ALL">{language === "fr" ? "Tous états" : "All states"}</option>
            <option value="ACTIVE">{language === "fr" ? "Actifs" : "Active"}</option>
            <option value="INACTIVE">{language === "fr" ? "Inactifs" : "Inactive"}</option>
          </select>

          <select
            className="select"
            value={String(pageSize)}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
            style={{ maxWidth: 120 }}
          >
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>

          <button className="btn" type="button" onClick={resetFilters}>
            {language === "fr" ? "Réinitialiser filtres" : "Reset filters"}
          </button>
        </div>

        <div className="row" style={{ marginBottom: 10, gap: 8 }}>
          <button className="btn" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={safePage <= 1}>
            {language === "fr" ? "Précédent" : "Previous"}
          </button>
          <span className="small">
            {language === "fr" ? "Page" : "Page"} {safePage}/{totalPages} · {filteredDogs.length}{" "}
            {language === "fr" ? "résultats" : "results"}
          </span>
          <button
            className="btn"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={safePage >= totalPages}
          >
            {language === "fr" ? "Suivant" : "Next"}
          </button>
        </div>

        {message ? <p className="small ok">{message}</p> : null}
        {error ? <p className="small err">{error}</p> : null}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>QR</th>
                <th>{language === "fr" ? "Chien" : "Dog"}</th>
                <th>{language === "fr" ? "Propriétaire" : "Owner"}</th>
                <th>{language === "fr" ? "État" : "State"}</th>
                <th>{language === "fr" ? "Claim" : "Claim"}</th>
                <th>{language === "fr" ? "Créé" : "Created"}</th>
                <th>{language === "fr" ? "Actions" : "Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {pagedDogs.map((dog) => {
                const isBusy = updatingId === dog.id;
                const isClaimed = Boolean(dog.userId);

                return (
                  <tr key={dog.id}>
                    <td>
                      <code>{dog.publicToken}</code>
                    </td>
                    <td>
                      <strong>{dog.name ?? (language === "fr" ? "Non renseigné" : "Not filled yet")}</strong>
                      {dog.ownerPhone ? <div className="small">{dog.ownerPhone}</div> : null}
                    </td>
                    <td>
                      {dog.ownerName ? <div>{dog.ownerName}</div> : null}
                      {dog.ownerEmail ? (
                        <div className="small">{dog.ownerEmail}</div>
                      ) : (
                        <span className="small">{language === "fr" ? "Aucun compte" : "No account"}</span>
                      )}
                    </td>
                    <td>
                      <span className="small">
                        {dog.isActive ? (language === "fr" ? "Actif" : "Active") : language === "fr" ? "Inactif" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <span className="small">
                        {isClaimed
                          ? `${language === "fr" ? "Réclamé" : "Claimed"}${dog.claimedAtLabel ? ` · ${dog.claimedAtLabel}` : ""}`
                          : language === "fr"
                            ? "Non réclamé"
                            : "Unclaimed"}
                      </span>
                    </td>
                    <td>{dog.createdAtLabel}</td>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 220 }}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <a className="btn btn-secondary" href={publicUrl(dog.publicToken)} rel="noreferrer" target="_blank">
                            {language === "fr" ? "Ouvrir" : "Open"}
                          </a>
                          <button className="btn btn-secondary" disabled={isBusy} onClick={() => void copyLink(dog.publicToken)} type="button">
                            {language === "fr" ? "Copier lien" : "Copy link"}
                          </button>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <button
                            className="btn"
                            disabled={isBusy}
                            onClick={() => void patchDog(dog.id, { isActive: !dog.isActive })}
                            type="button"
                          >
                            {dog.isActive
                              ? language === "fr"
                                ? "Désactiver"
                                : "Disable"
                              : language === "fr"
                                ? "Activer"
                                : "Enable"}
                          </button>
                          {isClaimed ? (
                            <button
                              className="btn btn-danger"
                              disabled={isBusy}
                              onClick={() => {
                                const confirmed = window.confirm(
                                  language === "fr"
                                    ? "Liberer ce token et effacer la fiche chien associee ?"
                                    : "Release this token and clear the linked dog profile?",
                                );
                                if (confirmed) {
                                  void patchDog(dog.id, { releaseClaim: true });
                                }
                              }}
                              type="button"
                            >
                              {language === "fr" ? "Liberer token" : "Release token"}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}


