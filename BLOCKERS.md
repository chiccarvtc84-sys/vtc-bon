# 🚧 Blockers en cours

Liste des blocages qui m'empêchent d'avancer sans intervention humaine ou
décision business. Si vide, c'est qu'il n'y a rien à débloquer.

---

## 🔴 Actifs

### B-1 — Clés Stripe pour démarrer la Phase 5
**Bloque :** Phase 5 (paiements crédits)
**Action attendue :** voir `TODO_HUMAN.md` § 3 (compte Stripe + clés API).
**Workaround :** la Phase 5 reste en attente. La Phase 4 fonctionne avec
`purchaseTokensDev` (achat sans paiement réel) — utile pour les tests bêta
internes où tu veux tester la mécanique sans facturer.

---

## ✅ Résolus

### B-0 — gitnexus segfault à l'indexation (résolu, non bloquant)
**Date :** 2026-04-27
**Cause :** `npm install -g --omit=optional gitnexus@latest` a sauté la dep
native `tree-sitter-dart` (qui ne se build pas sur cette machine sans Visual
Studio Build Tools). Mais d'autres tree-sitter natifs sont aussi affectés en
chaîne, d'où le segfault à l'analyse.
**Résolution :** indexation gitnexus mise de côté. Pas critique pour le projet
TrajetPro. Une réinstallation propre est listée dans `TODO_HUMAN.md` § 14.
