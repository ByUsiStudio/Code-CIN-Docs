<script setup lang="ts">
/**
 * 动态更新日志: 从 GitHub Releases 拉取, 渲染 release notes, 并**默认折叠历史版本**。
 *
 * 折叠规则:
 *   * **最新一个发布默认展开** (不需要点开就能看到本次更新了什么);
 *   * 其余历史发布默认折叠 —— 只显示版本号/标题/日期, 点"展开"才渲染内容;
 *   * 每个版本都能单独折叠/展开 (即最新那个也可以手动收起, 默认仍是展开);
 *   * 折叠时**完全不渲染** release notes (模板里用 v-if), 所以历史越多也不会
 *     在首屏把几十份 Markdown 全部渲染出来。
 *
 * 用法 (组件已在 theme/index.ts 全局注册):
 *
 *   <GithubReleases />
 *   <GithubReleases :per-page="5" />
 *   <GithubReleases repo="owner/repo" include-prereleases />
 *
 * 渲染安全: body 交给 renderMarkdown() —— 它**先 HTML 转义再格式化**,
 * 只输出自己构造的标签, 链接走 URL 白名单 (见 composables/renderMarkdown.mjs)。
 */
import { computed, ref, watch } from 'vue'
import { renderMarkdown } from '../composables/renderMarkdown.mjs'
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
    showAssets?: boolean
    showBody?: boolean
    /** 除最新版外, 是否默认折叠 (false 则全部展开)。 */
    collapseOlder?: boolean
  }>(),
  {
    repo: undefined,
    perPage: 8,
    includePrereleases: false,
    showAssets: true,
    showBody: true,
    collapseOlder: true
  }
)

const { releases, loading, error, fromCache, releasesUrl, reload } =
  useGithubReleases({
    repo: props.repo,
    perPage: props.perPage,
    includePrereleases: props.includePrereleases
  })

/** 展开状态: tag -> 是否展开。 */
const opened = ref<Record<string, boolean>>({})

/** 每次数据变化后重置: 只展开最新一个 (其余折叠)。 */
watch(
  releases,
  (list) => {
    const next: Record<string, boolean> = {}
    list.forEach((rel, i) => {
      next[rel.tag_name] = !props.collapseOlder || i === 0
    })
    opened.value = next
  },
  { immediate: true }
)

const isOpen = (tag: string): boolean => opened.value[tag] === true

function toggle(tag: string): void {
  opened.value = { ...opened.value, [tag]: !isOpen(tag) }
}

function openAll(): void {
  const next: Record<string, boolean> = {}
  for (const rel of releases.value) next[rel.tag_name] = true
  opened.value = next
}

function closeAll(): void {
  opened.value = {}
}

const allOpen = computed(
  () => releases.value.length > 0 && releases.value.every((r) => isOpen(r.tag_name))
)

/** 折叠时给个内容提示, 让人知道值不值得展开。 */
function summary(rel: { body: string; assets: unknown[] }): string {
  const lines = rel.body ? rel.body.split('\n').filter((l) => l.trim()).length : 0
  const parts: string[] = []
  if (lines) parts.push(`${lines} 行更新内容`)
  if (rel.assets.length) parts.push(`${rel.assets.length} 个文件`)
  return parts.length ? parts.join(' · ') : '暂无内容'
}

/** 渲染后的 HTML (渲染器已保证只输出安全标签)。 */
const bodyHtml = (body: string): string => renderMarkdown(body)
</script>

