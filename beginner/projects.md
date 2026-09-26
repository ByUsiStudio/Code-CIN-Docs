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
        println("第 " + tries + " 次猜: " + guess)
        if (guess == secret) {
            println("猜中! 秘密数字 = " + secret + ", 共 " + tries + " 次")
            return 0
        }
        if (guess < secret) {
            low = guess + 1
        } else {
            high = guess - 1
        }
    }
    return 1
}
```

```text
第 1 次猜: 50
第 2 次猜: 25
第 3 次猜: 37
第 4 次猜: 31
第 5 次猜: 28
第 6 次猜: 29
猜中! 秘密数字 = 29, 共 6 次
```

因为固定了种子 (`srand(7)`), 每次运行的秘密数字与过程完全一致 —— 这也是给程序写测试的好习惯。

> 注意: `import` 行**不能**写行尾注释 (会编译失败), 见
> [第 10 章](/beginner/ch10-modules#_10-2-import-的两条规则)。

## 项目 3: 成绩统计报告

用**并行数组**存表格数据 (为什么不用 struct 数组, 见
[第 9 章的限制说明](/beginner/ch09-structs#_9-4-一张表-用并行数组)), 输出一张小报表:

```c
function main() -> int {
    string names[5]
    int scores[5]
    names[0] = "小明"; scores[0] = 88
    names[1] = "小红"; scores[1] = 95
    names[2] = "小刚"; scores[2] = 72
    names[3] = "小美"; scores[3] = 59
    names[4] = "小强"; scores[4] = 81

    int total = 0
    int pass = 0
    int best = 0
    for (int i = 0; i < 5; i++) {
        total += scores[i]
        if (scores[i] >= 60) { pass++ }
        if (scores[i] > scores[best]) { best = i }
    }

    println("姓名\t分数\t等级")
    for (int i = 0; i < 5; i++) {
        string grade = "不及格"
        if (scores[i] >= 90) { grade = "优秀" }
        else if (scores[i] >= 80) { grade = "良好" }
        else if (scores[i] >= 60) { grade = "及格" }
        println(names[i] + "\t" + scores[i] + "\t" + grade)
    }
    println("-------------")
    println("平均分: " + (total / 5))
    println("及格率: " + (pass * 100 / 5) + "%")
    println("最高分: " + names[best] + " (" + scores[best] + ")")
    return 0
}
```

```text
姓名	分数	等级
小明	88	良好
小红	95	优秀
小刚	72	及格
小美	59	不及格
小强	81	良好
-------------
平均分: 79
及格率: 80%
最高分: 小红 (95)
```

要点:

- 两个数组靠同一个下标 `i` 对齐 (`names[i]` ↔ `scores[i]`);
- `\t` 用来在终端里对齐列;
- `pass * 100 / 5` 是浮点除法 → 及格率 `80%`;
- 求最高分时用 `best` 记住**下标**, 最后才能同时拿到名字和分数。

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

矩阵用二维数组表示, **用循环填充** (局部二维数组的 `{ {...} }` 字面量初始化当前无效,
原因见 [第 7 章](/beginner/ch07-arrays#_7-8-二维数组)):

```c
function main() -> int {
    int A[2][3]
    int B[3][2]
    int C[2][2]

    for (int i = 0; i < 2; i++) {
        for (int j = 0; j < 3; j++) {
            A[i][j] = i * 3 + j + 1              // 1 2 3 / 4 5 6
        }
    }
    for (int i = 0; i < 3; i++) {
        for (int j = 0; j < 2; j++) {
            B[i][j] = 7 + i * 2 + j              // 7 8 / 9 10 / 11 12
        }
    }

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

```text
58 64 
139 154 
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
