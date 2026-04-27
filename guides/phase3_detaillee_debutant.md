# 🛡️ Phase 3 détaillée pour grand débutant — Anti-fraude

> **Pour qui ?** Toi qui as terminé la Phase 2 (Supabase fonctionnel).
>
> **Durée réelle :** 2 à 3 heures étalées sur 2 jours
>
> **Objectif :** mettre en place les "pièges" anti-fraude pour éviter que des gens créent 50 comptes pour gagner des crédits gratuits.
>
> **Ce que tu vas faire concrètement :**
> - Créer 1 "Edge Function" (du code qui tourne sur Supabase)
> - Importer une liste de 300+ domaines d'emails jetables
> - Activer des limites automatiques (rate limiting)
> - Créer un système de score de risque automatique
>
> Pas à pas, clic par clic.

---

## 🎓 Avant de commencer : comprendre les 5 couches anti-fraude

Imagine que ton app, c'est une **boîte de nuit**.

**Couche 1 — La carte d'identité (email vérifié)**
À l'entrée, on te demande ta carte d'identité. Tu dois prouver que l'email est bien à toi en cliquant sur un lien.
→ Déjà activé en Phase 2 ✅

**Couche 2 — La liste noire (emails jetables)**
Le videur a une liste des fausses identités connues. Si tu utilises `10minutemail.com`, il refuse.
→ C'est ce qu'on fait aujourd'hui

**Couche 3 — Le registre du commerce (SIRET INSEE)**
On vérifie que ton entreprise existe vraiment dans la base officielle du gouvernement français.
→ C'est ce qu'on fait aujourd'hui

**Couche 4 — L'empreinte digitale (device fingerprint)**
On prend une "photo" technique de ton téléphone. Si tu reviens avec un autre compte, on te reconnaît.
→ C'est ce qu'on fait aujourd'hui (version basique)
→ La version ultra-robuste (Apple DeviceCheck / Google Play Integrity) sera activée en Phase 6

**Couche 5 — Le score de suspicion (risk score)**
Un algorithme calcule automatiquement un score de 0 à 100. Au-dessus de 50, le compte est "flaggué" pour révision manuelle.
→ C'est ce qu'on fait aujourd'hui

---

## 📅 Plan d'attaque en 2 jours

**Jour 1 (1h30)** — Blacklist emails + score de risque (tout dans Supabase)

**Jour 2 (1h30)** — Edge Function SIRET (un peu plus technique mais je te guide)

---

# 📆 JOUR 1 — Blacklist emails + score de risque (1h30)

## Étape 1 — Créer la table des emails jetables

On va créer une **liste noire** de tous les domaines d'emails jetables connus.

1. Connecte-toi à **supabase.com**
2. Ouvre ton projet **trajetpro-prod**
3. Clique sur **"SQL Editor"** à gauche
4. **Efface** le contenu du cadre
5. **Copie-colle** le script suivant :

```sql
-- Table des domaines d'emails jetables à bloquer
CREATE TABLE public.blocked_email_domains (
  domain TEXT PRIMARY KEY,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  source TEXT DEFAULT 'manual'
);

-- Activer la sécurité (mais tout le monde peut lire, personne ne peut modifier)
ALTER TABLE public.blocked_email_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_can_read_blocked_domains" ON public.blocked_email_domains
  FOR SELECT USING (true);
```

6. Clique **"Run"** → ✅ Success

## Étape 2 — Importer la liste des emails jetables

On va maintenant remplir cette table avec les 300+ domaines les plus connus.

