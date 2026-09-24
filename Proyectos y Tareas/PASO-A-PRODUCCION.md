# Paso del entorno de desarrollo a producción

La app vive hoy en **Locodea PROD** (`d5102352-7470-e60d-8ac9-ce67c4f7184d`,
`org1d0382e8.crm17.dynamics.com`), que pese al nombre es un entorno de **tipo
Developer**. Todo está preparado para moverlo a un entorno de producción real
cuando haya licencias de pago.

## Por qué no se puede todavía

Crear un entorno de tipo Production exige **1 GB de capacidad de base de datos**
en el inquilino, y esa capacidad la aportan las **suscripciones de pago**. Las de
Locodea son de prueba y caducan el **13 de octubre de 2026**; los entornos
Developer y Trial no cuentan para la cuota. Hasta que no haya una licencia de
pago de Power Apps, el Admin Center responde:

> Este entorno no se puede crear porque su organización (inquilino) necesita al
> menos 1 GB de capacidad de base de datos.

Además, al caducar el trial **la app deja de ejecutarse**: las code apps exigen
Power Apps Premium por usuario.

## Qué está preparado

Todo el esquema y la propia app están dentro de una única solución:

| | |
|---|---|
| Solución | `LocodeaObjetivos` — *Locodea Objetivos y Tareas* |
| Id | `fad88cef-0fb4-f111-aaab-70a8a5068d0e` |
| Publicador | Locodea, prefijo `loc`, prefijo de opciones `41200` |
| Contenido | Las tablas `loc_*` de Proyectos y Tareas, las 13 del CRM y la code app |

Las tablas del CRM (`loc_cuenta`, `loc_contacto`, `loc_potencial`,
`loc_oportunidad`, `loc_producto`, `loc_oferta`, `loc_pedidoventa`,
`loc_facturaventa`, `loc_pedidocompra`, `loc_facturacompra`,
`loc_lineadocumento`, `loc_actividadcrm`, `loc_notacrm`) viajan con la solución
como el resto. Si hiciera falta crearlas a mano en otro entorno, el script
`scripts/crm-esquema.mjs --entorno <url>` las crea dentro de la solución y se
puede repetir sin riesgo.

La app se publica **dentro de la solución** a propósito, para que viaje con ella:

```bash
cd app && npm run build
npx --no-install pa app push --non-interactive --solution-id fad88cef-0fb4-f111-aaab-70a8a5068d0e
```

## Los pasos, cuando haya licencia

1. **Comprar Power Apps Premium** en el inquilino de Locodea. Con la primera
   suscripción de pago entran los 10 GB de capacidad por defecto.
2. **Crear el entorno de producción** (Admin Center → Manage → Environments →
   New → tipo *Producción*). El inquilino no tiene *Advanced data residency*, así
   que solo se elige **macro-región** (`Unión Europea y EFTA`), no el centro de
   datos.
3. **Habilitar code apps** en el entorno nuevo: Settings → Product → Features →
   *Power Apps code apps* → activar y guardar. Viene desactivado por defecto y
   tarda unos minutos en propagarse.
4. **Exportar la solución** desde el entorno actual, como *gestionada* para
   producción:
   ```bash
   pac solution export --name LocodeaObjetivos --managed --path ./LocodeaObjetivos_managed.zip
   ```
5. **Importarla** en el entorno nuevo:
   ```bash
   pac org select --environment <id-del-entorno-nuevo>
   pac solution import --path ./LocodeaObjetivos_managed.zip --publish-changes
   ```
6. **Republicar la app** apuntando al entorno nuevo. Cambia `environmentId` en
   `app/power.config.json`, borra `appId` para que se registre de nuevo, y:
   ```bash
   cd app && npm run build
   npx --no-install pa app init --environment-id <nuevo> --app-type CodeApp --display-name "Locodea Objetivos"
   npx --no-install pa app push --non-interactive --solution-id <solucion-en-el-nuevo>
   ```
7. **Asignar licencias y roles** a Marco, Alejandro y Juan Ángel: Power Apps
   Premium y un rol de seguridad con acceso a las tablas `loc_*`.

## Dos avisos que ahorran disgustos

**Las soluciones llevan el esquema, no las filas.** Los 4 miembros y las 4 vistas
guardadas **no viajan** en la exportación: hay que volver a crearlos en el
entorno nuevo, o migrarlos aparte. Lo mismo para los datos de trabajo que haya
acumulado el equipo — eso necesita una migración de datos explícita. Vale
también para el CRM: cuentas, contactos, oportunidades, documentos y sus líneas
no viajan con la solución. Sus propietarios apuntan a filas de `loc_miembro`,
así que en una migración hay que llevar primero los miembros.

**La URL de la app cambia.** Al publicarla en otro entorno se genera un `appId`
nuevo, así que hay que repartir el enlace otra vez.

## Mientras tanto

El entorno Developer se **deshabilita a los 30 días sin actividad** y se borra 15
días después. Basta con que alguien abra la app de vez en cuando para que el
contador se reinicie.
