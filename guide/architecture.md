---
description: Code CIN 的整体架构：分层设计、Python 与 Go 的分工、编译执行流水线、ABI v2 一次调用、稀疏内存与段式持久化。
---

# 架构总览

Code CIN 是一门**类 C 的高级语言**加一套**跨平台运行时 (VM)**。它从源码出发, 编译成
UCPU 字节码 (UCBC), 再统一交给 **Go 原生引擎**一次调用执行整程序 (v5.9.0 起
native-only 单执行路径, 纯 Python 解释器与 JIT 已整体移除)。
除语言工具链外, 运行时还内置 2D 绘图画布 (导出 PNG)、联网音频播放与系统交互等宿主能力。

## 分层结构

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ 应用层    CLI 外壳 (codecin)   日志与统计   AOT 构建器                   │
├──────────────────────────────────────────────────────────────────────────┤
│ 编译层    CIN 编译器 (cin.py)   汇编器 (assembler.py)                    │
│           词法 → 语法 → 代码生成 → UCBC 字节码                           │
├──────────────────────────────────────────────────────────────────────────┤
│ 执行层    Go 原生引擎 (c-shared 库) · ABI v2 一次调用执行整程序          │
├──────────────────────────────────────────────────────────────────────────┤
│ 硬件层    寄存器文件 (X0-X31 / V0-V31) · 内存与保护 · 4 KiB 稀疏分页     │
├──────────────────────────────────────────────────────────────────────────┤
│ 指令集    Base 28 · ARM64 40 · RISC-V 27 · FP 10 · Vector 6 · SYS        │
└──────────────────────────────────────────────────────────────────────────┘
```

## 编译与执行流水线

```text
prog.cin ─┐
prog.pl  ─┼─► 编译器 / 汇编器 (Python) ─► UCBC 字节码 (.bin) ─► codecin_run_v2 (ABI v2) ─► Go 原生引擎
prog.asm ─┘                                        │                        │                     │
                                                   │                        │                     ├─ 寄存器 / 向量 / NZCV
                                                   │                        │                     ├─ 脏内存段
                                                   └─ 段式 CROM v4 / BIN v3 ◄┴────────────────────┴─ 程序输出 (回传后打印)
                                                      持久化 (--save / --crom)
