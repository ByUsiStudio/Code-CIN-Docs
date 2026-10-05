---
description: "Code CIN 的寄存器与内存模型: X0–X31/XZR、V0–V31 向量寄存器、SP/PC/NZCV、别名、1 GiB 稀疏分页内存布局、栈帧与调用约定、小端字节序、内存保护。"
---

# 寄存器与内存模型

Code CIN 的 UCPU 是一台 **64 位、小端、load/store 风格**的模拟机: 运算只在寄存器之间
发生, 内存通过显式的加载/存储指令访问。本页描述寄存器文件、内存布局、栈帧与调用约定、
保护与页管理, 以及 CIN 类型到 64 位槽的映射。

权威来源: `codecin/registers.py`、`codecin/isa.py` (`Constants`)、`codecin/memory.py`、
`codecin/cpu.py`、`codecin/cin.py`。

## 通用寄存器 X0–X31 与 XZR

| 名称 | 索引 | 说明 |
|------|------|------|
| `X0`–`X30` | 0–30 | 31 个可读写通用寄存器, 每个 64 位 |
| `XZR` | 31 | 零寄存器: **读恒为 0, 写被丢弃** |
| `SP` | 32 (伪寄存器) | 栈指针; 不在通用寄存器文件里, 由 `CPU.sp` 单独保存 |

`RegisterFile` 的语义 (见 `codecin/registers.py`):

- `read(31)` 直接返回 `0`, `write(31, v)` 是空操作 —— `XZR` 因此天然只读;
- `write()` 一律 `& 0xFFFFFFFFFFFFFFFF`, 寄存器里永远是模 2⁶⁴ 的无符号位模式;
- 索引越界抛 `ExecutionError("Invalid register index: X<n>")`;
- `X0`–`X30` 与 `SP` 共 33 个"槽" (`Constants.NUM_REGS_TOTAL = 33`), 原生引擎的结果
  回传 (ABI v2) 里 `regs` 也正好是 33 个 `uint64`, 索引 32 即 `SP`。

```python
from codecin import CPU, Config

cpu = CPU(Config(interactive_mode=False, log_level='ERROR'))
cpu.regs.write(0, 0xDEADBEEF)     # X0
cpu.regs.write(31, 12345)         # 无效: XZR 只读
print(cpu.regs.read(0), cpu.regs.read(31))   # 3735928559 0
print(cpu.regs.get_all()[:4])                # X0..X3
```

### 寄存器别名

汇编器 (`codecin/assembler.py`) 接受这些写法, 它们都解析成同一个寄存器编号:

| 汇编写法 | 等价寄存器 | 约定含义 |
|----------|-----------|----------|
| `X0`–`X31`, 以及 `R0`–`R31`、`W0`–`W31` | 同号通用寄存器 | 整机是 64 位槽模型, `W`/`R` 前缀不改变宽度 |
| `XZR` | `X31` | 零寄存器 |
| `SP` (大小写不敏感) | 伪寄存器 32 | 栈指针 |
| `FP` | `X29` | 帧指针 (CIN 编译器用它建立栈帧) |
| `LR` | `X30` | 链接寄存器 (约定, 由 `BL`/`CALL` 压栈语义承担) |

`V0`–`V31` 另有 `V<n>.<lane>` 写法, 见下节。条件码写在指令后缀里 (如 `B.NE`), 或作为
单独操作数, 完整列表见 `Constants.CONDITIONS`。

## 向量寄存器 V0–V31

| 属性 | 值 |
|------|-----|
| 数量 | 32 (`Constants.NUM_VECTOR_REGISTERS`) |
| lane 数 | 4 (`Constants.VECTOR_LANES`) |
| lane 类型 | 64 位浮点 (`float64`) |
| `V31` | 与 `XZR` 一致: 读全 `0.0`, 写丢弃 |

`VectorRegisterFile` 提供: `read_vector(n)` / `write_vector(n, values)` (要求正好 4 个值,
否则 `ExecutionError`)、`read_scalar(n, lane=0)` / `write_scalar(n, value, lane=0)`、
`get_all()` / `set_all()` / `reset()`。

向量指令 `VADD` / `VSUB` / `VMUL` / `VDIV` 按 lane 逐元素运算;
`VLD1` / `VST1` 一次搬运 16 字节, 按 `<4f` (4 个 32 位单精度) 打包解释 —— 注意这与
内部 lane 的 `float64` 表示不同, 是内存侧的紧凑格式。

