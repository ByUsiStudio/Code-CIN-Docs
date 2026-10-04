---
description: Code CIN 39 个官方标准库（含 C / C++ / Go 兼容层）的逐库逐函数参考：签名、返回值、边界行为与可运行示例。
---

# 逐库函数参考

本页覆盖 `codecin/lib/` 下全部 **39 个**官方标准库（`codecin/lib/` 目录里就是 39 个 `.cin`），
每个库一节，先说明用途与 `import` 语句，再以表格列出**该库的全部函数**，
最后给出一个可直接运行的 CIN 示例。

约定与阅读提示：

- 签名（参数个数、顺序、类型）与返回值**直接取自 `codecin/lib/<库>.cin` 中的真实定义**；
- CIN 数组**不携带长度**，因此所有数组接口都要求显式传入元素个数 `n`；
- `void` 返回值表示该函数只产生副作用（原地修改数组、写输出数组、打印、写文件），无返回值；
- `_sorted` 结尾的函数要求输入**已升序**，否则结果无意义；矩阵类 `_to` 风格函数把结果写入调用方提供的输出数组；
- 三条执行路径（Go 原生 VM / JIT / 纯 Python 解释器）对纯 CIN 库的行为一致；
  `io` / `gui` / `termux` / `key` 四库依赖宿主能力，需 Go 原生运行时；
  `cstd` / `cppstd` / `gostd` 三个兼容层是纯 CIN，三路径一致（`gostd` 的
  `go_os_args_*` 依赖命令行参数内建，需原生路径）。

## array

整数数组工具库。CIN 数组不带长度，所有接口都要显式传元素个数 `n`。就地修改的接口返回值
是 `void`，调用后直接读原数组即可。

```c
import "array.cin"
```

| 函数名 | 签名 | 返回值 | 说明与边界行为 |
| --- | --- | --- | --- |
| `a_sum` | `a_sum(int[] a, int n)` | `int` | 前 `n` 个元素求和；`n <= 0` 时为 0 |
| `a_max` | `a_max(int[] a, int n)` | `int` | 最大值；`n <= 0` 返回 0（不是错误码） |
| `a_min` | `a_min(int[] a, int n)` | `int` | 最小值；`n <= 0` 返回 0 |
| `a_avg` | `a_avg(int[] a, int n)` | `float` | 平均值，走 `a_sum(a,n) / n` 的浮点除法；`n <= 0` 返回 `0.0` |
| `a_find` | `a_find(int[] a, int n, int v)` | `int` | 线性查找首个等于 `v` 的下标；未找到返回 `-1` |
| `a_contains` | `a_contains(int[] a, int n, int v)` | `int` | 是否包含 `v`，返回 `1`/`0` |
| `a_count` | `a_count(int[] a, int n, int v)` | `int` | `v` 出现次数 |
| `a_reverse` | `a_reverse(int[] a, int n)` | `void` | 原地反转前 `n` 个元素 |
| `a_fill` | `a_fill(int[] a, int n, int v)` | `void` | 把前 `n` 个元素全部置为 `v` |
| `a_copy` | `a_copy(int[] src, int[] dst, int n)` | `void` | 把 `src` 前 `n` 个元素拷入 `dst`；长度不足会越界 |
| `a_index_of_max` | `a_index_of_max(int[] a, int n)` | `int` | 最大值下标（并列取最靠前）；`n <= 0` 返回 `-1` |
| `a_index_of_min` | `a_index_of_min(int[] a, int n)` | `int` | 最小值下标（并列取最靠前）；`n <= 0` 返回 `-1` |
| `a_sum_range` | `a_sum_range(int[] a, int lo, int hi)` | `int` | 左闭右开区间 `[lo, hi)` 的和 |
| `a_lower_bound` | `a_lower_bound(int[] a, int n, int v)` | `int` | 首个 `>= v` 的下标（数组需有序）；无则 `-1`。实现是线性扫描，不是二分 |

```c
import "array.cin"

function main() -> int {
    int a[6] = {4, 8, 1, 8, 3, 6}
    println("sum=" + int_to_str(a_sum(a, 6)))              // 30
    println("avg=" + float_to_str(a_avg(a, 6)))            // 5
    println("find3=" + int_to_str(a_find(a, 6, 3)))        // 4
    a_reverse(a, 6)
    println("first=" + int_to_str(a[0]))                   // 6
    a_fill(a, 3, 0)
    println("count0=" + int_to_str(a_count(a, 6, 0)))      // 3
    return 0
}
```

## bigint

任意精度整数库。用**十进制数位数组**表示整数（`d[0]` 是个位，`n` 是有效数位个数，
`neg` 是符号位），整块数据装在 `struct BigInt` 的固长数组里，不使用任何动态内存，
也不依赖宿主能力内建（纯 Python 路径与 Go 原生路径行为一致）。

容量常量 `BIGINT_DIGITS = 64`，即最多 **64 位十进制数位**（最大 `10^64 - 1`，约
`1.8e64`），足以精确表示 `2^64 = 18446744073709551616` 或 `25! = 15511210043330985984000000`。
超出容量时**饱和**：结果的绝对值变成 `10^64 - 1`（符号保留），同时把溢出标志置 1，
可用 `bi_overflow()` 查询、`bi_reset_overflow()` 清除；饱和值继续参与运算仍得到饱和值，
不会崩溃也不会静默给出错误的中间值。库内全局变量只有 `BIGINT_DIGITS` 与 `bi_ovf` 两个
（合计 16 字节）。

内存提示：`BigInt` 占 66 槽 = 528 字节。按 CIN 值语义写 `BigInt r = bi_add(a, b)` 时，
每个"返回新值"的调用会在堆上分配一块 struct 且不回收，默认 64 KiB 内存下整个程序大约
可以承受 50 余次这样的调用。库内所有长循环都改用 `bi_xxx_into(a, b, out)` 复用调用方提供的
`out`（`bi_fact` / `bi_pow` 因此只占固定几块内存）；自己写长循环时请同样使用 `*_into`
形式，或给 `cpu.py` 加大 `--mem-size`。

```c
import "bigint.cin"
```

| 函数名 | 签名 | 返回值 | 说明与边界行为 |
| --- | --- | --- | --- |
| `bi_capacity` | `bi_capacity()` | `int` | 固定返回容量常量 64 |
| `bi_overflow` | `bi_overflow()` | `int` | 是否发生过容量饱和，`1`/`0`（粘滞，需手动清除） |
| `bi_reset_overflow` | `bi_reset_overflow()` | `void` | 清除溢出标志 |
| `bi_clear` | `bi_clear(BigInt a)` | `void` | 把 `a` 置为 `0`（清空全部数位、`n = 1`、`neg = 0`） |
| `bi_norm` | `bi_norm(BigInt a)` | `void` | 规范化：收紧 `n`、去掉前导零、零的符号归 0；`n` 越界会被夹到 `[1, 64]` |
| `bi_copy` | `bi_copy(BigInt dst, BigInt src)` | `void` | 槽级值拷贝（不是指针别名），拷贝后做规范化；`dst` 与 `src` 可以是同一结构体 |
| `bi_saturate` | `bi_saturate(BigInt a, int s)` | `void` | 把 `a` 置为 `10^64 - 1`，`s < 0` 时取负号，并置溢出标志 |
| `bi_sign` | `bi_sign(BigInt a)` | `int` | 符号：`-1` / `0` / `1`（先规范化 `a`） |
| `bi_is_zero` | `bi_is_zero(BigInt a)` | `int` | 是否为零，`1`/`0` |
| `bi_is_negative` | `bi_is_negative(BigInt a)` | `int` | 是否为负数，`1`/`0`（零返回 0） |
| `bi_digits` | `bi_digits(BigInt a)` | `int` | 去掉前导零后的十进制位数；**零返回 1** |
| `bi_is_saturated` | `bi_is_saturated(BigInt a)` | `int` | 是否恰好等于容量上界 `10^64 - 1`（64 个 9），`1`/`0` |
| `bi_zero` | `bi_zero()` | `BigInt` | 构造零 |
| `bi_from_int` | `bi_from_int(int v)` | `BigInt` | 由 64 位整数构造；`int` 最多 19 位十进制，因此永远不会溢出 |
| `bi_from_str` | `bi_from_str(string s)` | `BigInt` | 解析十进制串：允许前导 `+`/`-`；**遇到第一个非数字字符即停止解析**（`"12ab"` → `12`，`"abc"`/`""`/`"-"` → `0`）；有效数字超过 64 位时饱和为 `10^64 - 1` 并置溢出标志 |
| `bi_to_str` | `bi_to_str(BigInt a)` | `string` | 十进制字符串；零输出 `"0"`，负数带前导 `-` |
| `bi_cmp_mag` | `bi_cmp_mag(BigInt a, BigInt b)` | `int` | 比较绝对值：`-1` / `0` / `1` |
| `bi_cmp` | `bi_cmp(BigInt a, BigInt b)` | `int` | 与数学顺序一致的比较（负数小于零小于正数）：`-1` / `0` / `1` |
| `bi_add_mag_into` | `bi_add_mag_into(BigInt a, BigInt b, BigInt out)` | `void` | `out = \|a\| + \|b\|`；`out` 必须与 `a`、`b` 为不同结构体；结果非负 |
| `bi_sub_mag_into` | `bi_sub_mag_into(BigInt a, BigInt b, BigInt out)` | `void` | `out = \|a\| - \|b\|`，**要求 `\|a\| >= \|b\|`**；`out` 必须与 `a`、`b` 不同 |
| `bi_add_into` | `bi_add_into(BigInt a, BigInt b, BigInt out)` | `void` | `out = a + b`（符号规则与数学一致）；`out` 必须与 `a`、`b` 为不同结构体 |
| `bi_sub_into` | `bi_sub_into(BigInt a, BigInt b, BigInt out)` | `void` | `out = a - b`；`out` 必须与 `a`、`b` 为不同结构体 |
| `bi_neg_into` | `bi_neg_into(BigInt a, BigInt out)` | `void` | `out = -a`（零的相反数仍为 0） |
| `bi_abs_into` | `bi_abs_into(BigInt a, BigInt out)` | `void` | `out = \|a\|` |
| `bi_mul_into` | `bi_mul_into(BigInt a, BigInt b, BigInt out)` | `void` | `out = a * b`，**逐位相乘 + 进位**（不依赖原生 64 位乘法）；`out` 必须与 `a`、`b` 为不同结构体 |
| `bi_mul_small_into` | `bi_mul_small_into(BigInt a, int k, BigInt out)` | `void` | `out = a * k`；要求 `\|k\| <= 10^17`（更大请用 `bi_mul_into`），`out` 必须与 `a` 不同 |
| `bi_abs` | `bi_abs(BigInt a)` | `BigInt` | 绝对值 |
| `bi_neg` | `bi_neg(BigInt a)` | `BigInt` | 相反数（零的相反数仍为 0） |
| `bi_add` | `bi_add(BigInt a, BigInt b)` | `BigInt` | `a + b` |
| `bi_sub` | `bi_sub(BigInt a, BigInt b)` | `BigInt` | `a - b` |
| `bi_mul` | `bi_mul(BigInt a, BigInt b)` | `BigInt` | `a * b`（逐位相乘 + 进位，单步中间量不超过 64 位） |
| `bi_mul_small` | `bi_mul_small(BigInt a, int k)` | `BigInt` | `a * k`（快速乘以 64 位小整数） |
| `bi_pow` | `bi_pow(BigInt a, int e)` | `BigInt` | `a` 的 `e` 次幂（快速幂）；**`e < 0` 视为 0**，即返回 `1`；中途一旦饱和立即返回饱和值 |
| `bi_fact` | `bi_fact(int n)` | `BigInt` | `n` 的阶乘（`n < 0` 视为 `0! = 1`）；超过容量时饱和并置溢出标志，并立即停止迭代 |

```c
import "bigint.cin"

function main() -> int {
    BigInt a = bi_from_str("123456789012345678901234567890")
    BigInt b = bi_from_str("-98765432109876543210")
    println("a      = " + bi_to_str(a))
    println("b      = " + bi_to_str(b))
    println("a + b  = " + bi_to_str(bi_add(a, b)))
    println("a - b  = " + bi_to_str(bi_sub(a, b)))
    println("a * b  = " + bi_to_str(bi_mul(a, b)))
    println("20!    = " + bi_to_str(bi_fact(20)))
    println("2^64   = " + bi_to_str(bi_pow(bi_from_int(2), 64)))
    println("cmp    = " + int_to_str(bi_cmp(a, b)))
    println("digits = " + int_to_str(bi_digits(a)))
    println("ovf    = " + int_to_str(bi_overflow()))
    return 0
}
```

## bits

64 位位运算库。内建 `>>` 是**算术右移**（负数补 1），因此本库所有涉及负数的位移都先做
符号位/掩码处理，保证结果与 64 位无符号语义一致。位下标合法范围是 `0..63`。

```c
import "bits.cin"
```

| 函数名 | 签名 | 返回值 | 说明与边界行为 |
| --- | --- | --- | --- |
| `bits_mask` | `bits_mask()` | `int` | 返回 64 位全 1 掩码 `0xFFFFFFFFFFFFFFFF` |
| `bits_popcount` | `bits_popcount(int x)` | `int` | 二进制中 1 的个数，**含符号位**；`bits_popcount(-1)` 为 64 |
| `bits_clz` | `bits_clz(int x)` | `int` | 前导零个数（按 64 位）；`x < 0` 返回 0，`x == 0` 返回 64 |
| `bits_ctz` | `bits_ctz(int x)` | `int` | 末尾零个数；`x == 0` 返回 64 |
| `bits_is_pow2` | `bits_is_pow2(int x)` | `int` | 是否为 2 的幂，仅正数成立；`x <= 0` 返回 0 |
| `bits_next_pow2` | `bits_next_pow2(int x)` | `int` | 不小于 `x` 的最小 2 的幂；`x <= 1` 返回 1；溢出时循环提前结束 |
| `bits_test` | `bits_test(int x, int i)` | `int` | 读取第 `i` 位，返回 `0`/`1`；`i` 越界返回 0 |
| `bits_set` | `bits_set(int x, int i)` | `int` | 置位；`i` 越界时原样返回 `x` |
| `bits_clear` | `bits_clear(int x, int i)` | `int` | 清位；`i` 越界时原样返回 `x` |
| `bits_toggle` | `bits_toggle(int x, int i)` | `int` | 取反某一位；`i` 越界时原样返回 `x` |
| `bits_rotl` | `bits_rotl(int x, int n)` | `int` | 循环左移，`n` 自动对 64 取模并归一为非负数；`k == 0` 返回 `x` |
| `bits_rotr` | `bits_rotr(int x, int n)` | `int` | 循环右移，等价于 `bits_rotl(x, 64 - k)` |
| `bits_reverse` | `bits_reverse(int x)` | `int` | 64 位位序反转（低位变高位） |
| `bits_range_mask` | `bits_range_mask(int lo, int hi)` | `int` | 闭区间 `[lo, hi]` 掩码；`lo < 0`、`hi > 63` 或 `hi < lo` 返回 0 |
| `bits_extract` | `bits_extract(int x, int lo, int hi)` | `int` | 取出 `[lo, hi]` 并右移到最低位；区间非法返回 0 |
| `bits_insert` | `bits_insert(int x, int lo, int hi, int v)` | `int` | 用 `v` 的低位替换 `x` 的 `[lo, hi]`；区间非法原样返回 `x` |
| `bits_bswap` | `bits_bswap(int x)` | `int` | 字节序翻转（bswap64）；`bits_bswap(0x0102)` 为 `0x0201000000000000` |

```c
import "bits.cin"

function main() -> int {
    println("pc=" + int_to_str(bits_popcount(0xFF)))        // 8
    println("clz=" + int_to_str(bits_clz(1)))               // 63
    println("ctz=" + int_to_str(bits_ctz(8)))               // 3
    println("pow2=" + int_to_str(bits_is_pow2(64)))         // 1
    println("next=" + int_to_str(bits_next_pow2(5)))        // 8
    println("mask=" + int_to_str(bits_range_mask(4, 7)))    // 240 (0xF0)
    println("ext=" + int_to_str(bits_extract(0xABCD, 4, 7)))// 12 (0xC)
    println("ins=" + int_to_str(bits_insert(0, 4, 7, 0xC))) // 192 (0xC0)
    return 0
}
```

## bitset

多字位集合库。纯 CIN 实现，**不做动态内存分配**：位集合存放在库内全局数组 `bs_data[16]`
（2 个槽 × 8 个 64 位字）里。容量常量：**`BS_WORDS = 8`**（每集合 8 个 64 位字）、
**`BS_BITS = 512`**（每集合 512 位，合法下标 `0..511`）、**`BS_SLOTS = 2`**（槽号 `0`/`1`）。
全局数据段只占 `bs_data[16]` + `bs_cur` = 17 槽 = 136 字节。本库与 `bits.cin` 的
**单字（64 位）运算互补**：`bits.cin` 运算作用在一个 `int` 值上，本库把一整套 512 位的位集合
放在全局状态里。

槽位模型（重要）：

- 库内有两个互相独立的位集合槽：槽 `0` 与槽 `1`；`bs_cur` 记录**当前槽**（初始为 `0`，
  `bs_reset()` 会把它复位为 `0`）。
- 所有单槽操作（`bs_set` / `bs_clear` / `bs_toggle` / `bs_test` / `bs_count` / `bs_not` /
  `bs_shift_left` / `bs_shift_right` / `bs_from_int` / `bs_to_int` / `bs_get_word` /
  `bs_set_word` / `bs_count_word` / `bs_first_set` / `bs_last_set` / `bs_next_set` /
  `bs_any` / `bs_none` / `bs_clear_all`）只作用于**当前槽**。
- `bs_and` / `bs_or` / `bs_xor` / `bs_equals` 的参数 `other` 是“另一操作数槽”的槽号：
  读的是那个槽，三个逻辑运算把结果**写回当前槽**（原地），另一个槽保持不变；
  `bs_equals` 只比较，不改动任何槽。`bs_copy_from(src)` 把 `src` 槽复制到当前槽。

边界行为：

- 位下标越界（`i < 0` 或 `i > 511`）：`bs_test` 返回 `0`；`bs_set` / `bs_clear` / `bs_toggle`
  返回 `0` 且**不写内存**；`bs_next_set` 返回 `-1`。
- 槽号越界（不在 `0..1`）：`bs_select` / `bs_copy_from` / `bs_clear_slot` / `bs_and` /
  `bs_or` / `bs_xor` / `bs_equals` 返回 `0` 且不改变任何状态。
- `bs_count_word(w)` 的 `w` 越界返回 `-1`（合法计数是 `0..64`）；`bs_get_word(w)` 的 `w` 越界
  返回 `0`（64 位字的取值本身就是任意整数，没有无歧义的失败值）；`bs_set_word(w, v)` 的 `w`
  越界返回 `0` 且无操作。
- 位移量 `k < 0` 视为非法（无操作），`k == 0` 无操作，`k >= 512` 时当前槽整体清零。
- `bs_not()` 严格按 `BS_BITS = 512` 位取反（逐字与 64 位全 1 掩码异或，不用 `~` 直接取反
  64 位字），因此空集取反得到 512 位全 1 的满集。

```c
import "bitset.cin"
```

| 函数名 | 签名 | 返回值 | 说明与边界行为 |
| --- | --- | --- | --- |
| `bs_bits` | `bs_bits()` | `int` | 每个位集合的总位数，固定返回 `512`（`BS_BITS`） |
| `bs_words` | `bs_words()` | `int` | 每个位集合的 64 位字数，固定返回 `8`（`BS_WORDS`） |
| `bs_slots` | `bs_slots()` | `int` | 可用槽数，固定返回 `2`（`BS_SLOTS`） |
| `bs_select` | `bs_select(int which)` | `int` | 把当前槽切换为 `which`；`1` 成功，`0` 表示槽号非法（当前槽不变） |
| `bs_selected` | `bs_selected()` | `int` | 当前槽号（`0` 或 `1`） |
| `bs_reset` | `bs_reset()` | `void` | 清空两个槽，并把当前槽复位为 `0` |
| `bs_clear_all` | `bs_clear_all()` | `void` | 清空**当前槽**的全部 512 位（另一个槽不受影响） |
| `bs_clear_slot` | `bs_clear_slot(int which)` | `int` | 清空指定槽 `which` 的全部 512 位；`1` 成功，`0` 表示槽号非法 |
| `bs_copy_from` | `bs_copy_from(int src)` | `int` | 把槽 `src` 整体复制到当前槽；`1` 成功，`0` 表示槽号非法 |
| `bs_get_word` | `bs_get_word(int w)` | `int` | 读当前槽第 `w` 个 64 位字（`w` 合法范围 `0..7`）；**`w` 越界返回 `0`** |
| `bs_set_word` | `bs_set_word(int w, int v)` | `int` | 写当前槽第 `w` 个 64 位字；`1` 成功，`0` 表示 `w` 越界（无操作） |
| `bs_count_word` | `bs_count_word(int w)` | `int` | 当前槽第 `w` 个字里 1 的个数（`0..64`）；**`w` 越界返回 `-1`** |
| `bs_set` | `bs_set(int i)` | `int` | 置位第 `i` 位；`1` 成功，`0` 表示 `i` 越界（无操作） |
| `bs_clear` | `bs_clear(int i)` | `int` | 清位第 `i` 位；`1` 成功，`0` 表示 `i` 越界（无操作）；该位本来为 `0` 也返回 `1` |
| `bs_toggle` | `bs_toggle(int i)` | `int` | 反转第 `i` 位；`1` 成功，`0` 表示 `i` 越界（无操作） |
| `bs_test` | `bs_test(int i)` | `int` | 测试第 `i` 位，返回 `0`/`1`；`i` 越界返回 `0` |
| `bs_not` | `bs_not()` | `void` | 当前槽整 512 位取反（原地） |
| `bs_count` | `bs_count()` | `int` | 当前槽中 1 的总个数（`0..512`） |
| `bs_any` | `bs_any()` | `int` | 当前槽是否至少有一位为 1，`1`/`0` |
| `bs_none` | `bs_none()` | `int` | 当前槽是否一位都没有（空集），`1`/`0` |
| `bs_first_set` | `bs_first_set()` | `int` | 最小置位下标；**空集返回 `-1`** |
| `bs_last_set` | `bs_last_set()` | `int` | 最大置位下标；**空集返回 `-1`** |
| `bs_next_set` | `bs_next_set(int from)` | `int` | `>= from` 的下一个置位下标；没有则返回 `-1`；**`from` 越界（不在 `0..511`）返回 `-1`** |
| `bs_and` | `bs_and(int other)` | `int` | 当前槽与槽 `other` 按位与（结果写回当前槽）；`1` 成功，`0` 表示 `other` 非法（无操作） |
| `bs_or` | `bs_or(int other)` | `int` | 当前槽与槽 `other` 按位或（结果写回当前槽）；`1` 成功，`0` 表示 `other` 非法（无操作） |
| `bs_xor` | `bs_xor(int other)` | `int` | 当前槽与槽 `other` 按位异或（结果写回当前槽）；`1` 成功，`0` 表示 `other` 非法（无操作） |
| `bs_equals` | `bs_equals(int other)` | `int` | 当前槽是否与槽 `other` 完全相同，`1`/`0`；`other` 非法返回 `0` |
| `bs_shift_left` | `bs_shift_left(int k)` | `void` | 当前槽整体左移 `k` 位（下标 `i -> i + k`），移出 511 的位丢弃；`k < 0` 或 `k == 0` 无操作；**`k >= 512` 时清零** |
| `bs_shift_right` | `bs_shift_right(int k)` | `void` | 当前槽整体右移 `k` 位（下标 `i -> i - k`），移出 0 以下的位丢弃；`k < 0` 或 `k == 0` 无操作；**`k >= 512` 时清零** |
| `bs_from_int` | `bs_from_int(int v)` | `void` | 当前槽 = `v` 的低 64 位（其余 448 位清零，负数按补码展开） |
| `bs_to_int` | `bs_to_int()` | `int` | 当前槽的低 64 位（第 0 个字），高位丢弃 |
| `bs_valid` | `bs_valid(int which)` | `int` | 内部辅助：槽号是否在 `0..1`，非稳定接口 |
| `bs_popcount_word` | `bs_popcount_word(int x)` | `int` | 内部辅助：单个 64 位字的 popcount（含符号位），非稳定接口 |
| `bs_ctz_word` | `bs_ctz_word(int x)` | `int` | 内部辅助：非零 64 位字的最低置位下标（`0..63`），非稳定接口 |
| `bs_high_bit` | `bs_high_bit(int x)` | `int` | 内部辅助：非零 64 位字的最高置位下标（`0..63`），`x == 0` 返回 `-1`，非稳定接口 |

