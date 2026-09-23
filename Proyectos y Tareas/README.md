# Locodea · Objetivos y tareas

Aplicación web (React + TypeScript + Vite) para la gestión del equipo de
Locodea: objetivos semanales con propuesta y aceptación, tareas con subtareas y
fechas, To Do personal, proyectos y análisis de rendimiento.

Es el primer módulo de la [aplicación interna de Locodea](../README.md).

- **Plataforma**: Power Apps **Code App** sobre **Dataverse**, en el entorno
  Locodea PROD (`d5102352…`, de tipo Developer).
- **Capa de datos**: `app/src/data/repo.ts` define el contrato y
  `app/src/data/dataverse.ts` lo implementa contra las tablas `loc_*`. La UI solo
  conoce el contrato, así que cambiar de almacenamiento no toca ninguna pantalla.
- **Paso a producción**: ver [PASO-A-PRODUCCION.md](./PASO-A-PRODUCCION.md).

## Diseño

La app usa el sistema **Locodea Bronce**. Los tokens están en `app/src/bronce.css`
(papel, tinta, bronce, arena; DM Sans; radios 8/12/20/24/32; anillos de 1 px).
Es la única capa que hay que tocar si el sistema cambia.

Para ver los componentes sin conectar con Dataverse, con `VITE_DEMO=1 npm run dev` abre
`http://localhost:3000/bronce-muestra.html`.

Tres reglas del sistema que conviene respetar al añadir pantallas:

- El **anillo de 1 px** (`box-shadow: 0 0 0 1px var(--ring)`) sustituye al borde duro.
- Las **sombras van tintadas** con la tinta, nunca negro puro.
- La jerarquía se marca con **opacidad de tinta** (`--ink-65`, `--ink-40`…) y peso 500,
  no con colores distintos ni negritas.

No escribas colores a mano: rompen el modo oscuro, que viene incluido.

## Desarrollo

```bash
cd app && npm install
VITE_DEMO=1 npm run dev     # datos de ejemplo, sin necesidad de entorno
```

Abre `http://localhost:3000`. Sin `VITE_DEMO=1` la app espera el host de Power
Apps, así que para desarrollo local con datos reales se usa `pa app run`.

Para publicar en el entorno, siempre dentro de la solución:

```bash
cd app && npm run build
npx --no-install pa app push --non-interactive --solution-id fad88cef-0fb4-f111-aaab-70a8a5068d0e
```

## Qué hay

| Pantalla | Qué hace |
|---|---|
| **Inicio** | «En qué centrarte hoy» (recomendaciones calculadas: vencidas, bloqueadas, objetivos por revisar o sin tareas…), resumen en texto, KPIs, objetivos propios con avance, carga del equipo, gráficos. |
| **Mi día** (pop-up abajo a la derecha) | To Do personal estilo Microsoft To Do: Mi día, Importante, Planificado, Mis tareas, Personales. Alta rápida, reordenar arrastrando. |
| **Informes** | Informe semanal, de proyecto y de rendimiento del equipo. Botón *Imprimir / Guardar PDF* (solo se imprime el informe, en A4). |
| **Objetivos semanales** | Una columna por persona. Ciclo: planificación → propuesta → aprobada → cerrada. Los revisa Jesús (el revisor) y solo él aprueba la semana. Al cerrar, cada objetivo queda cumplido / no cumplido. Arrastrar para reordenar o reasignar. |
| **Tareas** | Cualquier tarea se marca como hecha con su casilla, sin abrirla. Vistas guardadas (personales o del equipo) de cuatro tipos: **Tablero** Kanban, **Lista** con columnas configurables y edición en línea, **Calendario** de vencimientos y **Gantt** editable (mover y estirar barras). Filtros, agrupación y orden por vista. Subtareas. |
| **Proyectos** | Tarjetas con salud del proyecto (tareas completadas sobre el total y tareas vencidas) y detalle con sus tareas y objetivos. |
| **Análisis** | Cumplimiento por persona y semana, tareas completadas por semana, histórico de semanas, carga actual, salud de proyectos. |
| **Equipo** | Marco, Jesús y Alejandro: rol, color y quién es el revisor de objetivos. |
| **CRM** (secciones CRM, Ventas, Compras y Catálogo del menú) | Inicio con indicadores, pipeline y facturación; listas con vistas, filtros, orden, borrado en lote y exportación a Excel; fichas con pestañas, paneles laterales y flujo Calificar → Desarrollar → Proponer → Cerrar. Cadena oportunidad → oferta → pedido → factura (imprimible como documento), compras y actividades «referentes a» cualquier registro. Avisos de vencidos, enlaces directos y botón Atrás (`#crm/…`) y copia de seguridad JSON en el inicio del CRM. **Solo en modo demo** (`VITE_DEMO=1`, datos en el navegador): las tablas de Dataverse están pendientes y, sin ellas, el CRM lo indica en pantalla. La factura oficial (Verifactu/SII) sigue en el ERP. |

## Flujo semanal (lo importante)

1. **Lunes, proponer**: cada persona añade sus objetivos de la semana (enlazados a proyecto y con prioridad). Alguien pulsa *Enviar propuesta*.
2. **Revisar**: el revisor (Jesús, marcado en Equipo) acepta o rechaza (con motivo) cada objetivo, incluidos los suyos. Cuando no queda ninguno pendiente, solo él puede pulsar *Aprobar semana* y se pasa a la siguiente fase.
3. **Durante la semana**: las tareas se enlazan al objetivo; el avance del objetivo se calcula con ellas.
4. **Viernes, evaluar**: cada objetivo se marca cumplido / no cumplido con una nota. *Cerrar semana* con retrospectiva breve. Lo no evaluado cuenta como no cumplido.
5. **Análisis** muestra el % de cumplimiento por persona y semana: ahí se ve si se está trabajando en lo acordado.

## Estructura

```
app/src/
  domain/    tipos, fechas, métricas, filtrado y agrupación de vistas
  data/      repo.ts (contrato), dataverse.ts (implementación), demo.ts + seed.ts
  store.tsx  estado global y acciones de negocio
  ui/        componentes base y tarjeta de tarea
  screens/   pantallas; screens/tareas/ tiene las cuatro vistas
  crm/       módulo CRM: tipos, catálogos, repo (demo.ts + semilla.ts; dataverse.ts pendiente),
             store.tsx, registro/ (descripción de cada entidad) y screens/ (inicio, lista y ficha genéricas)
```

## Pendiente

- **Identificar al usuario por su cuenta de Power Apps** en vez del selector de
  entrada, enlazándola con la fila de `loc_miembro`.
- **CRM en Dataverse**: crear las tablas del CRM en la solución y completar
  `app/src/crm/dataverse.ts` (hoy devuelve un CRM vacío y marca que faltan).
- **Enlace con el ERP**: `Proyecto.horasPresupuestadas` y las horas reales
  contra el sistema de facturación, que no se construye aquí.
