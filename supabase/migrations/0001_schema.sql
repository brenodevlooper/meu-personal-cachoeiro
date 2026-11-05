-- =====================================================================
-- Meu Personal Cachoeiro — schema, regras de acesso (RLS) e funções
-- Rodar no Supabase: SQL Editor → colar este arquivo → Run.
-- Depois rodar 0002_storage.sql e seed.sql.
--
-- Princípios:
--  * RLS ligado em TODAS as tabelas; nada é público por padrão.
--  * O aluno só lê/escreve o que é dele. O personal lê tudo.
--  * O aluno NÃO consegue mudar o próprio papel, o nível validado nem a
--    liberação do PAR-Q: essas colunas não têm GRANT e só mudam por
--    funções do personal (validar_aluno, liberar_parq).
--  * A flag "marcou sim no PAR-Q" e o nível sugerido são calculados no
--    banco (trigger), não no celular.
-- =====================================================================

-- ---------- catálogo ----------
create table public.gyms (
  id          text primary key check (id ~ '^[a-z0-9_-]{2,40}$'),
  nome        text not null check (length(nome) between 2 and 80),
  sub         text not null default '',
  unidades    text[] not null default '{}',
  sem         text[] not null default '{}',      -- aparelhos (eq) que a academia NÃO tem
  zonas       jsonb  not null default '{}',      -- zona -> onde fica naquela academia
  ativo       boolean not null default true,
  ordem       int not null default 0,
  created_at  timestamptz not null default now()
);

create table public.exercises (
  id          text primary key check (id ~ '^[a-z0-9_]{2,40}$'),
  nome        text not null,
  grupo       text not null default '',
  zona        text not null,                     -- maq_inf, maq_sup, polia, livre, smith, solo
  eq          text not null,                     -- aparelho usado
  icone       text not null default 'leg' check (icone in ('leg','push','pull','core')),
  alt         text references public.exercises(id),  -- troca se a academia não tiver o aparelho
  dicas       text[] not null default '{}',
  video_url   text,                              -- vídeo de execução (um só pra todas as academias)
  ativo       boolean not null default true
);

create table public.exercise_locations (
  exercise_id text not null references public.exercises(id) on delete cascade,
  gym_id      text not null references public.gyms(id) on delete cascade,
  video_url   text,                              -- vídeo "onde fica" gravado naquela academia
  descricao   text,                              -- sobrescreve a zona da academia, se preenchido
  primary key (exercise_id, gym_id)
);

-- ---------- pessoas ----------
create table public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  role             text not null default 'aluno' check (role in ('aluno','personal')),
  nome             text not null default '' check (length(nome) <= 80),
  whatsapp         text not null default '' check (whatsapp ~ '^[0-9]{0,15}$'),
  nascimento       date,                         -- só 18+ (trigger profiles_before_write)
  cref             text check (length(cref) <= 30), -- só faz sentido para o personal; aparece no treino validado
  termos_aceitos_em timestamptz,
  objetivo         text check (objetivo in ('hipertrofia','emagrecimento','saude','forca')),
  dias             int check (dias between 2 and 6),
  limites          text[] not null default '{}',
  quiz             jsonb not null default '{}',
  nivel_quiz       text check (nivel_quiz in ('iniciante','intermediario','avancado')),
  nivel_validado   text check (nivel_validado in ('iniciante','intermediario','avancado')),
  validado_por     uuid references public.profiles(id),
  validado_em      timestamptz,
  gym_id           text references public.gyms(id),
  unidade          text,
  onboarding_ok    boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint limites_validos check (limites <@ array['joelho','lombar','ombro']::text[])
);

-- PAR-Q: dado de saúde (LGPD art. 11). Cada envio é um registro (histórico).
create table public.health_screenings (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  respostas        jsonb not null,              -- {"0":false,"1":true,...}
  tem_sim          boolean not null default false,   -- calculado no trigger
  consentimento_em timestamptz not null,        -- aceite específico para dado de saúde
  liberado         boolean not null default false,   -- calculado / mudado só pelo personal
  liberado_por     uuid references public.profiles(id),
  liberado_em      timestamptz,
  obs              text,
  created_at       timestamptz not null default now()
);

create table public.workout_logs (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles(id) on delete cascade,
  treino             text not null check (length(treino) <= 40),
  foco               text not null default '',
  gym_id             text references public.gyms(id),
  exercicios_feitos  int not null default 0 check (exercicios_feitos between 0 and 30),
  exercicios_total   int not null default 0 check (exercicios_total between 0 and 30),
  duracao_min        int check (duracao_min between 0 and 600),
  rpe                int not null check (rpe between 1 and 5),
  series             jsonb not null default '[]',  -- [{ex, carga:[..], feitas}]
  created_at         timestamptz not null default now()
);