```c
import "bitset.cin"

function main() -> int {
    bs_reset()                                              // 两个槽清零, 当前槽 = 0
    bs_set(0)
    bs_set(3)
    bs_set(64)
    println("count = " + int_to_str(bs_count()))            // count = 3
    println("first = " + int_to_str(bs_first_set()))        // first = 0
    println("last = " + int_to_str(bs_last_set()))          // last = 64
    println("next 2 = " + int_to_str(bs_next_set(2)))       // next 2 = 3
    println("test 64 = " + int_to_str(bs_test(64)))         // test 64 = 1
    println("word0 popcount = " + int_to_str(bs_count_word(0)))    // word0 popcount = 2

    bs_shift_left(64)
    println("after << 64: " + int_to_str(bs_first_set())
            + ".." + int_to_str(bs_last_set()))             // after << 64: 64..128
    bs_shift_right(64)
    println("back: " + int_to_str(bs_first_set())
            + ".." + int_to_str(bs_last_set()))             // back: 0..64

    bs_from_int(0xDEADBEEF)
    println("from_int count = " + int_to_str(bs_count()))   // from_int count = 24
    println("to_int = " + int_to_str(bs_to_int()))          // to_int = 3735928559

    bs_clear_all()
    bs_not()
    println("not(empty) count = " + int_to_str(bs_count())) // not(empty) count = 512

    if (bs_select(1) != 1) { return 1 }                     // 切到槽 1
    bs_from_int(0xFF)
    if (bs_select(0) != 1) { return 1 }                     // 切回槽 0
    bs_clear_all()
    bs_set(1)
    bs_and(1)
    println("and count = " + int_to_str(bs_count()))        // and count = 1
    println("equals slot1 = " + int_to_str(bs_equals(1)))   // equals slot1 = 0
    return 0
}
```

## codec

纯 CIN 编解码与简单密码（不依赖宿主能力，三条路径一致）。只用语言内建
（`strlen` / `substr` / `strcmp` / `s[i]` / `int_to_str` / `idiv`）。

::: warning 两条必须先知道的限制
**1. 字节 0 不可表示。** `string` 是 NUL 结尾的，所以 `"\x00"` 本身就是空串：
`codec_hex_encode("\x00")` / `codec_base64_encode("\x00")` 都返回 `""`（不是
`"00"` / `"AA=="`），XOR 结果里的字节 0 会被**静默丢弃**（`codec_xor_cipher("hello","key")` 只剩 4 字节）。
需要 0..255 全值域请用 `int[]`。

**2. RLE 的计数是固定 3 位十进制**（见下表 `codec_rle_encode`）。
:::

```c
import "codec.cin"
```

| 函数名 | 签名 | 返回值 | 说明与边界行为 |
| --- | --- | --- | --- |
| `codec_hex_encode` | `codec_hex_encode(string s)` | `string` | 字节串 → 小写十六进制，无分隔；空串返回 `""` |
| `codec_hex_decode` | `codec_hex_decode(string h)` | `string` | 长度奇数或含非法字符返回 `""`；`"00"` 解出的字节 0 无法表示 |
| `codec_hex_digit` | `codec_hex_digit(int c)` | `int` | 十六进制字符 → 数值；非法返回 `-1` |
| `codec_url_encode` | `codec_url_encode(string s)` | `string` | 只保留 `A-Za-z0-9-_.~`，其余编码成 `%XX`（大写） |
| `codec_url_decode` | `codec_url_decode(string s)` | `string` | `+` 视为空格；非法 `%` 序列返回 `""` |
| `codec_rot13` | `codec_rot13(string s)` | `string` | 只转 ASCII 字母，大小写各自保持；自反 |
| `codec_caesar` | `codec_caesar(string s, int shift)` | `string` | `shift` 可为负，按 26 取模；非字母原样保留 |
| `codec_decaesar` | `codec_decaesar(string s, int shift)` | `string` | 等价 `codec_caesar(s, -shift)` |
| `codec_xor_cipher` | `codec_xor_cipher(string s, string key)` | `string` | 逐字节异或，密钥循环；密钥为空返回原串；结果中的字节 0 被丢弃 |
| `codec_base64_encode` | `codec_base64_encode(string s)` | `string` | 标准字母表 + `=` 填充；空串返回 `""` |
| `codec_base64_decode` | `codec_base64_decode(string b)` | `string` | 长度/字符非法返回 `""`；解出的字节 0 无法表示 |
| `codec_rle_encode` | `codec_rle_encode(string s)` | `string` | 行程编码：连续 `k>=2` 次重复 → **3 位十进制计数 + 该字节**（`k>999` 拆段）；单次出现的数字字符也用 `001` 前缀；其余原样。`"abc"`→`"abc"`、`"aa"`→`"002a"`、`"555"`→`"0035"`、`"aaabbc"`→`"003a002bc"` |
| `codec_rle_decode` | `codec_rle_decode(string s)` | `string` | 计数不足 3 位 / 含非数字 / 计数为 `000` / 缺字节都返回 `""` |
| `codec_morse_encode` | `codec_morse_encode(string s)` | `string` | 字母/数字 → 摩尔斯码，字母间单空格、单词间 `/`；不支持的字节跳过 |
| `codec_reverse_bytes` | `codec_reverse_bytes(string s)` | `string` | 按字节反转（会打乱非 ASCII 的多字节序列） |
| `codec_char_at` | `codec_char_at(string s, int i)` | `string` | 第 `i` 个**字节**组成的单字符字符串；越界返回 `""`（与内置 `s[i]` 不同：本函数做边界检查且返回字符串） |

> 另有若干内部辅助（`codec_chr_of` / `codec_hex_byte` / `codec_rle_count` /
> `codec_is_digit` / `codec_is_url_safe` / `codec_b64_ok` / `codec_morse_of` 等），
> 属于**非稳定接口**，不保证跨版本兼容。

```c
import "codec.cin"

function main() -> int {
    println(codec_hex_encode("AB"))        // 4142
    println(codec_base64_encode("Man"))    // TWFu
    println(codec_url_encode("a b&c"))     // a%20b%26c
    println(codec_rot13("Hello, World!"))  // Uryyb, Jbeyq!
    string r = codec_rle_encode("aaabbc")
    println(r)                             // 003a002bc
    println(codec_rle_decode(r))           // aaabbc
    return 0
}
```

## combin

数论与组合数学库 (`codecin/lib/combin.cin`, 前缀 `comb_`)。**纯 CIN 实现**: 不调用任何
宿主能力内建 (无 `file_*` / `path_*` / `mkdir`), 只用 `strlen` / `substr` / `strcmp` /
`int_to_str` / `idiv` / `%` / `abs`。**没有动态内存分配**: 素数筛用「定长全局数组 +
容量常量」的形式。

容量与全局数据:

| 常量 / 全局量 | 值 | 说明 |
| --- | --- | --- |
| `COMB_SIEVE_MAX` | `512` | 筛表容量常量, 合法下标 `0..511` |
| `comb_sieve_tab[512]` | — | 合数标记 (下标 `0`/`1` 恒为 `1`) |
| `comb_primes[512]` | — | 素数列表 (升序, 供 `comb_prime_at` / `comb_next_prime` 使用) |
| `comb_prime_n` | — | 最近一次 `comb_sieve` 找到的素数个数 |

全局数据段合计 `512*8*2 + 8 = 8200` 字节 (约 8.0 KiB), 远低于默认 64 KiB 数据段;
`comb_sieve` 只写全局表, 函数内不声明固长数组。

边界约定:

- 「无定义」输入 (负数 / 越界 / 非法进制) 返回 `0` 或 `""`, 查询类函数用 `-1` 表示失败;
- CIN 的 `/` 恒为浮点除, 本库整数除法一律用 `idiv(a, b)` 或 `%`;
- 64 位乘法按硬件自然回绕: `comb_fact` / `comb_perm` **只在 `n <= 20` 时精确**
  (`20! = 2432902008176640000` 是 64 位内最大值); `comb_choose` 因内部按
  `k = min(k, n-k)` 递推, `n <= 62` 仍精确; `comb_catalan(n)` 在 `n <= 30` 时精确;
  `comb_fib(n)` 的 `F(91)` 是 64 位内最后一个精确值;
- `comb_is_prime` 用试除法 (试除到 `sqrt(n)`, 用 `d <= idiv(n, d)` 判上界以避免乘法回绕),
  与筛表容量无关, 可用于任意大的 `n`。

```c
import "combin.cin"
```

| 函数名 | 签名 | 返回值 | 说明与边界行为 |
| --- | --- | --- | --- |
| `comb_gcd` | `comb_gcd(int a, int b)` | `int` | 最大公约数 (欧几里得, 先取绝对值); `comb_gcd(a, 0) = abs(a)`, `comb_gcd(0, 0) = 0`, 负数同样可用 |
| `comb_lcm` | `comb_lcm(int a, int b)` | `int` | 最小公倍数 `abs(idiv(a, g) * b)`; 任一参数为 `0` 返回 `0` |
| `comb_gcd3` | `comb_gcd3(int a, int b, int c)` | `int` | 三个数的最大公约数, 即 `comb_gcd(comb_gcd(a, b), c)` |
| `comb_is_prime` | `comb_is_prime(int n)` | `int` | 试除法判素, 返回 `1`/`0`; `n < 2` 为 `0`, `n == 2` 为 `1`, 偶数直接为 `0`; 与筛表容量无关 |
| `comb_sieve` | `comb_sieve(int n)` | `int` | 埃氏筛出 `[0, n]` 的素数写入全局表, 返回素数个数; `n < 2` 返回 `0` 并清空表; `n > 511` 按 `511` 截断 (超出部分不保证); 每次调用都会先清空整张表 |
| `comb_prime_at` | `comb_prime_at(int i)` | `int` | 第 `i` 个素数 (0 起, 依据最近一次 `comb_sieve`); **越界 (含负数) 返回 `-1`** |
| `comb_prime_count` | `comb_prime_count()` | `int` | 最近一次 `comb_sieve` 的素数个数; 未筛过时为 `0` |
| `comb_next_prime` | `comb_next_prime(int n)` | `int` | **`>= n`** 的最小素数 (`n` 本身是素数就返回 `n`); 表内找不到 (含超出 `511`) 返回 `-1`; 必须先调用过 `comb_sieve` |
| `comb_fact` | `comb_fact(int n)` | `int` | 阶乘 `n!`; 仅 `n in [0, 20]` 精确, `n < 0` 或 `n > 20` 返回 `0` |
| `comb_perm` | `comb_perm(int n, int k)` | `int` | 排列数 `P(n, k)`; `k == 0` 返回 `1`; `k < 0` 或 `k > n` 或 `n < 0` 返回 `0`; 仅 `n <= 20` 精确 |
| `comb_choose` | `comb_choose(int n, int k)` | `int` | 组合数 `C(n, k)`; `k < 0` / `k > n` / `n < 0` 返回 `0`; `k == 0` 或 `k == n` 返回 `1`; 内部按 `min(k, n-k)` 递推, `n <= 62` 精确 |
| `comb_catalan` | `comb_catalan(int n)` | `int` | 卡特兰数 `C(2n, n) / (n + 1)`; `n < 0` 返回 `0`; `n <= 30` 精确 |
| `comb_fib` | `comb_fib(int n)` | `int` | 斐波那契 `F(0) = 0`、`F(1) = 1`, 迭代实现; `n < 0` 返回 `0`; `F(91)` 为 64 位内最后一个精确值 |
| `comb_digit_sum` | `comb_digit_sum(int n)` | `int` | 十进制数字和 (取绝对值); `comb_digit_sum(-123) = 6`, `0` 为 `0` |
| `comb_digit_count` | `comb_digit_count(int n)` | `int` | 十进制位数 (取绝对值); `0` 记为 `1` 位 |
| `comb_reverse_int` | `comb_reverse_int(int n)` | `int` | 整数倒序并保留符号: `1230 -> 321`, `-120 -> -21`; 结果超出 64 位时为回绕值 |
| `comb_is_palindrome` | `comb_is_palindrome(int n)` | `int` | 回文数判定 (忽略符号), 返回 `1`/`0`; `0` 与个位数都是回文 |
| `comb_is_armstrong` | `comb_is_armstrong(int n)` | `int` | 阿姆斯特朗数 (水仙花数) 判定, 取绝对值; `153` / `370` / `371` / `407` / `1634` / `9474` 为真; 位数很多时幂和会回绕 (结果无意义) |
| `comb_to_base` | `comb_to_base(int n, int base)` | `string` | 整数转 `base` 进制字符串, 用大写字母; **`base` 非法 (`< 2` 或 `> 36`) 返回 `""`**; 负数带 `-` 前缀; `0` 返回 `"0"` (按绝对值转换, 不是补码) |
| `comb_from_base` | `comb_from_base(string s, int base)` | `int` | `base` 进制字符串转整数; 失败返回 `0`。允许前导空白与一个前导 `+`/`-`, 允许 `0x`/`0X` 前缀 (仅 `base == 16`), 大小写字母都接受; 出现 `>= base` 的数字或非法字符立即返回 `0` (不返回部分结果); 空串、只有符号、只有 `0x` 都返回 `0` |
| `comb_mod_pow` | `comb_mod_pow(int base, int exp, int mod)` | `int` | 快速幂取模 `(base ^ exp) mod mod`;**`mod <= 0` 或 `exp < 0` 返回 `0`**; `exp == 0` 返回 `1 % mod`; `base` 为负时先归一化到 `[0, mod)`; 保证 `mod <= 2^31` 且 `abs(base) < 2^31` 时精确 |
| `comb_collatz_steps` | `comb_collatz_steps(int n)` | `int` | 考拉兹 (3n+1) 到 `1` 的步数; `n <= 1` 返回 `0`; 循环有 100 万步上限 (防跑飞) |
| `comb_is_perfect` | `comb_is_perfect(int n)` | `int` | 完全数判定 (真因子之和等于自身); `n <= 1` 返回 `0`; `6` / `28` / `496` / `8128` 为真 |
| `comb_divisor_count` | `comb_divisor_count(int n)` | `int` | 正因子个数 (含 `1` 与自身); `n <= 0` 返回 `0`; `comb_divisor_count(12) = 6` |
| `comb_divisor_sum` | `comb_divisor_sum(int n)` | `int` | 正因子之和 (含 `1` 与自身); `n <= 0` 返回 `0`; `comb_divisor_sum(12) = 28` |

`comb_int_pow(base, exp)` 是本库内部使用的整数幂辅助函数 (`exp < 0` 返回 `0`), 未列在上表中。

```c
import "combin.cin"

function main() -> int {
    println("gcd(48,18) = " + int_to_str(comb_gcd(48, 18)))          // 6
    println("lcm(4,6) = " + int_to_str(comb_lcm(4, 6)))              // 12
    println("gcd3(12,18,30) = " + int_to_str(comb_gcd3(12, 18, 30))) // 6
    println("is_prime(97) = " + int_to_str(comb_is_prime(97)))       // 1

    println("sieve(100) = " + int_to_str(comb_sieve(100)))           // 25 (pi(100))
    println("prime_at(24) = " + int_to_str(comb_prime_at(24)))       // 97
    println("next_prime(8) = " + int_to_str(comb_next_prime(8)))     // 11
    println("prime_at(25) = " + int_to_str(comb_prime_at(25)))       // -1 (越界)

    println("fact(10) = " + int_to_str(comb_fact(10)))               // 3628800
    println("perm(5,2) = " + int_to_str(comb_perm(5, 2)))            // 20
    println("choose(5,2) = " + int_to_str(comb_choose(5, 2)))        // 10
    println("catalan(5) = " + int_to_str(comb_catalan(5)))           // 42
    println("fib(20) = " + int_to_str(comb_fib(20)))                 // 6765

    println("digit_sum(-123) = " + int_to_str(comb_digit_sum(-123))) // 6
    println("digit_count(1234) = " + int_to_str(comb_digit_count(1234)))  // 4
    println("reverse_int(-120) = " + int_to_str(comb_reverse_int(-120)))  // -21
    println("is_palindrome(121) = " + int_to_str(comb_is_palindrome(121)))  // 1
    println("is_armstrong(153) = " + int_to_str(comb_is_armstrong(153)))    // 1

    println("to_base(255,16) = " + comb_to_base(255, 16))            // FF
    println("to_base(-255,16) = " + comb_to_base(-255, 16))          // -FF
    println("to_base(5,1) = [" + comb_to_base(5, 1) + "]")           // []
    println("from_base(FF,16) = " + int_to_str(comb_from_base("FF", 16)))  // 255
    println("from_base(-1F,16) = " + int_to_str(comb_from_base("-1F", 16)))  // -31

    println("mod_pow(2,10,1000) = " + int_to_str(comb_mod_pow(2, 10, 1000)))  // 24
    println("collatz(27) = " + int_to_str(comb_collatz_steps(27)))   // 111
    println("is_perfect(28) = " + int_to_str(comb_is_perfect(28)))   // 1
    println("divisor_count(12) = " + int_to_str(comb_divisor_count(12)))  // 6
    println("divisor_sum(12) = " + int_to_str(comb_divisor_sum(12)))      // 28
    return 0
}
```

## conv

进制转换与字符串格式化库。整数一律按 **64 位无符号**处理，负数的十六进制输出是 16 位补码形式。

```c
import "conv.cin"
```

| 函数名 | 签名 | 返回值 | 说明与边界行为 |
| --- | --- | --- | --- |
| `c_hex_digit` | `c_hex_digit(int ch)` | `int` | 十六进制字符 → 数值，支持 `0-9` `A-F` `a-f`；非法返回 `-1`（参数是字符字节值） |
| `c_to_hex` | `c_to_hex(int v)` | `string` | 整数 → 大写十六进制字符串；`0` 返回 `"0"`，无 `0x` 前缀，负数给出 16 位补码 |
| `c_parse_hex` | `c_parse_hex(string s)` | `int` | 十六进制字符串 → 整数；可带 `0x`/`0X` 前缀，**遇非法字符停止**而非报错 |
| `c_to_bin` | `c_to_bin(int v)` | `string` | 整数 → 二进制字符串；`0` 返回 `"0"`，负数按 64 位无符号展开 |
| `c_parse_bin` | `c_parse_bin(string s)` | `int` | 二进制字符串 → 整数；可带 `0b`/`0B` 前缀，遇非法字符停止 |
| `c_pad_left` | `c_pad_left(string s, int width, string fill)` | `string` | 左填充到宽度 `width`；`fill` 可多字符（长度不整除时结果可超过 `width`），`fill` 为空串时原样返回 |
| `c_pad_right` | `c_pad_right(string s, int width, string fill)` | `string` | 右填充到宽度 `width`，规则同上 |
| `c_pad_int` | `c_pad_int(int v, int width)` | `string` | 用 `0` 左填充整数到 `width`；负数保留 `-` 号且只填充数字部分 |
| `c_repeat` | `c_repeat(string s, int n)` | `string` | 字符串重复 `n` 次；`n <= 0` 返回空串 |
| `c_chr` | `c_chr(int code)` | `string` | 字符编码 → 单字符字符串；特殊处理 `10`/`9`/`13`；覆盖常用可见 ASCII，未知返回空串 |
| `c_to_int` | `c_to_int(string s)` | `int` | 十进制字符串 → 整数，是内建 `atoi` 的别名 |
| `c_parse_float` | `c_parse_float(string s)` | `float` | 字符串 → 浮点；支持可选负号与小数部分，遇非法字符停止，不解析指数形式 |

```c
import "conv.cin"

function main() -> int {
    println(c_to_hex(255))                  // FF
    println(int_to_str(c_parse_hex("0x1F")))// 31
    println(c_to_bin(10))                   // 1010
    println(int_to_str(c_parse_bin("0b1010")))  // 10
    println(c_pad_int(7, 3))                // 007
    println(c_pad_left("ab", 4, "-"))       // --ab
    println(c_repeat("xy", 3))              // xyxyxy
    println(float_to_str(c_parse_float("-3.25")))  // -3.25
    return 0
}
```

## cppstd

C++ 标准库 (STL) 兼容层，以 `std::` 命名习惯提供 `std::string` / `std::vector` /
`std::stack` / `std::queue` 的常用方法与 `<utility>` / `<algorithm>` 工具。纯 CIN 实现，
三路径一致。CIN 没有模板与引用包装，容器以「**数组 + 长度游标**」表达：数组是引用传递，
push/pop 返回**新的长度**，调用方把它存回自己的游标变量；push 前需自行保证数组容量。
查找类的 `npos` 统一以 `-1` 表示。

