---
description: Code CIN 的两种二进制格式：.bin（CPUSA v3 容器 + UCBC 字节码）与 .crom v4 段式内存镜像的字段、命令、兼容性与限制。
---

# 二进制格式

Code CIN 有两条不同的二进制产物线，用途完全不同：

| 格式 | 是什么 | 谁产生 | 能否直接运行 |
| --- | --- | --- | --- |
| `.bin` | **程序**：CPUSA 容器 + UCBC 字节码 + 初始内存段表 | `--compile` / `--compile-only` | 可以：`codecin prog.bin` |
| `.crom` | **内存快照**：某个时刻已分配页的段式快照（v4，可 zlib 压缩） | `--save` | **不可以**：它要配合 `.pl`/`.asm` 用 `--crom` 载入 |

两者魔数、版本号、头部布局都不一样，**互不通用**：把 `.crom` 当程序喂进去会失败，反之亦然。本页给出两种格式的准确字段、命令与限制。

## 为什么是段式格式

v5.9.0 起默认内存是 **1073741824 字节（1 GiB）**，物理占用按需分配（详见[寄存器与内存模型](/reference/registers-memory)）。如果继续沿用旧版的"整块内存镜像"，一个 hello world 也会写出 1 GiB 的文件——显然不可行。

因此 v5.9.0 把两种格式都改成了**段式**：只保存实际写过的内存页，其余地址空间隐式为零。

| 版本 | 布局 | 状态 |
| --- | --- | --- |
| CROM **v4** / BIN **v3** | 头部 + 段表（每段 `addr + len + data`）+ 字节码（仅 `.bin`） | **当前写出格式** |
| CROM v3 / BIN v2 | 头部 + 整块内存镜像 + 字节码（仅 `.bin`） | **仍可读取，不再写出** |

## `.bin`：CPUSA 容器 (v3)

`codecin/crom.py:save_bin()` 写出的容器布局（全部小端），固定头部 50 字节（`BIN_V3_HEADER`）：

| 偏移 | 大小 | 字段 | 说明 |
| --- | --- | --- | --- |
| 0x00 | 5 | Magic | `'CPUSA'`（`Constants.MAGIC_NUMBER`） |
| 0x05 | 1 | Version | `0x03`（`Constants.BIN_VERSION`） |
| 0x06 | 8 | Memory Size | 内存逻辑大小（u64，默认 `0x40000000` = 1 GiB） |
| 0x0E | 4 | Entry | 入口 PC（u32） |
| 0x12 | 8 | SP | 初始栈指针（u64） |
| 0x1A | 8 | Heap Base | 初始堆基址（u64） |
| 0x22 | 4 | Bytecode Length | UCBC 段长度（u32） |
| 0x26 | 4 | Seg Count | 段表条目数（u32） |
| 0x2A | 8 | Reserved | 保留，写 0 |
| 0x32 | 16×S | 段表 | 每段：`addr u64 + len u64 + data`（`len` 为该段字节数） |
| — | M | Bytecode | UCBC 字节码段（Bytecode Length 字节） |

段表统一编码为"顺序拼接"：每段先写 8 字节起始地址、8 字节数据长度，再跟数据本体。**段粒度是 4 KiB 页**——`FastMemory.snapshot_segments()` 把每个已分配页输出为一个段，按地址升序排列；只写过几 KB 的程序就只有几个段。

载入时 `load_bin()` 的行为是：

1. 校验 magic 与 `BIN_VERSION`，不符分别报 `Invalid binary file (bad magic)` 与 `Unsupported binary version: <x>`；
2. 解析段表（段表不完整 / 段数据越界报 `段表不完整 (文件损坏?)` / `段数据不完整 (文件损坏?)`）；
3. 若头部 `Memory Size` 大于当前内存，**扩容内存**并把 `config.mem_size` 同步为该值；
4. 把各段写回稀疏内存（未覆盖的地址保持 0）；
5. 解码 UCBC 段，设置 `pc = Entry`、`sp = SP`、`heap_base = heap_ptr = Heap Base`。

