// ── Types ────────────────────────────────────────────────────────────────────

export type NoiseProfile = 'none' | 'gaussian' | 'salt_and_pepper' | 'both' | 'crumpled' | 'stained'

export interface PipelineRequest {
  image: File
  noiseProfile: NoiseProfile
  token: string
}

export interface PipelineResult {
  run_id?: number
  ocr_text: string
  confidence: number
  noise_profile_detected: string
  compressed_bytes: string
  original_size_bits: number
  compressed_size_bits: number
  compression_ratio: number
  entropy: number
  encoding_efficiency: number
  num_symbols: number
  huffman_tree?: unknown
  encoded_bits?: string | null
  symbol_frequencies?: Record<string, number> | null
  pipeline_latency_ms: number
  denoised_image?: string | null
}

export interface DecompressResult {
  recovered_text: string
}

export interface HealthResult {
  orchestrator: string
  stage1_ocr: string
  stage2_huffman: string
}

export interface LoginRequest {
  username: string   // username or email
  password: string
}

export interface RegisterRequest {
  username:     string
  email:        string
  password:     string
  display_name?: string
}

export interface TokenResponse {
  access_token: string
  token_type:   string
  user_id:      number
  username:     string
  display_name: string | null
}

export interface UserProfile {
  id:           number
  username:     string
  email:        string
  display_name: string | null
  created_at:   string
  total_runs:   number
}

export interface RunSummary {
  id:                  number
  image_filename:      string | null
  noise_profile:       string
  ocr_text:            string | null
  confidence:          number | null
  compression_ratio:   number | null
  pipeline_latency_ms: number | null
  created_at:          string
}

export interface RunDetail extends RunSummary {
  noise_profile_detected: string | null
  compressed_bytes:       string | null
  original_size_bits:     number | null
  compressed_size_bits:   number | null
  entropy:                number | null
  encoding_efficiency:    number | null
}

// ── Config ───────────────────────────────────────────────────────────────────

const MOCK_API = import.meta.env.VITE_MOCK_API === 'true'
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000'

// ── Mock data ────────────────────────────────────────────────────────────────

const MOCK_RESULT: PipelineResult = {
  run_id: 1,
  ocr_text: '48392',
  confidence: 0.97,
  noise_profile_detected: 'gaussian',
  compressed_bytes: 'SGVsbG8gV29ybGQgTW9jayBDb21wcmVzc2VkQnl0ZXM=',
  original_size_bits: 40,
  compressed_size_bits: 22,
  compression_ratio: 1.84,
  entropy: 3.21,
  encoding_efficiency: 0.93,
  num_symbols: 5,
  pipeline_latency_ms: 142.3,
}

const MOCK_PROFILE: UserProfile = {
  id: 1,
  username: 'demo',
  email: 'demo@codenova.dev',
  display_name: 'Demo User',
  created_at: new Date().toISOString(),
  total_runs: 7,
}

const MOCK_RUNS: RunSummary[] = [
  { id: 7, image_filename: 'scan_007.png',  noise_profile: 'gaussian',        ocr_text: '48392', confidence: 0.97, compression_ratio: 1.84, pipeline_latency_ms: 142, created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString() },
  { id: 6, image_filename: 'scan_006.png',  noise_profile: 'salt_and_pepper', ocr_text: '71024', confidence: 0.94, compression_ratio: 1.61, pipeline_latency_ms: 189, created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString() },
  { id: 5, image_filename: 'doc_scan.jpg',  noise_profile: 'both',            ocr_text: '93817', confidence: 0.91, compression_ratio: 2.10, pipeline_latency_ms: 210, created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() },
  { id: 4, image_filename: 'mnist_0.png',   noise_profile: 'none',            ocr_text: '0',     confidence: 0.99, compression_ratio: 1.00, pipeline_latency_ms: 98,  created_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString() },
  { id: 3, image_filename: 'noisy_img.bmp', noise_profile: 'gaussian',        ocr_text: '55291', confidence: 0.88, compression_ratio: 1.72, pipeline_latency_ms: 167, created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() },
]

