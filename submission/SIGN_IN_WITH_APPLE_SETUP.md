# 🍎 Configurer Sign in with Apple — guide pas-à-pas

> **Pré-requis** : compte Apple Developer Program activé (99 €/an).
>
> Apple App Store règle 4.8 oblige à proposer "Sign in with Apple" si l'app
> offre déjà email/password. Le code frontend est **déjà en place**
> (`src/lib/supabase.js → signInWithApple()`), mais il faut configurer
> 2 choses pour qu'il fonctionne en prod :
>
> 1. Apple Developer Console (~30 min)
> 2. Supabase Dashboard (~5 min)

---

## Étape 1 — Apple Developer Console (côté Apple)

### 1.1 Activer "Sign in with Apple" pour ton App ID

1. Va sur https://developer.apple.com/account
2. **Certificates, Identifiers & Profiles** → **Identifiers**
3. Trouve ton App ID `com.trajetpro.app` (ou crée-le s'il n'existe pas)
4. Coche **Sign in with Apple** dans la liste des Capabilities
5. **Save**

### 1.2 Créer un Service ID

Le Service ID est l'identifiant utilisé par les flows web/OAuth (≠ de l'App ID utilisé par l'app native).

1. **Identifiers** → **+** → choisir **Services IDs** → **Continue**
2. Description : `TrajetPro Sign In`
3. Identifier : `com.trajetpro.app.signin` (différent de l'App ID, ajoute `.signin`)
4. **Continue** → **Register**
5. Re-clique sur le Service ID que tu viens de créer
6. Coche **Sign in with Apple** → **Configure**
7. Primary App ID : sélectionne `com.trajetpro.app`
8. **Domains and Subdomains** : ajoute :
   ```
   olmhckwethdcxhvsrfie.supabase.co
   ```
9. **Return URLs** : ajoute :
   ```
   https://olmhckwethdcxhvsrfie.supabase.co/auth/v1/callback
   ```
10. **Save** → **Continue** → **Save**

### 1.3 Créer une Authentication Key (.p8)

C'est le secret qui permettra à Supabase de signer les requêtes vers Apple.

1. **Keys** → **+** → Key Name : `TrajetPro Sign In Key`
2. Coche **Sign in with Apple** → **Configure**
3. Primary App ID : `com.trajetpro.app` → **Save**
4. **Continue** → **Register**
5. **TÉLÉCHARGE** le fichier `.p8` qui apparaît (1 SEULE FOIS — pas de re-download possible !)
6. Note le **Key ID** affiché (10 caractères type `ABC123XYZ4`)

📌 Sauvegarde ce fichier `.p8` ET note le Key ID **dans 3 endroits sûrs** (cloud chiffré + clé USB + email à toi-même). Si tu le perds, il faudra refaire toute la procédure.

### 1.4 Trouver ton Team ID

- Va en haut à droite du portail Developer → ton nom → menu déroulant
- Tu vois ton **Team ID** (10 caractères type `J7K8L9MNOP`)

---

## Étape 2 — Supabase Dashboard (côté Supabase)

1. Va sur https://supabase.com/dashboard/project/olmhckwethdcxhvsrfie
2. **Authentication** → **Providers**
3. Trouve **Apple** dans la liste → **Edit**
4. **Enable Sign in with Apple** : ON
5. Remplis :
   - **Service ID** : `com.trajetpro.app.signin` (ce que tu as créé étape 1.2)
   - **Team ID** : `J7K8L9MNOP` (ce que tu as trouvé étape 1.4)
   - **Key ID** : `ABC123XYZ4` (étape 1.3)
   - **Private Key** : ouvre le fichier `.p8` dans un éditeur texte → copie le **contenu complet** (de `-----BEGIN PRIVATE KEY-----` jusqu'à `-----END PRIVATE KEY-----` inclus) → colle-le dans le champ
6. **Save**

---

## Étape 3 — Tester

### En développement (web)

1. Lance `npm run dev`
2. Ouvre http://localhost:5173/
3. Va sur l'écran Login → clique **"Continuer avec Apple"**
4. Une popup s'ouvre vers `appleid.apple.com`
5. Connecte-toi avec ton Apple ID, autorise l'accès email + nom
6. Tu es redirigé sur l'app, connecté

⚠️ **Si tu as une erreur "invalid_client"** : c'est que tes Service ID / Team ID / Key ID dans Supabase ne correspondent pas à Apple. Re-vérifie.

⚠️ **Si tu as une erreur "redirect_uri mismatch"** : ajoute la bonne URL dans le Service ID Apple (étape 1.2 point 9).

### Sur iPhone après build (TestFlight)

L'utilisateur verra un bouton "Continuer avec Apple" sur l'écran Login. Quand il clique, iOS lance le flow natif Apple (avec Face ID / Touch ID si configuré sur l'appareil) → retour direct dans l'app, connecté.

---

## ✅ Validation finale

Pour qu'Apple App Review accepte ton app, vérifie que :
- [ ] Le bouton "Continuer avec Apple" est visible sur l'écran Login
- [ ] Le bouton respecte les guidelines Apple (noir, logo Apple, texte "Continuer avec Apple" ou "Sign in with Apple")
- [ ] Le flow fonctionne sans erreur sur device physique
- [ ] L'utilisateur peut **supprimer son compte** depuis l'app (déjà en place via `delete_my_account` RPC)

---

## 🆘 Troubleshooting

| Erreur | Cause probable | Fix |
|---|---|---|
| `invalid_client` | Service ID / Team ID / Key ID mal renseigné dans Supabase | Re-vérifier les 3 valeurs |
| `redirect_uri mismatch` | URL `…/auth/v1/callback` pas dans le Service ID Apple | Ajouter dans étape 1.2 |
| Popup s'ouvre puis ferme sans rien | Bloqueur de popup actif | Autoriser les popups pour `localhost`/`trajetpro.fr` |
| `private_key invalid` | Le `.p8` n'a pas été copié intégralement | Re-copier de `-----BEGIN` à `-----END` inclus |
| Boucle infinie de redirect | Multiple callback URLs configurées | Garder une seule URL : `https://olmhckwethdcxhvsrfie.supabase.co/auth/v1/callback` |

---

## 💡 Pour la version v1.1 — UX iOS native

Pour l'instant le code utilise le **flow OAuth web** (popup vers `appleid.apple.com`). Sur iPhone ça marche dans la WebView Capacitor, mais c'est moins beau qu'un vrai bouton natif.

Pour une UX Apple parfaite, à ajouter en v1.1 :

```bash
npm install @capacitor-community/apple-sign-in --legacy-peer-deps
npx cap sync ios
```

Et remplacer dans App.jsx l'appel `sbSignInWithApple()` par le plugin natif si `isNativePlatform()` (le code actuel reste utilisé en fallback pour le web).

Pas urgent pour la v1.0 — le flow web actuel passe la review Apple. À optimiser après.
