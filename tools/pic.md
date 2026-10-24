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
pic install hello@^1.0            # 中央注册表 -> 制品/Git -> 校验
pic install hello --project       # 安装到 ./pic_modules，可直接 import
pic install git+<url>@v1.0.0      # 绕过注册表，直接 Git 安装
pic install ../cin-hello --project
pic install dist/hello-1.0.0.cinpkg
```

按名称安装时 `pic` 会：

1. 从 `package.codecin.org.cn` 读取包记录并按约束选版本；
2. 若存在 `.cinpkg` 制品：下载、校验 SHA-256、解包安装；
   否则回退到 Git 克隆；
3. 重新计算源码树/清单摘要，与服务端记录比对；
4. 校验 Git 提交 `rev`（Git 路径）；
5. 任一不匹配则删除并拒绝。

## 中央记录

`GET https://package.codecin.org.cn/api/v1/packages/hello`：

```json
{
  "schema": "pic.package/v1",
  "name": "hello",
  "repo": "https://github.com/you/cin-hello",
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
| GET | `/api/v1/packages?q=` | 否 | 搜索/列表 |
| GET | `/api/v1/packages/{name}` | 否 | 包记录 |
| GET | `/api/v1/packages/{name}/{version}` | 否 | 单版本 |
| PUT | `/api/v1/packages/{name}/{version}` | Bearer | 提交元数据 |
| POST | `/api/v1/packages/{name}/{version}/artifact` | Bearer | 上传 `.cinpkg` |
| GET | `/api/v1/packages/{name}/{version}/artifact` | 否 | 下载 `.cinpkg` |
| POST | `/api/v1/packages/{name}/{version}/yank` | Bearer | 撤回版本 |

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

## 其他命令

```bash
pic list [--project] [--json]
pic show hello
pic freeze [--project]
pic uninstall hello [--project]
pic search [query]
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
