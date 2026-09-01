// Exportar e importar la lista de productos en Excel.
//
// La librería se carga solo cuando entrás a esta pantalla (import dinámico).
// Pesa cerca de un mega: el celular del mostrador, que nunca abre esto, no lo
// baja nunca.

const COLUMNAS = [
  { clave: 'id',            titulo: 'ID',           ancho: 8,  texto: false },
  { clave: 'ean',           titulo: 'Codigo',       ancho: 18, texto: true  },
  { clave: 'nombre',        titulo: 'Descripcion',  ancho: 32, texto: false },
  { clave: 'marca',         titulo: 'Marca',        ancho: 18, texto: false },
  { clave: 'presentacion',  titulo: 'Presentacion', ancho: 14, texto: false },
  { clave: 'rubro',         titulo: 'Rubro',        ancho: 14, texto: false },
  { clave: 'proveedor',     titulo: 'Proveedor',    ancho: 20, texto: false },
  { clave: 'precio_costo',  titulo: 'Costo',        ancho: 12, texto: false },
  { clave: 'precio_venta',  titulo: 'Venta',        ancho: 12, texto: false },
]

// Los títulos se comparan sin tildes ni mayúsculas, así el archivo se puede
// editar a mano sin que un acento rompa la importación.
const normalizar = (t) =>
  String(t ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

const POR_TITULO = {}
COLUMNAS.forEach((c) => { POR_TITULO[normalizar(c.titulo)] = c.clave })
// Sinónimos que uno escribe naturalmente
Object.assign(POR_TITULO, {
  'codigo de barras': 'ean', 'ean': 'ean', 'nombre': 'nombre',
  'producto': 'nombre', 'precio costo': 'precio_costo',
  'precio de costo': 'precio_costo', 'precio venta': 'precio_venta',
  'precio de venta': 'precio_venta', 'precio': 'precio_venta',
  'unidad': 'presentacion', 'categoria': 'rubro',
})

/** "1.234,56" y "1234.56" tienen que dar lo mismo. */
export function aNumero(v) {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return v
  let t = String(v).replace(/\s|\$/g, '')
  if (t.includes(',') && t.includes('.')) t = t.replace(/\./g, '').replace(',', '.')
  else if (t.includes(',')) t = t.replace(',', '.')
  const n = parseFloat(t)
  return Number.isNaN(n) ? null : n
}

// ── exportar ────────────────────────────────────────────────────────────────

export async function exportar(productos) {
  const ExcelJS = (await import('exceljs')).default
  const libro = new ExcelJS.Workbook()
  libro.creator = 'Mostrador'
  const hoja = libro.addWorksheet('Productos')

  hoja.columns = COLUMNAS.map((c) => ({ header: c.titulo, key: c.clave, width: c.ancho }))
  hoja.getRow(1).font = { bold: true }
  hoja.views = [{ state: 'frozen', ySplit: 1 }]

  productos.forEach((p) => {
    const fila = hoja.addRow({
      id: p.id,
      // El código va como TEXTO a propósito. Si va como número, Excel convierte
      // los 13 dígitos a notación científica (7,79E+12) y el código se pierde
      // sin dar ningún error.
      ean: p.ean ? String(p.ean) : '',
      nombre: p.nombre,
      marca: p.marca ?? '',
      presentacion: p.presentacion ?? '',
      rubro: p.rubro ?? '',
      proveedor: p.proveedor ?? '',
      precio_costo: Number(p.precio_costo ?? 0),
      precio_venta: Number(p.precio_venta ?? 0),
    })
    fila.getCell('ean').numFmt = '@'
    fila.getCell('precio_costo').numFmt = '#,##0.00'
    fila.getCell('precio_venta').numFmt = '#,##0.00'
  })

  const buffer = await libro.xlsx.writeBuffer()
  const hoy = new Date().toISOString().slice(0, 10)
  descargar(new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }), `productos-${hoy}.xlsx`)

  return productos.length
}

function descargar(blob, nombre) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = nombre
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ── leer ────────────────────────────────────────────────────────────────────

