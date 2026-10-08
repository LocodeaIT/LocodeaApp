# Servicio Verifactu (Azure Functions)

Remite a la AEAT los registros de facturación VERI\*FACTU que genera la app de
Locodea. **Todavía no está desplegado**: es el esqueleto listo para cuando exista
Locodea SL y su certificado electrónico.

## Qué hace

La app (Power Apps Code App) genera cada registro de alta o anulación con su
huella encadenada y su XML (`app/src/gestoria/verifactu`). Cuando la
configuración de Verifactu está en **pruebas** o **producción**, llama a este
servicio:

```
POST https://<function-app>.azurewebsites.net/api/registrar
{ "entorno": "pruebas", "cabecera": { "nif": "B…", "razonSocial": "Locodea SL" },
  "registros": [{ "id": "<id del registro en Dataverse>", "xml": "<sum1:RegistroAlta …>" }] }
```

El servicio:

1. Comprueba que quien llama ha iniciado sesión (Easy Auth con Entra ID) y que el
   entorno está habilitado (`ENTORNOS_PERMITIDOS`).
2. Respeta el **control de flujo** (art. 16.2 de la Orden HAC/1177/2024): espera
   inicial de 60 s, luego la que diga la AEAT en `TiempoEsperaEnvio`; un lote de
   1.000 registros no espera. Si llega antes de tiempo responde `429` con
   `Retry-After` y `esperaSegundos`.
3. Arma el sobre SOAP `RegFactuSistemaFacturacion` (máximo 1.000 registros).
4. Lee el certificado de **Azure Key Vault** con la identidad administrada y
   llama con **TLS mutuo** al servicio `VerifactuSOAP` de la AEAT (pruebas o
   producción; con certificado de sello, los puntos `www10` / `prewww10`).
5. Interpreta la respuesta: estado del envío (`Correcto`, `ParcialmenteCorrecto`,
   `Incorrecto`), CSV, tiempo de espera y, por registro, `Correcto`,
   `AceptadoConErrores` o `Incorrecto` con su código y descripción. Un SOAP Fault
   (formato o cabecera) o un fallo de conexión deja los registros **pendientes**
   para reintentarlos.
6. Devuelve a la app `{ estado, csv, esperaSegundos, respuestas: [{ registroId, estado, codigoError, descripcionError }] }`
   con los estados de la app (`correcto`, `parcial`, `incorrecto`, `error`; y
   `correcto`, `aceptado-errores`, `rechazado`, `pendiente`).

Además, `reintentos` se ejecuta cada hora (a los 5 minutos) para reenviar lo
pendiente marcando `Incidencia = S`, como pide el art. 16.4 de la Orden. Hoy es
un esqueleto: falta el acceso a Dataverse (ver más abajo).

| Archivo | Qué es |
| --- | --- |
| `src/functions/registrar.ts` | Función HTTP `POST /api/registrar` |
| `src/functions/reintentos.ts` | Temporizador horario de reintentos (esqueleto) |
| `src/remision.ts` | Validación de la petición, envío y traducción de la respuesta |
| `src/aeat/` | Sobre SOAP, puntos de acceso, cliente TLS mutuo e interpretación de la respuesta |
| `src/certificado.ts` | Lectura del certificado de Key Vault (en memoria, se refresca cada hora) |
| `src/flujo.ts` | Control de flujo por emisor y entorno |
| `src/autenticacion.ts` | Comprobación del usuario de Easy Auth |

## Por qué el certificado vive en Key Vault

El certificado electrónico de la sociedad sirve para mucho más que Verifactu:
con él se presentan impuestos y se firman trámites en nombre de Locodea SL. Por
eso:

- **Nunca en la app**: la Code App se ejecuta en el navegador; cualquier cosa que
  llegue allí (un PFX, su contraseña, una clave de función) la puede ver
  cualquiera que use las herramientas de desarrollo.
- **Nunca en Dataverse**: lo leerían todos los usuarios y roles con acceso a la
  tabla, quedaría en copias de seguridad y exportaciones, y no hay forma de
  auditar quién lo usa.
- **En Key Vault**: el certificado no sale del almacén salvo hacia la Function App,
  que se autentica con su **identidad administrada** (sin contraseñas que
  guardar). Key Vault registra cada acceso, permite renovar el certificado sin
  tocar código y avisar de su caducidad.

La app solo guarda el **nombre** del certificado (`certificadoRef`, por defecto
`certificado-locodea-sl`), que coincide con `CERTIFICADO_SECRETO` aquí.

## Recursos de Azure a crear

Todo en la misma suscripción y región (p. ej. *Spain Central* o *West Europe*):

1. **Grupo de recursos** `rg-locodea-verifactu`.
2. **Key Vault** `kv-locodea-verifactu` con el modelo de permisos **RBAC**,
   protección de purga y eliminación temporal activadas.
3. **Function App** `func-locodea-verifactu`: Node.js 20 o superior, Linux,
   plan Flex Consumption o Consumo, con su cuenta de almacenamiento y
   Application Insights.
   - **Límite de escalado a 1 instancia** (el control de flujo vive en memoria).
   - **Identidad administrada asignada por el sistema**: activada.
4. **Permiso**: a la identidad administrada de la Function App, el rol
   **Key Vault Secrets User** sobre el Key Vault (lee el certificado como
   secreto; no necesita más).
