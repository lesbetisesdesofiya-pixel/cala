-- KalanPath — schéma Supabase (Postgres) calqué sur data.json
-- À coller dans Supabase Dashboard > SQL Editor. Idempotent (IF NOT EXISTS).
-- Auth : Supabase Auth (recommandé : OTP SMS au numéro de l'élève). Le PIN local
-- ne doit JAMAIS partir en clair : on ne stocke que son hash (pgcrypto).

create extension if not exists "pgcrypto";

-- ============ PROFILS (1 ligne = 1 élève, liée à auth.users) ============
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  prenom text not null,
  nom text not null default '',
  classe text default 'Terminale D',
  serie text default 'Terminale D',
  onboarding_termine boolean not null default false, -- true quand "Terminer" (onboarding) a été cliqué
  lycee text default '',
  ecole text default '',
  semestre text default 'Semestre 1',
  email text default '',
  avatar text default '',
  formule text not null default 'Gratuite',          -- Gratuite | Premium
  moyenne_actuelle numeric(4,1) not null default 0,  -- ex 12.4
  moyenne_cible numeric(4,1) not null default 14.0,  -- ex 14.0
  pin_hash text,                                     -- crypt(pin, gen_salt('bf')), jamais le PIN clair
  langue text default 'Français (FR)',
  devise text default 'XOF',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============ MATIÈRES ============
create table if not exists matieres (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  nom text not null,                                 -- ex Mathématiques
  coef int not null default 1 check (coef between 1 and 12),
  moyenne numeric(4,1) not null default 10,
  nb_devoirs int not null default 0,
  icon text default 'menu_book',                     -- nom Material Symbol
  groupe text default 'Tronc commun',
  checked boolean default true,                      -- sélection onboarding
  created_at timestamptz default now()
);
create index if not exists matieres_user_idx on matieres(user_id);

-- ============ NOTES / ÉVALUATIONS (= data.json notes + evolution.historique) ============
create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  matiere_id uuid references matieres(id) on delete set null,
  matiere_nom text not null,                         -- dénormalisé pour l'historique
  type text not null default 'DS'
    check (type in ('DS','IE','TP','DM','EXPOSE')),
  titre text not null,
  note numeric(4,1) not null check (note between 0 and 20),
  coef numeric(4,2) not null default 1,
  evalue_le date,
  created_at timestamptz default now()
);
create index if not exists notes_user_idx on notes(user_id, evalue_le desc);

-- ============ DEVOIRS / ÉCHÉANCES ============
create table if not exists devoirs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  matiere_id uuid references matieres(id) on delete set null,
  matiere_nom text not null,
  titre text not null,
  description text default '',
  date_limite timestamptz,
  priorite text default 'Normale',                   -- Faible | Normale | Haute
  type text default 'maison',                        -- urgent | expose | maison | termine
  statut text default 'todo' check (statut in ('todo','done')),
  created_at timestamptz default now()
);
create index if not exists devoirs_user_idx on devoirs(user_id, date_limite);

-- ============ TRANSACTIONS BUDGET (montants entiers en FCFA) ============
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  titre text not null,
  categorie text default '',
  detail text default '',
  montant int not null,                              -- +entrée / -dépense, en FCFA
  icon text default 'payments',
  recurrent boolean default false,
  operateur text default '',                         -- Wave | Orange | MTN | Moov
  effectue_le date default current_date,
  created_at timestamptz default now()
);
create index if not exists transactions_user_idx on transactions(user_id, effectue_le desc);

-- ============ OBJECTIFS + PLAN D'ACTION ============
create table if not exists objectifs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  actuel numeric(4,1) not null,
  cible numeric(4,1) not null,
  faisabilite int default 0,
  created_at timestamptz default now()
);
create table if not exists objectif_items (
  id uuid primary key default gen_random_uuid(),
  objectif_id uuid not null references objectifs(id) on delete cascade,
  matiere_nom text not null,
  action text not null,
  gain text default '',                              -- ex +0,4 pt
  created_at timestamptz default now()
);

-- ============ SÉCURITÉ : RLS (chaque élève ne voit que ses lignes) ============
alter table profiles enable row level security;
alter table matieres enable row level security;
alter table notes enable row level security;
alter table devoirs enable row level security;
alter table transactions enable row level security;
alter table objectifs enable row level security;
alter table objectif_items enable row level security;

