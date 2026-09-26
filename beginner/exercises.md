---
description: "CIN 初学者教程各章练习的参考实现与思路提示，代码均可直接运行。"
---

# 习题与答案

这里是 [初学者教程](/beginner/) 各章练习的**参考实现**。每章给出 2–3 道完整答案,
其余练习只给思路 —— 编程能力是靠敲出来的, 请先自己写, 卡住了再看。

::: tip 怎么用这份答案
1. 先自己写, 跑通;
2. 再对比答案, 重点看**思路**与**边界处理** (循环条件、默认值、错误分支);
3. 最后给答案加功能 (例如把固定输入改成读文件)。
:::

## 第 1 章

**练习 1**: 打印名字与日期。

```c
function main() -> int {
    println("姓名: 小明")
    println("日期: 2026-09-26")
    return 0
}
```

**练习 2**: 三行内容, 第二行是算式, 第三行是空行。

```c
function main() -> int {
    println("你好, CIN!")
    println("1 + 1 = " + (1 + 1))
    println("")
    return 0
}
```

**练习 3**: 把 `return 0` 写成 `returnn 0` 会看到 `Load Error` 面板, 位置指向那一行,
说明是**编译期**错误 (程序还没开始运行)。

## 第 2 章

**练习 1**: 三个变量一句话输出。

```c
function main() -> int {
    int age = 18
    float height = 1.75
    string name = "小明"
    println(name + " 今年 " + age + " 岁, 身高 " + height + " 米")
    return 0
}
```

**练习 2**: 分钟换算成“天/小时/分”。

```c
function main() -> int {
    int total = 1450
    int days = idiv(total, 1440)              // 1 天 = 1440 分钟
    int hours = idiv(total % 1440, 60)
    int mins = total % 60
    println(total + " 分钟 = " + days + " 天 " + hours + " 小时 " + mins + " 分")
    return 0
}
```

**练习 4**: 观察浮点误差。

```c
function main() -> int {
    float a = 1.0 / 3.0
    println("a = " + a)
    println("a * 3 = " + (a * 3))
    return 0
}
```

`a * 3` 打印出 `1`, 但中间的 `a` 是近似值 —— 这就是为什么浮点比较要用容差。

## 第 3 章

**练习 1**: 三种“除法”的区别。

```c
function main() -> int {
    println("17 / 5 = " + (17 / 5))            // 浮点除法
    println("idiv(17, 5) = " + idiv(17, 5))    // 整数商
    println("17 % 5 = " + (17 % 5))            // 余数
    return 0
}
```

**练习 2**: 89 分钟。

```c
function main() -> int {
    int total = 89
    println(idiv(total, 60) + " 小时 " + (total % 60) + " 分")
    return 0
}
```

**练习 3**: 判断偶数 (三目)。

```c
function main() -> int {
    int n = 7
    println(n + (n % 2 == 0 ? " 是偶数" : " 是奇数"))
    return 0
}
```

**练习 4**: 检查第 3 位。

```c
function main() -> int {
    int flags = 0b1010
    int bit = (flags & (1 << 3)) != 0 ? 1 : 0
    println("第 3 位 = " + bit)
    return 0
}
```

## 第 4 章

**练习 1**: 及格判断。

```c
function main() -> int {
    int score = 58
    if (score >= 60) {
        println("及格")
    } else {
        println("不及格")
    }
    return 0
}
```

**练习 2**: 三个数的最大值。

```c
function main() -> int {
    int a = 12
    int b = 45
    int c = 33

    int best = a
    if (b > best) { best = b }
    if (c > best) { best = c }
    println("最大: " + best)
    return 0
}
```

**练习 3**: 月份 → 季节。

```c
function main() -> int {
    int month = 8
    switch (month) {
        case 3: case 4: case 5:  println("春"); break
        case 6: case 7: case 8:  println("夏"); break
        case 9: case 10: case 11: println("秋"); break
        case 12: case 1: case 2: println("冬"); break
        default: println("月份不合法")
    }
    return 0
}
```

## 第 5 章

