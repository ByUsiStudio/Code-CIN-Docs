---
description: mkn 项目构建工具：mkn.toml 清单、标准目录、生命周期、依赖解析、打包与本地仓库。
---

# mkn：项目构建 (Maven 风格)

`mkn` 负责 CIN 项目的**构建生命周期**与**依赖解析**。依赖安装复用 `pic`，
不会重复实现一套包管理。

## 快速开始

```bash
mkn new demo
cd demo
mkn build
mkn run
mkn test
mkn package
```

生成的标准目录：

```text
demo/
├── mkn.toml
├── src/
│   ├── main.cin
│   └── test/main_test.cin
├── target/
│   ├── demo-0.1.0.bin      # 可执行项目
│   └── demo-0.1.0.mkn      # mkn package
└── pic_modules/            # 依赖安装目录 (可直接 import)
```

## mkn.toml

```toml
[project]
name = "app"
version = "0.1.0"
description = "demo"
license = "MIT"
entry = "src/main.cin"

[build]
optimize = 0          # 0..3
backend = "vm"        # vm / native / auto (AOT 时使用)
mem_size = 1073741824

[dependencies]
libx = "0.1.0"        # 版本约束

[dependencies.locy]
path = "../locy"      # 本地路径

[dependencies.jsonx]
git = "https://github.com/you/cin-jsonx"
tag = "v2.1.0"        # 或 rev = "<commit>"
```

## 命令

| 命令 | 说明 |
|------|------|
| `mkn new <name>` | 创建标准项目 |
| `mkn init` | 在当前目录初始化（允许非空目录） |
| `mkn build` / `mkn compile` | 编译；有 `main` 产出 `.bin`，库项目产出 `.co` |
| `mkn run -- <args>` | 编译并运行 |
| `mkn test` | 运行 `src/test/**/*.cin` 与 `tests/**/*.cin` |
| `mkn package` | 生成 `target/<name>-<version>.mkn` |
| `mkn install` | 安装到 `$MKN_HOME/repository/<name>/<version>` |
| `mkn deploy --repo <git-url>` | 安装后调用 `pic publish` |
| `mkn add <name> --version ...` | 添加依赖并解析 |
| `mkn tree` | 打印传递依赖树 |
| `mkn verify` | 校验清单、入口与依赖 |
| `mkn clean [--deps]` | 删除 `target/`（可选 `pic_modules/`） |

## 依赖解析顺序

1. 项目 `pic_modules/<name>/` 已存在且版本满足约束 → 直接使用；
2. `[dependencies.<name>].path` → 本地路径安装；
3. `[dependencies.<name>].git` → Git 仓库安装；
4. 本地 mkn 仓库 `$MKN_HOME/repository/<name>/<version>`；
5. 否则按 `name@version` 走 `pic` 中央注册/分发服务器
   (`package.codecin.org.cn`)。

按名称解析依赖需要先 `pic login`（Cdifit 登录）；离线开发可设置
`PIC_OFFLINE=1`，改用本地 `registry.json` / `path` / `git` 依赖。

安装完成后写入 `pic.lock`，记录实际版本与来源。

## 库项目

入口及 import 闭包中没有 `function main` 时，`mkn build` 自动把项目编译为
可重定位对象 `.co`（复用 `codecin.object.compile_cin_object`），因此库项目也能
`mkn package` / `mkn install`，并被其他项目依赖。

## 导入依赖

依赖位于 `pic_modules/`，CIN 可直接导入包名或包内文件：

```cin
import "libx"
import "libx/extra.cin"

function main() -> int {
    return 0
}
```

## 示例：本地路径依赖

```bash
mkn new app
cd app
mkn add libx --local-path ../libx
mkn build
```

`libx` 会复制到 `app/pic_modules/libx/`，`import "libx"` 即可使用。
