---
description: Code CIN 命令行完整参考：位置参数与程序参数直传、版本与构建信息、日志、性能资源、.sdgcc 编译、对象/链接/静态库、cincc 原生编译、AOT 构建、退出码与环境变量。
---

# 命令行参考

运行程序的入口是 `codecin`: 安装后直接可用, 源码树中先 `pip install -e .` 或改用
`python -m codecin.cli`。参数表由 `codecin/cli.py` 的 `build_parser()` 单一来源定义,
`--help` 与本文档描述同一组选项。`mkn` / `pic` / `cvm` 是构建、包管理与模块工具,
不运行程序。

```text
Usage:
  codecin <program.[cin|pl|asm|sdgcc|bin]> [options] [program-args...]
  codecin <program...> -- <args 传给 CIN 程序>

Supported formats:
  .cin    CIN 高级语言 (函数/struct/数组/浮点/字符串)
  .pl     Code CIN 汇编语言 (PL 关键字风格)
  .asm    Code CIN 汇编
  .sdgcc  默认编译产物: UCBC 字节码容器 (CODE 段 = BIN v3)
  .bin    UCBC 字节码 (裸格式, 由 --compile 生成)

AOT/link inputs:
  .co     可重定位对象 (--emit-object)
  .colib  静态库归档 (--emit-archive)
  .crom   内存镜像 (--crom / --save)
```

```bash
codecin --help          # 彩色帮助 (intro + argparse 全量选项)
codecin --version       # 打印当前版本
codecin --build-info    # 打印版本 + 运行环境 + 原生库状态 (排障用)
```

v5.9.0 起为 native-only: 程序统一由 Go 原生库执行, 原生库缺失会直接报错
并提示重建 (无解释器回退), 构建原生库是运行前的必要步骤 (见
[编译 Go 原生库](/dev/build-native))。默认产物是 `.sdgcc`,
`--native` / `--native-out` 走 `cincc` 机器码编译路径。

## 版本与构建信息

| 选项 | 默认 | 说明 |
|------|------|------|
| `--version` / `-V` | — | 打印 `Code CIN <x.y.z>` 并退出 0 |
| `--build-info` | — | 打印多行构建信息并退出 0, 不需要位置参数 |
| `--json` | 关闭 | 只能与 `--build-info` 同用: 改为输出机器可读 JSON; 单独使用会向 stderr 打印一行提示并返回 2 |
| `--libs` | — | 列出全部内置标准库并标注类别 (见下), 退出 0, 不需要位置参数 |

`--build-info` 的字段包含版本、Python 实现与版本、平台/架构、包路径,
以及原生库是否可用、自报版本号、是否与包版本一致。排查"原生库过期/未加载"时
先看这里, 不必再手工比对 `codecin --version` 与原生库自报串:

```text
Code CIN 构建信息 (build info) - 8.0.0
  version          : 8.0.0
  version_info     : (8, 0, 0)
  python           : 3.15.2 (CPython)
  platform         : win32/AMD64
  system           : Windows
  machine          : AMD64
  native           : 可用: codecin-native 8.0.0 (Go)
  native version   : codecin-native 8.0.0 (Go)
  native library   : D:\...\codecin\codecin_native.dll
  native matches   : 一致
  package path     : D:\...\codecin
  executable       : C:\...\python.exe
```

原生库不可用时 `native` 行为 `不可用 (请运行 codecin/native/build.ps1 或 build.sh 重建)`,
`native matches` 行为 `(未知)`; 版本字段无法解析为 `x.y.z` 时 `version_info` 显示
`(无法解析为 x.y.z)`。这个命令永远以退出码 0 结束, 不会因为原生库缺失而失败。

`--build-info --json` 输出同一份信息的 JSON (可直接 `json.loads`),
适合脚本判断原生库是否需要重建:

```bash
codecin --build-info --json | python -c "import json,sys; d=json.load(sys.stdin); print(d['native_version_matches'])"
```

`--libs` 列出 `codecin/lib/<name>/src/` 全部官方标准库, 并按类别标注三类
(分类由源码扫描内建引用得出, 与库头注释保持一致):

```text
Code CIN 内置标准库清单

  模块             类别      说明
  -------------  ------  ----
  cstd.cin       兼容层     C 语言兼容层 (cstd)
  cppstd.cin     兼容层     C++ 标准库 (STL) 兼容层 (cppstd)
  gostd.cin      兼容层     Go 标准库兼容层 (gostd) [go_os_args_* 依赖原生]
  io.cin         需原生运行时  文件与路径 (io) [16 个宿主内建]
  gui.cin        需原生运行时  GUI 窗口 + 画布绘图助手 (gui) [18 个宿主内建]
  net.cin        需原生运行时  网络便捷封装 (net) [13 个宿主内建]
  math.cin       纯 CIN   数学扩展
```

