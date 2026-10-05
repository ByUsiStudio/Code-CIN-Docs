---
layout: home

hero:
  name: Code CIN
  text: 简洁的类 C 语言与原生运行时
  tagline: CIN / PL / ASM 工具链 · UCPU 字节码 · Go 原生引擎单路径整程序执行 · 内置 2D 画布与联网音频
  image:
    src: /logo.svg
    alt: Code CIN
  actions:
    - theme: brand
      text: 初学者教程
      link: /beginner/
    - theme: alt
      text: 快速开始
      link: /guide/quickstart
    - theme: alt
      text: pip 安装
      link: /guide/installation
    - theme: alt
      text: GitHub
      link: https://github.com/ByUsiStudio/Code-CIN

features:
  - icon: 🎓
    title: 零基础教程 (13 章)
    details: 从安装与第一个程序讲到函数、数组、字符串、struct、模块、调试与六个综合项目, 每段代码都实机验证过输出。
  - icon: 🧩
    title: 三语言一条工具链
    details: CIN 高级语言、PL 关键字风格汇编、ASM 汇编, 统一编译/汇编为 UCBC 字节码, 共享同一套 ISA 与 VM。
  - icon: ⚡
    title: Go 原生引擎单路径执行
    details: Python 前端编译装载后, 经 ABI v2 (codecin_run_v2) 一次调用把整程序交给 Go 原生引擎执行, 回传寄存器/向量/标志/脏内存段与输出; 默认 1 GiB 稀疏内存。
  - icon: 🛠️
    title: 112 条指令的 UCPU
    details: Base 28 + ARM64 40 + RISC-V 27 + FP 10 + Vector 6 + SYS 宿主调用 (含 FFI 与网络); 32 通用 + 32 向量寄存器。
  - icon: 📦
    title: 36 个内置标准库
    details: math / str / array / sort / conv / rand / json / time / io / gui / ffi / net / termux 等随 pip 包分发, import 即用。
  - icon: 🔍
    title: 可分析、可核对
    details: rich 超详细日志与彩色错误面板、--disasm 反汇编、指令级性能统计、--build-info 核对原生库与包版本。
  - icon: 🚀
    title: AOT 独立可执行文件
    details: --build-exe 把 CIN 程序编译成静态单文件, 产物不需要 Python、Go 工具链、libc 或任何动态库。
  - icon: 🎨
    title: 宿主能力开箱可用
    details: 2D 画布与 GUI 窗口、音频播放、FFI 动态库调用、HTTP/TCP/UDP 网络、文件/进程/环境变量访问、Termux API(Android)。
  - icon: 🧪
    title: 严格回归
    details: 指令黄金值、内存保护、原生库版本核对、断点回归、打包断言, 全线由 CI 把关。
---

## 一条命令安装

```bash
pip install codecin
codecin --version        # 打印当前版本
codecin --help           # 完整命令行帮助
```

> Go 原生引擎库是**运行必需组件**: pip 安装时会用本机的 Go 工具链现场编译原生库;
> 本机没有工具链时可从 Release 下载预编译库, 或在源码树 `codecin/native/` 下执行
> `build.ps1` (Windows) / `build.sh` (Linux/Termux/macOS) 重建 (需 Go 1.26+)。
> 原生库缺失时运行程序会直接抛 `CPUSimulatorError`, 没有解释器回退。
> 详见 [安装 Code CIN](/guide/installation)。

## 同一段程序, 三种写法

::: tabs

== CIN (高级语言)

```c
function main() -> int {
    println("Hello, Code CIN!")
    return 0
}
```

== PL (关键字风格汇编)

```asm
.text
main:
    set x0, 65
    output x0          ; 65 -> 'A'
    output #10         ; 换行
    stop
```

== ASM (汇编)

```asm
.text
main:
    mov x0, #msg
    sys #24            ; PRINT_STR
    out #10
    halt

.data
msg: ASCIZ "Hello, Code CIN!"
```

:::

三种写法最终都编译成 UCBC 字节码, 由 **Go 原生引擎**通过 ABI v2 一次调用执行整程序:

```bash
codecin hello.cin
```

## 文档地图

| 章节 | 内容 | 入口 |
|------|------|------|
| **初学者教程** | 13 章零基础教程: 从第一个程序到函数/数组/字符串/struct/模块/调试/六个实战项目, 附习题答案与速查表 | [教程导览](/beginner/) · [速查表](/beginner/cheatsheet) |
| 指南 | 安装、快速开始、命令行、执行路径、架构、示例、FAQ | [安装](/guide/installation) · [快速开始](/guide/quickstart) |
| CIN 语言 | 词法、类型、变量、运算符、控制流、函数、struct、数组、字符串、内建、宿主能力、模块 | [语言总览](/language/) |
| 汇编 / ISA | 汇编语法 (ASM 与 PL 两种风格)、112 条指令语义、指令编码表 | [汇编总览](/asm/) |
| 标准库 | 36 个内置库的逐函数参考 | [标准库总览](/stdlib/) |
| 运行时 | Go 原生运行时、执行路径、`.bin`/`.crom` 格式、AOT 独立可执行文件 | [Go 原生运行时](/runtime/native) |
| 工具 | 日志与错误输出、性能分析、内存与运行时开关 | [日志与错误输出](/tools/logging) |
| 参考 | 指令编码表、寄存器与内存模型、Python 嵌入 API、更新日志 | [寄存器与内存模型](/reference/registers-memory) |
| 开发者 | 项目结构、编译原生库、测试与 CI、打包发布、扩展指令、贡献指南 | [项目结构](/dev/structure) |

## 项目信息

| 项目 | 信息 |
|------|------|
| 当前版本 | 以 `codecin --version` 为准 |
| 语言实现 | Go 侧是唯一核心 (CIN 编译器 / 字节码 VM / CROM / AOT 运行时), **Go 侧不提供 CLI** |
| 唯一命令行入口 | `codecin <程序> [选项]` 或安装后的 `codecin <程序> [选项]` |
| 依赖 | Python 3.8+ 与 `rich` (唯一第三方运行时依赖); Go 1.26+ 仅用于编译原生库/AOT |
| 代码仓库 | [ByUsiStudio/Code-CIN](https://github.com/ByUsiStudio/Code-CIN) |
| 文档仓库 | [ByUsiStudio/Code-CIN-Docs](https://github.com/ByUsiStudio/Code-CIN-Docs) (本站在 `docs/` 下, 以 git submodule 方式内嵌于主仓库) |
| 开发组织 | ByUsi Studio · 开发者: 北啊呢 · admin@byusistudio.fun |
