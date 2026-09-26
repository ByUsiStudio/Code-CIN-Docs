---
description: "第 9 章：CIN struct——定义、成员访问、嵌套、struct 数组、值语义与传参、用结构体给数据建模。"
---

# 第 9 章 struct 与数据建模

::: info 本章目标
把“一组相关的数据”打包成一个类型, 例如“学生 = 姓名 + 分数”“矩形 = 左上角 + 右下角”。
学会定义 struct、访问成员、用 struct 数组表示表格, 以及把 struct 传给函数。
:::

## 9.1 为什么要 struct

假设要保存 3 个学生的“姓名 + 分数”。用平行数组会很别扭:

```c
string names[3]
int scores[3]
// names[i] 和 scores[i] 必须靠人脑记住是一对
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

::: tip 未初始化的 struct 是“全零”
`Student s` 之后, `s.score` 是 `0`, `s.name` 是空字符串 `""` (不是随机值)。
但**别依赖默认值**, 显式赋值更安全。
:::

## 9.3 嵌套 struct: 结构里放结构

```c
struct Point {
    int x
    int y
}

struct Rectangle {
    Point top_left             // 字段本身也是一个 struct
    Point bottom_right
}

function width(Rectangle r) -> int {
    int w = r.bottom_right.x - r.top_left.x
    if (w < 0) { w = -w }
    return w
}

function height(Rectangle r) -> int {
    int h = r.bottom_right.y - r.top_left.y
    if (h < 0) { h = -h }
    return h
}

function main() -> int {
    Rectangle r
    r.top_left.x = 1           // 链式访问: 逐层用 .
    r.top_left.y = 2
    r.bottom_right.x = 5
    r.bottom_right.y = 6

    println("宽 = " + width(r))
    println("高 = " + height(r))
    println("面积 = " + (width(r) * height(r)))
    return 0
}
```

```text
宽 = 4
高 = 4
面积 = 16
```

## 9.4 struct 数组: 一张表格

```c
struct Student {
    string name
    int score
}

function main() -> int {
    Student cls[3]                       // 3 个学生

    cls[0].name = "小明"
    cls[0].score = 92
    cls[1].name = "小红"
    cls[1].score = 85
    cls[2].name = "小刚"
    cls[2].score = 78

    int total = 0
    int best = 0
    for (int i = 0; i < 3; i++) {
        println(cls[i].name + ": " + cls[i].score)
        total += cls[i].score
        if (cls[i].score > cls[best].score) {
            best = i
        }
    }
    println("总分 " + total + ", 平均 " + (total / 3))
    println("最高分是 " + cls[best].name + " (" + cls[best].score + ")")
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

::: warning struct 字段不能是变长数组
字段可以是标量、嵌套 struct、**固长数组**:

```c
struct Student {
    string name
    int grades[5]        // 可以
    // int[] extra       // 不行: 变长指针数组不能做字段
}
```
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
struct Student {
    string name
    int score
}

function print_report(Student[] cls, int n) -> void {
    int total = 0
    int pass = 0
    for (int i = 0; i < n; i++) {
        string tag = cls[i].score >= 60 ? "及格" : "不及格"
        println(cls[i].name + "  " + cls[i].score + "  " + tag)
        total += cls[i].score
        if (cls[i].score >= 60) { pass++ }
    }
    println("----------")
    println("总分 " + total + ", 平均 " + (total / n))
    println("及格 " + pass + " 人, 不及格 " + (n - pass) + " 人")
}

function main() -> int {
    Student cls[4]
    cls[0].name = "小明"; cls[0].score = 92
    cls[1].name = "小红"; cls[1].score = 58
    cls[2].name = "小刚"; cls[2].score = 77
    cls[3].name = "小美"; cls[3].score = 85

    print_report(cls, 4)
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

注意上面用 `;` 在一行里写了两条语句 —— CIN 允许, 但**建议一行一条**, 可读性更好。
其中 `Student[] cls` 是“以 struct 数组为参数”的写法 (与 `int[]` 一样是指针形式)。

## 9.7 常见错误

| 现象 | 原因 | 解决 |
|------|------|------|
| `Undefined variable` / 找不到字段 | struct 定义写在函数里, 或字段名拼错 | struct 定义放函数外, 检查字段名 |
| 函数里改了 struct 外面没变 | struct 是值传递 | 用返回值, 或把结果写进数组 |
| 想放变长数组字段报错 | 字段只能是标量/嵌套 struct/固长数组 | 用固长数组或改为数组参数 |
| struct 数组元素未初始化就读 | 忘记赋值 | 先赋值再读 |

## 9.8 练习

1. 定义 `struct Book { string title  int pages }`, 创建两本书并打印书名与页数。
2. 定义 `struct Point`, 写 `distance2(Point a, Point b)` 返回两点距离的平方
   (提示: 用 `(a.x-b.x)*(a.x-b.x)` 相加, 避免开平方)。
3. 用 struct 数组存 5 个人的“姓名 + 年龄”, 找出年龄最大的人。
4. 定义 `struct Counter { int value }`, 写函数 `add(Counter c, int n) -> Counter` 返回累加后的新值。
5. 把第 9.6 的成绩单改成“按分数从高到低”打印 (提示: 交换 struct 数组元素即可,
   交换时用 `Student t = cls[i]; cls[i] = cls[j]; cls[j] = t`)。

参考实现见 [习题与答案 · 第 9 章](/beginner/exercises#第-9-章)。

## 9.9 本章小结

- `struct` 把相关字段打包, 定义写在函数外, 成员用 `.` 访问, 支持嵌套;
- 未初始化的 struct 是“全零”;
- struct 数组可以表示表格 (`cls[i].name`);
- struct 传参是**值语义** (副本), 数组是引用语义;
- 字段只能是标量、嵌套 struct 与固长数组。

下一章: [模块与标准库](/beginner/ch10-modules)。