::: info 向量执行与结果回传

原生引擎实现全部 ISA 指令 (含向量子集)。整程序由 Go 引擎一次执行完毕后, 32×4 个
`float64` lane 与通用寄存器、NZCV、脏内存段、输出一起由原生库回传 (ABI v2),
Python 侧据此恢复 `VectorRegisterFile` 的状态。

:::

## SP 与 PC

| 名称 | 初值 | 说明 |
|------|------|------|
| `PC` | CIN 程序为 `0` (bootstrap), 汇编程序为 `labels['main']` | `codecin/cpu.py: CPU.pc` |
| `SP` | `(mem_size - Constants.STACK_SLOT) & ~0x7` | 默认 `1073741824 - 8 = 0x3FFFFFF8` |
| 堆指针 | `mem_size // 2` | 默认 `0x20000000`; `MALLOC` / 字符串操作从这里向上分配 |

`SP` 满递减: `PUSH` 先 `SP -= 8` 再写 `[SP]`, `POP` 先读 `[SP]` 再 `SP += 8`。
栈槽固定 8 字节 (`Constants.STACK_SLOT`)。

关于 `PC` 的语义 (Go 原生引擎): **取指后先 `PC += 1` 再执行**。所以
`CALL` / `BL` 压入的是已经自增过的返回地址。

## NZCV 标志

四个 1 位条件标志, 保存在 `CPU.pstate` 字典里 (`{'N','Z','C','V'}`, 初值全 `False`),
由原生引擎执行完毕后随结果回传。

| 标志 | 含义 | 写入时机 |
|------|------|----------|
| `N` | 结果的最高位 (bit 63), 即有符号为负 | `ADDS` / `SUBS` / `ADDC` / `SUBC` / `CMP` |
| `Z` | 结果为零 | 同上 |
| `C` | **无借位** (减法) / 进位 (加法) | 同上 |
| `V` | 有符号溢出 | 同上 |

具体规则 (`_set_flags_add` / `_set_flags_sub`, Go 侧 `setFlagsSub` 一致):

- 减法: `C = (a >= b)` (无符号比较, 表示"没有借位"); `V = 有符号差超出 int64`.
- 加法: `C = (a + b) > 0xFFFFFFFFFFFFFFFF`; `V = 有符号和超出 int64`.
- `FCMP` 会写 `Z` / `N` / `C` 并强制 `V = False`。

条件码与标志的对应关系 (`CPU._condition`, 与 Go 侧 `condition()` 完全一致):

| 条件 | 语义 | 条件 | 语义 |
|------|------|------|------|
| `EQ` | `Z` | `NE` | `!Z` |
| `CS` | `C` | `CC` | `!C` |
| `MI` | `N` | `PL` | `!N` |
| `VS` | `V` | `VC` | `!V` |
| `HI` | `C && !Z` | `LS` | `!C \|\| Z` |
| `GE` | `N == V` | `LT` | `N != V` |
| `GT` | `!Z && N == V` | `LE` | `Z \|\| N != V` |
| `AL` | 恒真 | `NV` | 恒假 |

```python
from codecin import CPU, Config

cpu = CPU(Config(interactive_mode=False, log_level='ERROR'))
cpu.instructions = [
    ('MOV',  [('reg', 0), ('imm', 5)]),
    ('CMP',  [('reg', 0), ('imm', 5)]),
    ('HALT', []),
]
cpu.run()
print(cpu.pstate)                  # {'N': False, 'Z': True, 'C': True, 'V': False}
```

## 内存布局

`FastMemory` 是 **4 KiB 页稀疏字典**: 逻辑地址空间大小由 `Config.mem_size` 决定,
默认 **1073741824 字节 (1 GiB)**; 物理内存只有被写过的页才分配
(`resident_bytes` 只统计已触碰页)。读未写过的地址返回 0, 写入时才真正落页 ——
与 Go 原生引擎 `make([]byte, memSize)` 的 OS 懒提交行为一致。没有独立的段寄存器:
代码、数据、栈、堆共用同一地址空间, 靠约定划分。

区域地址随 `mem_size` 缩放, 默认 1 GiB 下的具体值:

