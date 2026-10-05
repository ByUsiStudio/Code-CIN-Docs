---
description: "Code CIN 内存模型与运行时开关: 1 GiB 稀疏分页原理、内存区域布局（随 --mem-size 缩放）、ALLOCFRAME 栈防护与新版错误信息、--mem-size/--max-instructions/--sandbox/--seed/--bounds-check/--no-compress 等开关。"
---

# 内存模型与运行时开关

本页说明 Code CIN 的稀疏分页内存模型、内存区域布局，以及改变运行时行为的命令行开关。默认值以 `codecin/config.py` 的 `Config` 与 `codecin/cli.py` 的 `build_parser()` 为准，实现位于 `codecin/memory.py`（Python 侧）与 `codecin/native/engine/vm.go`（Go 引擎侧）。

> 旧版的 LRU 缓存与 MMU 分页已在 v5.9.0 随单执行路径重构一并移除。

- 寄存器与内存语义参考见 [/reference/registers-memory](/reference/registers-memory)；
- 内存错误的日志与退出码见 [/tools/logging](/tools/logging)；
- 全部选项一览见 [/guide/cli](/guide/cli)。

## 稀疏分页原理

v5.9.0 起内存默认 **1 GiB**，但采用**稀疏分页、按需提交**，大地址空间并不等于大占用：

- Python 侧 `FastMemory` 用一张**页字典**管理内存：页大小固定 4 KiB（`PAGE_BITS = 12`），只有被**写入**过的页才真正分配 `bytearray`；读未写过的地址直接返回 0，不分配内存。
- `resident_bytes` 属性只统计**已分配页**的实际字节数（页数 × 4 KiB）——1 GiB 逻辑空间跑个小程序，常驻内存往往只有几 KB。
- Go 引擎侧配合 `make([]byte, memSize)`（由 OS 懒提交物理页）+ **脏页位图**：整程序执行结束只把被写过的 4 KiB 页（段式）回传给 Python 侧写回稀疏内存。

因此大数组、大缓冲不再需要手动扩容：默认配置即可 `int a[1000000]`。

## 内存区域布局

内存是平坦地址空间，多字节访问一律**小端**，定宽访问（2/4/8 字节）不跨 4 KiB 页。各区域地址随 `--mem-size` 线性缩放：

| 区域 | 地址 | 说明 |
|------|------|------|
| 数据段 | 从 `0` 向上 | CIN 全局量/字面量/字符串由编译期 `data_ptr` 从 0 递增分配（按对齐补齐） |
| 堆 | `mem_size // 2` | `CPU.heap_ptr` 初值；`SYS` 字符串/对象分配向上增长 |
| SYS 缓冲区 | `heap_ptr + 2048 + idx * 64` | 8 个 64 字节轮转缓冲（`sysBuffer()`） |
| 栈警戒线 | `heap_ptr + 4096` | 栈下探到该值即报栈溢出（见下文 ALLOCFRAME） |
| 栈 | 从 `(mem_size - 8) & ~0x7` 向下 | `PUSH` 先减 8 再写入 qword |

::: tabs

== 默认布局 (1 GiB)

```bash
codecin hello.cin
```

`mem_size = 1073741824`（`0x40000000`）时的关键取值：

| 量 | 值 |
|----|----|
| 堆基址 `heap_base` | `0x20000000` |
| 栈顶 `sp_init` | `0x3FFFFFF8` |
| 栈警戒线 | `0x20001000`（堆基址 + 4096） |

== 自定义内存大小

```bash
codecin hello.cin --mem-size 268435456
```

内存变大/变小时堆基址与栈顶同步移动（都是 `mem_size` 的函数），程序若硬编码了绝对地址需要同步调整。

:::

## ALLOCFRAME 栈防护

函数序言不再用裸 `ADDI SP` 减帧长，而是走 **SYS 137 `ALLOCFRAME`** 分配栈帧：VM 用**有符号比较**在分配前检查栈余量（栈绕回成"负地址"也能拦住），并预留 4 KB 警戒线。余量不足时直接中止：

```text
Stack overflow: frame needs N bytes, stack headroom only M bytes
(SP 0x…, guard 0x…, memory N bytes). Try --mem-size (default 1073741824)
or smaller local arrays
```

其它栈/堆错误信息：

| 消息 | 触发条件 |
|------|----------|
| `Stack overflow (collides with heap)` | `PUSH` 时 `SP` 低于栈警戒线 |
| `Stack underflow` | 栈顶之上 `POP` |
| `Address 0x… out of bounds (memory size 0x…, access width N) (negative address: stack overflow or bad pointer?)` | 地址越界，且地址 ≥ 2^63（按位模 2^64 后为负）——典型成因是栈溢出或野指针 |
| `Heap exhausted: need N bytes, free M bytes (heap 0x…-0x…). Try --mem-size (default 1073741824) or reduce allocations` | 堆分配撞上栈（字符串拼接/字符串操作有同款变体文案） |