function delay(ms: number) {
  return new Promise<void>((res) => setTimeout(res, ms))
}

// ── Shared fetch helper ───────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, ...init } = options
  const headers = new Headers(init.headers)
  headers.set('Content-Type', headers.get('Content-Type') ?? 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json() as { detail?: string }
      detail = body.detail ?? detail
    } catch { /* noop */ }
    throw new Error(detail)
  }
  return res.json() as Promise<T>
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function loginUser(req: LoginRequest): Promise<TokenResponse> {
  if (MOCK_API) {
    await delay(800)
    return { access_token: 'mock-jwt', token_type: 'bearer', user_id: 1, username: 'demo', display_name: 'Demo User' }
  }
  // OAuth2PasswordRequestForm expects form-encoded body
  const form = new URLSearchParams({ username: req.username, password: req.password })
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { detail?: string }
    throw new Error(body.detail ?? 'Login failed')
  }
  return res.json() as Promise<TokenResponse>
}

export async function registerUser(req: RegisterRequest): Promise<TokenResponse> {
  if (MOCK_API) {
    await delay(1000)
    return { access_token: 'mock-jwt', token_type: 'bearer', user_id: 1, username: req.username, display_name: req.display_name ?? req.username }
  }
  return apiFetch<TokenResponse>('/auth/register', { method: 'POST', body: JSON.stringify(req) })
}

// ── User / Profile ────────────────────────────────────────────────────────────

export async function getProfile(token: string): Promise<UserProfile> {
  if (MOCK_API) { await delay(300); return MOCK_PROFILE }
  return apiFetch<UserProfile>('/users/me', { token })
}

export async function getRunHistory(token: string, skip = 0, limit = 50): Promise<RunSummary[]> {
  if (MOCK_API) { await delay(400); return MOCK_RUNS }
  return apiFetch<RunSummary[]>(`/users/me/runs?skip=${skip}&limit=${limit}`, { token })
}

export async function getRunDetail(token: string, runId: number): Promise<RunDetail> {
  if (MOCK_API) {
    await delay(300)
    const base = MOCK_RUNS.find((r) => r.id === runId) ?? MOCK_RUNS[0]
    return { ...base, noise_profile_detected: base.noise_profile, compressed_bytes: MOCK_RESULT.compressed_bytes, original_size_bits: 40, compressed_size_bits: 22, entropy: 3.21, encoding_efficiency: 0.93 }
  }
  return apiFetch<RunDetail>(`/users/me/runs/${runId}`, { token })
}

export async function deleteRun(token: string, runId: number): Promise<void> {
  if (MOCK_API) { await delay(300); return }
  await apiFetch<void>(`/users/me/runs/${runId}`, { method: 'DELETE', token })
}

// ── Pipeline ──────────────────────────────────────────────────────────────────

export async function runPipeline(req: PipelineRequest): Promise<PipelineResult> {
  if (MOCK_API) {
    await delay(1500)
    return { ...MOCK_RESULT, noise_profile_detected: req.noiseProfile }
  }
  const form = new FormData()
  form.append('image', req.image)
  form.append('noise_profile', req.noiseProfile)

  const res = await fetch(`${API_BASE}/pipeline/run`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${req.token}` },
    body: form,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { detail?: string }
    throw new Error(body.detail ?? `Pipeline failed (${res.status})`)
  }
  return res.json() as Promise<PipelineResult>
}

export async function decompressOutput(compressedBytes: string, numSymbols: number): Promise<DecompressResult> {
  if (MOCK_API) { await delay(600); return { recovered_text: MOCK_RESULT.ocr_text } }
  return apiFetch<DecompressResult>('/pipeline/decompress', {
    method: 'POST',
    body: JSON.stringify({ compressed_bytes: compressedBytes, num_symbols: numSymbols }),
  })
}

export async function checkHealth(): Promise<HealthResult> {
  if (MOCK_API) { await delay(200); return { orchestrator: 'mock', stage1_ocr: 'mock', stage2_huffman: 'mock' } }
  return apiFetch<HealthResult>('/health')
}
