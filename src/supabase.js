import { createClient } from '@supabase/supabase-js'

const URL = import.meta.env.VITE_SUPABASE_URL
const CLAVE = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Si no hay variables de entorno, la app arranca igual en MODO PRUEBA, con
 * datos de ejemplo en memoria. Sirve para verla y ajustar la interfaz sin
 * haber creado el proyecto en Supabase todavía.
 */
export const HAY_SUPABASE = Boolean(URL && CLAVE)

export const supabase = HAY_SUPABASE ? createClient(URL, CLAVE) : null

/**
 * Cliente aparte, sin guardar sesión, para dar de alta a alguien sin que el
 * alta te desloguee a vos. Si usáramos el cliente principal, supabase cambia
 * la sesión activa por la del recién creado y te saca del medio.
 */
export function clienteTemporal() {
  return createClient(URL, CLAVE, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Traduce los errores de Supabase a algo que se entienda. */
export function explicar(error) {
  if (!error) return ''
  const m = String(error.message || error)

  if (/Invalid login credentials/i.test(m)) return 'Usuario o contraseña incorrectos.'
  if (/Email not confirmed/i.test(m))
    return 'La cuenta existe pero falta confirmar el mail. En Supabase, Authentication → Providers → Email, apagá "Confirm email".'
  if (/User already registered/i.test(m)) return 'Ya existe una cuenta con ese mail.'
  if (/Password should be at least/i.test(m)) return 'La contraseña tiene que tener al menos 6 caracteres.'
  if (/duplicate key.*ean/i.test(m)) return 'Ya hay un producto cargado con ese código de barras.'
  if (/row-level security/i.test(m))
    return 'Tu cuenta no tiene permiso para esto. Si tendría que tenerlo, revisá que tu perfil esté marcado como dueño.'
  if (/Failed to fetch|NetworkError/i.test(m))
    return 'No pude comunicarme con el servidor. Fijate si tenés internet.'
  return m
}
