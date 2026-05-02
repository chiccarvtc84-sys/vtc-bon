# 🌐 Activer GitHub Pages — guide pas-à-pas

Ce dossier contient le site web public TrajetPro (`index.html`, `privacy.html`, `terms.html`, `legal.html`) destiné à être hébergé **gratuitement** sur GitHub Pages. Apple/Google exigent une URL publique pour la politique de confidentialité — ce site la fournit.

## Étape 1 — Activer Pages dans le repo (1 minute)

1. Va sur https://github.com/chiccarvtc84-sys/vtc-bon
2. Clique sur **Settings** (en haut à droite, en mode admin)
3. Dans le menu de gauche, clique sur **Pages**
4. **Source** : "Deploy from a branch"
5. **Branch** : `main` / dossier `/docs`
6. Clique **Save**

Au bout de 1-2 minutes, ton site sera accessible à :

```
https://chiccarvtc84-sys.github.io/vtc-bon/
```

Les pages individuelles auront les URLs suivantes (à donner à Apple lors de la soumission App Store) :

| Page | URL publique |
|---|---|
| Accueil | `https://chiccarvtc84-sys.github.io/vtc-bon/` |
| **Politique de confidentialité** ⭐ | `https://chiccarvtc84-sys.github.io/vtc-bon/privacy.html` |
| CGU | `https://chiccarvtc84-sys.github.io/vtc-bon/terms.html` |
| Mentions légales | `https://chiccarvtc84-sys.github.io/vtc-bon/legal.html` |

⭐ C'est cette URL `privacy.html` que tu colleras dans App Store Connect → "App Privacy" → "Privacy Policy URL".

## Étape 2 — Compléter les placeholders 🔴

Les pages contiennent des mentions visiblement marquées en rouge type `[VOTRE_SIRET]`, `[VOTRE_NOM]`, etc. **Apple rejettera ta soumission si elles restent telles quelles.**

Pour les remplir :
1. Ouvre les fichiers HTML dans un éditeur (VS Code, Notepad++)
2. Recherche/remplace toutes les occurrences `[XXX]` par tes vraies infos :
   - `[NOM_DE_VOTRE_ENTREPRISE]` → ton nom commercial ou raison sociale
   - `[VOTRE_SIRET]` → ton SIRET réel (14 chiffres)
   - `[ADRESSE_COMPLÈTE]` → ton adresse de domiciliation
   - `[VILLE_DU_TRIBUNAL]` → la ville de ton greffe (ex. "Avignon")
   - `[VOTRE_NOM_ET_PRÉNOM]` → toi
   - `[FORME_JURIDIQUE]` → "Auto-entrepreneur (EI)", "SASU", "EURL", etc.
   - `[DATE_DE_PUBLICATION]` → ex. "2 mai 2026"

3. Commit + push → GitHub Pages re-déploie automatiquement en 1-2 minutes
4. Vérifie en visitant l'URL — il ne doit plus rester aucune mention rouge

## Étape 3 — (Optionnel) Domaine personnalisé

Si tu achètes le domaine `trajetpro.fr` (~12 €/an chez Gandi, OVH, Namecheap) :

1. Dans ton registrar : ajouter un enregistrement DNS de type `CNAME` pointant `www` vers `chiccarvtc84-sys.github.io`
2. Et un `A` record pour le domaine racine (`@`) pointant vers `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
3. Dans GitHub Pages → "Custom domain" → entrer `trajetpro.fr` ou `www.trajetpro.fr`
4. Activer "Enforce HTTPS" (gratuit, automatique via Let's Encrypt)

Tes URLs deviendront alors `https://trajetpro.fr/privacy.html` au lieu de l'URL github.io.

## Étape 4 — Faire relire par un avocat (recommandé avant App Store)

Les textes sont solides mais **génériques**. Pour 200-400 €, un avocat en droit du numérique :
- Vérifie ta situation juridique précise
- Adapte les CGU à tes packs de crédits Stripe
- Couvre les cas de litige spécifiques au VTC

Alternatives moins chères (79-199 €) : Captain Contrat, LegalStart, Iubenda.

---

## Vérification rapide

Après activation, teste tes URLs depuis n'importe quel navigateur ou ce site :
👉 https://www.iubenda.com/en/help/8723-privacy-policy-url-test

L'outil simule ce qu'Apple/Google voient en parcourant ton URL. Si tout passe ✅, tu es bon pour la soumission.