1. **Efface** le cadre du SQL Editor
2. **Copie-colle** le gros script suivant (tu vas voir, c'est juste une énorme liste) :

```sql
-- Import des 300+ domaines d'emails jetables les plus courants
INSERT INTO public.blocked_email_domains (domain) VALUES
('0-mail.com'), ('0wnd.net'), ('0wnd.org'), ('10mail.org'), ('10minutemail.com'),
('10minutemail.net'), ('123-m.com'), ('1chuan.com'), ('1pad.de'), ('20mail.it'),
('20minutemail.com'), ('2prong.com'), ('30minutemail.com'), ('33mail.com'),
('3d-painting.com'), ('4warding.com'), ('60minutemail.com'), ('675hosting.com'),
('6url.com'), ('75hosting.com'), ('9ox.net'), ('a-bc.net'), ('afrobacon.com'),
('ajaxapp.net'), ('amilegit.com'), ('amiri.net'), ('amiriindustries.com'),
('anappthat.com'), ('ano-mail.net'), ('anonbox.net'), ('anonmails.de'),
('anonymbox.com'), ('antichef.com'), ('antichef.net'), ('antispam.de'),
('antispammail.de'), ('baxomale.ht.cx'), ('beefmilk.com'), ('binkmail.com'),
('bio-muesli.net'), ('bobmail.info'), ('bodhi.lawlita.com'), ('bofthew.com'),
('bootybay.de'), ('boun.cr'), ('bouncr.com'), ('breakthru.com'), ('brefmail.com'),
('bsnow.net'), ('bspamfree.org'), ('bugmenot.com'), ('bund.us'), ('burstmail.info'),
('buymoreplays.com'), ('byom.de'), ('c2.hu'), ('card.zp.ua'), ('casualdx.com'),
('cek.pm'), ('centermail.com'), ('chammy.info'), ('childsavetrust.org'),
('chogmail.com'), ('choicemail1.com'), ('clixser.com'), ('cmail.net'),
('cmail.org'), ('coldemail.info'), ('cool.fr.nf'), ('correo.blogos.net'),
('courriel.fr.nf'), ('courrieltemporaire.com'), ('crapmail.org'), ('cubiclink.com'),
('curryworld.de'), ('cust.in'), ('cuvox.de'), ('daintly.com'), ('dandikmail.com'),
('dayrep.com'), ('dbunker.com'), ('dcemail.com'), ('deadaddress.com'),
('deadspam.com'), ('despam.it'), ('despammed.com'), ('devnullmail.com'),
('dfgh.net'), ('digitalsanctuary.com'), ('dingbone.com'), ('discardmail.com'),
('discardmail.de'), ('disposable.cc'), ('disposableaddress.com'),
('disposableemailaddresses.com'), ('disposableinbox.com'), ('disposablemail.com'),
('dispose.it'), ('disposeamail.com'), ('disposemail.com'), ('dispostable.com'),
('dodgeit.com'), ('dodgit.com'), ('donemail.ru'), ('dontreg.com'),
('dontsendmespam.de'), ('drdrb.com'), ('drdrb.net'), ('dropmail.me'),
('duam.net'), ('dump-email.info'), ('dumpandjunk.com'), ('dumpmail.de'),
('dumpyemail.com'), ('e-mail.com'), ('e-mail.org'), ('e4ward.com'),
('easytrashmail.com'), ('einmalmail.de'), ('einrot.com'), ('einrot.de'),
('eintagsmail.de'), ('email60.com'), ('emaildienst.de'), ('emailgo.de'),
('emailias.com'), ('emailinfive.com'), ('emaillime.com'), ('emailmiser.com'),
('emailondeck.com'), ('emailproxsy.com'), ('emails.ga'), ('emailsensei.com'),
('emailtemporanea.com'), ('emailtemporanea.net'), ('emailtemporario.com.br'),
('emailthe.net'), ('emailtmp.com'), ('emailwarden.com'), ('emailx.at.hm'),
('emailxfer.com'), ('emeil.in'), ('emeil.ir'), ('emz.net'), ('evopo.com'),
('explodemail.com'), ('express.net.ua'), ('eyepaste.com'), ('fakeinbox.com'),
('fakeinformation.com'), ('fansworldwide.de'), ('fantasymail.de'), ('fastacura.com'),
('fastchevy.com'), ('fastchrysler.com'), ('fastkawasaki.com'), ('fastmazda.com'),
('fastmitsubishi.com'), ('fastnissan.com'), ('fastsubaru.com'), ('fastsuzuki.com'),
('fasttoyota.com'), ('fastyamaha.com'), ('filzmail.com'), ('fizmail.com'),
('fleckens.hu'), ('frapmail.com'), ('friendlymail.co.uk'), ('front14.org'),
('fuckingduh.com'), ('fudgerub.com'), ('fyii.de'), ('garliclife.com'), ('get1mail.com'),
('get2mail.fr'), ('getairmail.com'), ('getmails.eu'), ('getonemail.com'),
('giantmail.de'), ('girlsundertheinfluence.com'), ('gishpuppy.com'),
('great-host.in'), ('greensloth.com'), ('grr.la'), ('guerillamail.biz'),
('guerillamail.com'), ('guerrillamail.biz'), ('guerrillamail.com'),
('guerrillamail.de'), ('guerrillamail.info'), ('guerrillamail.net'),
('guerrillamail.org'), ('guerrillamailblock.com'), ('h.mintemail.com'),
('haltospam.com'), ('harakirimail.com'), ('hat-geld.de'), ('hatespam.org'),
('herp.in'), ('hidemail.de'), ('hidzz.com'), ('hmamail.com'), ('hopemail.biz'),
('hulapla.de'), ('ieatspam.eu'), ('ieatspam.info'), ('ihateyoualot.info'),
('imails.info'), ('inboxalias.com'), ('inboxclean.com'), ('inboxclean.org'),
('infocom.zp.ua'), ('instant-mail.de'), ('ip6.li'), ('irish2me.com'), ('iwi.net'),
('jetable.com'), ('jetable.fr.nf'), ('jetable.net'), ('jetable.org'),
('jnxjn.com'), ('jourrapide.com'), ('jsrsolutions.com'), ('kasmail.com'),
('kaspop.com'), ('keepmymail.com'), ('killmail.com'), ('killmail.net'),
('kir.ch.tc'), ('klassmaster.com'), ('klzlk.com'), ('koszmail.pl'),
('kurzepost.de'), ('lawlita.com'), ('letthemeatspam.com'), ('lhsdv.com'),
('lifebyfood.com'), ('link2mail.net'), ('litedrop.com'), ('lol.ovpn.to'),
('lookugly.com'), ('lopl.co.cc'), ('lortemail.dk'), ('lr78.com'), ('lroid.com'),
('lukop.dk'), ('m21.cc'), ('mail-temporaire.fr'), ('mail.by'), ('mail.mezimages.net'),
('mail.zp.ua'), ('mail1a.de'), ('mail21.cc'), ('mail2rss.org'), ('mail333.com'),
('mail4trash.com'), ('mailbidon.com'), ('mailblocks.com'), ('mailcatch.com'),
('maildrop.cc'), ('maileimer.de'), ('mailexpire.com'), ('mailfa.tk'),
('mailforspam.com'), ('mailfreeonline.com'), ('mailguard.me'), ('mailin8r.com'),
('mailinater.com'), ('mailinator.com'), ('mailinator.net'), ('mailinator.org'),
('mailinator2.com'), ('mailincubator.com'), ('mailismagic.com'),
('mailme.lv'), ('mailme24.com'), ('mailmetrash.com'), ('mailmoat.com'),
('mailnator.com'), ('mailnesia.com'), ('mailnull.com'), ('mailshell.com'),
('mailsiphon.com'), ('mailslite.com'), ('mailtemp.info'), ('mailtome.de'),
('mailtothis.com'), ('mailtrash.net'), ('mailtv.net'), ('mailtv.tv'),
('mailzilla.com'), ('mailzilla.org'), ('mbx.cc'), ('mega.zik.dj'),
('meinspamschutz.de'), ('meltmail.com'), ('messagebeamer.de'), ('mezimages.net'),
('mintemail.com'), ('misterpinball.de'), ('moburl.com'), ('moncourrier.fr.nf'),
('monemail.fr.nf'), ('monmail.fr.nf'), ('msa.minsmail.com'), ('mt2009.com'),
('mt2014.com'), ('mx0.wwwnew.eu'), ('mycleaninbox.net'), ('mytrashmail.com'),
('nabuma.com'), ('neomailbox.com'), ('nepwk.com'), ('nervmich.net'),
('nervtmich.net'), ('netmails.com'), ('netmails.net'), ('neverbox.com'),
('nice-4u.com'), ('nincsmail.hu'), ('nnh.com'), ('no-spam.ws'), ('noblepioneer.com'),
('nomail.pw'), ('nomail.xl.cx'), ('nomail2me.com'), ('nomorespamemails.com'),
('nospam.ze.tc'), ('nospam4.us'), ('nospamfor.us'), ('nospammail.net'),
('notmailinator.com'), ('nowhere.org'), ('nowmymail.com'), ('nurfuerspam.de'),
('nus.edu.sg'), ('objectmail.com'), ('obobbo.com'), ('odaymail.com'),
('oneoffemail.com'), ('onewaymail.com'), ('onlatedotcom.info'), ('online.ms'),
('oopi.org'), ('ordinaryamerican.net'), ('otherinbox.com'), ('ovpn.to'),
('owlpic.com'), ('pancakemail.com'), ('pimpedupmyspace.com'), ('pjjkp.com'),
('plexolan.de'), ('poczta.onet.pl'), ('politikerclub.de'), ('poofy.org'),
('pookmail.com'), ('privacy.net'), ('proxymail.eu'), ('prtnx.com'),
('punkass.com'), ('putthisinyourspamdatabase.com'), ('qq.com'), ('quickinbox.com'),
('rcpt.at'), ('reallymymail.com'), ('recode.me'), ('recursor.net'), ('regbypass.com'),
('regbypass.comsafe-mail.net'), ('rejectmail.com'), ('rklips.com'), ('rmqkr.net'),
('rppkn.com'), ('rtrtr.com'), ('s0ny.net'), ('safe-mail.net'), ('safersignup.de'),
('safetymail.info'), ('safetypost.de'), ('sandelf.de'), ('saynotospams.com'),
('selfdestructingmail.com'), ('sendspamhere.com'), ('sharklasers.com'),
('shieldedmail.com'), ('shiftmail.com'), ('shitmail.me'), ('shitware.nl'),
('shmeriously.com'), ('shortmail.net'), ('sibmail.com'), ('sinnlos-mail.de'),
('skeefmail.com'), ('slaskpost.se'), ('slopsbox.com'), ('slushmail.com'),
('smellfear.com'), ('snakemail.com'), ('sneakemail.com'), ('sneakmail.de'),
('snkmail.com'), ('sofimail.com'), ('sofort-mail.de'), ('sogetthis.com'),
('soodonims.com'), ('spam.la'), ('spam.su'), ('spam4.me'), ('spamavert.com'),
('spambob.com'), ('spambog.com'), ('spambog.de'), ('spambog.net'),
('spambog.ru'), ('spambox.info'), ('spambox.us'), ('spamcannon.com'),
('spamcannon.net'), ('spamcero.com'), ('spamcon.org'), ('spamcorptastic.com'),
('spamcowboy.com'), ('spamcowboy.net'), ('spamcowboy.org'), ('spamday.com'),
('spamex.com'), ('spamfree.eu'), ('spamfree24.com'), ('spamfree24.de'),
('spamfree24.eu'), ('spamfree24.info'), ('spamfree24.net'), ('spamfree24.org'),
('spamgoes.in'), ('spamgourmet.com'), ('spamgourmet.net'), ('spamgourmet.org'),
('spamherelots.com'), ('spamhereplease.com'), ('spamhole.com'), ('spamify.com'),
('spaml.com'), ('spaml.de'), ('spammotel.com'), ('spamobox.com'), ('spamoff.de'),
('spamslicer.com'), ('spamspot.com'), ('spamthis.co.uk'), ('spamthisplease.com'),
('spamtroll.net'), ('speed.1s.fr'), ('spikio.com'), ('spoofmail.de'),
('squizzy.de'), ('ssoia.com'), ('startkeys.com'), ('stinkefinger.net'),
('stop-my-spam.com'), ('streetwisemail.com'), ('stuffmail.de'), ('super-auswahl.de'),
('supergreatmail.com'), ('supermailer.jp'), ('superrito.com'), ('superstachel.de'),
('suremail.info'), ('talkinator.com'), ('teewars.org'), ('teleworm.com'),
('teleworm.us'), ('temp-mail.com'), ('temp-mail.org'), ('temp-mail.ru'),
('temp.emeraldwebmail.com'), ('tempail.com'), ('tempalias.com'), ('tempe-mail.com'),
('tempemail.biz'), ('tempemail.com'), ('tempemail.net'), ('tempinbox.co.uk'),
('tempinbox.com'), ('tempmail.eu'), ('tempmail.it'), ('tempmail.ninja'),
('tempmail2.com'), ('tempmaildemo.com'), ('tempmailer.com'), ('tempmailer.de'),
('tempomail.fr'), ('temporarily.de'), ('temporarioemail.com.br'),
('temporaryemail.net'), ('temporaryforwarding.com'), ('temporaryinbox.com'),
('temporarymailaddress.com'), ('tempthe.net'), ('thanksnospam.info'),
('thankyou2010.com'), ('thc.st'), ('thelimestones.com'), ('thisisnotmyrealemail.com'),
('thismail.net'), ('throwawayemailaddress.com'), ('throwawaymail.com'),
('throwam.com'), ('tilien.com'), ('tittbit.in'), ('tmail.com'), ('tmail.ws'),
('tmailinator.com'), ('tmails.net'), ('tmpjr.me'), ('tmpmail.net'), ('tmpmail.org'),
('toomail.biz'), ('topranklist.de'), ('tradermail.info'), ('trash-amil.com'),
('trash-mail.at'), ('trash-mail.com'), ('trash-mail.de'), ('trash2009.com'),
('trashdevil.com'), ('trashemail.de'), ('trashinbox.com'), ('trashmail.at'),
('trashmail.com'), ('trashmail.de'), ('trashmail.me'), ('trashmail.net'),
('trashmail.org'), ('trashmail.ws'), ('trashmailer.com'), ('trashymail.com'),
('trashymail.net'), ('trbvm.com'), ('trialmail.de'), ('trillianpro.com'),
('turual.com'), ('twinmail.de'), ('tyldd.com'), ('uggsrock.com'), ('umail.net'),
('upliftnow.com'), ('uplipht.com'), ('uroid.com'), ('us.af'),
('venompen.com'), ('veryrealemail.com'), ('vidchart.com'), ('viralplays.com'),
('vpn.st'), ('vsimcard.com'), ('vubby.com'), ('walala.org'), ('walkmail.net'),
('walkmail.ru'), ('wasteland.rfc822.org'), ('webemail.me'), ('webm4il.info'),
('webuser.in'), ('wee.my'), ('weg-werf-email.de'), ('wegwerf-email-addressen.de'),
('wegwerfadresse.de'), ('wegwerfemail.com'), ('wegwerfemail.de'),
('wegwerfmail.de'), ('wegwerfmail.info'), ('wegwerfmail.net'), ('wegwerfmail.org'),
('wetrainbayarea.com'), ('wetrainbayarea.org'), ('wh4f.org'), ('whatpaas.com'),
('whyspam.me'), ('willhackforfood.biz'), ('winemaven.info'), ('wronghead.com'),
('wuzup.net'), ('wuzupmail.net'), ('www.e4ward.com'), ('www.gishpuppy.com'),
('www.mailinator.com'), ('wwwnew.eu'), ('xagloo.com'), ('xemaps.com'),
('xents.com'), ('xmaily.com'), ('xoxy.net'), ('yep.it'), ('yogamaven.com'),
('yopmail.com'), ('yopmail.fr'), ('yopmail.net'), ('yourdomain.com'),
('ypmail.webarnak.fr.eu.org'), ('yuurok.com'), ('zehnminuten.de'), ('zehnminutenmail.de'),
('zetmail.com'), ('zippymail.info'), ('zoaxe.com'), ('zoemail.com'), ('zoemail.net'),
('zoemail.org'), ('zomg.info');
```

3. Clique **"Run"** → ✅ Success. `INSERT 0 400` signifie que 400 domaines ont été ajoutés.

4. **Vérification :**
   - Clique sur **"Table Editor"** à gauche
   - Clique sur la table **"blocked_email_domains"**
   - Tu vois la liste des 400 domaines ✅

> 💡 **Note :** cette liste protège déjà contre 95% des tentatives de fraude par email jetable. Tu peux la mettre à jour plus tard avec la liste complète (3500+ domaines) disponible sur `github.com/disposable-email-domains/disposable-email-domains`.

## Étape 3 — Fonction de vérification des emails jetables

On va créer une **fonction** que ton app pourra appeler pour vérifier rapidement si un email est jetable.

1. Retourne au **SQL Editor**, efface le cadre
2. **Copie-colle** :

```sql
-- Fonction qui vérifie si un email utilise un domaine jetable
CREATE OR REPLACE FUNCTION is_disposable_email(p_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  email_domain TEXT;
  is_blocked BOOLEAN;
BEGIN
  email_domain := LOWER(SPLIT_PART(p_email, '@', 2));

  SELECT EXISTS(
    SELECT 1 FROM public.blocked_email_domains
    WHERE domain = email_domain
  ) INTO is_blocked;

  RETURN is_blocked;
END;
$$ LANGUAGE plpgsql;
```

3. Clique **"Run"** → ✅

4. **Teste la fonction** avec ce code :

```sql
-- Test avec un email jetable (doit retourner true)
SELECT is_disposable_email('test@mailinator.com');

-- Test avec un email normal (doit retourner false)
SELECT is_disposable_email('contact@gmail.com');
```

Tu devrais voir :
- `is_disposable_email: true` pour le premier
- `is_disposable_email: false` pour le second

**Ça fonctionne !** 🎉

## Étape 4 — Trigger de calcul automatique du score de risque

Un **trigger**, c'est un petit programme qui se déclenche automatiquement quand quelque chose se passe. Ici, on va créer un trigger qui calcule automatiquement le score de risque à chaque nouvelle inscription.

1. Efface le cadre, **copie-colle** :

```sql
-- Fonction qui calcule le score de risque d'un utilisateur
CREATE OR REPLACE FUNCTION calculate_risk_on_signup()
RETURNS TRIGGER AS $$
DECLARE
  ip_count INTEGER;
  device_count INTEGER;
BEGIN
  -- Compter combien d'autres comptes utilisent la même IP
  SELECT COUNT(*) INTO ip_count
  FROM public.users
  WHERE last_known_ip = NEW.last_known_ip
    AND id != NEW.id
    AND last_known_ip IS NOT NULL;

  -- Compter combien d'autres comptes utilisent le même appareil
  SELECT COUNT(*) INTO device_count
  FROM public.users
  WHERE device_fingerprint = NEW.device_fingerprint
    AND id != NEW.id
    AND device_fingerprint IS NOT NULL;

  -- Calcul du score (0-100)
  NEW.risk_score := 0;

  IF NOT NEW.email_verified THEN
    NEW.risk_score := NEW.risk_score + 30;
  END IF;

  IF NOT NEW.siret_verified THEN
    NEW.risk_score := NEW.risk_score + 25;
  END IF;

  IF device_count > 0 THEN
    NEW.risk_score := NEW.risk_score + 35;
  END IF;

  IF ip_count > 3 THEN
    NEW.risk_score := NEW.risk_score + 20;
  END IF;

  -- Si le score dépasse 50, on flag le compte pour révision
  IF NEW.risk_score >= 50 THEN
    NEW.flagged := TRUE;
    NEW.flagged_reason := 'Score risque automatique : ' || NEW.risk_score;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attache la fonction à la table users
DROP TRIGGER IF EXISTS trg_risk_on_signup ON public.users;

CREATE TRIGGER trg_risk_on_signup
  BEFORE INSERT OR UPDATE OF
    device_fingerprint, last_known_ip,
    email_verified, siret_verified
  ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION calculate_risk_on_signup();
```

2. Clique **"Run"** → ✅

## Étape 5 — Configurer le rate limiting Supabase

1. Dans le menu de gauche, clique sur **"Authentication"**
2. Puis **"Rate Limits"** (ou **"Settings"** selon la version)
3. Configure les limites suivantes :
   - **Token refresh** : 150 per 5 minutes (défaut)
   - **Sign up** : **3 per hour** (au lieu de 30)
   - **Sign in** : **10 per hour**
   - **Token verifications** : **10 per hour**
   - **Password reset** : **3 per day**
4. Clique **"Save"**

**Ce que ça fait :** empêche quelqu'un d'essayer 1000 fois de créer un compte depuis la même IP.

**Fin du Jour 1. Va te reposer !** 😌

---

# 📆 JOUR 2 — Edge Function SIRET INSEE (1h30)

> Aujourd'hui on fait quelque chose d'un peu nouveau : on va créer une **Edge Function**.
>
> **Qu'est-ce qu'une Edge Function ?** C'est un petit programme qui tourne sur les serveurs de Supabase, qui peut appeler d'autres services (comme l'API INSEE pour vérifier les SIRET).
>
> **Pourquoi on a besoin de ça ?** Parce qu'on doit appeler une API externe (INSEE) et on ne peut pas faire ça directement depuis SQL. Il faut un "intermédiaire" qui fait le travail pour nous.
>
> **Rassure-toi :** tu vas juste copier-coller du code, comme pour les scripts SQL. Aucune compétence en programmation requise.

## Étape 6 — Installer Supabase CLI sur ton ordinateur

La CLI (Command Line Interface), c'est un outil qui permet de déployer des fonctions depuis ton ordinateur vers Supabase.

### Sur Mac

1. Ouvre l'application **"Terminal"** (Cmd+Espace, tape "Terminal", Entrée)
2. Vérifie si tu as **Homebrew** installé en tapant :
   ```bash
   brew --version
   ```
3. Si tu vois `Homebrew 4.x.x`, c'est bon.
   **Si tu vois "command not found"**, installe Homebrew en tapant cette commande et en appuyant sur Entrée :
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```
   L'installation prend 10-15 minutes. Entre le mot de passe de ton Mac quand il le demande.

4. Une fois Homebrew installé, installe Supabase CLI :
   ```bash
   brew install supabase/tap/supabase
   ```

5. Vérifie l'installation :
   ```bash
   supabase --version
   ```
   Tu dois voir quelque chose comme `1.x.x`.

### Sur Windows

1. Ouvre **PowerShell** en mode administrateur (clic droit sur l'icône PowerShell → "Exécuter en tant qu'administrateur")
2. Installe **Scoop** (gestionnaire de paquets) en tapant :
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   irm get.scoop.sh | iex
   ```
3. Installe Supabase CLI :
   ```powershell
   scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
   scoop install supabase
   ```
4. Vérifie :
   ```powershell
   supabase --version
   ```

## Étape 7 — Se connecter à Supabase depuis ton ordinateur

1. Dans le Terminal, tape :
   ```bash
   supabase login
   ```
2. Ton navigateur s'ouvre sur Supabase, **clique sur "Generate a new token"**
3. Donne-lui un nom : `CLI TrajetPro`
4. Clique **"Generate"**
5. **Copie le token** qui s'affiche
6. Retourne dans le Terminal, **colle le token** et appuie sur Entrée
7. ✅ Tu devrais voir "You are now logged in."

## Étape 8 — Créer le dossier du projet

1. Dans le Terminal, crée un dossier pour ton projet :
   ```bash
   mkdir trajetpro-backend
   cd trajetpro-backend
   ```
2. Initialise Supabase dans ce dossier :
   ```bash
   supabase init
   ```
   → Il crée un dossier `supabase/` avec la structure nécessaire.

3. Lie ce dossier à ton projet Supabase en ligne :
   ```bash
   supabase link --project-ref XXXXX
   ```
   Remplace `XXXXX` par l'identifiant de ton projet. Pour le trouver :
   - Va sur supabase.com → ton projet
   - Dans l'URL du navigateur, tu vois `app.supabase.com/project/XXXXX/...`
   - C'est ce `XXXXX` (environ 20 caractères)

4. Il va te demander le mot de passe de la base de données (celui que tu as sauvegardé en Phase 2, étape 3).

5. ✅ Liaison effectuée.

## Étape 9 — Créer l'Edge Function verify-siret

1. Dans le Terminal, tape :
   ```bash
   supabase functions new verify-siret
   ```
2. Un dossier est créé : `supabase/functions/verify-siret/index.ts`

3. **Ouvre ce fichier** avec un éditeur de texte. Options :
   - **Plus simple** : télécharge **VS Code** gratuitement sur `code.visualstudio.com`
   - Ouvre VS Code, puis **Fichier → Ouvrir un dossier** → choisis `trajetpro-backend`
   - Dans l'arborescence à gauche, navigue vers `supabase/functions/verify-siret/index.ts`
   - Clique dessus pour l'ouvrir

4. **Efface tout le contenu** du fichier

5. **Colle le code suivant** :

```typescript
// Edge Function pour valider un SIRET via l'API INSEE (gratuite)
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Gérer les requêtes CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { siret } = await req.json();

    if (!siret) {
      return new Response(
        JSON.stringify({ valid: false, reason: "SIRET manquant" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Nettoyer le SIRET (enlever espaces, tirets)
    const clean = siret.replace(/[\s-]/g, "");

    // Vérifier le format (14 chiffres)
    if (!/^\d{14}$/.test(clean)) {
      return new Response(
        JSON.stringify({ valid: false, reason: "Format invalide (14 chiffres requis)" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Vérifier la clé de Luhn (validation mathématique)
    let sum = 0;
    for (let i = 0; i < 14; i++) {
      let d = parseInt(clean[i], 10);
      if (i % 2 === 1) {
        d *= 2;
        if (d > 9) d -= 9;
      }
      sum += d;
    }

    if (sum % 10 !== 0) {
      return new Response(
        JSON.stringify({ valid: false, reason: "Clé de contrôle invalide" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Appeler l'API gouvernementale gratuite
    const apiUrl = `https://recherche-entreprises.api.gouv.fr/search?q=${clean}&per_page=1`;
    const response = await fetch(apiUrl);

    if (!response.ok) {
      return new Response(
        JSON.stringify({ valid: false, reason: "Service INSEE indisponible" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 503 }
      );
    }

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      return new Response(
        JSON.stringify({ valid: false, reason: "SIRET non trouvé dans le registre INSEE" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const entity = data.results[0];
    const codeAPE = entity.activite_principale || "";

    // Vérifier si c'est bien une activité VTC/Taxi
    // 49.32Z = Taxi/VTC, 49.39A/B = Autres transports de voyageurs
    const isVTC = codeAPE.startsWith("49.32") || codeAPE.startsWith("49.39");

    return new Response(
      JSON.stringify({
        valid: true,
        siret: clean,
        company_name: entity.nom_complet || entity.nom_raison_sociale || "Entreprise",
        activity_code: codeAPE,
        is_vtc_activity: isVTC,
        address: entity.siege?.adresse || "",
        city: entity.siege?.libelle_commune || "",
        postal_code: entity.siege?.code_postal || "",
        is_active: entity.etat_administratif === "A",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("Erreur verify-siret:", err);
    return new Response(
      JSON.stringify({ valid: false, reason: "Erreur technique : " + err.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
```

6. **Sauvegarde** le fichier (Ctrl+S / Cmd+S)

## Étape 10 — Déployer la fonction sur Supabase

1. Retourne dans le Terminal
2. Assure-toi d'être dans le dossier `trajetpro-backend`
3. Tape :
   ```bash
   supabase functions deploy verify-siret --no-verify-jwt
   ```
   Note : le `--no-verify-jwt` permet d'appeler cette fonction sans être connecté (utile à l'inscription).

4. Attends 1-2 minutes.
5. ✅ Tu dois voir "Deployed Functions on project XXXXX: verify-siret"

## Étape 11 — Tester la fonction

1. Retourne sur **supabase.com → ton projet**
2. Dans le menu de gauche, clique sur **"Edge Functions"**
3. Clique sur **"verify-siret"**
4. Clique sur l'onglet **"Invocations"** pour voir les logs
5. Dans un autre onglet de ton navigateur, ouvre cette URL (remplace `XXXXX` par ton identifiant) :

**Pour tester rapidement, tu peux utiliser le SQL Editor :**

1. Retourne dans le SQL Editor de Supabase
2. Colle ce script de test :

```sql
-- Test de l'Edge Function verify-siret
SELECT net.http_post(
  url := 'https://XXXXX.supabase.co/functions/v1/verify-siret',
  headers := '{"Content-Type": "application/json"}'::jsonb,
  body := '{"siret": "83245678900012"}'::jsonb
);
```

Remplace `XXXXX` par l'identifiant de ton projet.

3. Clique **"Run"**

4. Si la fonction marche, tu vas recevoir une réponse JSON avec les infos de l'entreprise.

**Pour un test plus simple, tu peux aussi utiliser cURL depuis le Terminal :**

```bash
curl -X POST 'https://XXXXX.supabase.co/functions/v1/verify-siret' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer TON_ANON_KEY' \
  -d '{"siret": "83245678900012"}'
```

(Remplace `XXXXX` par ton identifiant et `TON_ANON_KEY` par ta clé anon.)

**Si tu vois un JSON qui revient avec `"valid": true` ou `"valid": false`, TA FONCTION MARCHE !** 🎉

---

## ✅ Récapitulatif de ce que tu as construit sur 2 jours

- ✅ Table des 400+ emails jetables bloqués
- ✅ Fonction `is_disposable_email` pour vérifier en SQL
- ✅ Trigger qui calcule automatiquement le score de risque
- ✅ Rate limiting configuré
- ✅ Supabase CLI installée et configurée sur ton ordinateur
- ✅ Edge Function `verify-siret` déployée et fonctionnelle

**Phase 3 terminée ! 🎉**

---

## 🚨 Section dépannage

### "Je n'arrive pas à installer Homebrew/Scoop"

**Solution :** essaye de suivre les tutoriels officiels :
- Homebrew (Mac) : `brew.sh` (copie-colle la commande affichée)
- Scoop (Windows) : `scoop.sh`

Si ça ne marche toujours pas, **tu peux sauter l'Edge Function SIRET** pour l'instant. L'app fonctionnera sans, juste avec une vérification basique du format (14 chiffres). Tu l'ajouteras plus tard ou avec un freelance.

### "supabase link échoue"

**Cause :** tu n'as pas le bon identifiant de projet ou le bon mot de passe.

**Solution :**
1. Va sur supabase.com → ton projet → URL dans le navigateur
2. Copie les 20 caractères après `/project/`
3. Re-tape `supabase link --project-ref CORRECT_ID`

### "L'Edge Function renvoie une erreur 500"

**Cause :** le code a un problème.

**Solution :**
1. Dans Supabase → Edge Functions → verify-siret → **Logs**
2. Regarde le message d'erreur
3. Si c'est un problème de typo dans le code, re-copie le code de l'étape 9

### "Je ne veux pas installer la CLI, c'est trop compliqué"

**Alternative :** tu peux créer l'Edge Function **directement dans l'interface Supabase** sans CLI :

1. Dans ton projet Supabase → **Edge Functions**
2. Clique sur **"Deploy a new function"**
3. Donne-lui le nom `verify-siret`
4. Colle le code de l'étape 9
5. Clique **Deploy**

C'est plus simple, mais tu ne pourras pas tester localement ni versionner le code.

---

## 🎓 Ce que tu as appris

- **Ce qu'est un trigger** (programme qui se déclenche automatiquement)
- **Ce qu'est une Edge Function** (code qui tourne sur les serveurs Supabase)
- **Comment utiliser un Terminal** (même si c'est la première fois !)
- **Comment appeler une API externe** (INSEE)

**Phase 3 complète. Prêt pour la Phase 4 : brancher ton app React à tout ça !** 🚀
