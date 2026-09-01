// Todo lo que habla con la base, en un solo lugar.
// El resto de la app no sabe que existe Supabase.

import { supabase, clienteTemporal, explicar } from './supabase.js'

const fallar = (error) => { throw new Error(explicar(error)) }

// ── sesión ──────────────────────────────────────────────────────────────────

export async function entrar(email, clave) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(), password: clave,
  })
  if (error) fallar(error)
  return data.user
}

export async function salir() {
  await supabase.auth.signOut()
}

export async function sesionActual() {
  const { data } = await supabase.auth.getSession()
  return data.session?.user ?? null
}

export async function miPerfil() {
  const { data: sesion } = await supabase.auth.getSession()
  const uid = sesion.session?.user?.id
  if (!uid) return null

  const { data, error } = await supabase
    .from('perfiles').select('*').eq('id', uid).maybeSingle()
  if (error) fallar(error)

  if (!data) {
    throw new Error(
      'Tu cuenta existe pero no tiene perfil. Corré en Supabase:\n' +
      `insert into public.perfiles (id, nombre, dueno) values ('${uid}', 'Tu nombre', true);`
    )
  }
  if (!data.activo) throw new Error('Tu acceso está dado de baja.')
  return data
}

// ── productos ───────────────────────────────────────────────────────────────
// Quien consulta lee la vista (sin costos). El dueño lee la tabla completa.

export async function buscar(texto, esDueno) {
  const t = texto.trim()
  if (!t) return []

  // Las dos búsquedas son funciones de la base: el texto viaja como parámetro,
  // nunca armando un filtro por concatenación. La del dueño devuelve costos;
  // la otra ni siquiera tiene esa columna.
  const funcion = esDueno ? 'buscar_productos_dueno' : 'buscar_productos'
  const { data, error } = await supabase.rpc(funcion, { texto: t })
  if (error) fallar(error)
  return data ?? []
}

export async function porCodigo(ean, esDueno) {
  const encontrados = await buscar(ean, esDueno)
  return encontrados.find((p) => p.ean === ean) ?? null
}

export async function listarTodos() {
  const { data, error } = await supabase
    .from('productos').select('*').eq('activo', true).order('nombre')
  if (error) fallar(error)
  return data ?? []
}

export async function crearProducto(p) {
  const { data, error } = await supabase.from('productos').insert({
    nombre: p.nombre,
    marca: p.marca || null,
    presentacion: p.presentacion || null,
    ean: p.ean || null,
    rubro: p.rubro || null,
    proveedor: p.proveedor || null,
    precio_costo: p.precio_costo,
    precio_venta: p.precio_venta,
  }).select().single()
  if (error) fallar(error)
  return data
}

export async function actualizarProducto(id, cambios) {
  const { data, error } = await supabase
    .from('productos').update(cambios).eq('id', id).select().single()
  if (error) fallar(error)
  return data
}

/** No borra: desactiva. Un producto borrado se lleva su historial puesto. */
export async function desactivarProducto(id) {
  const { error } = await supabase.from('productos').update({ activo: false }).eq('id', id)
  if (error) fallar(error)
}

export async function historialDePrecios(productoId) {
  const { data, error } = await supabase
    .from('precios_historial')
    .select('*').eq('producto_id', productoId)
    .order('vigente_desde', { ascending: false }).limit(20)
  if (error) fallar(error)
  return data ?? []
}

// ── accesos ─────────────────────────────────────────────────────────────────

export async function listarPerfiles() {
  const { data, error } = await supabase
    .from('perfiles').select('*').order('creado_en')
  if (error) fallar(error)
  return data ?? []
}

/**
 * Da de alta a alguien con acceso de solo consulta.
 * Usa un cliente temporal para no perder tu propia sesión en el intento.
 */
export async function darAcceso({ nombre, email, clave }) {
  const temporal = clienteTemporal()
  const { data, error } = await temporal.auth.signUp({
    email: email.trim(), password: clave,
  })
  if (error) fallar(error)

  const nuevoId = data.user?.id
  if (!nuevoId) throw new Error('Supabase no devolvió la cuenta nueva. Revisá si "Confirm email" está apagado.')

  const { error: errorPerfil } = await supabase.from('perfiles').insert({
    id: nuevoId, nombre, dueno: false, activo: true,
  })
  if (errorPerfil) {
    throw new Error(
      'Se creó la cuenta pero no el perfil: ' + explicar(errorPerfil) +
      '. La cuenta queda sin acceso hasta que se le cree el perfil.'
    )
  }
  return nuevoId
}

export async function cambiarAcceso(id, activo) {
  const { error } = await supabase.from('perfiles').update({ activo }).eq('id', id)
  if (error) fallar(error)
}

// ── importación ─────────────────────────────────────────────────────────────

/**
 * Aplica lo que devolvió excel.comparar(). Va en lote y no fila por fila:
 * 500 productos serían 500 viajes al servidor.
 */
export async function importarProductos({ nuevos, cambios }) {
  let creados = 0, actualizados = 0

  if (nuevos.length) {
    const { error } = await supabase.from('productos').insert(nuevos.map((n) => n.campos))
    if (error) fallar(error)
    creados = nuevos.length
  }

  if (cambios.length) {
    const { error } = await supabase
      .from('productos')
      .upsert(cambios.map((c) => ({ id: c.id, ...c.campos })), { onConflict: 'id' })
    if (error) fallar(error)
    actualizados = cambios.length
  }

  return { creados, actualizados }
}