-- profiles : lecture/écriture de sa propre ligne
drop policy if exists "profiles_own" on profiles;
create policy "profiles_own" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- helper : les items d'objectif appartiennent à l'élève via objectifs.user_id
drop policy if exists "matieres_own" on matieres;
create policy "matieres_own" on matieres
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "notes_own" on notes;
create policy "notes_own" on notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "devoirs_own" on devoirs;
create policy "devoirs_own" on devoirs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "transactions_own" on transactions;
create policy "transactions_own" on transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "objectifs_own" on objectifs;
create policy "objectifs_own" on objectifs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "objectif_items_own" on objectif_items;
create policy "objectif_items_own" on objectif_items
  for all
  using (exists (select 1 from objectifs o where o.id = objectif_id and o.user_id = auth.uid()))
  with check (exists (select 1 from objectifs o where o.id = objectif_id and o.user_id = auth.uid()));

-- ============ updated_at auto ============
create or replace function touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end; $$ language plpgsql;
drop trigger if exists trg_profiles_touch on profiles;
create trigger trg_profiles_touch before update on profiles
  for each row execute function touch_updated_at();

-- ============ Évolution : colonnes utilisées par la SPA ============
alter table profiles add column if not exists phone text;
alter table matieres add column if not exists groupe text;

-- ============ ABONNEMENTS (paywall : pas d'offre gratuite) ============
create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  plan text not null default 'mensuel',              -- mensuel (1000 FCFA / 30 jours)
  amount int not null default 1000,                  -- montant en FCFA
  operator text default '',                          -- Wave | Orange | MTN | Moov
  phone text default '',                             -- numéro Mobile Money débité
  ref text unique not null,                          -- référence opérateur (KP-<timestamp>)
  status text not null default 'pending'
    check (status in ('pending','active','expired','failed')),
  started_at timestamptz,
  expires_at timestamptz,                            -- fin des 30 jours
  created_at timestamptz default now()
);
create index if not exists subscriptions_user_idx on subscriptions(user_id, status, expires_at desc);

alter table subscriptions enable row level security;
drop policy if exists "subscriptions_own" on subscriptions;
create policy "subscriptions_own" on subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Lecture seule : l'activation se fait via le webhook (service_role), jamais côté client.
-- Helper utilisé par la SPA pour le paywall :
create or replace function has_active_subscription(p_user uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from subscriptions
    where user_id = p_user and status = 'active'
      and expires_at is not null and expires_at > now()
  );
$$;

-- ============ Types d'évaluation : 3 leviers uniquement (Interrogation / DS / Composition) ============
alter table notes drop constraint if exists notes_type_check;
update notes set type = 'IE' where type in ('DM', 'TP');
update notes set type = 'DS' where type = 'EXPOSE';
alter table notes add constraint notes_type_check check (type in ('IE', 'DS', 'COMPO'));

-- ============ Difficulté ressentie + notes cibles (feuille de route) ============
alter table matieres add column if not exists difficulte int default 3 check (difficulte between 1 and 5);
create table if not exists cibles_matieres (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  matiere_id uuid references matieres(id) on delete cascade,
  matiere_nom text not null,
  cible_ie numeric(4,1),
  cible_ds numeric(4,1),
  cible_compo numeric(4,1),
  updated_at timestamptz default now(),
  unique(user_id, matiere_id)
);
create index if not exists cibles_user_idx on cibles_matieres(user_id);
alter table cibles_matieres enable row level security;
drop policy if exists "cibles_own" on cibles_matieres;
create policy "cibles_own" on cibles_matieres
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============ Base de progression feuille de route (% atteint) ============
alter table cibles_matieres add column if not exists base_moy numeric(4,1);

-- ============ Moyenne à NULL quand sans notes (fini les valeurs périmées) ============
alter table matieres alter column moyenne drop not null;

-- ============ Dates DS / composition (hybride provisoire avant, 0 après) ============
alter table matieres add column if not exists date_ds date;
alter table matieres add column if not exists date_compo date;

-- ============ DURCISSEMENT AUDIT : paywall + anti-bruteforce + fuite RLS ============
-- 1. has_active_subscription n'écoute plus le paramètre (fuite comblée).
create or replace function has_active_subscription(p_user uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from subscriptions
    where user_id = auth.uid() and status = 'active'
      and expires_at is not null and expires_at > now()
  );
$$;

-- 2. INSERT payants exigent un abonnement actif (lecture/MAJ/suppression inchangées).
-- Rejouable : on DROP d'abord toutes les policies (anciennes ET nouvelles).
drop policy if exists "matieres_own" on matieres;
drop policy if exists "matieres_read" on matieres;
drop policy if exists "matieres_upd" on matieres;
drop policy if exists "matieres_del" on matieres;
drop policy if exists "matieres_ins" on matieres;
create policy "matieres_read" on matieres for select using (auth.uid() = user_id);
create policy "matieres_upd" on matieres for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "matieres_del" on matieres for delete using (auth.uid() = user_id);
create policy "matieres_ins" on matieres for insert with check (auth.uid() = user_id);
-- NOTE setup : création de matières autorisée sans abonnement (obligatoire avant paywall) ;
-- notes/devoirs/transactions/objectifs/cibles restent sous abonnement.