export async function leerArchivo(file) {
  const ExcelJS = (await import('exceljs')).default
  const libro = new ExcelJS.Workbook()
  await libro.xlsx.load(await file.arrayBuffer())

  const hoja = libro.worksheets[0]
  if (!hoja) throw new Error('El archivo no tiene ninguna hoja.')

  const encabezado = hoja.getRow(1)
  const mapa = {}
  encabezado.eachCell((celda, col) => {
    const clave = POR_TITULO[normalizar(valorPlano(celda))]
    if (clave) mapa[col] = clave
  })

  if (!Object.values(mapa).includes('nombre')) {
    throw new Error(
      'No encontré la columna de descripción. La primera fila tiene que tener ' +
      'los títulos: ' + COLUMNAS.map((c) => c.titulo).join(', ')
    )
  }

  const filas = []
  hoja.eachRow((fila, numero) => {
    if (numero === 1) return
    const p = {}
    fila.eachCell({ includeEmpty: false }, (celda, col) => {
      const clave = mapa[col]
      if (clave) p[clave] = valorPlano(celda)
    })
    // Solo se descarta la fila totalmente vacía. Una que tenga datos pero le
    // falte la descripción tiene que aparecer como problema, no desaparecer.
    const tieneAlgo = Object.values(p).some((v) => String(v ?? '').trim() !== '')
    if (!tieneAlgo) return
    filas.push({ ...p, _fila: numero })
  })

  return filas
}

/** ExcelJS devuelve objetos para fórmulas y texto enriquecido. */
function valorPlano(celda) {
  const v = celda?.value
  if (v === null || v === undefined) return ''
  if (typeof v === 'object') {
    if ('result' in v) return v.result ?? ''
    if ('richText' in v) return v.richText.map((t) => t.text).join('')
    if ('text' in v) return v.text
    return ''
  }
  return v
}

// ── comparar contra lo que ya hay ───────────────────────────────────────────

/**
 * Devuelve qué haría la importación, SIN tocar nada. La pantalla muestra esto
 * y recién cuando confirmás se aplica.
 */
export function comparar(filas, actuales) {
  const porId  = new Map(actuales.map((p) => [String(p.id), p]))
  const porEan = new Map(actuales.filter((p) => p.ean).map((p) => [String(p.ean).trim(), p]))

  const nuevos = [], cambios = [], iguales = [], errores = []
  const eanVistos = new Set()

  for (const f of filas) {
    const nombre = String(f.nombre ?? '').trim()
    const ean = f.ean ? String(f.ean).trim() : ''
    const venta = aNumero(f.precio_venta)
    const costo = aNumero(f.precio_costo)

    if (!nombre) { errores.push({ fila: f._fila, motivo: 'sin descripción' }); continue }
    if (venta === null) { errores.push({ fila: f._fila, nombre, motivo: 'sin precio de venta' }); continue }
    if (venta < 0 || (costo !== null && costo < 0)) {
      errores.push({ fila: f._fila, nombre, motivo: 'precio negativo' }); continue
    }
    if (ean && eanVistos.has(ean)) {
      errores.push({ fila: f._fila, nombre, motivo: 'código repetido dentro del archivo' }); continue
    }
    if (ean) eanVistos.add(ean)

    const existente = (f.id && porId.get(String(f.id))) || (ean && porEan.get(ean)) || null

    const campos = {
      nombre,
      marca: String(f.marca ?? '').trim() || null,
      presentacion: String(f.presentacion ?? '').trim() || null,
      ean: ean || null,
      rubro: String(f.rubro ?? '').trim() || null,
      proveedor: String(f.proveedor ?? '').trim() || null,
      precio_venta: venta,
      precio_costo: costo === null ? (existente?.precio_costo ?? 0) : costo,
    }

    if (!existente) { nuevos.push({ fila: f._fila, campos }); continue }

    const distinto = Object.keys(campos).some((k) => {
      const a = campos[k], b = existente[k]
      if (k.startsWith('precio')) return Number(a ?? 0) !== Number(b ?? 0)
      return (a ?? '') !== (b ?? '')
    })

    if (distinto) {
      cambios.push({
        fila: f._fila, id: existente.id, campos, antes: existente,
        subeVenta: Number(campos.precio_venta) !== Number(existente.precio_venta ?? 0),
      })
    } else {
      iguales.push({ fila: f._fila, nombre })
    }
  }

  return { nuevos, cambios, iguales, errores }
}

export { COLUMNAS }
