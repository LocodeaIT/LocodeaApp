-- ============================================================================
-- Locodea · esquema de Proyectos y Tareas
-- PostgreSQL / Supabase
--
-- Traduce el modelo de dominio de app/src/domain/types.ts. Convenciones:
--   · snake_case en la base, camelCase en la app (traduce la capa de datos)
--   · uuid como clave primaria, generada por la base
--   · enums nativos de Postgres para los estados y prioridades
--   · jsonb para lo anidado que siempre viaja con su fila padre
--
-- Idempotente: se puede volver a ejecutar sin romper nada.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────── enums

do $$ begin create type rol             as enum ('socio', 'colaborador');                                          exception when duplicate_object then null; end $$;
do $$ begin create type estado_proyecto as enum ('activo', 'pausado', 'cerrado');                                  exception when duplicate_object then null; end $$;
do $$ begin create type estado_objetivo as enum ('pendiente', 'cumplido');                                          exception when duplicate_object then null; end $$;
do $$ begin create type estado_tarea    as enum ('pendiente', 'en_curso', 'bloqueada', 'revision', 'hecha');       exception when duplicate_object then null; end $$;
do $$ begin create type prioridad       as enum ('alta', 'media', 'baja');                                         exception when duplicate_object then null; end $$;
do $$ begin create type tipo_vista      as enum ('tablero', 'lista', 'calendario', 'gantt');                       exception when duplicate_object then null; end $$;
do $$ begin create type escala_vista    as enum ('dia', 'semana', 'mes');                                          exception when duplicate_object then null; end $$;
do $$ begin create type entidad_actividad as enum ('objetivo', 'tarea', 'semana', 'proyecto');                     exception when duplicate_object then null; end $$;
do $$ begin create type tipo_actividad  as enum ('comentario', 'cambio');                                          exception when duplicate_object then null; end $$;

-- ─────────────────────────────────────────────── miembro

create table if not exists miembro (
  id          uuid primary key default gen_random_uuid(),
  nombre      text        not null,
  iniciales   text        not null default '',
  email       text        not null default '',
  color       text        not null default '#6B6B6B',
  rol         rol         not null default 'socio',
  activo      boolean     not null default true,
  -- Enlace opcional con la cuenta de Supabase, para cuando haya login real.
  auth_uid    uuid        unique,
  creado_el   timestamptz not null default now()
);

-- ─────────────────────────────────────────────── proyecto

create table if not exists proyecto (
  id                    uuid primary key default gen_random_uuid(),
  nombre                text            not null,
  cliente               text            not null default '',
  color                 text            not null default '#6B6B6B',
  estado                estado_proyecto not null default 'activo',
  responsable_id        uuid            references miembro(id) on delete set null,
  descripcion           text            not null default '',
  fecha_inicio          date,
  fecha_fin             date,
  horas_presupuestadas  numeric(10,2),
  creado_el             timestamptz     not null default now()
);

create index if not exists proyecto_responsable_idx on proyecto(responsable_id);

-- ─────────────────────────────────────────────── semana

-- La semana es solo el contenedor temporal de los objetivos.
create table if not exists semana (
  id        uuid primary key default gen_random_uuid(),
  -- Lunes de la semana. Identifica la semana de forma única.
  inicio    date        not null unique,
  creado_el timestamptz not null default now()
);

-- ─────────────────────────────────────────────── objetivo

create table if not exists objetivo (
  id                    uuid primary key default gen_random_uuid(),
  semana_id             uuid            not null references semana(id)   on delete cascade,
  proyecto_id           uuid            references proyecto(id)          on delete set null,
  responsable_id        uuid            not null references miembro(id)  on delete cascade,
  titulo                text            not null,
  descripcion           text            not null default '',
  prioridad             prioridad       not null default 'media',
  estado                estado_objetivo not null default 'pendiente',
  orden                 integer         not null default 0,
  cumplido_el           timestamptz,
  creado_el             timestamptz     not null default now()
);

create index if not exists objetivo_semana_idx      on objetivo(semana_id);
create index if not exists objetivo_responsable_idx on objetivo(responsable_id);
create index if not exists objetivo_proyecto_idx    on objetivo(proyecto_id);

-- ─────────────────────────────────────────────── tarea

