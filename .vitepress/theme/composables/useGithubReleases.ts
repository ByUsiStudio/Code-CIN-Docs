/**
 * 从 GitHub Releases API 动态获取发布信息 (客户端)。
 *
 * 设计要点:
 *   1. **SSR 安全** —— VitePress 会在构建期预渲染页面, 因此网络请求只允许在
 *      `onMounted` 之后发生; 任何 `window` / `sessionStorage` 访问都必须先判断环境。
 *   2. **缓存** —— 未鉴权的 GitHub API 限流是 **每 IP 每小时 60 次**, 所以结果按
 *      `repo + perPage` 缓存在 sessionStorage 里 (默认 10 分钟), 刷新页面不会重复请求。
 *   3. **可降级** —— 限流 / 离线 / 仓库改名都要给出人能看懂的原因, 并且**不阻断页面**:
 *      调用方保留静态更新日志作为离线回退。
 *   4. **不注入 HTML** —— release body 是 Markdown 原文, 一律走 Vue 文本插值,
 *      绝不用 `v-html`, 因此不存在脚本注入面。
 */

import { onMounted, ref, shallowRef } from 'vue'

/** 默认指向主仓库 (docs/.vitepress/config.mts 的 nav 里也是这个地址)。 */
export const DEFAULT_REPO = 'ByUsiStudio/Code-CIN'

/** 缓存有效期: 10 分钟。 */
const CACHE_TTL_MS = 10 * 60 * 1000

/** 缓存键前缀 (加前缀以免和其它站点/组件冲突)。 */
const CACHE_PREFIX = 'codecin:releases:'

export interface ReleaseAsset {
  name: string
  size: number
  download_count: number
  browser_download_url: string
  content_type?: string
}

export interface Release {
  tag_name: string
  name: string
  html_url: string
  published_at: string
  prerelease: boolean
  draft: boolean
  body: string
  assets: ReleaseAsset[]
}

export interface UseGithubReleasesOptions {
  /** 形如 `owner/repo`; 默认主仓库。 */
  repo?: string
  /** 一次取多少条 (1..100); 默认 8。 */
  perPage?: number
  /** 是否包含预发布版本; 默认 false。 */
  includePrereleases?: boolean
}

interface CacheEntry {
  at: number
  data: Release[]
}

const hasWindow = (): boolean => typeof window !== 'undefined'

function cacheKey(repo: string, perPage: number, includePre: boolean): string {
  return `${CACHE_PREFIX}${repo}:${perPage}:${includePre ? 'all' : 'stable'}`
}

function readCache(key: string): Release[] | null {
  if (!hasWindow()) return null
  try {
    const raw = window.sessionStorage.getItem(key)
    if (!raw) return null
    const entry = JSON.parse(raw) as CacheEntry
    if (!entry || typeof entry.at !== 'number' || !Array.isArray(entry.data)) return null
    if (Date.now() - entry.at > CACHE_TTL_MS) return null
    return entry.data
  } catch {
    // 存储被禁用 / JSON 损坏: 当作没有缓存, 不影响功能
    return null
  }
}

function writeCache(key: string, data: Release[]): void {
  if (!hasWindow()) return
  try {
    window.sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), data }))
  } catch {
    // 隐私模式 / 配额用尽: 静默降级为"不缓存"
  }
}

/** 把 GitHub 的错误响应翻译成一句人能看懂的话。 */
function explainFailure(status: number, message: string): string {
  if (status === 404) {
    return '仓库或发布不存在 (404)。如果仓库改过名, 请更新组件传入的 repo。'
  }
  if (status === 403 || status === 429) {
    return (
      'GitHub API 触发限流 (未鉴权时每 IP 每小时 60 次)。' +
      '稍后重试即可; 下方静态更新日志不受影响。'
    )
  }
  if (status >= 500) {
    return `GitHub 服务端暂时不可用 (${status})。稍后重试即可。`
  }
  return message || `请求失败 (${status})。`
}

/**
 * 读取发布列表。返回的 `releases` 在 SSR 期间恒为空数组, 挂载后才填充。
 */
export function useGithubReleases(options: UseGithubReleasesOptions = {}) {
  const repo = options.repo ?? DEFAULT_REPO
  const perPage = Math.min(Math.max(options.perPage ?? 8, 1), 100)
  const includePrereleases = options.includePrereleases ?? false
  const key = cacheKey(repo, perPage, includePrereleases)

  const releases = shallowRef<Release[]>([])
  const loading = ref(true)
  const error = ref('')
  const fromCache = ref(false)
  const fetchedAt = ref(0)

  const releasesUrl = `https://github.com/${repo}/releases`
  const latestUrl = `${releasesUrl}/latest`
  const apiUrl =
    `https://api.github.com/repos/${repo}/releases?per_page=${perPage}`

  async function load(force = false): Promise<void> {
    error.value = ''
    const cached = force ? null : readCache(key)
    if (cached) {
      releases.value = cached
      loading.value = false
      fromCache.value = true
      return
    }
    loading.value = true
    fromCache.value = false
    try {
      const res = await fetch(apiUrl, {
        headers: { Accept: 'application/vnd.github+json' }
      })
      if (!res.ok) {
        error.value = explainFailure(res.status, res.statusText)
        return
      }
      const json = (await res.json()) as Release[]
      const list = (Array.isArray(json) ? json : [])
        .filter((r) => !r.draft)
        .filter((r) => includePrereleases || !r.prerelease)
        .map((r) => ({
          tag_name: r.tag_name ?? '',
          name: r.name || r.tag_name || '',
          html_url: r.html_url ?? releasesUrl,
          published_at: r.published_at ?? '',
          prerelease: Boolean(r.prerelease),
          draft: Boolean(r.draft),
          body: r.body ?? '',
          assets: Array.isArray(r.assets) ? r.assets : []
        }))
      releases.value = list
      fetchedAt.value = Date.now()
      writeCache(key, list)
    } catch (e) {
      // 网络错误 (离线 / DNS / CORS) —— 不抛给页面, 只记录原因
      error.value =
        '无法访问 GitHub API (离线或被拦截)。下方静态更新日志仍然可用。'
      if (import.meta.env?.DEV) {
        console.warn('[codecin] 获取 releases 失败:', e)
      }
    } finally {
      loading.value = false
    }
  }

  onMounted(() => {
    void load()
  })

  return {
    releases,
    loading,
    error,
    fromCache,
    fetchedAt,
    releasesUrl,
    latestUrl,
    reload: () => load(true)
  }
}

/** 字节数 -> 人类可读。 */
export function formatSize(bytes: number): string {
  if (!bytes || bytes < 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let v = bytes
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v >= 10 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`
}

/** ISO 时间 -> `YYYY-MM-DD`(本地时区无关, 直接切字符串避免时区漂移)。 */
export function formatDate(iso: string): string {
  if (!iso || iso.length < 10) return '—'
  return iso.slice(0, 10)
}
