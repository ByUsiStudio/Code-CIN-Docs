---
description: "第 13 章：CIN 综合实战——计算器、猜数字、成绩报告、排序查找、单词统计与矩阵乘法六个完整项目。"
---

# 第 13 章 综合实战: 六个小项目

::: info 本章目标
把前面 12 章的知识拼成完整程序。每个项目都是**可以独立运行**的完整代码,
建议先照着敲一遍, 再自己加功能。
:::

## 项目 1: 简易计算器

用 `switch` 做四则运算, 并处理“除数为 0”的错误。

```c
function main() -> int {
    float a = 12.5
    float b = 4
    char op = '*'                 // 可改成 '+' '-' '*' '/'
    string op_name = "*"          // 用来打印 (char 打印出来是编码)
    float result = 0

    switch (op) {
        case '+': result = a + b; break
        case '-': result = a - b; break
        case '*': result = a * b; break
        case '/':
            if (b == 0) {
                println("错误: 除数不能为 0")
                return 1
            }
            result = a / b
            break
        default:
            println("不支持的运算符: " + op_name)
            return 1
    }

    println(a + " " + op_name + " " + b + " = " + result)
    return 0
}
```

```text
12.5 * 4 = 50
```

::: tip 为什么不直接读键盘
`input()` 在当前版本还不读键盘 (见 [第 2 章](/beginner/ch02-variables#_2-8-读取用户输入-重要-当前版本现状))。
把 `a` / `b` / `op` 改成你要算的值即可; 想批量计算, 就把数据写进文件循环处理。
:::

## 项目 2: 猜数字 (固定种子, 可复现)

用“二分法”自动猜, 顺便体会 `while` 与 `idiv`:

```c
import "rand.cin"

function main() -> int {
    srand(7)                       // 固定随机种子, 每次结果一样
    int secret = r_range(1, 100)

    int low = 1
    int high = 100
    int tries = 0
    while (low <= high) {
        int guess = idiv(low + high, 2)
        tries++
        if (guess == secret) {
            println("第 " + tries + " 次猜中: " + guess)
            return 0
        }
        if (guess < secret) {
            low = guess + 1
        } else {
            high = guess - 1
        }
    }
    println("没猜中 (不应该发生)")
    return 1
}
```

输出会显示二分的每一步与最终次数 (因为固定了种子, 每次运行完全一致)。

## 项目 3: 成绩统计报告

struct 数组 + 排序 + 统计, 输出一张小报表:

```c
import "sort.cin"

struct Student {
    string name
    int score
}

function main() -> int {
    Student cls[5]
    cls[0].name = "小明"; cls[0].score = 88
    cls[1].name = "小红"; cls[1].score = 95
    cls[2].name = "小刚"; cls[2].score = 72
    cls[3].name = "小美"; cls[3].score = 59
    cls[4].name = "小强"; cls[4].score = 81

    int total = 0
    int pass = 0
    int best = 0
    for (int i = 0; i < 5; i++) {
        total += cls[i].score
        if (cls[i].score >= 60) { pass++ }
        if (cls[i].score > cls[best].score) { best = i }
    }

    println("姓名\t分数\t等级")
    for (int i = 0; i < 5; i++) {
        string grade = "不及格"
        if (cls[i].score >= 90) { grade = "优秀" }
        else if (cls[i].score >= 80) { grade = "良好" }
        else if (cls[i].score >= 60) { grade = "及格" }
        println(cls[i].name + "\t" + cls[i].score + "\t" + grade)
    }

    println("-------------")
    println("平均分: " + (total / 5))
    println("及格率: " + (pass * 100 / 5) + "%")
    println("最高分: " + cls[best].name + " (" + cls[best].score + ")")
    return 0
}
```

要点: 用 `\t` 对齐; `pass * 100 / 5` 是浮点除法 → 及格率 80%。

## 项目 4: 排序 + 二分查找

```c
import "sort.cin"

function main() -> int {
    int a[10] = {42, 7, 19, 3, 88, 21, 56, 12, 73, 30}
    int n = 10

    sort_bubble(a, n)                     // 或用 sort_quick_all(a, n)

    print("排序后: ")
    for (int i = 0; i < n; i++) { print(a[i] + " ") }
    println("")

    int target = 56
    int idx = bin_search(a, n, target)
    if (idx >= 0) {
        println(target + " 在排序后的下标 " + idx)
    } else {
        println(target + " 不存在")
    }
    return 0
}
```

要点: 二分查找**要求数组已排序**; 找不到返回 `-1`。

## 项目 5: 文本统计

统计一段文字的单词数、最长单词与元音个数:

```c
function main() -> int {
    string text = "the quick brown fox jumps over the lazy dog"
    int n = strlen(text)

    int words = 0
    int vowels = 0
    bool in_word = false
    int cur_len = 0
    int max_len = 0

    for (int i = 0; i < n; i++) {
        int c = text[i]
        if (c == 'a' || c == 'e' || c == 'i' || c == 'o' || c == 'u') { vowels++ }

        if (c == ' ') {
            if (in_word) { words++ }
            in_word = false
            if (cur_len > max_len) { max_len = cur_len }
            cur_len = 0
        } else {
            in_word = true
            cur_len++
        }
    }
    if (in_word) {                    // 结尾没有空格, 补记最后一个单词
        words++
        if (cur_len > max_len) { max_len = cur_len }
    }

    println("长度: " + n)
    println("单词数: " + words)
    println("元音数: " + vowels)
    println("最长单词长度: " + max_len)
    return 0
}
```

## 项目 6: 矩阵乘法

`2×3` 的矩阵乘 `3×2` 的矩阵, 结果 `2×2`。规则: 结果的 `(i,j)` = 左矩阵第 `i` 行与右矩阵第 `j` 列逐项相乘再求和。

```c
function main() -> int {
    int A[2][3] = { {1, 2, 3}, {4, 5, 6} }
    int B[3][2] = { {7, 8}, {9, 10}, {11, 12} }
    int C[2][2]

    for (int i = 0; i < 2; i++) {
        for (int j = 0; j < 2; j++) {
            int sum = 0
            for (int k = 0; k < 3; k++) {
                sum += A[i][k] * B[k][j]
            }
            C[i][j] = sum
        }
    }

    for (int i = 0; i < 2; i++) {
        for (int j = 0; j < 2; j++) {
            print(C[i][j] + " ")
        }
        println("")
    }
    return 0
}
```

手算核对: `C[0][0] = 1×7 + 2×9 + 3×11 = 58`, `C[1][1] = 4×8 + 5×10 + 6×12 = 154`。

::: tip 大矩阵用标准库
`matrix.cin` 提供 `mat_mul` / `mat_transpose` / `mat_det` 等函数 (矩阵以一维数组行主序存放),
见 [标准库参考](/stdlib/reference)。
:::

## 加练建议

1. 给项目 1 加上“连续计算多个表达式”: 把 `a` / `b` / `op` 放进数组, 用循环逐个算。
2. 给项目 3 增加“按分数从高到低排序后打印” (交换 struct 数组元素)。
3. 给项目 5 增加“统计每个单词出现次数” (用两个数组: 单词表 + 计数)。
4. 给项目 6 加上“转置”和“输出到文件” (`file_write`)。
5. 把项目 4 的排序换成 `sort_quick_all`, 比较结果是否一致。

## 本章小结

- 完整程序 = 数据 (数组 / struct) + 流程 (循环 / 分支) + 函数拆分;
- 标准库能省掉大量样板代码 (排序、查找、统计);
- 涉及数组的循环要反复确认边界 (`i < n`);
- 输出格式用 `\t` 对齐已经很够用;
- 每个项目都可以继续加功能, 这是最好的练习方式。

到这里教程正文结束。建议继续阅读:

- [习题与答案](/beginner/exercises) — 各章练习的参考实现
- [语法速查表](/beginner/cheatsheet) — 打印出来放手边
- [CIN 语言总览](/language/) — 系统化的语言参考
- [示例程序集](/guide/examples) — 仓库自带示例
- [标准库参考](/stdlib/reference) — 218 个库函数的签名