create table public.weights (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kg         numeric(5,1) not null check (kg > 20 and kg < 300),
  created_at timestamptz not null default now()
);

-- "Minha academia não está aqui" → vira lead pro personal
create table public.gym_requests (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles(id) on delete set null,
  texto      text not null check (length(texto) between 2 and 200),
  status     text not null default 'novo' check (status in ('novo','agendado','mapeado','descartado')),
  created_at timestamptz not null default now()
);

create index on public.workout_logs (user_id, created_at desc);
create index on public.weights (user_id, created_at desc);
create index on public.health_screenings (user_id, created_at desc);

-- ---------- helpers ----------
create or replace function public.is_personal()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'personal');
$$;

-- nível sugerido a partir do quiz (6 perguntas, 0–2 pontos cada)
create or replace function public.nivel_do_quiz(q jsonb)
returns text language sql immutable as $$
  with p as (
    select coalesce(sum(least(greatest((v)::int, 0), 2)), 0) as pts
    from jsonb_each_text(coalesce(q, '{}'::jsonb)) as e(k, v)
    where v ~ '^[0-9]+$'
  )
  select case when pts <= 4 then 'iniciante' when pts <= 8 then 'intermediario' else 'avancado' end from p;
$$;

-- cria o perfil no cadastro (sempre como aluno)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nome, whatsapp, nascimento, termos_aceitos_em)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data->>'nome', ''), 80),
    left(regexp_replace(coalesce(new.raw_user_meta_data->>'whatsapp', ''), '\D', '', 'g'), 15),
    nullif(new.raw_user_meta_data->>'nascimento', '')::date,   -- menor de 18 → o cadastro falha aqui
    case when new.raw_user_meta_data->>'termos' = 'true' then now() end
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- perfil: recalcula nível sugerido e carimba updated_at
create or replace function public.profiles_before_write()
returns trigger language plpgsql as $$
begin
  if new.nascimento is not null and new.nascimento > (current_date - interval '18 years')::date then
    raise exception 'O app é só para maiores de 18 anos.' using errcode = '22023';
  end if;
  new.nivel_quiz := case when new.quiz = '{}'::jsonb then null else public.nivel_do_quiz(new.quiz) end;
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_before_write
  before insert or update on public.profiles
  for each row execute function public.profiles_before_write();

-- PAR-Q: o banco decide se tem "sim" e se já nasce liberado
create or replace function public.screening_before_insert()
returns trigger language plpgsql as $$
begin
  new.tem_sim := exists (select 1 from jsonb_each(new.respostas) e where e.value = 'true'::jsonb);
  new.liberado := not new.tem_sim;
  new.liberado_por := null;
  new.liberado_em := null;
  new.obs := null;
  return new;
end $$;

create trigger screening_before_insert
  before insert on public.health_screenings
  for each row execute function public.screening_before_insert();

