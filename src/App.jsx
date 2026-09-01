import { useState, useEffect, useCallback, useRef } from 'react'
import * as datos from './datos.js'
import { supabase } from './supabase.js'

const plata = (n) =>
  Number(n ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const pct = (n) =>
  Number(n).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const esCodigo = (t) => /^\d{6,}$/.test(t.trim())
const margen = (costo, venta) =>
  !venta || venta <= 0 ? null : Math.round(((venta - costo) / venta) * 1000) / 10

/** Al revés: si fijás el margen, sale el precio de venta. */
const ventaDesdeMargen = (costo, margenPct) => {
  const m = Number(margenPct)
  if (!Number.isFinite(m) || m >= 100) return null
  return Math.round((Number(costo) / (1 - m / 100)) * 100) / 100
}

const aNum = (v) => {
  if (v === '' || v === null || v === undefined) return 0
  const n = parseFloat(String(v).replace(/\./g, '').replace(',', '.'))
  return Number.isNaN(n) ? 0 : n
}

function diasDesde(iso) {
  if (!iso) return null
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

// ════════════════════════════════════════════════════════════════ APP

export default function App() {
  const [perfil, setPerfil] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [vista, setVista] = useState('mostrador')
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [aviso, setAviso] = useState(null)

  const mostrar = useCallback((tipo, texto) => {
    setAviso({ tipo, texto })
    setTimeout(() => setAviso(null), 5000)
  }, [])

  const cargarPerfil = useCallback(async () => {
    try {
      const usuario = await datos.sesionActual()
      setPerfil(usuario ? await datos.miPerfil() : null)
    } catch (e) {
      mostrar('error', e.message)
      await datos.salir()
      setPerfil(null)
    } finally {
      setCargando(false)
    }
  }, [mostrar])

  useEffect(() => {
    cargarPerfil()
    if (!supabase) return
    const { data } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === 'SIGNED_OUT') setPerfil(null)
    })
    return () => data.subscription.unsubscribe()
  }, [cargarPerfil])

  // Al entrar o salir alguien, volvemos al mostrador. Sin esto, la pantalla
  // en la que estabas queda abierta para el que entra después.
  useEffect(() => { setVista('mostrador') }, [perfil?.id])

  // Apenas entra alguien, bajamos la lista completa y la guardamos en el
  // navegador. Es lo que hace que el mostrador siga andando si se corta.
  useEffect(() => { if (perfil) datos.refrescarCopia() }, [perfil?.id])

  useEffect(() => {
    const cerrar = () => setMenuAbierto(false)
    document.addEventListener('click', cerrar)
    return () => document.removeEventListener('click', cerrar)
  }, [])

  if (cargando) return <p className="centrado">Cargando…</p>
  if (!perfil) return <Entrada alEntrar={cargarPerfil} aviso={aviso} mostrar={mostrar} />

  const esDueno = perfil.dueno === true
  const irA = (v) => { setVista(v); setMenuAbierto(false) }

  // El guardia va acá, en lo que se dibuja, y no solo en la navegación:
  // quien solo consulta no ve otra cosa que el mostrador, llegue como llegue.
  const actual = esDueno ? vista : 'mostrador' 

  return (
    <>
      <div className="barra">
        <div className="env">
          <div className="marca">Mostrador <span>· {perfil.nombre}{esDueno ? '' : ' (consulta)'}</span></div>
          {datos.modoPrueba && <span className="chip prueba">modo prueba</span>}
          <div className="menu" onClick={(e) => e.stopPropagation()}>
            <button aria-haspopup="true" aria-expanded={menuAbierto}
                    onClick={() => setMenuAbierto((v) => !v)}>Menú</button>
            <div className={'menu-lista' + (menuAbierto ? ' abierto' : '')} role="menu">
              <button role="menuitem" onClick={() => irA('mostrador')}>Consultar precios</button>
              {esDueno && <>
                <button role="menuitem" onClick={() => irA('cargar')}>Cargar producto</button>
                <button role="menuitem" onClick={() => irA('listado')}>Todos los productos</button>
                <button role="menuitem" onClick={() => irA('excel')}>Importar y exportar</button>
                <button role="menuitem" onClick={() => irA('accesos')}>Usuarios y accesos</button>
              </>}
              <hr />
              <button role="menuitem" onClick={async () => { await datos.salir(); setPerfil(null) }}>
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="env">
        {aviso && <div className={'aviso ' + aviso.tipo}>{aviso.texto}</div>}
        {actual === 'mostrador' && <Mostrador esDueno={esDueno} mostrar={mostrar} />}
        {actual === 'cargar'    && <Cargar mostrar={mostrar} alGuardar={() => setVista('mostrador')} />}
        {actual === 'listado'   && <Listado mostrar={mostrar} />}
        {actual === 'excel'     && <Excel mostrar={mostrar} />}
        {actual === 'accesos'   && <Accesos mostrar={mostrar} />}
      </div>
    </>
  )
}

// ════════════════════════════════════════════════════════════════ ENTRADA

