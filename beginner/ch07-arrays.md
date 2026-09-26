---
description: "第 7 章：CIN 数组——声明、初始化、遍历、求和求最值、查找、反转、冒泡排序、传参与越界检查。"
---

# 第 7 章 数组

::: info 本章目标
学会用数组保存“一排数据”, 并写出最实用的四件事: 求和、找最大最小、查找、排序。
:::

## 7.1 声明与初始化

```c
int scores[5]                       // 5 个整数, 默认全是 0
float prices[3]                     // 3 个浮点数, 默认 0.0
string names[2]                     // 2 个字符串
int a[5] = {90, 85, 77, 60, 95}     // 带初值
int z[4] = {1, 2}                   // 只给前两个, 其余为 0
```

- 方括号里的数字是**元素个数**;
- 下标从 **0** 开始: 5 个元素的下标是 `0, 1, 2, 3, 4`;
- 数组**不记录自己的长度**, 所以要另用一个变量记住 `n` (重要习惯)。

## 7.2 访问与遍历

```c
function main() -> int {
    int scores[5] = {90, 85, 77, 60, 95}
    int n = 5

    println("第一个: " + scores[0])          // 90
    println("最后一个: " + scores[n - 1])    // 95

    for (int i = 0; i < n; i++) {
        println("第 " + (i + 1) + " 个: " + scores[i])
    }
    return 0
}
```

```text
第一个: 90
最后一个: 95
第 1 个: 90
第 2 个: 85
第 3 个: 77
第 4 个: 60
第 5 个: 95
```

::: warning 循环条件写 `i < n`, 不是 `i <= n`
`i <= n` 会访问 `scores[5]` —— 越界。这是初学者最常犯的错误。
:::

## 7.3 求和、平均值、最大值

```c
function main() -> int {
    int a[6] = {12, 7, 19, 4, 26, 10}
    int n = 6

    int sum = 0
    int max = a[0]              // 用第一个元素作为初始最大值
    int min = a[0]
    for (int i = 0; i < n; i++) {
        sum += a[i]
        if (a[i] > max) { max = a[i] }
        if (a[i] < min) { min = a[i] }
    }
    float avg = sum / n         // '/' 是浮点除法

    println("sum = " + sum)
    println("avg = " + avg)
    println("max = " + max + ", min = " + min)
    return 0
}
```

```text
sum = 78
avg = 13
max = 26, min = 4
```

::: tip 初始化技巧
求最大值时把 `max` 初始化成 `a[0]` (而不是 `0`), 这样即使数组全是负数也正确。
同理求最小值用 `a[0]`。
:::

## 7.4 查找: 有没有、在哪里

```c
function main() -> int {
    int a[6] = {12, 7, 19, 4, 26, 10}
    int n = 6
    int target = 19
    int found = -1                       // -1 表示没找到

    for (int i = 0; i < n; i++) {
        if (a[i] == target) {
            found = i
            break                        // 找到就停
        }
    }

    if (found >= 0) {
        println(target + " 在下标 " + found)
    } else {
        println(target + " 不在数组里")
    }
    return 0
}
```

```text
19 在下标 2
```

把 `target` 改成 `100`, 输出变成 `100 不在数组里`。

## 7.5 反转数组

```c
function main() -> int {
    int a[5] = {1, 2, 3, 4, 5}
    int n = 5

    for (int i = 0; i < idiv(n, 2); i++) {
        int j = n - 1 - i            // 与之对称的下标
        int t = a[i]
        a[i] = a[j]
        a[j] = t
    }

    for (int i = 0; i < n; i++) { print(a[i] + " ") }
    println("")
    return 0
}
```

```text
5 4 3 2 1 
```

交换两个变量必须借助临时变量 `t` (`a[i] = a[j]` 会直接覆盖); 循环只需走到一半。

## 7.6 冒泡排序 (手写一遍就懂了)

思路: 反复比较相邻两个元素, 如果前面比后面大就交换; 一轮结束最大的“冒”到最后。

```c
function bubble_sort(int[] a, int n) -> void {
    for (int i = 0; i < n - 1; i++) {              // 一共 n-1 轮
        for (int j = 0; j < n - 1 - i; j++) {      // 每轮比较到未排好的边界
            if (a[j] > a[j + 1]) {
                int t = a[j]
                a[j] = a[j + 1]
                a[j + 1] = t
            }
        }
    }
}

function main() -> int {
    int data[8] = {5, 3, 8, 1, 9, 2, 7, 4}
    int n = 8
    bubble_sort(data, n)

    for (int i = 0; i < n; i++) { print(data[i] + " ") }
    println("")
    return 0
}
```

```text
1 2 3 4 5 7 8 9 
```

::: tip 实际项目里直接用标准库
上面的代码是给你理解算法用的。真正写程序时用内置库更快更省事:

```c
import "sort.cin"

function main() -> int {
    int a[8] = {5, 3, 8, 1, 9, 2, 7, 4}
    sort_bubble(a, 8)              // 也有 sort_quick / sort_insertion
    bin_search(a, 8, 7)            // 二分查找 (数组需已排序)
    return 0
}
```

标准库清单见 [第 10 章](/beginner/ch10-modules) 与
[标准库参考](/stdlib/reference)。
:::

## 7.7 数组当参数: 要一起传长度

