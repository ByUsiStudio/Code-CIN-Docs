---
description: "第 12 章：CIN 调试与排错——读懂错误面板、打印法、--debug 逐指令、--step 单步、--bounds-check 与排错实战。"
---

# 第 12 章 调试与排错

::: info 本章目标
程序不听话时的四件武器: 打印法、逐指令追踪、单步调试、边界检查。
学完你能独立定位“结果不对”“程序崩溃”“跑不完”这三类问题。
:::

## 12.1 先学会读错误

Code CIN 的错误面板一定包含**位置**和**原因**:

```text
┌──────────────────────── Load Error ────────────────────────┐
│ hello.cin:2: Compiler error: Unknown function: printline    │
└────────────────────────────────────────────────────────────┘
```

| 面板标题 | 出现时机 | 含义 |
|----------|----------|------|
| `Load Error` | 加载阶段 | 编译/汇编失败 —— 代码写错了, 程序还没跑 |
| `Execution Error` | 运行阶段 | 运行到某条指令出错 (除零、越界、宿主能力缺失…) |
| `Disasm Error` | `--disasm` | 反汇编输入不是合法字节码 |
| `Build Error` | `--build-exe` | AOT 构建失败 (多为缺 Go 工具链) |

退出码: `0` 成功, `1` 运行/构建失败, `2` 命令行参数写错。

::: tip 最快的定位方式
把 `文件:行号` 当作“第一现场”, 先看那一行**上一行/这一行**有没有:
少写 `break`、`i <= n`、字符串用 `==`、忘记 `import`。
:::

## 12.2 武器一: 打印法 (最有效也最常用)

在关键位置打印变量, 看它和你以为的是否一致:

```c
function average(int[] a, int n) -> float {
    int sum = 0
    for (int i = 0; i < n; i++) {
        sum += a[i]
        println("  [调试] i=" + i + " a[i]=" + a[i] + " sum=" + sum)
    }
    return sum / n
}
```

```text
  [调试] i=0 a[i]=80 sum=80
  [调试] i=1 a[i]=90 sum=170
  [调试] i=2 a[i]=70 sum=240
  ...
```

看完记得删掉这些行, 或者用下面的 `--debug` 代替。

## 12.3 武器二: `--debug` 逐指令追踪

`--debug` 会把**每条指令**的执行情况都打出来 (还有 CPU 初始化 dump、内存读写等):

```bash
codecin hello.cin --no-native --debug
```

```text
DEBUG               CPU 初始化
                    memory    0x10000 bytes
                    cache     64 lines x 4-way
                    sp_init   0xfff8
                    heap_base 0x8000
                    native    False
                    jit       False
                    log_level DEBUG
DEBUG    CIN tokenize: 30 tokens
DEBUG    CIN parse: 0 structs, 0 globals, 1 functions (main)
DEBUG    CIN codegen total: 30 instructions, 26 data bytes, 1 labels, 2 data writes
DEBUG    PC=0x0000 #00000000 CALL main->0x2  SP=0xfff8
DEBUG      MEM WR    @0xfff0 w=8 value=0x1
DEBUG      PUSH @0xfff0 <- 0x0000000000000001
DEBUG      => pc=0x0002 N=0 Z=0 C=0 V=0
```

读法:

| 字段 | 含义 |
|------|------|
| `PC=0x0000` | 当前指令地址 (程序计数器) |
| `#00000000` | 全局第几条指令 (从 0 开始计数) |
| `CALL main->0x2` | 指令与操作数 (这条是“调用 main, 跳转到 0x2”) |
| `SP=0xfff8` | 栈指针 |
| `=> pc=… N=0 Z=0 C=0 V=0` | 执行后的新 PC 与 N/Z/C/V 标志位 |

程序崩溃时, **最后一条 `PC=…` 就是案发现场**。

::: warning `--debug` 会显著变慢
逐指令追踪开销很大, 而且 `--debug` 与 `--jit` 互斥 (调试需要逐条解释执行)。
性能问题请用 `--profile`, 不要用 `--debug` 的数字下结论。
:::

## 12.4 武器三: `--step` 交互式单步

```bash
codecin prog.cin --no-native --step
```

程序会停在每条指令前, 显示状态并等待你输入命令:

| 命令 | 作用 |
|------|------|
| 直接回车 或 `s` / `step` | 执行下一条指令 |
| `c` / `continue` / `r` / `run` | 一直运行到结束或断点 |
| `b <地址>` | 设置断点 (例如 `b 16`) |
| `d <地址>` | 删除断点 |
| `p <目标>` | 打印: `p regs`、`p X0`、`p mem 0x100`、`p cache` |
| `list` / `l` | 列出断点 |
| `help` / `?` | 显示帮助 |
| `q` / `quit` | 退出 |

::: tip 更省事的做法
日常排错优先用“打印法 + `--bounds-check`”; 需要看清寄存器/内存时再用 `--step`。
远程/IDE 集成用 `--debug-server <端口>` (换行文本协议), 见
[远程调试协议](/tools/remote-debug)。
:::

## 12.5 武器四: 三个“体检开关”

| 开关 | 用途 | 例子 |
|------|------|------|
| `--bounds-check` | 数组越界检查 | `codecin prog.cin --no-native --bounds-check` |
| `--max-instructions N` | 限制指令数, 抓死循环 | `codecin prog.cin --max-instructions 100000` |
| `--mem-size BYTES` | 加大内存 (深递归 / 大数组) | `codecin prog.cin --mem-size 262144` |

## 12.6 排错实战: “结果看起来对, 但就是不对”

下面这段代码想求 5 个分数的总分:

```c
function main() -> int {
    int scores[5] = {80, 90, 70, 60, 100}
    int sum = 0
    for (int i = 0; i <= 5; i++) {      // 可疑!
        sum += scores[i]
    }
    println("总分 = " + sum)
    return 0
}
```

直接运行:

```bash
codecin prog.cin --no-native --log-level ERROR
```

```text
总分 = 400
```

看起来“对” (400 确实是这 5 个数之和), 但循环其实多跑了一轮 —— `i <= 5` 会读到
`scores[5]`, 那已经越界了, 这次恰好读到 0 才没暴露。打开边界检查:

```bash
codecin prog.cin --no-native --bounds-check
```

```text
09:57:34 ERROR    Execution error: Runtime abort: bounds-check: index >= length (5)
+---------------- Execution Error -----------------+
| Runtime abort: bounds-check: index >= length (5) |
+--------------------------------------------------+
```

**案发**: 下标 5 越界 (数组长度 5, 合法下标 0–4)。修好: 把 `i <= 5` 改成 `i < 5`。

::: warning `--bounds-check` 也有看不到的地方
当数组以 `int[] a` **指针形式**传给函数时, 运行时不知道它的长度, 越界检查无法生效:

```c
function average(int[] a, int n) -> float {   // a 只带地址, 不带长度
    int sum = 0
    for (int i = 0; i <= n; i++) {            // 这里越界, --bounds-check 抓不到
        sum += a[i]
    }
    return sum / n;
}
```

**结论**: 传数组时**必须自己保证 `n` 正确**, 循环条件写 `i < n`。
:::

## 12.7 已知限制与规避 (重点)

下面这些是**实测确认**的行为。它们不是你的错, 但会让你“代码看着对、结果不对”,
所以务必先读一遍。

### 语言特性相关的坑

| # | 你写的代码 | 实际行为 | 规避办法 |
|---|-----------|----------|----------|
| 1 | `string s` (未初始化) | 指向相邻字面量, 打印出别人的文本 | 写 `string s = ""` |
| 2 | 内层块重新声明同名变量 | 与外墙共用存储, 内层赋值改到外层 | 内层换名字 |
| 3 | `Student cls[3]` (struct 数组) | 元素字段互相覆盖, 全变成最后一次写入的值 | 改用并行数组 |
| 4 | `r.a.x` (嵌套 struct 字段) | 多层字段访问互相覆盖 | 用扁平字段或多个独立 struct 变量 |
| 5 | 函数内 `int m[2][3] = { {1,2,3}, {4,5,6} }` | 元素没有被写入 (读到 0/垃圾) | 循环填充, 或放全局用字面量, 或压成一维 `flat[i*cols+j]` |
| 6 | `import "math.cin"  // 注释` | 编译失败 `Expected IDENT but got STRING` | 注释另起一行 |
| 7 | 未初始化的 struct 字符串字段 | 不是空串 | 声明后立刻赋值 |

::: tip 还有个普遍的规律
数组按 `int[] a` (指针形式) 传给函数时**不携带长度**, `--bounds-check` 也管不到 ——
`n` 必须由你保证正确。
:::

### 三条执行路径的已知差异