::: tip 排查方向
- **`Stack overflow: frame needs …`**：单个函数的局部数组太大，或递归太深。前者改小局部数组或加大 `--mem-size`，后者改循环或减递归深度；
- **`negative address` 提示**：先看是否有未防护的深递归/大局部数组把 `SP` 推绕回了；
- **`Heap exhausted`**：堆增长撞上了栈。减小分配，或加大 `--mem-size`（堆基址与栈顶都会随之上移）。
:::

## 内存保护与越界错误

`FastMemory` 维护一张**逐字节**保护表（`set_protection(addr, perms, size=1)`，默认 `rwx`），所有访问入口都会检查：单字节、定宽（`read/write_word/dword/qword`、`read/write_float/double`）、块（`read_block`/`write_block`/`load_bytes`/`write_string`）。

| 错误消息 | 触发条件 |
|----------|----------|
| `Address 0x… out of bounds (memory size 0x…, access width N)` | 地址或访问宽度越出 `[0, mem_size)` |
| `Memory protection violation at 0x… for 'w'` | 单字节/定宽访问命中不允许该操作的受保护字节 |
| `Memory protection violation at 0x… for 'r' (range 0x…+N)` | 块读写范围内包含不允许该操作的受保护字节 |

```python
from codecin.memory import FastMemory

m = FastMemory(1024)
m.set_protection(8, 'r')     # 8 号字节只读
m.write_float(8, 1.5)        # -> MemoryAccessError: Memory protection violation ...
m.write_float(16, 1.5)       # 未保护地址可写
```

浮点与块访问同样受保护约束：`write_float`/`write_double` 不可绕过只读位，块读写只要范围覆盖到受保护字节就会被拒绝。

## 运行时开关

| 选项 | 默认值 | 作用 |
|------|--------|------|
| `--mem-size <BYTES>` | `1073741824`（1 GiB） | 逻辑内存大小；小于 `256` 被 `Config.validate()` 抬到 `256`，大于 1 TiB 被压回 `1 TiB` |
| `--max-instructions <N>` | `100000000` | 指令数上限；小于 `1` 时被抬到 `1` |
| `--sandbox` | 关 | 沙箱模式：拦截宿主能力系统调用（见下） |
| `--seed <N>` | `None`（随机） | 以固定种子初始化 RNG，使 `SYS RAND`（随机数）序列可复现 |
| `--bounds-check` | 关 | CIN 数组越界检查（编译期注入，见下） |
| `--no-compress` | 关（默认压缩） | `.crom` 保存时不做 zlib 压缩 |
| `--optimize <0-3>` | `0` | 优化级别 |
| `--strict` | 关 | 严格汇编模式 |

::: tabs

== 确定性执行

```bash
codecin dice.cin --seed 12345
```

同一 `--seed` 下 `SYS RAND` 序列一致，适合做可复现的回归与测试。

== 沙箱模式

```bash
codecin untrusted.cin --sandbox
```

`--sandbox` 下只放行 **ALLOCFRAME / TIMEUS / TIMENS** 三个核心系统调用（帧分配与计时）与音频以下的纯计算类内建；文件、网络、FFI、画布、GUI、键盘、Termux 等宿主能力一律拦截，报：

```text
Host capability disabled in sandbox mode (SYS N: NAME)
```

== 数组越界检查

```bash
codecin arrays.cin --bounds-check
```

该开关在 CIN 代码生成阶段为**定长数组**的每次下标访问插入运行期检查（`0 <= index < size`），与原生路径完全兼容；检查失败时运行期中止：

| 消息 | 触发条件 |
|------|----------|
| `bounds-check: negative array index` | 下标为负 |
| `bounds-check: index >= length (N)` | 下标不小于数组长度 |

代价是每条数组访问多出一次比较与分支。注意数组以 `int[] a` 指针形式传参时不携带长度，检查无法生效。数组语法见 [/language/arrays](/language/arrays)。

:::

## --max-instructions：指令数上限

`--max-instructions` 用尽是**失败**而非正常结束：引擎返回失败状态，CLI 以退出码 `1` 结束并给出错误面板。它适合给批处理/判题脚本兜底，防死循环失控，不是性能旋钮。

## 常见问题

- **`--mem-size` 改大后程序行为变了？** 堆基址与栈顶都随内存大小移动，程序若硬编码了地址（内嵌 CPU 指令/绝对地址访存）需要同步调整。
- **1 GiB 内存会不会吃光机器？** 不会：稀疏分页只让真实写入的页占物理内存，`resident_bytes` 可以验证。
- **`--bounds-check` 让程序变慢？** 这是预期代价：每次定长数组下标多一次比较与分支；原生路径不受影响，只是指令数变多。
- **栈溢出 / 栈下溢**：分别对应 `Stack overflow: frame needs …` / `Stack overflow (collides with heap)` 与 `Stack underflow`，前者通常是递归过深或局部大数组，后者通常是 `RET`/`POP` 多于 `PUSH`。