drop policy if exists "notes_own" on notes;
drop policy if exists "notes_read" on notes;
drop policy if exists "notes_upd" on notes;
drop policy if exists "notes_del" on notes;
drop policy if exists "notes_ins" on notes;
create policy "notes_read" on notes for select using (auth.uid() = user_id);
create policy "notes_upd" on notes for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "notes_del" on notes for delete using (auth.uid() = user_id);
create policy "notes_ins" on notes for insert with check (auth.uid() = user_id and has_active_subscription(auth.uid()));

drop policy if exists "devoirs_own" on devoirs;
drop policy if exists "devoirs_read" on devoirs;
drop policy if exists "devoirs_upd" on devoirs;
drop policy if exists "devoirs_del" on devoirs;
drop policy if exists "devoirs_ins" on devoirs;
create policy "devoirs_read" on devoirs for select using (auth.uid() = user_id);
create policy "devoirs_upd" on devoirs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "devoirs_del" on devoirs for delete using (auth.uid() = user_id);
create policy "devoirs_ins" on devoirs for insert with check (auth.uid() = user_id and has_active_subscription(auth.uid()));

drop policy if exists "transactions_own" on transactions;
drop policy if exists "transactions_read" on transactions;
drop policy if exists "transactions_upd" on transactions;
drop policy if exists "transactions_del" on transactions;
drop policy if exists "transactions_ins" on transactions;
create policy "transactions_read" on transactions for select using (auth.uid() = user_id);
create policy "transactions_upd" on transactions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "transactions_del" on transactions for delete using (auth.uid() = user_id);
create policy "transactions_ins" on transactions for insert with check (auth.uid() = user_id and has_active_subscription(auth.uid()));

drop policy if exists "objectifs_own" on objectifs;
drop policy if exists "objectifs_read" on objectifs;
drop policy if exists "objectifs_upd" on objectifs;
drop policy if exists "objectifs_del" on objectifs;
drop policy if exists "objectifs_ins" on objectifs;
create policy "objectifs_read" on objectifs for select using (auth.uid() = user_id);
create policy "objectifs_upd" on objectifs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "objectifs_del" on objectifs for delete using (auth.uid() = user_id);
create policy "objectifs_ins" on objectifs for insert with check (auth.uid() = user_id and has_active_subscription(auth.uid()));

drop policy if exists "cibles_own" on cibles_matieres;
drop policy if exists "cibles_read" on cibles_matieres;
drop policy if exists "cibles_upd" on cibles_matieres;
drop policy if exists "cibles_del" on cibles_matieres;
drop policy if exists "cibles_ins" on cibles_matieres;
create policy "cibles_read" on cibles_matieres for select using (auth.uid() = user_id);
create policy "cibles_upd" on cibles_matieres for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "cibles_del" on cibles_matieres for delete using (auth.uid() = user_id);
create policy "cibles_ins" on cibles_matieres for insert with check (auth.uid() = user_id and has_active_subscription(auth.uid()));

drop policy if exists "objectif_items_own" on objectif_items;
drop policy if exists "objectif_items_read" on objectif_items;
drop policy if exists "objectif_items_upd" on objectif_items;
drop policy if exists "objectif_items_del" on objectif_items;
drop policy if exists "objectif_items_ins" on objectif_items;
create policy "objectif_items_read" on objectif_items for select
  using (exists (select 1 from objectifs o where o.id = objectif_id and o.user_id = auth.uid()));
create policy "objectif_items_upd" on objectif_items for update
  using (exists (select 1 from objectifs o where o.id = objectif_id and o.user_id = auth.uid()))
  with check (exists (select 1 from objectifs o where o.id = objectif_id and o.user_id = auth.uid()));
create policy "objectif_items_del" on objectif_items for delete
  using (exists (select 1 from objectifs o where o.id = objectif_id and o.user_id = auth.uid()));
create policy "objectif_items_ins" on objectif_items for insert
  with check (exists (select 1 from objectifs o where o.id = objectif_id and o.user_id = auth.uid()) and has_active_subscription(auth.uid()));

