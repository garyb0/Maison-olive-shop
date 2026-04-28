# Chez Olive — Cloudflare DDNS

Objectif: garder `chezolive.ca` pointe vers ton PC même si ton IP publique change.

## 1. Créer le token Cloudflare

Dans Cloudflare:

1. Clique ton icône profil en haut à droite
2. `My Profile`
3. `API Tokens`
4. `Create Token`
5. Utilise `Edit zone DNS`
6. Permissions:
   - `Zone` / `DNS` / `Edit`
   - `Zone` / `Zone` / `Read`
7. Zone resources:
   - `Include`
   - `Specific zone`
   - `chezolive.ca`
8. `Continue to summary`
9. `Create Token`

Copie le token une seule fois.

## 2. Configurer le fichier local

Copie:

```powershell
copy scripts\windows\cloudflare-ddns.env.example scripts\windows\cloudflare-ddns.env
```

Puis ouvre `scripts\windows\cloudflare-ddns.env` et colle le token:

```env
CLOUDFLARE_API_TOKEN=ton-token
CLOUDFLARE_ZONE_NAME=chezolive.ca
CLOUDFLARE_RECORDS=chezolive.ca,www.chezolive.ca
CLOUDFLARE_PROXIED=false
```

`CLOUDFLARE_PROXIED=false` est recommande au depart avec Caddy, le temps de valider HTTPS et les ports.

## 3. Tester une fois

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\windows\cloudflare-ddns.ps1
```

Le script va creer ou mettre a jour les records `A`.

## 4. Installer la tache automatique

Ouvre PowerShell en administrateur:

```powershell
scripts\windows\install-cloudflare-ddns-task-admin.cmd
```

La tache `chezolive-Cloudflare-DDNS` roulera toutes les 10 minutes.