### UCBC 字节码段的编码

头部 13 字节：

```text
magic[4] = 'UCBC' | version u8 (0x01) | entry u32 | instr_count u32
```

随后是 `instr_count` 条指令，每条两字节前缀加若干操作数：

```text
指令:   opcode u8 | argc u8
操作数: kind u8 | value i64 | extra i64        （每个操作数 17 字节, 小端）
```

- `opcode` 是 `codecin/isa.py` 中 `Opcode` 枚举的数值（`MOV=0`、`LOAD=1` … `DNSLOOKUP=157`）；
- `argc` 是操作数个数，必须与指令语义匹配（Go 引擎会按 `argCounts` 表校验，声明个数不对直接报错）；
- `i64` 字段以二进制补码写入，Python 侧用 `_i64()` 把无符号掩码值还原为有符号数。

操作数 `kind` 取值与含义：

| kind | 名称 | `value` | `extra` |
| --- | --- | --- | --- |
| 0 | `reg` | 寄存器号 | 未用 |
| 1 | `imm` | 立即数（64 位） | 未用 |
| 2 | `vec` | 向量寄存器号 | 未用 |
| 3 | `veclane` | 向量寄存器号 | lane 下标 |
| 4 | `mem` | base 寄存器号（`-1` 表示无基址） | 偏移（64 位） |
| 5 | `cond` | 条件码（`Cond` 枚举，0–15） | 未用 |
| 6 | `float` | IEEE-754 double 的位模式 | 未用 |
| 7 | `str` | 数据段字符串地址 | 未用 |

几点编码细节：

- 汇编标签（`('label', name)`）在编码时由 `encode_program()` 用 labels 表解析成 `imm`；未定义的标签直接抛 `Undefined label`，不会写出半成品。
- `mem` 的 `base` 为 `-1` 时表示纯偏移寻址。
- `float` 用 `struct.pack('<d', ...)` 取位模式，`decode_operand()` 按同样方式还原。
- `cond` 解码时用 `Cond.NAMES[value & 15]` 还原为 `EQ`/`NE`/… 名字。

### BIN v2 遗留格式（只读）

v2 头部 34 字节：`MAGIC 5B + ver 1B + mem_size u32 + entry u32 + sp u64 + bc_len u32 + 保留 8B`，之后是**整块内存镜像**与字节码。`load_bin()` 仍按该布局读取：镜像大于当前内存时同样扩容；镜像从地址 0 整块写回。旧 `.bin` 无需转换即可继续运行，但新保存的 `.bin` 一律是 v3 段式。

## `.crom`：段式内存镜像 (v4)

`codecin/crom.py:save_crom()` 写出的格式，头部 16 字节：

| 偏移 | 大小 | 字段 | 说明 |
| --- | --- | --- | --- |
| 0x00 | 4 | Magic | `'CROM'` |
| 0x04 | 1 | Version | `0x04`（`Constants.CROM_VERSION`） |
| 0x05 | 1 | Flags | bit0 = zlib 压缩；其余保留 |
| 0x06 | 4 | Seg Count | 段表条目数（u32） |
| 0x0A | 4 | Checksum | 载荷的 CRC32（IEEE，`zlib.crc32`） |
| 0x0E | 2 | Reserved | 保留 |
| 0x10 | N | Data | 可选 zlib 压缩的段表 |

- **载荷**：与 `.bin` 相同的段表编码（每段 `addr u64 + len u64 + data`），段粒度 4 KiB 页、按地址升序——`--save` 只保存实际写过的页，hello world 级程序的 `.crom` 通常只有几百字节。
- **压缩**：`Flags` bit0 置位时载荷是 zlib 流（`zlib.compress(body, level=6)`）；`--no-compress` 时载荷就是原始段表字节。
- **CRC32 覆盖范围**：`Data` 段的全部字节（压缩后校验，载入时先验校验和再解压）。不匹配报 `.crom checksum mismatch (file corrupted?)`。
- **载入**：`load_crom()` 解析段表后用 `memory.load_segments()` 写回稀疏内存；**不清空现有页**，因此汇编器随后写的数据段会覆盖镜像中同一地址的内容。

