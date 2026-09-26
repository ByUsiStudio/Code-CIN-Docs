---
description: "第 9 章：CIN struct——定义、成员访问、嵌套、struct 数组、值语义与传参、用结构体给数据建模。"
---

# 第 9 章 struct 与数据建模

::: info 本章目标
把“一组相关的数据”打包成一个类型, 例如“学生 = 姓名 + 分数”“矩形 = 左上角 + 右下角”。
学会定义 struct、访问成员、用 struct 数组表示表格, 以及把 struct 传给函数。
:::

## 9.1 为什么要 struct

假设要保存一个学生的“姓名 + 分数”。用两个互不相干的变量很别扭:

```c
string name = "小明"
int score = 92
// 数据一多, 就分不清谁是谁
```

struct 把两者绑成一个类型, 语义清晰:

```c
struct Student {
    string name
    int score
}
```

- `struct` 定义写在**函数外面** (通常在文件顶部);
- 每个字段一行, 写“类型 + 名字”;
- 定义本身不占内存, 声明变量时才分配。

## 9.2 使用: 声明、赋值、读取

```c
struct Student {
    string name
    int score
}

function main() -> int {
    Student s                    // 声明一个 Student 变量, 所有字段默认值 (字符串为 "")
    s.name = "小明"              // 用 . 访问字段
    s.score = 92

    println(s.name + " 的分数是 " + s.score)
    s.score = 95                 // 可以改
    println("改分后: " + s.score)
    return 0
}
```

```text
小明 的分数是 92
改分后: 95
```

::: danger 未初始化的 struct: 数值字段是 0, 字符串字段不是空串
`Student s` 之后 `s.score` 是 `0`, 但 `s.name` **不保证是 `""`** —— 实测它会指向相邻的
字符串字面量:

```c
struct Student {
    string name
    int score
}

function main() -> int {
    Student s
    println("[" + s.name + "] score=" + s.score)   // 实测: [[] score=0
    return 0
}
```

**规则: 声明之后立刻给每个字符串字段赋值。**
:::

## 9.3 用多个 struct 变量表示一组数据

需要“两个点”时, 声明**两个独立的 struct 变量**, 让函数分别接收:

```c
struct Point {
    int x
    int y
}

function manhattan(Point a, Point b) -> int {
    int dx = a.x - b.x
    int dy = a.y - b.y
    if (dx < 0) { dx = -dx }
    if (dy < 0) { dy = -dy }
    return dx + dy
}

function main() -> int {
    Point p1
    p1.x = 1
    p1.y = 2

    Point p2
    p2.x = 5
    p2.y = 6

    println("p1 = (" + p1.x + ", " + p1.y + ")")
    println("p2 = (" + p2.x + ", " + p2.y + ")")
    println("曼哈顿距离 = " + manhattan(p1, p2))
    return 0
}
```

```text
p1 = (1, 2)
p2 = (5, 6)
曼哈顿距离 = 8
```

多个独立的 struct 变量互不影响 —— 这是当前版本可靠的用法。

::: danger 嵌套 struct 的字段访问 (`r.a.x`) 当前不可靠
实测 (5.5.0): 结构里套结构时, 多层字段访问会互相覆盖:

```c
struct Point { int x
               int y }
struct Rect {
    Point a        // 嵌套 struct 字段
    Point b
}

function main() -> int {
    Rect r
    r.a.x = 1
    r.a.y = 2
    r.b.x = 5
    r.b.y = 6
    // 实测: r.a 与 r.b 读到的是同一份数据 (都是 5,6)
    return 0
}
```

**规避办法**: 用扁平字段, 或直接声明多个 struct 变量 (上面的例子)。

```c
struct Rect {           // 扁平写法: 每个坐标一个字段
    int x1
    int y1
    int x2
    int y2
}

function width(Rect r) -> int {
    int w = r.x2 - r.x1
    if (w < 0) { w = -w }
    return w
}
```
:::

## 9.4 一张表: 用并行数组

要保存“多个人的姓名 + 分数”时, 用两个下标对齐的数组 (**并行数组**):

```c
function main() -> int {
    string names[3]
    int scores[3]

    names[0] = "小明"; scores[0] = 92
    names[1] = "小红"; scores[1] = 85
    names[2] = "小刚"; scores[2] = 78

    int total = 0
    int best = 0
    for (int i = 0; i < 3; i++) {
        println(names[i] + ": " + scores[i])
        total += scores[i]
        if (scores[i] > scores[best]) {
            best = i
        }
    }
    println("总分 " + total + ", 平均 " + (total / 3))
    println("最高分是 " + names[best] + " (" + scores[best] + ")")
    return 0
}
```

```text
小明: 92
小红: 85
小刚: 78
总分 255, 平均 85
最高分是 小明 (92)
```

要点: 两个数组靠**同一个下标 `i`** 关联, 所以遍历时只会写一个循环。

::: danger struct 数组 (`Student cls[3]`) 当前不能正确工作
实测 (5.5.0): 给 `cls[i].字段` 赋值时, 所有元素会写到**同一个位置**, 读出来全是最后一次
写入的值 (局部数组与全局数组都一样):

```c
Student cls[3]
cls[0].name = "小明"; cls[0].score = 92
cls[1].name = "小红"; cls[1].score = 85
cls[2].name = "小刚"; cls[2].score = 78
// 实测: 三行打印出来都是最后一次写入的值
```

