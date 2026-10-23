---
description: pic 去中心化包管理器：用户自建 Git 仓库、发布填写地址与标识名、安装后可直接 import。
---

# pic：包管理 (pip 风格)

`pic` 是 Code CIN 的**去中心化**包管理器：没有中心索引服务器，每个包就是
用户自己的 Git 仓库。发布时只需提供仓库地址与包标识名。

## 快速开始

```bash
pic init hello
# 编辑 src/hello.cin ...
pic publish --repo https://github.com/you/cin-hello --name hello

# 其他项目
pic install hello@^1.0
pic install hello --project     # 安装到 ./pic_modules，可直接 import
```

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

[dependencies.locy]
path = "../locy"               # 开发期本地依赖
```

## 发布

```bash
pic publish --repo <git-url> --name <name> [--version 1.2.0]
```

发布流程：

1. 校验/规范化 `pic.toml`；
2. 检查 Git 工作区（`--allow-dirty` 可放宽）；
3. 生成 `dist/<name>-<version>.cinpkg`（含 `META-INF/SHA256SUMS`）；
4. 创建标签 `v<version>`（`--no-tag` 可关闭）；
5. 登记到 `$PIC_HOME/registry.json`（名称 → 仓库）；`--index <dir>` 可额外写出
   `<dir>/<name>.toml` 索引条目；
6. `--push` 时推送标签到远端（要求工作区干净）。

> 仓库需要用户自己创建；`pic` 不上传文件，只负责打包、打标签与登记名称。

## 安装

| 形式 | 示例 |
|------|------|
| 名称 + 约束 | `pic install hello@^1.2` |
| Git 仓库 | `pic install git+https://github.com/you/cin-hello@v1.2.0` |
| 本地路径 | `pic install ../cin-hello --project` |
| 包归档 | `pic install dist/hello-1.2.0.cinpkg` |

`--project` 安装到当前目录 `pic_modules/` 并写 `pic.lock`；默认安装到全局
`$PIC_HOME/packages/<name>/<version>`。

可编辑安装：

```bash
pic install -e ../cin-hello --project
```

只写 `.pic-link` 指向源码目录，修改源码后立即生效。

## 安装后直接 import

```cin
import "hello"               // pic.toml 的 entry
import "hello/util.cin"      // 包内文件
```

解析顺序：

1. `./` / `../` 相对文件；
2. `codecin/lib/` 内置标准库（裸名字优先内置）；
3. 项目 `pic_modules/`；
4. `CIN_PATH`；
5. 全局 `$PIC_HOME/packages/<name>/<current>`。

## 其他命令

```bash
pic list [--project] [--json]
pic show hello
pic freeze [--project]
pic uninstall hello [--project]
pic search [query]
pic registry add <name> <git-url>
pic registry list
pic doctor
```

## 存储布局

```text
$PIC_HOME/                     # 默认 ~/.pic
├── index.json                 # 已安装记录
├── registry.json              # 名称 -> Git 仓库
├── packages/<name>/<version>/
└── cache/git/                 # Git 缓存
```

## 安全

- 归档解包拒绝绝对路径、盘符、`..` 与符号链接；
- 安装/运行前校验 `META-INF/SHA256SUMS`；
- 安装只复制源码，不执行包内代码；
- Git 调用禁用交互式凭据提示，避免卡住。
