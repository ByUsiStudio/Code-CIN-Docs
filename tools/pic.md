---
description: pic 包管理器：package.codecin.org.cn 中央注册/分发服务器、Cdifit 浏览器登录、安全摘要与详细输出。
---

# pic：包管理 (pip 风格)

`pic` 使用两个独立的服务：

| 服务 | 地址 | 作用 |
|------|------|------|
| 中央注册/分发 | `https://package.codecin.org.cn` | 包的标识名、Git 获取地址、版本列表、`.cinpkg` 制品、安全摘要 |
| 身份认证 | `https://www.cdifit.cn` | 浏览器登录、AccessToken、2FA |

Cdifit **只负责登录/身份**，不再存储包记录或包文件。包内容/制品由
`package.codecin.org.cn` 注册分发，源码原始仓库仍是用户自己的 Git 仓库。

官方发布的 pic 库（如 `rich`）与官方组织说明见 [官方生态](/ecosystem/)。

## 首次登录

```bash
pic login
```

执行后：

1. 在 `127.0.0.1` 的随机端口启动临时 HTTP 服务；
2. 自动打开浏览器（失败时打印地址，可手动复制）；
3. 在网页输入 Cdifit 邮箱/密码（2FA 账号会显示验证码输入框）；
4. 登录成功后临时服务关闭，令牌写入 `$PIC_HOME/auth.json`（0600）。

无浏览器环境：

```bash
pic login --no-browser
pic login --email you@example.com --password '***'
pic login --email you@example.com --password '***' --code 123456
```

首次运行 `pic` 的其他命令时，若 `auth.json` 不存在，也会自动进入登录流程
（`login`/`logout`/`doctor` 除外）。离线开发/测试：

```bash
pic --offline ...
# 或
PIC_OFFLINE=1 pic ...
```

### 登录页面布局

登录页只使用**相对布局**：`flex` 居中、`min(92vw, 26rem)` 卡片宽度、`rem`
间距与字号，不使用绝对定位；适配窄屏/深色模式。临时服务只绑定 loopback，
校验同源 `Origin` 与随机 CSRF token，响应 `Cache-Control: no-store`。

## pic.toml

```toml
[package]
name = "hello"
version = "1.0.0"
description = "hello package"
license = "MIT"
entry = "src/hello.cin"        # import "hello" 的入口
repo = "https://github.com/you/cin-hello"
tag = "v1.0.0"

[dependencies]
mathx = "^1.0"

[dependencies.jsonx]
git = "https://github.com/you/cin-jsonx"
tag = "v2.1.0"
```

## 发布 (详细输出)

```bash
pic publish --repo <git-url> --name <name> [--version 1.2.0] [--push]
```

输出示例：

```text
pic publish hello@1.0.0
[1/8] 认证 / 配置
      Cdifit 用户  : you@example.com
      注册服务器   : https://package.codecin.org.cn
[2/8] 清单
      包名         : hello
      版本         : 1.0.0
      入口         : src/hello.cin
[3/8] Git 工作区检查
      工作区       : clean
[4/8] 构建 .cinpkg
      归档         : dist/hello-1.0.0.cinpkg
      大小         : 12.3 KiB
      SHA-256      : <64 hex>
      源码摘要     : <64 hex>
      清单摘要     : <64 hex>
[5/8] Git 标签
      标签         : v1.0.0 (新建)
[6/8] 本地缓存
[7/8] 中央注册 / 分发
      元数据       : PUT /api/v1/packages/hello/1.0.0
      制品         : https://package.codecin.org.cn/api/v1/packages/hello/1.0.0/artifact
[8/8] 完成
      安装         : pic install hello@1.0.0
      导入         : import "hello"
```

流程：

1. 校验/规范化 `pic.toml`，检查 Git 工作区；
2. 生成 `dist/<name>-<version>.cinpkg`（含 `META-INF/SHA256SUMS`）；
3. 创建并推送标签（`--no-tag` 改用 commit 记录）；
4. 向 `package.codecin.org.cn` 提交元数据；
5. 上传 `.cinpkg` 制品（服务端校验 SHA-256）。

## 安装

```bash
pic install rich                 # 不写版本 -> 安装最新版本 (默认)
pic install rich@^1.1            # 版本范围 -> 中央注册表选最高的满足版本
pic install rich::1.1.1:*        # 精确版本; 分块选择器只影响 import 写法
pic install rich --project       # 安装到 ./pic_modules，可直接 import
pic install git+<url>@v1.0.0     # 绕过注册表，直接 Git 安装
pic install ../cin-rich --project
pic install dist/rich-1.1.1.cinpkg
```

