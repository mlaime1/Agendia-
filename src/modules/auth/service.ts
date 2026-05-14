import { supabase } from '../../lib/supabase'
import { RegisterDTO, LoginDTO } from './types'

export async function register({ email, password, name, alias }: RegisterDTO) {
  // 1. Crear cuenta en Supabase Auth (el trigger crea la fila en users automáticamente)
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    user_metadata: { name },
    email_confirm: true  // no requiere confirmación de email
  })

  if (error) throw new Error(error.message)

  // 2. Si tiene alias, actualizarlo (el trigger solo guarda name y email)
  if (alias && data.user) {
    await supabase
      .from('users')
      .update({ alias })
      .eq('auth_id', data.user.id)
  }

  // 3. Hacer login automático para devolver la sesión
  const session = await supabase.auth.signInWithPassword({ email, password })
  if (session.error) throw new Error(session.error.message)

  return session.data
}

export async function login({ email, password }: LoginDTO) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)
  return data
}

export async function logout(accessToken: string) {
  // Invalida el refresh token en Supabase
  const { error } = await supabase.auth.admin.signOut(accessToken)
  if (error) throw new Error(error.message)
}

export async function refreshSession(refreshToken: string) {
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken })
  if (error) throw new Error(error.message)
  return data
}