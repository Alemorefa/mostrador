// Copia local de los productos, para que el mostrador siga andando sin internet.
//
// No reemplaza al respaldo en Excel: esto es la app guardándose una copia para
// sí misma, en el navegador del celular. No aparece como archivo en ningún lado.

const CLAVE = 'mostrador.productos.v1'

/** Guarda la lista después de cada carga que salió bien. */
export function guardar(productos) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify({
      guardado_en: new Date().toISOString(),
      productos,
    }))
  } catch {
    // Sin espacio o en modo incógnito: no es motivo para romper nada.
  }
}

/** Devuelve { productos, guardado_en } o null si nunca se guardó. */
export function leer() {
  try {
    const crudo = localStorage.getItem(CLAVE)
    if (!crudo) return null
    const d = JSON.parse(crudo)
    return Array.isArray(d?.productos) ? d : null
  } catch {
    return null
  }
}

export function borrar() {
  try { localStorage.removeItem(CLAVE) } catch {}
}

/** Busca dentro de la copia local, con las mismas reglas que el buscador real. */
export function buscarEnCopia(texto, esDueno) {
  const guardado = leer()
  if (!guardado) return null

  const sinTilde = (t) => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const t = sinTilde(texto.trim())
  if (!t) return []

  const encontrados = guardado.productos.filter((p) => {
    if (String(p.ean ?? '') === texto.trim()) return true
    const campo = sinTilde([p.nombre, p.marca, p.presentacion, p.rubro].filter(Boolean).join(' '))
    return t.split(/\s+/).every((w) => campo.includes(w))
  })

  // Por las dudas: si la copia se guardó cuando eras dueño y ahora consulta
  // alguien más, le sacamos los costos igual.
  return esDueno ? encontrados : encontrados.map((p) => ({
    id: p.id, nombre: p.nombre, marca: p.marca, presentacion: p.presentacion,
    ean: p.ean, rubro: p.rubro, precio_venta: p.precio_venta,
    precio_actualizado_en: p.precio_actualizado_en,
  }))
}

export function fechaDeLaCopia() {
  return leer()?.guardado_en ?? null
}

/** Un fallo de red se distingue de un "no tenés permiso". */
export function esFalloDeRed(error) {
  const m = String(error?.message ?? error ?? '')
  return /comunicarme con el servidor|Failed to fetch|NetworkError|network|offline|Load failed/i.test(m)
}