-- 3. Abonnements : le client peut demander (pending) et lire, JAMAIS s'activer seul.
drop policy if exists "subscriptions_own" on subscriptions;
drop policy if exists "subscriptions_read" on subscriptions;
drop policy if exists "subscriptions_req" on subscriptions;
create policy "subscriptions_read" on subscriptions for select using (auth.uid() = user_id);
create policy "subscriptions_req" on subscriptions for insert with check (auth.uid() = user_id and status = 'pending');

-- 4. Anti-bruteforce PIN : compteur + verrou temporisé.
alter table profiles add column if not exists failed_pin_attempts int default 0;
alter table profiles add column if not exists pin_locked_until timestamptz;

-- ============ Échéance d'objectif (compte à rebours feuille de route) ============
alter table objectifs add column if not exists echeance date;

-- ============ Période scolaire + portée objectif + trimestre des notes ============
-- À jouer une fois sur une base existante (inclus dans le CREATE TABLE pour fresh install).
alter table profiles add column if not exists regime text default 'Trimestre';
alter table profiles add column if not exists periode text default 'Trimestre 1';
alter table profiles add column if not exists objectif_portee text default 'annuel'
  check (objectif_portee in ('annuel', 'trimestre'));

-- ============ CODES PROMO (attribution parrainage, prix unique 1000 F) ============
-- Plus de remise : le code ne change pas le prix, il crédite l'affilié.
-- Parrainage par lien : ?ref=CODE au register -> profiles.ref_code ->
-- mf-pay rattache la souscription (best-effort, jamais bloquant).
create table if not exists promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  montant int not null default 500,
  max_uses int,
  used_count int not null default 0,
  expires_at timestamptz,
  actif boolean not null default true,
  created_at timestamptz default now()
);
create table if not exists promo_uses (
  id uuid primary key default gen_random_uuid(),
  code_id uuid not null references promo_codes(id) on delete cascade,
  user_id uuid not null,
  subscription_id uuid references subscriptions(id) on delete set null,
  created_at timestamptz default now(),
  unique(code_id, user_id)
);
alter table subscriptions add column if not exists promo_code_id uuid references promo_codes(id) on delete set null;
-- Code parrain du filleul (lien ?ref=), utilisé par mf-pay pour l'attribution.
alter table profiles add column if not exists ref_code text;
alter table promo_codes enable row level security;
alter table promo_uses enable row level security;
-- Pas de policy client : seul le service_role (fonctions mf-*) lit et écrit.
-- Incrément du compteur (quotas approximatifs en cas d'activations concurrentes).
create or replace function promo_consume(p_code uuid)
returns void language sql security definer as
$$ update promo_codes set used_count = used_count + 1 where id = p_code $$;
-- Exemple (à adapter) : insert into promo_codes(code, montant, max_uses, expires_at)
-- values ('AFFICHE2026', 500, 500, now() + interval '90 days');

-- ============ LIVRES (bibliothèque par classe, images en git) ============
-- Les images vivent dans react/public/livres/{dossier}/ (couverture + p01.jpg...).
-- Une seule table suffit : les pages se déduisent de dossier + nb_pages.
-- Convention : react/public/livres/<classe>/<livre>/cover.jpg + p01.jpg...pNN.jpg
create table if not exists livres (
  id uuid primary key default gen_random_uuid(),
  classe text not null,
  matiere text not null,
  titre text not null,
  dossier text unique not null,
  couverture text,
  nb_pages int not null default 0,
  ordre int not null default 0,
  created_at timestamptz default now()
);
-- Flag admin (gestion abonnements + livres via /admin). Posé à la main :
-- update profiles set is_admin = true where phone = '+228...';
alter table profiles add column if not exists is_admin boolean not null default false;
alter table livres enable row level security;
drop policy if exists "livres_read_sub" on livres;
create policy "livres_read_sub" on livres for select using (has_active_subscription(auth.uid()));
drop policy if exists "livres_admin_all" on livres;
create policy "livres_admin_all" on livres for all using (
  exists (select 1 from profiles where id = auth.uid() and is_admin = true)
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_admin = true)
);
-- Abonnements : lecture + écriture pour l'admin (prolonger +30j / résilier).
drop policy if exists "subscriptions_admin_all" on subscriptions;
create policy "subscriptions_admin_all" on subscriptions for all using (
  exists (select 1 from profiles where id = auth.uid() and is_admin = true)
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_admin = true)
);