5. **Configuración de la Function App** (variables de `local.settings.example.json`):
   `KEY_VAULT_URL`, `CERTIFICADO_SECRETO`, `AEAT_CERTIFICADO_SELLO`,
   `ENTORNOS_PERMITIDOS` (`pruebas`; añadir `produccion` solo cuando esté todo
   probado), `AEAT_TIMEOUT_MS`, `ROL_REQUERIDO` y `DATAVERSE_URL`. En Azure **no**
   se pone `AUTENTICACION` (la comprobación queda activa).
6. **Autenticación (Easy Auth)**: proveedor Microsoft (Entra ID) del inquilino de
   Locodea, «Requerir autenticación» y «HTTP 401» para las peticiones sin sesión.
   Opcional: un rol de aplicación (p. ej. `Verifactu.Enviar`) asignado solo a
   quien emite facturas, y su nombre en `ROL_REQUERIDO`.
7. **CORS**: el dominio desde el que se sirve la Code App.
   Comprobar: el origen exacto (abrir la app publicada, herramientas de
   desarrollo → pestaña Red → cabecera `Origin` de cualquier petición) y
   añadir solo ese, sin `*`.

Comprobar: cómo obtiene la Code App el token de Entra ID para llamar a este
servicio (o si conviene publicarlo como conector personalizado de Power
Platform). Hasta resolverlo, `enviarAlServicio` acepta un `token` opcional.

## Subir el certificado cuando exista la SL

1. Pedir el certificado de representante de persona jurídica de Locodea SL
   (FNMT u otro prestador cualificado) y exportarlo como **PFX con clave privada**.
2. En el Key Vault → **Certificados** → *Generar o importar* → **Importar**:
   nombre `certificado-locodea-sl`, el archivo PFX y su contraseña. Key Vault lo
   guarda y lo expone como secreto del mismo nombre, en base64 y sin contraseña.
   (Si se sube como secreto con contraseña, guardar esta en otro secreto e
   indicar su nombre en `CERTIFICADO_CLAVE_SECRETO`.)
3. Borrar el PFX del equipo y guardar la contraseña solo en el gestor de
   contraseñas de la empresa.
4. En la app, en la configuración de Verifactu: NIF de la SL, caducidad del
   certificado, URL del servicio (`https://func-locodea-verifactu.azurewebsites.net/api/registrar`).
5. Si el certificado es de **sello** electrónico, `AEAT_CERTIFICADO_SELLO=true`.

## Probar contra el entorno de pruebas de la AEAT

Requisitos: Node 20+, Azure Functions Core Tools v4 (`npm i -g azure-functions-core-tools@4`),
Azurite para el almacenamiento local y un certificado electrónico válido subido
al Key Vault (el de la SL). Comprobar: si el entorno de pruebas admite también
un certificado de persona física para empezar antes de que exista la SL.

```bash
cd "Proyectos y Tareas/verifactu-servicio"
npm install
cp local.settings.example.json local.settings.json   # rellenar KEY_VAULT_URL; nunca se versiona
az login                                              # para que DefaultAzureCredential lea Key Vault
npm start                                             # compila y arranca en http://localhost:7071
```

En local, `AUTENTICACION=desactivada-solo-en-local` quita la comprobación de
usuario (no tiene efecto en Azure). Luego:

1. Poner la configuración de Verifactu de la app en **pruebas**, con la URL
   `http://localhost:7071/api/registrar` y el NIF del titular del certificado.
2. Emitir una factura de prueba: la app crea el registro y lo envía.
3. Comprobar la respuesta (CSV y estado de cada registro) y el registro en el
   portal de pruebas externas de la AEAT: <https://preportal.aeat.es>.
4. Cotejar el QR de la factura: la URL de pruebas es
   `https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR?…`.
5. Probar los casos de error: NIF del destinatario no identificado, registro
   duplicado (reenviar el mismo), cadena con huella mal calculada (debe quedar
   «aceptado con errores») y un segundo envío antes de 60 s (debe dar `429`).

## Qué queda pendiente

- **Acceso a Dataverse** desde el servicio para `reintentos` (entidad de servicio
  o identidad administrada como usuario de aplicación, con un rol limitado a
  `loc_registrofacturacion` y `loc_envioverifactu`). Detalle en
  `src/functions/reintentos.ts`.
- Decidir un único remitente (servicio o app) para no enviar dos veces el mismo
  registro cuando haya reintentos automáticos.
- Token de Entra ID desde la Code App (o conector personalizado) y origen exacto
  para CORS.
- Avisar en la app de los registros pendientes por incidencia y de cuántos faltan
  (art. 16.4) y de la caducidad del certificado.
- Subsanaciones (`Subsanacion`, `RechazoPrevio`) de registros rechazados: hoy el
  servicio solo remite lo que la app genera.
- Pruebas automáticas del servicio con respuestas reales del entorno de pruebas.

## Fuentes

- Orden HAC/1177/2024 (arts. 15, 16, 20 y 21): <https://www.boe.es/diario_boe/txt.php?id=BOE-A-2024-22138>
- WSDL y esquemas: <https://prewww2.aeat.es/static_files/common/internet/dep/aplicaciones/es/aeat/tikeV1.0/cont/ws/SistemaFacturacion.wsdl>
- Descripción del servicio web: <https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/Veri-Factu_Descripcion_SWeb.pdf>
- Validaciones y errores: <https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/Validaciones_Errores_Veri-Factu.pdf>
- Información técnica en la sede: <https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/informacion-tecnica.html>