- 纯 CIN: 只调用语言内建, 原生 / AOT 全路径行为一致;
- 兼容层: C / C++ / Go 标准库兼容层 (`cstd` / `cppstd` / `gostd`), 同样纯 CIN
  实现; 个别函数的原生依赖以方括号标注 (如 `gostd` 的 `go_os_args_*`);
- 需原生运行时: 转调宿主能力内建 (`gui` / `key` / `io` / `termux` / `ffi` /
  `net` 等), `--sandbox` 下调用会被拦截。

## 位置参数

| 参数 | 说明 |
|------|------|
| `program` | 程序源文件或编译产物: `.cin` / `.pl` / `.asm` / `.sdgcc` / `.bin`。省略时打印错误并返回 1 |

`program` 是可选位置参数, 只有真正要运行程序时才需要它: `--help` / `--version` /
`--build-info` 都在读取位置参数之前就退出, 所以 `codecin --build-info` 不带任何程序文件
也能成功运行 (退出码 0)。`--json` 只作为 `--build-info` 的修饰符, 不能代替位置参数。

程序参数直传: 程序文件之后的裸参数原样传给 CIN 程序, 程序内用
`arg_count()` / `arg(i)` 读取 (AOT 产物等价于 `os.Args[1:]`):

```bash
codecin 压测.cin https://example.com 24      # 裸参数直传
codecin args_demo.cin -- --flag "hello 中文" 42   # `--` 之后一律视为程序参数
```

规则:

- `--` 分隔符优先级最高, 其后的参数不再按 CLI 选项解析, 全部转交程序;
- 已知 CLI 选项放在程序之前或之后均可识别;
- 形如选项的直传参数 (如 `-n 24`) 会得到一条 stderr 提示,
  建议用 `--` 显式分隔; `--help` 的 Program arguments 段有说明。

## 日志

| 选项 | 默认 | 说明 |
|------|------|------|
| `--log-level <LVL>` | `INFO` | `DEBUG` / `INFO` / `WARNING` / `ERROR` / `CRITICAL` |
| `--log-file <FILE>` | 无 | 日志写入文件 (终端仍显示) |
| `--sandbox` | 关闭 | 沙箱模式: 引擎拦截编号 ≥ 39 的宿主能力调用, 仅白名单 ALLOCFRAME(137) / TIMEUS(138) / TIMENS(139); 编号 < 39 的打印、输入、字符串、转换、内存分配等内建照常可用 |

::: tip 日志与程序输出在同一流
日志默认输出到 stdout。需要只保留程序输出时用 `--log-level ERROR` (或 `CRITICAL`)。
详见 [日志与错误输出](/tools/logging)。
:::

## 性能与资源

| 选项 | 默认 | 说明 |
|------|------|------|
| `--mem-size <BYTES>` | `1073741824` (1 GiB) | 虚拟机内存大小 (最小 256, 上限 1 TiB)。4 KiB 稀疏分页按需提交, 只有真正写入的部分占物理内存; 大数组/大缓冲通常不需要再调它 (默认即可 `int a[1000000]`) |
| `--max-instructions <N>` | 不限制 | 已弃用, 仅作为隐藏参数保留以兼容旧脚本; 默认不限制指令数 |

## 编译与 CROM

| 选项 | 默认 | 说明 |
|------|------|------|
| `--compile` | 关闭 | 编译为 `.sdgcc` 产物后继续执行 |
| `--compile-only` | 关闭 | 只编译为 `.sdgcc`, 不执行 |
| `-o, --output <FILE>` | `<程序名>.sdgcc` | 指定输出文件 (可为 `.sdgcc` / `.bin`; `--save` 的 `.crom` 路径固定为 `<程序名>.crom`, 不受此项影响) |
| `--crom <FILE>` | 无 | 加载指定 `.crom` 内存镜像 (仅对 `.pl` / `.asm` 生效; `.cin` / `.sdgcc` / `.bin` 分支会忽略它, 并会自动探测同目录同名的 `<程序名>.crom`) |
| `--save` | 关闭 | 执行后保存 `<程序名>.crom` 内存镜像 (CROM v4 段式, 只存已分配页) |
| `--no-compress` | 压缩开启 | `.crom` 不压缩 (默认 zlib) |
| `--sdgcc-compress` | 关闭 | `.sdgcc` 的 META/SYMS/SRCS 段启用 zlib 压缩 (容器版本升为 2, CODE 段不压缩) |
| `--optimize <0-3>` | `0` | 优化级别 (越界自动裁剪到 0–3) |
| `--strict` | 关闭 | 严格汇编模式 |