-- ============ AFFILIATION ============
-- Un affilié = un compte auth + code promo à 6 chiffres (commission 25 % = 250 F).
-- Commission : commission_pct % du 1er paiement du filleul, une seule fois
-- (le code étant à usage unique par élève, les renouvellements ne rapportent pas).
-- Retraits : l'affilié demande (aff-withdraw) -> ligne payouts 'pending' ->
-- le worker VPS (IP fixe whitelistée chez MoneyFusion) initie le versement ->
-- webhook mf-payout-webhook finalise. Frais 2,5 % déduits du montant demandé.
-- Solde = sum(gains) - sum(retraits non annulés).
create table if not exists affiliates (
  id uuid primary key,
  code_promo text unique not null,
  prenom text,
  nom text,
  phone text unique,
  payout_phone text,
  payout_mode text,
  created_at timestamptz default now()
);
alter table promo_codes add column if not exists affiliate_id uuid references affiliates(id) on delete set null;
alter table promo_codes add column if not exists commission_pct int not null default 20;
create table if not exists affiliate_earnings (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references affiliates(id) on delete cascade,
  subscription_id uuid not null unique references subscriptions(id) on delete cascade,
  filleul_user_id uuid not null,
  amount int not null,
  pct int not null,
  created_at timestamptz default now()
);
create table if not exists payouts (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references affiliates(id) on delete cascade,
  amount int not null,
  frais int not null,
  net int not null,
  phone text not null,
  mode text not null,
  country text not null default 'tg',
  tokenpay text,
  status text not null default 'pending',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table affiliates enable row level security;
-- Responsable marketing : chaque affilié peut être rattaché à un manager
-- (lien de recrutement ?m=CODE). Gains manager : 50 F par filleul payé +
-- bonus 500 F quand un affilié de son équipe atteint 10 filleuls payés.
alter table affiliates add column if not exists manager_id uuid references affiliates(id) on delete set null;
create table if not exists manager_earnings (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references affiliates(id) on delete cascade,
  affiliate_id uuid references affiliates(id) on delete set null,
  subscription_id uuid unique references subscriptions(id) on delete cascade,
  filleul_user_id uuid,
  amount int not null,
  kind text not null default 'filleul',
  created_at timestamptz default now()
);
alter table manager_earnings enable row level security;
-- Pas de policy client : lecture via aff-dashboard (service_role).
drop policy if exists "affiliates_own_read" on affiliates;
create policy "affiliates_own_read" on affiliates for select using (auth.uid() = id);
drop policy if exists "affiliates_own_upd" on affiliates;
create policy "affiliates_own_upd" on affiliates for update using (auth.uid() = id) with check (auth.uid() = id);
alter table affiliate_earnings enable row level security;
alter table payouts enable row level security;
-- Pas de policy client sur earnings/payouts : lecture via edge functions.
alter table notes add column if not exists trimestre text;
-- Backfill : les notes existantes vont à la période 1 du régime de l'élève.
update notes n set trimestre = (
  select case when p.regime = 'Semestre' then 'Semestre 1' else 'Trimestre 1' end
  from profiles p where p.id = n.user_id
) where n.trimestre is null;
-- Plans figés par période : un plan T1 et un plan T2 coexistent.
alter table cibles_matieres add column if not exists periode text;
update cibles_matieres c set periode = (
  select case when p.regime = 'Semestre' then 'Semestre 1' else 'Trimestre 1' end
  from profiles p where p.id = c.user_id
) where c.periode is null;
alter table cibles_matieres drop constraint if exists cibles_matieres_user_id_matiere_id_key;
-- Idempotent : si une exécution précédente a déjà créé la contrainte (ou l'index
-- équivalent), on ne la recrée pas (erreur 42P07 "relation already exists").
do $$
begin
  if not exists (
    select 1 from pg_class
    where relname = 'cibles_matieres_user_period_mat_unique'
      and relkind in ('i', 'c')
  ) then
    alter table cibles_matieres add constraint cibles_matieres_user_period_mat_unique
      unique nulls not distinct (user_id, matiere_id, periode);
  end if;
end $$;

-- ============ Onboarding terminé (flag anti-retour feuille de route) ============
-- À jouer une fois sur une base existante (inclus dans le CREATE TABLE ci-dessus pour les fresh install).
alter table profiles add column if not exists onboarding_termine boolean not null default false;
-- Backfill : a dépassé l'onboarding s'il a une ligne d'objectif (écran d'après "Terminer").
update profiles p set onboarding_termine = true
where exists (select 1 from objectifs o where o.user_id = p.id);

-- ============ VÉRIFICATIONS WHATSAPP (SUPPRIMÉ) ============
-- Logique WhatsApp abandonnée (connexion = numéro + mot de passe).
-- Fonctions wa-auth / wa-inbound supprimées du serveur, secret retiré.
-- Sur une base existante, jouer une fois :
--   drop table if exists verifications;
