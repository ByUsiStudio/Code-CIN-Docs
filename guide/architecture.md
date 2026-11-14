---
description: Code CIN 的整体架构：分层设计、Python 与 Go 的分工、.sdgcc 与 cincc 两条编译主线、ABI v2 一次调用、稀疏内存与段式持久化。
---

# 架构总览

Code CIN 是一门类 C 的高级语言加一套跨平台运行时 (VM)。8.0.0 提供两条编译主线:

- 默认主线: 源码编译成 UCPU 字节码 (UCBC), 打包为 `.sdgcc`, 再统一交给
  Go 原生引擎一次调用执行整程序 (v5.9.0 起 native-only, 纯 Python 解释器与 JIT
  已整体移除);
- 原生主线: `--native` 调用 Go 编译器 `cincc`, 直接生成目标机器码
  (x86-64 ELF, cincc 另可输出 PE32+ 与 AArch64 ELF), 不经 C、不经字节码。

除语言工具链外, 运行时还内置 2D 绘图画布 (导出 PNG)、联网音频播放与系统交互等宿主能力。

## 两条编译主线

```text
                      ┌─ 默认: Python 编译器/汇编器 ─► .sdgcc ─► Go 原生引擎 (ABI v2)
prog.cin / prog.pl / ─┤
prog.asm              └─ --native: cincc (Go) ─► x86-64 ELF / PE32+ / AArch64 ELF
```

| 主线 | 入口 | 中间产物 | 执行者 | 适用 |
|------|------|----------|--------|------|
| 默认 | `codecin prog.cin` | `.sdgcc` (CODE = BIN v3) | Go 原生引擎 | 全部语言特性、宿主能力、调试/统计 |
| 原生 | `codecin prog.cin --native` | 目标机器码 | 操作系统直接执行 | 纯计算 / 字符串 / 数组 / 文件 / TCP/UDP 等子集 |

## 分层结构

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ 应用层    CLI 外壳 (codecin)   日志与统计   AOT 构建器   cincc 编译器     │
├──────────────────────────────────────────────────────────────────────────┤
│ 编译层    CIN 编译器 (cin.py)   汇编器 (assembler.py)                    │
│           词法 → 语法 → 代码生成 → UCBC 字节码 / .sdgcc                  │
├──────────────────────────────────────────────────────────────────────────┤
│ 执行层    Go 原生引擎 (c-shared 库) · ABI v2 一次调用执行整程序          │
├──────────────────────────────────────────────────────────────────────────┤
│ 硬件层    寄存器文件 (X0-X31 / V0-V31) · 内存与保护 · 稀疏分页           │
├──────────────────────────────────────────────────────────────────────────┤
│ 指令集    Base 28 · ARM64 40 · RISC-V 27 · FP 10 · Vector 6 · SYS        │
└──────────────────────────────────────────────────────────────────────────┘
```

## 编译与执行流水线

```text
prog.cin ─┐
prog.pl  ─┼─► 编译器 / 汇编器 (Python) ─► UCBC 字节码 ─► .sdgcc ─► codecin_run_v2 (ABI v2) ─► Go 原生引擎
prog.asm ─┘                                 │                                        │                     │
                                            │                                        │                     ├─ 寄存器 / 向量 / NZCV
                                            │                                        │                     ├─ 脏内存段
                                            └─ 段式 CROM v4 / BIN v3 ◄──────────────┴─────────────────────┴─ 程序输出 (回传后打印)
                                               持久化 (--save / --crom)