## 运行时行为

| 选项 | 默认 | 说明 |
|------|------|------|
| `--seed <N>` | 随机 | 随机种子, 保证 `rand()` 序列确定 |
| `--bounds-check` | 关闭 | CIN 数组越界检查, 编译期注入字节码; 只在默认字节码路径生效, `--native` 与 AOT 不读取该开关 |
| `--disasm` | 关闭 | 反汇编 `.sdgcc` / `.bin` 为文本清单后退出 (支持 BIN v3 / 旧 v2 头) |

## 对象、链接与静态库

| 选项 | 说明 |
|------|------|
| `--emit-object` | 把 CIN/ASM/PL 编译为可重定位 `.co` 对象后退出 |
| `--link INPUT` | 链接 `.cin` / `.asm` / `.pl` / `.co` / `.colib` (可重复) 为可执行文件 |
| `--emit-archive` | 把 `--link` 输入打包为 `.colib` 静态库归档 |
| `--gc-sections` | 链接时删除从入口不可达的函数/代码段 (默认关闭) |

```bash
codecin --emit-object main.cin -o main.co
codecin --emit-object lib.cin  -o lib.co
codecin --link main.co --link lib.co -o app --optimize 3 --gc-sections

# 源文件直接链接
codecin --link main.cin --link lib.cin -o app

# 静态库: 只拉取能解决未定义符号的成员
codecin --emit-archive --link lib.co --link lib2.co -o lib.colib
codecin --link main.co --link lib.colib -o app
```

