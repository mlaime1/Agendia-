import { supabase } from '../../lib/supabase'
import { prisma } from '../../config/prisma'
import { RegisterDTO, LoginDTO } from './types'

function getProfileName(name: string | undefined, email: string): string {
  const trimmed = name?.trim()
  if (trimmed) return trimmed
  return email.split('@')[0] || 'Sin nombre'
}

export async function register({ email, password, name, alias }: RegisterDTO) {
  // 1. Crear cuenta en Supabase Auth
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    user_metadata: { name },
    email_confirm: true  // no requiere confirmación de email
  })

  if (error) throw new Error(error.message)
  if (!data.user) throw new Error('No se pudo crear el usuario en Auth')

  // 2. Asegurar perfil en users (fallback robusto si el trigger no está activo)
  const profileName = getProfileName(name, email)
  await prisma.users.upsert({
    where: { auth_id: data.user.id },
    update: {
      name: profileName,
      email,
      ...(alias !== undefined ? { alias } : {}),
    },
    create: {
      auth_id: data.user.id,
      name: profileName,
      email,
      ...(alias !== undefined ? { alias } : {}),
    },
  })

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