```c
function sum_of(int[] a, int n) -> int {
    int s = 0
    for (int i = 0; i < n; i++) {
        s += a[i]
    }
    return s
}

function main() -> int {
    int a[5] = {1, 2, 3, 4, 5}
    println("sum = " + sum_of(a, 5))

    int b[3] = {10, 20, 30}
    println("sum = " + sum_of(b, 3))       // 同一个函数能处理不同长度的数组
    return 0
}
```

```text
sum = 15
sum = 60
```

`int[] a` 是**指针形式**的数组参数 (不写长度); 数组按引用传递, 函数内修改元素外面能看到:

```c
function double_all(int[] a, int n) -> void {
    for (int i = 0; i < n; i++) {
        a[i] = a[i] * 2
    }
}
```

## 7.8 二维数组

```c
function main() -> int {
    int m[2][3]                        // 2 行 3 列
    for (int i = 0; i < 2; i++) {
        for (int j = 0; j < 3; j++) {
            m[i][j] = i * 3 + j + 1    // 依次填 1..6
        }
    }

    for (int i = 0; i < 2; i++) {
        for (int j = 0; j < 3; j++) {
            print(m[i][j] + " ")
        }
        println("")
    }
    println("m[1][2] = " + m[1][2])
    return 0
}
```

```text
1 2 3 
4 5 6 
m[1][2] = 6
```

二维数组按**行主序**存放 (先放完第一行再放第二行)。

::: danger 局部二维数组的 `{ {...}, {...} }` 字面量初始化当前无效
实测: 在**函数内部**写

```c
int m[2][3] = { {1, 2, 3}, {4, 5, 6} }    // 局部: 元素不会被写入 (读到 0/垃圾)
```

元素不会真的被初始化。三种可用写法:

1. **用循环填充** (上面的例子, 推荐);
2. **放到全局** (文件顶层) 再用字面量初始化 —— 全局的二维字面量是有效的;
3. **压成一维数组**自己算下标: `flat[i * cols + j]` —— 标准库 `matrix.cin` 就是这么做的。

```c
// 写法 2: 全局二维数组字面量 (有效)
int GRID[2][3] = { {1, 2, 3}, {4, 5, 6} }

function main() -> int {
    println("GRID[0][0] = " + GRID[0][0])    // 1
    println("GRID[1][2] = " + GRID[1][2])    // 6
    return 0
}
```

```c
// 写法 3: 一维数组模拟矩阵 (行主序)
function main() -> int {
    int flat[6]
    int rows = 2
    int cols = 3
    for (int i = 0; i < rows; i++) {
        for (int j = 0; j < cols; j++) {
            flat[i * cols + j] = i * cols + j + 1
        }
    }
    println("flat[0] = " + flat[0] + ", flat[5] = " + flat[5])
    return 0
}
```
:::

## 7.9 越界: 默认不检查

CIN 默认**不检查**数组越界 (和 C 一样), 越界写会踩到相邻数据, 且不报错:

```c
function main() -> int {
    int a[3] = {1, 2, 3}
    a[5] = 99                    // 越界! 但不会报错
    println("a[5] = " + a[5])    // a[5] = 99
    return 0
}
```

```text
a[5] = 99
```

怀疑有越界时, 打开检查开关 (会强制走纯 Python 解释执行):

```bash
codecin prog.cin --no-native --bounds-check
```

```text
+---------------- Execution Error -----------------+
| Runtime abort: bounds-check: index >= length (3) |
+--------------------------------------------------+
```

退出码为 `1`。修好越界后记得关掉它, 因为开启检查会更慢。

## 7.10 常见错误

| 现象 | 原因 | 解决 |
|------|------|------|
| 结果里混入奇怪的值 | 越界读写了相邻内存 | 检查下标范围; 用 `--bounds-check` |
| 遍历少一个/多一个 | `i <= n` 或 `i < n - 1` 写错 | 数组下标范围是 `0 .. n-1` |
| 函数里改了数组外面没变 | 参数写成了固长数组以外的东西? 实际是值传递错觉 | 数组是引用; 检查是否真的传了同一个数组 |
| 排序后有一个元素不对 | 内层边界写成 `n` 而不是 `n-1-i` | 对照 7.6 的代码 |
| 大数组导致崩溃 | 局部大数组占满栈 | 减小数组或用 `--mem-size` |

## 7.11 练习

1. 定义 `int a[6] = {4, 8, 15, 16, 23, 42}`, 打印所有元素与它们的和。
2. 找出数组中最大值的**下标** (不是值)。
3. 统计数组里有多少个偶数。
4. 把数组按**从大到小**排序 (改一下 7.6 的比较方向)。
5. 实现“数组去重”的简化版: 打印数组中第一次出现的元素 (`{1,2,1,3,2}` → `1 2 3`)。

参考实现见 [习题与答案 · 第 7 章](/beginner/exercises#第-7-章)。

## 7.12 本章小结

- 声明 `int a[5]`, 下标从 0 开始, 数组不记录长度 (自己传 `n`);
- 遍历用 `for (int i = 0; i < n; i++)`;
- 求和用累加模式, 求最值时初值取 `a[0]`;
- 查找用“标记 + break”, 反转/排序靠交换 (需要临时变量);
- 数组传参是引用语义, 函数内改动能被外面看到;
- 默认不检查越界, 排错时用 `--bounds-check`。

下一章: [字符串与文本处理](/beginner/ch08-strings)。
