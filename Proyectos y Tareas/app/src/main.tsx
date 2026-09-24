import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// DM Sans empaquetada: la CSP de las Code Apps solo admite fuentes propias,
// así que un <link> a Google Fonts no carga una vez publicada la app.
import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/500.css'
import '@fontsource/dm-sans/600.css'
import './bronce.css'
import './index.css'
import './vistas.css'
import './extras.css'
import './sistema.css'
import App from './App'
import { Proveedor } from './store'
import { repoDataverse } from './data/dataverse'
import { CrmProveedor } from './crm/store'
import { crmRepoDataverse } from './crm/dataverse'

/**
 * La app corre como Code App sobre Dataverse. Para trabajar el diseño en local
 * sin entorno, `VITE_DEMO=1 npm run dev` arranca con datos de ejemplo en el
 * navegador; ese repositorio se carga aparte y no viaja al paquete publicado.
 * El CRM sigue la misma regla: fuera de la demo usa sus tablas de Dataverse.
 */
const demo = import.meta.env.VITE_DEMO === '1'
const repo = demo ? (await import('./data/demo')).repoDemo : repoDataverse
const crmRepo = demo ? (await import('./crm/demo')).crmRepoDemo : crmRepoDataverse

if (demo) {
  avisarModoDemostracion()
} else {
  // Restos de la etapa en la que los datos vivían en el navegador.
  for (const clave of ['locodea.objetivos.v1', 'locodea.objetivos.v2', 'locodea.objetivos.v3', 'locodea.demo.v1', 'locodea.crm.demo.v1']) {
    try { localStorage.removeItem(clave) } catch { /* modo privado o sin permisos */ }
  }
}

/** Distintivo fijo para que nadie confunda los datos de ejemplo con los reales. */
function avisarModoDemostracion(): void {
  const aviso = document.createElement('div')
  aviso.textContent = 'Modo demostración · datos de ejemplo'
  aviso.title = 'Arrancado con VITE_DEMO=1. Sin esa variable, la app usa Dataverse.'
  Object.assign(aviso.style, {
    position: 'fixed', left: '14px', bottom: '14px',
    zIndex: '9999', padding: '6px 14px', borderRadius: '99px',
    background: 'var(--dark)', color: '#fff', fontSize: '12px', fontWeight: '500',
    boxShadow: 'var(--shadow-3)', pointerEvents: 'none', letterSpacing: '.01em',
  } satisfies Partial<CSSStyleDeclaration>)
  document.body.appendChild(aviso)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Proveedor repo={repo}>
      <CrmProveedor repo={crmRepo}>
        <App />
      </CrmProveedor>
    </Proveedor>
  </StrictMode>,
)