**默认安装最新版本**：`pic install <name>` 会向中央注册表解析 `latest`
指针（没有指针时取最高的未撤回版本），即使本地已安装旧版本也会升级。
`@` / `::` 指定版本时保持"满足约束即可"的语义。

包规格里的模块选择器（`rich:table`、`rich::1.1.1:*`）只决定安装完成后
推荐的 `import` 写法；安装本身始终复制整个包。

按名称安装时 `pic` 会：

1. 从 `package.codecin.org.cn` 读取包记录并按约束/最新版本选版本；
2. 若存在 `.cinpkg` 制品：下载、校验 SHA-256、解包安装；
   否则回退到 Git 克隆；
3. 重新计算源码树/清单摘要，与服务端记录比对；
4. 校验 Git 提交 `rev`（Git 路径）；
5. 任一不匹配则删除并拒绝。

## 分块导入 (pic 库)

`import` 支持按包/模块/版本选择，避免"一口气导入整个库"：

```cin
import "rich"                 // 只导入入口 (兼容旧写法)
import "rich:*"               // 入口 + 全部公开模块
import "rich:table"           // 只导入 table 模块
import "rich:table,markdown"  // 导入多个模块 (也可用 + 分隔)
import "rich::1.1.1"          // 指定版本的入口
import "rich::1.1.1:*"        // 指定版本的全部公开模块
import "rich::1.1.1:table"    // 指定版本的 table 模块
```

- 通配 `*` 会跳过 `main.cin`、`test/`、`demo/`、`internal/` 等非公开模块；
- 指定模块时可以先 `pic modules rich` 查看可导入的模块名；
- 私有模块可显式写 `rich:internal/table` / `rich:internal/table.cin`
  （会先展开入口以保证符号完整）；
- **不写版本时默认使用最高已安装版本**（不受 `pic use` 的 `current`
  指针影响）；
- 像 `rich` 这样公开 API 都集中在入口的包，`rich:*` 与 `rich` 等价；
- 指定版本要求该版本已安装；否则报错并提示
  `pic install rich@1.1.1`；
- 旧写法 `import "rich/table.cin"` 仍然可用。

```bash
pic modules rich              # 列出可导入模块
pic modules rich --json
```

## 搜索与信息

```bash
pic search rich               # 名称 / 仓库 / 描述 / 关键词
pic search "terminal" --sort downloads --order desc --limit 20
pic search --json             # 完整 JSON (含 total/offset/limit)
pic versions rich             # 版本列表: latest / yanked / installed
pic info rich                 # 仓库、描述、模块、下载量、版本
pic info rich --json
```

搜索、`versions`、`info`、公开的 `registry list` 不需要登录；其余写操作
需要 Cdifit 登录。

## 版本管理

```bash
pic yank rich 1.1.0           # 撤回版本 (也可 rich@1.1.0)
pic unyank rich 1.1.0         # 恢复
pic latest rich 1.1.0         # 把 latest 指针指向 1.1.0
pic use rich 1.1.0            # 本地切换 current (不重新下载)
pic use rich                  # 切到本地最高已安装版本
```

- 只有版本发布者或管理员可以撤回/恢复/设置 latest；
- `latest` 指向的版本被撤回时，解析会自动回退到最高的未撤回版本；
- 本地 `pic use` 只切换 `$PIC_HOME/index.json` 的 `current`（供
  `pic show` / `pic list` 等本地命令使用）；**CIN `import` 始终优先
  最高已安装版本**；
- 删除版本/整个包在后台管理页执行 (`pic admin`)。

## 后台管理

```bash
pic admin                     # 打开 package.codecin.org.cn/admin
pic admin --no-browser        # 只打印地址
pic admin --print-token       # 只打印 AccessToken, 手动粘贴到登录框
```

后台页支持：统计概览、包搜索/排序、版本列表、撤回/恢复、设置 latest、
删除版本、删除整个包。令牌保存在浏览器 `localStorage`，也可通过
`#token=...` fragment 传入（fragment 不会发送给服务器）。

管理员由服务端环境变量配置（逗号/空白分隔）：

```bash
PIC_ADMIN_EMAILS="admin@example.com,ops@example.com"
PIC_ADMIN_IDS="u_xxx"
```

未配置管理员时，登录用户仍可管理自己发布的包。

## 中央记录