同一程序在 Go 原生 / JIT / 纯 Python 下应当给出相同结果, 但下面几种情况**确实不同**:

| 情况 | 表现 | 建议 |
|------|------|------|
| `sqrt(-1)` 等非法定义域 | Go 原生得 `NaN`; 纯 Python 报 `Execution Error` 并退出 1 | 调用前自己判断取值范围 |
| 超越函数末位 | Python 与 Go 的数学库可能差 1 ulp | 需要精确比较时用容差 |
| 时间/路径类输出 | `time()` / `cwd()` 等随环境变化 | 测试时固定种子 (`--seed`) |

::: warning 排查这类问题的通用手法
1. `codecin prog.cin --no-native --log-level ERROR` 与不加 `--no-native` **各跑一次**,
   对比输出是否一致;
2. 不一致时, 优先怀疑上面两个表格里的条目;
3. 用最小复现: 把可疑的几行单独抄到一个新文件里跑。
:::

## 12.8 常见错误速查

| 报错 | 原因 | 解决 |
|------|------|------|
| `Unknown function: xxx` | 函数名拼错 / 忘记 `import` | 检查名字与 import |
| `Undefined variable: xxx` | 未声明或声明在使用后 | 先声明 |
| `Type mismatch ...` | 类型不兼容 | 显式转换 |
| `Float modulo not supported` | 对浮点用 `%` | 先取整 |
| `Bitwise operator ... requires integer operands` | 对浮点/字符串用位运算 | 只用整数 |
| `Expected RBRACE ... at line N` | 花括号不配对 / 块内缺换行 | 检查第 N 行附近 |
| `Import file not found` | 模块名错 / 缺 `"./"` | 见 [第 10 章](/beginner/ch10-modules) |
| `Stack overflow (collides with heap)` | 递归太深 / 局部大数组 | `--mem-size` 或改循环 |
| `Runtime abort: bounds-check: ...` | 数组越界 | 检查循环条件 |
| `host builtins ... require the native Go runtime` | `--no-native` 下调用宿主能力 | 去掉 `--no-native` |
| `Unknown instruction: jle` (汇编) | 本 ISA 没有该指令 | 见 [指令语义参考](/asm/instructions) |

更多见 [限制与常见错误](/language/errors) 与 [FAQ](/guide/faq)。

## 12.9 提问的正确姿势

遇到问题时, 把这些信息一次说清楚, 别人能立刻帮你定位:

````text
1. 我想做什么: 求数组中最大的数
2. 我的代码:   (贴最小可复现的那几行)
3. 我运行的命令: codecin prog.cin --no-native --debug
4. 实际结果:   输出 0 / 报错面板 (贴完整面板文本)
5. 期望结果:   应该输出 100
6. 我的环境:   Code CIN 版本 (见 `codecin --version`), Windows 11, Python 3.12
````

先自己缩小范围: 把代码删到“还能重现问题”的最小版本, 往往在删的过程中就发现问题了。

## 12.10 练习

1. 下面这段代码为什么死循环? 用 `--max-instructions` 验证, 然后修好:

   ```c
   function main() -> int {
       int i = 0
       while (i < 5) {
           println("i = " + i)
       }
       return 0
   }
   ```

2. 写一个程序, 故意访问 `a[10]` (数组长度 5), 用 `--bounds-check` 看报错信息。
3. 用 `--debug` 运行 `hello.cin`, 找到 `CALL main` 那条 trace, 说出它跳到了哪个地址。
4. 用 `--step` 运行一个 3 行的小程序, 每一步 `p regs` 看寄存器变化。
5. 写一个程序制造 `Stack overflow` (例如无限递归), 再用 `--mem-size` 观察结果变化。

参考与解析见 [习题与答案 · 第 12 章](/beginner/exercises#第-12-章)。

## 12.11 本章小结

- 错误面板 = `文件:行号` + 错误类型; 退出码 `0`/`1`/`2`;
- 打印法最快; `--debug` 看逐指令与寄存器; `--step` 交互单步;
- `--bounds-check` 抓数组越界 (但指针形式数组抓不到, 必须自己保证 `n`);
- `--max-instructions` 抓死循环, `--mem-size` 解决栈/堆不足;
- 知道 `input()`、`sqrt(负数)` 等少数路径差异, 主动规避;
- 提问要给: 目标、最小代码、命令、实际结果、期望结果、版本。

下一章: [综合实战项目](/beginner/projects)。