function Entrada({ alEntrar, aviso, mostrar }) {
  const [email, setEmail] = useState('')
  const [clave, setClave] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')

  const enviar = async (e) => {
    e.preventDefault()
    setOcupado(true); setError('')
    try { await datos.entrar(email, clave); await alEntrar() }
    catch (err) { setError(err.message) }
    finally { setOcupado(false) }
  }

  return (
    <form className="entrada" onSubmit={enviar}>
      <p className="cartel">Mostrador</p>
      <p>Precios de la despensa.</p>
      {datos.modoPrueba && (
        <div className="caja-prueba">
          <b>Modo prueba</b>
          Todavía no conectaste Supabase, así que la app anda con datos de ejemplo
          que no se guardan. Entrá con <code>alex@prueba.com</code> y contraseña{' '}
          <code>despensa</code>, o con <code>marta@prueba.com</code> para ver qué
          ve quien solo consulta.
        </div>
      )}
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
             placeholder="Tu mail" autoComplete="username" required />
      <input type="password" value={clave} onChange={(e) => setClave(e.target.value)}
             placeholder="Contraseña" autoComplete="current-password" required />
      <button className="pri" type="submit" disabled={ocupado}>
        {ocupado ? 'Entrando…' : 'Entrar'}
      </button>
      <p className="error" role="alert">{error || aviso?.texto || ''}</p>
    </form>
  )
}

// ════════════════════════════════════════════════════════════════ MOSTRADOR

function Mostrador({ esDueno, mostrar }) {
  const [texto, setTexto] = useState('')
  const [resultados, setResultados] = useState([])
  const [elegido, setElegido] = useState(null)
  const [codigoFallido, setCodigoFallido] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [destello, setDestello] = useState(0)
  const [sinRed, setSinRed] = useState(false)
  const cajaRef = useRef(null)
  const demora = useRef(null)
  const pedido = useRef(0)

  const foco = useCallback(() => setTimeout(() => cajaRef.current?.focus(), 30), [])
  // Ojo: useEffect(foco, [foco]) NO — lo que devuelve el efecto React lo toma
  // como función de limpieza, y foco devuelve el número del setTimeout.
  // Al desmontar intentaba llamar a ese número y rompía toda la app.
  useEffect(() => { foco() }, [foco])

  const ejecutar = useCallback(async (valor) => {
    const t = valor.trim()
    if (!t) { setResultados([]); setElegido(null); setCodigoFallido(''); return }

    const mio = ++pedido.current
    setBuscando(true)
    try {
      const encontrados = await datos.buscar(t, esDueno)
      if (mio !== pedido.current) return          // llegó una búsqueda más nueva
      setSinRed(datos.estadoConexion().sinConexion)

      if (esCodigo(t)) {
        // Se limpia la casilla haya o no resultado: si el código fallido se
        // queda, la próxima lectura se le pega atrás.
        setTexto(''); foco()
        const exacto = encontrados.find((p) => p.ean === t)
        if (exacto) {
          setElegido(exacto); setResultados([]); setCodigoFallido('')
          setDestello((n) => n + 1)
        } else {
          setElegido(null); setResultados([]); setCodigoFallido(t)
        }
        return
      }

      setCodigoFallido('')
      if (encontrados.length === 1) { setElegido(encontrados[0]); setResultados([]) }
      else { setElegido(null); setResultados(encontrados) }
    } catch (e) {
      mostrar('error', e.message)
    } finally {
      if (mio === pedido.current) setBuscando(false)
    }
  }, [esDueno, foco, mostrar])

  // El lector escribe los 13 dígitos en milisegundos: esperamos a que termine
  // antes de consultar, así no se dispara una búsqueda por cada dígito.
  const alEscribir = (v) => {
    setTexto(v)
    clearTimeout(demora.current)
    demora.current = setTimeout(() => ejecutar(v), 120)
  }

  const alTeclear = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      clearTimeout(demora.current)
      // Con la casilla vacía es el Enter que manda el lector al terminar.
      // Si buscáramos igual, borraríamos la ficha recién mostrada.
      if (texto.trim()) ejecutar(texto)
      return
    }
    if (e.key === 'Escape') { setTexto(''); setResultados([]); setElegido(null); setCodigoFallido(''); foco() }
  }

  return (
    <div onClick={(e) => { if (!e.target.closest('button,input,select,a')) foco() }}>
      {sinRed && <SinConexion />}

      <div className="buscador">
        <label htmlFor="q">Buscar producto</label>
        <input id="q" ref={cajaRef} value={texto} autoComplete="off" spellCheck="false"
               autoCapitalize="off" enterKeyHint="search"
               placeholder="Escaneá el código o escribí el nombre"
               onChange={(e) => alEscribir(e.target.value)} onKeyDown={alTeclear} />
        <p className="pista">
          {buscando ? 'Buscando…' : 'El lector de código de barras escribe acá solo.'}
        </p>
      </div>

      {elegido && <Ficha key={destello} p={elegido} esDueno={esDueno} destello={destello > 0} />}

      {codigoFallido && (
        <div className="aviso-caja">
          <b>Ese código no está cargado</b>
          Código {codigoFallido}.{' '}
          {esDueno ? 'Podés darlo de alta desde Menú → Cargar producto.'
                   : 'Avisale al dueño para que lo cargue.'}
        </div>
      )}

      {resultados.length > 1 && (
        <div className="resultados">
          {resultados.map((p) => (
            <button key={p.id} className="fila" onClick={() => { setElegido(p); setResultados([]) }}>
              <span className="txt">
                <span className="n">{p.nombre} {p.presentacion ?? ''}</span>
                <span className="m">{[p.marca, p.rubro].filter(Boolean).join(' · ')}</span>
              </span>
              <span className="p">${plata(p.precio_venta)}</span>
            </button>
          ))}
        </div>
      )}

      {!elegido && !resultados.length && !codigoFallido && !texto && (
        <div className="aviso-caja"><b>Escaneá o escribí</b>
          El precio aparece acá, en letra grande.</div>
      )}
    </div>
  )
}