<template>
  <div class="cin-releases">
    <div class="cin-releases__bar">
      <span class="cin-releases__hint">
        <template v-if="loading">正在从 GitHub 获取发布信息…</template>
        <template v-else-if="error">发布信息暂不可用</template>
        <template v-else>
          共 {{ releases.length }} 个{{ includePrereleases ? '' : '正式' }}发布<template
            v-if="fromCache"
          >
            （缓存）</template
          >
        </template>
      </span>
      <span class="cin-releases__actions">
        <button
          v-if="!loading && !error && releases.length > 1"
          type="button"
          class="cin-releases__btn"
          @click="allOpen ? closeAll() : openAll()"
        >
          {{ allOpen ? '全部折叠' : '全部展开' }}
        </button>
        <button type="button" class="cin-releases__btn" @click="reload">刷新</button>
        <a class="cin-releases__btn" :href="releasesUrl" target="_blank" rel="noreferrer">
          在 GitHub 上查看
        </a>
      </span>
    </div>

    <p v-if="error" class="cin-releases__error">
      {{ error }}
    </p>

    <p v-else-if="!loading && releases.length === 0" class="cin-releases__error">
      该仓库还没有{{ includePrereleases ? '' : '正式' }}发布。
    </p>

    <ol v-else class="cin-releases__list">
      <li
        v-for="(rel, i) in releases"
        :key="rel.tag_name"
        class="cin-releases__item"
        :class="{ 'cin-releases__item--latest': i === 0 }"
      >
        <div class="cin-releases__head">
          <a class="cin-releases__tag" :href="rel.html_url" target="_blank" rel="noreferrer">
            {{ rel.tag_name }}
          </a>
          <span v-if="i === 0" class="cin-releases__latest">最新</span>
          <span v-if="rel.name && rel.name !== rel.tag_name" class="cin-releases__name">
            {{ rel.name }}
          </span>
          <span v-if="rel.prerelease" class="cin-releases__badge">预发布</span>
          <span class="cin-releases__date">{{ formatDate(rel.published_at) }}</span>
          <button
            type="button"
            class="cin-releases__toggle"
            :aria-expanded="isOpen(rel.tag_name)"
            @click="toggle(rel.tag_name)"
          >
            <template v-if="isOpen(rel.tag_name)">收起</template>
            <template v-else>展开 · {{ summary(rel) }}</template>
          </button>
        </div>

        <!-- 折叠时整块不渲染 (v-if), 因此历史再多也不会一次性渲染所有 Markdown -->
        <div v-if="isOpen(rel.tag_name)" class="cin-releases__panel">
          <!-- eslint-disable-next-line vue/no-v-html -- 渲染器已做转义 + URL 白名单 -->
          <div
            v-if="showBody && rel.body"
            class="cin-releases__body cin-md"
            v-html="bodyHtml(rel.body)"
          />

          <div v-if="showAssets && rel.assets.length" class="cin-releases__assets">
            <a
              v-for="a in rel.assets"
              :key="a.name"
              class="cin-releases__asset"
              :href="a.browser_download_url"
              rel="noreferrer"
            >
              <span class="cin-releases__asset-name">{{ a.name }}</span>
              <span class="cin-releases__asset-meta">
                {{ formatSize(a.size) }} · 下载 {{ a.download_count }}
              </span>
            </a>
          </div>
        </div>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.cin-releases {
  margin: 16px 0 24px;
  padding: 16px 18px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  background: var(--vp-c-bg-soft);
}
.cin-releases__bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  color: var(--vp-c-text-2);
}
.cin-releases__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.cin-releases__btn {
  padding: 3px 10px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 12px;
  cursor: pointer;
  text-decoration: none;
}
.cin-releases__btn:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}
.cin-releases__error {
  margin: 12px 0 0;
  font-size: 13px;
  color: var(--vp-c-text-2);
}
.cin-releases__list {
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
}
.cin-releases__item {
  padding: 10px 0;
  border-top: 1px solid var(--vp-c-divider);
}
.cin-releases__item:first-child {
  border-top: none;
}
.cin-releases__head {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: baseline;
}
.cin-releases__tag {
  font-weight: 600;
  font-size: 15px;
  color: var(--vp-c-brand-1);
}
.cin-releases__item--latest .cin-releases__tag {
  font-size: 17px;
}
.cin-releases__latest {
  padding: 1px 6px;
  border: 1px solid var(--vp-c-brand-1);
  border-radius: 999px;
  font-size: 11px;
  color: var(--vp-c-brand-1);
}
.cin-releases__name {
  font-size: 13px;
  color: var(--vp-c-text-2);
}
.cin-releases__badge {
  padding: 1px 6px;
  border: 1px solid var(--vp-c-warning-1);
  border-radius: 999px;
  font-size: 11px;
  color: var(--vp-c-warning-1);
}
.cin-releases__date {
  margin-left: auto;
  font-size: 12px;
  color: var(--vp-c-text-3);
}
.cin-releases__toggle {
  padding: 2px 9px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
  font-size: 12px;
  cursor: pointer;
}
.cin-releases__toggle:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}
.cin-releases__panel {
  margin-top: 8px;
  padding-left: 2px;
}
.cin-releases__body {
  font-size: 13.5px;
  line-height: 1.75;
  color: var(--vp-c-text-2);
}
.cin-releases__assets {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}
.cin-releases__asset {
  display: flex;
  flex-direction: column;
  padding: 6px 10px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
  text-decoration: none;
}
.cin-releases__asset:hover {
  border-color: var(--vp-c-brand-1);
}
.cin-releases__asset-name {
  font-size: 13px;
  color: var(--vp-c-text-1);
}
.cin-releases__asset-meta {
  font-size: 11px;
  color: var(--vp-c-text-3);
}

