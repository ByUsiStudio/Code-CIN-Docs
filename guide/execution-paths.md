---
description: "Code CIN 的执行路径 (v7.22.10): .sdgcc 默认 Go 原生引擎路径、--native 的 cincc 机器码路径、装载格式与两种路径的差异。"
---

# 执行路径

v7.22.10 有两条执行路径, 默认与原生:

1. **默认路径 (`.sdgcc` + Go 原生引擎)**: Python 侧编译/装载 `.cin` / `.asm` / `.pl`
   / `.sdgcc` / `.bin` / `.crom`, 把整段字节码一次性交给 Go 原生引擎, 一次调用拿回
   全部结果 (寄存器 / 向量寄存器 / NZCV / 脏内存段 / 输出);
2. **原生路径 (`--native` + `cincc`)**: Python 调用 Go 编译器 `cincc`, 直接生成目标
   机器码并执行; 不经 C、不经 UCBC、不经过 Python 的装载/回传层。

v5.9.0 起已移除纯 Python 解释器与 JIT, 默认路径没有解释器回退。

## 路径 A：默认 `.sdgcc` 执行

```text
program.cin ──codecin/cin.py──► UCBC 字节码 + 初始内存段 ──► .sdgcc
   ──native.encode_program()──► 序列化请求 (ABI v2)
        │
        ▼
   codecin_run_v2(...)            （Go: engine.Run 整程序一次执行）
        │
        ▼
   status/pc/sp/heap/steps/regs/vec/flags/脏内存段/output/error
        │
        ▼
   Python 侧写回稀疏内存 → 输出文本 → （出错则抛 ExecutionError）
```

引擎 ABI 为 **v2**（导出符号 `codecin_run_v2`）：一次调用回传全部结果，
Python 侧没有任何逐条解释开销。内存按 **段式** 回传——Go 侧用脏页位图记录
执行期间被写过的 4 KiB 页，只回传这些页，Python 侧写回 4 KiB 稀疏分页内存。
详见 [Go 原生运行时](/runtime/native)。

## 路径 B：`--native` 机器码执行

```text
program.cin ──cincc (Go)──► x86-64 ELF ──► 操作系统直接执行
                              │
                              └─ Windows: 自动经 WSL 运行
```

- `codecin prog.cin --native` 编译后在临时目录运行, 退出码即程序退出码;
- `codecin prog.cin --native-out OUT` 只构建不运行, 产物写到 `OUT`;
- `--build-target linux/amd64` 映射为 `cincc -target x86_64-linux`; 目前仅接受该目标;
- `cincc` 按 `CODECIN_CINCC` 环境变量 → `codecin/native/cincc(.exe)` →
  `PATH` 的顺序查找。

::: warning 原生路径不是默认路径的完全替代
`cincc` 当前支持纯计算、字符串/数组/struct/全局变量、分支/循环、函数调用、
多文件 `import`、`malloc`、时间/随机/休眠、文件/目录、cwd/chdir/os_name/temp_dir
与 TCP/UDP。**未实现** GUI/画布/音频、HTTP/HTTPS/DNS、FFI、Windows PE 与
完整 AArch64 后端。需要这些能力时请使用默认 `.sdgcc` 路径。
:::