function SinConexion() {
  const { fechaDeLaCopia } = datos.estadoConexion()
  // hourCycle h23 para que no diga "p. m." y quede un punto doble al final
  const cuando = fechaDeLaCopia
    ? new Date(fechaDeLaCopia).toLocaleString('es-AR', {
        day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    : null
  return (
    <div className="sin-red">
      <b>Sin conexión</b>
      {cuando
        ? `Estás viendo los precios guardados el ${cuando} h. Pueden estar desactualizados.`
        : 'Estás viendo los últimos precios guardados. Pueden estar desactualizados.'}
    </div>
  )
}

function Ficha({ p, esDueno, destello }) {
  const [verCosto, setVerCosto] = useState(false)
  const dias = diasDesde(p.precio_actualizado_en)
  const viejo = dias !== null && dias > 21
  const m = esDueno ? margen(p.precio_costo, p.precio_venta) : null

  return (
    <article className="ficha">
      <div className={'tapa' + (destello ? ' leido' : '')} />
      <div className="interior">
        <p className="etiq">Producto</p>
        <h1 className="nombre">{p.nombre}</h1>
        <p className="sub">
          {p.marca && <b>{p.marca}</b>}
          {p.presentacion && <span>{p.presentacion}</span>}
          {p.rubro && <span className="chip">{p.rubro}</span>}
        </p>
        <hr className="regla" />
        <p className="etiq">Precio de venta</p>
        <p className="precio"><span className="signo">$</span>{plata(p.precio_venta)}</p>
      </div>

      <div className="pie">
        <span>Código {p.ean || 'sin código'}</span>
        <span className="der">
          {dias !== null && (
            <span className={'chip ' + (viejo ? 'viejo' : 'ok')}>
              {viejo ? `precio de hace ${dias} días`
                     : dias === 0 ? 'actualizado hoy' : `actualizado hace ${dias} día${dias === 1 ? '' : 's'}`}
            </span>
          )}
          {esDueno && (
            <button className="fantasma" onClick={() => setVerCosto((v) => !v)}>
              {verCosto ? 'Ocultar costo' : 'Ver costo'}
            </button>
          )}
        </span>
      </div>

      {esDueno && verCosto && (
        <div className="costos visible">
          <div><span className="etiq">Costo</span><b>${plata(p.precio_costo)}</b></div>
          <div><span className="etiq">Ganancia</span><b>${plata(p.precio_venta - p.precio_costo)}</b></div>
          <div><span className="etiq">Margen</span><b>{m === null ? '—' : pct(m) + ' %'}</b></div>
          <div><span className="etiq">Proveedor</span><b style={{ fontSize: 19 }}>{p.proveedor || '—'}</b></div>
        </div>
      )}
    </article>
  )
}

// ════════════════════════════════════════════════════════════════ CARGAR

const VACIO = {
  nombre: '', marca: '', presentacion: '', ean: '',
  rubro: '', proveedor: '', costo: '', venta: '',
}

function Cargar({ mostrar, alGuardar }) {
  // El primer paso es siempre el código: con el lector en la mano, escaneás y
  // la app te dice si ese producto ya existe antes de que escribas nada.
  const [paso, setPaso] = useState('codigo')
  const [f, setF] = useState(VACIO)
  const [yaExiste, setYaExiste] = useState(null)
  const [buscando, setBuscando] = useState(false)
  const cajaCodigo = useRef(null)
  const primerCampo = useRef(null)
  const demora = useRef(null)

  useEffect(() => {
    if (paso === 'codigo') setTimeout(() => cajaCodigo.current?.focus(), 40)
    else setTimeout(() => primerCampo.current?.focus(), 40)
  }, [paso])

  const revisarCodigo = useCallback(async (codigo) => {
    const c = codigo.trim()
    if (!c) { setYaExiste(null); return }
    setBuscando(true)
    try {
      const encontrados = await datos.buscar(c, true)
      setYaExiste(encontrados.find((p) => String(p.ean ?? '') === c) ?? null)
    } catch { setYaExiste(null) }
    finally { setBuscando(false) }
  }, [])

  const alEscribirCodigo = (v) => {
    setF((x) => ({ ...x, ean: v }))
    setYaExiste(null)
    clearTimeout(demora.current)
    demora.current = setTimeout(() => revisarCodigo(v), 120)
  }

  const seguir = () => {
    clearTimeout(demora.current)
    setPaso('datos')
  }

  if (paso === 'codigo') {
    return (
      <div className="panel">
        <h2>Cargar producto</h2>
        <p className="desc">Empezá por el código de barras: escaneá el producto o escribilo.</p>

        <div className="campo">
          <label htmlFor="paso-ean">Código de barras</label>
          <input id="paso-ean" ref={cajaCodigo} inputMode="numeric" value={f.ean}
                 autoComplete="off" placeholder="Escaneá el producto"
                 className="codigo-grande"
                 onChange={(e) => alEscribirCodigo(e.target.value)}
                 onKeyDown={(e) => {
                   if (e.key !== 'Enter') return
                   e.preventDefault()
                   clearTimeout(demora.current)
                   revisarCodigo(f.ean).then(() => { if (f.ean.trim()) seguir() })
                 }} />
          <span className="ayuda">{buscando ? 'Fijándome si ya está…' : 'El lector escribe acá solo.'}</span>
        </div>

        {yaExiste && (
          <div className="ya-existe">
            <b>Ese código ya está cargado</b>
            <p>{yaExiste.nombre} {yaExiste.presentacion ?? ''} — ${plata(yaExiste.precio_venta)}</p>
            <p className="ayuda">Si querés cambiarle el precio, editalo desde «Todos los productos».</p>
          </div>
        )}

        <div className="acciones">
          <button className="pri" onClick={seguir} disabled={!f.ean.trim() || !!yaExiste}>
            Seguir
          </button>
          <button className="fantasma" onClick={() => { setF({ ...VACIO, ean: '' }); setPaso('datos') }}>
            Este producto no tiene código
          </button>
        </div>
      </div>
    )
  }

  return <Formulario f={f} setF={setF} primerCampo={primerCampo} mostrar={mostrar}
                     volver={() => { setF(VACIO); setYaExiste(null); setPaso('codigo') }}
                     alGuardar={alGuardar} />
}

function Formulario({ f, setF, primerCampo, mostrar, volver, alGuardar }) {
  const [ocupado, setOcupado] = useState(false)
  const [margenTexto, setMargenTexto] = useState('')

  const costo = aNum(f.costo), venta = aNum(f.venta)

  const cambiar = (campo) => (e) => {
    const v = e.target.value
    setF((x) => ({ ...x, [campo]: v }))
    if (campo === 'costo' || campo === 'venta') {
      const c = campo === 'costo' ? aNum(v) : costo
      const p = campo === 'venta' ? aNum(v) : venta
      const m = margen(c, p)
      setMargenTexto(m === null ? '' : String(m).replace('.', ','))
    }
  }

  // Escribir el margen fija el precio de venta a partir del costo.
  const cambiarMargen = (e) => {
    const v = e.target.value
    setMargenTexto(v)
    const nueva = ventaDesdeMargen(costo, aNum(v))
    if (nueva !== null && costo > 0) {
      setF((x) => ({ ...x, venta: String(nueva).replace('.', ',') }))
    }
  }

  const guardar = async (e) => {
    e.preventDefault()
    if (!f.nombre.trim() || !venta) {
      mostrar('error', 'Faltan la descripción y el precio de venta.'); return
    }
    setOcupado(true)
    try {
      await datos.crearProducto({
        nombre: f.nombre.trim(), marca: f.marca.trim(), presentacion: f.presentacion.trim(),
        ean: f.ean.trim(), rubro: f.rubro, proveedor: f.proveedor.trim(),
        precio_costo: costo, precio_venta: venta,
      })
      mostrar('ok', `"${f.nombre.trim()}" quedó cargado.`)
      volver()
    } catch (err) { mostrar('error', err.message) }
    finally { setOcupado(false) }
  }

  return (
    <form className="panel" onSubmit={guardar}>
      <h2>Cargar producto</h2>
      <p className="desc">
        {f.ean ? <>Código <b className="mono">{f.ean}</b>.</> : 'Sin código de barras.'}{' '}
        <button type="button" className="como-enlace" onClick={volver}>cambiar</button>
      </p>

      <CamposProducto f={f} setF={setF} cambiar={cambiar} primerCampo={primerCampo}
                      margenTexto={margenTexto} cambiarMargen={cambiarMargen} costo={costo} venta={venta} />

      <div className="acciones">
        <button className="pri" type="submit" disabled={ocupado}>
          {ocupado ? 'Guardando…' : 'Guardar producto'}
        </button>
        <button type="button" className="fantasma" onClick={volver}>Cancelar</button>
      </div>
    </form>
  )
}

/** Los campos son los mismos al cargar y al editar: van en un solo lugar. */
function CamposProducto({ f, cambiar, primerCampo, margenTexto, cambiarMargen, costo, venta, conCodigo }) {
  const m = margen(costo, venta)
  return (
    <>
      <div className="campos">
        <div className="campo ancho">
          <label htmlFor="c-nombre">Descripción *</label>
          <input id="c-nombre" ref={primerCampo} value={f.nombre} onChange={cambiar('nombre')}
                 placeholder="Aceite de girasol" />
          <span className="ayuda">Como lo nombra el cliente, no como viene en la factura.</span>
        </div>
        <div className="campo">
          <label htmlFor="c-marca">Marca</label>
          <input id="c-marca" value={f.marca} onChange={cambiar('marca')} placeholder="Natura" />
        </div>
        <div className="campo">
          <label htmlFor="c-pres">Presentación</label>
          <input id="c-pres" value={f.presentacion} onChange={cambiar('presentacion')} placeholder="1,5 L" />
          <span className="ayuda">Lo que distingue dos productos con el mismo nombre.</span>
        </div>
        {conCodigo && (
          <div className="campo ancho">
            <label htmlFor="c-ean">Código de barras</label>
            <input id="c-ean" inputMode="numeric" value={f.ean} onChange={cambiar('ean')}
                   placeholder="Escaneá el producto acá" />
          </div>
        )}
        <div className="campo">
          <label htmlFor="c-costo">Precio costo</label>
          <input id="c-costo" inputMode="decimal" value={f.costo} onChange={cambiar('costo')} placeholder="0,00" />
        </div>
        <div className="campo">
          <label htmlFor="c-margen">Margen %</label>
          <input id="c-margen" inputMode="decimal" value={margenTexto} onChange={cambiarMargen}
                 placeholder="0,0" disabled={!costo} />
          <span className="ayuda">{costo ? 'Escribilo y sale el precio de venta.' : 'Cargá primero el costo.'}</span>
        </div>
        <div className="campo">
          <label htmlFor="c-venta">Precio venta *</label>
          <input id="c-venta" inputMode="decimal" value={f.venta} onChange={cambiar('venta')} placeholder="0,00" />
        </div>
        <div className="campo">
          <label htmlFor="c-rubro">Rubro</label>
          <select id="c-rubro" value={f.rubro} onChange={cambiar('rubro')}>
            <option value="">—</option>
            {['Almacén','Bebidas','Limpieza','Lácteos','Panificados','Golosinas','Otros']
              .map((r) => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="c-prov">Proveedor</label>
          <input id="c-prov" value={f.proveedor} onChange={cambiar('proveedor')} placeholder="Distribuidora Sur" />
          <span className="ayuda">Sirve para subir después todos sus precios de una vez.</span>
        </div>
      </div>

      <div className="margen">
        <span>Margen sobre la venta:</span>
        <b>{m === null ? '—' : pct(m) + ' %'}</b>
        <span style={{ color: 'var(--tinta3)' }}>
          {m === null ? 'se calcula solo con el costo y la venta' : `ganás $${plata(venta - costo)} por unidad`}
        </span>
      </div>
    </>
  )
}

// ════════════════════════════════════════════════════════════════ LISTADO

function Listado({ mostrar }) {
  const [items, setItems] = useState(null)
  const [editando, setEditando] = useState(null)
  const [filtro, setFiltro] = useState('')

  const cargar = useCallback(async () => {
    try { setItems(await datos.listarTodos()) }
    catch (e) { mostrar('error', e.message); setItems([]) }
  }, [mostrar])

  useEffect(() => { cargar() }, [cargar])

  if (items === null) return <p className="centrado">Cargando…</p>

  if (editando) {
    return (
      <Editor producto={editando} mostrar={mostrar}
              volver={() => setEditando(null)}
              alGuardar={async () => { setEditando(null); await cargar() }} />
    )
  }

  const sinTilde = (t) => String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const visibles = filtro.trim()
    ? items.filter((p) => sinTilde([p.nombre, p.marca, p.presentacion, p.ean].join(' '))
        .includes(sinTilde(filtro.trim())))
    : items

  return (
    <div className="panel">
      <h2>Todos los productos</h2>
      <p className="desc">{items.length} cargados. Tocá uno para editarlo.</p>

      <div className="campo" style={{ marginBottom: 16 }}>
        <input value={filtro} onChange={(e) => setFiltro(e.target.value)}
               placeholder="Filtrar por nombre, marca o código" autoComplete="off" />
      </div>

      <div className="tabla-scroll">
        <table>
          <thead>
            <tr><th>Producto</th>
                <th className="num">Costo</th><th className="num">Venta</th><th className="num">Margen</th></tr>
          </thead>
          <tbody>
            {visibles.map((p) => {
              const m = margen(p.precio_costo, p.precio_venta)
              return (
                <tr key={p.id} className="fila-clic" onClick={() => setEditando(p)}>
                  <td className="nom">{p.nombre} {p.presentacion ?? ''}
                    <div className="tenue">{[p.marca, p.ean].filter(Boolean).join(' · ') || '—'}</div></td>
                  <td className="num tenue">{plata(p.precio_costo)}</td>
                  <td className="num">{plata(p.precio_venta)}</td>
                  <td className="num">{m === null ? '—' : pct(m) + '%'}</td>
                </tr>
              )
            })}
            {!visibles.length && (
              <tr><td colSpan="4" className="tenue">
                {items.length ? 'Nada coincide con ese filtro.'
                              : 'Todavía no hay productos. Cargá el primero desde el menú.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════ EDITOR

function Editor({ producto, mostrar, volver, alGuardar }) {
  const coma = (n) => String(n ?? 0).replace('.', ',')
  const [f, setF] = useState({
    nombre: producto.nombre ?? '',
    marca: producto.marca ?? '',
    presentacion: producto.presentacion ?? '',
    ean: producto.ean ?? '',
    rubro: producto.rubro ?? '',
    proveedor: producto.proveedor ?? '',
    costo: coma(producto.precio_costo),
    venta: coma(producto.precio_venta),
  })
  const [margenTexto, setMargenTexto] = useState(() => {
    const m = margen(producto.precio_costo, producto.precio_venta)
    return m === null ? '' : String(m).replace('.', ',')
  })
  const [ocupado, setOcupado] = useState(false)
  const [confirmarBaja, setConfirmarBaja] = useState(false)
  const primerCampo = useRef(null)
  // Se guarda al abrir el editor. Leerlo después de guardar da el valor nuevo.
  const [precioOriginal] = useState(Number(producto.precio_venta ?? 0))

  const costo = aNum(f.costo), venta = aNum(f.venta)

  const cambiar = (campo) => (e) => {
    const v = e.target.value
    setF((x) => ({ ...x, [campo]: v }))
    if (campo === 'costo' || campo === 'venta') {
      const c = campo === 'costo' ? aNum(v) : costo
      const p = campo === 'venta' ? aNum(v) : venta
      const m = margen(c, p)
      setMargenTexto(m === null ? '' : String(m).replace('.', ','))
    }
  }

  const cambiarMargen = (e) => {
    const v = e.target.value
    setMargenTexto(v)
    const nueva = ventaDesdeMargen(costo, aNum(v))
    if (nueva !== null && costo > 0) setF((x) => ({ ...x, venta: coma(nueva) }))
  }

  const guardar = async (e) => {
    e.preventDefault()
    if (!f.nombre.trim() || !venta) {
      mostrar('error', 'Faltan la descripción y el precio de venta.'); return
    }
    setOcupado(true)
    try {
      await datos.actualizarProducto(producto.id, {
        nombre: f.nombre.trim(),
        marca: f.marca.trim() || null,
        presentacion: f.presentacion.trim() || null,
        ean: f.ean.trim() || null,
        rubro: f.rubro || null,
        proveedor: f.proveedor.trim() || null,
        precio_costo: costo,
        precio_venta: venta,
      })
      const cambioPrecio = venta !== precioOriginal
      mostrar('ok', cambioPrecio
        ? `"${f.nombre.trim()}" pasó a $${plata(venta)}.`
        : `"${f.nombre.trim()}" quedó actualizado.`)
      await alGuardar()
    } catch (err) { mostrar('error', err.message) }
    finally { setOcupado(false) }
  }

  const darDeBaja = async () => {
    setOcupado(true)
    try {
      await datos.desactivarProducto(producto.id)
      mostrar('ok', `"${producto.nombre}" se sacó de la lista.`)
      await alGuardar()
    } catch (err) { mostrar('error', err.message) }
    finally { setOcupado(false) }
  }

  const antes = precioOriginal
  const dif = antes && venta ? Math.round(((venta - antes) / antes) * 1000) / 10 : null

  return (
    <form className="panel" onSubmit={guardar}>
      <h2>Editar producto</h2>
      <p className="desc">
        Precio actual: <b>${plata(antes)}</b>
        {dif !== null && dif !== 0 && (
          <span className={dif > 0 ? 'dif sube' : 'dif baja'}>
            {dif > 0 ? '+' : ''}{pct(dif)} % con lo que estás escribiendo
          </span>
        )}
      </p>

      <CamposProducto f={f} setF={setF} cambiar={cambiar} primerCampo={primerCampo}
                      margenTexto={margenTexto} cambiarMargen={cambiarMargen}
                      costo={costo} venta={venta} conCodigo />

      <div className="acciones">
        <button className="pri" type="submit" disabled={ocupado}>
          {ocupado ? 'Guardando…' : 'Guardar cambios'}
        </button>
        <button type="button" className="fantasma" onClick={volver} disabled={ocupado}>Cancelar</button>
        {!confirmarBaja ? (
          <button type="button" className="peligro" onClick={() => setConfirmarBaja(true)} disabled={ocupado}>
            Sacar de la lista
          </button>
        ) : (
          <>
            <button type="button" className="peligro" onClick={darDeBaja} disabled={ocupado}>
              Sí, sacarlo
            </button>
            <button type="button" className="fantasma" onClick={() => setConfirmarBaja(false)}>No</button>
          </>
        )}
      </div>

      {confirmarBaja && (
        <p className="ayuda" style={{ marginTop: 10 }}>
          No se borra: deja de aparecer en el buscador y en la lista, pero queda su historial.
        </p>
      )}
    </form>
  )
}

// ════════════════════════════════════════════════════════════════ EXCEL

function Excel({ mostrar }) {
  const [ocupado, setOcupado] = useState('')
  const [previa, setPrevia] = useState(null)
  const [archivo, setArchivo] = useState('')
  const entrada = useRef(null)

  const exportar = async () => {
    setOcupado('exportando')
    try {
      const { exportar: bajar } = await import('./excel.js')
      const n = await bajar(await datos.listarTodos())
      mostrar('ok', `Se bajó un Excel con ${n} productos.`)
    } catch (e) { mostrar('error', e.message) }
    finally { setOcupado('') }
  }

  const elegir = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setOcupado('leyendo'); setPrevia(null); setArchivo(file.name)
    try {
      const excel = await import('./excel.js')
      const filas = await excel.leerArchivo(file)
      const actuales = await datos.listarTodos()
      setPrevia(excel.comparar(filas, actuales))
    } catch (err) {
      mostrar('error', err.message); setArchivo('')
    } finally {
      setOcupado(''); if (entrada.current) entrada.current.value = ''
    }
  }

  const aplicar = async () => {
    setOcupado('importando')
    try {
      const r = await datos.importarProductos(previa)
      mostrar('ok', `Listo: ${r.creados} productos nuevos y ${r.actualizados} actualizados.`)
      setPrevia(null); setArchivo('')
    } catch (e) { mostrar('error', e.message) }
    finally { setOcupado('') }
  }

  return (
    <>
      <div className="panel">
        <h2>Bajar la lista a Excel</h2>
        <p className="desc">
          Un archivo con todos los productos, sus códigos y sus dos precios. Sirve
          de respaldo y también para editar precios en masa y volver a subirlos.
        </p>
        <div className="acciones">
          <button className="pri" onClick={exportar} disabled={!!ocupado}>
            {ocupado === 'exportando' ? 'Preparando…' : 'Bajar Excel'}
          </button>
        </div>
        <p className="ayuda" style={{ marginTop: 12 }}>
          Los códigos de barras van guardados como texto. Si fueran números, Excel
          convierte los 13 dígitos a notación científica y el código se pierde sin
          avisar.
        </p>
      </div>

      <div className="panel">
        <h2>Subir un Excel</h2>
        <p className="desc">
          Antes de tocar nada te muestro qué va a cambiar. Los productos se
          reconocen por el código de barras o por el ID; los que no coinciden con
          nada se cargan como nuevos.
        </p>

        <div className="acciones">
          <input type="file" ref={entrada} accept=".xlsx,.xlsm" onChange={elegir}
                 style={{ display: 'none' }} id="archivo-excel" />
          <button onClick={() => entrada.current?.click()} disabled={!!ocupado}>
            {ocupado === 'leyendo' ? 'Leyendo…' : 'Elegir archivo'}
          </button>
          {archivo && <span className="ayuda" style={{ alignSelf: 'center' }}>{archivo}</span>}
        </div>
      </div>

      {previa && <Previa previa={previa} aplicar={aplicar} cancelar={() => { setPrevia(null); setArchivo('') }} ocupado={ocupado} />}
    </>
  )
}

function Previa({ previa, aplicar, cancelar, ocupado }) {
  const { nuevos, cambios, iguales, errores } = previa
  const nada = !nuevos.length && !cambios.length

  return (
    <div className="panel">
      <h2>Esto es lo que va a pasar</h2>

      <div className="resumen">
        <div className={nuevos.length ? 'dato bien' : 'dato'}>
          <b>{nuevos.length}</b><span>productos nuevos</span></div>
        <div className={cambios.length ? 'dato bien' : 'dato'}>
          <b>{cambios.length}</b><span>cambian</span></div>
        <div className="dato"><b>{iguales.length}</b><span>sin cambios</span></div>
        <div className={errores.length ? 'dato mal' : 'dato'}>
          <b>{errores.length}</b><span>con problemas</span></div>
      </div>

      {!!cambios.length && (
        <>
          <h3 style={{ marginTop: 22 }}>Cambios de precio</h3>
          <div className="tabla-scroll">
            <table>
              <thead><tr><th>Producto</th><th className="num">Venta antes</th>
                         <th className="num">Venta después</th><th className="num">Dif.</th></tr></thead>
              <tbody>
                {cambios.slice(0, 40).map((c) => {
                  const antes = Number(c.antes.precio_venta ?? 0)
                  const despues = Number(c.campos.precio_venta)
                  const dif = antes ? Math.round(((despues - antes) / antes) * 1000) / 10 : null
                  return (
                    <tr key={c.fila}>
                      <td className="nom">{c.campos.nombre} {c.campos.presentacion ?? ''}</td>
                      <td className="num tenue">{plata(antes)}</td>
                      <td className="num">{plata(despues)}</td>
                      <td className="num" style={{ color: dif > 0 ? 'var(--ambar)' : dif < 0 ? 'var(--verde)' : 'inherit' }}>
                        {dif === null ? '—' : (dif > 0 ? '+' : '') + pct(dif) + '%'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {cambios.length > 40 && <p className="ayuda">…y {cambios.length - 40} más.</p>}
        </>
      )}

      {!!nuevos.length && (
        <>
          <h3 style={{ marginTop: 22 }}>Se van a cargar</h3>
          <ul className="lista-simple">
            {nuevos.slice(0, 20).map((n) => (
              <li key={n.fila}>{n.campos.nombre} {n.campos.presentacion ?? ''} — ${plata(n.campos.precio_venta)}</li>
            ))}
          </ul>
          {nuevos.length > 20 && <p className="ayuda">…y {nuevos.length - 20} más.</p>}
        </>
      )}

      {!!errores.length && (
        <>
          <h3 style={{ marginTop: 22, color: 'var(--rojo)' }}>Filas que voy a saltear</h3>
          <ul className="lista-simple">
            {errores.slice(0, 20).map((e, i) => (
              <li key={i}>Fila {e.fila}{e.nombre ? ` (${e.nombre})` : ''}: {e.motivo}</li>
            ))}
          </ul>
          {errores.length > 20 && <p className="ayuda">…y {errores.length - 20} más.</p>}
        </>
      )}

      <div className="acciones">
        <button className="pri" onClick={aplicar} disabled={!!ocupado || nada}>
          {ocupado === 'importando' ? 'Aplicando…'
            : nada ? 'No hay nada para aplicar'
            : `Aplicar ${nuevos.length + cambios.length} cambios`}
        </button>
        <button className="fantasma" onClick={cancelar} disabled={!!ocupado}>Cancelar</button>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════ ACCESOS

function Accesos({ mostrar }) {
  const [gente, setGente] = useState(null)
  const [f, setF] = useState({ nombre: '', email: '', clave: '' })
  const [ocupado, setOcupado] = useState(false)

  const cargar = useCallback(async () => {
    try { setGente(await datos.listarPerfiles()) }
    catch (e) { mostrar('error', e.message); setGente([]) }
  }, [mostrar])

  useEffect(() => { cargar() }, [cargar])

  const crear = async (e) => {
    e.preventDefault()
    if (!f.nombre.trim() || !f.email.trim() || f.clave.length < 6) {
      mostrar('error', 'Completá nombre y mail, y usá una contraseña de al menos 6 caracteres.')
      return
    }
    setOcupado(true)
    try {
      await datos.darAcceso({ nombre: f.nombre.trim(), email: f.email, clave: f.clave })
      mostrar('ok', `${f.nombre.trim()} ya puede entrar con ${f.email}.`)
      setF({ nombre: '', email: '', clave: '' })
      cargar()
    } catch (err) { mostrar('error', err.message) }
    finally { setOcupado(false) }
  }

  if (gente === null) return <p className="centrado">Cargando…</p>

  return (
    <>
      <form className="panel" onSubmit={crear}>
        <h2>Dar acceso a alguien</h2>
        <p className="desc">
          Quien reciba un acceso <b>solo puede consultar precios</b>: busca, ve el nombre y el
          precio de venta, y nada más. Los costos no le llegan al navegador.
        </p>
        <div className="campos">
          <div className="campo">
            <label htmlFor="a-nombre">Nombre</label>
            <input id="a-nombre" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })}
                   placeholder="Marta" />
          </div>
          <div className="campo">
            <label htmlFor="a-email">Mail</label>
            <input id="a-email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })}
                   placeholder="marta@ejemplo.com" autoCapitalize="off" />
            <span className="ayuda">Con la confirmación por mail apagada, no hace falta que exista.</span>
          </div>
          <div className="campo">
            <label htmlFor="a-clave">Contraseña</label>
            <input id="a-clave" value={f.clave} onChange={(e) => setF({ ...f, clave: e.target.value })}
                   placeholder="mínimo 6 caracteres" />
            <span className="ayuda">Se la decís vos.</span>
          </div>
        </div>
        <div className="acciones">
          <button className="pri" type="submit" disabled={ocupado}>
            {ocupado ? 'Creando…' : 'Dar acceso'}
          </button>
        </div>
      </form>

      <div className="panel">
        <h3>Quién tiene acceso</h3>
        <div className="tabla-scroll">
          <table>
            <thead><tr><th>Persona</th><th>Puede</th><th className="num">Acceso</th></tr></thead>
            <tbody>
              {gente.map((u) => (
                <tr key={u.id}>
                  <td className="nom">{u.nombre}</td>
                  <td>{u.dueno ? 'Todo' : 'Solo consultar precios'}</td>
                  <td className="num">
                    {u.dueno ? <span className="chip ok">dueño</span> : (
                      <button onClick={async () => {
                        try { await datos.cambiarAcceso(u.id, !u.activo); cargar() }
                        catch (e) { mostrar('error', e.message) }
                      }}>{u.activo ? 'Quitar acceso' : 'Devolver acceso'}</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
