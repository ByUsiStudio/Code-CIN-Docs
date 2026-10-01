import DefaultTheme from 'vitepress/theme'
import { enhanceAppWithTabs } from 'vitepress-plugin-tabs/client'
import './style.css'

import GithubReleases from './components/GithubReleases.vue'
import ReleaseDownloads from './components/ReleaseDownloads.vue'

/**
 * 站点主题。
 *
 * 1. 在默认主题基础上注册 vitepress-plugin-tabs 的 Tabs 组件
 *    (对应 markdown 侧的 tabsMarkdownPlugin, 见 config.mts)。
 * 2. 注册两个**动态发布**组件, 使任意 markdown 页面可以直接写标签:
 *
 *      <GithubReleases />        完整发布时间线 (更新日志页)
 *      <ReleaseDownloads />      最新发布的资产下载 (安装页)
 *
 *    两者都在客户端 (onMounted) 请求 GitHub Releases API, 因此构建期不联网、
 *    不鉴权、也不影响静态渲染; 失败时页面照常显示静态内容。
 *    获取与缓存逻辑见 ./composables/useGithubReleases.ts。
 */
export default {
  extends: DefaultTheme,
  enhanceApp({ app }: { app: any }) {
    enhanceAppWithTabs(app)
    app.component('GithubReleases', GithubReleases)
    app.component('ReleaseDownloads', ReleaseDownloads)
  }
}
