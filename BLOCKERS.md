# 🚧 Blockers en cours

Liste des blocages qui m'empêchent d'avancer sans intervention humaine ou
décision business. Si vide, c'est qu'il n'y a rien à débloquer.

---

## 🔴 Actifs

### B-2 — Clé publique Stripe à vérifier
**Bloque :** rien à court terme (Stripe Checkout fonctionne avec la clé
secrète côté Edge Function), mais une éventuelle migration future vers
Stripe Elements ou Payment Element exigera la clé publique côté client.
**Action attendue :** vérifier dans Stripe Dashboard → Developers → API keys
que la clé publique stockée dans `.env` (`VITE_STRIPE_PUBLIC_KEY`) est
bien la clé complète. Celle fournie se termine par `Yzzzzzzzzzzzzz...zzzz`,
ce qui ressemble à un masque/placeholder du Dashboard plutôt qu'à la
vraie clé.
**Workaround :** aucun nécessaire pour l'instant.

---

## ✅ Résolus

### B-1 — Clés Stripe pour démarrer la Phase 5 (résolu)
**Date résolu :** 2026-04-27
**Résolution :** clés test fournies par l'user, déposées dans Supabase
Edge Functions secrets via la CLI. Webhook créé via API. Phase 5 livrée.

### B-0 — gitnexus segfault à l'indexation (résolu, non bloquant)
**Date :** 2026-04-27
**Cause :** `npm install -g --omit=optional gitnexus@latest` a sauté la dep
native `tree-sitter-dart` (qui ne se build pas sur cette machine sans Visual
Studio Build Tools). Mais d'autres tree-sitter natifs sont aussi affectés en
chaîne, d'où le segfault à l'analyse.
**Résolution :** indexation gitnexus mise de côté. Pas critique pour le projet
TrajetPro. Une réinstallation propre est listée dans `TODO_HUMAN.md` § 14.
