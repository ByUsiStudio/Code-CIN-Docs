---
description: Code CIN 命令行完整参考：位置参数与程序参数直传、版本与构建信息、日志、性能资源、编译与 CROM、AOT 构建、退出码与环境变量。
---

# 命令行参考

唯一命令行入口是 Python 侧: 安装后的 `codecin`, 或源码树里的 `codecin`。
两者参数表完全相同 (源码中由 `codecin/cli.py` 的 `build_parser()` 单一来源定义, 因此
`--help` 与本文档始终一致)。

```text
Usage:
  codecin <program.[cin|pl|asm|bin]> [options] [program-args...]
  codecin <program...> -- <args 传给 CIN 程序>

Supported formats:
  .cin   CIN 高级语言 (函数/struct/数组/浮点/字符串)
  .pl    Code CIN 汇编语言 (PL 关键字风格)
  .asm   Code CIN 汇编
  .bin   UCBC 字节码 (由 --compile 生成)
```

```bash
codecin --help          # 彩色帮助 (intro + argparse 全量选项)
codecin --version       # 打印当前版本
codecin --build-info    # 打印版本 + 运行环境 + 原生库状态 (排障用)
```

v5.9.0 起为 **native-only 单引擎**：程序统一由 Go 原生库执行，原生库缺失会直接报错
并提示重建（无解释器回退），构建原生库是运行前的必要步骤（见
[编译 Go 原生库](/dev/build-native)）。

## 版本与构建信息

| 选项 | 默认 | 说明 |
|------|------|------|
| `--version` / `-V` | — | 打印 `Code CIN <x.y.z>` 并退出 0 |
| `--build-info` | — | 打印多行构建信息并退出 0,**不需要**位置参数 |
| `--json` | 关闭 | 只能与 `--build-info` 同用: 改为输出机器可读 JSON; 单独使用会向 **stderr** 打印一行提示并返回 2 |
| `--libs` | — | 列出全部内置标准库并标注类别 (见下), 退出 0,**不需要**位置参数 |

`--build-info` 的字段包含版本、Python 实现与版本、平台/架构、包路径,
以及**原生库是否可用、自报版本号、是否与包版本一致** —— 排查"原生库过期/未加载"时
先看这里, 不必再手工比对 `codecin --version` 与原生库自报串:

```text
Code CIN 构建信息 (build info) - 5.9.0
  version          : 5.9.0
  version_info     : (5, 9, 0)
  python           : 3.14.6 (CPython)
  platform         : win32/AMD64
  system           : Windows
  machine          : AMD64
  native           : 可用: codecin-native 5.9.0 (Go)
  native version   : codecin-native 5.9.0 (Go)
  native library   : D:\...\codecin\codecin_native.dll
  native matches   : 一致
  package path     : D:\...\codecin
  executable       : C:\...\python.exe
```

原生库不可用时 `native` 行为 `不可用 (请运行 codecin/native/build.ps1 或 build.sh 重建)`,
`native matches` 行为 `(未知)`; 版本字段无法解析为 `x.y.z` 时 `version_info` 显示
`(无法解析为 x.y.z)` —— **这个命令永远以退出码 0 结束**, 不会因为原生库缺失而失败。

`--build-info --json` 输出同一份信息的 JSON (可直接 `json.loads`),
适合脚本判断"原生库是否需要重建":

```bash
codecin --build-info --json | python -c "import json,sys; d=json.load(sys.stdin); print(d['native_version_matches'])"
```

`--libs` 列出 `codecin/lib/` 全部官方标准库, 并按**类别**标注三类
(分类由源码扫描内建引用得出, 与库头注释保持一致):

```text
Code CIN 内置标准库清单

  模块             类别      说明
  cstd.cin       C 兼容层    C 语言兼容层 (cstd)
  cppstd.cin     C++ 兼容层  C++ 标准库 (STL) 兼容层 (cppstd)
  gostd.cin      Go 兼容层   Go 标准库兼容层 (gostd) [go_os_args_* 依赖原生]
  ffi.cin        需原生运行时  FFI 动态库调用便捷封装 (ffi)
  gui.cin        需原生运行时  GUI 窗口 + 画布绘图助手 (gui)
  net.cin        需原生运行时  网络便捷封装 (net)
  math.cin       纯 CIN   ...
```

- **纯 CIN**: 只调用语言内建, 原生 / AOT 全路径行为一致;
- **兼容层**: C / C++ / Go 标准库兼容层 (`cstd` / `cppstd` / `gostd`), 同样纯 CIN
  实现; 个别函数的原生依赖以方括号标注 (如 `gostd` 的 `go_os_args_*`);
- **需原生运行时**: 转调宿主能力内建 (`gui` / `key` / `io` / `termux` / `ffi` /
  `net` 等), `--sandbox` 下调用会被拦截。

## 位置参数

| 参数 | 说明 |
|------|------|
| `program` | 程序源文件或字节码: `.cin` / `.pl` / `.asm` / `.bin`。省略时打印错误并返回 1 |

`program` 是**可选**位置参数, 只有真正要运行程序时才需要它: `--help` / `--version` /
`--build-info` 都在读取位置参数之前就退出, 所以 `codecin --build-info` 不带任何程序文件
也能成功运行 (退出码 0)。`--json` 只作为 `--build-info` 的修饰符, 不能代替位置参数。

**程序参数直传**: 程序文件之后的裸参数原样传给 CIN 程序, 程序内用
`arg_count()` / `arg(i)` 读取 (AOT 产物等价于 `os.Args[1:]`):

```bash
codecin 压测.cin https://example.com 24      # 裸参数直传
codecin args_demo.cin -- --flag "hello 中文" 42   # `--` 之后一律视为程序参数
```