### 旧格式兼容（只读）

| 输入 | 行为 |
| --- | --- |
| CROM **v3** | 按整块镜像读取（16 B 头 + 载荷），解压余量上限 `mem_size + 4 MiB`（`CROM_MAX_TRAILER`，原为 MMU 尾部预留）。若发现尾部 MMU 页表元数据，**忽略**并提示 `.crom v3 含 MMU 页表 (v5.9.0 起已移除 MMU), 忽略` |
| CROM **v4** | 按段表读取（本页主格式） |
| 非 CROM 魔数 | 按"旧版裸镜像"处理——前 4 字节当 `mem_size`，要求与文件实际长度自洽，否则报 `Not a .crom file`；任意垃圾文件不会被静默当成内存镜像载入 |
| 其他版本号 | 报 `Unsupported .crom version: <x>` |

## 常用命令

::: tabs

== 编译 .bin

```bash
codecin basic.cin --compile-only -o basic.bin   # 仅编译, 不执行
codecin basic.cin --compile                     # 编译为 .bin 后继续执行
```

```text
INFO  CIN compiled: 16 instructions
INFO  Binary saved to basic.bin (385 bytecode bytes, 2 segments)
Compiled to basic.bin
```

== 运行 .bin

```bash
codecin basic.bin                 # 由 Go 原生引擎直接执行
```

```text
INFO  Binary loaded: 16 instructions
Hello, Code CIN!
```

== 保存 .crom

```bash
codecin basic.cin --save                 # 运行结束后保存 <程序名>.crom
codecin basic.cin --save --no-compress   # 不压缩
```

```text
INFO  .crom saved to basic.crom (131 bytes, segments=2, compressed=True)
```

== 加载 .crom

```bash
codecin basic.asm --crom basic.crom
```

:::

::: warning `--save` 的输出路径由源文件名决定

`--save` 写的永远是 `<程序名>.crom`（与源文件同目录），**`-o` 只影响 `.bin` 的输出**。实测 `codecin hello.cin --save -o custom.crom` 仍然生成 `hello.crom`。

:::

### `--crom` 到底作用在哪

`--crom <file>` 是"**把内存快照恢复到虚拟机内存**"的机制，作用范围比名字听起来窄：

| 输入类型 | `--crom` 是否生效 | 说明 |
| --- | --- | --- |
| `.pl` / `.asm` | **生效** | 恢复快照 → 再汇编；汇编器的数据段写入会覆盖快照中同一地址的内容 |
| `.cin` | 不生效 | `codecin/cpu.py` 的 `load_program()` 在 `.cin` 分支直接返回 |
| `.bin` | 不生效 | `.bin` 分支调用 `load_bin()` 后直接返回 |

对 `.pl` / `.asm` 还有一条**自动探测**规则：未显式给 `--crom` 时，若同目录存在同名的 `<程序名>.crom`，会自动加载它：

```text
INFO  Loaded .crom v4: 2 segments, compressed=True
```

::: danger 别把 `.crom` 当可执行产物

`.crom` 只是内存快照，不含入口点、不含程序语义。直接 `codecin hello.crom` 会把文件当汇编源解析，最终以解码错误退出（退出码 1）。要跑程序用 `.bin` 或源码；`.crom` 请与 `--save`/`--crom` 成对使用，并注意它恢复的是**内存内容**，不恢复寄存器、PC 与已执行的宿主副作用。

:::

## 反汇编查看：`--disasm`

`--disasm` 接受三种输入：CPUSA **v3** 容器（当前 `.bin`）、CPUSA **v2** 遗留容器与**裸 UCBC 段**。它属于"看一眼就退出"的模式，成功退出码 0：

```bash
codecin basic.bin --disasm
```

