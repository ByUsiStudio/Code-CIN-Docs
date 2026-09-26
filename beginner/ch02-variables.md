---
description: "第 2 章：CIN 的变量、基础类型、类型转换、字符串拼接、浮点打印真相与读取输入的正确姿势。"
---

# 第 2 章 变量、类型与输入输出

::: info 本章目标
学会用变量保存数据、认出四种基础类型、理解类型转换与浮点打印、知道 `input()` 的现状。
本章结束后你能写出“温度换算”“秒转时分秒”这类小工具。
:::

## 2.1 变量: 给数据起名字

**变量**是一个带名字的盒子, 里面放着数据。使用前必须先**声明类型**:

```c
int age = 18            // 声明一个整数变量 age, 初值 18
println("age = " + age)

age = 19                // 改变它的值 (注意: 第二次写不用再写 int)
println("age = " + age)
```

```text
age = 18
age = 19
```

要点:

- 第一次出现要写类型 (`int age`), 之后再赋值就只写名字 (`age = 19`);
- 语句以**换行**结尾; 分号可写可不写, 一行写两条语句时必须用 `;` 分隔;
- 变量名区分大小写, 只能由字母、数字、下划线组成, 且不能以数字开头。

```c
int score1 = 90         // 合法
int _tmp = 1            // 合法
// int 1score = 90      // 非法: 不能以数字开头
```

## 2.2 四种基础类型

| 类型 | 存什么 | 默认值 | 例子 |
|------|--------|--------|------|
| `int` | 整数 (64 位) | `0` | `int n = 42` |
| `float` | 小数 (64 位浮点) | `0.0` | `float pi = 3.14159` |
| `bool` | 真 / 假 | `false` | `bool ok = true` |
| `string` | 文本 (NUL 结尾的字节串) | **必须显式写成 `""`** | `string s = "hello"` |

还有几个“同义类型名”: `char` / `short` / `long` / `unsigned int` 等, 在 CIN 里
**和 `int` 一样是 64 位整数**, 只是写法习惯不同:

```c
char letter = 'A'               // 字符字面量其实是整数编码
long big = 4000000000
unsigned int mask = 0xFFFF
println("letter=" + letter)     // letter=65
println("big=" + big)           // big=4000000000
println("mask=" + mask)         // mask=65535
```

```text
letter=65
big=4000000000
mask=65535
```

::: tip 为什么 `'A'` 打印出 65
CIN 里字符就是整数: `'A'` 等于 65。想打印字符本身, 得用字符串 `"A"`。
:::

`int` / `float` / `bool` 未初始化时会得到确定的默认值; **`string` 例外, 一定要自己写 `""`**:

```c
function main() -> int {
    int i
    float f
    bool b
    string s = ""                    // 必须显式初始化
    println("int    = " + i)
    println("float  = " + f)
    println("bool   = " + b)
    println("string = [" + s + "]")
    return 0
}
```

```text
int    = 0
float  = 0
bool   = false
string = []
```

::: danger 未初始化的 `string` 不是空串
实测 (5.5.0): 只写 `string s` 而不赋初值, 它里面是**未清零的指针**, 可能指向相邻的字符串
字面量, 打印出来是别的文本或乱码:

```c
function main() -> int {
    println("prefix line")
    string s                 // 没有初始化
    println("[" + s + "]")   // 实测输出: [prefix line]
    return 0
}
```

**规则: 声明字符串时就写 `string s = ""`。**
:::

## 2.3 浮点数的“真相”: 打印出来可能很长

CIN 打印浮点时使用**最短往返表示**: 能精确表达就短, 不能精确就长。

```c
function main() -> int {
    float a = 7
    float b = 7.5
    float c = 1.0 / 3.0
    println("a = " + a)
    println("b = " + b)
    println("c = " + c)
    return 0
}
```

```text
a = 7
b = 7.5
c = 0.3333333333333333
```

- `7.0` 会打印成 `7` (没有小数点), 这是正常的;
- `1.0 / 3.0` 是**无限循环小数**, 只能存近似值, 所以打印出一长串;
- 想只显示两位小数, 可以乘 100 取整再自己拼小数点 (第 3 章有例子),
  或者用 `codecin/lib/conv.cin` 里的格式化函数。