CIN 库文件用 `extern function` / `extern int` 声明跨对象符号; 无 `main` 的文件作为函数库对象。详见 [模块与标准库](/language/modules#独立编译与链接)。

## 原生机器码构建 (cincc)

`--native` 路径由 Go 编译器 `cincc` 直接生成机器码, 不经过 C,
也不经过 UCBC 字节码。它不参与默认的 `.sdgcc` / Go 引擎流程。

| 选项 | 说明 |
|------|------|
| `--native` | 用 `cincc` 编译当前 `.cin` 源文件为可执行文件并运行; Windows 下自动改用 WSL 执行 |
| `--native-out <OUT>` | 同 `--native`, 但只构建不运行, 产物写到 `OUT` |
| `--build-target linux/amd64` | 传给 `cincc -target x86_64-linux`; CLI 目前只映射 `linux/amd64` (别名 `linux/x86_64`), 其它值会报 `cincc 暂不支持目标` |

```bash
codecin hello.cin --native          # 编译并运行
codecin hello.cin --native-out hi   # 只产出 hi
codecin hello.cin --native --build-target linux/amd64
```

`cincc` 的查找顺序为 `CODECIN_CINCC` 环境变量 → `codecin/native/cincc(.exe)` →
`PATH`; 未找到时会提示先构建:

```bash
cd codecin/native && go build -o cincc ./cmd/cincc
```

::: warning 原生路径的能力子集
当前支持: 控制台输出、字符串、数组/struct/全局变量、分支/循环、函数与参数、
多文件 `import`、`malloc`、`time` / `rand` / `sleep`、文件/目录、`cwd` / `chdir` /
`os_name` / `temp_dir`、TCP/UDP。

尚未实现: GUI/画布/音频、HTTP/HTTPS/DNS、FFI。
`--native` 也不使用 Python 侧的 `--seed` / `--sandbox` / `--bounds-check` / `--save`
等运行期配置。

`cincc` 自身接受 `x86_64-linux`、`aarch64-linux`、`x86_64-windows` 三个 `-target`;
CLI 只开放 `linux/amd64`。直接调用 `cincc -target x86_64-windows -o app.exe app.cin`
可产出 PE32+。
:::

## AOT 构建

| 选项 | 说明 |
|------|------|
| `--build-exe [OUT]` | 把 CIN/ASM/PL/BIN/SDGCC/CO 编译成独立静态可执行文件后退出; 省略路径时输出到 `<程序名>[.exe]` |
| `--build-target <OS/ARCH>` | AOT 交叉编译目标: `windows/amd64`、`windows/arm64`、`linux/amd64`、`linux/arm64`、`darwin/amd64`、`darwin/arm64` |
| `--build-backend auto\|c\|native\|vm` | `auto` 优先 C 后端, 不支持时回退 Go/VM (默认); `c` 生成 C 并由 GCC/Clang 编译; `native` 旧 Go 代码生成后端; `vm` 内嵌字节码 |
| `--build-static` | C 后端产物静态链接 (macOS 目标自动忽略) |
| `--build-strip` | C 后端产物去掉符号表 (体积更小) |
| `--build-keep-c` | 保留 C 后端生成的 `program.c` |
| `--build-verify` | 构建后校验 ELF/PE 头部与目标架构是否一致 |
| `--no-build-cache` | 禁用 AOT 增量构建缓存 (含对象/归档链接缓存) |
| `--build-debug` | 保留符号表/DWARF, 不传 `-s -w` |
| `--build-keep-temp` | 保留构建临时目录, 便于排查失败 |

AOT 默认使用 C 后端; Go native/VM 后端强制 `CGO_ENABLED=0` 纯静态链接, 产物独立运行。
输入支持 `.cin/.asm/.pl/.sdgcc/.bin/.co`。详见 [AOT 独立可执行文件](/runtime/aot)。

## 常用组合

::: tabs

== 日常开发

```bash
codecin prog.cin --log-level ERROR          # 干净输出
codecin prog.cin --strict --log-level DEBUG # 严格汇编 + DEBUG 日志
codecin prog.cin arg1 arg2                  # 程序参数直传
codecin prog.cin --native                   # cincc 机器码路径
```

== 汇编 / ISA 调试

```bash
codecin prog.asm                            # 汇编并执行
codecin prog.bin --disasm                   # 反汇编查看
codecin prog.asm --crom prog.crom           # 带内存镜像执行
```

== 构建与产物

```bash
codecin prog.cin --compile-only -o prog.sdgcc # 只编译默认产物
codecin prog.cin --compile                    # 编译并执行
codecin prog.cin --save --no-compress         # 未压缩内存镜像
codecin prog.cin --build-exe prog             # AOT 单文件 (默认 C 后端)
codecin prog.cin --native-out prog-linux      # cincc 机器码
codecin --link main.cin --link lib.cin -o app  # 源文件直接独立编译链接
```

== 受控运行

```bash
codecin prog.cin --seed 42                  # 确定性随机
codecin prog.cin --bounds-check             # 数组越界检查
codecin prog.cin --sandbox                  # 禁宿主能力
```

:::

## 退出码

| 退出码 | 含义 |
|--------|------|
| `0` | 正常结束 (`HALT` / 程序自然结束), 或 `--help` / `--version` / `--build-info` / `--compile-only` / `--build-exe` / `--native-out` 成功 |
| `1` | 加载/汇编/编译/运行错误, 或 AOT / cincc 构建失败 (错误以 rich 红色面板打印) |
| `2` | 参数错误 (未知选项、非法枚举值等, 由 argparse 输出 usage) |

```text
┌──────────────────────── Load Error ────────────────────────┐
│ prog.cin:12: Compiler error: Unknown function: printline   │
└────────────────────────────────────────────────────────────┘
```

## 环境变量

| 变量 | 作用 |
|------|------|
| `CODECIN_CINCC` | 显式指定 `cincc` 编译器路径 (优先于 `codecin/native/cincc` 与 `PATH`) |
| `CODECIN_NATIVE_LIB` | 显式指定原生库路径 (优先于自动查找) |
| `CODECIN_SKIP_NATIVE=1` | 安装时跳过原生库编译 |
| `CODECIN_NO_GO=1` | 安装时跳过 Go 原生构建 |
| `CODECIN_FORCE_REBUILD=0` | 安装时不强制重建原生库 (默认重建) |
| `CODECIN_STATIC` | 原生库构建的链接模式: `auto`(默认, 失败回退动态) / `1`(强制静态) / `0`(动态) |
| `CODECIN_AOT_TESTS=1` | 允许 AOT 交叉编译测试用例参与测试 |

## 还可以用 Python API 控制更多

有些运行配置没有对应的命令行开关, 可以在嵌入使用 `Config` 时直接设置
(如 `program_args` 程序参数、`compress_crom` 压缩开关等):

```python
from codecin import CPU, Config

cfg = Config()
cfg.mem_size = 64 * 1024 * 1024      # 64 MiB (默认 1 GiB)
cfg.log_level = 'WARNING'
cfg.program_args = ['--flag', '42']  # arg_count()/arg(i) 读取
cfg.seed = 42                        # 确定性随机

cpu = CPU(cfg, 'prog.cin')
cpu.run()
```

字段含义见 [Python 嵌入 API](/reference/python-api)。
