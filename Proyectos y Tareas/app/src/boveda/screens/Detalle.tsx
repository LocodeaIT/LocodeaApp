/**
 * Ficha de un elemento abierto: cada dato con su botón de copiar, los secretos
 * tapados hasta que se piden, el código de dos pasos en vivo y el historial.
 */
import { useState, type ReactNode } from 'react'
import { AlertTriangle, ChevronDown, ExternalLink, History, Pencil, Star } from 'lucide-react'
import { fechaHora } from '../../domain/fechas'
import type { Elemento } from '../types'
import { ENTORNO_API, TIPO_ELEMENTO } from '../types'
import { TEXTO_PROBLEMA, diasDesde, diasHasta, dominio, enlaceSeguro, type Problema } from '../calculos'
import { BotonCopiar, CodigoTotp, MedidorFortaleza, Monograma, ValorSecreto } from './comunes'

function hace(dias: number | null): string {
  if (dias === null) return ''
  if (dias <= 0) return 'hoy'
  if (dias === 1) return 'ayer'
  if (dias < 60) return `hace ${dias} días`
  if (dias < 730) return `hace ${Math.round(dias / 30)} meses`
  return `hace ${Math.round(dias / 365)} años`
}

function Fila({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return <div className="bov-fila"><span className="etiqueta">{etiqueta}</span><div className="valor">{children}</div></div>
}

function Texto({ valor, que }: { valor: string; que: string }) {
  if (!valor) return <span className="bov-vacio">—</span>
  return <div className="bov-valor texto"><span className="dato">{valor}</span><span className="botones"><BotonCopiar valor={valor} que={que} /></span></div>
}

export function Detalle({ e, problemas, onEditar, onFavorito }: {
  e: Elemento
  problemas: Problema[]
  onEditar: () => void
  onFavorito: () => void
}) {
  const [historial, setHistorial] = useState(false)
  const enlace = enlaceSeguro(e.url)
  const caducaEn = diasHasta(e.caduca)

  return (
    <div className="bov-ficha anim-aparecer" key={e.id}>
      <div className="cabeza">
        <Monograma texto={e.titulo} grande />
        <div className="titulo">
          <h2 title={e.titulo}>{e.titulo}</h2>
          <div className="meta">
            <span className="chip pequeno">{TIPO_ELEMENTO[e.tipo]}</span>
            {e.entorno && <span className={`chip pequeno ${e.entorno === 'produccion' ? 'acento' : 'contorno'}`}>{ENTORNO_API[e.entorno]}</span>}
            {enlace && <a href={enlace} target="_blank" rel="noreferrer noopener" className="enlace">{dominio(e.url)} <ExternalLink size={12} /></a>}
          </div>
        </div>
        <button className={`bov-estrella ${e.favorito ? 'activa' : ''}`} onClick={onFavorito} title={e.favorito ? 'Quitar de favoritos' : 'Marcar como favorito'} aria-pressed={e.favorito}><Star size={17} /></button>
        <button className="btn pequeno" onClick={onEditar}><Pencil size={14} /> Editar</button>
      </div>

      {problemas.length > 0 && (
        <div className="bov-avisos">
          {problemas.map(p => (
            <div key={p} className="aviso"><AlertTriangle size={14} /> {p === 'caduca' && caducaEn !== null ? `Caduca en ${caducaEn} ${caducaEn === 1 ? 'día' : 'días'}` : TEXTO_PROBLEMA[p]}{p === 'repetida' && ': la usas también en otro sitio'}</div>
          ))}
        </div>
      )}

      <div className="cuerpo">
        {e.tipo === 'login' && <>
          <Fila etiqueta="Usuario"><Texto valor={e.usuario} que="Usuario copiado" /></Fila>
          <Fila etiqueta="Contraseña">
            <ValorSecreto valor={e.contrasena} que="Contraseña copiada" />
            <MedidorFortaleza valor={e.contrasena} compacto />
          </Fila>
          {e.totp && <Fila etiqueta="Código de dos pasos"><CodigoTotp secreto={e.totp} /></Fila>}
          {e.url && <Fila etiqueta="Web"><Texto valor={e.url} que="Enlace copiado" /></Fila>}
        </>}

        {e.tipo === 'api' && <>
          <Fila etiqueta="Clave API"><ValorSecreto valor={e.clave} que="Clave copiada" /></Fila>
          {e.secreto && <Fila etiqueta="Secreto"><ValorSecreto valor={e.secreto} que="Secreto copiado" /></Fila>}
          {e.usuario && <Fila etiqueta="Usuario o cliente"><Texto valor={e.usuario} que="Copiado" /></Fila>}
          {e.caduca && <Fila etiqueta="Caduca"><span className={caducaEn !== null && caducaEn <= 30 ? 'bov-alerta' : ''}>{new Date(`${e.caduca}T00:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}{caducaEn !== null && (caducaEn < 0 ? ' · caducada' : ` · en ${caducaEn} días`)}</span></Fila>}
          {e.url && <Fila etiqueta="Consola"><Texto valor={e.url} que="Enlace copiado" /></Fila>}
        </>}

        {e.tipo === 'nota'
          ? <Fila etiqueta="Contenido"><ValorSecreto valor={e.notas} que="Nota copiada" multilinea /></Fila>
          : e.notas && <Fila etiqueta="Notas"><div className="bov-notas">{e.notas}</div></Fila>}

        {e.campos.map(c => (
          <Fila key={c.id} etiqueta={c.nombre || 'Campo'}>
            {c.oculto ? <ValorSecreto valor={c.valor} que={`${c.nombre || 'Campo'} copiado`} /> : <Texto valor={c.valor} que={`${c.nombre || 'Campo'} copiado`} />}
          </Fila>
        ))}

        {e.etiquetas.length > 0 && <Fila etiqueta="Etiquetas"><div className="bov-etiquetas">{e.etiquetas.map(t => <span key={t} className="chip pequeno contorno">{t}</span>)}</div></Fila>}
      </div>

      <div className="pie">
        <span>
          {e.cambiadaEl && <>{e.tipo === 'api' ? 'Clave puesta' : 'Contraseña cambiada'} {hace(diasDesde(e.cambiadaEl))} · </>}
          Creado el {fechaHora(e.creadoEl)}{e.actualizadoEl && <> · editado el {fechaHora(e.actualizadoEl)}</>}
        </span>
        {e.historial.length > 0 && (
          <button className="btn sutil pequeno" onClick={() => setHistorial(h => !h)} aria-expanded={historial}>
            <History size={14} /> {e.historial.length} anterior{e.historial.length === 1 ? '' : 'es'} <ChevronDown size={14} className={historial ? 'girado' : ''} />
          </button>
        )}
      </div>
      {historial && (
        <div className="bov-historial">
          {e.historial.map((h, i) => (
            <div key={i} className="anterior">
              <span className="hasta">Hasta el {fechaHora(h.hasta)}</span>
              <ValorSecreto valor={h.valor} que="Valor anterior copiado" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