::: warning 浮点数不要用 `==` 比较
`0.1 + 0.2` 在计算机里不等于 `0.3`。比较浮点时判断差值:

```c
float x = 0.1 + 0.2
if (abs(x - 0.3) < 0.000001) {
    println("基本相等")
}
```
:::

## 2.4 类型转换

CIN 的转换规则很少, 记住三条:

1. **整数 → 浮点**: 自动 (参与浮点运算时也会自动提升);
2. **浮点 → 整数**: 赋给 `int` 变量时**截断** (直接丢掉小数部分, 不是四舍五入);
3. **字符串 ↔ 数字**: 用内建函数显式转换。

```c
function main() -> int {
    int i = 3.9
    println("i = " + i)                  // 截断, 不是 4

    float f = 7
    println("f = " + f)                  // 自动提升

    int n = atoi(" 42 ")                 // 字符串 -> 整数 (忽略前导空白)
    string s = int_to_str(1234)          // 整数 -> 字符串
    string t = float_to_str(2.5)         // 浮点 -> 字符串
    string u = bool_to_str(true)         // 布尔 -> 字符串
    println("n = " + n + ", s = " + s + ", t = " + t + ", u = " + u)
    return 0
}
```

```text
i = 3
f = 7
n = 42, s = 1234, t = 2.5, u = true
```

::: tip 想四舍五入?
用 `round(x)` (返回浮点), 或 `int i = floor(x + 0.5)`。见
[内建函数](/language/builtins)。
:::

## 2.5 字符串: 拼接与自动字符串化

`+` 只要有一边是字符串, 就会把另一边变成文本再拼起来:

```c
function main() -> int {
    string name = "CIN"
    int year = 2026
    float pi = 3.14159
    println("你好, " + name + "!")
    println("今年是 " + year + " 年")
    println("圆周率约等于 " + pi)
    println("判断结果: " + (year > 2000))
    return 0
}
```

```text
你好, CIN!
今年是 2026 年
圆周率约等于 3.14159
判断结果: true
```

::: warning 括号很重要
`"sum = " + 1 + 2` 会先把 `"sum = "` 和 `1` 拼成字符串, 再和 `2` 拼, 得到
`sum = 12`; 想得到 `sum = 3` 要写 `"sum = " + (1 + 2)`。
:::

## 2.6 布尔值与条件真值

`bool` 只有 `true` / `false`, 比较运算的结果就是 bool:

```c
function main() -> int {
    bool adult = 18 >= 18
    bool empty = ""
    println("adult = " + adult)
    println("empty = " + empty)
    if (adult) {
        println("已成年")
    }
    return 0
}
```

```text
adult = true
empty = false
```

在数值环境里 `true` 当 `1`、`false` 当 `0`; 反过来, 数字 `0` 为假、非 `0` 为真。

## 2.7 “常量”: 用大写命名表达意图

CIN 目前没有 `const` 关键字。惯例是**全大写命名**并集中写在文件顶部,
让读代码的人知道“这个值不应该被改”:

```c
float PI = 3.14159265
int MAX_SCORE = 100
int DAYS_PER_WEEK = 7
```

## 2.8 读取用户输入 (重要: 当前版本现状)

::: danger 5.5.0 的 `input()` 不读键盘: 它恒定返回 0
内建 `input()` 在当前版本被编译成常量 `0` (实现见 `codecin/cin.py` 与
`codecin/native/compiler/codegen.go` 中的 `input` 分支, 仓库
`docs/SUGGESTIONS_NEXT.md` §1.4 也记录了该问题)。因此:

```c
int n = input()          // 永远是 0, 无论你输入什么
```

**不要**用它做交互式输入。下面是当前可用的三种替代方案。
:::

### 方案 A: 要交互式读整数, 用汇编的 `IN` 指令

`IN` 指令会真的从标准输入读一行整数。写一个只有几行的汇编程序:

```asm
.text
main:
    in x0            ; 从键盘读一个整数到 x0
    out x0           ; 打印这个整数
    out #10          ; 换行
    halt
```

运行 (先输入 `42` 再回车, 或管道送入):

```bash
codecin read_int.asm
```

```text
42
```