create table if not exists tarea (
  id            uuid primary key default gen_random_uuid(),
  titulo        text         not null,
  descripcion   text         not null default '',
  proyecto_id   uuid         references proyecto(id) on delete set null,
  objetivo_id   uuid         references objetivo(id) on delete set null,
  asignado_id   uuid         references miembro(id)  on delete set null,
  creado_por_id uuid         references miembro(id)  on delete set null,
  estado        estado_tarea not null default 'pendiente',
  prioridad     prioridad    not null default 'media',
  inicio        date,
  vence         date,
  -- Subtarea: las hijas se borran con su padre.
  padre_id      uuid         references tarea(id) on delete cascade,
  estimado_h    numeric(10,2),
  real_h        numeric(10,2),
  orden         integer      not null default 0,
  orden_todo    integer      not null default 0,
  mi_dia        boolean      not null default false,
  importante    boolean      not null default false,
  -- To Do personal: no cuenta para el proyecto ni para el equipo.
  personal      boolean      not null default false,
  etiquetas     text[]       not null default '{}',
  checklist     jsonb        not null default '[]'::jsonb,
  creado_el     timestamptz  not null default now(),
  completado_el timestamptz,
  constraint tarea_no_es_su_propio_padre check (padre_id is null or padre_id <> id)
);

create index if not exists tarea_proyecto_idx on tarea(proyecto_id);
create index if not exists tarea_objetivo_idx on tarea(objetivo_id);
create index if not exists tarea_asignado_idx on tarea(asignado_id);
create index if not exists tarea_padre_idx    on tarea(padre_id);
create index if not exists tarea_vence_idx    on tarea(vence) where vence is not null;

-- ─────────────────────────────────────────────── vista guardada

create table if not exists vista (
  id                uuid primary key default gen_random_uuid(),
  nombre            text         not null,
  tipo              tipo_vista   not null default 'tablero',
  -- null = vista compartida por todo el equipo.
  miembro_id        uuid         references miembro(id) on delete cascade,
  filtros           jsonb        not null default '{}'::jsonb,
  agrupar           text         not null default 'ninguno',
  ordenar           text         not null default 'orden',
  orden_desc        boolean      not null default false,
  columnas          jsonb        not null default '[]'::jsonb,
  escala            escala_vista not null default 'semana',
  es_predeterminada boolean      not null default false,
  creado_el         timestamptz  not null default now()
);

create index if not exists vista_miembro_idx on vista(miembro_id);

-- ─────────────────────────────────────────────── actividad

create table if not exists actividad (
  id         uuid primary key default gen_random_uuid(),
  entidad    entidad_actividad not null,
  entidad_id uuid              not null,
  autor_id   uuid              references miembro(id) on delete set null,
  tipo       tipo_actividad    not null default 'comentario',
  texto      text              not null default '',
  fecha      timestamptz       not null default now()
);

create index if not exists actividad_entidad_idx on actividad(entidad, entidad_id);

-- ============================================================================
-- Seguridad a nivel de fila
--
-- De momento: cualquier persona autenticada del equipo lee y escribe todo.
-- Es lo que corresponde a una herramienta interna de cuatro socios, y refleja
-- cómo funciona hoy la app (todos ven el trabajo de todos).
--
-- Cuando entren colaboradores externos o clientes, hay que endurecer esto:
-- el sitio natural es filtrar por `miembro.auth_uid = auth.uid()`.
-- ============================================================================

alter table miembro   enable row level security;
alter table proyecto  enable row level security;
alter table semana    enable row level security;
alter table objetivo  enable row level security;
alter table tarea     enable row level security;
alter table vista     enable row level security;
alter table actividad enable row level security;

do $$
declare t text;
begin
  foreach t in array array['miembro','proyecto','semana','objetivo','tarea','vista','actividad'] loop
    execute format('drop policy if exists %I on %I', 'equipo_lee_' || t, t);
    execute format('drop policy if exists %I on %I', 'equipo_escribe_' || t, t);
    execute format(
      'create policy %I on %I for select to authenticated using (true)',
      'equipo_lee_' || t, t);
    execute format(
      'create policy %I on %I for all to authenticated using (true) with check (true)',
      'equipo_escribe_' || t, t);
  end loop;
end $$;
