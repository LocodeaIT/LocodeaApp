# Locodea · aplicación interna

Aplicación interna para el equipo de Locodea, construida como **Power Apps Code
App** (React + Vite) sobre **Dataverse**.

Está desplegada en un entorno de tipo Developer y preparada para moverse a uno de
producción cuando haya licencias de pago: ver
[PASO-A-PRODUCCION.md](./Proyectos%20y%20Tareas/PASO-A-PRODUCCION.md).

## Módulos

| Carpeta | Estado | Qué hace |
|---|---|---|
| [`Proyectos y Tareas/`](./Proyectos%20y%20Tareas) | En uso | Objetivos semanales, tareas con subtareas, Mi día, proyectos, reuniones sincronizadas con Outlook, calendario de contenido de redes, catálogo de skills y agentes de IA, informes y análisis |
| CRM (en `Proyectos y Tareas/app/src/crm/`) | Tablas creadas, sin publicar | Cuentas, contactos, clientes potenciales, oportunidades, actividades, productos, ofertas, pedidos y facturas de venta y compra. Conectado a sus 13 tablas de Dataverse (vacías); en local se prueba con `VITE_DEMO=1` |
| Gestoría (en `Proyectos y Tareas/app/src/gestoria/`) | En uso | La gestoría fiscal y mercantil de Locodea SL: calendario de obligaciones según el perfil fiscal, revisión de los datos del CRM, modelos (303, 349, 111, 115, 123, 347, 390, 190, 180, 193, 369, 202, 200), libros registro, contabilidad por partida doble sacada del CRM, cierre anual, expediente de la sociedad y Verifactu. El CRM registra; la Gestoría declara |
| Bóveda (en `Proyectos y Tareas/app/src/boveda/`) | En uso | Contraseñas, claves API y notas seguras del equipo y personales, cifradas en el navegador con AES-256 antes de llegar a Dataverse (`loc_boveda`, `loc_secreto`). Generador, códigos de dos pasos, salud de contraseñas y bloqueo automático |
| *ERP* | No se construye | Locodea SL no usa un ERP: la facturación oficial sale del CRM con Verifactu y la contabilidad la lleva la Gestoría |

Desde la propuesta del 7 de octubre de 2026 la app hace de gestoría de la
sociedad: el CRM emite las facturas (numeración correlativa por series y
registro de Verifactu en cada emisión) y registra compras y gastos; la
Gestoría calcula los modelos, lleva la contabilidad y controla los plazos.
Verifactu funciona en modo preparación hasta que la SL tenga su certificado;
el envío a la AEAT lo hará el servicio de Azure de
[`Proyectos y Tareas/verifactu-servicio/`](./Proyectos%20y%20Tareas/verifactu-servicio), con el certificado en Key Vault.

## Base de datos

Las tablas `loc_*` viven en Dataverse, dentro de la solución
**LocodeaObjetivos** (publicador `loc`): las 10 de Proyectos y Tareas y las 13
del CRM. La solución es la unidad que se exporta e importa para llevar la app de
un entorno a otro. Las del CRM se crean (o se completan) con
`node "Proyectos y Tareas/scripts/crm-esquema.mjs"`, que se puede repetir sin
riesgo.

## Poner en marcha un módulo

```bash
cd "Proyectos y Tareas/app"
npm install
VITE_DEMO=1 npm run dev      # datos de ejemplo, sin entorno
```

Para publicar, siempre dentro de la solución:

```bash
npm run publicar -- --mensaje "Qué cambia"   # build + pa app push + git commit + git push
# (a mano equivale a: npm run build && npx --no-install pa app push --non-interactive --solution-id fad88cef-0fb4-f111-aaab-70a8a5068d0e, y después commit y push a GitHub)
```

## Historia: la versión web sobre Supabase

Hubo una etapa en la que la app se montó como web normal sobre **Supabase**, para
evitar el coste de licencias de Power Apps. Se descartó a favor de Dataverse.

Ese código está guardado en `Proyectos y Tareas/legacy/supabase-web/`
(cliente y `.env.example`). El esquema SQL se ha retirado del repositorio: si
hiciera falta, esta en el historial, en el commit inicial. Para revivirlo: reinstalar
`@supabase/supabase-js`, devolver esos archivos a `app/src/data/` y apuntar
`main.tsx` a `repoSupabase`.

Conviene recordar el motivo por el que aquello no ahorraba licencias: **usar
Dataverse exige Power Apps Premium por usuario sea cual sea el front-end**, y
acceder por detrás con una cuenta de servicio es multiplexación, que Microsoft
considera incumplimiento. El ahorro solo llegaba cambiando también la base de
datos.