| 区域 | 起始地址 (默认 1 GiB) | 增长方向 | 说明 |
|------|------------------------|----------|------|
| 代码 / 数据段 | `0x00000000` | 向上 | 汇编器从 0 开始摆放代码, 数据段紧随其后; CIN 的数据段由编译器排版 |
| 堆 | `0x20000000` (`mem_size // 2`) | 向上 | `MALLOC` 与字符串内建在此分配; `heap_ptr` 跟踪高水位 |
| SYS 静态缓冲 | `heap_ptr + 2048 + idx * 64` | 固定 | 8 个 64 字节轮转缓冲, 供 `ITOA` / `FTOA` / `BOOL_STR` 返回字符串 |
| 栈 | `0x3FFFFFF8` (`(mem_size - 8) & ~0x7`) | 向下 | `SP` 初值; 每个 qword 槽 8 字节 |

因为栈与堆之间隔着约 512 MiB 未触碰空间, **大数组/大缓冲不再需要 `--mem-size`**:
默认内存下 `int a[1000000]` (8 MB) 无论落在数据段还是栈帧都直接放下, 常驻物理内存
只增加实际写过的几页。

```text
0x00000000  ┌──────────────────────┐
            │ 代码 / 数据段         │  汇编器与编译器从这里向上排版
            ├──────────────────────┤
0x20000000  │ 堆 (heap_ptr →)      │  MALLOC / 字符串分配, 向上
            │  ↕ 4 KiB 警戒线       │  ALLOCFRAME 低于 heap_ptr + 4096 即报栈溢出
            │ SYS 静态缓冲 (8×64B)  │  ITOA / FTOA / BOOL_STR 返回值
            ├──────────────────────┤
            │ 未触碰的地址空间      │  4 KiB 页按需分配, 不占物理内存
            ├──────────────────────┤
0x3FFFFFF8  │ 栈 (SP ←, 向下增长)   │  8 字节/qword 槽
0x3FFFFFFFF └──────────────────────┘  地址空间 1 GiB (0x40000000)
```

### ALLOCFRAME 函数序言的栈防护

