# Locodea App · instrucciones para Claude

Aplicación interna de Locodea: **Power Apps Code App** (React + Vite) sobre
**Dataverse**, publicada en el entorno **Locodea PROD**
(`d5102352-7470-e60d-8ac9-ce67c4f7184d`, `org1d0382e8.crm17.dynamics.com`),
dentro de la solución `LocodeaObjetivos` (`fad88cef-0fb4-f111-aaab-70a8a5068d0e`).
El código vive en `Proyectos y Tareas/app`; los scripts de Dataverse en
`Proyectos y Tareas/scripts`.

## Regla fija: publicar en PROD = commit y push a GitHub

**Siempre que se publique la app en PROD (`pa app push`), en la misma operación se
hace `git commit` y `git push` a GitHub (`origin`, rama `main`).** Nunca se deja
PROD por delante del repositorio: si un día alguien clona el repo, tiene que
tener exactamente lo que está publicado.

La forma de cumplirlo sin acordarse es usar siempre el script de publicación,
que hace las tres cosas seguidas y se detiene si algo falla:

```bash
cd "Proyectos y Tareas/app"
npm run publicar -- --mensaje "Qué cambia en esta publicación"
```

Equivale a: `npm run build` → `pa app push --non-interactive --solution-id fad88cef-…`
→ `git add -A && git commit && git push`. Si no hay nada que commitear, solo
publica y hace push de lo que hubiera pendiente.

Si por lo que sea se publica a mano con `pa app push`, hay que commitear y
pushear a continuación, antes de dar la tarea por terminada.

## Cómo se trabaja

- Rama de trabajo: `main`, al día con `origin/main`. `modulo-crm` ya está
  integrada y no se usa.
- Desarrollo local con datos de ejemplo (sin tocar Dataverse):
  `$env:VITE_DEMO='1'; npx vite --port 3000` en `Proyectos y Tareas/app`.
- Los datos reales están en las tablas `loc_*` de Dataverse. El esquema del CRM
  se crea o completa con `node scripts/crm-esquema.mjs` (idempotente). Los datos
  de prueba del CRM se insertan con `node scripts/crm-ejemplos.mjs` y se quitan
  con `--borrar`.
- Finanzas del CRM (`app/src/gestion`, sección «Finanzas» del menú): gastos con
  foto (`loc_gasto`; la lista no descarga las fotos), caja a 90 días y documentos
  de clientes y proveedores (`loc_documento` con cuenta). Esquema con
  `node scripts/gestion-esquema.mjs`; ejemplos con `node scripts/gestion-ejemplos.mjs`
  (y `--borrar`). Añadió a las facturas `loc_importecobrado` / `loc_importepagado`
  y a la cuenta `loc_regimeniva`.
- Gestoría (`app/src/gestoria`): la gestoría fiscal y mercantil de Locodea SL.
  **El CRM registra; la Gestoría declara**: no da de alta facturas ni gastos, los
  lee. Motores puros con pruebas en `gestoria/fiscal` (apuntes, plazos, modelos,
  libros, revisión), `gestoria/contabilidad` (asientos automáticos, informes,
  Impuesto sobre Sociedades, cierre) y `gestoria/verifactu` (registro, huella,
  QR, XML). Solo la ven los socios; el rol «Asesor» (412000002) la ve en lectura.
  Esquema (6 tablas `loc_perfilfiscal`, `loc_presentacion`, `loc_asiento`,
  `loc_verifactuconfig`, `loc_registrofacturacion`, `loc_envioverifactu`, más las
  columnas fiscales de cuentas, facturas y gastos) con
  `node scripts/gestoria-esquema.mjs`; después, cada tabla nueva se añade como
  fuente de datos de la app. Si falta alguna, la Gestoría lo dice en vez de
  romperse. Valores de las opciones: 4120004xx–4120005xx.
- Verifactu: al registrar o anular una factura de venta, el CRM avisa
  (`crm/eventos.ts`) y la Gestoría crea su registro encadenado, de uno en uno.
  Las facturas en borrador no tienen número: lo reciben al registrarse (FV-, y
  FR- para rectificativas). En modo preparación no se envía nada; el envío lo
  hará `verifactu-servicio/` (Azure Functions) con el certificado en Key Vault.
  **El certificado nunca se guarda en la app, en Dataverse ni en el repositorio.**
- Pruebas: `npm test` (vitest) en `Proyectos y Tareas/app`. Los cálculos
  fiscales y contables no se tocan sin sus pruebas.
- Módulo Bóveda (`app/src/boveda`): contraseñas, claves API y notas seguras
  cifradas en el navegador (PBKDF2-SHA256 600 000 + AES-256-GCM, Web Crypto).
  `loc_boveda` guarda solo sal y clave envuelta; `loc_secreto.loc_datos`, el
  elemento cifrado. Nunca se escribe un secreto en claro en Dataverse, en
  localStorage ni en la consola. Esquema con `node scripts/boveda-esquema.mjs`.
  Si se cambia el formato, se sube la versión (`ALGORITMO` / `v1.` en
  `boveda/cripto.ts`) y se sigue sabiendo leer la anterior.
- Los scripts de Dataverse llaman al CLI con `npx -y @microsoft/dataverse`; en
  Windows conviene `$env:DATAVERSE_CLI=<ruta a bin/dataverse.js>` para que
  los `&` de las consultas OData no pasen por cmd.
- Todo en español: nombres de archivos, funciones, comentarios, mensajes de
  commit y textos de la interfaz.
- Antes de publicar: `npm run build` sin errores de TypeScript, `npm run lint` y `npm test`.

## Lo que no se toca sin preguntar

- `power.config.json` (appId, environmentId, fuentes de datos) y `.power/schemas`.
- Las tablas de Dataverse existentes: no se borran ni se renombran columnas.
- La Code App antigua «Locodea CRM» (`09024ae0-…`) está pendiente de borrar; no
  publicar nada ahí.