**练习 1**: 1..20 的偶数和。

```c
function main() -> int {
    int sum = 0
    for (int i = 2; i <= 20; i += 2) {
        sum += i
    }
    println("偶数和 = " + sum)
    return 0
}
```

**练习 2**: 5 的乘法表。

```c
function main() -> int {
    for (int i = 1; i <= 9; i++) {
        println("5 x " + i + " = " + (5 * i))
    }
    return 0
}
```

**练习 4**: 计算整数位数。

```c
function main() -> int {
    int n = 90210
    int digits = 0
    if (n == 0) { digits = 1 }
    while (n > 0) {
        digits++
        n = idiv(n, 10)
    }
    println("位数 = " + digits)
    return 0
}
```

## 第 6 章

**练习 1 + 2**: 判断偶数 + 三数最大。

```c
function is_even(int n) -> bool {
    return n % 2 == 0
}

function max_of_three(int a, int b, int c) -> int {
    int m = a
    if (b > m) { m = b }
    if (c > m) { m = c }
    return m
}

function main() -> int {
    println("8 是偶数? " + is_even(8))
    println("最大: " + max_of_three(3, 9, 5))
    return 0
}
```

**练习 3**: 循环实现幂。

```c
function power(int base, int exp) -> int {
    int result = 1
    for (int i = 0; i < exp; i++) {
        result *= base
    }
    return result
}

function main() -> int {
    println("2^10 = " + power(2, 10))
    return 0
}
```

**练习 5**: 循环版与递归版求和。

```c
function sum_loop(int n) -> int {
    int s = 0
    for (int i = 1; i <= n; i++) { s += i }
    return s
}

function sum_rec(int n) -> int {
    if (n <= 0) { return 0 }
    return n + sum_rec(n - 1)
}

function main() -> int {
    println("循环: " + sum_loop(100))
    println("递归: " + sum_rec(100))
    return 0
}
```

## 第 7 章

**练习 2**: 最大值的下标。

```c
function main() -> int {
    int a[6] = {4, 8, 15, 16, 23, 42}
    int n = 6
    int best = 0
    for (int i = 1; i < n; i++) {
        if (a[i] > a[best]) { best = i }
    }
    println("最大值下标 = " + best + " (值 " + a[best] + ")")
    return 0
}
```

**练习 3**: 统计偶数个数。

```c
function main() -> int {
    int a[8] = {3, 8, 12, 7, 20, 5, 16, 9}
    int n = 8
    int count = 0
    for (int i = 0; i < n; i++) {
        if (a[i] % 2 == 0) { count++ }
    }
    println("偶数个数 = " + count)
    return 0
}
```

**练习 4**: 从大到小排序 (只改比较方向)。

```c
function main() -> int {
    int a[6] = {4, 8, 15, 3, 23, 16}
    int n = 6
    for (int i = 0; i < n - 1; i++) {
        for (int j = 0; j < n - 1 - i; j++) {
            if (a[j] < a[j + 1]) {          // 关键: 这里是 <
                int t = a[j]
                a[j] = a[j + 1]
                a[j + 1] = t
            }
        }
    }
    for (int i = 0; i < n; i++) { print(a[i] + " ") }
    println("")
    return 0
}
```

## 第 8 章

**练习 3**: 统计数字字符个数。

```c
function main() -> int {
    string s = "CIN 2026 released 09/26"
    int n = strlen(s)
    int digits = 0
    for (int i = 0; i < n; i++) {
        int c = s[i]
        if (c >= '0' && c <= '9') { digits++ }
    }
    println("数字字符个数 = " + digits)
    return 0
}
```

**练习 5**: 拆分日期字符串。

```c
function main() -> int {
    string s = "2026-09-26"
    int first = indexof(s, "-")
    string year = substr(s, 0, first)
    int second = indexof(substr(s, first + 1, 3), "-")
    string month = substr(s, first + 1, second)
    string day = substr(s, first + 1 + second + 1, 2)
    println("年: " + year)
    println("月: " + month)
    println("日: " + day)
    return 0
}
```

