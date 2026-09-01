// Elige contra qué habla la app.
//
//   Con .env configurado  → Supabase de verdad
//   Sin .env              → modo prueba, datos de ejemplo en memoria
//
// El resto de la app no se entera de cuál de los dos está usando.

import { HAY_SUPABASE } from './supabase.js'
import * as real from './datos-supabase.js'
import * as demo from './datos-demo.js'

import * as cache from './cache.js'

const impl = HAY_SUPABASE ? real : demo

let sinConexion = false

export const modoPrueba = !HAY_SUPABASE

export const entrar               = (...a) => impl.entrar(...a)
export const salir                = (...a) => { cache.borrar(); return impl.salir(...a) }
export const sesionActual         = (...a) => impl.sesionActual(...a)
export const miPerfil             = (...a) => impl.miPerfil(...a)

/**
 * Buscar y listar pasan por la copia local: si el servidor no contesta,
 * seguimos mostrando los últimos precios conocidos en vez de un error.
 * Lo que escribe (cargar, cambiar precios, dar acceso) NO tiene respaldo:
 * sin servidor no se puede guardar, y fingir que sí sería peor.
 */
export async function buscar(texto, esDueno) {
  try {
    const r = await impl.buscar(texto, esDueno)
    sinConexion = false        // volvió el servidor: sacamos el cartel
    return r
  } catch (e) {
    if (!cache.esFalloDeRed(e)) throw e
    const deLaCopia = cache.buscarEnCopia(texto, esDueno)
    if (deLaCopia === null) throw e          // nunca se guardó nada todavía
    sinConexion = true
    return deLaCopia
  }
}

export async function listarTodos() {
  try {
    const lista = await impl.listarTodos()
    cache.guardar(lista)
    sinConexion = false
    return lista
  } catch (e) {
    if (!cache.esFalloDeRed(e)) throw e
    const guardado = cache.leer()
    if (!guardado) throw e
    sinConexion = true
    return guardado.productos
  }
}

/** Se llama al entrar: deja la copia lista para cuando se corte. */
export async function refrescarCopia() {
  try {
    cache.guardar(await impl.listarTodos())
    sinConexion = false
    return true
  } catch {
    return false
  }
}

export const estadoConexion = () => ({
  sinConexion,
  fechaDeLaCopia: cache.fechaDeLaCopia(),
})

export const porCodigo            = (...a) => impl.porCodigo(...a)
export const crearProducto        = (...a) => impl.crearProducto(...a)
export const actualizarProducto   = (...a) => impl.actualizarProducto(...a)
export const desactivarProducto   = (...a) => impl.desactivarProducto(...a)
export const importarProductos    = (...a) => impl.importarProductos(...a)
export const historialDePrecios   = (...a) => impl.historialDePrecios(...a)

export const listarPerfiles       = (...a) => impl.listarPerfiles(...a)
export const darAcceso            = (...a) => impl.darAcceso(...a)
export const cambiarAcceso        = (...a) => impl.cambiarAcceso(...a)