```c
import "cppstd.cin"
```

| 函数名 | 签名 | 返回值 | 说明与边界行为 |
| --- | --- | --- | --- |
| `stl_str_size` / `stl_str_length` | `(string s)` | `int` | `size()` / `length()`，即 `strlen` |
| `stl_str_empty` | `(string s)` | `int` | `1` 空串 / `0` |
| `stl_str_find` | `(string s, string sub)` | `int` | `find()` 首现下标，未找到 `-1` |
| `stl_str_rfind` | `(string s, string sub)` | `int` | `rfind()` 末现下标，未找到 `-1`；空 sub 返回 `strlen(s)` |
| `stl_str_substr` | `(string s, int pos, int len)` | `string` | `substr(pos, len)` |
| `stl_str_append` | `(string a, string b)` | `string` | `operator+` / `append()` |
| `stl_str_compare` | `(string a, string b)` | `int` | `compare()`：`<0` / `0` / `>0` |
| `stl_str_c_str` | `(string s)` | `string` | `c_str()`：CIN 字符串本身就是宿主字符串，恒等返回 |
| `stl_str_starts_with` / `stl_str_ends_with` | `(string s, string pre/suf)` | `int` | C++20 `starts_with` / `ends_with`；空前/后缀返回 `1` |
| `stl_str_find_first_of` / `stl_str_find_last_of` | `(string s, string chars)` | `int` | chars 中任一字符的首/末现下标，未找到 `-1` |
| `stl_str_at` | `(string s, int i)` | `int` | `at(i)` 字符码；越界返回 `0`（C++ 此处抛 `out_of_range`） |
| `stl_str_front` / `stl_str_back` | `(string s)` | `int` | 首/末字符码；空串返回 `0` |
| `stl_str_insert` | `(string s, int pos, string sub)` | `string` | 在 `pos` 前插入；`pos` 越界裁剪到 `0` / 末尾 |
| `stl_str_erase` | `(string s, int pos, int len)` | `string` | 删除 `[pos, pos+len)`；越界裁剪，`len<0` 视为 `0` |
| `stl_str_replace` | `(string s, int pos, int len, string sub)` | `string` | 把 `[pos, pos+len)` 替换为 `sub`；越界裁剪 |
| `stl_to_string` | `(int v)` | `string` | `std::to_string` |
| `stl_vec_push_back` | `(int[] v, int len, int x)` | `int` | 追加并返回**新长度** |
| `stl_vec_pop_back` | `(int len)` | `int` | 返回**新长度**；空容器不变 |
| `stl_vec_back` / `stl_vec_front` | `(int[] v, int len)` | `int` | 末/首元素；空容器返回 `0` |
| `stl_vec_size` / `stl_vec_empty` | `(int len)` | `int` | 长度 / 是否为空 |
| `stl_vec_clear` | `()` | `int` | 返回 `0`（CIN 无动态内存，长度归零即可） |
| `stl_vec_at` | `(int[] v, int len, int i)` | `int` | 带边界检查；越界返回 `0` |
| `stl_vec_insert` | `(int[] v, int len, int i, int x)` | `int` | 在 `i` 处插入整体后移，返回新长度；`i` 越界视为尾部追加 |
| `stl_vec_erase` | `(int[] v, int len, int i)` | `int` | 删除 `i` 处元素整体前移，返回新长度；越界不修改 |
| `stl_vec_find` / `stl_vec_count` | `(int[] v, int len, int x)` | `int` | 首个等于 `x` 的下标（无则 `-1`）/ 等于 `x` 的个数 |
| `stl_vec_reverse` / `stl_vec_fill` | `(int[] v, int len, ...)` | `void` | 原地反转 / 填充 |
| `stl_vec_sum` / `stl_vec_max` / `stl_vec_min` | `(int[] v, int len)` | `int` | 求和 / 最大 / 最小（空容器返回 `0`） |
| `stl_stack_push` | `(int[] s, int top, int x)` | `int` | 压栈并返回新 `top`（`0` = 空栈） |
| `stl_stack_pop` | `(int top)` | `int` | 弹栈并返回新 `top`；空栈不变 |
| `stl_stack_top` | `(int[] s, int top)` | `int` | 栈顶（空栈 `0`） |
| `stl_stack_size` / `stl_stack_empty` | `(int top)` | `int` | 栈深 / 是否为空 |
| `stl_queue_push` | `(int[] q, int tail, int x)` | `int` | 入队并返回新 `tail`（非循环数组队列，`head <= tail`） |
| `stl_queue_pop` | `(int head)` | `int` | 出队返回新 `head`（调用方保证非空） |
| `stl_queue_front` / `stl_queue_back` | `(int[] q, int head/tail)` | `int` | 队首 / 队尾 |
| `stl_queue_empty` / `stl_queue_size` | `(int head, int tail)` | `int` | 是否为空 / 元素个数 |
| `stl_max` / `stl_min` / `stl_abs` | `(int a, int b)` / `(int x)` | `int` | `<utility>` |
| `stl_swap` | `(int[] v, int i, int j)` | `void` | 交换数组两个元素 |
| `stl_sort` / `stl_sort_desc` | `(int[] v, int len)` | `void` | 冒泡升序 / 降序（CIN 无函数指针，固定序） |
| `stl_find` / `stl_count` | `(int[] v, int len, int x)` | `int` | `<algorithm>` 馎查找 / 计数 |
| `stl_clamp` | `(int x, int lo, int hi)` | `int` | 钳制到 `[lo, hi]` |

```c
import "cppstd.cin"

function main() -> int {
    int v[8]
    int n = 0
    n = stl_vec_push_back(v, n, 3)
    n = stl_vec_push_back(v, n, 1)
    n = stl_vec_insert(v, n, 0, 2)      // {2, 3, 1}
    stl_sort(v, n)                       // {1, 2, 3}
    println(int_to_str(stl_vec_at(v, n, 1)))   // 2
    println(stl_str_starts_with("hello", "he") == 1 ? "yes" : "no")   // yes
    return 0
}
```

## cstd

C 语言兼容层，语义对齐 `<ctype.h>` / `<string.h>` / `<stdlib.h>` / `<math.h>` /
`<stdio.h>`，让 C 程序员以惯用的名字与约定操作 CIN 的内置类型。纯 CIN 实现，三路径一致。
类型映射：C `int/size_t` → `int`、C `char` → 字符码 `int`（可用 `'A'` 字符字面量）、
C `char*` → `string`、C `float/double` → `float`、C `bool` → `int(0/1)`、
C `EOF` → `-1`。差异：CIN 无裸指针，「写入 dst」类 API 返回新串、
`strchr` 返回**下标**（C 返回指针）；数组以引用传递并显式带长度。

```c
import "cstd.cin"
```

| 函数名 | 签名 | 返回值 | 说明与边界行为 |
| --- | --- | --- | --- |
| `libc_isdigit` / `libc_islower` / `libc_isupper` / `libc_isalpha` / `libc_isalnum` | `(int ch)` | `int` | `<ctype.h>` 字符类别判定，`1` / `0` |
| `libc_isspace` / `libc_isprint` / `libc_isgraph` / `libc_isblank` / `libc_iscntrl` / `libc_ispunct` / `libc_isxdigit` | `(int ch)` | `int` | 其余字符类别（`isblank` 含空格与 `\t`） |
| `libc_toupper` / `libc_tolower` | `(int ch)` | `int` | 大小写转换（非字母原样返回） |
| `libc_toascii` | `(int ch)` | `int` | 清除高位（`ch & 0x7F`） |
| `libc_strlen` | `(string s)` | `int` | 字符串长度 |
| `libc_strcmp` / `libc_strncmp` | `(string a, string b[, int n])` | `int` | `<0` / `0` / `>0`；`strncmp` 只比前 `n` 字节 |
| `libc_strdup` | `(string s)` | `string` | 复制一份（CIN 堆字符串语义下即原样返回） |
| `libc_strcat` | `(string a, string b)` | `string` | 拼接（「写入 dst」改返回新串） |
| `libc_strstr` | `(string hay, string needle)` | `int` | 子串首现下标，未找到 `-1` |
| `libc_strchr` / `libc_strrchr` | `(string s, string ch)` | `int` | 单字符首/末现下标，未找到 `-1` |
| `libc_strspn` / `libc_strcspn` | `(string s, string accept/reject)` | `int` | 前缀中全部属于 accept 的长度 / 全部不属于 reject 的长度 |
| `libc_strpbrk` | `(string s, string accept)` | `int` | accept 内任一字符首现下标，未找到 `-1` |
| `libc_strlwr` / `libc_strupr` | `(string s)` | `string` | ASCII 小写 / 大写化（返回新串） |
| `libc_strrev` | `(string s)` | `string` | 字节反转 |
| `libc_memcpy` / `libc_memmove` / `libc_memset` / `libc_memcmp` | `(int[] dst, ...)` | `void` / `int` | 数组（视为 `int` 内存块）拷贝 / 移动 / 填充 / 比较 |
| `libc_abs` / `libc_labs` | `(int x)` | `int` | `int` / `long` 绝对值 |
| `libc_atoi` | `(string s)` | `int` | 十进制解析（非法为 `0`，与内建一致） |
| `libc_max` / `libc_min` | `(int a, int b)` | `int` | 最值 |
| `libc_qsort_asc` | `(int[] a, int n)` | `void` | 快速排序升序（CIN 无比较函数指针，固定升序） |
| `libc_rand` / `libc_srand` | `()` / `(int seed)` | `int` / `void` | 伪随机数与播种（包装内建 `rand` / `srand`） |
| `libc_fabs` / `libc_sqrt` / `libc_pow` / `libc_floor` / `libc_ceil` / `libc_fmod` | `(float ...)` | `float` | `<math.h>`；`fmod` 商向零截断，除零返回 `0` |
| `libc_sin` / `libc_cos` / `libc_tan` | `(float x)` | `float` | 弧度三角函数 |
| `libc_round` / `libc_trunc` | `(float x)` | `float` | C 语义 round：半值**远离零**（`round(2.5)=3`，`round(-2.5)=-3`）；`trunc` 向零取整 |
| `libc_puts` | `(string s)` | `int` | 输出并换行，返回 `0` |
| `libc_print` | `(string s)` | `int` | 输出不换行 |
| `libc_putchar` | `(int ch)` | `int` | 输出单个字符，返回字符码 |

```c
import "cstd.cin"

function main() -> int {
    if (libc_isdigit('7') == 1) { libc_puts("digit") }   // digit
    println(libc_strupr("hello"))                          // HELLO
    println(int_to_str(libc_strstr("haystack", "sta")))    // 3
    println(int_to_str(libc_abs(-42)))                     // 42
    println(float_to_str(libc_round(-2.5)))                // -3
    return 0
}
```

## csv

单行 CSV 解析与生成库，风格与 `json.cin` 一致：面向"一行一条记录"的轻量场景，不做完整语法解析。纯 CIN 实现，只使用非宿主能力内建（`strlen` / `substr` / `strcmp` / `indexof` / `int_to_str` / `trim` / `atoi`），`--no-native` 下同样可用。

分隔符固定为 `,`（44），字段转义规则与 RFC 4180 一致：需要时字段两端加双引号，字段内部的 `"` 写成 `""`。解析侧同样识别引号字段（含 `""` 转义），因此 `csv_quote` / `csv_line_add` 生成的字段能被 `csv_get` 原样读回。

::: danger 本库是单行解析器
- **不支持多行字段**：引号内的换行不会被识别，`\n` 只会被当作普通字节（换行会触发 `csv_quote` 加引号，但读回来只剩同一行内的内容）。
- 分隔符只能是 `,`；需要别的分隔符用 `csv_raw_count` / `csv_raw_get`（按单字节切分，**不做引号处理**）。
- 长度一律是**字节**语义，UTF-8 等非 ASCII 按字节处理；由于判定用的 `,` 与 `"` 都是单字节 ASCII，不会与 UTF-8 多字节序列撞车。
:::

**空行与空字段约定**（`csv_get` 返回 `""` 无法区分"越界"与"空字段"，需要区分时先查 `csv_has`）：

| 输入 | `csv_count` | 说明 |
| --- | --- | --- |
| `""` | `0` | 空行 = 没有字段，便于跳过空记录 |
| `","` | `2` | 只有一个分隔符时是 2 个空字段 |
| `" "` | `1` | 只有空白的行是 1 个字段（字段内容就是空格） |
| `"a,"` | `2` | 尾随空字段保留 |
| `"a,,b"` | `3` | 中间空字段保留 |

推论：只累积了一个空字段的 `csv_line` 缓冲内容也是 `""`，`csv_get` 读回来会被当成 0 个字段；需要区分时查 `csv_line_count()`。

**全局状态**（全局数据段，由运行时清零）：行缓冲 `string csv_buf = ""` 与字段计数 `int csv_buf_n = 0`，合计 2 槽 = 16 字节；缓冲内容在堆上，上限 `CSV_BUF_MAX = 1024` 字节。库内只有一份全局实例。

```c
import "csv.cin"
```

| 函数名 | 签名 | 返回值 | 说明与边界行为 |
| --- | --- | --- | --- |
| `csv_buf_capacity` | `csv_buf_capacity()` | `int` | 固定返回 `1024`，即 `csv_line_add` 能累积的字节上限 |
| `csv_count` | `csv_count(string line)` | `int` | 字段数（引号感知）；`""` 为 `0`，尾随 / 中间空字段都计入 |
| `csv_get` | `csv_get(string line, int idx)` | `string` | 第 `idx` 个字段（0 起），**去掉外层引号并还原 `""` → `"`**；越界或 `idx < 0` 返回 `""`（注意与空字段同形）。引号字段结束引号之后的字符被忽略；引号未闭合时取到行尾；未加引号的字段保留两侧空白 |
| `csv_has` | `csv_has(string line, int idx)` | `int` | `idx` 是否是存在的字段（字段内容为空也算存在）；`1` / `0`，`idx < 0` 或空行为 `0` |
| `csv_get_int` | `csv_get_int(string line, int idx, int fallback)` | `int` | 整数字段；先按字节 `trim` 再校验（可带 `+` / `-`，至少一位数字）；**越界 / 空 / 非法（`"12a"`、`"3.5"`、`"+"`）都返回 `fallback`** |
| `csv_get_float` | `csv_get_float(string line, int idx, float fallback)` | `float` | 浮点字段；去空白后允许可选正负号、至多一个小数点、至少一位数字（`.5` 与 `5.` 合法）；**不接受指数形式**（`1e3`、`1.5E2` 非法）；越界 / 空 / 非法返回 `fallback` |
| `csv_trim_cells` | `csv_trim_cells(string line)` | `string` | 去掉每个字段两侧空白后原样拼接（**不重新加引号**，也不动引号内部）；`" a , b "` → `"a,b"`，`" \"a, b\" , c"` → `"\"a, b\",c"`；空行返回 `""`，结果长度不会超过输入长度，引号字段的转义原样保留 |
| `csv_escape` | `csv_escape(string field)` | `string` | **只做转义不加引号**：字段内每个 `"` 写成 `""`；`csv_escape("a\"b")` 为 `"a\"\"b"`，空串返回 `""` |
| `csv_quote` | `csv_quote(string field)` | `string` | 需要时加双引号并转义内部 `"`，否则返回原串。**需要加引号的条件**：含 `,`、含 `"`、含换行（`\n` / `\r`），或首尾是空白（空格 / `\t`）；只在中间的 `\t` 不加引号；空串返回 `""` |
| `csv_line_start` | `csv_line_start()` | `void` | 开始新的一行：清空全局缓冲，字段计数归零 |
| `csv_line_add` | `csv_line_add(string field)` | `int` | 追加一个字段（自动补前导 `,` 并按需加引号）；成功 `1`；若追加后缓冲会超过 `1024` 字节则返回 `0` 且**缓冲与计数都不改动**（不会越界写） |
| `csv_line_get` | `csv_line_get()` | `string` | 当前累积的行（未调用 `csv_line_start` 前为空串） |
| `csv_line_count` | `csv_line_count()` | `int` | 当前累积的字段个数（区分"0 个字段"与"一个空字段"） |
| `csv_raw_count` | `csv_raw_count(string line, int delim)` | `int` | 按单字节分隔符 `delim`（如 `';'` 即 `59`）切分的字段数，**不做引号处理**；空行为 `0`；`delim <= 0` 时整行算 1 个字段 |
| `csv_raw_get` | `csv_raw_get(string line, int delim, int idx)` | `string` | 按 `delim` 取第 `idx` 个字段（0 起，原样返回、不还原引号）；越界或 `idx < 0` 返回 `""`；`delim <= 0` 时只有 `idx == 0` 命中整行 |

内部辅助函数（`csv_skip_ws` / `csv_quote_pos` / `csv_next_start` / `csv_val_at` / `csv_cell_trim` / `csv_is_int` / `csv_is_float` / `csv_parse_float`）不是公开 API，后续版本可能调整。

::: warning 堆与缓冲
字符串拼接产生不回收的堆块，`csv_trim_cells` 会按字段逐段重建结果串。默认 64 KiB 内存下堆可用空间约 32 KiB：`csv_line_add` 最多累积 1024 字节，但反复 `csv_line_start` / 拼接仍会持续吃堆，长表请及时重用缓冲或加 `--mem-size`。
:::

```c
import "csv.cin"

function main() -> int {
    string line = "id,\"Doe, John\",42,3.5,"
    println(int_to_str(csv_count(line)))             // 5  (尾随空字段保留)
    println("[" + csv_get(line, 1) + "]")            // [Doe, John]
    println(int_to_str(csv_get_int(line, 2, -1)))    // 42
    println(int_to_str(csv_get_int(line, 0, -1)))    // -1 (id 不是整数)
    println(int_to_str(csv_has(line, 4)))            // 1
    println("[" + csv_get(line, 4) + "]")            // []
    println("[" + csv_trim_cells(" a , b ") + "]")   // [a,b]
    println("[" + csv_quote("a,b") + "]")            // ["a,b"]
    println("[" + csv_escape("a\"b") + "]")          // [a""b]
    csv_line_start()
    csv_line_add("id")
    csv_line_add("Doe, John")
    csv_line_add("42")
    println("[" + csv_line_get() + "]")              // [id,"Doe, John",42]
    println(int_to_str(csv_line_count()))            // 3
    return 0
}
```

## dp

经典动态规划教学库。纯 CIN 实现，**不做动态内存分配**：所有 DP 表都是库内全局定长数组
（滚动数组），容量上限如下，超限一律**按上限截断**（与 `heap_build` 的钳制风格一致）：
`DP_STR_MAX = 128`（字符串类 DP 处理的**字节数**）、`DP_KNAP_CAP = 256`（0/1 背包容量）、
`DP_AMOUNT_MAX = 256`（零钱问题金额）、`DP_LIS_MAX = 64`（LIS 元素个数，该算法是 O(n²)，故意给小）、
`DP_PATH_COLS = 256`（网格列数）、`DP_FIB_CACHE = 64`（`dp_fib_memo` 自建缓存）。
全局数据段占用约 `838` 槽（`6704` 字节）。

* 字符串一律按**字节**比较（`s[i]` 得到 `0..255` 的整数编码）。
* 返回值都是 64 位 `int`，斐波那契 / 阶乘 / 组合数可能**静默溢出回绕**（不报错）。
* 那些滚动数组是**跨函数复用的内部暂存区**，不要依赖它们在两次调用之间的内容，
  也不要在本库的函数之间嵌套调用。
* 库内只有一份全局实例，同一程序内共享。

```c
import "dp.cin"
```

| 函数名 | 签名 | 返回值 | 说明与边界行为 |
| --- | --- | --- | --- |
| `dp_fib` | `dp_fib(int n)` | `int` | 斐波那契数（迭代 O(n)）；`fib(0)=0`、`fib(1)=1`，**`n < 0` 返回 `0`**；`n >= 93` 溢出回绕 |
| `dp_fib_memo` | `dp_fib_memo(int n)` | `int` | 同上但带自建缓存，结果与 `dp_fib` 完全一致；`n < 0` 返回 `0`，`n >= 64` 时不做缓存直接走迭代实现 |
| `dp_fact` | `dp_fact(int n)` | `int` | 阶乘（迭代）；`fact(0)=1`，**`n < 0` 返回 `0`**；`n >= 21` 溢出回绕（建议 `n <= 20`） |
| `dp_stairs` | `dp_stairs(int n)` | `int` | 爬楼梯方案数（每步 1 或 2 级）；**`n < 0` 返回 `0`，`n == 0` 返回 `1`**（一步不走也算一种）；等于 `fib(n+1)` |
| `dp_knapsack01` | `dp_knapsack01(int[] w, int[] v, int n, int cap)` | `int` | 0/1 背包最大价值；**`n <= 0` 或 `cap <= 0` 返回 `0`**；`cap > 256` 按 `256` 计算；重量 `< 0` 的物品按重量 `0` 处理（等价于白拿一件），重量 `> cap` 的物品自动跳过 |
| `dp_lcs` | `dp_lcs(string a, string b)` | `int` | 最长公共子序列长度；任一空串返回 `0`；串长超过 `DP_STR_MAX = 128` 时只看前 `128` 字节 |
| `dp_edit_distance` | `dp_edit_distance(string a, string b)` | `int` | 编辑距离（Levenshtein，插入/删除/替换代价都是 `1`）；任一空串时返回另一个串的长度；串长超过 `128` 时只看前 `128` 字节 |
| `dp_longest_palindrome` | `dp_longest_palindrome(string s)` | `int` | 最长回文子串长度（中心扩展，等价于区间 DP 的空间优化写法）；空串返回 `0`；长度超过 `128` 时只看前 `128` 字节 |
| `dp_coin_change` | `dp_coin_change(int[] coins, int n, int amount)` | `int` | 最少硬币数（每种面额可用无限次）；**凑不出返回 `-1`**；`amount < 0` 返回 `-1`，`amount == 0` 返回 `0`；面额 `<= 0` 的硬币被忽略；`amount > 256` 按 `256` 计算 |
| `dp_coin_ways` | `dp_coin_ways(int[] coins, int n, int amount)` | `int` | 凑出 `amount` 的**组合数**（顺序不计，每种面额无限次）；`amount < 0` 返回 `0`，`amount == 0` 返回 `1`（空组合）；面额 `<= 0` 的硬币被忽略；`amount > 256` 按 `256` 计算；结果可能溢出回绕 |
| `dp_lis` | `dp_lis(int[] a, int n)` | `int` | 最长**严格**递增子序列长度（O(n²)）；**`n <= 0` 返回 `0`**；`n > 64` 时只看前 `64` 个元素 |
| `dp_max_subarray` | `dp_max_subarray(int[] a, int n)` | `int` | 最大子段和（Kadane，O(n)）；**`n <= 0` 返回 `0`**；至少取一个元素，全负数时返回其中最大的那个 |
| `dp_min_path` | `dp_min_path(int[] grid, int rows, int cols)` | `int` | 网格最小路径和（只能向右/向下），网格按**行主序一维**给出：`grid[r * cols + c]`；起点与终点都计入和；**`rows <= 0` 或 `cols <= 0` 返回 `0`**；**`cols > 256` 返回 `-1`**（列数参与行主序下标，定长滚动数组放不下，明确失败） |