> 汇编语法见 [汇编语法参考](/asm/syntax); `IN`/`OUT` 属于 Base ISA 指令
> ([指令语义参考](/asm/instructions))。

### 方案 B: 把数据写进文件, 程序读文件

适合“批处理”式的小工具, 需要原生运行时 (默认路径即可):

```c
function main() -> int {
    string text = file_read("numbers.txt")   // 文件内容: 42
    int n = atoi(text)
    println("读到的数字: " + n + ", 两倍: " + (n * 2))
    return 0
}
```

```text
读到的数字: 42, 两倍: 84
```

详见 [第 11 章](/beginner/ch11-io-host)。

### 方案 C: 用小工具/练习题常用的“固定输入”

学习阶段的大多数练习不需要真的读键盘: 直接给变量一个值, 或把值写进源码顶部,
调试时改一下就行。本教程后面的例子都采用这种方式。

## 2.9 三个小例子

### 例 1: 摄氏温度换算成华氏温度

公式: `F = C × 9 / 5 + 32`

```c
function main() -> int {
    float c = 37.5                     // 摄氏温度
    float f = c * 9 / 5 + 32           // 华氏温度
    println(c + " 摄氏度 = " + f + " 华氏度")
    return 0
}
```

```text
37.5 摄氏度 = 99.5 华氏度
```

### 例 2: 圆的面积

```c
function main() -> int {
    float PI = 3.14159265
    float r = 2.5
    float area = PI * r * r
    println("半径 " + r + " 的圆面积 = " + area)
    return 0
}
```

```text
半径 2.5 的圆面积 = 19.6349540625
```

### 例 3: 秒数转“时分秒”

```c
function main() -> int {
    int total = 3725                   // 一共 3725 秒
    int h = idiv(total, 3600)          // 小时 (整数除法)
    int m = idiv(total % 3600, 60)     // 分钟
    int s = total % 60                 // 秒
    println(total + " 秒 = " + h + " 小时 " + m + " 分 " + s + " 秒")
    return 0
}
```

```text
3725 秒 = 1 小时 2 分 5 秒
```

::: tip 记住 `idiv` 和 `%`
`idiv(a, b)` 是**整数除法** (只要商), `a % b` 是**余数**。
像上面这样拆时间、拆金额、算位数都靠这两个。
:::

## 2.10 常见错误

| 报错 / 现象 | 原因 | 解决 |
|-------------|------|------|
| `Undefined variable: x` | 变量没声明, 或声明在使用之后 | 先声明再使用 |
| `Type mismatch ...` | 把字符串赋给 `int` 之类 | 用 `atoi` / `int_to_str` 转换 |
| 打印出 `0.3333333333333333` | 浮点精度 | 需要几位就自己截断/格式化 |
| `input()` 总是 0 | 当前版本的已知限制 | 用 `IN` 汇编或读文件 (见 2.8) |
| 结果和手算差 1 | 用了 `/` 而不是 `idiv` | 整数运算改用 `idiv` |

## 2.11 练习

1. 声明三个变量保存你的年龄、身高 (米, 小数)、姓名, 并打印成一句话。
2. 把一个总分钟数 (例如 1450) 换算成“X 天 X 小时 X 分”。
3. 已知商品单价 `12.5` 和数量 `7`, 计算总价并打印 `总价 = 87.5`。
4. 声明 `float a = 1.0 / 3.0`, 打印 `a` 与 `a * 3`; 观察 `a * 3` 是不是 `1`。
5. 用一个未初始化的 `int` 和 `string` 打印, 确认它们的默认值。

参考实现见 [习题与答案 · 第 2 章](/beginner/exercises#第-2-章)。

## 2.12 本章小结

- 四种基础类型: `int` / `float` / `bool` / `string`, 未初始化有确定默认值;
- 浮点打印是最短往返表示, `7.0` 显示为 `7`; 浮点不要用 `==` 比较;
- 转换: 整数→浮点自动, 浮点→整数截断, 字符串↔数字用内建函数;
- `+` 有字符串参与就是拼接, 注意加括号;
- `input()` 在 5.5.0 恒为 0 (已知问题), 交互输入用汇编 `IN` 或读文件。

下一章: [运算符与表达式](/beginner/ch03-expressions)。
