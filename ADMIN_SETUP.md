# Guide de Configuration Admin 👑

Ce guide explique comment créer ton compte administrateur pour accéder au panel admin de Chez Olive.

## Méthode 1: Via SQL Direct (Recommandée)

### Étape 1: Créer ton compte normalement
1. Va sur http://localhost:3000
2. Inscris-toi avec ton email et mot de passe
3. Note bien ton **email exact**

### Étape 2: Promouvoir ton compte en ADMIN
```bash
# Dans le terminal, depuis le dossier du projet:
cd C:\Cline\maison-olive-shop

# Ouvre la base de données SQLite
sqlite3 prisma/dev.db

# Dans sqlite3, tape cette commande (remplace TON_EMAIL):
UPDATE User SET role = 'ADMIN' WHERE email = 'ton-email@example.com';

# Vérifie que ça a fonctionné:
SELECT email, role FROM User WHERE email = 'ton-email@example.com';

# Quitte sqlite3:
.quit
```

### Étape 3: Reconnecte-toi
1. Déconnecte-toi du site (si connecté)
2. Reconnecte-toi avec ton email/password
3. Le lien "Admin" devrait maintenant apparaître dans la navigation! 🎉

---

## Méthode 2: Via Script Node.js

Crée un fichier `scripts/make-admin.ts`:

```typescript
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function makeAdmin(email: string) {
  try {
    const user = await prisma.user.update({
      where: { email },
      data: { role: "ADMIN" },
    });
    
    console.log(`✅ User ${user.email} is now ADMIN`);
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

const email = process.argv[2];
if (!email) {
  console.error("Usage: tsx scripts/make-admin.ts ton-email@example.com");
  process.exit(1);
}

makeAdmin(email);
```

Puis exécute:
```bash
npx tsx scripts/make-admin.ts ton-email@example.com
```

---

## Méthode 3: Via DB Browser (GUI)

1. **Télécharge DB Browser for SQLite**: https://sqlitebrowser.org/
2. Ouvre `C:\Cline\maison-olive-shop\prisma\dev.db`
3. Onglet "Browse Data" → Table "User"
4. Double-clique sur la colonne `role` de ton user
5. Change `CUSTOMER` → `ADMIN`
6. Sauvegarde (Ctrl+S)
7. Reconnecte-toi sur le site

---

## Vérification

Une fois admin, tu devrais voir:
- ✅ Le lien **"Admin"** dans la navigation (seulement pour toi)
- ✅ Accès à http://localhost:3000/admin
- ✅ Panel de gestion des commandes, clients, taxes, etc.

## Sécurité

⚠️ **Important**:
- Ne donne JAMAIS le rôle ADMIN à un client
- Le lien Admin est **caché automatiquement** pour les non-admins
- Garde ton mot de passe admin sécurisé
- En production, utilise un email distinct pour l'admin

## Retirer l'Accès Admin

Pour révoquer l'accès admin:
```sql
UPDATE User SET role = 'CUSTOMER' WHERE email = 'ancien-admin@example.com';
```

---

💡 **Astuce**: Tu peux créer plusieurs comptes admins en répétant le processus!