```

1. **词法/语法分析**: `codecin/cin.py` (以及 Go 侧 `codecin/native/compiler/`) 把 CIN 源码
   tokenize、parse 成 IR, 同时处理 `import` 展开 (编译期包含);
2. **代码生成**: 生成 UCBC 指令序列与数据段, 打印编译统计
   (`CIN compiled: N instructions`);
3. **装载**: Python 侧把 `.bin` / `.crom` / `.pl` / `.asm` 产物装载进虚拟机内存
   (默认 **1 GiB**, 4 KiB 稀疏分页、按需提交);
4. **执行**: 通过 ABI v2 的 `codecin_run_v2` 一次调用把**整程序**交给 Go 原生引擎执行
   (见 [执行路径](/guide/execution-paths)); 原生库缺失时抛出 `CPUSimulatorError`
   并附重建指引 (`build.ps1` / `build.sh`), 没有解释器回退;
5. **收尾**: Go 引擎回传寄存器/向量/NZCV/脏内存段/输出, Python 侧还原状态并打印输出,
   可选保存段式 CROM v4 内存镜像。

## Python 与 Go 的分工

| 侧 | 角色 | 内容 |
|----|------|------|
| Go (`codecin/native/`) | **语言实现的核心** | CIN 编译器 (tokenizer/parser/codegen)、字节码引擎 (`engine/`)、段式 CROM 压缩与解包、AOT 产物运行时 (`aot/`)、宿主能力实现 (画布/音频/系统/FFI/网络/Termux) |
| Python (`codecin/`) | **唯一 CLI 外壳 + 编译前端与装载层** | 命令行解析、CIN 编译器、汇编器、程序装载与结果回传、日志/统计、ABI v2 ctypes 桥接 (`native.py`)、AOT 构建器 |

::: warning Go 侧不提供任何 CLI
`codecin/native/` 下唯一的 `package main` 是 cgo 的 **c-shared 库入口** `main.go`。
不存在 `codecin` 命令行二进制 —— 唯一入口是 Python 侧 (`codecin` / `codecin`)。
这样做是为了避免历史上“两套 CLI、两套语义、产物不对应”的问题。
:::

## 模块职责

| 模块 | 职责 |
|------|------|
| `codecin/cli.py` | 命令行唯一入口: argparse 参数表 (`build_parser`) → `Config` → 加载 → 执行 |
| `codecin/config.py` | 运行配置 dataclass 与默认值、`validate()` 归一化 |
| `codecin/cin.py` | CIN 编译器: 词法、语法、代码生成、`import` 解析、内建/宿主内建表 |
| `codecin/assembler.py` | PL / ASM 汇编器 (PL 关键字到助记符的映射、`.equ`/数据指示符、操作数解析) |
| `codecin/isa.py` | 指令集单一真源: `Opcode` 112 条、`Syscall`、`Constants` (参数个数、PL 关键字、名称表) |
| `codecin/cpu.py` | CPU 外壳: 程序装载、调用 Go 引擎一次执行整程序、结果回传与 SYS 宿主调用分发 |
| `codecin/native.py` | Go 原生库 ctypes 桥接: 候选路径查找、ABI v2 (`codecin_run_v2`) 符号绑定、`CPUSimulatorError` 与重建指引 |
| `codecin/memory.py` / `registers.py` | 内存 (默认 1 GiB 稀疏分页) 与寄存器文件 |
| `codecin/stats.py` | 指令/周期/分支统计与报告数据 |
| `codecin/crom.py` | 段式 BIN v3 `.bin` 与 CROM v4 `.crom` 读写 (只保存实际使用的内存页, 与 Go 端二进制兼容) |
| `codecin/aot.py` | AOT 构建器: 依赖闭包解析、stub 生成、`go build` 纯静态链接受理 (`CGO_ENABLED=0`) |
| `codecin/console.py` / `logger.py` | rich 适配层与日志 (模块内禁止直接 `print`) |
| `codecin/disasm.py` | `.bin` 反汇编为文本清单 |

完整的目录树与“改一处要同步哪些文件”见 [项目结构](/dev/structure)。

## 指令集分组

| 分组 | 数量 | 编码范围 | 内容 |
|------|------|----------|------|
| Base ISA | 28 | 0–27 | 数据传输 / 算术 / 逻辑 / 控制 / 栈 / IO |
| ARM64 扩展 | 40 | 28–67 | 条件、移位、加载存储、分支、位操作 (WFE/WFI/SEV 无事件模型, 等同 NOP) |
| FP 浮点扩展 | 10 | 68–77 | IEEE-754 浮点运算与转换 |
| Vector 向量扩展 | 6 | 78–83 | 4-lane 向量算术与加载存储 |
| RISC-V 扩展 | 27 | 84–110 | RV64I 风格加载存储 / 立即数 / 分支 / 跳转 |
| SYS 宿主调用 | 1 | 111 | 宿主系统调用 (CIN 内建函数与浮点支撑), 含 FFI 动态库 (SYS 140-144, 标准库 `lib/ffi.cin`) 与网络 (SYS 145-157, 标准库 `lib/net.cin`) |

- 逐条编码表: [指令集编码表](/reference/isa) (由 `python script/gen_isa_docs.py` 自动生成)
- 逐条语义: [指令语义参考](/asm/instructions)
- 寄存器与内存模型: [寄存器与内存模型](/reference/registers-memory)

## 产物与格式

| 产物 | 内容 | 生成 | 运行 |
|------|------|------|------|
| `.bin` | UCBC 字节码 (头部 `UCBC` + 指令流, 段式 BIN v3) | `--compile` / `--compile-only` | `codecin prog.bin` |
| `.crom` | 段式 CROM v4 内存镜像 (只保存实际使用的内存页, 可 zlib 压缩, CRC32 校验) | `--save` | `--crom <file>` 恢复内存 |
| 独立可执行文件 | 内嵌字节码与初始内存的静态单文件 (内置 Go 引擎) | `--build-exe` | 直接执行, 无需任何运行时 |

旧 BIN v2 / CROM v3 产物仍可读取。细节见 [二进制格式](/runtime/formats) 与
[AOT 独立可执行文件](/runtime/aot)。

## 设计原则

| 原则 | 体现 |
|------|------|
| 完整性 | 从高级语言到机器码的完整工具链 (编译器 / 汇编器 / AOT) |
| 性能 | 单路径 Go 原生引擎整程序一次执行、4 KiB 稀疏分页按需提交 |
| 可用性 | rich 终端界面、彩色错误面板、原生库缺失时给出重建指引 |
| 可分析性 | 指令级统计 (CPI/分支)、`--disasm` 反汇编、`--build-info` 版本核对 |
| 可扩展性 | 模块化包结构、ISA 单一真源 + 常量自动生成、表驱动宿主内建、FFI/网络标准库 |

## 下一步

- [项目结构](/dev/structure) — 目录树与同步关系
- [执行路径](/guide/execution-paths) — 单路径 native-only 执行模型
- [CIN 语言总览](/language/) — 语言全貌
