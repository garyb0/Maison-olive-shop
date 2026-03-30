# Guide de Changement de Mode Olive 🎭

Ce guide explique comment basculer entre les deux thèmes visuels de la boutique Maison Olive.

## Les Deux Modes

### 👑 Mode "Princess" (par défaut)
- **Style**: Élégant, féminin, doux
- **Palette**: Beiges crème, or doux, roses pâles
- **Ambiance**: Boutique de luxe raffinée pour Olive princesse
- **Emoji motto**: ✨ L'élégance d'Olive ✨

### 👹 Mode "Gremlin" (dark chaos)
- **Style**: Sombre, intense, chaotique
- **Palette**: Noirs profonds, rouges sombres, violets
- **Ambiance**: Quand Olive fait des mauvais coups et change les prix
- **Emoji motto**: 👹 Le chaos d'Olive 👹

## Comment Switcher

### Méthode 1: Via .env (Recommandé pour développement local)

1. Ouvre le fichier `.env` dans le projet
2. Trouve la ligne `OLIVE_MODE="princess"`
3. Change la valeur:
   - Pour mode Princess: `OLIVE_MODE="princess"`
   - Pour mode Gremlin: `OLIVE_MODE="gremlin"`
4. Redémarre le serveur:
   ```bash
   # Si tu utilises npm run dev:
   Ctrl+C puis npm run dev
   
   # Si tu utilises PM2:
   pm2 restart maison-olive-shop
   ```

### Méthode 2: Via variable d'environnement système (Production)

```bash
# Windows PowerShell
$env:OLIVE_MODE="gremlin"
pm2 restart maison-olive-shop

# ou retour à princess
$env:OLIVE_MODE="princess"
pm2 restart maison-olive-shop
```

### Méthode 3: Editer directement ecosystem.config.cjs

Ajoute la variable dans le fichier PM2 config:

```javascript
env: {
  NODE_ENV: "production",
  OLIVE_MODE: "princess" // ou "gremlin"
}
```

Puis: `pm2 restart maison-olive-shop`

## Notes Importantes

- ⚠️ Le changement nécessite un **redémarrage du serveur** (c'est une variable server-side)
- 👤 Les utilisateurs ne peuvent PAS changer le mode eux-mêmes
- 🔒 Seul toi (admin système) contrôle ce paramètre
- 🎨 Le design change complètement: couleurs, ombres, tout
- 🖼️ Les 3 logos d'Olive (séparés depuis `a424ec22...png`) sont toujours affichés dans les deux modes
- 📸 Aucune photo d'Olive n'est utilisée dans les cartes produits (seulement des emojis d'icônes)

## Exemples de Scénarios

**Scénario 1**: Olive est sage toute la semaine
→ Garde `OLIVE_MODE="princess"` 

**Scénario 2**: Olive a changé tous les prix pendant que tu dormais
→ Change pour `OLIVE_MODE="gremlin"` pour refléter le chaos

**Scénario 3**: Olive s'est excusée
→ Retour à `OLIVE_MODE="princess"`

---

**Tip**: Tu peux même automatiser le switch avec un script si tu veux randomiser selon l'heure ou autre logique fun! 🎲