```c
import "dp.cin"

function main() -> int {
    println("fib(10) = " + int_to_str(dp_fib(10)))                      // 55
    println("fib_memo(30) = " + int_to_str(dp_fib_memo(30)))            // 832040
    println("fact(10) = " + int_to_str(dp_fact(10)))                    // 3628800
    println("stairs(10) = " + int_to_str(dp_stairs(10)))                // 89

    int w[4] = {1, 3, 4, 5}
    int v[4] = {1, 4, 5, 7}
    println("knapsack01 = " + int_to_str(dp_knapsack01(w, v, 4, 7)))    // 9

    println("lcs = " + int_to_str(dp_lcs("ABCBDAB", "BDCABA")))         // 4
    println("edit_distance = " + int_to_str(dp_edit_distance("kitten", "sitting")))   // 3
    println("palindrome = " + int_to_str(dp_longest_palindrome("forgeeksskeegfor")))  // 10

    int coins[4] = {1, 5, 10, 25}
    println("coin_change(63) = " + int_to_str(dp_coin_change(coins, 4, 63)))   // 6
    println("coin_ways(63) = " + int_to_str(dp_coin_ways(coins, 4, 63)))       // 73

    int a[8] = {10, 9, 2, 5, 3, 7, 101, 18}
    println("lis = " + int_to_str(dp_lis(a, 8)))                        // 4

    int s[9] = {-2, 1, -3, 4, -1, 2, 1, -5, 4}
    println("max_subarray = " + int_to_str(dp_max_subarray(s, 9)))      // 6

    int g[9] = {1, 3, 1, 1, 5, 1, 4, 2, 1}
    println("min_path = " + int_to_str(dp_min_path(g, 3, 3)))           // 7
    println("unreachable = " + int_to_str(dp_coin_change(coins, 4, -1)))   // -1
    return 0
}
```

## fmt

排版与格式化输出库。比 `conv` 更面向"排版"的一层：定点小数、千位分隔、对齐与居中、比例条、表格单元格与边框、定宽十六进制/二进制。纯 CIN 实现，只使用非宿主能力内建（`strlen` / `substr` / `strcmp` / `indexof` / `int_to_str` / `float_to_str` / `floor` / `idiv` / `trim`），`--no-native` 下同样可用；与 `conv`（进制与基础填充 `c_pad_*` / `c_to_hex` / `c_to_bin`）不重叠、互不依赖，可同时导入。

长度与宽度一律是**字节**语义（与 `strlen` / `substr` / `s[i]` 一致）：非 ASCII 按 UTF-8 字节序列计数，一个汉字算 3 字节、宽度算 3 列，`fmt_cell` 会在字节中间截断，不做码点解码。

库内**没有全局变量**，不占用数据段。局部变量全部显式赋值（CIN 局部标量不自动清零）。

统一边界约定：

- 所有函数返回**新字符串**（新堆块，不回收），不要在无界循环里对超长串反复调用；
- 重复/计数类参数统一钳制到 `[0, 1024]`（`fmt_repeat_limit()`），宽度类参数各自钳制（见下表）；
- `fmt_float_dec` / `fmt_float_pad` / `fmt_percent` 的 `digits` 钳制到 `[0, 9]`；`digits == 0` 时不输出小数点；
- `fmt_bar` 的 `ratio` 钳制到 `[0, 1]`，填充长度按 `round(ratio * width)` 计算；
- `width <= 0` 一律返回 `""`（`fmt_cell` / `fmt_sep` / `fmt_bar` / `fmt_border`），或者原样返回内容（`fmt_int_width` / `fmt_int_zero` / `fmt_align`）；
- `fmt_float_dec` 的 `|v| >= 1e9` 时退化为 `float_to_str(v)`（定点整数部分会溢出 64 位整数槽），该退化不做补零。

```c
import "fmt.cin"
```

| 函数名 | 签名 | 返回值 | 说明与边界行为 |
| --- | --- | --- | --- |
| `fmt_repeat_limit` | `fmt_repeat_limit()` | `int` | 固定返回 `1024`，是本库所有重复次数的上限 |
| `fmt_chr` | `fmt_chr(int ch)` | `string` | 字节编码 → 单字符字符串；支持 `32..126`（可打印 ASCII）与 `9` / `10` / `13`；其余编码（含 `0`、`>126`）返回 `""`，不做多字节编码 |
| `fmt_int_width` | `fmt_int_width(int v, int width)` | `string` | 整数**右对齐**到 `width` 列，左侧补空格；负数保留 `-`；`width <= strlen(int_to_str(v))` 时原样返回 |
| `fmt_int_zero` | `fmt_int_zero(int v, int width)` | `string` | 补前导 `0` 到 `width` 列，**`width` 是含符号的总宽度**（`fmt_int_zero(-42, 5)` 为 `"-0042"`）；不足时原样返回 |
| `fmt_thousands` | `fmt_thousands(int v)` | `string` | 千位分隔，每 3 位一个 `,`，负数保留 `-`；`0` 为 `"0"`，`-1000` 为 `"-1,000"` |
| `fmt_float_dec` | `fmt_float_dec(float v, int digits)` | `string` | **定点小数**：四舍五入到 `digits` 位并补足尾随 0；`fmt_float_dec(3.14159, 2)` 为 `"3.14"`，`fmt_float_dec(2.0, 3)` 为 `"2.000"`，`fmt_float_dec(9.999, 2)` 为 `"10.00"`（进位贯穿整数部分）。`digits` 钳制到 `[0, 9]`，负数按绝对值圆整后补号（`-0.005` → `"-0.01"`）；`|v| >= 1e9` 退化为 `float_to_str(v)` |
| `fmt_float_pad` | `fmt_float_pad(float v, int int_width, int dec_digits)` | `string` | 定点小数并把**整数部分**补前导 0 到 `int_width` 位（不含符号与小数部分）：`fmt_float_pad(3.14159, 6, 2)` 为 `"000003.14"`，`fmt_float_pad(-3.5, 4, 1)` 为 `"-0003.5"`；`dec_digits` 钳制到 `[0, 9]`，整数部分已足够长时不补 |
| `fmt_percent` | `fmt_percent(float ratio, int digits)` | `string` | 比例 → 百分数（`ratio * 100` 后定点到 `digits` 位）：`fmt_percent(0.1234, 1)` 为 `"12.3%"`，`fmt_percent(1.0, 0)` 为 `"100%"`；`digits` 钳制到 `[0, 9]`，**`ratio` 不做钳制**（`2.0` → `"200.0%"`） |
| `fmt_align` | `fmt_align(string s, int width, int mode)` | `string` | 对齐到 `width` 列：`mode` `0` 左对齐 / `1` 右对齐 / `2` 居中，其余取值（含负数）按左对齐；居中时余出的 1 列补在**右侧**；`strlen(s) >= width` 原样返回 |
| `fmt_center` | `fmt_center(string s, int width)` | `string` | 居中到 `width` 列，等价 `fmt_align(s, width, 2)` |
| `fmt_repeat` | `fmt_repeat(string s, int n)` | `string` | 字符串重复 `n` 次；`n` 钳制到 `[0, 1024]`，`n <= 0` 或 `s` 为空返回 `""`。内部用倍增法（O(log n) 次拼接），不会因逐次拼接撑爆堆 |
| `fmt_repeat_char` | `fmt_repeat_char(int ch, int n)` | `string` | 单字符重复 `n` 次；`ch` 语义同 `fmt_chr`（非法编码返回 `""`），`n` 钳制到 `[0, 1024]` |
| `fmt_bar` | `fmt_bar(float ratio, int width)` | `string` | 比例条：`#` 为已用、`-` 为剩余，共 `width` 列；`ratio` 钳制到 `[0, 1]`，填充长度四舍五入；`width <= 0` 返回 `""`，`width > 1024` 钳制为 1024。`fmt_bar(0.5, 10)` 为 `"#####-----"` |
| `fmt_cell` | `fmt_cell(string s, int width)` | `string` | 表格单元格：正好 `width` 列；不足右补空格，`strlen(s) >= width` 时**按字节截断**（不补省略号）；`width <= 0` 返回 `""` |
| `fmt_sep` | `fmt_sep(int width)` | `string` | `width` 个 `-` 组成的分隔线；`width <= 0` 返回 `""`（`width` 同样钳制到 1024） |
| `fmt_border` | `fmt_border(int cols, int col_width)` | `string` | 表格边框：`cols` 列、每列 `col_width` 个 `-`，形如 `"+----+----+----+"`；`cols <= 0` 返回 `""`，`cols` 与 `col_width` 各自钳制到 `[0, 256]`（`col_width` 为负当 0） |
| `fmt_hex` | `fmt_hex(int v, int width)` | `string` | 大写十六进制，前导 `0` 补到 `width` 位；`v == 0` 输出 `"0"`，**负数按 64 位补码展开**（16 位）；`width` 钳制到 `[0, 64]`，不超过实际位数时不补 |
| `fmt_bin` | `fmt_bin(int v, int width)` | `string` | 二进制，前导 `0` 补到 `width` 位；`v == 0` 输出 `"0"`，负数按 64 位补码展开（64 位）；`width` 钳制到 `[0, 64]` |
| `fmt_bool` | `fmt_bool(bool b)` | `string` | 布尔 → `"true"` / `"false"`（**本库选定与内建 `bool_to_str` 及打印一致的拼写**，不是 `"yes"` / `"no"`）；非零为 `true` |

内部辅助函数（`fmt_rep` / `fmt_ascii_table`）不是公开 API，后续版本可能调整。

::: warning 堆与输出规模
每次调用都新建堆块且不回收。默认 64 KiB 内存下堆可用空间约 32 KiB，本库的重复上限（1024）会在 `fmt_repeat("ab", 1024)` 这类调用里用掉约 6 KiB 增量堆；超大表格（`fmt_border` 的 `cols * (col_width + 1)`、超长 `fmt_cell` 内容）请自行分块或加 `--mem-size`，否则会 `Stack overflow (collides with heap)`。
:::

```c
import "fmt.cin"

function main() -> int {
    println("[" + fmt_int_width(42, 6) + "]")            // [    42]
    println("[" + fmt_int_zero(-42, 5) + "]")            // [-0042]
    println("[" + fmt_thousands(-1234567) + "]")         // [-1,234,567]
    println("[" + fmt_float_dec(9.999, 2) + "]")         // [10.00]
    println("[" + fmt_float_pad(3.14159, 6, 2) + "]")    // [000003.14]
    println("[" + fmt_percent(0.1234, 1) + "]")          // [12.3%]
    println("[" + fmt_align("CIN", 8, 2) + "]")          // [  CIN   ]
    println("[" + fmt_bar(0.4, 10) + "]")                // [####------]
    println(fmt_border(3, 4))                            // +----+----+----+
    println("|" + fmt_cell("id", 4) + "|" + fmt_cell("name", 4) + "|")  // |id  |name|
    println("[" + fmt_hex(-1, 0) + "]")                  // [FFFFFFFFFFFFFFFF]
    println("[" + fmt_bin(10, 8) + "]")                  // [00001010]
    println("[" + fmt_bool(1 > 2) + "]")                 // [false]
    return 0
}
```

## frac

有理数（分数）库。`struct Frac` 只有两个 64 位 `int` 字段 `num` / `den`，
构造与每次运算后都会**自动约分**并把分母规范化为正数：`2/4` → `1/2`、`3/-4` → `-3/4`、
`-3/-4` → `3/4`、`0/5` → `0/1`。零恒为 `0/1`，分母恒 `>= 1`；已规范化的分数比较与相等
判断都是精确的（不经过浮点）。

分母为 0（`fr_make(x, 0)`、`fr_div(_, 0)`）时结果规范化为 `0/1` 并把全局错误标志置 1，
可用 `fr_error()` 查询、`fr_reset_error()` 清除。库内全局变量只有 `fr_err` 一个（8 字节），
`Frac` 本身只占 2 槽 = 16 字节。

边界与限制：加减先用 `fr_gcd` 把分母降到最小公倍数、乘除先做交叉约分，以减少中间积溢出，
但**分子分母的中间乘积仍然是原生 64 位整型运算，可能回绕**（例如 `1/10^10 * 1/10^10`
的分母 `10^20` 超出 `int` 范围）；本库不做大数处理，需要任意精度时请配合 `bigint.cin`。
约分只使用 `idiv` 与 `%`，`gcd` 由 `fr_gcd` 自行实现，不依赖其它库。

```c
import "frac.cin"
```

| 函数名 | 签名 | 返回值 | 说明与边界行为 |
| --- | --- | --- | --- |
| `fr_error` | `fr_error()` | `int` | 是否发生过非法操作（除以零等），`1`/`0`（粘滞，需手动清除） |
| `fr_reset_error` | `fr_reset_error()` | `void` | 清除错误标志 |
| `fr_gcd` | `fr_gcd(int a, int b)` | `int` | 最大公约数（内部取绝对值）；`gcd(0, 0) = 0`，`gcd(0, 5) = 5` |
| `fr_norm` | `fr_norm(Frac f)` | `void` | 原地规范化 `f`：分母为 0 时置错误标志并归零，分母转正，约分，零写作 `0/1` |
| `fr_make` | `fr_make(int n, int d)` | `Frac` | 由分子分母构造并约分；`d == 0` 时返回 `0/1` 并置错误标志 |
| `fr_zero` | `fr_zero()` | `Frac` | 零（`0/1`） |
| `fr_num` | `fr_num(Frac f)` | `int` | 分子 |
| `fr_den` | `fr_den(Frac f)` | `int` | 分母（恒为正） |
| `fr_add` | `fr_add(Frac a, Frac b)` | `Frac` | `a + b`，先把分母降到 lcm 再相加 |
| `fr_sub` | `fr_sub(Frac a, Frac b)` | `Frac` | `a - b`，先把分母降到 lcm 再相减 |
| `fr_mul` | `fr_mul(Frac a, Frac b)` | `Frac` | `a * b`，先交叉约分 |
| `fr_div` | `fr_div(Frac a, Frac b)` | `Frac` | `a / b`；**`b` 为 0 时返回 `0/1` 并置错误标志** |
| `fr_neg` | `fr_neg(Frac a)` | `Frac` | `-a`（零的相反数仍为 `0/1`） |
| `fr_abs` | `fr_abs(Frac a)` | `Frac` | `\|a\|` |
| `fr_cmp` | `fr_cmp(Frac a, Frac b)` | `int` | 与数学顺序一致的比较：`-1` / `0` / `1`；内部为交叉相乘，极端数值下中间积可能回绕 |
| `fr_equals` | `fr_equals(Frac a, Frac b)` | `int` | 数值是否相等，`1`/`0`（`2/4` 与 `1/2` 相等） |
| `fr_is_int` | `fr_is_int(Frac a)` | `int` | 是否为整数，`1`/`0`（分母为 1，或分子能被分母整除） |
| `fr_to_str` | `fr_to_str(Frac a)` | `string` | 整数输出 `"2"`，否则输出 `"3/4"`；输出前先规范化 |
| `fr_to_float` | `fr_to_float(Frac a)` | `float` | 浮点近似 `num / den`；分母为 0 时置错误标志并返回 `0.0` |

```c
import "frac.cin"

function main() -> int {
    Frac a = fr_make(1, 3)
    Frac b = fr_make(1, 6)
    println("a      = " + fr_to_str(a))
    println("b      = " + fr_to_str(b))
    println("a + b  = " + fr_to_str(fr_add(a, b)))
    println("a - b  = " + fr_to_str(fr_sub(a, b)))
    println("a * b  = " + fr_to_str(fr_mul(a, b)))
    println("a / b  = " + fr_to_str(fr_div(a, b)))
    println("2/4    = " + fr_to_str(fr_make(2, 4)))
    println("3/-4   = " + fr_to_str(fr_make(3, -4)))
    println("cmp    = " + int_to_str(fr_cmp(a, b)))
    println("float  = " + float_to_str(fr_to_float(a)))
    Frac z = fr_make(1, 0)
    println("1/0    = " + fr_to_str(z) + " err=" + int_to_str(fr_error()))
    return 0
}
```

## gostd

Go 标准库兼容层，以 `pkg.Func` 命名习惯提供 Go `strings` / `strconv` / `math` /
`slices` / `os` 的常用函数（`go_strings_contains` 对应 `strings.Contains`），
命名里的包段与 Go 文档一一对应，便于从 Go 移植或查阅语义。纯 CIN 实现，三路径一致；
唯一例外是 `go_os_args_*`（依赖命令行参数内建，需原生路径）。

```c
import "gostd.cin"
```

| 函数名 | 签名 | 返回值 | 说明与边界行为 |
| --- | --- | --- | --- |
| `go_strings_contains` / `go_strings_index` | `(string s, string sub)` | `int` | 是否包含（`1`/`0`）/ 首现下标（未找到 `-1`） |
| `go_strings_last_index` | `(string s, string sub)` | `int` | 末现下标（未找到 `-1`）；空 sub 返回 `strlen(s)` |
| `go_strings_contains_any` / `go_strings_index_any` | `(string s, string chars)` | `int` / `int` | s 是否含 chars 内任一字符 / 首个 chars 内字符的下标（`-1` 未找到） |
| `go_strings_has_prefix` / `go_strings_has_suffix` | `(string s, string pre/suf)` | `int` | 前缀 / 后缀判定 |
| `go_strings_to_upper` / `go_strings_to_lower` | `(string s)` | `string` | ASCII 大小写 |
| `go_strings_trim_space` | `(string s)` | `string` | 去两端空白 |
| `go_strings_trim_left` / `go_strings_trim_right` | `(string s, string cutset)` | `string` | 去前导 / 尾部 `cutset` 内字符（空 cutset 原样返回） |
| `go_strings_trim_prefix` / `go_strings_trim_suffix` | `(string s, string pre/suf)` | `string` | 有前 / 后缀则去掉，无则原样返回 |
| `go_strings_repeat` | `(string s, int n)` | `string` | 重复 `n` 次（`n <= 0` 空串） |
| `go_strings_count` | `(string s, string sub)` | `int` | 非重叠子串计数；空 sub 返回 `strlen(s)+1`（与 Go 一致） |
| `go_strings_replace_all` | `(string s, string old, string new)` | `string` | 全量替换（空 old 原样返回） |
| `go_strings_equal_fold` | `(string a, string b)` | `int` | ASCII 大小写不敏感相等 |
| `go_strings_compare` | `(string a, string b)` | `int` | `strcmp`：`<0` / `0` / `>0` |
| `go_len` | `(string s)` | `int` | `len(s)` 字节长度 |
| `go_itoa` / `go_atoi` | `(int v)` / `(string s)` | `string` / `int` | `strconv.Itoa` / `Atoi`（解析失败为 `0`） |
| `go_format_float` | `(float v)` | `string` | `FormatFloat` 默认精度替身（即 `float_to_str`） |
| `go_format_int` | `(int v, int base)` | `string` | `strconv.FormatInt`：base `2..36`（越界按 `10`）；负数带 `-`，小写数字 |
| `go_parse_int` | `(string s, int base)` | `int` | `strconv.ParseInt` 简化版：可选 `-` 前缀，`0-9a-zA-Z`，base `2..36`；非法字符停在非法处 |
| `go_math_abs` / `go_math_max` / `go_math_min` | `(int ...)` | `int` | 整数版 |
| `go_math_floor` / `go_math_ceil` / `go_math_round` / `go_math_trunc` | `(float x)` | `float` | 取整族（round 为半值远离零） |
| `go_math_sqrt` / `go_math_pow` | `(float ...)` | `float` | 包装内建 |
| `go_slices_index` / `go_slices_last_index` | `(int[] a, int n, int x)` | `int` | 首现 / 末现下标（未找到 `-1`） |
| `go_slices_contains` | `(int[] a, int n, int x)` | `int` | 是否包含 |
| `go_slices_max` / `go_slices_min` / `go_slices_sum` | `(int[] a, int n)` | `int` | 最值 / 求和（空数组返回 `0`） |
| `go_slices_reverse` / `go_slices_sort` | `(int[] a, int n)` | `void` | 原地反转 / 升序排序 |
| `go_slices_equal` | `(int[] a, int[] b, int n)` | `int` | 前 `n` 个元素逐位相等（`1`/`0`） |
| `go_slices_clone` | `(int[] dst, int[] src, int n)` | `int` | 拷贝到 `dst`，返回 `n`（调用方保证容量） |
| `go_os_args_len` | `()` | `int` | `len(os.Args)`：CLI `--` 之后传给 CIN 程序的参数个数；**需原生路径** |
| `go_os_args_get` | `(int i)` | `string` | `os.Args[i]`（越界空串；下标从 `0` 计 CIN 参数）；**需原生路径** |

```c
import "gostd.cin"

function main() -> int {
    println(go_strings_repeat("ab", 3))              // ababab
    println(go_format_int(255, 16))                  // ff
    println(int_to_str(go_parse_int("101", 2)))      // 5
    println(go_strings_trim_suffix("x:suffix", ":suffix"))   // x
    int a[3] = {1, 2, 3}
    int b[3]
    go_slices_clone(b, a, 3)
    println(int_to_str(go_slices_equal(a, b, 3)))    // 1
    return 0
}
```

## graph

定长图库。纯 CIN 实现，**不做动态内存分配**：图存放在库内全局的**邻接矩阵**里
（`graph_edge[256]` 存边是否存在、`graph_w[256]` 存边权，行主序一维数组，
下标 `u * GRAPH_MAX + v`），节点容量上限 **`GRAPH_MAX = 16`**，
权重是 `int`（可以为 `0` 或负数，因此判断"有没有边"请用 `graph_has_edge`，
不要用 `graph_weight != 0`）。