/* v-html 生成的节点不会被 scoped 样式命中, 必须用 :deep()。 */
.cin-releases__body :deep(h1),
.cin-releases__body :deep(h2),
.cin-releases__body :deep(h3),
.cin-releases__body :deep(h4),
.cin-releases__body :deep(h5),
.cin-releases__body :deep(h6) {
  margin: 14px 0 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--vp-c-text-1);
  border: none;
  padding: 0;
}
.cin-releases__body :deep(.cin-md-p) {
  margin: 6px 0;
}
.cin-releases__body :deep(.cin-md-list) {
  margin: 6px 0;
  padding-left: 20px;
  list-style: disc;
}
.cin-releases__body :deep(ol.cin-md-list) {
  list-style: decimal;
}
.cin-releases__body :deep(.cin-md-list li) {
  margin: 2px 0;
}
.cin-releases__body :deep(.cin-md-list li input[type='checkbox']) {
  margin-right: 4px;
  vertical-align: middle;
}
.cin-releases__body :deep(code) {
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--vp-c-default-soft);
  font-size: 12.5px;
}
.cin-releases__body :deep(.cin-md-pre) {
  margin: 8px 0;
  padding: 10px 12px;
  border-radius: 8px;
  overflow-x: auto;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
}
.cin-releases__body :deep(.cin-md-pre code) {
  padding: 0;
  background: none;
  font-size: 12.5px;
  line-height: 1.6;
}
.cin-releases__body :deep(.cin-md-quote) {
  margin: 8px 0;
  padding: 2px 12px;
  border-left: 3px solid var(--vp-c-divider);
  color: var(--vp-c-text-3);
}
.cin-releases__body :deep(.cin-md-hr) {
  margin: 12px 0;
  border: none;
  border-top: 1px solid var(--vp-c-divider);
}
.cin-releases__body :deep(.cin-md-table-wrap) {
  margin: 8px 0;
  overflow-x: auto;
}
.cin-releases__body :deep(.cin-md-table) {
  border-collapse: collapse;
  font-size: 12.5px;
}
.cin-releases__body :deep(.cin-md-table th),
.cin-releases__body :deep(.cin-md-table td) {
  padding: 4px 10px;
  border: 1px solid var(--vp-c-divider);
  text-align: left;
}
.cin-releases__body :deep(img) {
  max-width: 100%;
}
.cin-releases__body :deep(a) {
  color: var(--vp-c-brand-1);
  text-decoration: underline;
}
</style>
