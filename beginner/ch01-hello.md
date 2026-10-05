---
description: "第 1 章：安装 Code CIN、写出并运行第一个 CIN 程序，看懂日志、输出与错误面板。"
---

# 第 1 章 环境与第一个程序

::: info 本章目标
装好环境 → 写出 `hello.cin` → 运行并看懂输出 → 知道出错时该看哪里。
预计 15 分钟, 不需要任何编程基础。
:::

## 1.1 安装

打开终端 (Windows 用 **PowerShell**, macOS/Linux 用 **终端**), 输入:

```bash
pip install codecin
```

安装完成后验证:

```bash
codecin --version
```

```text
Code CIN x.y.z
```

如果提示 `codecin: command not found`, 可以用等价的另一种调用方式:

```bash
python -m codecin.cli --version
```

::: warning 安装时看到编译日志是正常的
安装过程会尝试用你机器上的 **Go 工具链**现场编译原生加速库。看到编译输出不代表出错;
机器上没有 Go 就会跳过, 程序依然能跑, 只是慢一点。
:::

## 1.2 第一个程序

新建一个文件夹 (例如 `cin-learn`), 在里面创建文件 `hello.cin`:

```c
function main() -> int {
    println("Hello, Code CIN!")
    return 0
}
```

逐行解释:

| 代码 | 含义 |
|------|------|
| `function main() -> int {` | 定义一个名为 `main` 的**函数**, `-> int` 表示它返回一个整数; `{` 开始函数体 |
| `println("Hello, Code CIN!")` | 调用内建函数 `println`, 把括号里的内容打印到屏幕并换行 |
| `return 0` | 返回整数 `0` 给操作系统, 习惯上用 `0` 表示“正常结束” |
| `}` | 函数体结束 |

在终端里进入这个文件夹, 然后运行:

```bash
codecin hello.cin
```

你会看到类似这样的输出:

```text
08:37:15 INFO     CIN compiled: 30 instructions
         INFO     Starting program execution
Hello, Code CIN!
         INFO     HALT instruction executed
         INFO     Program execution finished
```

其中 `Hello, Code CIN!` 是**你的程序**打印的, 带 `INFO` 的行是**运行日志**。
两者默认都写到终端。

::: tip 只想看程序输出
加 `--log-level ERROR` 就能过滤掉日志:

```bash
codecin hello.cin --log-level ERROR
```

```text
Hello, Code CIN!
```
:::

## 1.3 让程序做点算术

把 `hello.cin` 改成:

```c
function main() -> int {
    println("2 + 3 = " + (2 + 3))
    println("10 / 4 = " + (10 / 4))
    println("Hello" + " " + "CIN")
    return 0
}
```

运行:

```bash
codecin hello.cin --log-level ERROR
```

```text
2 + 3 = 5
10 / 4 = 2.5
Hello CIN
```

三个要点:

1. `+` 在两边都是数字时是**加法**, 只要有**字符串**参与就变成**拼接**
   (`"2 + 3 = " + 5` 会把数字变成文本再拼起来);
2. `10 / 4` 得到 `2.5` —— CIN 的 `/` 永远是**浮点除法** (第 3 章细讲);
3. `println` 会自动换行; 不想换行用 `print`。

## 1.4 注释与代码可读性

```c
// 这是单行注释, 从 // 到行尾都会被忽略

/* 这是块注释
   可以写多行 */

function main() -> int {
    // 注释用来解释“为什么”, 而不是复述代码
    println("readable")     // 行尾注释也可以
    return 0
}
```

输出:

```text
readable
```

::: tip 好的注释习惯
写“为什么这样做”, 而不是“这行在做什么”。例如
`int q = idiv(total, count)   // 用整数商, 避免浮点误差` 比
`// 除法` 有用得多。
:::

## 1.5 出错了怎么办

故意制造一个错误 —— 把 `println` 拼错成 `printline`:

```c
function main() -> int {
    printline("oops")
    return 0
}
```

```bash
codecin hello.cin
```

Code CIN 会打印一个**红色错误面板**, 里面有关键信息:

```text
┌──────────────────────── Load Error ────────────────────────┐
│ hello.cin:2: Compiler error: Unknown function: printline    │
└────────────────────────────────────────────────────────────┘
```

读法: **文件名 : 行号** + 错误类型 + 具体原因。

- `Load Error` / `Compiler error` → 程序还没开始运行, 是**写错了**;
- `Execution Error` → 程序运行到一半出事 (例如除零、越界);
- 退出码 (在终端里输入 `echo $LASTEXITCODE` 或 `echo $?` 可看) `0` 成功、`1` 失败、
  `2` 命令行参数写错。

::: tip 记住这个流程
看到错误 → 找到 `文件:行号` → 看错误类型判断是“编译期”还是“运行期” → 对照
[常见错误速查](/language/errors) 修改。第 12 章会系统讲调试。
:::

## 1.6 程序的骨架

CIN 程序从**文件第一条语句**开始按顺序执行; 全局变量先初始化, 然后执行
`main` 里的代码。所以最简单的完整程序就是上面那个样子。约定:

```c
// 1) import (可选, 必须放在文件最上面)
import "math.cin"

// 2) 全局变量与 struct 定义 (可选)

// 3) 函数定义 (顺序随意, 可以互相调用)

function main() -> int {
    // 4) 程序真正开始执行的地方
    return 0
}
```

::: info 为什么 `return 0` 可以省略?
`main` 的返回类型写 `-> int` 时最好显式 `return 0`; 如果写 `function main() { ... }`
(没有 `-> int`), 表示不返回任何值, 程序正常跑到末尾就结束。
:::

## 1.7 完整的“第一次运行”清单

```bash
# 1) 确认版本
codecin --version

# 2) 运行程序 (只看程序输出)
codecin hello.cin --log-level ERROR

# 3) 查看完整帮助 (所有命令行选项)
codecin --help

# 4) 出问题想看得更细: 打开调试日志 (第 12 章详解排错)
codecin hello.cin --log-level DEBUG
```

## 1.8 练习

1. 修改 `hello.cin`, 打印你的名字和今天的日期 (日期可以用字符串直接写)。
2. 打印三行内容: 第一行问候语, 第二行 `1 + 1 = 2`, 第三行空行。
3. 故意把 `return 0` 写成 `returnn 0`, 观察报错面板, 说出是哪一行、什么类型。
4. 把 `println` 换成 `print`, 观察输出有什么不同 (提示: 看换行位置)。

参考实现见 [习题与答案 · 第 1 章](/beginner/exercises#第-1-章)。

## 1.9 本章小结

- 安装: `pip install codecin`, 验证 `codecin --version`;
- 运行: `codecin 文件名.cin`, 加 `--log-level ERROR` 只看程序输出;
- 程序骨架: `function main() -> int { ... return 0 }`;
- `println` 打印并换行, `print` 不换行, `+` 兼具加法与字符串拼接;
- 报错面板给 `文件:行号` + 错误类型, 先看这两样。

下一章: [变量、类型与输入输出](/beginner/ch02-variables)。