* 节点编号 `0..graph_nodes()-1`；越界编号一律返回明确失败值，不会静默写内存：
  `graph_has_edge` / `graph_weight` 返回 `0`，`graph_degree` / `graph_in_degree` 返回 `-1`，
  `graph_add_edge` 返回 `0`，`graph_bfs` / `graph_dfs` / `graph_dijkstra` 返回 `0`，
  `graph_topo_order` 返回 `-1`。
* `graph_reset(n, directed)` 的 `n <= 0` 钳制为 `0`，`n > GRAPH_MAX` 钳制为 `GRAPH_MAX`。
* 无向图里 `(u, v)` 与 `(v, u)` 是同一条边；有向图按 `u -> v` 记录。
* 自环 `u == v` 允许存在：无向图里算一条边、贡献 `1` 度，并且算一个环。
* 邻接矩阵不支持平行边，重复加边返回 `0`。
* 所有遍历都按**节点编号升序**扫描邻居，因此结果完全确定。
* 全局数据段占用约 `579` 槽（`4632` 字节），只有一份全局实例，
  需要多张图请用 `struct` 自行封装。

```c
import "graph.cin"
```

| 函数名 | 签名 | 返回值 | 说明与边界行为 |
| --- | --- | --- | --- |
| `graph_max` | `graph_max()` | `int` | 固定返回 `16`（`GRAPH_MAX`） |
| `graph_nodes` | `graph_nodes()` | `int` | 当前节点数（`graph_reset` 设定并钳制后的值） |
| `graph_is_directed` | `graph_is_directed()` | `int` | `1` 有向图，`0` 无向图 |
| `graph_edge_count` | `graph_edge_count()` | `int` | 当前边数；无向图里 `(u, v)` 与 `(v, u)` 只算一条 |
| `graph_reset` | `graph_reset(int n, int directed)` | `void` | 重新设定节点数与方向并清空所有边；`n <= 0` 钳制为 `0`，`n > 16` 钳制为 `16`，`directed` 非零表示有向图 |
| `graph_clear` | `graph_clear()` | `void` | 只删除所有边，**保留**节点数与方向 |
| `graph_add_edge` | `graph_add_edge(int u, int v, int w)` | `int` | 加边 `u -> v`（无向图两侧都加）；成功返回 `1`，节点越界或这条边已存在返回 `0`（状态不变） |
| `graph_has_edge` | `graph_has_edge(int u, int v)` | `int` | `u` 到 `v` 是否有边，`1`/`0`；节点越界返回 `0` |
| `graph_weight` | `graph_weight(int u, int v)` | `int` | 边权；**没有这条边或节点越界返回 `0`**（权重本身可以是 0，判断边存在请用 `graph_has_edge`） |
| `graph_degree` | `graph_degree(int u)` | `int` | 出度；无向图是邻居数（自环算 1）；节点越界返回 `-1` |
| `graph_in_degree` | `graph_in_degree(int u)` | `int` | 入度；无向图与 `graph_degree` 相同；节点越界返回 `-1` |
| `graph_bfs` | `graph_bfs(int start, int[] order, int[] out_dist)` | `int` | 从 `start` 广度优先遍历（按出边方向，邻居编号升序入队）；返回访问节点数 `cnt`，`order[0..cnt-1]` 写访问顺序，`out_dist[0..graph_nodes()-1]` 写距离（边数），**不可达写 `-1`**；`start` 越界或图为空返回 `0` 且 `out_dist` 全为 `-1`（`out_dist` 至少要能放 `graph_nodes()` 个元素） |
| `graph_dfs` | `graph_dfs(int start, int[] order)` | `int` | 从 `start` 深度优先遍历，用**显式栈**（不递归，栈深不随图增长）；返回访问节点数，`order[0..cnt-1]` 写访问顺序，邻居按编号降序压栈所以编号小的先访问；`start` 越界或图为空返回 `0` |
| `graph_component_count` | `graph_component_count()` | `int` | 连通分量个数，按**无向视角**统计（有向图得到弱连通分量数）；空图返回 `0` |
| `graph_connected` | `graph_connected()` | `int` | 是否连通（无向视角，有向图问的是弱连通）；空图与单节点都返回 `1` |
| `graph_is_cyclic` | `graph_is_cyclic()` | `int` | 是否存在环（自环算环），`1`/`0`；空图返回 `0`。无向图用「边数 > 节点数 - 分量数」判定，有向图用拓扑排序能否覆盖全部节点判定 |
| `graph_topo_order` | `graph_topo_order(int[] order)` | `int` | 有向图拓扑排序（Kahn，每轮取**编号最小**的入度 0 节点，结果确定）；成功返回节点数并写 `order[0..n-1]`，**有环返回 `-1`**；无向图返回 `-1`（无向图没有拓扑序）；空有向图返回 `0` |
| `graph_dijkstra` | `graph_dijkstra(int src, int[] dist)` | `int` | 单源最短路（O(n²) 邻接矩阵版）；返回可达节点数（含 `src`），`dist[0..graph_nodes()-1]` 写最短距离，**不可达写 `-1`**；`src` 越界或图为空返回 `0` 且不写 `dist`。有向图按出边方向松弛，无向图两个方向都松弛；**要求边权 >= 0**，出现负权时「松弛结果 < 0」的边会被忽略（不报错，此时结果没有保证） |
| `graph_aux_node` | `graph_aux_node(int u)` | `int` | 内部辅助：节点编号是否合法，非稳定接口 |
| `graph_aux_arc` | `graph_aux_arc(int u, int v)` | `int` | 内部辅助：无向视角下 `u`、`v` 之间是否有边，非稳定接口 |

```c
import "graph.cin"

function main() -> int {
    graph_reset(6, 0)
    graph_add_edge(0, 1, 7)
    graph_add_edge(0, 2, 9)
    graph_add_edge(0, 5, 14)
    graph_add_edge(1, 2, 10)
    graph_add_edge(1, 3, 15)
    graph_add_edge(2, 3, 11)
    graph_add_edge(2, 5, 2)
    graph_add_edge(3, 4, 6)
    graph_add_edge(4, 5, 9)
    println("nodes = " + int_to_str(graph_nodes()))            // 6
    println("edges = " + int_to_str(graph_edge_count()))        // 9
    println("degree(0) = " + int_to_str(graph_degree(0)))       // 3
    println("weight(2, 5) = " + int_to_str(graph_weight(2, 5))) // 2

    int order[16]
    int dist[16]
    println("bfs = " + int_to_str(graph_bfs(0, order, dist)))   // 6
    println("bfs order = " + int_to_str(order[0]) + " " + int_to_str(order[1]) + " " + int_to_str(order[2]) + " " + int_to_str(order[3]) + " " + int_to_str(order[4]) + " " + int_to_str(order[5]))   // 0 1 2 5 3 4
    println("dijkstra = " + int_to_str(graph_dijkstra(0, dist)))   // 6
    println("dist = " + int_to_str(dist[0]) + " " + int_to_str(dist[1]) + " " + int_to_str(dist[2]) + " " + int_to_str(dist[3]) + " " + int_to_str(dist[4]) + " " + int_to_str(dist[5]))   // 0 7 9 20 20 11
    println("components = " + int_to_str(graph_component_count()))   // 1

    graph_reset(4, 1)
    graph_add_edge(0, 1, 1)
    graph_add_edge(0, 2, 1)
    graph_add_edge(1, 3, 1)
    graph_add_edge(2, 3, 1)
    int topo[16]
    println("topo = " + int_to_str(graph_topo_order(topo)) + ", first = " + int_to_str(topo[0]))   // topo = 4, first = 0
    println("cyclic = " + int_to_str(graph_is_cyclic()))        // 0
    graph_add_edge(3, 0, 1)
    println("cyclic = " + int_to_str(graph_is_cyclic()))        // 1
    println("topo = " + int_to_str(graph_topo_order(topo)))     // -1
    return 0
}
```

## gui

画布绘图助手库。内部调用 `canvas` / `set_color` / `fill_rect` / `fill_circle` / `draw_line` /
`draw_text` / `save_png` / `show_canvas` 等宿主能力内建，因此**必须运行在 Go 原生引擎上**。

```c
import "gui.cin"
```

| 函数名 | 签名 | 返回值 | 说明与边界行为 |
| --- | --- | --- | --- |
| `g_rgb` | `g_rgb(int r, int g, int b)` | `int` | 打包 RGB 为 `0xRRGGBB`；每个分量只取低 8 位（`& 255`） |
| `g_new` | `g_new(int w, int h)` | `void` | 新建白色画布 `w × h`，等价于内建 `canvas(w, h)` |
| `g_clear` | `g_clear(int w, int h, int rgb)` | `void` | 新建画布并整体填充为 `rgb` |
| `g_rect_outline` | `g_rect_outline(int x, int y, int w, int h, int rgb)` | `void` | 画线宽 1 的矩形边框（四条 `draw_line`，不填充） |
| `g_bar_chart` | `g_bar_chart(int[] values, int n, int w, int h)` | `void` | 柱状图：先清成白底，按最大值自动缩放，柱子深蓝 `(60,120,200)`，最后补黑边框；`n <= 0` 时只留白底 |
| `g_grid` | `g_grid(int w, int h, int step)` | `void` | 浅灰 `(200,200,200)` 网格；`step <= 0` 会死循环，务必传正数 |
| `g_line_chart` | `g_line_chart(int[] values, int n, int w, int h)` | `void` | 折线图：白底 + 深红 `(200,40,40)` 折线；`n <= 1` 时只留白底 |
| `g_save` | `g_save(string path)` | `int` | 导出 PNG，`0` 成功 / `-1` 失败，转调内建 `save_png` |
| `g_show` | `g_show()` | `int` | 调系统查看器弹出窗口，转调内建 `show_canvas` |

```c
import "gui.cin"

function main() -> int {
    int a[5] = {3, 7, 2, 9, 5}
    g_bar_chart(a, 5, 50, 30)
    if (g_save("bar.png") != 0) { return 1 }
    println(int_to_str(g_rgb(255, 0, 0)))   // 16711680 (0xFF0000)
    g_line_chart(a, 5, 40, 20)
    g_save("line.png")
    return 0
}
```

## hash

哈希函数库。全部为 64 位整数运算（自然溢出即取模 2^64），适合与 `rand.cin` 配合做简易哈希表
或布隆过滤器的散列函数。

```c
import "hash.cin"
```

| 函数名 | 签名 | 返回值 | 说明与边界行为 |
| --- | --- | --- | --- |
| `hash_djb2` | `hash_djb2(string s)` | `int` | djb2：`h = h*33 + c`，初值 5381；空串返回 5381 |
| `hash_fnv1a` | `hash_fnv1a(string s)` | `int` | FNV-1a（64 位）；空串返回偏移基 `0xCBF29CE484222325` |
| `hash_sdbm` | `hash_sdbm(string s)` | `int` | sdbm：`h = c + (h<<6) + (h<<16) - h`，初值 0 |
| `hash_int` | `hash_int(int x)` | `int` | splitmix64 风格的整数位混合，用于打散规律性输入；`hash_int(0)` 为 0 |
| `hash_combine` | `hash_combine(int h1, int h2)` | `int` | 组合两个哈希值，**不可交换**；用于把多个字段揉成一个哈希 |
| `hash_bucket` | `hash_bucket(int h, int buckets)` | `int` | 映射到 `[0, buckets)`；`buckets <= 0` 返回 0，负数取模结果也归一到非负 |
| `hash_string_bucket` | `hash_string_bucket(string s, int buckets)` | `int` | 字符串 → 桶下标，即 `hash_bucket(hash_fnv1a(s), buckets)` |

```c
import "hash.cin"

function main() -> int {
    println(int_to_str(hash_djb2("")))              // 5381
    println(int_to_str(hash_string_bucket("hello", 16)))  // 0..15
    println(int_to_str(hash_bucket(-3, 8)))         // 5
    int h = hash_combine(hash_djb2("user"), hash_fnv1a("42"))
    println(int_to_str(hash_bucket(h, 64)))
    if (hash_djb2("abc") == hash_djb2("abd")) { return 1 }
    return 0
}
```

## heap

定长二叉堆库。纯 CIN 实现，**不做动态内存分配**：堆存放在库内全局数组 `heap_data[64]` 里，
容量上限 **`HEAP_CAP = 64`**，因此同一程序内只有一份全局实例，需要多个堆请用 `struct` 自行封装。
同一份实现同时支持**最小堆与最大堆**，由标志位 `heap_is_max` 选择：`heap_is_max == 0`
为最小堆，非零为最大堆。`heap_sort` 固定升序，并且直接在被排序数组上就地完成（内部自建最大堆，
不读写上面的全局堆），因此调用 `heap_sort` 不会破坏已有的堆状态。
空堆时 `heap_pop` / `heap_peek` / `heap_replace` 返回 `0`（无法区分“空”与“堆顶就是 0”，
需要区分时先查 `heap_is_empty`）。

```c
import "heap.cin"
```

| 函数名 | 签名 | 返回值 | 说明与边界行为 |
| --- | --- | --- | --- |
| `heap_capacity` | `heap_capacity()` | `int` | 固定返回 `64`（`HEAP_CAP`） |
| `heap_reset` | `heap_reset(int is_max)` | `void` | 清空并设置模式：`is_max` 非零为最大堆，否则最小堆 |
| `heap_size` | `heap_size()` | `int` | 当前元素个数 |
| `heap_is_empty` | `heap_is_empty()` | `int` | `1` 为空堆 |
| `heap_push` | `heap_push(int v)` | `int` | 入堆；成功返回 1，**满时返回 0 且丢弃该值** |
| `heap_pop` | `heap_pop()` | `int` | 弹出并返回堆顶；**空堆返回 0** |
| `heap_peek` | `heap_peek()` | `int` | 查看堆顶（不出堆）；**空堆返回 0** |
| `heap_replace` | `heap_replace(int v)` | `int` | 弹出堆顶并压入 `v`，返回被弹出的值；**空堆时等价于 `heap_push(v)` 并返回 0** |
| `heap_build` | `heap_build(int[] a, int n, int is_max)` | `void` | 用 `a` 的前 `n` 个元素重建堆并切换模式；**`n <= 0` 钳制为 0，`n > 64` 钳制为 64**（超出的元素被丢弃） |
| `heap_is_valid` | `heap_is_valid()` | `int` | 校验堆性质（每个孩子都不比父节点更优先），`1`/`0`；空堆返回 `1` |
| `heap_sort` | `heap_sort(int[] a, int n)` | `void` | 就地升序排序（堆排序），`n <= 1` 直接返回；不依赖也不修改全局堆状态 |
| `heap_better` | `heap_better(int a, int b)` | `int` | 内部辅助：`a` 是否应排在 `b` 前面（按当前 `heap_is_max`），非稳定接口 |
| `heap_sift_down` | `heap_sift_down(int i)` | `void` | 内部辅助：把全局堆下标 `i` 下沉，非稳定接口 |
| `heap_sift_max` | `heap_sift_max(int[] a, int m, int i)` | `void` | 内部辅助：在 `a[0..m-1]` 内按最大堆下沉，供 `heap_sort` 使用，非稳定接口 |

```c
import "heap.cin"

function main() -> int {
    heap_reset(0)                                          // 最小堆
    int v[6] = {5, 3, 8, 1, 9, 2}
    for (int i = 0; i < 6; i = i + 1) {
        heap_push(v[i])
    }
    println("min peek = " + int_to_str(heap_peek()))        // 1
    println("valid = " + int_to_str(heap_is_valid()))       // 1
    println("pop = " + int_to_str(heap_pop()))              // 1
    println("pop = " + int_to_str(heap_pop()))              // 2
    println("replace 0 = " + int_to_str(heap_replace(0)))   // 3 (弹回的堆顶)
    println("peek = " + int_to_str(heap_peek()))            // 0

    heap_reset(1)                                          // 最大堆
    heap_push(5)
    heap_push(9)
    heap_push(7)
    println("max peek = " + int_to_str(heap_peek()))        // 9

    int a[6] = {4, 8, 1, 8, 3, 6}
    heap_build(a, 6, 0)
    println("built peek = " + int_to_str(heap_peek()))      // 1

    heap_sort(a, 6)
    println("sorted = " + int_to_str(a[0]) + " "
            + int_to_str(a[1]) + " "
            + int_to_str(a[2]) + " "
            + int_to_str(a[3]) + " "
            + int_to_str(a[4]) + " "
            + int_to_str(a[5]))                            // 1 3 4 6 8 8
    return 0
}
```

## io

文件与路径工具库。内部转调 `file_read` / `file_write` / `file_append` / `file_exists` /
`file_size` / `file_delete` / `mkdir` / `dir_list` 等**宿主能力内建**，必须运行在 Go 原生引擎上；
文本处理部分（`io_line_count` / `io_get_line` / `io_split_get` / `io_split_count`）是纯 CIN 逻辑。

```c
import "io.cin"
```

| 函数名 | 签名 | 返回值 | 说明与边界行为 |
| --- | --- | --- | --- |
| `io_read` | `io_read(string path)` | `string` | 读取整个文本；失败返回空串（不抛错，需自行判断） |
| `io_write` | `io_write(string path, string text)` | `int` | 覆盖写入，`0` 成功 / `-1` 失败 |
| `io_append` | `io_append(string path, string text)` | `int` | 追加写入，`0` 成功 / `-1` 失败 |
| `io_exists` | `io_exists(string path)` | `int` | 是否存在，`1`/`0` |
| `io_size` | `io_size(string path)` | `int` | 文件字节数；失败返回 `-1` |
| `io_remove` | `io_remove(string path)` | `int` | 删除文件，`0` 成功 / `-1` 失败 |
| `io_mkdir` | `io_mkdir(string path)` | `int` | **递归创建目录**，`0` 成功 / `-1` 失败 |
| `io_list` | `io_list(string path)` | `string` | 目录条目，换行分隔；**目录名带 `/` 后缀** |
| `io_join` | `io_join(string a, string b)` | `string` | 路径拼接：任一侧为空则返回另一侧；已以 `/` 或 `\` 结尾则直接相连，否则补 `/`。**不做 `..` 归一化** |
| `io_basename` | `io_basename(string path)` | `string` | 取最后一段（同时识别 `/` 与 `\`）；无分隔符则原样返回 |
| `io_dirname` | `io_dirname(string path)` | `string` | 取目录部分；无分隔符返回空串，`"/a"` 返回空串 |
| `io_line_count` | `io_line_count(string text)` | `int` | 按 `\n` 统计行数；空串返回 0，`"a\nb"` 返回 2 |
| `io_get_line` | `io_get_line(string text, int idx)` | `string` | 取第 `idx` 行（0 起，不含换行符）；越界返回空串 |
| `io_split_get` | `io_split_get(string text, string sep, int idx)` | `string` | 按分隔串切分，取第 `idx` 段；`sep` 为空串时 `idx == 0` 返回原文，否则空串；越界返回空串 |
| `io_split_count` | `io_split_count(string text, string sep)` | `int` | 按分隔串切分的段数；`sep` 为空串时返回 1 |

```c
import "io.cin"

function main() -> int {
    if (io_write("note.txt", "a\nb\nc") != 0) { return 1 }
    println(int_to_str(io_size("note.txt")))                 // 5
    println(int_to_str(io_line_count(io_read("note.txt"))))  // 3
    println(io_get_line(io_read("note.txt"), 1))             // b
    println(io_basename("dir/note.txt"))                     // note.txt
    println(io_join("x", "y"))                               // x/y
    println(int_to_str(io_split_count("a,b,c", ",")))        // 3
    println(int_to_str(io_remove("note.txt")))
    return 0
}
```

## json

极简 JSON 取值库。面向**扁平对象**（典型场景是 Termux API 返回的 JSON），不做完整语法解析，
只支持 `"key": value` 形式的字符串/数字/布尔/空值提取；嵌套对象内层字段不会被正确解析。

```c
import "json.cin"
```

| 函数名 | 签名 | 返回值 | 说明与边界行为 |
| --- | --- | --- | --- |
| `j_raw` | `j_raw(string json, string key)` | `string` | 取 key 对应的原始片段：字符串值去引号，数字/`true`/`false`/`null` 原样返回（两端 `trim`）；找不到返回空串 |
| `j_str` | `j_str(string json, string key)` | `string` | 取字符串字段，直接转调 `j_raw` |
| `j_int` | `j_int(string json, string key)` | `int` | 取整数字段，走 `atoi(j_raw(...))`；无法解析为 0 |
| `j_float` | `j_float(string json, string key)` | `float` | 取浮点字段，支持可选负号与小数；无法解析为 `0.0`，不解析指数形式 |
| `j_has` | `j_has(string json, string key)` | `int` | 是否包含 `"key"` 字面量，`1`/`0`；只看引号包裹的键名，不做语法校验 |
| `j_bool` | `j_bool(string json, string key)` | `int` | 取布尔字段：值为 `true` 或 `1` 时返回 1，其余（含 `false`、缺失）返回 0 |

```c
import "json.cin"

function main() -> int {
    string j = "{\"name\":\"cin\",\"level\":42,\"on\":true,\"temp\":30.5}"
    println(j_str(j, "name"))                       // cin
    println(int_to_str(j_int(j, "level")))          // 42
    println(int_to_str(j_bool(j, "on")))            // 1
    println(float_to_str(j_float(j, "temp")))       // 30.500000
    println(int_to_str(j_has(j, "missing")))        // 0
    return 0
}
```

## key

键盘输入监听便捷封装。封装内建 `key_hit` / `get_key` / `key_flush`（非阻塞轮询），
需要**真实终端**与 Go 原生运行时；管道 / 重定向下 `key_hit` 恒为 `0`、`get_key` 恒为 `-1`。
首次调用会把终端切到原始输入（不回显、无行缓冲），程序退出自动恢复；监听期间 Ctrl+C
不再终止程序，表现为键码 `k_ctrl(67)` 即 `3`。

```c
import "key.cin"
```

`enum Key` 键码常量（扩展码与常用控制键）：

| 常量 | 值 | 含义 |
| --- | --- | --- |
| `K_UP` / `K_DOWN` / `K_LEFT` / `K_RIGHT` | `1001..1004` | 方向键 |
| `K_HOME` / `K_END` / `K_PGUP` / `K_PGDN` | `1005..1008` | Home / End / PgUp / PgDn |
| `K_INS` / `K_DEL` | `1009` / `1010` | 插入 / 删除 |
| `K_F1` .. `K_F10` | `1021..1030` | 功能键 F1..F10 |
| `K_ESC` / `K_ENTER` / `K_TAB` / `K_BACKSPACE` | `27` / `13` / `9` / `8` | 常用控制键 |

| 函数名 | 签名 | 返回值 | 说明与边界行为 |
| --- | --- | --- | --- |
| `k_ctrl` | `k_ctrl(int c)` | `int` | Ctrl 组合键码：`c & 0x1F`；如 `k_ctrl(67)`（字母 C）即 `3`（Ctrl+C） |
| `k_is_special` | `k_is_special(int code)` | `int` | 扩展键码判定：`1001..1030` 返回 `1`，其余（含 `0..255` 原始字节）返回 `0` |
| `key_wait` | `key_wait()` | `int` | 阻塞等待一个按键：内部以 10ms 轮询 `get_key()`，取到键码即返回 |

```c
import "key.cin"

