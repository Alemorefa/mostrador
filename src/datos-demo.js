// MODO PRUEBA — la misma interfaz que datos-supabase.js, pero todo en memoria.
//
// Sirve para ver la app y ajustar la pantalla sin haber creado nada en Supabase.
// Se activa solo cuando faltan las variables de entorno. Nada de lo que cargues
// acá se guarda: al recargar la página vuelve a los datos de ejemplo.

const espera = (ms = 120) => new Promise((r) => setTimeout(r, ms))

const sinTilde = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

const hace = (dias) => new Date(Date.now() - dias * 86400000).toISOString()

// Copias, no referencias. Un servidor de verdad manda datos nuevos cada vez;
// si acá devolvemos el objeto vivo, la app se comporta distinto en prueba que
// en producción y los errores aparecen recién al final.
const copia = (o) => ({ ...o })

let PRODUCTOS = [
  { id: 1,  nombre: 'Aceite de girasol', marca: 'Natura', presentacion: '1,5 L', ean: '7790001112233', rubro: 'Almacén', proveedor: 'Molinos', precio_costo: 2450, precio_venta: 3390, precio_actualizado_en: hace(3), activo: true },
  { id: 2,  nombre: 'Gaseosa cola', marca: 'Coca-Cola', presentacion: '2,25 L', ean: '7790895000119', rubro: 'Bebidas', proveedor: 'Coca-Cola', precio_costo: 2180, precio_venta: 2990, precio_actualizado_en: hace(1), activo: true },
  { id: 3,  nombre: 'Gaseosa cola', marca: 'Coca-Cola', presentacion: '500 ml', ean: '7790895000126', rubro: 'Bebidas', proveedor: 'Coca-Cola', precio_costo: 890, precio_venta: 1350, precio_actualizado_en: hace(1), activo: true },
  { id: 4,  nombre: 'Yerba mate', marca: 'Playadito', presentacion: '1 kg', ean: '7792900000015', rubro: 'Almacén', proveedor: 'Distribuidora Sur', precio_costo: 4100, precio_venta: 5600, precio_actualizado_en: hace(12), activo: true },
  { id: 5,  nombre: 'Leche entera larga vida', marca: 'La Serenísima', presentacion: '1 L', ean: '7791234500012', rubro: 'Lácteos', proveedor: 'La Serenísima', precio_costo: 1180, precio_venta: 1590, precio_actualizado_en: hace(2), activo: true },
  { id: 6,  nombre: 'Fideos guiseros', marca: 'Matarazzo', presentacion: '500 g', ean: '7790387001234', rubro: 'Almacén', proveedor: 'Molinos', precio_costo: 960, precio_venta: 1390, precio_actualizado_en: hace(8), activo: true },
  { id: 7,  nombre: 'Alfajor triple', marca: 'Jorgito', presentacion: 'unidad', ean: '7790040112255', rubro: 'Golosinas', proveedor: 'Arcor', precio_costo: 520, precio_venta: 850, precio_actualizado_en: hace(5), activo: true },
  { id: 8,  nombre: 'Detergente', marca: 'Magistral', presentacion: '750 ml', ean: '7794000556677', rubro: 'Limpieza', proveedor: 'Distribuidora Sur', precio_costo: 1720, precio_venta: 2450, precio_actualizado_en: hace(41), activo: true },
  { id: 9,  nombre: 'Pan lactal', marca: 'Bimbo', presentacion: '390 g', ean: '7790070889900', rubro: 'Panificados', proveedor: 'Distribuidora Sur', precio_costo: 1890, precio_venta: 2650, precio_actualizado_en: hace(4), activo: true },
  { id: 10, nombre: 'Azúcar', marca: 'Ledesma', presentacion: '1 kg', ean: '7790180334455', rubro: 'Almacén', proveedor: 'Molinos', precio_costo: 1050, precio_venta: 1490, precio_actualizado_en: hace(9), activo: true },
  { id: 11, nombre: 'Papel higiénico', marca: 'Elegante', presentacion: '4 rollos', ean: '7791290667788', rubro: 'Limpieza', proveedor: 'Distribuidora Sur', precio_costo: 1640, precio_venta: 2350, precio_actualizado_en: hace(27), activo: true },
  { id: 12, nombre: 'Mayonesa', marca: "Hellmann's", presentacion: '475 g', ean: '7794500223344', rubro: 'Almacén', proveedor: 'Molinos', precio_costo: 1490, precio_venta: 2190, precio_actualizado_en: hace(6), activo: true },
]

let PERFILES = [
  { id: 'demo-1', nombre: 'Alex',  dueno: true,  activo: true, creado_en: hace(30) },
  { id: 'demo-2', nombre: 'Marta', dueno: false, activo: true, creado_en: hace(10) },
]