-- ---------- funções do personal ----------
create or replace function public.validar_aluno(aluno uuid, nivel text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_personal() then raise exception 'sem permissão' using errcode = '42501'; end if;
  if nivel not in ('iniciante','intermediario','avancado') then raise exception 'nível inválido'; end if;
  update public.profiles
     set nivel_validado = nivel, validado_por = auth.uid(), validado_em = now()
   where id = aluno and role = 'aluno';
end $$;

create or replace function public.liberar_parq(screening uuid, observacao text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_personal() then raise exception 'sem permissão' using errcode = '42501'; end if;
  update public.health_screenings
     set liberado = true, liberado_por = auth.uid(), liberado_em = now(), obs = left(observacao, 500)
   where id = screening;
end $$;

-- LGPD: retirar o consentimento de saúde apaga o PAR-Q e as limitações.
-- Sem PAR-Q o treino volta a ficar bloqueado até responder de novo.
create or replace function public.retirar_consentimento_saude()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'não autenticado' using errcode = '42501'; end if;
  delete from public.health_screenings where user_id = auth.uid();
  update public.profiles set limites = '{}' where id = auth.uid();
end $$;

-- LGPD: o próprio aluno apaga a conta e tudo que é dele (cascade)
create or replace function public.excluir_minha_conta()
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'não autenticado' using errcode = '42501'; end if;
  delete from auth.users where id = auth.uid();
end $$;

-- ---------- equipe (nome, CREF e WhatsApp dos personais) ----------
-- View sem security_invoker de propósito: o aluno não lê a tabela profiles
-- de outra pessoa, mas precisa ver quem validou o treino dele. Só colunas públicas.
create or replace view public.equipe as
select id, nome, cref, whatsapp from public.profiles where role = 'personal';

-- ---------- painel ----------
create or replace view public.painel_alunos with (security_invoker = true) as
select
  p.id, p.nome, p.whatsapp, p.gym_id, p.unidade, p.dias, p.objetivo, p.limites,
  p.nivel_quiz, p.nivel_validado, p.onboarding_ok, p.created_at,
  w.ultimo_treino,
  coalesce(w.treinos_28d, 0) as treinos_28d,
  coalesce(w.treinos_total, 0) as treinos_total,
  s.id as parq_id, s.tem_sim as parq_sim, s.liberado as parq_liberado
from public.profiles p
left join lateral (
  select max(created_at) as ultimo_treino,
         count(*) filter (where created_at > now() - interval '28 days') as treinos_28d,
         count(*) as treinos_total
  from public.workout_logs where user_id = p.id
) w on true
left join lateral (
  select id, tem_sim, liberado from public.health_screenings
  where user_id = p.id order by created_at desc limit 1
) s on true
where p.role = 'aluno';

-- ---------- RLS ----------
alter table public.gyms               enable row level security;
alter table public.exercises          enable row level security;
alter table public.exercise_locations enable row level security;
alter table public.profiles           enable row level security;
alter table public.health_screenings  enable row level security;
alter table public.workout_logs       enable row level security;
alter table public.weights            enable row level security;
alter table public.gym_requests       enable row level security;

-- catálogo: qualquer um lê o que está ativo; personal lê e escreve tudo
create policy gyms_read   on public.gyms for select using (ativo or public.is_personal());
create policy gyms_write  on public.gyms for all to authenticated using (public.is_personal()) with check (public.is_personal());
create policy ex_read     on public.exercises for select using (ativo or public.is_personal());
create policy ex_write    on public.exercises for all to authenticated using (public.is_personal()) with check (public.is_personal());
create policy loc_read    on public.exercise_locations for select using (true);
create policy loc_write   on public.exercise_locations for all to authenticated using (public.is_personal()) with check (public.is_personal());

-- perfil
create policy prof_read   on public.profiles for select to authenticated using (id = auth.uid() or public.is_personal());
create policy prof_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- PAR-Q
create policy hs_read     on public.health_screenings for select to authenticated using (user_id = auth.uid() or public.is_personal());
create policy hs_insert   on public.health_screenings for insert to authenticated with check (user_id = auth.uid());

-- treinos e peso
create policy wl_read     on public.workout_logs for select to authenticated using (user_id = auth.uid() or public.is_personal());
create policy wl_insert   on public.workout_logs for insert to authenticated with check (user_id = auth.uid());
create policy wl_delete   on public.workout_logs for delete to authenticated using (user_id = auth.uid());
create policy wt_read     on public.weights for select to authenticated using (user_id = auth.uid() or public.is_personal());
create policy wt_insert   on public.weights for insert to authenticated with check (user_id = auth.uid());
create policy wt_delete   on public.weights for delete to authenticated using (user_id = auth.uid());

-- pedidos de mapeamento
create policy gr_insert   on public.gym_requests for insert to authenticated with check (user_id = auth.uid());
create policy gr_read     on public.gym_requests for select to authenticated using (user_id = auth.uid() or public.is_personal());
create policy gr_update   on public.gym_requests for update to authenticated using (public.is_personal()) with check (public.is_personal());

-- ---------- GRANTs por coluna (a 2ª trava, além do RLS) ----------
revoke all on all tables in schema public from anon, authenticated;

grant select on public.gyms, public.exercises, public.exercise_locations to anon, authenticated;
grant insert, update, delete on public.gyms, public.exercises, public.exercise_locations to authenticated;

grant select on public.profiles to authenticated;
-- o aluno edita só estas colunas; role / nivel_validado / validado_* ficam de fora
grant update (nome, whatsapp, nascimento, cref, termos_aceitos_em, objetivo, dias, limites, quiz,
              gym_id, unidade, onboarding_ok) on public.profiles to authenticated;
grant select on public.equipe to authenticated;

grant select on public.health_screenings to authenticated;
grant insert (user_id, respostas, consentimento_em) on public.health_screenings to authenticated;

grant select, delete on public.workout_logs, public.weights to authenticated;
grant insert (user_id, treino, foco, gym_id, exercicios_feitos, exercicios_total, duracao_min, rpe, series)
  on public.workout_logs to authenticated;
grant insert (user_id, kg) on public.weights to authenticated;

grant select on public.gym_requests to authenticated;
grant insert (user_id, texto) on public.gym_requests to authenticated;
grant update (status) on public.gym_requests to authenticated;

grant select on public.painel_alunos to authenticated;

revoke execute on all functions in schema public from public, anon;
-- anon precisa de is_personal() porque a política de leitura do catálogo a chama (devolve false)
grant execute on function public.is_personal() to anon;
grant execute on function public.is_personal(), public.nivel_do_quiz(jsonb),
  public.validar_aluno(uuid, text), public.liberar_parq(uuid, text),
  public.retirar_consentimento_saude(), public.excluir_minha_conta() to authenticated;