规则:

- `--` 分隔符**优先级最高**——其后的参数不再按 CLI 选项解析, 全部转交程序;
- 已知 CLI 选项放在程序之前或之后均可识别;
- 形如选项的直传参数 (如 `-n 24`) 会得到一条 **stderr** 提示,
  建议用 `--` 显式分隔; `--help` 的 Program arguments 段有说明。

## 日志

| 选项 | 默认 | 说明 |
|------|------|------|
| `--log-level <LVL>` | `INFO` | `DEBUG` / `INFO` / `WARNING` / `ERROR` / `CRITICAL` |
| `--log-file <FILE>` | 无 | 日志写入文件 (终端仍显示) |
| `--sandbox` | 关闭 | 沙箱模式 (引擎侧拦截全部宿主能力系统调用, 仅放行 ALLOCFRAME/TIMEUS/TIMENS) |

::: tip 日志与程序输出在同一流
日志默认输出到 **stdout**。需要只保留程序输出时用 `--log-level ERROR` (或 `CRITICAL`)。
详见 [日志与错误输出](/tools/logging)。
:::

## 性能与资源

| 选项 | 默认 | 说明 |
|------|------|------|
| `--mem-size <BYTES>` | `1073741824` (1 GiB) | 虚拟机内存大小 (最小 256, 上限 1 TiB)。4 KiB 稀疏分页按需提交, 只有真正写入的部分占物理内存, **大数组/大缓冲不需要再调它** (默认即可 `int a[1000000]`) |
| `--max-instructions <N>` | `100000000` | 指令数上限 (防死循环; 最小 1), 超限报 `instruction limit reached (N steps)` |

## 编译与 CROM

| 选项 | 默认 | 说明 |
|------|------|------|
| `--compile` | 关闭 | 编译为 `.bin` 字节码后继续执行 |
| `--compile-only` | 关闭 | 只编译为 `.bin`, 不执行 |
| `-o, --output <FILE>` | `<程序名>.bin` | 指定输出文件 (`--save` 的 `.crom` 路径固定为 `<程序名>.crom`, 不受此项影响) |
| `--crom <FILE>` | 无 | 加载指定 `.crom` 内存镜像 (仅对 `.pl` / `.asm` 生效; `.cin` / `.bin` 分支会忽略它, 并会自动探测同目录同名的 `<程序名>.crom`) |
| `--save` | 关闭 | 执行后保存 `<程序名>.crom` 内存镜像 (CROM v4 段式, 只存已分配页) |
| `--no-compress` | 压缩开启 | `.crom` 不压缩 (默认 zlib) |
| `--optimize <0-3>` | `0` | 优化级别 (越界自动裁剪到 0–3) |
| `--strict` | 关闭 | 严格汇编模式 |

## 运行时行为

| 选项 | 默认 | 说明 |
|------|------|------|
| `--seed <N>` | 随机 | 随机种子, 保证 `rand()` 序列确定 |
| `--bounds-check` | 关闭 | CIN 数组越界检查 (编译期注入字节码, 与原生路径兼容) |
| `--disasm` | 关闭 | 反汇编 `.bin` 为文本清单后退出 (支持 BIN v3 / 旧 v2 头) |

## AOT 构建

| 选项 | 说明 |
|------|------|
| `--build-exe [OUT]` | 编译成独立静态可执行文件后退出; 省略路径时输出到 `<程序名>[.exe]` |
| `--build-target <OS/ARCH>` | 交叉编译目标: `windows/amd64`、`windows/arm64`、`linux/amd64`、`linux/arm64`、`darwin/amd64`、`darwin/arm64` |
| `--build-keep-temp` | 保留 `go build` 临时目录, 便于排查构建失败 |

AOT 构建强制 `CGO_ENABLED=0` 纯静态链接, 详见 [AOT 独立可执行文件](/runtime/aot)。

## 常用组合

::: tabs

== 日常开发

```bash
codecin prog.cin --log-level ERROR          # 干净输出
codecin prog.cin --strict --log-level DEBUG # 严格汇编 + DEBUG 日志
codecin prog.cin arg1 arg2                  # 程序参数直传
```

== 汇编 / ISA 调试

```bash
codecin prog.asm                            # 汇编并执行
codecin prog.bin --disasm                   # 反汇编查看
codecin prog.asm --crom prog.crom           # 带内存镜像执行
```

== 构建与产物

```bash
codecin prog.cin --compile-only -o prog.bin # 只编译
codecin prog.cin --compile                  # 编译并执行
codecin prog.cin --save --no-compress       # 未压缩内存镜像
codecin prog.cin --build-exe prog           # AOT 单文件
```

== 受控运行

```bash
codecin prog.cin --max-instructions 1000000 # 防死循环
codecin prog.cin --seed 42                  # 确定性随机
codecin prog.cin --bounds-check             # 数组越界检查
codecin prog.cin --sandbox                  # 禁宿主能力
```

:::

## 退出码

| 退出码 | 含义 |
|--------|------|
| `0` | 正常结束 (`HALT` / 程序自然结束), 或 `--help` / `--version` / `--build-info` / `--compile-only` / `--build-exe` 成功 |
| `1` | 加载/汇编/编译/运行错误, 或 AOT 构建失败 (错误以 rich 红色面板打印) |
| `2` | 参数错误 (未知选项、非法枚举值等, 由 argparse 输出 usage) |

```text
┌──────────────────────── Load Error ────────────────────────┐
│ prog.cin:12: Compiler error: Unknown function: printline   │
└────────────────────────────────────────────────────────────┘
```

## 环境变量

| 变量 | 作用 |
|------|------|
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