function main() -> int {
    println("任意键开始, ESC 退出")
    while (1) {
        int k = key_wait()
        if (k == K_ESC) { break }
        if (k == K_UP)   { println("up") }
        if (k == K_DOWN) { println("down") }
        if (!k_is_special(k)) {
            println("键码 " + int_to_str(k))
        }
    }
    return 0
}
```

## math

数学扩展库。注意 CIN 的 `/` 恒为浮点除法，本库提供的是显式的取整/最值/夹取辅助函数。
同一文件同时给出 `f_`（浮点）与 `i_`（整数）两组函数。

```c
import "math.cin"
```

| 函数名 | 签名 | 返回值 | 说明与边界行为 |
| --- | --- | --- | --- |
| `f_abs` | `f_abs(float x)` | `float` | 绝对值 |
| `f_floor` | `f_floor(float x)` | `float` | 向下取整，负数向 `-inf`（`f_floor(-2.5)` 为 `-3.0`） |
| `f_ceil` | `f_ceil(float x)` | `float` | 向上取整，实现为 `-f_floor(-x)` |
| `f_round` | `f_round(float x)` | `float` | 四舍五入，实现为 `f_floor(x + 0.5)`；`.5` 一律向上 |
| `f_min` | `f_min(float a, float b)` | `float` | 两浮点较小者 |
| `f_max` | `f_max(float a, float b)` | `float` | 两浮点较大者 |
| `i_min` | `i_min(int a, int b)` | `int` | 两整数较小者 |
| `i_max` | `i_max(int a, int b)` | `int` | 两整数较大者 |
| `i_clamp` | `i_clamp(int v, int lo, int hi)` | `int` | 夹取到 `[lo, hi]`；`lo > hi` 时先命中 `v < lo` 分支 |
| `f_round`↔内建 | 见下方 tabs | — | `f_round` 与内建 `round` 语义一致，后者单条指令更快 |

::: tabs

== 调用标准库

```c
import "math.cin"

function main() -> int {
    println(float_to_str(f_round(2.5)))    // 3
    println(float_to_str(f_floor(-2.5)))   // -3
    println(int_to_str(i_clamp(99, 0, 10)))// 10
    return 0
}
```

== 等价内建

```c
function main() -> int {
    println(float_to_str(round(2.5)))      // 3
    println(float_to_str(floor(-2.5)))     // -3
    println(int_to_str(max(min(99, 10), 0)))  // 10
    return 0
}
```

:::

## matrix

方阵运算库。矩阵以**一维数组行主序**存放：`m[i*n + j]` 表示第 `i` 行第 `j` 列，因此可直接用
CIN 的 `int[]` 与固定数组，无需动态内存。所有 `_to` 形式把结果写入调用方提供的输出数组
`out`（`out` 与输入数组共用时结果不确定，`mat_mul` 明确要求 `out` 不得与 `a`/`b` 为同一数组）。

```c
import "matrix.cin"
```

| 函数名 | 签名 | 返回值 | 说明与边界行为 |
| --- | --- | --- | --- |
| `mat_zero` | `mat_zero(int[] m, int n)` | `void` | 把 `n*n` 个元素全部置 0 |
| `mat_identity` | `mat_identity(int[] m, int n)` | `void` | 置为单位阵（对角线 1，其余 0） |
| `mat_get` | `mat_get(int[] m, int n, int i, int j)` | `int` | 逐元素取值；下标越界返回 0（不报错） |
| `mat_set` | `mat_set(int[] m, int n, int i, int j, int v)` | `void` | 逐元素赋值；下标越界**静默不做任何事** |
| `mat_add` | `mat_add(int[] a, int[] b, int[] out, int n)` | `void` | `out = a + b` |
| `mat_sub` | `mat_sub(int[] a, int[] b, int[] out, int n)` | `void` | `out = a - b` |
| `mat_scale` | `mat_scale(int[] a, int k, int[] out, int n)` | `void` | `out = a * k`（逐元素乘标量） |
| `mat_mul` | `mat_mul(int[] a, int[] b, int[] out, int n)` | `void` | `out = a × b`，经典三重循环；`out` 不得与 `a`/`b` 为同一数组 |
| `mat_transpose` | `mat_transpose(int[] a, int[] out, int n)` | `void` | `out = a^T` |
| `mat_trace` | `mat_trace(int[] a, int n)` | `int` | 迹（对角线之和） |
| `mat_sum` | `mat_sum(int[] a, int n)` | `int` | 所有 `n*n` 个元素之和 |
| `mat_equals` | `mat_equals(int[] a, int[] b, int n)` | `int` | 是否逐元素相等，`1`/`0` |
| `mat_is_symmetric` | `mat_is_symmetric(int[] a, int n)` | `int` | 是否为对称矩阵（只比较上三角），`1`/`0` |
| `mat_det` | `mat_det(int[] a, int n)` | `int` | 行列式，拉普拉斯递归展开；**适合 `n <= 6`**（内部 `minor[36]` 只够 `(n-1)^2 <= 36` 的余子式）。`n <= 0` 返回 0，`n == 1` 返回 `a[0]`，`n == 2` 走闭式公式 |
| `mat_print` | `mat_print(int[] a, int n)` | `void` | 调试打印，每行一个方括号，元素以空格分隔 |

```c
import "matrix.cin"

function main() -> int {
    int n = 2
    int a[4] = {1, 2, 3, 4}
    int b[4] = {5, 6, 7, 8}
    int out[4]
    mat_mul(a, b, out, n)
    println(int_to_str(out[0]))            // 19
    mat_transpose(a, out, n)
    println(int_to_str(out[1]))            // 3
    println(int_to_str(mat_trace(a, n)))   // 5
    println(int_to_str(mat_det(a, n)))     // -2
    int m3[9] = {2, 0, 0, 0, 3, 0, 0, 0, 4}
    println(int_to_str(mat_det(m3, 3)))    // 24
    mat_print(a, n)
    return 0
}
```

## path

纯字符串路径工具库 (`codecin/lib/path.cin`, 前缀 `path_`)。与 `io` 库的
`io_join` / `io_basename` / `io_dirname` 不同, 本库**不访问文件系统**、**不依赖任何宿主能力**:
只用 `strlen` / `substr` / `strcmp` / `int_to_str`, 在纯 Python 解释器 (`--no-native`) 下
也能完整运行。`/` 与 `\` 两种分隔符都识别 (等价), 输出统一用 `/`。

::: warning 命名冲突: 必须用 `path_str_*` 而不是内建名
`path_join` / `path_basename` / `path_dirname` 是**宿主能力内建名**。CIN 编译器在
`_gen_call` 里先分派内建, 因此**同名用户函数永远不会被调用**: 在 Go 原生运行时它们解析到
真实主机的 `path_join` / `path_basename` / `path_dirname` (在本机 Windows 上返回
`a\b` 这类系统分隔符结果), 在 `--no-native` 下直接报
`host builtins ... require the native Go runtime`。所以本库把这三个纯字符串版本命名为
`path_str_join` / `path_str_basename` / `path_str_dirname`, 其余函数名与常规 `path_` 命名一致。
:::

容量与全局数据:

| 常量 / 全局量 | 值 | 说明 |
| --- | --- | --- |
| `PATH_MAX_PARTS` | `128` | 规范化 / 分段时可处理的路径分段上限 (`path_max_parts()` 可读取) |
| `path_parts_buf[128]` | — | 分段解析的全局暂存区, 1024 字节 |

`path_str_dirname` / `path_common_prefix` / `path_within` 会在函数内声明
`string[128]` 局部固长数组 (栈上 1 KiB 量级), 无动态内存分配。

明确不支持 (与真实文件系统语义不同):

- **不支持 UNC 语义**: `\\server\share` 的前导双反斜杠按普通分隔符处理, 会被折叠成单个 `/`, 不保留共享名语义;
- 盘符只做**字符串**识别: `path_is_absolute` 认 `C:\a` / `C:/a` / `C:`, 不校验盘符是否为真实字母, 也不做大小写折叠;
- `path_normalize` 的 `..` 只做**字符串层面**折叠, **不访问文件系统**, 不解析符号链接, 也不受真实目录结构约束;
- 路径分段比较一律**大小写敏感** ("A/b" 与 "a/b" 没有公共前缀)。

```c
import "path.cin"
```

| 函数名 | 签名 | 返回值 | 说明与边界行为 |
| --- | --- | --- | --- |
| `path_sep_posix` | `path_sep_posix()` | `string` | 返回 `"/"` |
| `path_sep_win` | `path_sep_win()` | `string` | 返回 `"\\"` (单字节反斜杠, 编码 92) |
| `path_is_sep` | `path_is_sep(int ch)` | `int` | 该字节是否为分隔符 (`47` 或 `92`), 返回 `1`/`0` |
| `path_max_parts` | `path_max_parts()` | `int` | 分段上限, 固定返回 `128` (`PATH_MAX_PARTS`) |
| `path_split_count` | `path_split_count(string p)` | `int` | 路径分段个数; 连续分隔符与尾随分隔符都**不产生空段**; `""` / `"/"` / `"///"` 均为 `0` |
| `path_split_get` | `path_split_get(string p, int idx)` | `string` | 第 `idx` 段 (0 起); 越界与负数返回 `""`; 与 `path_split_count` 使用同一套分段规则 |
| `path_str_basename` | `path_str_basename(string p)` | `string` | 最后一段 (文件名); `""` 与 `"/"` 返回 `""`, `"a/b/"` 返回 `"b"` (折叠尾随分隔符); 内建 `path_basename` 是宿主能力, 故用此名 |
| `path_str_dirname` | `path_str_dirname(string p)` | `string` | 去掉最后一段, 结果**不带**尾随分隔符: `"/a/b/c.txt" -> "/a/b"`, `"a" -> ""`, `"/a" -> "/"`; 不做 `.` / `..` 折叠; 内建 `path_dirname` 是宿主能力, 故用此名 |
| `path_ext` | `path_ext(string p)` | `string` | 最后一段的扩展名 (**含点**); 无扩展名返回 `""` (没有点、点在最前如 `.gitignore`、`.`、`..`); 只看最后一段 (`"dir.d/file"` 为 `""`); 点在最后 (`"a."`) 视为扩展名就是点本身, 返回 `"."` |
| `path_stem` | `path_stem(string p)` | `string` | 去掉扩展名的最后一段 (不含目录): `"a/b/c.txt" -> "c"`, `"a.tar.gz" -> "a.tar"`, `".gitignore" -> ".gitignore"`, `"a." -> "a"`; `"."` / `".."` 原样返回 |
| `path_str_join` | `path_str_join(string a, string b)` | `string` | 拼接: `a` 为空返回 `b`, `b` 为空返回 `a`; `b` 是绝对路径时忽略 `a` 直接返回 `b`; 否则 `a` 末尾已有分隔符就不重复添加, 否则补 `'/'`; 两侧都空返回 `""`; 内建 `path_join` 是宿主能力 (用系统分隔符), 故用此名 |
| `path_normalize` | `path_normalize(string p)` | `string` | 字符串层面规范化: 折叠重复分隔符、去掉 `.` 段、`..` 回退上一个段、保留前导分隔符、丢掉尾随分隔符、分隔符统一成 `/`; `"a/b/../c" -> "a/c"`, `"a/../../b" -> "../b"`, `"/../a" -> "/a"`, `"a/.." -> "."`; 空串 / `"."` / `"///"` 都得到 `"."`; 超过 `128` 段的部分被丢弃 |
| `path_is_absolute` | `path_is_absolute(string p)` | `int` | `"/a"`、`"\\a"` 返回 `1`; `"C:\a"` / `"C:/a"` / `"C:"` (第二个字符是 `:`) 也返回 `1`; `""`、`"a/b"`、`"."`、`".."` 返回 `0` |
| `path_trim_sep` | `path_trim_sep(string p)` | `string` | 去掉首尾分隔符: `"/a/b/" -> "a/b"`, `"/" -> ""`, `"///" -> ""`; 中间重复分隔符不折叠 |
| `path_common_prefix` | `path_common_prefix(string a, string b)` | `string` | 最长公共**分段**前缀 (不把 `"foo"` 与 `"foobar"` 当公共前缀); `"/a/b/c"` 与 `"/a/b/d"` 得 `"/a/b"`; 一侧绝对一侧相对返回 `""` (即使分段相同); 盘符路径保留盘符段 (`"C:/a"`), 只有 POSIX 根形式才补前导 `/`; 根 `"/"` 没有分段, 与 `"/a"` 得 `""`; 无公共分段返回 `""` |
| `path_within` | `path_within(string parent, string child)` | `int` | `child` 是否在 `parent` 之内, 按分段边界比较 (因此 `"/a/b"` **不**包含 `"/a/bc"`); 相等也算在内; `""` 作为 parent 返回 `0`; `"/"` 包含一切绝对路径, 但不包含相对路径; `"a/"` 与 `"a\b"` 视为 `a` 之下; 大小写敏感 |
| `path_change_ext` | `path_change_ext(string p, string newext)` | `string` | 替换 / 补上最后一段的扩展名; `newext` 带点或不带点都行 (`"md"` 与 `".md"` 等价); `newext` 为空串则删除扩展名; 没有扩展名时补上; `""` / `"."` / `".."` 以及以分隔符结尾的目录形式 (`"/a/b/"`) 原样返回; 目录部分原样保留 (只丢掉尾随分隔符) |

`path_parts_into(string p)` 是本库内部使用的分段辅助函数 (把分段写入全局
`path_parts_buf` 并返回段数), 上表未列出; 常规使用请用 `path_split_count` /
`path_split_get`。

```c
import "path.cin"

function main() -> int {
    println("sep_posix = [" + path_sep_posix() + "]")                 // [/]
    println("is_sep(47) = " + int_to_str(path_is_sep(47)))            // 1
    println("is_sep('A') = " + int_to_str(path_is_sep(65)))           // 0

    println("basename = " + path_str_basename("/a/b/c.txt"))          // c.txt
    println("basename(a/b/) = " + path_str_basename("a/b/"))          // b
    println("dirname = " + path_str_dirname("/a/b/c.txt"))            // /a/b
    println("dirname(/a) = " + path_str_dirname("/a"))                // /
    println("ext = " + path_ext("/a/b/c.txt"))                        // .txt
    println("ext(.gitignore) = [" + path_ext(".gitignore") + "]")     // []
    println("stem = " + path_stem("/a/b/c.txt"))                      // c

    println("join = " + path_str_join("a/", "b"))                     // a/b
    println("join(abs) = " + path_str_join("a", "/b"))                // /b
    println("normalize = " + path_normalize("a//b/./c/../d"))         // a/b/d
    println("normalize(abs) = " + path_normalize("//a/b/"))           // /a/b
    println("normalize(..) = " + path_normalize("a/../../b"))         // ../b
    println("normalize(empty) = " + path_normalize(""))               // .

    println("is_abs(/a) = " + int_to_str(path_is_absolute("/a")))     // 1
    println("is_abs(a/b) = " + int_to_str(path_is_absolute("a/b")))   // 0
    println("is_abs(C:\\a) = " + int_to_str(path_is_absolute("C:\\a")))  // 1

    println("trim_sep = " + path_trim_sep("/a/b/"))                   // a/b
    println("split_count = " + int_to_str(path_split_count("a//b/c")))  // 3
    println("split_get(1) = " + path_split_get("a//b/c", 1))          // b
    println("common = " + path_common_prefix("/a/b/c", "/a/b/d"))     // /a/b
    println("common(drive) = " + path_common_prefix("C:\\a\\b", "C:\\a\\c"))  // C:/a
    println("within = " + int_to_str(path_within("/a/b", "/a/b/c.txt")))      // 1
    println("within(bc) = " + int_to_str(path_within("/a/b", "/a/bc")))       // 0
    println("change_ext = " + path_change_ext("a/b/c.txt", "md"))     // a/b/c.md
    println("change_ext(del) = " + path_change_ext("a/b/c.txt", ""))  // a/b/c
    return 0
}
```

## queue

队列与栈库。提供**定长环形队列（FIFO）**与**定长栈（LIFO）**，使用库内全局状态
（`queue_ring[64]`、`queue_head`、`queue_tail`、`queue_len`、`stack_data[64]`、`stack_len`），
因此**同一程序内各只有一份实例**；需要多实例时请用 `struct` 自行封装。
容量上限 `QUEUE_CAP` / `STACK_CAP` 均为 **64**。

```c
import "queue.cin"
```

| 函数名 | 签名 | 返回值 | 说明与边界行为 |
| --- | --- | --- | --- |
| `queue_capacity` | `queue_capacity()` | `int` | 固定返回 64 |
| `queue_clear` | `queue_clear()` | `void` | 清空队列（头尾指针与长度归零） |
| `queue_size` | `queue_size()` | `int` | 当前元素个数 |
| `queue_is_empty` | `queue_is_empty()` | `int` | `1` 为空 |
| `queue_is_full` | `queue_is_full()` | `int` | `1` 为满（长度等于 64） |
| `queue_push` | `queue_push(int v)` | `int` | 入队；成功返回 1，**满时返回 0 且丢弃该值** |
| `queue_pop` | `queue_pop()` | `int` | 出队并返回；**空时返回 0**（无法区分“空”与“队首就是 0”，需先查 `queue_is_empty`） |
| `queue_front` | `queue_front()` | `int` | 查看队首（不出队）；空时返回 0 |
| `queue_back` | `queue_back()` | `int` | 查看队尾；空时返回 0。实现为 `tail-1`，`tail == 0` 时回绕到下标 63 |
| `stack_capacity` | `stack_capacity()` | `int` | 固定返回 64 |
| `stack_clear` | `stack_clear()` | `void` | 清空栈 |
| `stack_size` | `stack_size()` | `int` | 当前元素个数 |
| `stack_is_empty` | `stack_is_empty()` | `int` | `1` 为空 |
| `stack_push` | `stack_push(int v)` | `int` | 入栈；成功返回 1，**满时返回 0** |
| `stack_pop` | `stack_pop()` | `int` | 出栈并返回；空时返回 0 |
| `stack_peek` | `stack_peek()` | `int` | 查看栈顶（不出栈）；空时返回 0 |

```c
import "queue.cin"

function main() -> int {
    queue_clear()
    queue_push(1)
    queue_push(2)
    println(int_to_str(queue_size()))     // 2
    println(int_to_str(queue_front()))    // 1
    println(int_to_str(queue_back()))     // 2
    println(int_to_str(queue_pop()))      // 1

    stack_clear()
    stack_push(7)
    stack_push(8)
    println(int_to_str(stack_peek()))     // 8
    println(int_to_str(stack_pop()))      // 8
    println(int_to_str(stack_pop()))      // 7
    println(int_to_str(stack_pop()))      // 0 (已空)
    return 0
}
```

## rand

随机工具库。基于内建 `rand()`；需要可复现序列时先调用内建 `srand(种子)`（只种一次，别在循环里种）。

```c
import "rand.cin"
```

| 函数名 | 签名 | 返回值 | 说明与边界行为 |
| --- | --- | --- | --- |
| `r_range` | `r_range(int lo, int hi)` | `int` | 闭区间 `[lo, hi]` 随机整数；`hi <= lo` 时直接返回 `lo` |
| `r_bool` | `r_bool()` | `bool` | 随机布尔，等价于 `r_range(0, 1) == 1` |
| `r_float` | `r_float()` | `float` | `[0.0, 1.0)` 随机浮点，实现为 `rand() / 2147483648.0` |
| `r_float_range` | `r_float_range(float lo, float hi)` | `float` | `[lo, hi)` 随机浮点；`hi < lo` 时区间反向，结果落在 `(hi, lo]` |
| `r_shuffle` | `r_shuffle(int[] a, int n)` | `void` | 原地 Fisher-Yates 洗牌，元素多重集不变 |
| `r_choice` | `r_choice(int[] a, int n)` | `int` | 随机取一个元素；`n <= 0` 返回 0，不做错误上报 |
| `r_chance` | `r_chance(int p)` | `int` | 以 `p`（0..100 的百分比）概率返回 1；`p <= 0` 恒 0，`p >= 100` 恒 1 |

```c
import "rand.cin"

