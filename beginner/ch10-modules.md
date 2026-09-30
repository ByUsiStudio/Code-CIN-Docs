---
description: "第 10 章：CIN 模块与标准库——import 规则、把代码拆成多文件、20 个内置库的常用函数。"
---

# 第 10 章 模块与标准库

::: info 本章目标
学会把代码拆成多个文件 (模块), 并熟练使用内置标准库: 排序、数组统计、数学、随机、测试。
:::

## 10.1 为什么要把代码拆开

程序一大, 全塞在一个文件里会很难维护。CIN 用 `import` 把别的 `.cin` 文件“拼”进来:

- 每个文件负责一组相关函数;
- 主文件只保留 `main` 和流程;
- 模块可以再引用别的模块 (形成 DAG)。

## 10.2 import 的两条规则

`import` 必须写在**文件最上面** (函数外面)。解析规则只有两条:

| 你写的 | 去哪里找 |
|--------|----------|
| `import "./helpers.cin"` (以 `./` 或 `../` 开头) | **当前文件所在目录** (相对路径) |
| `import "math.cin"` (裸名字) | **内置标准库** `codecin/lib/` |

```c
import "math.cin"
import "str.cin"
import "./helpers.cin"
import "../shared/x.cin"
```

::: danger `import` 行不能写行尾注释
实测: `import "math.cin"   // 数学` 会直接编译失败:

```text
Compiler error: Expected IDENT but got STRING ('math.cin')
```

**规则: `import` 行只写 `import` 语句本身, 注释写在上一行或下一行。**
:::

::: tip 一句话记住
**想引用自己的文件就写 `"./"`, 不写前缀一律当内置库。**
`import "lib/math.cin"` 是历史写法, 等价于 `import "math.cin"`。
:::

## 10.3 第一个自建模块

新建两个文件, 放在**同一个目录**里。

`helpers.cin` (模块, 只有函数, 没有 `main`):

```c
// 通用小工具
function helper_double(int x) -> int {
    return x * 2
}

function helper_greet(string name) -> void {
    println("你好, " + name + "!")
}

function helper_max3(int a, int b, int c) -> int {
    int m = a
    if (b > m) { m = b }
    if (c > m) { m = c }
    return m
}
```

`main.cin` (主程序):

```c
import "./helpers.cin"

function main() -> int {
    helper_greet("CIN")
    println("double(21) = " + helper_double(21))
    println("max3 = " + helper_max3(3, 9, 5))
    return 0
}
```

运行 `main.cin`:

```bash
codecin main.cin --log-level ERROR
```

```text
你好, CIN!
double(21) = 42
max3 = 9
```

要点:

- 模块里**不要写 `main`**, 只放函数与全局变量;
- 同一个文件在一次编译中只会被包含一次 (写两次 `import` 也不会重复定义);
- **循环引用会报错** (A 引 B, B 又引 A) —— 把公共部分抽到第三个文件;
- 找不到文件会报 `Import file not found`。

## 10.4 内置标准库总览

20 个库随 pip 包一起安装, 直接 `import "名字.cin"` 就能用:

| 库 | 用途 | 常用函数 |
|----|------|----------|
| `math.cin` | 数学 | `f_abs` `f_floor` `f_ceil` `f_round` `f_min` `f_max` `i_min` `i_max` `i_clamp` |
| `str.cin` | 字符串 | `s_upper` `s_lower` `s_contains` `s_starts_with` `s_ends_with` `s_count` `s_repeat` |
| `array.cin` | 数组 | `a_sum` `a_max` `a_min` `a_avg` `a_find` `a_contains` `a_count` `a_reverse` `a_fill` `a_copy` |
| `sort.cin` | 排序查找 | `sort_bubble` `sort_quick` `sort_insertion` `sort_is_sorted` `bin_search` |
| `conv.cin` | 进制与格式化 | `c_to_hex` `c_parse_hex` `c_to_bin` `c_pad_int` `c_chr` `c_to_int` |
| `vec.cin` | 向量统计 | `v_sum` `v_mean` `v_std` `v_dot` `v_normalize` `v_lerp` |
| `stat.cin` | 统计 | `stat_mean` `stat_median_sorted` `stat_mode` `stat_variance_x1000` |
| `rand.cin` | 随机 | `r_range` `r_bool` `r_float` `r_shuffle` `r_choice` |
| `matrix.cin` | 矩阵 | `mat_zero` `mat_identity` `mat_mul` `mat_transpose` `mat_det` |
| `bits.cin` | 位运算 | `bits_popcount` `bits_set` `bits_clear` `bits_toggle` `bits_rotl` |
| `hash.cin` | 哈希 | `hash_djb2` `hash_fnv1a` `hash_string_bucket` |
| `validate.cin` | 输入校验 | `val_is_int` `val_is_digit` `val_is_alpha` `val_parse_int` |
| `json.cin` | 扁平 JSON | `j_int` `j_str` `j_float` `j_bool` `j_has` |
| `time.cin` | 时间 | `t_now` `t_hms` `t_human` |
| `test.cin` | 断言测试 | `t_eq_int` `t_eq_str` `t_true` `t_reset` `t_report` |
| `queue.cin` | 队列/栈 | `queue_push` `queue_pop` `stack_push` `stack_pop` |
| `io.cin` | 文件 (需原生) | `io_read` `io_write` `io_exists` `io_line_count` `io_get_line` |
| `gui.cin` | 画图 (需原生) | `g_new` `g_bar_chart` `g_line_chart` `g_save` |
| `termux.cin` | 安卓 Termux (需原生) | `tx_notify` `tx_toast` `tx_battery_level` |
| `key.cin` | 键盘轮询 (需原生) | `k_ctrl` `k_is_special` `key_wait` + `enum Key` 常量 |

