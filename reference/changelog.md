---
description: Code CIN 更新日志 — 实时取自 GitHub Releases, 由文档站在浏览器里动态获取并渲染 release notes 与发布文件
---

# 更新日志

本页内容**实时**取自
[GitHub Releases](https://github.com/ByUsiStudio/Code-CIN/releases):
版本号、发布日期、release notes 与可下载文件都由浏览器在打开页面时获取并渲染,
因此新版本发布后**无需重新构建文档站**就能看到。

**最新版本默认展开**, 历史版本默认折叠 (点版本行右侧的「展开」即可查看; 标题栏会提示
有多少行更新内容与几个下载文件), 右上角可一键「全部展开 / 全部折叠」。

<GithubReleases :per-page="10" />

::: tip 这里是空的 / 只有一行提示?
GitHub 未鉴权 API 有**每 IP 每小时 60 次**的限流, 结果会缓存在浏览器里 10 分钟;
离线、被代理拦截或触发限流时, 这里会显示一行原因而不是列表。
此时请直接打开 [Releases 页面](https://github.com/ByUsiStudio/Code-CIN/releases)
或主仓库的 [`CHANGELOG.md`](https://github.com/ByUsiStudio/Code-CIN/blob/main/CHANGELOG.md)。

> 说明: 本页**不再**内置一份静态更新日志副本 —— 那必然与 Releases 漂移。
> 唯一的真源是主仓库的 `CHANGELOG.md` 与由它发布的 GitHub Release。
:::