::: tip 更简单的写法
固定格式的日期可以直接按位置取:

```c
string year = substr(s, 0, 4)
string month = substr(s, 5, 2)
string day = substr(s, 8, 2)
```
:::

## 第 9 章

**练习 2**: 两点距离的平方。

```c
struct Point {
    int x
    int y
}

function distance2(Point a, Point b) -> int {
    int dx = a.x - b.x
    int dy = a.y - b.y
    return dx * dx + dy * dy
}

function main() -> int {
    Point p
    p.x = 0
    p.y = 0
    Point q
    q.x = 3
    q.y = 4
    println("距离平方 = " + distance2(p, q))
    return 0
}
```

**练习 4**: 返回累加后的 struct。

```c
struct Counter {
    int value
}

function add(Counter c, int n) -> Counter {
    Counter r
    r.value = c.value + n
    return r
}

function main() -> int {
    Counter c
    c.value = 10
    Counter d = add(c, 5)
    println("原值 " + c.value + ", 新值 " + d.value)
    return 0
}
```

## 第 10 章

**练习 1**: 自建模块。建两个文件:

```c
// mytools.cin
function my_is_even(int n) -> bool {
    return n % 2 == 0
}

function my_clamp(int v, int lo, int hi) -> int {
    if (v < lo) { return lo }
    if (v > hi) { return hi }
    return v
}
```

```c
// main.cin
import "./mytools.cin"

function main() -> int {
    println("4 是偶数? " + my_is_even(4))
    println("clamp(99, 0, 10) = " + my_clamp(99, 0, 10))
    println("clamp(-5, 0, 10) = " + my_clamp(-5, 0, 10))
    return 0
}
```

**练习 3**: 随机数排序。

```c
import "rand.cin"
import "sort.cin"

function main() -> int {
    int a[10]
    srand(2026)
    for (int i = 0; i < 10; i++) {
        a[i] = r_range(1, 100)
    }
    sort_bubble(a, 10)
    for (int i = 0; i < 10; i++) { print(a[i] + " ") }
    println("")
    return 0
}
```

> 固定了种子, 所以每次运行的结果都一样。去掉 `srand(2026)` 就是真随机。

## 第 11 章

**练习 1**: 写文件再读回来。

```c
function main() -> int {
    string path = "nums.txt"
    file_write(path, "")
    for (int i = 1; i <= 5; i++) {
        file_append(path, int_to_str(i) + "\n")
    }
    println(file_read(path))
    return 0
}
```

**练习 3**: 生成一张图片。

```c
function main() -> int {
    canvas(200, 200)
    set_color(0xFF0000)
    fill_rect(20, 20, 160, 160)
    set_color(0x0000FF)
    draw_line(20, 20, 180, 180)
    return save_png("square.png")
}
```

运行后当前目录会出现 `square.png`。

## 第 12 章

**练习 1**: 死循环的原因与修复。

```c
// 错误版本: 循环体里没有改变 i, 条件永远为真
function main_wrong() -> int {
    int i = 0
    while (i < 5) {
        println("i = " + i)
    }
    return 0
}

// 修复: 每轮把 i 加 1
function main() -> int {
    int i = 0
    while (i < 5) {
        println("i = " + i)
        i++
    }
    return 0
}
```

验证死循环可以用 `codecin prog.cin --max-instructions 100000`, 程序会因指令数超限而停止。

**练习 3**: `--debug` 的第一条 trace 是 `PC=0x0000 #00000000 CALL main->0x2`,
说明入口先执行一条 `CALL`, 跳到地址 `0x2` (即 `main` 的代码)。

## 写在最后

这 12 章的练习覆盖了 CIN 的日常使用。接下来建议:

1. 打开 [示例程序集](/guide/examples), 逐个运行仓库自带示例并读懂它们;
2. 挑一个真实需求 (比如“把日志文件里的错误行挑出来”), 用 CIN 写出来;
3. 需要某个功能时先翻 [标准库参考](/stdlib/reference), 不要重复造轮子。
