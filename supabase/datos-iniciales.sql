-- ============================================================================
-- Datos maestros de Locodea: el equipo y las vistas compartidas.
--
-- No son datos de ejemplo: son la configuración mínima para que la app sea
-- usable (sin miembros no se puede asignar nada ni revisar objetivos).
--
-- Idempotente: se puede ejecutar varias veces sin duplicar.
-- ============================================================================

-- ─────────────────────────────────────────────── equipo

insert into miembro (nombre, iniciales, email, color, rol, activo) values
  ('Marco',        'MR', 'marco@locodea.com',     '#C239B3', 'socio', true),
  ('Jesús Alonso', 'JA', 'jesus@locodea.com',     '#0F6CBD', 'socio', true),
  ('Alejandro',    'AL', 'alejandro@locodea.com', '#0E7C5B', 'socio', true),
  ('Juan Ángel',   'JU', 'juanangel@locodea.com', '#B85C00', 'socio', true)
on conflict do nothing;

-- ─────────────────────────────────────────────── vistas del equipo
-- miembro_id null = compartida por todos.

insert into vista (nombre, tipo, miembro_id, filtros, agrupar, ordenar, orden_desc, columnas, escala, es_predeterminada)
select v.nombre, v.tipo::tipo_vista, null, v.filtros::jsonb, v.agrupar, v.ordenar, v.orden_desc,
       v.columnas::jsonb, v.escala::escala_vista, v.es_predeterminada
from (values
  ('Tablero del equipo', 'tablero',
   '{"texto":"","proyectoId":null,"asignadoId":null,"estados":[],"prioridades":[],"ocultarHechas":false,"soloMias":false,"mostrarSubtareas":false}',
   'estado', 'orden', false,
   '["proyecto","asignado","estado","prioridad","vence"]', 'semana', true),

  ('Lista por proyecto', 'lista',
   '{"texto":"","proyectoId":null,"asignadoId":null,"estados":[],"prioridades":[],"ocultarHechas":true,"soloMias":false,"mostrarSubtareas":false}',
   'proyecto', 'vence', false,
   '["asignado","estado","prioridad","vence","subtareas"]', 'semana', false),

  ('Planificación (Gantt)', 'gantt',
   '{"texto":"","proyectoId":null,"asignadoId":null,"estados":[],"prioridades":[],"ocultarHechas":false,"soloMias":false,"mostrarSubtareas":false}',
   'proyecto', 'vence', false,
   '[]', 'dia', false),

  ('Calendario de entregas', 'calendario',
   '{"texto":"","proyectoId":null,"asignadoId":null,"estados":[],"prioridades":[],"ocultarHechas":false,"soloMias":false,"mostrarSubtareas":false}',
   'ninguno', 'vence', false,
   '[]', 'mes', false)
) as v(nombre, tipo, filtros, agrupar, ordenar, orden_desc, columnas, escala, es_predeterminada)
where not exists (select 1 from vista x where x.nombre = v.nombre and x.miembro_id is null);
