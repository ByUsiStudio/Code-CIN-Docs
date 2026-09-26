---
description: "第 6 章：CIN 函数——定义、参数、返回值、void、作用域、递归、多值返回与栈深限制。"
---

# 第 6 章 函数与递归

::: info 本章目标
把代码拆成可复用的“积木”。学会定义与调用函数、传参、返回结果、写递归,
并知道 CIN 函数的一个限制 (只能返回一个值) 与绕开办法。
:::

## 6.1 为什么要函数

把“做一件事”的代码装进函数, 好处是: 一处修改处处生效、逻辑有名字、主程序更短更清楚。
我们已经在用函数了 —— `main` 就是程序的主函数, `println` 是内建函数。

## 6.2 定义与调用

```c
// 定义: function 名字(参数列表) -> 返回类型 { ... }
function add(int a, int b) -> int {
    return a + b
}

function main() -> int {
    int x = add(3, 4)                 // 调用, 结果 7
    println("3 + 4 = " + x)
    println("add(10, 20) = " + add(10, 20))
    return 0
}
```

```text
3 + 4 = 7
add(10, 20) = 30
```

要点:

- 参数要写**类型和名字**, 用逗号分隔 (`int a, int b`);
- `-> int` 是返回类型; `return 表达式` 把结果交给调用者;
- 调用时按**位置**传参, 个数和类型要对上;
- 函数**可以先调用后定义** (编译器会先扫一遍全文件), 所以顺序随意。

::: tip 函数调用可以直接出现在表达式里
`"add(10, 20) = " + add(10, 20)` 会先算出 `add(10, 20)` 的结果 (30), 再拼成字符串。
函数调用、内建函数、数组下标都可以嵌在表达式中间。
:::

## 6.3 没有返回值: void

```c
function print_info(string name, int age) -> void {
    println(name + " 今年 " + age + " 岁")
}

function main() -> int {
    print_info("小明", 18)
    print_info("小红", 20)
    return 0
}
```

```text
小明 今年 18 岁
小红 今年 20 岁
```

`-> void` 表示“没有返回值”, 这种函数靠**副作用**干活 (打印、修改传入的数组等)。
`-> void` 也可以整个省略: `function print_info(string name, int age) { ... }`。

## 6.4 作用域: 局部变量、全局变量与遮蔽

```c
int counter = 0                 // 全局变量, 所有函数都能读写

function bump() -> void {
    counter++                   // 直接修改全局变量
}

function main() -> int {
    bump()
    bump()
    println("counter = " + counter)

    int x = 1
    if (true) {
        int inner = 99          // 内层用**不同的名字**
        println("inner = " + inner)
    }
    println("x = " + x)
    return 0
}
```

```text
counter = 2
inner = 99
x = 1
```

::: danger 内层不要重复声明同名变量 (实测行为)
CIN 目前**没有真正的块级遮蔽**: 在内层块里再写一次 `int x = 99`, 它和外面的 `x`
用的是**同一个存储位置**, 内层赋值会把外层也改掉:

```c
function main() -> int {
    int x = 1
    if (true) {
        int x = 99          // 看起来是"新的 x", 实际不是
    }
    println("x = " + x)     // 实测输出: x = 99  (不是 1!)
    return 0
}
```

**规则: 内层块里换一个变量名。**
:::

::: tip 少用全局变量
全局变量让“谁改了它”变得难以追踪。优先用**参数传入、返回值传出**;
确需全局状态时 (例如计数器、配置) 起一个醒目的名字。
:::

## 6.5 递归: 函数调用自己

递归 = 把大问题拆成“同样的小问题 + 一个出口”。两个必须有的东西:

1. **出口 (基准情形)**: 什么时候直接返回, 不再递归;
2. **递推**: 把问题变小一点再调用自己。

### 阶乘

```c
function factorial(int n) -> int {
    if (n <= 1) {
        return 1                    // 出口
    }
    return n * factorial(n - 1)     // 递推
}

function main() -> int {
    println("5! = " + factorial(5))
    println("10! = " + factorial(10))
    return 0
}
```

```text
5! = 120
10! = 3628800
```

### 斐波那契