function main() -> int {
    srand(12345)                                  // 固定种子 -> 可复现
    for (int i = 0; i < 3; i = i + 1) {
        println(int_to_str(r_range(10, 20)))      // 10..20
    }
    int a[3] = {1, 2, 3}
    r_shuffle(a, 3)
    println(int_to_str(r_choice(a, 3)))           // 1 / 2 / 3
    println(int_to_str(r_chance(50)))             // 0 或 1
    return 0
}
```

## set

整数集合库（位图实现）。纯 CIN 实现，**不做动态内存分配**：集合以位图形式存放在库内全局数组
`set_data[6]`（3 个槽 × 2 个 64 位字）里，元素范围 `0..SET_MAX-1`，容量常量
**`SET_MAX = 128`**（`set_capacity()` 返回 `128`，`set_max()` 返回最大合法元素值 `127`）。
全局数据段只占 6 槽 = 48 字节。

槽位模型：所有接口的 `which` 只能是 `0` / `1` / `2`。`0` 是集合 **A**，`1` 是集合 **B**，
两者互相独立；`2` 是备用槽 **C**，给 `set_*_into` 存放结果。全局变量由运行时清零，
所以程序一开始三个槽都是空集。

边界行为（全局约定）：

- `which` 非法（不在 `0..2`）：数值查询 `set_size` / `set_is_empty` / `set_min` /
  `set_max_value` / `set_count_range` 返回 `-1`；布尔查询 `set_contains` / `set_is_subset` /
  `set_equals` / `set_is_full` 返回 `0`；写入类 `set_add` / `set_remove` / `set_reset` /
  `set_clear` / `set_fill` / `set_copy_into` / `set_union_into` / `set_intersect_into` /
  `set_diff_into` 返回 `0` 且绝不写内存；`set_to_str` 返回空串 `""`。`set_reset_all()` 无参数。
- 元素 `v` 非法（`v < 0` 或 `v >= 128`）：`set_add` / `set_remove` / `set_contains` 返回 `0`，
  不写内存。
- 空集：`set_size` 为 `0`，`set_is_empty` 为 `1`，`set_is_full` 为 `0`，`set_min` /
  `set_max_value` 为 `-1`，`set_count_range` 为 `0`，`set_to_str` 为 `"{}"`。
- 集合运算允许 `dst` 与 `a` / `b` 是同一个槽（原地运算）。
- `set_clear(which)` 与 `set_reset(which)` 完全等价。

```c
import "set.cin"
```

| 函数名 | 签名 | 返回值 | 说明与边界行为 |
| --- | --- | --- | --- |
| `set_max` | `set_max()` | `int` | 最大合法元素值，固定返回 `127`（`SET_MAX - 1`） |
| `set_capacity` | `set_capacity()` | `int` | 元素个数上限，固定返回 `128`（`SET_MAX`） |
| `set_slots` | `set_slots()` | `int` | 可用槽数，固定返回 `3`（`which` 的合法取值个数） |
| `set_reset` | `set_reset(int which)` | `int` | 清空槽 `which`；`1` 成功，`0` 表示 `which` 非法（无操作） |
| `set_reset_all` | `set_reset_all()` | `void` | 清空全部 3 个槽 |
| `set_clear` | `set_clear(int which)` | `int` | `set_reset` 的别名（按“清空集合”语义书写） |
| `set_fill` | `set_fill(int which)` | `int` | 把槽置满（全部 128 个元素）；`1` 成功，`0` 表示 `which` 非法 |
| `set_copy_into` | `set_copy_into(int dst, int src)` | `int` | 把 `src` 槽整体复制到 `dst` 槽（允许 `dst == src`）；`1` 成功，`0` 表示有非法槽 |
| `set_add` | `set_add(int which, int v)` | `int` | 加入元素 `v`；成功 `1`，`v` 越界 / `which` 非法 / **已存在** 均返回 `0` |
| `set_remove` | `set_remove(int which, int v)` | `int` | 删除元素 `v`；真正删掉返回 `1`，`v` 越界 / `which` 非法 / 本来不存在返回 `0` |
| `set_contains` | `set_contains(int which, int v)` | `int` | 是否包含 `v`，`1`/`0`；`which` 非法或 `v` 越界返回 `0` |
| `set_size` | `set_size(int which)` | `int` | 元素个数（`0..128`）；`which` 非法返回 `-1` |
| `set_is_empty` | `set_is_empty(int which)` | `int` | 空集返回 `1`，非空返回 `0`；`which` 非法返回 `-1` |
| `set_is_full` | `set_is_full(int which)` | `int` | 128 个元素全在返回 `1`，否则 `0`；`which` 非法返回 `0` |
| `set_min` | `set_min(int which)` | `int` | 最小元素；**空集或 `which` 非法返回 `-1`** |
| `set_max_value` | `set_max_value(int which)` | `int` | 最大元素；**空集或 `which` 非法返回 `-1`** |
| `set_count_range` | `set_count_range(int which, int lo, int hi)` | `int` | 闭区间 `[lo, hi]` 内的元素个数；`lo`/`hi` 自动钳制到 `[0, 127]`，钳制后 `hi < lo` 返回 `0`；`which` 非法返回 `-1` |
| `set_union_into` | `set_union_into(int dst, int a, int b)` | `int` | `dst = a \| b`；`1` 成功，`0` 表示有非法槽（`dst` 可与 `a`/`b` 同槽） |
| `set_intersect_into` | `set_intersect_into(int dst, int a, int b)` | `int` | `dst = a & b`；`1` 成功，`0` 表示有非法槽 |
| `set_diff_into` | `set_diff_into(int dst, int a, int b)` | `int` | `dst = a - b`（差集）；`1` 成功，`0` 表示有非法槽 |
| `set_is_subset` | `set_is_subset(int a, int b)` | `int` | `a` 是否为 `b` 的子集，`1`/`0`；**空集是任何集合的子集**；有非法槽返回 `0` |
| `set_equals` | `set_equals(int a, int b)` | `int` | 两个槽是否完全相同，`1`/`0`；有非法槽返回 `0` |
| `set_to_str` | `set_to_str(int which)` | `string` | 字符串形式，形如 `{1, 3, 5}`；空集为 `{}`；**`which` 非法返回 `""`** |
| `set_valid` | `set_valid(int which)` | `int` | 内部辅助：`which` 是否在 `0..2`，非稳定接口 |
| `set_popcount64` | `set_popcount64(int x)` | `int` | 内部辅助：单个 64 位字的 popcount（含符号位），非稳定接口 |
| `set_raw_test` | `set_raw_test(int which, int v)` | `int` | 内部辅助：直接读第 `v` 位，调用前须保证 `which` 合法且 `0 <= v < 128`，非稳定接口 |

```c
import "set.cin"

function main() -> int {
    set_reset_all()
    set_add(0, 1)
    set_add(0, 3)
    set_add(0, 5)
    println("A = " + set_to_str(0))                       // A = {1, 3, 5}

    set_add(1, 3)
    set_add(1, 4)
    println("B = " + set_to_str(1))                       // B = {3, 4}

    set_union_into(2, 0, 1)
    println("A|B = " + set_to_str(2))                     // A|B = {1, 3, 4, 5}
    set_intersect_into(2, 0, 1)
    println("A&B = " + set_to_str(2))                     // A&B = {3}
    set_diff_into(2, 0, 1)
    println("A-B = " + set_to_str(2))                     // A-B = {1, 5}

    println("size = " + int_to_str(set_size(0)))          // size = 3
    println("min = " + int_to_str(set_min(0)))            // min = 1
    println("max = " + int_to_str(set_max_value(0)))      // max = 5
    println("count [0,3] = " + int_to_str(set_count_range(0, 0, 3)))    // count [0,3] = 2
    println("B subset A = " + int_to_str(set_is_subset(1, 0)))          // B subset A = 0
    println("A == A = " + int_to_str(set_equals(0, 0)))                 // A == A = 1

    set_remove(0, 3)
    println("A after remove = " + set_to_str(0))          // A after remove = {1, 5}
    set_clear(0)
    println("A after clear = " + set_to_str(0))           // A after clear = {}
    return 0
}
```

## sort

排序与查找库。三个基础排序 + 快速排序，全部原地升序；二分查找要求数组已升序。

```c
import "sort.cin"
```

| 函数名 | 签名 | 返回值 | 说明与边界行为 |
| --- | --- | --- | --- |
| `sort_is_sorted` | `sort_is_sorted(int[] a, int n)` | `int` | 是否已升序（相等视为有序），`1`/`0`；`n <= 1` 返回 1 |
| `sort_bubble` | `sort_bubble(int[] a, int n)` | `void` | 冒泡排序，原地升序 |
| `sort_selection` | `sort_selection(int[] a, int n)` | `void` | 选择排序，原地升序 |
| `sort_insertion` | `sort_insertion(int[] a, int n)` | `void` | 插入排序，原地升序；小数组通常最快 |
| `sort_quick` | `sort_quick(int[] a, int lo, int hi)` | `void` | 快速排序**闭区间** `[lo, hi]`；取中点值为枢轴，`lo >= hi` 直接返回 |
| `sort_quick_all` | `sort_quick_all(int[] a, int n)` | `void` | 整体入口，等价于 `n > 1` 时调用 `sort_quick(a, 0, n - 1)` |
| `bin_search` | `bin_search(int[] a, int n, int v)` | `int` | 二分查找，返回命中下标或 `-1`；**数组必须已升序**，重复元素返回其中某个位置（不保证是第一个） |

```c
import "sort.cin"

function main() -> int {
    int a[7] = {9, 2, 7, 1, 8, 3, 5}
    sort_quick_all(a, 7)
    println(int_to_str(sort_is_sorted(a, 7)))   // 1
    println(int_to_str(a[0]))                   // 1
    println(int_to_str(bin_search(a, 7, 7)))    // 4
    println(int_to_str(bin_search(a, 7, 100)))  // -1
    int b[5] = {5, 4, 3, 2, 1}
    sort_insertion(b, 5)
    println(int_to_str(b[0]))                   // 1
    return 0
}
```

## stat

面向 `int` 数组的**顺序统计量**库（中位数/众数/百分位/直方图）与免排序的聚合量。
与 `codecin/lib/vec.cin`（浮点统计）互补。需要升序输入的接口以 `_sorted` 结尾。

```c
import "stat.cin"
```

| 函数名 | 签名 | 返回值 | 说明与边界行为 |
| --- | --- | --- | --- |
| `stat_sum` | `stat_sum(int[] a, int n)` | `int` | 求和 |
| `stat_min` | `stat_min(int[] a, int n)` | `int` | 最小值；`n <= 0` 返回 0 |
| `stat_max` | `stat_max(int[] a, int n)` | `int` | 最大值；`n <= 0` 返回 0 |
| `stat_range` | `stat_range(int[] a, int n)` | `int` | 极差 `max - min`；`n <= 0` 返回 0 |
| `stat_mean` | `stat_mean(int[] a, int n)` | `int` | 整数均值，`idiv` 向零截断；`n <= 0` 返回 0 |
| `stat_count` | `stat_count(int[] a, int n, int v)` | `int` | 等于 `v` 的元素个数 |
| `stat_median_sorted` | `stat_median_sorted(int[] a, int n)` | `int` | 中位数，**要求已升序**；偶数个取中间两个的截断平均；`n <= 0` 返回 0 |
| `stat_mode` | `stat_mode(int[] a, int n)` | `int` | 众数（出现次数最多的值）；**并列时取较小值**；`O(n^2)`，无需排序；`n <= 0` 返回 0 |
| `stat_percentile_sorted` | `stat_percentile_sorted(int[] a, int n, int p)` | `int` | 最近秩百分位，**要求已升序**，`p` 属于 `0..100`；`p <= 0` 返回 `a[0]`，`p >= 100` 返回 `a[n-1]`；内部秩为 `ceil(n*p/100)` 且至少为 1 |
| `stat_q1_sorted` | `stat_q1_sorted(int[] a, int n)` | `int` | 下四分位，即 `stat_percentile_sorted(a, n, 25)`；要求已升序 |
| `stat_q3_sorted` | `stat_q3_sorted(int[] a, int n)` | `int` | 上四分位，即 `stat_percentile_sorted(a, n, 75)`；要求已升序 |
| `stat_histogram` | `stat_histogram(int[] a, int n, int[] hist, int bins)` | `void` | 直方图：先把 `hist[0..bins-1]` 清零，再把落在 `[0, bins-1]` 的值计数；**负值与越界值被忽略** |
| `stat_variance_x1000` | `stat_variance_x1000(int[] a, int n)` | `int` | 方差 ×1000（整数化，便于断言）；公式 `(n*sum(x^2) - sum(x)^2) / n^2` 再乘 1000；`n <= 0` 返回 0 |
| `stat_stdev_x100` | `stat_stdev_x100(int[] a, int n)` | `int` | 标准差 ×100（整数化），实现为 `stat_variance_x1000(a, n) / 10` |
| `stat_is_sorted` | `stat_is_sorted(int[] a, int n)` | `int` | 升序判定，`1`/`0`（与 `sort_is_sorted` 同语义） |

```c
import "stat.cin"

function main() -> int {
    int a[6] = {4, 8, 1, 8, 3, 6}
    println(int_to_str(stat_sum(a, 6)))        // 30
    println(int_to_str(stat_mean(a, 6)))       // 5
    println(int_to_str(stat_mode(a, 6)))       // 8
    println(int_to_str(stat_variance_x1000(a, 6)))  // 6666
    int s[6] = {1, 3, 4, 6, 8, 8}
    println(int_to_str(stat_median_sorted(s, 6)))   // 5
    println(int_to_str(stat_q1_sorted(s, 6)))       // 3
    int h[10]
    stat_histogram(a, 6, h, 10)
    println(int_to_str(h[8]))                  // 2
    return 0
}
```

## str

字符串变换库。依赖内建 `upper` / `lower` / `substr` / `indexof` / `strlen` / `strcmp`。
这些函数**分配新堆块**，大量循环拼接会消耗堆（64 位槽，不回收），长循环里请尽量减少拼接次数。

```c
import "str.cin"
```

| 函数名 | 签名 | 返回值 | 说明与边界行为 |
| --- | --- | --- | --- |
| `s_upper` | `s_upper(string s)` | `string` | 转大写，转调内建 `upper` |
| `s_lower` | `s_lower(string s)` | `string` | 转小写，转调内建 `lower` |
| `s_contains` | `s_contains(string hay, string needle)` | `int` | 是否包含子串，`1`/`0`；空 `needle` 恒为 1 |
| `s_starts_with` | `s_starts_with(string s, string prefix)` | `int` | 是否以 `prefix` 开头（`indexof == 0`）；空 `prefix` 为 1 |
| `s_ends_with` | `s_ends_with(string s, string suffix)` | `int` | 是否以 `suffix` 结尾；`strlen(suffix) > strlen(s)` 返回 0，空 `suffix` 为 1 |
| `s_count` | `s_count(string hay, string needle)` | `int` | 不重叠出现次数（如 `s_count("aaa","aa")` 为 1）；`needle` 为空串返回 0 |
| `s_repeat` | `s_repeat(string ch, int n)` | `string` | 把 `ch` 重复 `n` 次；`n <= 0` 返回空串。参数名是 `ch` 但可传任意字符串 |

```c
import "str.cin"

function main() -> int {
    println(s_upper("aBcDe"))                      // ABCDE
    println(s_lower("HeLLo"))                      // hello
    println(int_to_str(s_contains("banana", "nan")))    // 1
    println(int_to_str(s_starts_with("readme.txt", "read")))  // 1
    println(int_to_str(s_ends_with("readme.txt", ".txt")))    // 1
    println(int_to_str(s_count("aaa", "aa")))      // 1
    println(s_repeat("ab", 3))                     // ababab
    return 0
}
```

## termux

Termux API 便捷封装库。内部 `import "json.cin"`，并转调 `termux_available` / `termux_notify` /
`termux_clipboard_*` / `termux_battery` / `termux_location` / `termux_wifi_info` 等宿主能力内建。
需要 **termux-api 命令 + Termux:API 应用**；非 Termux 环境下调用返回 `-1` 或空串。

```c
import "termux.cin"
```

| 函数名 | 签名 | 返回值 | 说明与边界行为 |
| --- | --- | --- | --- |
| `tx_ok` | `tx_ok()` | `int` | Termux API 是否可用，`1`/`0`；非 Termux 环境返回 0 |
| `tx_notify` | `tx_notify(string title, string content)` | `int` | 发送系统通知 |
| `tx_toast` | `tx_toast(string msg)` | `int` | 弹出 Toast |
| `tx_copy` | `tx_copy(string s)` | `int` | 写入剪贴板 |
| `tx_paste` | `tx_paste()` | `string` | 读取剪贴板；不可用时为空串 |
| `tx_vibrate` | `tx_vibrate(int ms)` | `int` | 振动 `ms` 毫秒 |
| `tx_say` | `tx_say(string text)` | `int` | 文字转语音 |
| `tx_sms` | `tx_sms(string number, string text)` | `int` | 发送短信 |
| `tx_battery_json` | `tx_battery_json()` | `string` | 电池状态原始 JSON；不可用时为空串 |
| `tx_battery_level` | `tx_battery_level()` | `int` | 电池百分比；JSON 为空返回 `-1`，解析失败经 `j_int` 得 0 |
| `tx_battery_temp` | `tx_battery_temp()` | `float` | 电池温度；不可用返回 `-1.0` |
| `tx_battery_plugged` | `tx_battery_plugged()` | `int` | 是否充电中，`1`/`0`；`plugged` 为 `UNPLUGGED` 或字段为空时 0 |
| `tx_location_json` | `tx_location_json()` | `string` | 定位原始 JSON |
| `tx_latitude` | `tx_latitude()` | `float` | 定位纬度；不可用为 `0.0` |
| `tx_longitude` | `tx_longitude()` | `float` | 定位经度；不可用为 `0.0` |
| `tx_wifi_json` | `tx_wifi_json()` | `string` | WiFi 连接信息原始 JSON |
| `tx_wifi_ssid` | `tx_wifi_ssid()` | `string` | 当前 WiFi SSID；不可用为空串 |
| `tx_prompt` | `tx_prompt(string title)` | `string` | 弹出输入对话框并返回用户输入文本；不可用为空串 |
| `tx_alert` | `tx_alert(string title, string content)` | `int` | 组合动作：通知 + 振动 200ms，返回通知的返回值 |

```c
import "termux.cin"

function main() -> int {
    if (tx_ok() == 0) {
        println("not termux")              // 非 Termux 环境
        return 0
    }
    tx_alert("Code CIN", "构建完成")        // 通知 + 振动
    println(int_to_str(tx_battery_level())) // 0..100
    println(float_to_str(tx_battery_temp()))
    println(int_to_str(tx_battery_plugged()))  // 1/0
    tx_toast("hello")
    return 0
}
```

## test

轻量测试断言库。提供计数器（全局 `T_PASS` / `T_FAIL`）与断言；结束时调用 `t_report()`
输出汇总并**返回失败数**，因此可直接 `return t_report()` 作为 `main` 的退出码。

```c
import "test.cin"
```

| 函数名 | 签名 | 返回值 | 说明与边界行为 |
| --- | --- | --- | --- |
| `t_eq_int` | `t_eq_int(int got, int want, string label)` | `int` | 断言两整数相等；通过返回 1，失败打印 `FAIL label: got=.. want=..` 并返回 0 |
| `t_eq_str` | `t_eq_str(string got, string want, string label)` | `int` | 断言两字符串相等（`strcmp`）；失败打印 `got=[..] want=[..]` |
| `t_near` | `t_near(float got, float want, float eps, string label)` | `int` | 断言浮点近似相等，判据是绝对差 `d <= eps`（闭区间） |
| `t_true` | `t_true(int cond, string label)` | `int` | 断言 `cond != 0`；失败打印 `condition false` |
| `t_false` | `t_false(int cond, string label)` | `int` | 断言 `cond == 0`，实现为 `t_true(cond == 0, label)` |
| `t_reset` | `t_reset()` | `void` | 把 `T_PASS` / `T_FAIL` 归零 |
| `t_report` | `t_report()` | `int` | 输出汇总：全通过打印 `OK: N assertions passed`，否则 `FAILED: F of T`；返回失败数 `T_FAIL` |

```c
import "test.cin"
import "array.cin"