::: tabs

== CPUSA 容器

```text
; CPUSA binary: 16 instructions, mem=1073741824 bytes, entry=0x0, sp=0x3ffffff8
;
0000: CALL #2
0001: HALT
0002: PUSH X29
0003: MOV X29 X32
```

首行格式为 `; CPUSA binary: <指令数> instructions, mem=<内存字节数> bytes, entry=0x<入口>, sp=0x<栈指针>`，指令行的格式是"四位十六进制指令序号 + 助记符 + 操作数"。v2 遗留容器同样走这条输出路径（`mem`/`sp` 取自旧头部）。

== 裸 UCBC 段

```text
; UCBC disassembly: 16 instructions, entry=0x0
;
0000: CALL #2
0001: HALT
0002: PUSH X29
0003: MOV X29 X32
```

裸段没有内存段表与 SP，首行只有指令数与入口；`#N` 表示立即数，`X29` 表示寄存器。

给出非 `.bin`/非 `UCBC` 的文件时报错并提示先编译：

```text
--disasm 需要 .bin (CPUSA 容器) 或 UCBC 字节码; 先用 `codecin src.cin --compile-only -o out.bin` 生成
```

:::

## 实现与二进制兼容性

- **`.crom` / `.bin` 的唯一写出方是 Python 侧 `codecin/crom.py`**：压缩用 `zlib.compress(level=6)`，校验和用 `zlib.crc32`（IEEE）。格式是纯数据规范，任何符合本页布局的工具都能读写。
- **字节码与原生引擎共用**：Python `encode_program()` 产出的 UCBC 段就是原生执行路径的输入（`CPU` 编译后直接把字节码与段表交给 Go 引擎），Go 侧 `decodeBytecode` 会校验 magic、版本、指令条数、`argc` 与操作数完整性——畸形输入被安全拒绝，不会 OOM 或越界 panic。
- **同构的段式思想贯穿三层**：CROM v4 / BIN v3 的段表、原生 ABI v2 回传的脏内存段、AOT 产物的 `program.segs` 段文件，都是"每段 `addr + len + data`"的同族编码，细节各有差异，见各自页面。

## 限制与版本策略

- **版本号是硬门槛，没有迁移逻辑**：`BIN_VERSION = 3`、`BC_VERSION = 1`、`CROM_VERSION = 4`。载入时版本不符分别报 `Unsupported binary version: <x>`、`Unsupported bytecode version: <x>`、`Unsupported .crom version: <x>`。旧版本（BIN v2 / CROM v3）保留**只读**兼容，不会写出。
- **`.bin` 的 `mem_size` 会改变内存布局**：`load_bin()` 在头部声明值大于当前 `--mem-size` 时扩容内存，并同步 `config.mem_size`。
- **段表是自描述的**：段数、每段长度都在文件里，解析器逐段校验完整性（`段表不完整` / `段数据不完整`），损坏文件被明确拒绝而不是载入半页数据。
- **`.bin` 尾部多余字节被忽略**：按 `instr_count` 精确读取字节码，读满即停，不做尾部校验。
- **操作数个数由指令决定**：手改 `.bin` 很容易让 `argc` 与指令语义不匹配，Python 解码会读错偏移、Go 引擎会直接拒绝。

::: tip 需要人眼核对时优先用 `--disasm`

它是唯一"零依赖、零执行"的格式检查手段：只解码不运行，因此可以安全地检查来路不明的 `.bin`。

:::

## 相关页面

- [执行路径](/guide/execution-paths)——native-only 架构下的单一路径与产物形态
- [Go 原生运行时](/runtime/native)——原生引擎如何接收段表并回传脏内存段
- [AOT 独立可执行文件](/runtime/aot)——把字节码与内存段内嵌进静态单文件
- [寄存器与内存模型](/reference/registers-memory)——1 GiB 稀疏分页与内存布局
- [命令行参考](/guide/cli)——`--compile` / `--save` / `--crom` / `--disasm` 全表
