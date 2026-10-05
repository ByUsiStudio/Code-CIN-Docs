---
description: "第 12 章：用日志与错误信息排错——读懂错误面板、打印法、--log-level DEBUG、常见运行时错误速查、--build-info 验证环境与 assert 的使用。"
---

# 第 12 章 调试与排错

::: info 本章目标
程序不听话时的四件武器: 读懂错误面板、打印法、日志开关、断言。
学完你能独立定位"结果不对""程序崩溃""跑不完"这三类问题。
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
| `Load Error` | 加载阶段 | 编译/汇编失败、程序文件不存在、原生库缺失 —— 代码或环境有问题, 程序还没跑 |
| `Execution Error` | 运行阶段 | 运行到某条指令出错 (除零、越界、栈溢出…) |
| `Disasm Error` | `--disasm` | 反汇编输入不是合法字节码 |
| `Build Error` | `--build-exe` | AOT 构建失败 (多为缺 Go 工具链) |

退出码: `0` 成功, `1` 运行/构建失败, `2` 命令行参数写错。

::: tip 最快的定位方式
把 `文件:行号` 当作"第一现场", 先看那一行**上一行/这一行**有没有:
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

看完记得删掉这些行, 或者用下面的 `assert` 代替 (见 12.6)。

## 12.3 武器二: 用 `--log-level` 控制日志

日志默认级别是 `INFO` (编译汇总 + 执行起止), 想安静就压到 `ERROR`, 想看细节就开 `DEBUG`:

```bash
# 只看程序输出 (脚本/重定向最常用)
codecin hello.cin --log-level ERROR

# 看编译、汇编与引擎执行的细节
codecin hello.cin --log-level DEBUG
```

| 级别 | 能看到什么 |
|------|-----------|
| `ERROR` | 只剩程序自己的输出与错误面板 |
| `INFO`（默认） | 编译汇总（指令数）、执行起止 |
| `DEBUG` | 编译/汇编细节、CPU 初始化快照（内存大小、栈顶、堆基址）、引擎执行结果（步数、耗时） |

DEBUG 输出里的 CPU 初始化快照长这样:

```text
DEBUG               CPU 初始化
                    memory    0x40000000 bytes (sparse)
                    sp_init   0x3ffffff8
                    heap_base 0x20000000
```

::: tip 落盘排查
日志和程序输出共用 stdout。想保留全部细节又不刷屏, 用
`codecin prog.cin --log-level ERROR --log-file logs/run.log` ——
落盘文件里仍会记录全量 DEBUG 内容。详见 [日志与错误输出](/tools/logging)。
:::

## 12.4 武器三: 认识常见的运行时错误

遇到报错先对号入座, 每一种都有明确的排查方向:

| 报错 | 常见原因 | 排查方向 |
|------|----------|----------|
| `Stack overflow: frame needs N bytes, stack headroom only M bytes ...` | 递归太深, 或单个函数的局部数组太大 | 减少递归深度 / 改循环；局部大数组改小, 或用 `--mem-size` 扩容 |
| `Stack overflow (collides with heap)` | 栈一路下探撞上了堆 | 同上 |
| `Address 0x... out of bounds ... (negative address: stack overflow or bad pointer?)` | 出现了"负地址" (地址 ≥ 2^63) —— 多半是栈被推绕回了, 或野指针 | 先查深递归与大局部数组; 再查未初始化的指针式数组 |
| `Heap exhausted: need N bytes, free M bytes (heap 0x...-0x...). Try --mem-size ...` | 堆分配 (字符串/对象) 撞上了栈 | 减少分配, 或 `--mem-size` 扩容 |
| `Runtime abort: bounds-check: index >= length (N)` | 数组下标越界 | 检查循环条件, 见 12.7 |
| `Division by zero` | 除数为 0 | 除之前判断 |

::: tip 默认内存已经很大
v5.9.0 起内存默认 **1 GiB（稀疏分页, 只占实际写入的物理内存）**, 大数组一般不用再手动 `--mem-size`。
真遇到栈/堆不够, 再加大: `codecin prog.cin --mem-size 2147483648`。
原理见 [内存模型与运行时开关](/tools/memory-cache)。
:::

## 12.5 武器四: 用 `--build-info` 验证环境

"在我电脑上是好的"类问题, 先确认环境本身没问题:

```bash
codecin --build-info
```

它会打印版本号、平台与原生库加载状态等环境信息。如果原生库缺失或版本不匹配,
运行程序会直接报 `Load Error` 并附**重建指引** (v5.9.0 起没有回退路径):

```text
powershell -ExecutionPolicy Bypass -File codecin\native\build.ps1   # Windows
sh codecin/native/build.sh                                          # Linux / macOS / Termux
```

详细步骤见 [编译 Go 原生库](/dev/build-native)。

## 12.6 assert: 让错误自己跳出来

`assert(条件 [, 消息])` 在条件不成立时立即中止程序, 并精确报告 `文件:行号`:

```c
function average(int[] a, int n) -> float {
    assert(n > 0, "average: n 必须为正")
    int sum = 0
    for (int i = 0; i < n; i++) {
        sum += a[i]
    }
    return sum / n
}
```

```text
09:57:34 ERROR    Execution error: Runtime abort: assertion failed: average: n 必须为正 (average.cin:2)
```

它比打印法省事: 平时零开销地"守"在关键位置, 出问题第一时间指出**谁**在**哪一行**违反了约定。
给函数参数加前置断言、给循环不变量加中途断言, 是初学者性价比最高的排错习惯。

## 12.7 排错实战: "结果看起来对, 但就是不对"

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
codecin prog.cin --log-level ERROR
```

```text
总分 = 400
```

看起来"对" (400 确实是这 5 个数之和), 但循环其实多跑了一轮 —— `i <= 5` 会读到
`scores[5]`, 那已经越界了, 这次恰好读到 0 才没暴露。打开边界检查:

```bash
codecin prog.cin --bounds-check
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

## 12.8 已知语言坑速查

下面这些是**实测确认**的语言行为。它们不是你的错, 但会让你"代码看着对、结果不对",
所以务必先读一遍。

| # | 你写的代码 | 实际行为 | 规避办法 |
|---|-----------|----------|----------|
| 1 | `string s` (未初始化) | 指向相邻字面量, 打印出别人的文本 | 写 `string s = ""` |
| 2 | 内层块重新声明同名变量 | 与外墙共用存储, 内层赋值改到外层 | 内层换名字 |
| 3 | `Student cls[3]` (struct 数组) | 元素字段互相覆盖, 全变成最后一次写入的值 | 改用并行数组 |
| 4 | `r.a.x` (嵌套 struct 字段) | 多层字段访问互相覆盖 | 用扁平字段或多个独立 struct 变量 |
| 5 | 函数内 `int m[2][3] = { {1,2,3}, {4,5,6} }` | 元素没有被写入 (读到 0/垃圾) | 循环填充, 或放全局用字面量, 或压成一维 `flat[i*cols+j]` |
| 6 | `import "math.cin"  // 注释` | 编译失败 `Expected IDENT but got STRING` | 注释另起一行 |
| 7 | 未初始化的 struct 字符串字段 | 不是空串 | 声明后立刻赋值 |
| 8 | `sqrt(-1)` 等非法定义域 | 返回 `NaN` | 调用前自己判断取值范围 |

::: tip 还有个普遍的规律
数组按 `int[] a` (指针形式) 传给函数时**不携带长度**, `--bounds-check` 也管不到 ——
`n` 必须由你保证正确。
:::

## 12.9 三个实用开关

| 开关 | 用途 | 例子 |
|------|------|------|
| `--bounds-check` | 数组越界检查 | `codecin prog.cin --bounds-check` |
| `--max-instructions N` | 限制指令数, 抓死循环 (用尽报错退出码 1) | `codecin prog.cin --max-instructions 100000` |
| `--mem-size BYTES` | 扩大内存 (深递归 / 大数组撞栈或堆) | `codecin prog.cin --mem-size 2147483648` |

## 12.10 提问的正确姿势

遇到问题时, 把这些信息一次说清楚, 别人能立刻帮你定位:

````text
1. 我想做什么: 求数组中最大的数
2. 我的代码:   (贴最小可复现的那几行)
3. 我运行的命令: codecin prog.cin --log-level DEBUG
4. 实际结果:   输出 0 / 报错面板 (贴完整面板文本)
5. 期望结果:   应该输出 100
6. 我的环境:   Code CIN 版本 (`codecin --version` 或 `codecin --build-info`), Windows 11
````

先自己缩小范围: 把代码删到"还能重现问题"的最小版本, 往往在删的过程中就发现问题了。

## 12.11 练习

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
3. 用 `--log-level DEBUG` 运行 `hello.cin`, 从 CPU 初始化快照里说出栈顶和堆基址的值。
4. 给 12.7 的 `average` 函数加上 `assert(n > 0)`, 再分别用 `n = 0` 和 `n = 5` 调用, 观察差异。
5. 写一个程序制造 `Stack overflow` (例如无限递归), 读一遍完整报错, 说出它建议你怎么做。

参考与解析见 [习题与答案 · 第 12 章](/beginner/exercises#第-12-章)。

## 12.12 本章小结

- 错误面板 = `文件:行号` + 错误类型; 退出码 `0`/`1`/`2`;
- 打印法最快; `--log-level DEBUG` 看编译与引擎细节, `--log-file` 落盘留档;
- 常见运行时错误 (栈溢出/堆耗尽/负地址越界) 都附带排查提示, 照着念就有方向;
- `--build-info` 先验证环境, 原生库缺失要重建;
- `assert` 让违反约定的代码在**第一现场**暴露;
- `--bounds-check` 抓数组越界 (但指针形式数组抓不到, 必须自己保证 `n`);
- `--max-instructions` 抓死循环, `--mem-size` 解决栈/堆不足;
- 提问要给: 目标、最小代码、命令、实际结果、期望结果、版本。

下一章: [综合实战项目](/beginner/projects)。
