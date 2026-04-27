# 🔌 Phase 4 détaillée pour grand débutant — Brancher l'app à Supabase

> **Pour qui ?** Toi qui as terminé les Phases 2 et 3.
>
> **Durée réelle :** 4 à 6 heures étalées sur 3-4 jours
>
> **Niveau de difficulté :** ⚠️⚠️⚠️ (le plus technique jusqu'ici)
>
> **Vérité honnête :** c'est la phase la plus compliquée pour un non-développeur. Tu vas devoir modifier beaucoup de code. Si tu ne te sens pas à l'aise, **c'est ici que je recommande fortement de déléguer à un freelance pour 500-1500 €** (brief déjà fourni dans `brief_freelance_trajetpro.md`).
>
> **Si tu veux essayer seul, je te donne TOUT ce qu'il faut** : le code complet à copier-coller, pas juste des explications.

---

## 🎓 Avant de commencer : comprendre ce qu'on va faire

Imagine que ton app actuelle est un **bloc-notes Post-it** : tu écris des choses dessus, mais si tu perds le Post-it (ou si tu fermes l'app), tout disparaît.

**Ce qu'on va faire :** remplacer chaque Post-it par une **écriture dans ta base de données Supabase**. Résultat : les données survivent, se synchronisent entre téléphones, etc.

**Concrètement, on a besoin de :**
1. **Installer une "librairie"** (Supabase JS) qui permet à ton code de parler à Supabase
2. **Configurer les clés** d'accès à ton projet Supabase
3. **Remplacer les `useState` par des vraies requêtes** Supabase (une dizaine d'endroits dans le code)

---

## 📋 Ce que tu dois avoir avant de commencer

Vérifie que tu as bien tout ça :

- [ ] Un ordinateur (Mac, Windows ou Linux)
- [ ] Le fichier `trajetpro_app.jsx` (que je t'ai fourni)
- [ ] Node.js installé (on le vérifiera)
- [ ] VS Code installé (éditeur de code gratuit)
- [ ] Les infos Supabase sauvegardées (URL + Anon Key)
- [ ] Une connexion internet

---

## 📅 Plan d'attaque en 4 jours

**Jour 1 (1h30)** — Installer les outils + créer le projet React
**Jour 2 (2h)** — Configurer Supabase + brancher l'authentification
**Jour 3 (2h)** — Migrer les données (bookings, invoices, tokens)
**Jour 4 (1h)** — Tester sur 2 téléphones

---

# 📆 JOUR 1 — Installer les outils + créer le projet (1h30)

## Étape 1 — Installer Node.js

Node.js est le moteur qui permet de faire tourner du code JavaScript sur ton ordinateur.

### Sur Mac

1. Va sur **`nodejs.org`**
2. Clique sur le gros bouton **"LTS"** (Long Term Support - la version stable)
3. Le fichier `.pkg` se télécharge
4. Double-clique pour l'ouvrir
5. Suis les étapes d'installation (clique "Continuer" partout)
6. Entre le mot de passe de ton Mac si demandé
7. **Vérification :** ouvre le Terminal et tape `node -v`. Tu dois voir `v20.x.x` ou plus.

### Sur Windows

1. Va sur **`nodejs.org`**
2. Clique sur **"LTS"**
3. Exécute le fichier `.msi` téléchargé
4. Suis les étapes (accepte tout, coche "Automatically install necessary tools")
5. **Vérification :** ouvre PowerShell et tape `node -v`.

## Étape 2 — Installer VS Code

VS Code, c'est l'éditeur gratuit de Microsoft pour écrire du code.

1. Va sur **`code.visualstudio.com`**
2. Clique **"Download for Windows"** ou **"Download for Mac"**
3. Installe normalement

## Étape 3 — Créer le dossier du projet

1. Dans le Terminal (Mac) ou PowerShell (Windows), tape :

   **Mac :**
   ```bash
   cd ~/Documents
   mkdir trajetpro-app
   cd trajetpro-app
   ```

   **Windows :**
   ```powershell
   cd $HOME\Documents
   mkdir trajetpro-app
   cd trajetpro-app
   ```

2. Crée un projet Vite (un outil qui compile l'app React) :
   ```bash
   npm create vite@latest . -- --template react
   ```

   Quand il demande :
   - **Package name** : accepte le nom par défaut
   - **Framework** : React
   - **Variant** : JavaScript (pas TypeScript pour simplifier)

3. Installe les dépendances :
   ```bash
   npm install
   ```

   Ça télécharge ~200 Mo de fichiers. Prends un café ☕

4. Teste que ça fonctionne :
   ```bash
   npm run dev
   ```

   Tu dois voir un message qui dit "Local: http://localhost:5173/". Ouvre cette URL dans ton navigateur → tu vois une page avec le logo de Vite qui tourne.

5. Arrête le serveur : dans le Terminal, appuie sur **Ctrl+C**.

## Étape 4 — Installer les librairies TrajetPro

Maintenant on va installer tout ce dont ton app a besoin.

Dans le Terminal (toujours dans `trajetpro-app`), tape une par une :

```bash
npm install @supabase/supabase-js
npm install lucide-react
npm install @capacitor/core @capacitor/cli
npm install @capacitor/ios @capacitor/android
npm install @capacitor/app @capacitor/preferences @capacitor/network
```

Chaque commande prend 30 sec à 2 min.

## Étape 5 — Copier le code TrajetPro

1. Ouvre **VS Code**
2. **Fichier → Ouvrir un dossier** → sélectionne `trajetpro-app`
3. Dans l'arborescence à gauche, navigue vers `src/App.jsx`
4. **Ouvre ce fichier** et **efface tout son contenu**
5. **Colle le contenu** de `trajetpro_app.jsx` que je t'ai fourni (3600 lignes)
6. **Sauvegarde** (Ctrl+S / Cmd+S)

7. Ouvre le fichier `src/main.jsx`, vérifie qu'il contient :
   ```jsx
   import { StrictMode } from 'react'
   import { createRoot } from 'react-dom/client'
   import App from './App.jsx'
   import './index.css'

   createRoot(document.getElementById('root')).render(
     <StrictMode>
       <App />
     </StrictMode>
   )
   ```

8. Teste :
   ```bash
   npm run dev
   ```
   Ouvre `http://localhost:5173` → tu dois voir ton app TrajetPro qui fonctionne !

**Fin du Jour 1.** Prends une pause. 💆

---

# 📆 JOUR 2 — Configurer Supabase + Auth (2h)

## Étape 6 — Créer le fichier de configuration Supabase

1. Dans VS Code, à la racine du projet `trajetpro-app`, crée un nouveau fichier :
   - Clic droit dans l'arborescence de gauche → **"New File"**
   - Nomme-le **`.env`** (oui, avec le point au début)

2. Colle dedans :
   ```
   VITE_SUPABASE_URL=https://XXXXX.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```

3. **Remplace** :
   - `https://XXXXX.supabase.co` par ton **Project URL** (sauvegardé en Phase 2)
   - `eyJ...` par ton **Anon Key**

4. **Très important :** crée aussi un fichier **`.gitignore`** à la racine et ajoute :
   ```
   .env
   node_modules/
   dist/
   ```

   Ça empêche de publier ces fichiers sur internet par erreur.

## Étape 7 — Créer le fichier helper Supabase

1. Dans VS Code, dans le dossier `src/`, crée un nouveau dossier **`lib`**
2. Dans `src/lib/`, crée un fichier **`supabase.js`**
3. Colle le code suivant :

```javascript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// Helper : récupérer l'utilisateur connecté
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  return profile;
}

// Helper : vérifier si un email est jetable (appel SQL)
export async function isDisposableEmail(email) {
  const { data } = await supabase.rpc('is_disposable_email', { p_email: email });
  return data === true;
}

// Helper : vérifier un SIRET via l'Edge Function
export async function verifySiret(siret) {
  const { data, error } = await supabase.functions.invoke('verify-siret', {
    body: { siret },
  });
  if (error) return { valid: false, reason: error.message };
  return data;
}
```

4. **Sauvegarde.**

## Étape 8 — Modifier l'App.jsx pour utiliser Supabase

⚠️ **Attention : c'est la partie la plus longue.** Je te donne les modifications à faire, une par une. Prends ton temps.

### 8.1 — Ajouter l'import Supabase

Ouvre `src/App.jsx`. En haut du fichier, après les imports existants, ajoute :

```javascript
import { supabase, getCurrentUser, isDisposableEmail, verifySiret } from './lib/supabase';
```

### 8.2 — Remplacer la fonction d'inscription

Cherche dans le code la fonction `handleInitialSubmit` (dans le composant `SignupScreen`). Elle est autour de la ligne 2385.

**Remplace-la entièrement** par cette nouvelle version qui parle à Supabase :

```javascript
const handleInitialSubmit = async () => {
  setError("");

  // Validations locales (comme avant)
  if (!form.name) { setError("Votre nom est requis"); return; }
  if (!form.email || !/\S+@\S+\.\S+/.test(form.email)) { setError("Email invalide"); return; }
  if (!isValidSiret(form.siret)) { setError("SIRET invalide (14 chiffres)"); return; }
  if (form.password.length < 8) { setError("Mot de passe : 8 caractères minimum"); return; }
  if (!form.acceptTerms) { setError("Vous devez accepter les CGU"); return; }

  setLoading(true);

  try {
    // 1. Vérifier si l'email est jetable
    const disposable = await isDisposableEmail(form.email);
    if (disposable) {
      setError("Les emails jetables ne sont pas autorisés. Utilisez votre email professionnel.");
      setLoading(false);
      return;
    }

    // 2. Vérifier le SIRET via INSEE
    const siretCheck = await verifySiret(form.siret);
    if (!siretCheck.valid) {
      setError("SIRET invalide : " + siretCheck.reason);
      setLoading(false);
      return;
    }

    // 3. Vérifier que cet appareil n'a pas déjà un compte
    const fingerprint = generateDeviceFingerprint();
    const { data: existingDevice } = await supabase
      .from('device_fingerprints')
      .select('*')
      .eq('fingerprint', fingerprint)
      .single();

    if (existingDevice && existingDevice.accounts_count >= 1) {
      setLoading(false);
      onDeviceAlreadyUsed(existingDevice);
      return;
    }

    // 4. Créer le compte via Supabase Auth (envoie l'email de confirmation)
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          name: form.name,
          phone: form.phone,
          siret: form.siret,
        },
      },
    });

    if (authError) {
      if (authError.message.includes('already registered')) {
        setError("Cet email est déjà associé à un compte. Connectez-vous.");
      } else {
        setError("Erreur lors de l'inscription : " + authError.message);
      }
      setLoading(false);
      return;
    }

    // 5. Créer le profil utilisateur dans la table users
    const referralCode = generateReferralCode(form.name);
    const { error: profileError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        email: form.email,
        name: form.name,
        phone: form.phone || null,
        siret: form.siret,
        company_name: siretCheck.company_name,
        referral_code: referralCode,
        referred_by: form.referralCode.trim() || null,
        email_verified: false,
        siret_verified: true,
        device_fingerprint: fingerprint,
        token_balance: 0, // Crédits donnés après vérification email
      });

    if (profileError) {
      setError("Erreur création profil : " + profileError.message);
      setLoading(false);
      return;
    }

    // 6. Enregistrer l'appareil dans la table device_fingerprints
    await supabase.from('device_fingerprints').upsert({
      fingerprint: fingerprint,
      user_id: authData.user.id,
      first_seen: new Date().toISOString(),
      last_seen: new Date().toISOString(),
      accounts_count: 1,
    });

    // 7. Passer à l'écran "Email envoyé"
    setPendingUser({
      id: authData.user.id,
      email: form.email,
      name: form.name,
      referralCode,
    });
    setStep("email_sent");
    setLoading(false);

  } catch (err) {
    setError("Erreur technique : " + err.message);
    setLoading(false);
  }
};
```

### 8.3 — Remplacer la fonction de connexion

Cherche la fonction `submit` dans le composant `LoginScreen` (autour de la ligne 2290).

**Remplace-la par :**

```javascript
const submit = async () => {
  setError("");
  if (!email || !password) { setError("Email et mot de passe requis"); return; }

  setLoading(true);
  try {
    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (loginError) {
      if (loginError.message.includes('Invalid login')) {
        setError("Email ou mot de passe incorrect");
      } else if (loginError.message.includes('not confirmed')) {
        setError("Veuillez d'abord confirmer votre email (regardez votre boîte mail)");
      } else {
        setError("Erreur : " + loginError.message);
      }
      setLoading(false);
      return;
    }

    // Récupérer le profil complet
    const profile = await getCurrentUser();

    if (!profile) {
      setError("Profil introuvable. Contactez le support.");
      setLoading(false);
      return;
    }

    // Attribuer le bonus mensuel si dû (appel à la fonction SQL)
    await supabase.rpc('credit_monthly_bonus', { p_user_id: profile.id });

    // Refresh le profil pour avoir le nouveau solde
    const updatedProfile = await getCurrentUser();

    onLogin(updatedProfile);
    setLoading(false);

  } catch (err) {
    setError("Erreur technique : " + err.message);
    setLoading(false);
  }
};
```

### 8.4 — Modifier la récupération des données au démarrage

Dans le composant `App` (tout en bas du fichier, autour de la ligne 3240), **remplace** les états initiaux par :

```javascript
// États de l'app
const [authScreen, setAuthScreen] = useState("welcome");
const [currentUser, setCurrentUser] = useState(null);
const [isGuest, setIsGuest] = useState(false);

const [tab, setTab] = useState("home");
const [bookings, setBookings] = useState([]);
const [invoices, setInvoices] = useState([]);
const [tokenBalance, setTokenBalance] = useState(0);
const [tokenHistory, setTokenHistory] = useState([]);

// ... autres états inchangés ...

// ⭐ NOUVEAU : vérifier si l'utilisateur est déjà connecté au démarrage
useEffect(() => {
  async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const profile = await getCurrentUser();
      if (profile) {
        setCurrentUser(profile);
        setTokenBalance(profile.token_balance);
        setAuthScreen(null);
        await loadUserData(profile.id);
      }
    }
  }
  checkSession();

  // Écouter les changements de session
  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_OUT') {
      setCurrentUser(null);
      setAuthScreen("welcome");
    }
  });

  return () => subscription.unsubscribe();
}, []);

// ⭐ Charger les données de l'utilisateur depuis Supabase
async function loadUserData(userId) {
  // Charger les bookings
  const { data: bookingsData } = await supabase
    .from('bookings')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('pickup_datetime', { ascending: true });

  if (bookingsData) {
    setBookings(bookingsData.map(b => ({
      id: b.id,
      customerName: b.customer_name,
      phone: b.customer_phone,
      pickupAddress: b.pickup_address,
      dropoffAddress: b.dropoff_address,
      dateTime: b.pickup_datetime,
      passengers: b.passengers,
      hasLuggage: b.has_luggage,
      price: Number(b.price_ttc),
      distance: Number(b.distance_km || 0),
      duration: b.duration_min || 0,
      notes: b.notes || "",
      status: b.status,
      type: b.type,
      createdAt: b.created_at,
    })));
  }

  // Charger les invoices
  const { data: invoicesData } = await supabase
    .from('invoices')
    .select('*')
    .eq('user_id', userId)
    .order('issued_at', { ascending: false });

  if (invoicesData) {
    setInvoices(invoicesData.map(i => ({
      id: i.id,
      number: i.invoice_number,
      bookingId: i.booking_id,
      customerName: i.customer_name,
      amount: Number(i.amount_ttc),
      vatAmount: Number(i.amount_vat),
      date: i.issued_at,
      status: i.status,
      fingerprint: i.fingerprint,
    })));
  }

  // Charger l'historique des tokens
  const { data: tokensData } = await supabase
    .from('token_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (tokensData) {
    setTokenHistory(tokensData.filter(t => t.tokens_delta > 0).map(t => ({
      id: t.id,
      invoiceNumber: t.invoice_number || (t.kind === 'welcome' ? 'OFFERT' : t.kind === 'referral_bonus' ? 'PARRAIN' : 'BONUS'),
      date: t.created_at.slice(0, 10),
      package: t.package_id || (t.kind === 'welcome' ? 'Bienvenue' : t.kind === 'monthly_bonus' ? 'Fidélité' : 'Bonus'),
      tokens: t.tokens_delta,
      priceTTC: Number(t.amount_ttc || 0),
      priceHT: Number(t.amount_ht || 0),
      vatAmount: Number(t.amount_vat || 0),
      vatApplied: t.vat_applied || false,
      vatIntra: t.vat_intra || "",
      paymentMethod: t.payment_method || "Offert",
      isWelcome: t.kind !== 'purchase',
    })));
  }
}
```

### 8.5 — Modifier la création d'un bon de course

Cherche la fonction `onSaveBooking` (autour de la ligne 3340).

**Remplace-la par :**

```javascript
const onSaveBooking = async (b) => {
  if (!currentUser) {
    alert("Vous devez être connecté");
    return;
  }

  const isNew = !bookings.find(p => p.id === b.id);

  // Vérifier les crédits si nouveau
  if (isNew && tokenBalance < COST_BOOKING) {
    setFormOpen(false);
    setPendingActionLabel("créer ce bon de course");
    setInsufficientOpen(true);
    return;
  }

  try {
    if (isNew) {
      // Créer le bon
      const { data, error } = await supabase
        .from('bookings')
        .insert({
          user_id: currentUser.id,
          customer_name: b.customerName,
          customer_phone: b.phone || null,
          pickup_address: b.pickupAddress,
          dropoff_address: b.dropoffAddress,
          pickup_datetime: b.dateTime,
          passengers: b.passengers,
          has_luggage: b.hasLuggage,
          distance_km: b.distance,
          duration_min: b.duration,
          price_ttc: b.price,
          notes: b.notes || null,
          type: b.type,
          status: 'confirmed',
        })
        .select()
        .single();

      if (error) {
        alert("Erreur : " + error.message);
        return;
      }

      // Décrémenter 1 crédit via la fonction SQL
      const { data: consumed } = await supabase.rpc('consume_tokens', {
        p_user_id: currentUser.id,
        p_amount: COST_BOOKING,
        p_kind: 'consume_booking',
        p_related_id: data.id,
      });

      if (!consumed) {
        alert("Crédits insuffisants");
        return;
      }

      // Mettre à jour localement
      setTokenBalance(t => t - COST_BOOKING);
      setBookings(prev => [{
        id: data.id,
        customerName: data.customer_name,
        phone: data.customer_phone,
        pickupAddress: data.pickup_address,
        dropoffAddress: data.dropoff_address,
        dateTime: data.pickup_datetime,
        passengers: data.passengers,
        hasLuggage: data.has_luggage,
        price: Number(data.price_ttc),
        distance: Number(data.distance_km || 0),
        duration: data.duration_min || 0,
        notes: data.notes || "",
        status: data.status,
        type: data.type,
        createdAt: data.created_at,
      }, ...prev]);

    } else {
      // Modifier un bon existant (gratuit)
      const { error } = await supabase
        .from('bookings')
        .update({
          customer_name: b.customerName,
          customer_phone: b.phone || null,
          pickup_address: b.pickupAddress,
          dropoff_address: b.dropoffAddress,
          pickup_datetime: b.dateTime,
          passengers: b.passengers,
          has_luggage: b.hasLuggage,
          distance_km: b.distance,
          duration_min: b.duration,
          price_ttc: b.price,
          notes: b.notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', b.id);

      if (error) {
        alert("Erreur : " + error.message);
        return;
      }

      setBookings(prev => prev.map(p => p.id === b.id ? b : p));
    }

    setFormOpen(false);
    setFormInitial(null);
    setTab("bookings");

  } catch (err) {
    alert("Erreur technique : " + err.message);
  }
};
```

### 8.6 — Faire de même pour la suppression et la facturation

Je te donne les versions Supabase des autres fonctions critiques :

**`onDeleteBooking` :**
```javascript
const onDeleteBooking = async (b) => {
  if (!confirm(`Supprimer le bon pour ${b.customerName} ?`)) return;

  const { error } = await supabase
    .from('bookings')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', b.id);

  if (error) {
    alert("Erreur : " + error.message);
    return;
  }

  setBookings(prev => prev.filter(p => p.id !== b.id));
  setDetailBooking(null);
};
```

**`onInvoiceBooking` :**
```javascript
const onInvoiceBooking = async (b) => {
  if (tokenBalance < COST_INVOICE) {
    setPendingActionLabel("émettre cette facture");
    setInsufficientOpen(true);
    return;
  }

  // Calculer le prochain numéro de facture
  const { data: lastInvoice } = await supabase
    .from('invoices')
    .select('invoice_number')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  let nextNum = 1;
  if (lastInvoice) {
    const match = lastInvoice.invoice_number.match(/(\d+)$/);
    if (match) nextNum = parseInt(match[1]) + 1;
  }

  const nextNumber = `FAC-2026-${String(nextNum).padStart(4, '0')}`;
  const fingerprint = genFingerprint();
  const vatAmount = +(b.price * 0.10 / 1.10).toFixed(2);

  const { data, error } = await supabase
    .from('invoices')
    .insert({
      user_id: currentUser.id,
      booking_id: b.id,
      invoice_number: nextNumber,
      customer_name: b.customerName,
      amount_ht: b.price - vatAmount,
      amount_vat: vatAmount,
      amount_ttc: b.price,
      vat_rate: 10,
      status: 'pending',
      fingerprint: fingerprint,
    })
    .select()
    .single();

  if (error) {
    alert("Erreur facture : " + error.message);
    return;
  }

  // Consommer le crédit
  await supabase.rpc('consume_tokens', {
    p_user_id: currentUser.id,
    p_amount: COST_INVOICE,
    p_kind: 'consume_invoice',
    p_related_id: data.id,
  });

  setTokenBalance(t => t - COST_INVOICE);
  setInvoices(prev => [{
    id: data.id,
    number: data.invoice_number,
    bookingId: data.booking_id,
    customerName: data.customer_name,
    amount: Number(data.amount_ttc),
    vatAmount: Number(data.amount_vat),
    date: data.issued_at,
    status: data.status,
    fingerprint: data.fingerprint,
  }, ...prev]);

  setDetailBooking(null);
  setTab("home");
  setDetailInvoice({
    id: data.id,
    number: data.invoice_number,
    bookingId: data.booking_id,
    customerName: data.customer_name,
    amount: Number(data.amount_ttc),
    vatAmount: Number(data.amount_vat),
    date: data.issued_at,
    status: data.status,
    fingerprint: data.fingerprint,
  });
};
```

### 8.7 — Déconnexion

**`onLogout` :**
```javascript
const onLogout = async () => {
  if (isGuest) {
    setAuthScreen("signup");
    return;
  }
  if (!confirm("Vous déconnecter ?")) return;

  await supabase.auth.signOut();

  setCurrentUser(null);
  setIsGuest(false);
  setAuthScreen("welcome");
  setTokenBalance(0);
  setTokenHistory([]);
  setBookings([]);
  setInvoices([]);
  setTab("home");
};
```

---

## Étape 9 — Tester tout ça

1. Sauvegarde tous les fichiers
2. Dans le Terminal :
   ```bash
   npm run dev
   ```
3. Ouvre `http://localhost:5173`
4. Essaye :
   - Créer un compte avec ton vrai email
   - Vérifier que tu reçois bien l'email de confirmation
   - Cliquer sur le lien dans l'email
   - Te reconnecter avec l'email confirmé
   - Créer un bon de course → vérifier qu'il apparaît dans la table `bookings` sur Supabase
   - Émettre une facture → vérifier dans la table `invoices`

**Si tout marche : tu es un HÉROS.** 🏆

---

# 📆 JOUR 3 — Migrer les données restantes (2h)

À ce stade, les fonctions principales marchent. Reste à brancher :
- Le parrainage
- L'achat de crédits (ça viendra en Phase 5 avec Stripe)
- La mise à jour du profil

**Je te laisse les détails de ces modifications pour plus tard** — elles suivent exactement la même logique que ce qu'on vient de faire. Quand tu seras à cette étape, reviens me voir avec ton code et je t'accompagnerai sur les dernières modifs.

---

# 📆 JOUR 4 — Tests sur 2 téléphones (1h)

L'objectif : **prouver que la synchronisation fonctionne entre appareils**.

1. Sur ton ordinateur : `npm run dev`, crée un compte avec l'email A
2. Crée 3 bons de course
3. Sur ton téléphone : ouvre `http://TON_IP:5173` (ton IP locale, affichée dans le Terminal)
4. Connecte-toi avec l'email A
5. **Tu dois voir les 3 bons que tu as créés sur l'ordinateur**
6. Crée un 4e bon sur le téléphone
7. Retourne sur l'ordinateur, rafraîchis la page
8. **Tu vois les 4 bons**

**Si oui → la synchronisation fonctionne. Bravo !** 🎉

---

## 🚨 Dépannage

### "npm install" échoue

**Solution :** vérifie que Node.js est bien installé (`node -v`). Essaye `npm cache clean --force` puis réinstalle.

### "Failed to fetch" dans la console du navigateur

**Cause :** tes clés Supabase sont mauvaises ou ton projet Supabase est en pause (plan gratuit = pause après 7 jours d'inactivité).

**Solution :** vérifie les clés dans `.env`, et réveille ton projet Supabase en te connectant.

### "Row violates row-level security policy"

**Cause :** l'utilisateur essaie d'accéder à des données qui ne sont pas les siennes (bug dans ton code).

**Solution :** vérifie que tu fais bien les requêtes avec le bon `user_id`.

### "Je suis perdu, rien ne marche"

**C'est normal.** Cette phase est VRAIMENT difficile. Tu as 3 options :

**Option 1 :** fais-toi aider par un développeur ami (même 2h de pair programming débloquent énormément)

**Option 2 :** délègue cette phase à un freelance (500-1000 € sur Malt)

**Option 3 :** reviens me voir avec un message d'erreur précis et ton code, je t'aiderai ligne par ligne.

---

## 🎓 Ce que tu as appris (énorme !)

- **Installer Node.js et VS Code**
- **Créer un projet React avec Vite**
- **Utiliser un fichier `.env`** pour les secrets
- **Utiliser une librairie externe** (Supabase JS)
- **Faire des requêtes SELECT/INSERT/UPDATE** en JavaScript
- **Gérer l'authentification** (signup, login, logout)
- **Synchroniser des données entre appareils**

**Si tu as complété cette phase, tu as littéralement acquis les compétences d'un junior développeur.** Sérieusement.

**Phase 4 complète. La suite : Stripe pour monétiser !** 💰