**在修好之前, 表格数据请用并行数组** (上面的写法): 名字放一个数组, 分数放另一个数组,
用同一下标关联。单个 struct 变量 (一条记录) 是正常的。
:::

## 9.5 struct 作参数与返回值

struct 按**值**传递: 函数里改的是副本, 外面的原值不变。需要“就地修改”时传数组。

```c
struct Point {
    int x
    int y
}

function moved(Point p, int dx, int dy) -> Point {
    Point r                        // 局部 struct 变量
    r.x = p.x + dx
    r.y = p.y + dy
    return r                       // 返回整个 struct
}

function main() -> int {
    Point p
    p.x = 1
    p.y = 2

    Point q = moved(p, 10, 20)
    println("原坐标: (" + p.x + ", " + p.y + ")")
    println("新坐标: (" + q.x + ", " + q.y + ")")
    return 0
}
```

```text
原坐标: (1, 2)
新坐标: (11, 22)
```

::: tip struct 与数组的传参差异
| 类型 | 传参语义 | 函数内修改对外可见? |
|------|----------|---------------------|
| `int` / `float` / `bool` / `string` | 值 (副本) | 否 |
| struct | 值 (副本) | 否 (但对嵌入数组的字段要小心) |
| 数组 (`T[]` 或 `T[n]`) | 引用 | 是 |

需要让函数“改到外面”时, 把结果放进数组传出去 —— 这也是 [6.6 多值返回](/beginner/ch06-functions#_6-6-一个函数只能返回一个值-以及怎么办)
的做法。
:::

## 9.6 综合例子: 成绩单分析

```c
function print_report(string[] names, int[] scores, int n) -> void {
    int total = 0
    int pass = 0
    for (int i = 0; i < n; i++) {
        string tag = scores[i] >= 60 ? "及格" : "不及格"
        println(names[i] + "  " + scores[i] + "  " + tag)
        total += scores[i]
        if (scores[i] >= 60) { pass++ }
    }
    println("----------")
    println("总分 " + total + ", 平均 " + (total / n))
    println("及格 " + pass + " 人, 不及格 " + (n - pass) + " 人")
}

function main() -> int {
    string names[4]
    int scores[4]
    names[0] = "小明"; scores[0] = 92
    names[1] = "小红"; scores[1] = 58
    names[2] = "小刚"; scores[2] = 77
    names[3] = "小美"; scores[3] = 85

    print_report(names, scores, 4)
    return 0
}
```

```text
小明  92  及格
小红  58  不及格
小刚  77  及格
小美  85  及格
----------
总分 312, 平均 78
及格 3 人, 不及格 1 人
```

注意:

- 参数写成 `string[] names` / `int[] scores` (指针形式), 再加上长度 `n`;
- 两个数组用同一个下标 `i` 对齐, 这就是“并行数组”的用法;
- 一行里用 `;` 写两条语句是允许的, 但**建议一行一条**, 可读性更好。

## 9.7 常见错误

| 现象 | 原因 | 解决 |
|------|------|------|
| `Undefined variable` / 找不到字段 | struct 定义写在函数里, 或字段名拼错 | struct 定义放函数外, 检查字段名 |
| 函数里改了 struct 外面没变 | struct 是值传递 | 用返回值, 或把结果写进数组 |
| 想放变长数组字段报错 | 字段只能是标量/嵌套 struct/固长数组 | 用固长数组或改为数组参数 |
| 表格数据全变成最后一行的值 | 用了 struct 数组 (当前版本缺陷) | 改用并行数组 (见 9.4) |
| 嵌套 struct 字段互相覆盖 | 多层字段访问 `r.a.x` (当前版本缺陷) | 扁平字段或独立 struct 变量 (见 9.3) |
| `string` 字段打印出别人的文本 | 声明 struct 后字段未初始化就使用 | 先给字段赋初值 |

## 9.8 练习

1. 定义 `struct Book { string title  int pages }`, 创建一个 Book 并打印书名与页数
   (想做两本书, 就声明两个变量 `b1` / `b2`)。
2. 定义 `struct Point`, 写 `distance2(Point a, Point b)` 返回两点距离的平方
   (提示: 用 `(a.x-b.x)*(a.x-b.x)` 相加, 避免开平方)。
3. 用**并行数组**存 5 个人的“姓名 + 年龄”, 找出年龄最大的人。
4. 定义 `struct Counter { int value }`, 写函数 `add(Counter c, int n) -> Counter` 返回累加后的新值。
5. 把第 9.6 的成绩单改成“按分数从高到低”打印 (提示: 两个数组要一起交换,
   用临时变量分别换 `scores[i]` / `scores[j]` 与 `names[i]` / `names[j]`)。

参考实现见 [习题与答案 · 第 9 章](/beginner/exercises#第-9-章)。

## 9.9 本章小结

- `struct` 把相关字段打包, 定义写在函数外, 成员用 `.` 访问;
- 单个 struct 变量的字段读写是可靠的; **struct 数组与嵌套 struct 字段访问当前不可靠**,
  表格数据请用并行数组, “多段数据”用多个独立 struct 变量;
- struct 传参是**值语义** (副本), 数组是引用语义;
- 字段只能是标量、固长数组 (或嵌套 struct, 但见上面的限制);
- 一个函数只能返回一个值 → 需要多个结果时用数组传出。

下一章: [模块与标准库](/beginner/ch10-modules)。
