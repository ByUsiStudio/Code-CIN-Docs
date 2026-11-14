---
description: mkn 项目构建工具：mkn.toml 清单、标准目录、生命周期、依赖解析、.sdgcc/--native 产物、打包与本地仓库。
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
│   ├── demo-0.1.0.sdgcc    # 可执行项目 (默认产物)
│   ├── demo-0.1.0          # mkn build --native (cincc 机器码)
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
mem_size = 1073741824
bounds_check = false  # 数组越界检查

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
| `mkn new <name>` | 创建标准项目（`--dir`、`--version`、`--description`、`--force`） |
| `mkn init` | 在当前目录初始化（允许非空目录） |
| `mkn build` / `mkn compile` | 编译；有 `main` 默认产出 `.sdgcc`，库项目产出 `.co` |
| `mkn build --native` | 调用 `cincc` 直接产出机器码 (不经 C/字节码; 目前仅 `.cin` 入口) |
| `mkn run -- <args>` | 编译并运行 |
| `mkn test` | 运行 `src/test/**/*.cin` 与 `tests/**/*.cin`；`--filter` 按路径子串筛选 |
| `mkn package` | 生成 `target/<name>-<version>.mkn` |
| `mkn install` | 安装到 `$MKN_HOME/repository/<name>/<version>`（`MKN_HOME` 默认 `~/.mkn`） |
| `mkn deploy --repo <git-url>` | 安装后调用 `pic publish`；`--push` 推送标签 |
| `mkn add <name> --version ...` | 添加依赖并解析；也支持 `--local-path`、`--git`、`--tag`、`--rev`、`--no-resolve` |
| `mkn tree` | 打印传递依赖树；`--depth N` 限制层数 |
| `mkn verify` | 校验清单、入口与依赖 |
| `mkn doctor` | 检查 Go 工具链、cincc、原生库与网络等环境项 |
| `mkn clean [--deps]` | 删除 `target/`（可选 `pic_modules/`） |

`--path <dir>` / `--manifest <mkn.toml>` 是全局选项，写在子命令之前，例如
`mkn --path demo build`。其余选项按子命令提供：

- `build` / `compile`：`-o` / `--output`（可显式写成 `.bin`、`.co`）、`--release`
  （优化级别至少为 2）、`--optimize {0,1,2,3}`、`--mem-size <字节>`、
  `--bounds-check`、`--no-deps`、`--native`、`--clean`（构建前清理 `target/`）、
  `--package`（构建后同时打包）；
- `run`：`--release`、`--optimize`、`--mem-size`、`--no-deps`；
- `test`：`--filter`、`--optimize`、`--mem-size`；
- `package` / `install` / `deploy`：`--release`、`--optimize`、`--no-deps`；
  `package` 另有 `-o` / `--output`。

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

## 构建产物

| 场景 | 产物 |
|------|------|
| 可执行项目 (有 `main`) | `target/<name>-<version>.sdgcc` (CODE 段 = BIN v3) |
| 库项目 (无 `main`) | `target/<name>-<version>.co` 可重定位对象 |
| `mkn build --native` | `target/<name>-<version>` x86-64 ELF (需先构建 `cincc`) |
| `mkn package` | `target/<name>-<version>.mkn` 分发包 |

默认构建会读取 `mkn.toml`，把入口与 `import` 闭包一起编译为多文件 `.sdgcc`。
`--native` 目前只接受 `.cin` 入口, 且不解析 `mkn.toml` 的依赖闭包, 适合纯计算/文件/网络
子集的小程序; 需要宿主 GUI/音频/FFI/HTTP 时用默认 `.sdgcc` 产物。

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
