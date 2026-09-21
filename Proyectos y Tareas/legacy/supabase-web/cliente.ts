/**
 * Cliente de Supabase.
 *
 * La URL y la clave anónima se leen de variables de entorno de Vite. La clave
 * anónima está pensada para vivir en el navegador: lo que protege los datos no
 * es ocultarla, sino las políticas de seguridad por fila (RLS) definidas en
 * ../../../supabase/schema.sql. Nunca uses aquí la clave `service_role`.
 *
 * Si faltan las variables la app arranca igualmente en modo demostración
 * (ver ./demo.ts), así que aquí no se lanza ningún error: solo se avisa.
 */
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

/** Con esto decide `main.tsx` qué repositorio usar. */
export const hayConfigSupabase = Boolean(url && anon)

if (!hayConfigSupabase) {
  console.info(
    '[Locodea] Sin configuración de Supabase: arrancando en modo demostración. ' +
    'Copia .env.example a .env.local y rellena VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY ' +
    'para trabajar contra la base de datos real.',
  )
}

// Marcadores inertes cuando no hay configuración: el cliente se construye pero
// nunca se llama, porque en ese caso manda el repositorio de demostración.
export const supabase = createClient(
  url || 'https://demostracion.supabase.co',
  anon || 'sin-configurar',
)