::: tip AOT 的三种执行形态
`--build-exe` 默认使用 **C 后端** (系统 C 编译器产出静态单文件); 也可用
**Go native 后端** (不经过 UCBC 解码, 直接执行生成的 `engine.NativeRuntime` 调用)
或 **VM 后端** (把字节码嵌在产物里由同一套 `engine.Run` 执行)。
三种形态共享寄存器/内存/宿主能力语义, 见 [AOT](/runtime/aot#后端选择)。
:::

## 源码格式与装载

`codecin/cpu.py: CPU.load_program()` 按扩展名分派：

| 扩展名 | 处理 | 说明 |
|--------|------|------|
| `.cin` | `CINCompiler.compile()` | CIN 高级语言源码，`pc 0` 为 bootstrap（`CALL main; HALT`） |
| `.sdgcc` | `sdgcc.unwrap()` → `crom.load_bin()` | **默认编译产物**；CODE 段为 BIN v3，META/SYMS/SRCS 可压缩（v2） |
| `.bin` | `crom.load_bin()` | 兼容的纯 UCBC 字节码（BIN v3 段式，兼容读 v2；v2 需用 `--mem-size` 匹配文件头布局） |
| `.pl` / `.asm` | `Assembler.assemble_file()` | 汇编源码；同目录有同名 `.crom` 时先载入镜像 |
| `.crom` | CLI `--crom` 显式指定 | 内存镜像（CROM v4 段式，兼容读 v3） |

`--bounds-check` 是**编译期注入**的数组越界检查（编译进字节码），与原生路径完全兼容。
`--native` 只接受 `.cin` 源文件（多文件 `import` 由 `cincc` 递归展开）。

## 原生库缺失时会发生什么

没有解释器回退：动态库缺失或 ABI 不匹配时直接抛出 `CPUSimulatorError`，
错误信息附重建指引：

```text
原生引擎不可用: 未找到 codecin-native 动态库。
请先构建原生库: 运行 codecin/native/build.ps1 (Windows)
或 codecin/native/build.sh (Linux/Termux/macOS), 然后重试。
```

原生库版本不匹配（库里缺 `codecin_run_v2` 导出，通常是旁边放着旧版本库）同样会被
识别并提示重建，而不是静默失败。构建与加载顺序详见
[Go 原生运行时](/runtime/native)与[编译 Go 原生库](/dev/build-native)。

::: tip 确认环境是否就绪
用 `codecin --build-info` 一条命令看版本与原生库状态（`native` / `native matches`
行），脚本化判断用 `codecin --build-info --json`。
:::

## 宿主能力

文件 / 进程 / 画布 / 音频 / GUI / 键盘 / Termux / 网络 / FFI 等宿主能力全部在
Go 引擎侧实现，与默认整程序执行同路径，没有能力差异。`--sandbox` 下引擎侧只放行
核心 VM 系统调用（ALLOCFRAME / TIMEUS / TIMENS），其余宿主 SYS 调用报
`Host capability disabled in sandbox mode`。语言侧调用方式见
[宿主能力](/language/host-abilities)。

`--native` 产物由 `cincc` 自带的少量运行时支撑, 只覆盖上表的一个子集 (文件/目录/
时间/随机/TCP/UDP 等); 画布/音频/GUI/FFI/HTTP/DNS 等尚未实现。

## 一致性保证

默认路径仍保持“同一段字节码只有一种 Go 执行实现”: CIN 编译器 (`cin.py`) 与 Go 侧
编译器 (`native/compiler/`) 由同一套测试门禁 (`python -m pytest` 全量门禁 +
`script/gen_native_isa.py --check` ISA 漂移检查) 保证语义一致。

`--native` 走独立的 `cincc` 机器码后端, 由 Go 侧测试 (`go test ./mc`) 与共享 CIN
用例校验; 它覆盖语言子集, 不应与默认路径混用同一条“结果完全一致”的假设。
允许的输出差异只有与环境相关的时间/主机名等，以及不同平台 libm 的末位舍入
（通常 ≤ 1 ulp）。

## 怎么选

| 场景 | 建议 |
|------|------|
| 日常开发、跑示例 | `codecin prog.cin` (默认 `.sdgcc` → Go 引擎) |
| 给程序传参数 | `codecin prog.cin arg1 arg2`（或 `--` 显式分隔） |
| 需要数组越界检查 | `codecin prog.cin --bounds-check` |
| 确定性执行（随机数可复现） | `codecin prog.cin --seed 42` |
| 沙箱运行（禁宿主能力） | `codecin prog.cin --sandbox` |
| 交付给别人运行 | `--build-exe`（见 [AOT](/runtime/aot)） |
| 想要独立机器码、不经字节码 | `--native` / `--native-out` (语言子集, 见上) |

## 相关页面

- [二进制格式](/runtime/formats) — `.sdgcc` / `.bin` / `.crom` 的结构与兼容性
- [Go 原生运行时](/runtime/native) — 原生库加载、cincc 编译与宿主能力边界
- [内存与运行时开关](/tools/memory-cache) — 1 GiB 稀疏分页与运行期选项
- [日志与错误输出](/tools/logging) — 日志级别与错误报告