::: warning 四个库需要 Go 原生运行时
`io` / `gui` / `termux` / `key` 封装的是宿主能力 (文件、绘图、安卓 API、键盘)。用 `--no-native`
运行时会报 `host builtins ... require the native Go runtime`。其余 16 个库是纯 CIN,
三条执行路径行为一致。
:::

完整函数签名见 [标准库参考](/stdlib/reference)。

## 10.5 用标准库写成绩分析

```c
import "math.cin"
import "array.cin"
import "sort.cin"

function main() -> int {
    int scores[6] = {88, 92, 79, 95, 67, 84}

    sort_bubble(scores, 6)                    // 原地升序
    println("最低分: " + scores[0])
    println("最高分: " + scores[5])

    int total = a_sum(scores, 6)
    println("总分: " + total)
    println("平均分: " + f_round(total / 6))
    println("已排序: " + (sort_is_sorted(scores, 6) == 1))
    return 0
}
```

```text
最低分: 67
最高分: 95
总分: 505
平均分: 84
已排序: true
```

对比一下: 如果不用标准库, 排序、求和、求最值都要自己写循环 (第 7 章)。
**库函数的第一个参数都是数组, 第二个参数是元素个数**——因为 CIN 数组不记录长度。

## 10.6 常用库速览

```c
import "str.cin"
import "conv.cin"
import "rand.cin"

function main() -> int {
    println(s_contains("banana", "nan"))         // 1 (包含)
    println(s_starts_with("readme.txt", "read")) // 1
    println(s_repeat("ab", 3))                   // ababab

    println(c_to_hex(255))                       // FF
    println(c_pad_int(7, 3))                     // 007

    srand(42)                                    // 固定随机种子
    println(r_range(1, 6))                       // 1..6 的随机整数
    return 0
}
```

> 上面这些函数的**确切返回值**与边界行为以
> [标准库参考](/stdlib/reference) 为准, 建议自己跑一遍看看输出。

## 10.7 命名约定: 避免冲突

模块里的函数名是全局的, 两个模块有同名函数就会冲突。内置库用前缀区分:

| 前缀 | 归属 |
|------|------|
| `f_` `i_` | math (浮点 / 整数) |
| `s_` | str |
| `a_` | array |
| `sort_` `bin_` | sort |
| `c_` | conv |
| `v_` | vec |
| `j_` | json |
| `t_` | time / test |
| `io_` `g_` `tx_` | io / gui / termux |

给自己的模块也加个前缀 (例如 `my_`、`game_`), 半年后回来看代码会感谢自己。

## 10.8 常见错误

| 报错 | 原因 | 解决 |
|------|------|------|
| `Import file not found` | 名字写错, 或自建模块忘了 `./` | 自建模块写 `import "./x.cin"` |
| 循环引用报错 | A 引 B, B 又引 A | 抽出公共模块 |
| `import` 写在函数里报错 | 位置不合法 | 移到文件顶部 |
| `Unknown function: s_upper` | 忘记 `import "str.cin"` | 补上 import |
| 两个模块函数重名 | 命名冲突 | 加前缀 |

## 10.9 练习

1. 建一个 `mytools.cin`, 写 `my_is_even(int n) -> bool` 与 `my_clamp(int v, int lo, int hi) -> int`,
   在 `main.cin` 里引用并验证。
2. 用 `array.cin` + `sort.cin` 求一个数组的中位数
   (提示: 先排序, 再取中间元素, 偶数个取两个的平均)。
3. 用 `rand.cin` 的 `r_range` 生成 10 个 1..100 的随机数, 排序后打印。
4. 用 `validate.cin` 的 `val_is_int` 判断 `"123"` 与 `"12a"` 是否是合法整数。
5. 用 `test.cin` 写 3 条断言 (`t_eq_int`) 测试你自己写的 `my_clamp`。

参考实现见 [习题与答案 · 第 10 章](/beginner/exercises#第-10-章)。

## 10.10 本章小结

- `import` 只能写在文件顶部; `"./x.cin"` 是相对路径, 裸名字是内置库;
- 模块里不写 `main`; 重复包含会去重, 循环引用报错;
- 内置库的数组函数都要传数组 + 长度; 20 个库覆盖数学、字符串、数组、排序、统计、随机、测试等;
- `io` / `gui` / `termux` / `key` 需要原生运行时;
- 给自己的函数加前缀避免冲突。

下一章: [文件、画布与系统交互](/beginner/ch11-io-host)。
