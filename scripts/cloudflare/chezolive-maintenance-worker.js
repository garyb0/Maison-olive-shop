/**
 * Chez Olive - external maintenance page for Cloudflare Workers
 *
 * Purpose:
 * - serve a maintenance page even if the local PC, PM2 app, or Cloudflare Tunnel is down
 * - act as a manual "hard failover" separate from the in-app /maintenance mode
 *
 * Deployment:
 * - create a Cloudflare Worker named "chezolive-maintenance"
 * - paste this file into the Worker editor or deploy it with Wrangler
 * - attach routes only when emergency maintenance is needed
 *
 * Suggested routes:
 * - chezolive.ca/*
 * - www.chezolive.ca/*
 * - chezolive.com/*
 * - www.chezolive.com/*
 */

const RETRY_AFTER_SECONDS = 3600;

const html = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Chez Olive - Maintenance</title>
    <style>
      :root {
        color-scheme: light;
        --bg-1: #fffefb;
        --bg-2: #f7edd9;
        --bg-3: #edf3e3;
        --card: rgba(255, 255, 255, 0.88);
        --line: rgba(110, 123, 86, 0.18);
        --text: #271c12;
        --muted: #655949;
        --accent: #607547;
        --accent-soft: #eef4e3;
        --warm: #fff6e7;
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        min-height: 100vh;
        font-family: "Segoe UI", Calibri, Arial, sans-serif;
        color: var(--text);
        background:
          radial-gradient(circle at top left, var(--bg-1) 0%, var(--bg-2) 40%, var(--bg-3) 100%);
        display: grid;
        place-items: center;
        padding: 24px;
      }

      .shell {
        width: min(100%, 920px);
        border: 1px solid var(--line);
        background: var(--card);
        backdrop-filter: blur(10px);
        border-radius: 32px;
        box-shadow: 0 28px 70px rgba(74, 58, 32, 0.14);
        overflow: hidden;
      }

      .grid {
        display: grid;
        grid-template-columns: 1.15fr 0.85fr;
      }

      .copy {
        padding: 44px 38px;
      }

      .badge {
        display: inline-block;
        background: var(--accent-soft);
        color: var(--accent);
        padding: 10px 16px;
        border-radius: 999px;
        font-size: 14px;
        font-weight: 700;
      }

      h1 {
        margin: 18px 0 0;
        font-size: clamp(30px, 5vw, 50px);
        line-height: 1.04;
        letter-spacing: -0.03em;
      }

      p {
        margin: 16px 0 0;
        color: var(--muted);
        font-size: 18px;
        line-height: 1.7;
      }

      .status {
        margin-top: 28px;
        display: inline-flex;
        align-items: center;
        gap: 10px;
        background: #f8fbf2;
        color: #5e7745;
        border: 1px solid #dfe8d0;
        border-radius: 999px;
        padding: 12px 18px;
        font-weight: 600;
      }

      .status-dot {
        width: 10px;
        height: 10px;
        border-radius: 999px;
        background: #7ea35a;
      }

      .contact {
        margin-top: 32px;
        border: 1px solid #f0e1c2;
        background: var(--warm);
        border-radius: 22px;
        padding: 18px 20px;
      }

      .contact strong {
        display: block;
        font-size: 14px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #8f6b3d;
      }

      .contact a {
        display: inline-block;
        margin-top: 10px;
        color: var(--text);
        text-decoration: none;
        font-weight: 700;
      }

      .visual {
        position: relative;
        min-height: 100%;
        padding: 36px 28px;
        background: linear-gradient(180deg, rgba(255,255,255,0.65), rgba(244,239,226,0.96));
        border-left: 1px solid var(--line);
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .bubble {
        position: absolute;
        top: 26px;
        left: 24px;
        max-width: 220px;
        background: white;
        color: var(--muted);
        border-radius: 22px;
        border-bottom-left-radius: 8px;
        padding: 16px 18px;
        box-shadow: 0 16px 30px rgba(85, 67, 38, 0.12);
        font-size: 14px;
        line-height: 1.55;
      }

      .bubble strong {
        display: block;
        color: var(--text);
        margin-bottom: 6px;
      }

      .panel {
        width: 100%;
        max-width: 320px;
        border-radius: 28px;
        padding: 22px;
        background:
          radial-gradient(circle at center, rgba(255,255,255,0.95) 0%, rgba(235,244,224,0.65) 62%, transparent 100%);
      }

      .dog {
        width: 100%;
        aspect-ratio: 4 / 5;
        display: grid;
        place-items: center;
        background: linear-gradient(180deg, #fffdf8 0%, #f6efdf 100%);
        border: 1px solid rgba(125, 108, 77, 0.14);
        border-radius: 26px;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.92);
        font-size: 110px;
      }

      .pill {
        position: absolute;
        right: 22px;
        bottom: 26px;
        background: #fff8ea;
        color: #9a7042;
        border: 1px solid #f3dfba;
        border-radius: 999px;
        padding: 10px 16px;
        font-size: 14px;
        font-weight: 700;
      }

      @media (max-width: 760px) {
        .grid { grid-template-columns: 1fr; }
        .visual {
          border-left: 0;
          border-top: 1px solid var(--line);
          min-height: 320px;
        }
        .copy { padding: 32px 24px; }
        p { font-size: 17px; }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <section class="grid">
        <div class="copy">
          <span class="badge">Petite pause douceur chez Olive</span>
          <h1>Notre boutique prend un petit moment de maintenance.</h1>
          <p>
            Pas de panique. Nous faisons quelques ajustements pour remettre Maison Olive
            sur ses pattes dans les meilleures conditions.
          </p>
          <p>
            Le site reviendra tres bientot. Merci pour votre patience et votre douceur.
          </p>

          <div class="status">
            <span class="status-dot"></span>
            Maintenance externe active
          </div>

          <div class="contact">
            <strong>Besoin de nous joindre ?</strong>
            <a href="mailto:support@chezolive.ca">support@chezolive.ca</a>
          </div>
        </div>

        <div class="visual">
          <div class="bubble">
            <strong>Petit mot d'Olive</strong>
            Je surveille la boutique pendant que mon maitre remet tout bien en place.
          </div>
          <div class="panel">
            <div class="dog" aria-hidden="true">🐾</div>
          </div>
          <div class="pill">Retour bientot</div>
        </div>
      </section>
    </main>
  </body>
</html>`;

const worker = {
  async fetch() {
    return new Response(html, {
      status: 503,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store, no-cache, must-revalidate",
        "retry-after": String(RETRY_AFTER_SECONDS),
        "x-robots-tag": "noindex, nofollow",
      },
    });
  },
};

export default worker;
