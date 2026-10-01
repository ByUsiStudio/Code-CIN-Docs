<script setup lang="ts">
/**
 * 动态更新日志: 从 GitHub Releases 拉取并渲染。
 *
 * 用法 (markdown 里直接写标签即可, 组件已在 theme/index.ts 全局注册):
 *
 *   <GithubReleases />
 *   <GithubReleases :per-page="5" />
 *   <GithubReleases repo="owner/repo" include-prereleases />
 *
 * 失败/限流/离线时只显示一行提示 + 跳转链接, 页面其余内容(静态更新日志)照常可用。
 */
import {
  formatDate,
  formatSize,
  parseBody,
  useGithubReleases
} from '../composables/useGithubReleases'

const props = withDefaults(
  defineProps<{
    repo?: string
    perPage?: number
    includePrereleases?: boolean
    showAssets?: boolean
    showBody?: boolean
  }>(),
  {
    repo: undefined,
    perPage: 8,
    includePrereleases: false,
    showAssets: true,
    showBody: true
  }
)

const { releases, loading, error, fromCache, releasesUrl, reload } =
  useGithubReleases({
    repo: props.repo,
    perPage: props.perPage,
    includePrereleases: props.includePrereleases
  })
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
      <li v-for="rel in releases" :key="rel.tag_name" class="cin-releases__item">
        <div class="cin-releases__head">
          <a class="cin-releases__tag" :href="rel.html_url" target="_blank" rel="noreferrer">
            {{ rel.tag_name }}
          </a>
          <span v-if="rel.name && rel.name !== rel.tag_name" class="cin-releases__name">
            {{ rel.name }}
          </span>
          <span v-if="rel.prerelease" class="cin-releases__badge">预发布</span>
          <span class="cin-releases__date">{{ formatDate(rel.published_at) }}</span>
        </div>

        <div v-if="showBody && rel.body" class="cin-releases__body">
          <template v-for="(block, i) in parseBody(rel.body)" :key="i">
            <p v-if="block.kind === 'h'" class="cin-releases__h">{{ block.text }}</p>
            <p v-else-if="block.kind === 'li'" class="cin-releases__li">
              {{ block.text }}
            </p>
            <p v-else class="cin-releases__p">{{ block.text }}</p>
          </template>
        </div>

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
  padding: 12px 0;
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
.cin-releases__body {
  margin-top: 8px;
  font-size: 13px;
  line-height: 1.7;
}
.cin-releases__h {
  margin: 8px 0 2px;
  font-weight: 600;
  color: var(--vp-c-text-1);
}
.cin-releases__li {
  margin: 2px 0 2px 14px;
  position: relative;
}
.cin-releases__li::before {
  content: '·';
  position: absolute;
  left: -10px;
  color: var(--vp-c-text-3);
}
.cin-releases__p {
  margin: 2px 0;
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
</style>