```

1. 词法/语法分析: `codecin/cin.py` (以及 `cincc` 使用的 Go 侧
   `codecin/native/compiler/`) 把 CIN 源码 tokenize、parse 成 IR, 同时处理 `import`
   展开 (编译期包含);
2. 代码生成: 生成 UCBC 指令序列与数据段, 打印编译统计
   (`CIN compiled: N instructions`);
3. 装载: Python 侧把源码或 `.sdgcc` / `.bin` 产物装载进虚拟机内存
   (默认 1 GiB, 4 KiB 稀疏分页、按需提交); `.crom` 只在 `.pl` / `.asm` 入口装载;
   `.sdgcc` 的 `CODE` 段与 BIN v3 逐字节一致;
4. 执行: 通过 ABI v2 的 `codecin_run_v2` 一次调用把整程序交给 Go 原生引擎执行
   (见 [执行路径](/guide/execution-paths)); 原生库缺失时抛出 `CPUSimulatorError`
   并附重建指引 (`build.ps1` / `build.sh`), 没有解释器回退;
5. 收尾: Go 引擎按 64 KiB 脏页粒度把改动内存合并成段, 连同寄存器/向量/NZCV
   与程序输出一并回传, Python 侧还原状态并打印输出, 可选保存段式 CROM v4 内存镜像
   (4 KiB 稀疏分页是 Python 侧装载内存的粒度)。

走 `--native` 时跳过 3–5 的装载/回传流程: Python 仅把源文件路径与目标平台交给
`cincc`, 由它生成目标机器码并由操作系统直接执行 (见下文与
[执行路径](/guide/execution-paths))。

## Python 与 Go 的分工

| 侧 | 角色 | 内容 |
|----|------|------|
| Go (`codecin/native/`) | 语言实现的核心 + 原生编译器 | `cincc` 的 CIN 前端、字节码引擎 (`engine/`)、段式 CROM 压缩与解包、AOT 产物运行时 (`aot/`)、宿主能力实现 (画布/音频/系统/FFI/网络/Termux)、`cincc` 原生编译器 (`mc/` 与 `cmd/cincc/`) |
| Python (`codecin/`) | 用户 CLI 外壳 + 编译前端与装载层 | 命令行解析、CIN 编译器、汇编器、`.sdgcc` 封装、程序装载与结果回传、日志/统计、ABI v2 ctypes 桥接 (`native.py`)、AOT 构建器、`--native` 的 `cincc` 调用 |

::: warning Go 侧不提供第二套用户 CLI
`codecin/native/` 下有 `package main`: cgo 的 c-shared 库入口 `main.go`, 以及
编译器命令 `cmd/cincc/`。`cincc` 只负责把 CIN 编译为机器码, 不承担运行、日志、
调试等用户命令; 日常入口仍然是 Python 侧的 `codecin`, 以避免两套 CLI、两套语义。
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
| `codecin/sdgcc.py` | `.sdgcc` 容器读写: v1/v2 头部、CODE/META/SYMS/SRCS 段、可选 zlib 压缩 |
| `codecin/crom.py` | 段式 BIN v3 `.bin` 与 CROM v4 `.crom` 读写 (只保存实际使用的内存页, 与 Go 端二进制兼容) |
| `codecin/aot.py` | AOT 构建器: 依赖闭包解析、C/Go native/VM 后端选择、缓存、`go build` / C 工具链受理 |
| `codecin/native_codegen.py` | legacy Go-native 后端: 指令流 → 直接调用 `NativeRuntime` 的 Go 源码 (基本块拆分) |
| `codecin/cbackend.py` | C 后端: 指令流 → C 源码, 由系统 C 编译器 (GCC/Clang/Zig) 产出静态单文件 |
| `codecin/optimizer.py` | IR 优化器: `-O0..3` 窥孔/常量折叠/不可达代码删除 |
| `codecin/object.py` | `.co` 对象、`.colib` 归档、链接器、重定位与链接期 GC |
| `codecin/console.py` / `logger.py` | rich 适配层与日志 (模块内禁止直接 `print`) |
| `codecin/disasm.py` | `.sdgcc` / `.bin` 反汇编为文本清单 |
| `codecin/native/mc/` | Go 原生编译器: CIN 前端复用 + x86-64/AArch64 指令选择、寄存器分配、ELF/PE 写出 |
| `codecin/native/cmd/cincc/` | `cincc` 命令: `-o` / `-target` / `-v`, Windows 下由 Python 侧经 WSL 调用 |

完整的目录树与"改一处要同步哪些文件"见 [项目结构](/dev/structure)。

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
| `.sdgcc` | UCBC 字节码容器 (头部 `SDGCC` + CODE/META/SYMS/SRCS 段, CODE 段 = BIN v3) | `--compile` / `--compile-only` (默认) | `codecin prog.sdgcc` |
| `.bin` | UCBC 字节码 (头部 magic `CPUSA` + 指令流, 段式 BIN v3) | `--compile` / `--compile-only` | `codecin prog.bin` |
| `.crom` | 段式 CROM v4 内存镜像 (只保存实际使用的内存页, 可 zlib 压缩, CRC32 校验) | `--save` | `--crom <file>` 恢复内存 (仅 `.pl` / `.asm`) |
| `.co` | 可重定位对象 (未解析代码/数据标签、内存段、入口信息) | `--emit-object` | `--link` 合并 |
| `.colib` | 静态库归档 (多个 `.co` 成员) | `--emit-archive` | `--link` 按未定义符号拉取 |
| 独立可执行文件 | C 后端或 Go 后端生成的 native 机器码 / 内嵌字节码静态单文件 | `--build-exe` (auto/c/native/vm) | 直接执行, 无需任何运行时 |
| `cincc` 产物 | 目标平台机器码 (x86-64 ELF / PE32+ / AArch64 ELF) | `--native` / `--native-out` / `cincc` | 直接执行, 不经字节码 |

旧 BIN v2 / CROM v3 产物仍可读取; BIN v2 的 `--mem-size` 必须与文件头一致,
否则加载阶段会报错并提示重新编译或匹配旧布局。细节见
[二进制格式](/runtime/formats) 与 [AOT 独立可执行文件](/runtime/aot)。

## 设计原则

| 原则 | 体现 |
|------|------|
| 完整性 | 从高级语言到机器码的完整工具链 (编译器 / 汇编器 / AOT / `cincc`) |
| 性能 | 默认 Go 原生引擎整程序一次执行; `--native` 直出机器码; 4 KiB 稀疏分页按需提交 |
| 可用性 | rich 终端界面、彩色错误面板、原生库缺失时给出重建指引 |
| 可分析性 | 指令级统计 (CPI/分支)、`--disasm` 反汇编、`--build-info` 版本核对 |
| 可扩展性 | 模块化包结构、ISA 单一真源 + 常量自动生成、表驱动宿主内建、FFI/网络标准库 |

## 下一步

- [项目结构](/dev/structure) — 目录树与同步关系
- [执行路径](/guide/execution-paths) — `.sdgcc` 默认路径与 `--native` 机器码路径
- [CIN 语言总览](/language/) — 语言全貌
