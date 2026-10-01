<script setup lang="ts">
/**
 * 最新发布下载区: 只渲染**最新一个**发布的资产, 供安装页直接拿文件。
 *
 * 用法:
 *
 *   <ReleaseDownloads />
 *   <ReleaseDownloads :per-page="1" only="windows" />
 *
 * `only` 可用于按文件名关键词过滤 (例如 `windows` / `linux` / `wheel`)。
 */
import { computed } from 'vue'
import {
  formatDate,
  formatSize,
  useGithubReleases
} from '../composables/useGithubReleases'

const props = withDefaults(
  defineProps<{
    repo?: string
    perPage?: number
    includePrereleases?: boolean
    /** 只显示文件名包含该子串的资产 (不区分大小写); 省略表示全部。 */
    only?: string
  }>(),
  {
    repo: undefined,
    perPage: 5,
    includePrereleases: false,
    only: ''
  }
)

const { releases, loading, error, releasesUrl } = useGithubReleases({
  repo: props.repo,
  perPage: props.perPage,
  includePrereleases: props.includePrereleases
})

const latest = computed(() => releases.value[0] ?? null)

const assets = computed(() => {
  const list = latest.value?.assets ?? []
  const needle = props.only.trim().toLowerCase()
  const filtered = needle
    ? list.filter((a) => a.name.toLowerCase().includes(needle))
    : list
  // 下载次数多的排前面 (通常是主推产物)
  return [...filtered].sort((a, b) => b.download_count - a.download_count)
})
</script>

<template>
  <div class="cin-dl">
    <p v-if="loading" class="cin-dl__state">正在获取最新发布…</p>
    <p v-else-if="error" class="cin-dl__state">
      {{ error }} 也可以直接访问
      <a :href="releasesUrl" target="_blank" rel="noreferrer">GitHub Releases</a>。
    </p>
    <p v-else-if="!latest" class="cin-dl__state">
      还没有可用发布, 请见
      <a :href="releasesUrl" target="_blank" rel="noreferrer">GitHub Releases</a>。
    </p>
    <template v-else>
      <div class="cin-dl__head">
        <a class="cin-dl__tag" :href="latest.html_url" target="_blank" rel="noreferrer">
          {{ latest.tag_name }}
        </a>
        <span class="cin-dl__date">{{ formatDate(latest.published_at) }}</span>
      </div>

      <p v-if="!assets.length" class="cin-dl__state">
        该版本没有{{ only ? `匹配 “${only}” 的` : '' }}可下载文件。
      </p>
      <div v-else class="cin-dl__grid">
        <a
          v-for="a in assets"
          :key="a.name"
          class="cin-dl__item"
          :href="a.browser_download_url"
          rel="noreferrer"
        >
          <span class="cin-dl__name">{{ a.name }}</span>
          <span class="cin-dl__meta">{{ formatSize(a.size) }}</span>
        </a>
      </div>
    </template>
  </div>
</template>

<style scoped>
.cin-dl {
  margin: 12px 0 20px;
  padding: 14px 16px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  background: var(--vp-c-bg-soft);
}
.cin-dl__state {
  margin: 0;
  font-size: 13px;
  color: var(--vp-c-text-2);
}
.cin-dl__head {
  display: flex;
  gap: 10px;
  align-items: baseline;
  margin-bottom: 10px;
}
.cin-dl__tag {
  font-weight: 600;
  color: var(--vp-c-brand-1);
}
.cin-dl__date {
  margin-left: auto;
  font-size: 12px;
  color: var(--vp-c-text-3);
}
.cin-dl__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 8px;
}
.cin-dl__item {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
  text-decoration: none;
}
.cin-dl__item:hover {
  border-color: var(--vp-c-brand-1);
}
.cin-dl__name {
  font-size: 13px;
  color: var(--vp-c-text-1);
  overflow-wrap: anywhere;
}
.cin-dl__meta {
  flex: none;
  font-size: 11px;
  color: var(--vp-c-text-3);
}
</style>
