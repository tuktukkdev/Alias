import { API_BASE } from '../config/client'

export interface AuthResponse {
  id: number
  username: string
}

export interface AuthErrorResponse {
  error: string
}

export async function loginRequest(username: string, password: string): Promise<Response> {
  return fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
}

export async function registerRequest(
  username: string,
  email: string,
  password: string,
): Promise<Response> {
  return fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  })
}

export async function parseAuthResponse(response: Response): Promise<AuthResponse> {
  return response.json() as Promise<AuthResponse>
}

export async function parseAuthErrorResponse(response: Response): Promise<string> {
  const data = (await response.json()) as AuthErrorResponse
  return data.error ?? 'Unknown error'
}
