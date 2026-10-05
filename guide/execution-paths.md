---
description: Code CIN 的执行路径（v5.9.0 起 native-only 单引擎）：程序的编译装载流程、Go 原生引擎一次调用执行的语义与原生库缺失时的行为。
---

# 执行路径

v5.9.0 起 Code CIN 是 **native-only 单引擎架构**：纯 Python 解释器与 JIT 已被移除，
所有程序统一由 **Go 原生引擎**执行。Python 侧负责编译与装载（`.cin` / `.asm` / `.pl`
/ `.bin` / `.crom`），然后把整段字节码一次性交给原生引擎，一次调用拿回全部结果
（寄存器 / 向量寄存器 / NZCV / 脏内存段 / 输出）。

## 一次执行的数据流

```text
program.cin ──codecin/cin.py──► UCBC 字节码 + 初始内存段
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

## 源码格式与装载

`codecin/cpu.py: CPU.load_program()` 按扩展名分派：

| 扩展名 | 处理 | 说明 |
|--------|------|------|
| `.cin` | `CINCompiler.compile()` | CIN 高级语言源码，`pc 0` 为 bootstrap（`CALL main; HALT`） |
| `.bin` | `crom.load_bin()` | UCBC 字节码（BIN v3 段式，兼容读 v2） |
| `.pl` / `.asm` | `Assembler.assemble_file()` | 汇编源码；同目录有同名 `.crom` 时先载入镜像 |
| `.crom` | CLI `--crom` 显式指定 | 内存镜像（CROM v4 段式，兼容读 v3） |

`--bounds-check` 是**编译期注入**的数组越界检查（编译进字节码），与原生路径完全兼容。

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
Go 引擎侧实现，与整程序执行同路径，没有能力差异。`--sandbox` 下引擎侧只放行
核心 VM 系统调用（ALLOCFRAME / TIMEUS / TIMENS），其余宿主 SYS 调用报
`Host capability disabled in sandbox mode`。语言侧调用方式见
[宿主能力](/language/host-abilities)。

## 一致性保证

单引擎架构下不再存在"多路径结果不一致"的问题：同一段字节码只有一种执行实现，
CIN 编译器（`cin.py`）与 Go 侧编译器（`native/compiler/`）由同一套测试门禁
（`python -m pytest` 全量门禁 + `script/gen_native_isa.py --check` ISA 漂移检查）
保证语义一致。

允许的输出差异只有与环境相关的时间/主机名等，以及不同平台 libm 的末位舍入
（通常 ≤ 1 ulp）。

## 怎么选

没有路径要选了——直接运行即可：

| 场景 | 建议 |
|------|------|
| 日常开发、跑示例 | `codecin prog.cin` |
| 给程序传参数 | `codecin prog.cin arg1 arg2`（或 `--` 显式分隔） |
| 需要数组越界检查 | `codecin prog.cin --bounds-check` |
| 确定性执行（随机数可复现） | `codecin prog.cin --seed 42` |
| 沙箱运行（禁宿主能力） | `codecin prog.cin --sandbox` |
| 交付给别人运行 | `--build-exe`（见 [AOT](/runtime/aot)） |

## 相关页面

- [Go 原生运行时](/runtime/native) — 原生库的加载、查找顺序与宿主能力边界
- [架构总览](/guide/architecture) — 分层结构与 ABI v2 数据流
- [内存与运行时开关](/tools/memory-cache) — 1 GiB 稀疏分页与运行期选项
- [日志与错误输出](/tools/logging) — 日志级别与错误报告
