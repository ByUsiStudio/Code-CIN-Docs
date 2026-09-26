---
description: "第 4 章：CIN 条件分支——if / else if / else、组合条件、嵌套、switch/case 的贯穿语义与常见错误。"
---

# 第 4 章 条件分支

::: info 本章目标
让程序“会判断”: 满足条件走这条路, 否则走另一条。学会 `if` / `else if` / `else`
和 `switch`, 并写出成绩评级、闰年判断这类程序。
:::

## 4.1 最简单的 if

语法: `if (条件) { 条件为真时执行 }`

```c
function main() -> int {
    int age = 20
    if (age >= 18) {
        println("已成年")
    }
    println("程序结束")
    return 0
}
```

```text
已成年
程序结束
```

条件必须写在**圆括号**里, 代码块用**花括号**; 条件为假时整块跳过, 继续往下走。

## 4.2 else 与 else if

```c
function main() -> int {
    int score = 87
    string grade = "F"          // 先给默认值, 再用分支改写
    if (score >= 90) {
        grade = "A"
    } else if (score >= 80) {
        grade = "B"
    } else if (score >= 70) {
        grade = "C"
    } else if (score >= 60) {
        grade = "D"
    }
    println("分数 " + score + " -> 等级 " + grade)
    return 0
}
```

```text
分数 87 -> 等级 B
```

::: tip 顺序决定结果
`else if` 是**从上往下**依次检查, 第一个成立的分支执行后, 后面全部跳过。
所以判断区间时要把**范围小的写在前面** (例如先 `>= 90` 再 `>= 80`)。
:::

## 4.3 单语句可以省略花括号

```c
function main() -> int {
    int x = 5
    if (x > 0) println("正数")
    if (x == 0) println("零")
    if (x < 0) println("负数")
    return 0
}
```

```text
正数
```

::: warning 建议还是写花括号
省略花括号时只能带**一条**语句; 以后加第二行就会掉到 `if` 外面, 引发难查的 bug。
:::

## 4.4 条件里的组合与嵌套

```c
function main() -> int {
    int age = 20
    bool has_ticket = true

    if (age >= 18 && has_ticket) {
        println("可以入场")
    } else {
        println("不能入场")
    }

    int score = 95
    if (score >= 60) {
        if (score >= 90) {
            println("优秀")
        } else {
            println("及格")
        }
    } else {
        println("需要补考")
    }
    return 0
}
```

```text
可以入场
优秀
```

`&&` (并且) / `||` (或者) / `!` (取反) 可以自由组合, 用括号让意图更清楚:

```c
if ((a > 0 || b > 0) && !done) { ... }
```

## 4.5 switch: 多分支选择

当判断的是“**某个整数等于几**”时, `switch` 比一串 `else if` 更清晰:

```c
function main() -> int {
    int day = 3
    switch (day) {
        case 1: println("周一"); break
        case 2: println("周二"); break
        case 3:
        case 4: println("周中"); break
        case 6:
        case 7: println("周末"); break
        default: println("周五或其他")
    }
    return 0
}
```

```text
周中
```

规则 (务必记住):

- `case` 后面必须是**整数常量** (可以写 `case 'A'`, `case 2+3`);
- 分支执行完**不会自动跳出**, 会继续往下执行下一个 `case` 的代码 —— 这叫**贯穿**
  (fallthrough, 与 C 一样); 需要跳出就写 `break`;
- 利用贯穿可以让多个 `case` 共用一段代码 (`case 3:` 后面什么都不写);
- `default` 在所有 `case` 都不匹配时执行, 位置随意; 没有匹配又没有 `default` 就整段跳过;
- `switch` 内部的 `break` 只跳出 `switch`, 不影响外层循环。

::: danger 最常见的 bug: 忘了 break
```c
switch (n) {
    case 1: println("一")      // 忘了 break
    case 2: println("二"); break
}
```
当 `n == 1` 时会打印“一”**和**“二”。
:::

## 4.6 例子: 闰年判断

闰年规则: 能被 4 整除, 但被 100 整除时不算, 除非也能被 400 整除。

```c
function main() -> int {
    int year = 2024
    bool leap = false
    if (year % 400 == 0) {
        leap = true
    } else if (year % 100 == 0) {
        leap = false
    } else if (year % 4 == 0) {
        leap = true
    }
    println(year + " 是闰年? " + leap)
    return 0
}
```

```text
2024 是闰年? true
```

想验证别的年份, 把 `year` 改成 `1900` / `2000` / `2023` 再跑一次即可。

## 4.7 三目运算符 (一行 if-else)

当“两种取值”很短时, 三目更紧凑:

```c
function main() -> int {
    int n = 7
    println(n + (n % 2 == 0 ? " 是偶数" : " 是奇数"))
    int a = 3
    int b = 9
    println("较大的数是 " + (a > b ? a : b))
    return 0
}
```

```text
7 是奇数
较大的数是 9
```

## 4.8 常见错误

| 现象 | 原因 | 解决 |
|------|------|------|
| 打印了多个分支的内容 | `switch` 少了 `break` | 每个分支末尾加 `break` |
| 判断“区间”时结果不对 | `else if` 顺序反了 | 小范围放前面 |
| 浮点比较偶尔不成立 | 用 `==` 比较浮点 | 比较差值 `< 0.000001` |
| 字符串比较结果乱 | 用 `==` 比较字符串 | 用 `strcmp(a, b) == 0` |
| 加了第二行代码后行为变了 | `if` 没写花括号 | 始终写 `{}` |
| 条件里使用了未声明变量 | 变量声明在使用之后 | 先声明 |

## 4.9 练习

1. 给定 `int score = 58`, 打印“及格”或“不及格”。
2. 给定三个整数, 打印其中最大的一个 (用 `if` 或 `max()` 都可以, 各写一遍)。
3. 用 `switch` 把 1–12 的月份打印成“春/夏/秋/冬”四个季节。
4. 判断一个年份是否是闰年, 并同时打印它是不是“世纪年” (能被 100 整除)。
5. 给定 `int hour = 9`, 打印“上午/下午/晚上/凌晨” (自己定义区间)。

参考实现见 [习题与答案 · 第 4 章](/beginner/exercises#第-4-章)。

## 4.10 本章小结

- `if (条件) { ... } else if (条件) { ... } else { ... }`, 从上往下第一个成立的分支生效;
- 单语句可省花括号, 但建议始终写;
- 判断整数等于几用 `switch`, **注意贯穿**: 不写 `break` 会往下执行;
- 组合条件用 `&&` `||` `!`, 注意短路特性;
- 三目 `条件 ? A : B` 适合短小的二选一。

下一章: [循环](/beginner/ch05-loops)。