function main() -> int {
    t_reset()
    int a[4] = {4, 8, 1, 8}
    t_eq_int(a_sum(a, 4), 21, "a_sum")
    t_eq_str("a", "a", "strcmp")
    t_near(1.0, 1.0001, 0.01, "near")
    t_true(a_count(a, 4, 8) == 2, "count8")
    t_false(a_contains(a, 4, 99), "no99")
    return t_report()          // 全通过时返回 0
}
```

## text

纯 CIN 文本处理库。比 `str` 更进一步的字符串操作：大小写无关比较、字节反转、全量/首次替换、区间编辑（切片 / 插入 / 删除）、首字母与标题化、大小写互换、词数统计。只依赖非宿主内建（`strlen` / `substr` / `indexof` / `upper` / `lower` / `strcmp`），`--no-native` 下同样可用。

下标与长度一律是**字节**语义（与 `strlen` / `substr` / `s[i]` 一致）：非 ASCII 按 UTF-8 字节序列逐个处理，不做码点解码；大小写转换只折叠 ASCII 字母（`a-z` / `A-Z`），其余字节原样保留。

```c
import "text.cin"
```

| 函数名 | 签名 | 返回值 | 说明与边界行为 |
| --- | --- | --- | --- |
| `txt_is_empty` | `txt_is_empty(string s)` | `int` | 字节长度为 0 返回 1；**空白串不算空**（全空白可用 `txt_word_count(s) == 0`），`""` 为 1 |
| `txt_equals_ignore_case` | `txt_equals_ignore_case(string a, string b)` | `int` | ASCII 大小写无关的整串相等，`1`/`0`；长度不同直接为 0，非 ASCII 字节必须逐一相同（如 `a[` 与 `A{` 不相等） |
| `txt_startswith_ignore_case` | `txt_startswith_ignore_case(string s, string p)` | `int` | `s` 是否以 `p` 开头（ASCII 大小写无关），`1`/`0`；空 `p` 恒为 1，`strlen(p) > strlen(s)` 返回 0 |
| `txt_reverse` | `txt_reverse(string s)` | `string` | 按字节反转；空串返回空串。非 ASCII 会被切成单字节片段（纯字节语义，不做码点反转） |
| `txt_index_from` | `txt_index_from(string hay, string needle, int from)` | `int` | 从字节下标 `from`（含）起找 `needle` 的首次出现，返回绝对字节下标；未找到 `-1`。`from` 越界裁剪到 `[0, strlen(hay)]`；`needle` 为空串返回裁剪后的 `from` |
| `txt_last_index_of` | `txt_last_index_of(string hay, string needle)` | `int` | 最后一次出现的字节下标（**允许重叠匹配**，`txt_last_index_of("aaaa", "aa")` 为 2）；未找到 `-1`；空 `needle` 返回 `strlen(hay)` |
| `txt_replace` | `txt_replace(string s, string from, string to)` | `string` | 全部替换，从左到右扫描且**不重叠**（`txt_replace("aaa", "aa", "b")` 为 `"ba"`）；**`from` 为空串时原样返回 `s`**（不做插入）；无匹配时返回内容相同的副本 |
| `txt_replace_first` | `txt_replace_first(string s, string from, string to)` | `string` | 只替换首次出现；`from` 为空串或无匹配时原样返回 `s`（无匹配返回同一指针） |
| `txt_remove` | `txt_remove(string s, string sub)` | `string` | 删除全部 `sub`（等价 `txt_replace(s, sub, "")`）；`sub` 为空串时原样返回 `s` |
| `txt_slice` | `txt_slice(string s, int start, int end)` | `string` | 左闭右开切片 `[start, end)`，越界自动裁剪；`end <= start`、负数区间或空串都返回 `""` |
| `txt_insert` | `txt_insert(string s, int pos, string sub)` | `string` | 在字节下标 `pos` 处插入 `sub`；`pos` 裁剪到 `[0, strlen(s)]`（超过末尾追加到末尾，负数当 0）；`sub` 为空串返回原串副本 |
| `txt_delete_range` | `txt_delete_range(string s, int pos, int len)` | `string` | 删除 `[pos, pos+len)`；`pos` 裁剪到 `[0, strlen(s)]`，`len < 0` 当 0，越过末尾自动缩短；越界/空串都不报错 |
| `txt_capitalize` | `txt_capitalize(string s)` | `string` | 首个 ASCII 字母大写、其余 ASCII 字母小写（Python `str.capitalize` 风格）；前导非字母字节原样保留；完全没有 ASCII 字母时原样返回；`""` 返回 `""` |
| `txt_title` | `txt_title(string s)` | `string` | 每个单词首个字节大写、其余小写；**单词 = 连续的 ASCII 字母/数字**，其余都是分隔符。因此 `"abc3def"` 为 `"Abc3def"`（与 Python `str.title` 的 `"Abc3Def"` 不同），`"it's"` 为 `"It'S"` |
| `txt_word_count` | `txt_word_count(string s)` | `int` | 空白分隔的单词个数；连续空白算一个，忽略首尾，全空白为 0；空白 = 空格 / `\t` / `\n` / `\r`，非 ASCII 字节算词内字节 |
| `txt_swap_case` | `txt_swap_case(string s)` | `string` | ASCII 大小写互换（`a`↔`A`），非 ASCII 字节原样保留；`""` 返回 `""` |

内部辅助函数（`txt_case_range` / `txt_match_at` / `txt_is_alpha_byte` / `txt_is_alnum_byte` / `txt_is_space_byte` / `txt_lower_byte`）不是公开 API，后续版本可能调整。

::: warning 堆与输入规模
字符串拼接与 `substr` 都新建堆块且不回收，`txt_reverse` / `txt_swap_case` / `txt_title` 逐段重建结果串，n 字节约需 O(n²) 字节堆。默认 64 KiB 内存下，**多段交替文本建议单次调用输入不超过 ~90 字节**（单一连续段可以更长），超长串请分块调用或加 `--mem-size`，否则会 `Stack overflow (collides with heap)`。
:::

```c
import "text.cin"

function main() -> int {
    string raw = "  The quick brown fox  "
    string t = trim(raw)                                     // "The quick brown fox"
    println(txt_reverse("Code CIN"))                         // NIC edoC
    println(txt_replace(t, "quick", "slow"))                 // The slow brown fox
    println(txt_replace_first("banana", "na", "NA"))         // baNAna
    println(txt_remove("a-b-c", "-"))                        // abc
    println(int_to_str(txt_index_from(t, "brown", 0)))       // 10
    println(int_to_str(txt_last_index_of("banana", "na")))   // 4
    println(txt_slice(t, 4, 9))                              // quick
    println(txt_insert("CIN", 0, "Code "))                   // Code CIN
    println(txt_delete_range("Code CIN", 4, 4))              // Code
    println(txt_capitalize("hELLO wORLD"))                   // Hello world
    println(txt_title("tHE qUICK brown fox"))                // The Quick Brown Fox
    println(txt_swap_case("Hello, World!"))                  // hELLO, wORLD!
    println(int_to_str(txt_word_count(t)))                   // 4
    if (txt_equals_ignore_case("CIN", "cin") == 1) { println("case-insensitive equal") }
    if (txt_startswith_ignore_case("CodeCIN", "code") == 1) { println("prefix ok") }
    if (txt_is_empty("") == 1) { println("empty") }
    return 0
}
```

## time

时间工具库。依赖内建 `time()` 取当前 Unix 时间戳（秒）。字符串化依赖 `int_to_str` / `idiv`。

```c
import "time.cin"
```

| 函数名 | 签名 | 返回值 | 说明与边界行为 |
| --- | --- | --- | --- |
| `t_now` | `t_now()` | `int` | 当前 Unix 时间戳（秒），转调内建 `time()` |
| `t_two` | `t_two(int v)` | `string` | 两位左补零；负数先取绝对值，`>= 100` 时原样输出（不截断） |
| `t_hms` | `t_hms(int secs)` | `string` | 秒 → `"HH:MM:SS"`；负数按绝对值处理，小时不封顶（`>= 100` 时输出三位） |
| `t_ms` | `t_ms(int secs)` | `string` | 秒 → `"MM:SS"`；负数按绝对值处理，分钟不封顶 |
| `t_breakdown` | `t_breakdown(int secs, int[] out)` | `void` | 拆解为天/时/分/秒写入 4 元素数组 `out[0..3]`；负秒按绝对值处理 |
| `t_human` | `t_human(int secs)` | `string` | 人性化时长 `"1d 2h 3m 4s"`，**省略为 0 的高位单位**（`t_human(5)` 为 `"5s"`，`t_human(90061)` 为 `"1d 1h 1m 1s"`） |

```c
import "time.cin"

function main() -> int {
    println(t_hms(3661))              // 01:01:01
    println(t_ms(125))                // 02:05
    println(t_human(90061))           // 1d 1h 1m 1s
    println(t_human(5))               // 5s
    int parts[4]
    t_breakdown(90061, parts)
    println(int_to_str(parts[0]))     // 1 (天)
    println(t_two(7))                 // 07
    if (t_now() <= 0) { return 1 }    // 时间戳应为正
    return 0
}
```

## token

纯 CIN 切分/分词库。CIN 没有字符串数组类型，所以本库不返回数组，而是提供「按序号取第 n 个 token」的 API：计数、取内容、取长度、查序号、取首/尾 token，以及按空白切分的便捷封装。只依赖非宿主内建（`strlen` / `substr` / `strcmp`），`--no-native` 下同样可用；因为拿不到字符串数组，本库**不提供 join**。

切分语义（与 Go `strings.Split` 一致）：`delim` 按**整串**匹配（多字符分隔符算一个整体，不是字符集合）；**保留空 token** —— 连续分隔符之间、串首/串尾分隔符旁边都会产生空 token；空串切分后是 1 个空 token；`delim` 为空串时整个串是唯一 token。下标与长度一律是**字节**语义（与 `strlen` / `substr` / `s[i]` 一致），非 ASCII 按 UTF-8 字节序列处理，分隔符请用完整字符。

```c
import "token.cin"
```

| 函数名 | 签名 | 返回值 | 说明与边界行为 |
| --- | --- | --- | --- |
| `tok_count` | `tok_count(string s, string delim)` | `int` | token 个数，**保留空 token**：`tok_count("a,,b", ",")` 为 3、`tok_count(",a,", ",")` 为 3、`tok_count(",", ",")` 为 2、`tok_count("", ",")` 为 1；`delim` 为空串时固定返回 1 |
| `tok_get` | `tok_get(string s, string delim, int idx)` | `string` | 第 `idx` 个 token（新堆块）；`idx` 越界或为负返回 `""`（空 token 也返回 `""`）；`delim` 为空串时只有 `idx == 0` 有效，返回整个 `s` |
| `tok_len` | `tok_len(string s, string delim, int idx)` | `int` | 第 `idx` 个 token 的字节长度（不分配堆块）；越界或为负返回 `-1`（空 token 返回 0）；`delim` 为空串时只有 `idx == 0` 有效，返回 `strlen(s)` |
| `tok_find` | `tok_find(string s, string delim, string t)` | `int` | 第一个内容与 `t` 逐字节相同（**区分大小写**）的 token 序号；未找到 `-1`；空 token 可以被 `t = ""` 命中 |
| `tok_first` | `tok_first(string s, string delim)` | `string` | 第一个 token，等价 `tok_get(s, delim, 0)`；空串或 `delim` 为空串时返回整个 `s` |
| `tok_last` | `tok_last(string s, string delim)` | `string` | 最后一个 token（可能是空 token，如 `tok_last("a,b,", ",")` 为 `""`）；空串返回 `""`；`delim` 为空串时返回整个 `s` |
| `tok_word_count` | `tok_word_count(string s)` | `int` | 空白分隔的单词个数；连续空白算一个分隔符，忽略首尾空白，全空白/空串为 0；空白 = 空格 / `\t` / `\n` / `\r` |
| `tok_word_get` | `tok_word_get(string s, int idx)` | `string` | 第 `idx` 个空白分隔单词（新堆块）；**连续空白算一个分隔**、忽略首尾空白、不产生空词；`idx` 越界或为负返回 `""` |

内部辅助函数（`tok_match_at` / `tok_is_space_byte`）不是公开 API，后续版本可能调整。

```c
import "token.cin"

function main() -> int {
    string csv = "ann,42,bob,7,"
    println(int_to_str(tok_count(csv, ",")))          // 5 (保留末尾空 token)
    println(tok_get(csv, ",", 3))                     // 7
    println(int_to_str(tok_len(csv, ",", 4)))         // 0
    println(int_to_str(tok_find(csv, ",", "bob")))    // 2
    println(tok_first(csv, ","))                      // ann
    println(tok_last(csv, ",") + "|")                 // | (末尾是空 token)
    println(tok_get(csv, ",", 9) + "|")               // | (越界返回空串)

    string line = "  one   two  three "
    println(int_to_str(tok_word_count(line)))         // 3
    println(tok_word_get(line, 1))                    // two
    return 0
}
```

## tree

定长二叉搜索树库。纯 CIN 实现，**不做动态内存分配**：节点存放在库内全局数组
（`tree_key[64]` / `tree_left[64]` / `tree_right[64]`）里，容量上限 **`TREE_CAP = 64`**，
因此同一程序内只有一份全局实例，需要多棵树请用 `struct` 自行封装。
不支持删除节点，所以节点一旦分配就始终有效，已有节点恰好是下标 `0..tree_size()-1`；
拒绝重复键，树中不含重复键。遍历结果为空格分隔的字符串，空树时为空串 `""`。

```c
import "tree.cin"
```

| 函数名 | 签名 | 返回值 | 说明与边界行为 |
| --- | --- | --- | --- |
| `tree_capacity` | `tree_capacity()` | `int` | 固定返回 `64`（`TREE_CAP`） |
| `tree_reset` | `tree_reset()` | `void` | 重置为空树（根下标与节点计数归零） |
| `tree_clear` | `tree_clear()` | `void` | 清空，等价于 `tree_reset()` |
| `tree_size` | `tree_size()` | `int` | 当前节点个数；空树为 `0` |
| `tree_is_empty` | `tree_is_empty()` | `int` | `1` 为空树，否则 `0` |
| `tree_insert` | `tree_insert(int k)` | `int` | 插入键 `k`；成功返回 1，**键已存在或已达容量 64 时返回 0**（不修改树） |
| `tree_contains` | `tree_contains(int k)` | `int` | 是否含键 `k`，`1`/`0`；空树返回 `0` |
| `tree_min` | `tree_min()` | `int` | 最小键；**空树返回 0** |
| `tree_max` | `tree_max()` | `int` | 最大键；**空树返回 0** |
| `tree_height` | `tree_height()` | `int` | 高度，按**节点数**计（空树 `0`，只有根 `1`，退化成链时为 `tree_size()`） |
| `tree_count_leaves` | `tree_count_leaves()` | `int` | 叶子（无左子且无右子）个数；空树返回 `0` |
| `tree_inorder_str` | `tree_inorder_str()` | `string` | 中序遍历（即升序键序列），空格分隔；空树返回 `""` |
| `tree_preorder_str` | `tree_preorder_str()` | `string` | 前序遍历（根-左-右），空格分隔；空树返回 `""` |
| `tree_postorder_str` | `tree_postorder_str()` | `string` | 后序遍历（左-右-根），空格分隔；空树返回 `""` |
| `tree_new_node` | `tree_new_node(int k)` | `int` | 内部辅助：分配一个叶子节点，返回新下标；**满时返回 -1**，非稳定接口 |

```c
import "tree.cin"

function main() -> int {
    tree_reset()
    tree_insert(50)
    tree_insert(30)
    tree_insert(70)
    tree_insert(20)
    tree_insert(40)
    tree_insert(60)
    tree_insert(80)
    println("size = " + int_to_str(tree_size()))              // 7
    println("min/max = " + int_to_str(tree_min()) + " " + int_to_str(tree_max()))   // 20 80
    println("height = " + int_to_str(tree_height()))          // 3
    println("leaves = " + int_to_str(tree_count_leaves()))    // 4
    println("inorder = " + tree_inorder_str())                // 20 30 40 50 60 70 80
    println("preorder = " + tree_preorder_str())              // 50 30 20 40 70 60 80
    println("postorder = " + tree_postorder_str())            // 20 40 30 60 80 70 50
    println("contains 40 = " + int_to_str(tree_contains(40))) // 1
    println("contains 41 = " + int_to_str(tree_contains(41))) // 0
    println("dup insert 40 = " + int_to_str(tree_insert(40))) // 0 (重复键被拒绝)
    tree_clear()
    println("after clear: size = " + int_to_str(tree_size())
            + " min = " + int_to_str(tree_min())
            + " height = " + int_to_str(tree_height()))
    return 0
}
```

## unionfind

并查集（不相交集合）库。纯 CIN 实现，**不做动态内存分配**：状态存放在库内全局数组
（`uf_parent[64]` / `uf_rank_arr[64]` / `uf_sz[64]`）里，容量上限 **`UF_CAP = 64`**，
因此同一程序内只有一份全局实例，需要多个并查集请用 `struct` 自行封装。
合并策略是**按秩合并 + 路径压缩**，单次操作近似 O(α(n))。
元素编号为 `0..uf_n-1`；调用 `uf_reset(n)` 之前 `uf_n = 0`，此时所有编号都是非法的。
越界编号是“非法元素”：`uf_find` / `uf_rank` 返回 `-1`，`uf_size` 返回 `0`，
`uf_connected` / `uf_union` 只要有一个非法就返回 `0`。

```c
import "unionfind.cin"
```

| 函数名 | 签名 | 返回值 | 说明与边界行为 |
| --- | --- | --- | --- |
| `uf_capacity` | `uf_capacity()` | `int` | 固定返回 `64`（`UF_CAP`） |
| `uf_reset` | `uf_reset(int n)` | `void` | 初始化 `0..n-1`，每个元素自成一个集合；**`n <= 0` 钳制为 `0`，`n > 64` 钳制为 `64`** |
| `uf_count` | `uf_count()` | `int` | 当前连通分量个数；未初始化时为 `0` |
| `uf_find` | `uf_find(int x)` | `int` | `x` 所在集合的代表元（带路径压缩）；**`x` 越界返回 `-1`** |
| `uf_size` | `uf_size(int x)` | `int` | `x` 所在集合的元素个数；**`x` 越界返回 `0`** |
| `uf_rank` | `uf_rank(int x)` | `int` | `x` 所在集合的秩（合并启发式用）；**`x` 越界返回 `-1`**，合法根节点的秩可以是 `0` |
| `uf_connected` | `uf_connected(int a, int b)` | `int` | `a`、`b` 是否属于同一集合，`1`/`0`；**任一编号越界返回 `0`** |
| `uf_union` | `uf_union(int a, int b)` | `int` | 合并 `a`、`b` 所在集合；**真正合并返回 1，已在同一集合返回 0，任一编号越界返回 0** |

```c
import "unionfind.cin"

function main() -> int {
    uf_reset(6)
    println("count = " + int_to_str(uf_count()))                    // 6
    uf_union(0, 1)
    uf_union(1, 2)
    uf_union(3, 4)
    println("connected 0,2 = " + int_to_str(uf_connected(0, 2)))    // 1
    println("connected 0,3 = " + int_to_str(uf_connected(0, 3)))    // 0
    println("count = " + int_to_str(uf_count()))                    // 3
    println("size of 2 = " + int_to_str(uf_size(2)))                // 3
    println("rank of 0 = " + int_to_str(uf_rank(0)))                // 1
    println("union 2,4 = " + int_to_str(uf_union(2, 4)))            // 1
    println("count = " + int_to_str(uf_count()))                    // 2
    println("union 2,4 again = " + int_to_str(uf_union(2, 4)))      // 0 (已同集合)
    println("find 9 = " + int_to_str(uf_find(9)))                   // -1 (越界编号)
    return 0
}
```

## validate

字符/字符串校验库。与 `codecin/lib/str.cin` 互补：`str.cin` 做变换（大小写/包含/重复），
本库做**判定与安全解析**（字符类别、整数字符串、标识符、限幅、带 fallback 的解析）。

```c
import "validate.cin"
```

| 函数名 | 签名 | 返回值 | 说明与边界行为 |
| --- | --- | --- | --- |
| `val_is_digit` | `val_is_digit(int c)` | `int` | 是否 `0-9`；参数是**字符的字节值**，如 `'7'` 或 `s[i]` |
| `val_is_upper` | `val_is_upper(int c)` | `int` | 是否 `A-Z` |
| `val_is_lower` | `val_is_lower(int c)` | `int` | 是否 `a-z` |
| `val_is_alpha` | `val_is_alpha(int c)` | `int` | 是否字母（大小写任一） |
| `val_is_alnum` | `val_is_alnum(int c)` | `int` | 是否字母或数字；下划线 `_` **不算** |
| `val_is_hex` | `val_is_hex(int c)` | `int` | 是否十六进制数字符（`0-9` `a-f` `A-F`） |
| `val_is_space` | `val_is_space(int c)` | `int` | 是否空白：空格、`\t`、`\n`、`\r` |
| `val_is_int` | `val_is_int(string s)` | `int` | 整数字符串：可选 `+`/`-`（后面必须至少有一位数字），其余全是数字；空串、`"+"`、`"4a"` 均为 0 |
| `val_is_float` | `val_is_float(string s)` | `int` | 浮点字符串：可选符号 + 数字 + 至多一个小数点，**至少一位数字**；`"."`、`"1.2.3"` 为 0；不校验指数形式 |
| `val_is_ident` | `val_is_ident(string s)` | `int` | 标识符：`[A-Za-z_][A-Za-z0-9_]*` |
| `val_count_char` | `val_count_char(string s, int c)` | `int` | 字符 `c` 在 `s` 中出现的次数（同样传字节值） |
| `val_is_blank` | `val_is_blank(string s)` | `int` | 整个串是否全为空白（含空串为 1） |
| `val_clamp_int` | `val_clamp_int(int v, int lo, int hi)` | `int` | 限幅到 `[lo, hi]`；`lo > hi` 时原样返回 `v`（与 `i_clamp` 的取舍不同） |
| `val_parse_int` | `val_parse_int(string s, int fallback)` | `int` | 安全解析：`val_is_int` 不通过时返回 `fallback`，否则 `atoi(s)` |
| `val_is_hex_color` | `val_is_hex_color(string s)` | `int` | 是否 3 位或 6 位十六进制颜色，可带 `#`：`"#ABC"` / `"A1B2C3"` 通过，`"#AB"` / `"#XYZ"` 不通过 |

```c
import "validate.cin"

function main() -> int {
    println(int_to_str(val_is_digit('7')))          // 1
    println(int_to_str(val_is_int("-42")))          // 1
    println(int_to_str(val_is_int("4a")))           // 0
    println(int_to_str(val_is_float("3.14")))       // 1
    println(int_to_str(val_is_float("1.2.3")))      // 0
    println(int_to_str(val_is_ident("_x1")))        // 1
    println(int_to_str(val_parse_int("x", -1)))     // -1
    println(int_to_str(val_clamp_int(15, 0, 10)))   // 10
    println(int_to_str(val_is_hex_color("#A1B2C3")))// 1
    return 0
}
```

## vec

浮点向量与统计库。与 `codecin/lib/stat.cin`（整数顺序统计）互补；`v_var` / `v_std` 是
**样本**方差与样本标准差（除以 `n-1`），`v_normalize` 是原地操作。

```c
import "vec.cin"
```

| 函数名 | 签名 | 返回值 | 说明与边界行为 |
| --- | --- | --- | --- |
| `v_sum` | `v_sum(float[] a, int n)` | `float` | 求和；`n <= 0` 返回 `0.0` |
| `v_mean` | `v_mean(float[] a, int n)` | `float` | 均值；`n <= 0` 返回 `0.0` |
| `v_var` | `v_var(float[] a, int n)` | `float` | **样本**方差（除以 `n-1`）；`n <= 1` 返回 `0.0` |
| `v_std` | `v_std(float[] a, int n)` | `float` | 样本标准差 `sqrt(v_var(a, n))` |
| `v_dot` | `v_dot(float[] a, float[] b, int n)` | `float` | 点积；两个数组都按前 `n` 个元素访问 |
| `v_min` | `v_min(float[] a, int n)` | `float` | 最小值；`n <= 0` 返回 `0.0` |
| `v_max` | `v_max(float[] a, int n)` | `float` | 最大值；`n <= 0` 返回 `0.0` |
| `v_add` | `v_add(float[] a, float[] b, float[] dst, int n)` | `void` | 逐元素相加写入 `dst` |
| `v_scale` | `v_scale(float[] a, float k, float[] dst, int n)` | `void` | 逐元素乘标量写入 `dst`；标量参数是 `float` |
| `v_normalize` | `v_normalize(float[] a, int n)` | `void` | **原地**按 min/max 归一化到 `[0, 1]`；`span == 0` 时全置 `0.0`；`n <= 0` 直接返回 |
| `v_norm` | `v_norm(float[] a, int n)` | `float` | 欧几里得范数 `sqrt(v_dot(a, a, n))` |
| `v_lerp` | `v_lerp(float a, float b, float t)` | `float` | 线性插值 `a + (b - a) * t`；`t` 不限制在 `[0,1]`（可外插） |

```c
import "vec.cin"

function main() -> int {
    float v[5] = {2.0, 4.0, 4.0, 4.0, 6.0}
    println(float_to_str(v_sum(v, 5)))    // 20
    println(float_to_str(v_mean(v, 5)))   // 4
    println(float_to_str(v_dot(v, v, 5))) // 88
    println(float_to_str(v_norm(v, 5)))   // 9.38083151964686 (sqrt(88))
    println(float_to_str(v_lerp(0.0, 10.0, 0.25)))  // 2.5
    v_normalize(v, 5)
    println(float_to_str(v[0]))           // 0
    println(float_to_str(v[4]))           // 1
    return 0
}
```

## 相关页面

- 标准库总览、前缀约定与宿主能力依赖：[/stdlib/](/stdlib/)
- 模块解析规则与自建模块：[/language/modules](/language/modules)
- 内建函数完整清单：[/language/builtins](/language/builtins)
- 宿主能力与平台可用性：[/language/host-abilities](/language/host-abilities)
- 数组与字符串语义：[/language/arrays](/language/arrays)、[/language/strings](/language/strings)
