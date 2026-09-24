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

La app usa el sistema de diseño **«locodea.»** (paleta Bronce), el mismo que las
code apps CRM, Formación y Almacén: papel, tinta, bronce y arena; DM Sans con
negritas en 500; muy redondo y con un anillo de 1 px en lugar de bordes. Por
tener muchas secciones sigue el esqueleto del CRM: **barra lateral en arena a
toda altura** con la marca arriba y la persona abajo, y **barra superior clara**
con migas y buscador en píldora.

Está en tres capas, de abajo arriba:

| Archivo | Qué tiene |
|---|---|
| `app/src/bronce.css` | Los **valores** del sistema (tokens). Es lo único que se toca si el sistema cambia |
| `app/src/index.css` | Alias en español (`--texto-2`, `--acento`…) que usan las pantallas, el esqueleto y los componentes base |
| `app/src/sistema.css` | La capa de componentes del sistema; se carga la última y manda sobre el resto |

Reglas que no se negocian (vienen de la skill `locodea-code-app`):

- **Colores solo por token.** Nada de hex en pantallas, salvo colores de datos
  (proyecto, persona, canal) que se guardan en Dataverse.
- **Bronce medido.** Botón principal en tinta (`.btn.primario`); el bronce
  (`.btn.acento`) solo para *la* acción de la pantalla. El texto en bronce va
  siempre en `--accent-text` (#8A5A30), nunca en #B07A4A sobre blanco.
- **Personas con sus iniciales en bronce**, sin círculo de color: el color de
  cada persona se reserva para barras y gráficos.
- **Desplegables propios** (`ui/Select.tsx`), nunca `<select>`; y para
  confirmar, `confirmar()` de `ui/basicos.tsx`, nunca `window.confirm`.
- **DM Sans empaquetada** con `@fontsource/dm-sans`: la política de seguridad de
  las Code Apps bloquea Google Fonts una vez publicada la app.
- **Titulares de una frase con punto final** («Contenido.»), sin emojis.

Ojo con un nombre heredado: en esta app `--accent-ink` significa «texto blanco
sobre bronce» (el CRM lo usa así), al revés que en el sistema. Los nombres del
sistema son `--on-accent` y `--accent-text`.

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
| **Objetivos semanales** | Una columna por persona y una **General** para lo que es del equipo entero, todas en una fila. Sin ceremonia: cualquiera apunta objetivos, suyos o de otro, y se marcan con su casilla. Desde cada objetivo se añaden tareas escribiendo y con Enter. Arrastrar para reordenar o pasar de columna. |
| **Tareas** | Alta rápida: se escribe el título y con Enter la tarea existe (el formulario completo, en «Más opciones»). Cualquier tarea se marca como hecha con su casilla, sin abrirla. Vistas guardadas (personales o del equipo) de cuatro tipos: **Tablero** Kanban, **Lista** con columnas configurables y edición en línea, **Calendario** de vencimientos y **Gantt** editable (mover y estirar barras). Filtros, agrupación y orden por vista. Subtareas. |
| **Proyectos** | Tarjetas con salud del proyecto (tareas completadas sobre el total y tareas vencidas) y detalle con sus tareas y objetivos. |
| **Análisis** | Cumplimiento por persona y semana, tareas completadas por semana, histórico de semanas, carga actual, salud de proyectos. |
| **Skills y agentes de IA** | Catálogo de lo que el equipo ha montado con IA (skills de Claude, agentes de Copilot Studio, prompts, flujos): qué hace, **cómo se usa**, dónde vive y quién lo lleva. Filtro por estado y plataforma, búsqueda, y el enlace se abre (URL) o se copia (ruta). Tabla `loc_recursoia`. |
| **Reuniones** | Reuniones con su orden del día; cada tema se marca tratado o aplazado y los pendientes pasan a la siguiente reunión con un botón. Se sincronizan con el calendario de Outlook. |
| **Contenido** | Calendario de redes sociales (YouTube, LinkedIn, Instagram, TikTok, blog, newsletter, X), agrupado por cuándo se publica. Alta rápida con canal y fecha; el estado avanza con un clic. Tabla `loc_contenido`. |
| **Equipo** | Las personas del equipo: rol y color (el color se usa en los gráficos). |
| **CRM** (secciones CRM, Ventas, Compras y Catálogo del menú) | Inicio con indicadores, pipeline y facturación; listas con vistas, filtros, orden, borrado en lote y exportación a Excel; fichas con pestañas, paneles laterales y flujo Calificar → Desarrollar → Proponer → Cerrar. Cadena oportunidad → oferta → pedido → factura (imprimible como documento), compras y actividades «referentes a» cualquier registro. Avisos de vencidos, enlaces directos y botón Atrás (`#crm/…`) y copia de seguridad JSON en el inicio del CRM. Guarda en sus 13 tablas de Dataverse (ver abajo); con `VITE_DEMO=1` usa datos de ejemplo en el navegador. La factura oficial (Verifactu/SII) sigue en el ERP. |

### Tablas del CRM

Las crea `scripts/crm-esquema.mjs` (idempotente, dentro de la solución) y las lee
`app/src/crm/dataverse.ts`. Todas empiezan vacías.

| Tabla | Qué guarda |
|---|---|
| `loc_cuenta`, `loc_contacto` | Clientes y proveedores, y sus personas |
| `loc_potencial`, `loc_oportunidad` | Clientes potenciales y oportunidades (fase, probabilidad, cierre) |
| `loc_producto` | Catálogo con precio de venta y coste |
| `loc_oferta`, `loc_pedidoventa`, `loc_facturaventa` | Documentos de venta, enlazados entre sí (oferta → pedido → factura) |
| `loc_pedidocompra`, `loc_facturacompra` | Documentos de compra |
| `loc_lineadocumento` | Líneas de los cinco tipos de documento: una búsqueda a cada tipo (la app las borra con su documento) y otra al producto |
| `loc_actividadcrm`, `loc_notacrm` | Actividades y notas «referentes a» cualquier registro (tipo + id en texto, como `loc_actividad`) |

Estados y catálogos son columnas de opción (valores `4120001xx`–`4120002xx`),
los propietarios son búsquedas a `loc_miembro` y la numeración (C1001,
OF-26001…) la calcula la app y se guarda en `loc_numero`.

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
  crm/       módulo CRM: tipos, catálogos, repo (dataverse.ts; demo.ts + semilla.ts),
             store.tsx, registro/ (descripción de cada entidad) y screens/ (inicio, lista y ficha genéricas)
scripts/
  crm-esquema.mjs   crea las tablas del CRM en Dataverse (idempotente)
```

## Pendiente

- **Identificar al usuario por su cuenta de Power Apps** en vez del selector de
  entrada, enlazándola con la fila de `loc_miembro`.
- **CRM**: publicar la app con el módulo (`pa app push`) y probarlo con datos
  reales dentro de Power Apps.
- **Enlace con el ERP**: `Proyecto.horasPresupuestadas` y las horas reales
  contra el sistema de facturación, que no se construye aquí.
