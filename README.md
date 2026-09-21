# Locodea · aplicación interna

Aplicación interna para el equipo de Locodea, construida como **Power Apps Code
App** (React + Vite) sobre **Dataverse**.

Está desplegada en un entorno de tipo Developer y preparada para moverse a uno de
producción cuando haya licencias de pago: ver
[PASO-A-PRODUCCION.md](./Proyectos%20y%20Tareas/PASO-A-PRODUCCION.md).

## Módulos

| Carpeta | Estado | Qué hace |
|---|---|---|
| [`Proyectos y Tareas/`](./Proyectos%20y%20Tareas) | En uso | Objetivos semanales, tareas con subtareas, Mi día, proyectos, reuniones sincronizadas con Outlook, informes y análisis |
| *CRM* | Pendiente | Clientes, contactos y oportunidades |
| *ERP* | No se construye | Se **integra** con el ERP existente (facturación y contabilidad quedan fuera) |

La decisión sobre el ERP es deliberada: facturación y contabilidad están
reguladas (Verifactu, SII) y cambian por ley. Esa responsabilidad se deja en un
ERP real y aquí solo se consumen y empujan datos.

## Base de datos

Las 8 tablas `loc_*` viven en Dataverse, dentro de la solución
**LocodeaObjetivos** (publicador `loc`). La solución es la unidad que se exporta
e importa para llevar la app de un entorno a otro.

## Poner en marcha un módulo

```bash
cd "Proyectos y Tareas/app"
npm install
VITE_DEMO=1 npm run dev      # datos de ejemplo, sin entorno
```

Para publicar, siempre dentro de la solución:

```bash
npm run build
npx --no-install pa app push --non-interactive --solution-id fad88cef-0fb4-f111-aaab-70a8a5068d0e
```

## Historia: la versión web sobre Supabase

Hubo una etapa en la que la app se montó como web normal sobre **Supabase**, para
evitar el coste de licencias de Power Apps. Se descartó a favor de Dataverse.

Ese código está guardado en `Proyectos y Tareas/legacy/supabase-web/`
(repositorio, cliente, esquema SQL y `.env.example`). Para revivirlo: reinstalar
`@supabase/supabase-js`, devolver esos archivos a `app/src/data/` y apuntar
`main.tsx` a `repoSupabase`.

Conviene recordar el motivo por el que aquello no ahorraba licencias: **usar
Dataverse exige Power Apps Premium por usuario sea cual sea el front-end**, y
acceder por detrás con una cuenta de servicio es multiplexación, que Microsoft
considera incumplimiento. El ahorro solo llegaba cambiando también la base de
datos.