`GET https://package.codecin.org.cn/api/v1/packages/hello`：

```json
{
  "schema": "pic.package/v1",
  "name": "hello",
  "repo": "https://github.com/you/cin-hello",
  "latest": "1.0.0",
  "description": "hello package",
  "keywords": [],
  "downloads": 0,
  "versions": {
    "1.0.0": {
      "version": "1.0.0",
      "tag": "v1.0.0",
      "rev": "<git-commit>",
      "source_sha256": "<sha256>",
      "manifest_sha256": "<sha256>",
      "archive_sha256": "<sha256>",
      "archive_size": 12345,
      "artifact_url": "https://package.codecin.org.cn/api/v1/packages/hello/1.0.0/artifact",
      "published_at": "2026-10-23T12:00:00Z",
      "publisher": {"id": "...", "email": "...", "nickname": "..."},
      "yanked": false
    }
  }
}
```

服务端 API：

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/v1/health` | 否 | 健康检查 |
| GET | `/api/v1/stats` | 否 | 统计 (包/版本/制品/存储/下载) |
| GET | `/api/v1/me` | Bearer | 当前用户与是否管理员 |
| GET | `/api/v1/packages?q=&keyword=&sort=&order=&limit=&offset=` | 否 | 搜索/列表/分页/排序 |
| GET | `/api/v1/packages/{name}` | 否 | 包记录 (含 latest/描述/模块) |
| GET | `/api/v1/packages/{name}/{version}` | 否 | 单版本 |
| PUT | `/api/v1/packages/{name}/{version}` | Bearer | 提交元数据 |
| POST | `/api/v1/packages/{name}/{version}/artifact` | Bearer | 上传 `.cinpkg` |
| GET | `/api/v1/packages/{name}/{version}/artifact` | 否 | 下载 `.cinpkg` (计数) |
| POST | `/api/v1/packages/{name}/{version}/yank` | Bearer | 撤回/恢复版本 |
| POST | `/api/v1/packages/{name}/{version}/latest` | Bearer | 设置 latest 指针 |
| DELETE | `/api/v1/packages/{name}/{version}` | Bearer | 删除版本与制品 |
| DELETE | `/api/v1/packages/{name}` | Bearer | 删除整个包 |
| GET | `/admin` | 否 | 后台管理页 |

搜索默认按相关度（名称精确 > 前缀 > 包含 > 关键词 > 描述 > 仓库），
`sort` 可选 `name` / `latest` / `updated` / `downloads` / `versions`。

服务端使用 Cdifit `GET /api/v4/session/oauth/userinfo` 校验 Bearer Token，
不存储 Cdifit 文件。

## 配置

`$PIC_HOME/config.toml`：

```toml
[registry]
url = "https://package.codecin.org.cn"
api_base = "https://www.cdifit.cn"   # 登录/身份
offline = false
```

| 环境变量 | 说明 |
|----------|------|
| `PIC_HOME` | 存储根目录（默认 `~/.pic`） |
| `PIC_REGISTRY_URL` | 中央注册/分发服务器 |
| `PIC_API_BASE` | Cdifit 认证地址 |
| `PIC_OFFLINE` | `1` 时禁用中央服务，仅本地 |
| `PIC_ADMIN_EMAILS` | 服务端管理员邮箱（逗号/空白分隔） |
| `PIC_ADMIN_IDS` | 服务端管理员 Cdifit 用户 ID |

## 其他命令

```bash
pic list [--project] [--json]
pic show hello
pic freeze [--project]
pic uninstall hello [--project]
pic search [query] [--json] [--limit N] [--offset N] [--sort ...] [--keyword ...]
pic versions hello [--json]
pic info hello [--json]
pic modules hello [--json]
pic yank hello 1.0.0
pic unyank hello 1.0.0
pic latest hello 1.0.0
pic use hello 1.0.0
pic admin [--no-browser] [--print-token]
pic registry list
pic registry add <name> <git-url>   # 本地回退登记
pic doctor
```

## 安全

- 登录临时服务只绑定 `127.0.0.1`，同源 + CSRF 校验，`Cache-Control: no-store`；
- 密码只在本次请求内存中，不写日志/文件；令牌文件权限 0600；
- 服务端校验 Cdifit Token，发布者由 Token 的 `sub` 决定；
- 版本不可变：同版本不同内容返回 `409`；
- 制品上传/下载双向校验 SHA-256；解包拒绝绝对路径、盘符、`..`、符号链接；
- 安装后重算源码/清单摘要与 Git 提交。