```c
function fib(int n) -> int {
    if (n < 2) {
        return n                    // fib(0)=0, fib(1)=1
    }
    return fib(n - 1) + fib(n - 2)
}

function main() -> int {
    println("fib(10) = " + fib(10))
    return 0
}
```

```text
fib(10) = 55
```

::: warning 递归不是免费的
每层调用都要占用栈空间 (默认内存 64 KiB, 大约 1000 个栈槽)。
`factorial(10000)` 这类深递归会报
`Stack overflow (collides with heap)`。两条出路:

```bash
codecin prog.cin --mem-size 262144      # 把内存扩到 256 KiB
```

或者把递归改写成循环 (累加/递推), 空间占用恒定:

```c
function fib_loop(int n) -> int {
    int a = 0
    int b = 1
    for (int i = 0; i < n; i++) {
        int t = a + b
        a = b
        b = t
    }
    return a
}
```
:::

## 6.6 一个函数只能返回一个值 (以及怎么办)

CIN 的返回值通过一个寄存器 (`X0`) 传回, 所以**一次只能返回一个值**。
需要“一次算出两个结果”时, 把结果写进调用方给的数组:

```c
// 求商和余数: 结果写进 out2[0] / out2[1]
function divmod(int a, int b, int[] out2) -> void {
    out2[0] = idiv(a, b)
    out2[1] = a - idiv(a, b) * b
}

function main() -> int {
    int r[2]
    divmod(38, 7, r)
    println("38 ÷ 7 = " + r[0] + " 余 " + r[1])
    return 0
}
```

```text
38 ÷ 7 = 5 余 3
```

数组与 struct 传参是**引用语义** (函数里改, 外面看得到), 这是 CIN 里“传出多个值”的标准做法。

## 6.7 写出好函数的三条建议

| 建议 | 说明 |
|------|------|
| 一个函数只做一件事 | `read_config` 与 `print_report` 分开, 而不是一个巨型 `do_all` |
| 名字说清楚做什么 | `calc_average` 比 `calc` 好; 避免 `f1` `f2` |
| 参数尽量少 | 超过 5 个参数时考虑用 struct 打包 (见 [第 9 章](/beginner/ch09-structs)) |

内建库的命名前缀也值得借鉴: `f_` (浮点) / `i_` (整数) / `s_` (字符串) / `a_` (数组)。

## 6.8 常见错误

| 报错 / 现象 | 原因 | 解决 |
|-------------|------|------|
| `Unknown function: xxx` | 名字拼错, 或用了未定义的函数 | 检查拼写与定义 |
| `Type mismatch` | 参数类型/个数不对 | 对照函数定义 |
| 忘记 `return` 导致结果怪 | 有返回类型的函数没写 `return` | 每条路径都要 `return` |
| `Stack overflow` | 递归太深 / 没有出口 | 加出口、用循环改写、`--mem-size` |
| 函数里改了参数但外面没变 | 那是普通类型 (int/float) 的值传递 | 需要传出就用数组/struct |

## 6.9 练习

1. 写 `function is_even(int n) -> bool`, 判断偶数。
2. 写 `function max_of_three(int a, int b, int c) -> int`。
3. 写 `function power(int base, int exp) -> int`, 用循环实现 (`power(2, 10)` 得 1024)。
4. 写递归版 `gcd(int a, int b)` (欧几里得算法: `gcd(a, b) = gcd(b, a % b)`)。
5. 写 `function sum_to(int n) -> int` 返回 `1+2+...+n`, 分别用循环和递归实现。

参考实现见 [习题与答案 · 第 6 章](/beginner/exercises#第-6-章)。

## 6.10 本章小结

- `function 名(参数) -> 返回类型 { ... }`, 无返回值写 `-> void` 或省略;
- 参数按值传递; 数组与 struct 传参是引用语义 (可用来“传出”多个结果);
- 递归必须有出口; 深递归会栈溢出, 可 `--mem-size` 扩容或改循环;
- 函数可以先调用后定义; 局部变量遮蔽外层同名变量;
- 一个函数只做一件事, 名字要能读懂。

下一章: [数组](/beginner/ch07-arrays)。