CIN 编译器生成的函数序言用 **`SYS 137 ALLOCFRAME`** 分配栈帧 (X0 = 帧字节数,
见[栈帧与调用约定](#栈帧与调用约定)):

- 引擎做**有符号比较**: `新 SP = SP - 帧长`, 与警戒线 `heap_ptr + 4096`
  (栈与堆之间 4 KiB 隔离带) 比较; SP 绕回成负地址也判溢出, 不会先取模再比较;
- 余量不足时中止并报错, 提示增大 `--mem-size` 或缩小局部数组:

  ```text
  Stack overflow: frame needs N bytes, stack headroom only M bytes (…)
  Try --mem-size (default 1073741824) or smaller local arrays
  ```

- 分配成功则 `SP -= 帧长`, X0 返回新 `SP`。

与之配合, 越界地址若 `>= 2^63` (按位模 2⁶⁴ 后表现为负数), `MemoryAccessError`
的报错会追加 `(negative address: stack overflow or bad pointer?)` ——
典型成因是栈溢出或野指针。

### 字节序与宽度

整台机器是**小端**。所有多字节读写都用小端解码 (`struct.unpack_from('<H' / '<I' /
'<Q' / '<f' / '<d')`), 原生引擎侧同样使用 `binary.LittleEndian`。

| 方法 | 宽度 | 掩码 |
|------|------|------|
| `read_byte` / `write_byte` | 1 字节 | `0xFF` |
| `read_word` / `write_word` | 2 字节 (小端) | `0xFFFF` |
| `read_dword` / `write_dword` | 4 字节 (小端) | `0xFFFFFFFF` —— `LOAD`/`STORE`/`LDR`/`STR` 用它 |
| `read_qword` / `write_qword` | 8 字节 (小端) | `0xFFFFFFFFFFFFFFFF` —— `LD`/`SD`/`LDP`/`STP`/栈用它 |
| `read_float` / `write_float` | 4 字节 IEEE-754 单精度 | — |
| `read_double` / `write_double` | 8 字节 IEEE-754 双精度 | — |
| `read_block` / `write_block` | N 字节 | 整个范围统一做边界与权限检查 |
| `read_string(addr, max_len=4096)` / `write_string(addr, text)` | UTF-8 + NUL | 字符串以 `\0` 结尾 |

::: info 定宽访问的检查范围

定宽读写 (2/4/8 字节) 对 `[addr, addr+width)` 做**边界**检查 (不得超出地址空间),
但**权限**只检查首字节; 块读写 (`read_block` / `write_block`) 对整个范围做权限检查
(`_check_protection_range`), 浮点/块读写无法绕过。稀疏内存按 4 KiB 页分段完成
实际读写, 跨页访问自动落到相邻页。

:::

## 内存保护与越界

`FastMemory` 有三层保护, 全部通过 `MemoryAccessError` 报错:

| 机制 | 接口 | 说明 |
|------|------|------|
| 边界检查 | `_check_bounds(addr, size)` | `0 <= addr <= size - width`, 否则 `Address 0x... out of bounds (memory size 0x..., access width N)`; 地址 `>= 2^63` 时追加 negative address 提示 |
| 逐字节权限 | `set_protection(addr, perms, size=1)`、`check_access(addr, access)` | `perms` 是 `'r'`/`'w'`/`'x'` 的子串, 默认 `'rwx'` |
| 块范围权限 | `_check_protection_range(addr, size, access)` | `read_block` / `write_block` 入口统一检查, 浮点/块读写无法绕过 |

默认权限是 `'rwx'`, 即不设保护时一切可访问。权限表是稀疏字典, 只记录显式设置过的字节。

```python
from codecin.memory import FastMemory
from codecin.errors import MemoryAccessError

mem = FastMemory(256)
mem.set_protection(0x10, 'r', size=8)      # 把 [0x10, 0x18) 设为只读
try:
    mem.write_qword(0x10, 1)
except MemoryAccessError as e:
    print('保护生效:', e)

try:
    mem.read_qword(0xF8)                    # 8 字节越界
except MemoryAccessError as e:
    print('越界:', e)
```

## 页与持久化

`FastMemory` 的页粒度是 4 KiB (`PAGE_BITS = 12`, `PAGE_SIZE = 4096`):

- **写入按需落页** (`_ensure_page`), 读取未分配页返回 0;
- `snapshot_segments()` 把每个已分配页输出为 `(页起始地址, 数据)` 段列表 (按地址升序),
  是 CROM v4 / BIN v3 段表、原生 ABI v2 回传段与 AOT 段文件的统一出口;
- `load_segments(segs)` 用 `(addr, data)` 列表恢复内容 (不清空现有页)。

持久化字段布局见 [二进制格式](/runtime/formats)。

```python
from codecin.memory import FastMemory

mem = FastMemory()              # 默认 1 GiB 逻辑空间
print(mem.resident_bytes)       # 0 —— 还没写任何页
mem.write_qword(0x3FFF0000, 1)  # 栈区附近写 8 字节
print(mem.resident_bytes)       # 4096 —— 落了一个 4 KiB 页
```

### 错误类型

内存访问错误统一抛 `MemoryAccessError` (`codecin/errors.py`)。v5.9.0 起没有独立的
缺页错误: 旧的 MMU 分页机制已整体移除, 原 `PageFaultError` 并入 `MemoryAccessError`。
`codecin.errors` 现在导出: `AssemblerError`、`CompilerError`、`CPUSimulatorError`、
`ExecutionError`、`MemoryAccessError`。

## 栈帧与调用约定

CIN 编译器 (`codecin/cin.py`) 生成的调用约定:

| 约定 | 规则 |
|------|------|
| 参数传递 | 调用方从左到右求值并 `PUSH`, 被调方通过帧指针访问 |
| 返回地址 | `CALL` / `BL` 压入已自增的 `PC`; `RET` 弹出并写回 `PC` |
| 帧指针 | `FP = X29`。prologue 先 `PUSH X29`, 再 `MOV X29, SP`; 有局部变量时再以 `SYS ALLOCFRAME(137)` 分配帧空间 (带栈溢出防护, 见[上文](#allocframe-函数序言的栈防护)) |
| 参数位置 | `fp+16` 是**第一个** (最左) 参数, 其后每 8 字节一个; 参数区在 `fp+8` 的返回地址之上 |
| 返回地址 / 保存的 FP | 位于 `fp+8` (返回地址) 与 `fp+0` (调用方 FP) |
| 局部变量 | 负偏移: `fp - (8 + off)`; 定长数组块基址 `fp - (off + slots*8)` |
| 返回值 | **经 `X0` 返回**; 被调方 epilogue 明确不得破坏 `X0` |
| 调用方清理 | 被调方返回后, 调用方 `SP += nargs * 8` 回收参数 (不得用 `X0`, 它持有返回值) |

帧布局 (由 `cin.py` 的注释与 `_epilogue` 保证):

```text
高地址
  ┌──────────────────────┐
  │ 参数 n-1 … 参数 0     │  fp+16 .. fp+16+(n-1)*8   (参数 0 在最左/最低)
  ├──────────────────────┤
  │ 返回地址 (调用方 PC)  │  fp+8
  ├──────────────────────┤
  │ 保存的调用方 FP       │  fp+0   ← X29 (FP)
  ├──────────────────────┤
  │ 局部变量 / 数组       │  fp-8, fp-16, …           (负偏移)
  └──────────────────────┘
低地址                          ← SP (ALLOCFRAME 分配帧后)
```

epilogue 序列 (`cin.py: _epilogue`): `SP = FP` → `POP X29` → `RET`。返回值已经放在
`X0`, 整个过程不触碰它。

原生引擎对栈的语义: 8 字节 qword 槽、满递减、`SP` 初值由装载侧传入
(`(mem_size - 8) & ~0x7`)、`CALL`/`BL` 压入自增后的 `PC`。

## CIN 类型 ↔ 64 位槽 ↔ 指令宽度

CIN 是 **64 位槽模型**: 每个标量占一个 qword 槽, 与 `int` / `char` / `short` / `long` /
`unsigned` 等类型别名同宽 (宽度别名只影响语义检查, 不改变存储)。

| CIN 类型 | 占用槽数 | 内存表示 | 典型读写指令 |
|----------|:--------:|----------|--------------|
| `int` / `char` / `short` / `long` / `unsigned` | 1 | 64 位有符号整数位模式 | `LD` / `SD` (8B), `LW`/`SW` (4B) |
| `bool` | 1 | `0` 或 `1` | `LD` / `SD` |
| `float` | 1 | IEEE-754 `float64` 位模式 (运算经 `SYS`) | `LD` / `SD`, `LDRS`/`STRS` (32 位单精度) |
| `string` | 1 | 指向 NUL 结尾 UTF-8 的内存指针 | `LD` / `SD` |
| `struct` 变量 | 1 | 指向堆对象的指针 (浅拷贝语义, 不回收) | `LD` / `SD` |
| `T[n]` 定长数组 | `n * elem_slots` | 就地存放 (数据段 / 栈帧) | `LD` / `SD` 逐元素 |
| `T[]` / `T[][]` 参数数组 | 1 | 指向元素/行指针数组的指针 | `LD` / `SD` |

| 机器层宽度 | 指令 | 用例 |
|------------|------|------|
| 1 字节 | `LB` / `SB`、`read_byte` / `write_byte` | 字符串单字节访问 (`s[i]`) |
| 2 字节 | `LH` / `SH`、`UXTH` / `SXTH` | 半字 |
| 4 字节 | `LOAD` / `STORE`、`LDR` / `STR`、`LW` / `SW` | 32 位数据、`LDRS`/`STRS` 单精度浮点 |
| 8 字节 | `LD` / `SD`、`LDP` / `STP`、`PUSH` / `POP` | 64 位槽、栈槽、`float64` 位模式 |

::: info 为什么浮点是"位模式"
`SYS` 调用 (`SQRT` / `FADD` / `SIN` …) 通过 `X0`/`X1` 传递 `float64` 的**位模式**, 结果
也以位模式写回 `X0` (见 `isa.py: Syscall` 的说明)。这样浮点运算不需要独立寄存器堆,
也不会与整数寄存器带宽冲突。
:::

## 相关页面

- [指令集编码表](/reference/isa) — 全部指令的助记符与编码
- [指令语义参考](/asm/instructions) — 逐条指令的行为
- [汇编语法参考](/asm/syntax) — 寄存器/内存操作数的书写方式
- [Python 嵌入 API](/reference/python-api) — 从 Python 直接读写寄存器与内存
- [内存与运行时开关](/tools/memory-cache) — `--mem-size` / `--sandbox` 等运行时行为开关