// Cuentas de prueba. Están a la vista porque esto no toca ningún dato real.
const CUENTAS = [
  { email: 'alex@prueba.com',  clave: 'despensa', perfil: 'demo-1' },
  { email: 'marta@prueba.com', clave: 'despensa', perfil: 'demo-2' },
]

let sesion = null

// ── sesión ──────────────────────────────────────────────────────────────────

export async function entrar(email, clave) {
  await espera()
  const c = CUENTAS.find((x) => x.email === email.trim().toLowerCase() && x.clave === clave)
  if (!c) throw new Error('Usuario o contraseña incorrectos. En modo prueba: alex@prueba.com / despensa')
  sesion = PERFILES.find((p) => p.id === c.perfil)
  if (!sesion?.activo) throw new Error('Ese acceso está dado de baja.')
  return sesion
}

export async function salir() { sesion = null }

export async function sesionActual() { return sesion }

export async function miPerfil() { return sesion }

// ── productos ───────────────────────────────────────────────────────────────

/** En modo prueba imitamos lo que hace la base: al que solo consulta le
 *  sacamos las columnas de costo antes de devolverle nada. */
const recortar = (p) => ({
  id: p.id, nombre: p.nombre, marca: p.marca, presentacion: p.presentacion,
  ean: p.ean, rubro: p.rubro, precio_venta: p.precio_venta,
  precio_actualizado_en: p.precio_actualizado_en,
})

export async function buscar(texto, esDueno) {
  await espera(80)
  const t = sinTilde(texto.trim())
  if (!t) return []

  const encontrados = PRODUCTOS.filter((p) => {
    if (!p.activo) return false
    if (p.ean === texto.trim()) return true
    const campo = sinTilde([p.nombre, p.marca, p.presentacion, p.rubro].filter(Boolean).join(' '))
    return t.split(/\s+/).every((w) => campo.includes(w))
  })
  return esDueno ? encontrados.map(copia) : encontrados.map(recortar)
}

export async function porCodigo(ean, esDueno) {
  const r = await buscar(ean, esDueno)
  return r.find((p) => p.ean === ean) ?? null
}

export async function listarTodos() {
  await espera()
  return PRODUCTOS.filter((p) => p.activo)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    .map(copia)
}

export async function crearProducto(p) {
  await espera()
  if (p.ean && PRODUCTOS.some((x) => x.ean === p.ean)) {
    throw new Error('Ya hay un producto cargado con ese código de barras.')
  }
  const nuevo = {
    ...p, id: Date.now(), activo: true,
    precio_actualizado_en: new Date().toISOString(),
  }
  PRODUCTOS.push(nuevo)
  return copia(nuevo)
}

export async function actualizarProducto(id, cambios) {
  await espera()
  const p = PRODUCTOS.find((x) => x.id === id)
  if (!p) throw new Error('No encontré ese producto.')
  Object.assign(p, cambios, { precio_actualizado_en: new Date().toISOString() })
  return copia(p)
}

export async function desactivarProducto(id) {
  await espera()
  const p = PRODUCTOS.find((x) => x.id === id)
  if (p) p.activo = false
}

export async function historialDePrecios() { await espera(); return [] }

// ── accesos ─────────────────────────────────────────────────────────────────

export async function listarPerfiles() { await espera(); return PERFILES.map(copia) }

export async function darAcceso({ nombre, email, clave }) {
  await espera(300)
  if (CUENTAS.some((c) => c.email === email.trim().toLowerCase())) {
    throw new Error('Ya existe una cuenta con ese mail.')
  }
  const id = 'demo-' + Date.now()
  PERFILES.push({ id, nombre, dueno: false, activo: true, creado_en: new Date().toISOString() })
  CUENTAS.push({ email: email.trim().toLowerCase(), clave, perfil: id })
  return id
}

export async function cambiarAcceso(id, activo) {
  await espera()
  const p = PERFILES.find((x) => x.id === id)
  if (p) p.activo = activo
}

export async function importarProductos({ nuevos, cambios }) {
  await espera(300)
  nuevos.forEach((n) => {
    PRODUCTOS.push({
      ...n.campos, id: Date.now() + Math.floor(PRODUCTOS.length * 7 + 1),
      activo: true, precio_actualizado_en: new Date().toISOString(),
    })
  })
  cambios.forEach((c) => {
    const p = PRODUCTOS.find((x) => x.id === c.id)
    if (p) Object.assign(p, c.campos, { precio_actualizado_en: new Date().toISOString() })
  })
  return { creados: nuevos.length, actualizados: cambios.length }
}
