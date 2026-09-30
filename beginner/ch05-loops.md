---
description: "第 5 章：CIN 循环——while / for / do-while、break 与 continue、累加与计数模式、嵌套循环与死循环防护。"
---

# 第 5 章 循环

::: info 本章目标
让程序“重复做事”: 求和、计数、遍历、打印表格。学会 `while`、`for`、`do-while`
与 `break` / `continue`, 并知道怎么避免死循环。
:::

## 5.1 while: 条件为真就一直做

```c
function main() -> int {
    int n = 5
    while (n > 0) {
        print(n + " ")
        n--              // 千万别忘了改条件变量, 否则死循环
    }
    println("发射!")
    return 0
}
```

```text
5 4 3 2 1 发射!
```

`while` 适合“不知道要循环几次”的场景, 例如“一直读到某个条件满足”。

## 5.2 for: 知道次数时最好用

语法: `for (初始化; 条件; 每轮结束后执行) { 循环体 }`

```c
function main() -> int {
    for (int i = 1; i <= 5; i++) {
        println("第 " + i + " 次循环")
    }
    return 0
}
```

```text
第 1 次循环
第 2 次循环
第 3 次循环
第 4 次循环
第 5 次循环
```

三段都可以省略:

| 写法 | 含义 |
|------|------|
| `for (int i = 0; i < n; i++)` | 从 0 数到 n-1 (最常见) |
| `for (int i = 1; i <= n; i++)` | 从 1 数到 n |
| `for (int i = n - 1; i >= 0; i--)` | 倒着数 |
| `for (int i = 0; i < n; i += 2)` | 每次加 2 (偶数步长) |
| `for (;;) { ... break ... }` | 无限循环, 靠 `break` 退出 |

初始化那一段既可以是**声明** (`int i = 0`), 也可以给**已有变量赋值** (`for (i = 0; i < n; i = i + 1)`)。

### 范围 for: 直接遍历定长数组

数组元素挨个处理时, 不用自己维护下标:

```c
function main() -> int {
    int scores[4] = {90, 75, 88, 60}
    int total = 0
    for (int s : scores) {
        total = total + s
    }
    println("总分: " + total)          // 总分: 313
    return 0
}
```

```text
总分: 313
```

- 冒号左边写**元素类型 + 变量名**, 右边是**定长数组** (长度写在类型里, 如 `int scores[4]`);
- `int[]` 这种指针形式参数与多维数组不能遍历, 会报 `range-for requires a fixed-size array`,
  这时改用下标循环;
- 循环变量是元素的**拷贝**, 改它不会改动原数组; `break` / `continue` 照常可用。

## 5.3 do-while: 至少执行一次

```c
function main() -> int {
    int i = 10
    do {
        println("循环体至少执行一次, i = " + i)
        i++
    } while (i < 3)
    return 0
}
```

```text
循环体至少执行一次, i = 10
```

区别: `while` 先判断再执行 (可能一次都不执行); `do-while` **先执行再判断**
(至少执行一次)。适合“先做一次、再看要不要继续”的场景, 例如菜单。

## 5.4 break 与 continue

- `break`: 立刻结束**当前这一层**循环;
- `continue`: 跳过本轮剩下的代码, 直接进入下一轮。

```c
function main() -> int {
    for (int i = 1; i <= 10; i++) {
        if (i % 5 == 0) continue      // 跳过 5 和 10
        if (i > 7) break              // 到 8 就整体结束
        print(i + " ")
    }
    println("")
    return 0
}
```

```text
1 2 3 4 6 7 
```

## 5.5 两个万能模式

### 累加 (求和、求积)

```c
function main() -> int {
    int sum = 0
    for (int i = 1; i <= 100; i++) {
        sum += i
    }
    println("1+2+...+100 = " + sum)
    return 0
}
```

```text
1+2+...+100 = 5050
```

### 计数 (满足条件的有几个)

```c
function main() -> int {
    int count = 0
    for (int i = 1; i <= 30; i++) {
        if (i % 3 == 0) {
            count++
        }
    }
    println("1..30 中 3 的倍数有 " + count + " 个")
    return 0
}
```

```text
1..30 中 3 的倍数有 10 个
```

::: tip 写循环的四步法
1. **初始化**累加/计数变量 (`sum = 0`);
2. 想清楚**循环变量**从哪开始、到哪结束 (`i = 1; i <= 100`);
3. 写**循环体** (累加/判断/打印);
4. 检查**边界**: 第一次和最后一次是否都正确? 这就是“差一错误”的高发区。
:::

## 5.6 嵌套循环

```c
function main() -> int {
    for (int i = 1; i <= 3; i++) {
        for (int j = 1; j <= 3; j++) {
            print((i * j) + " ")
        }
        println("")            // 内层跑完换行
    }
    return 0
}
```

```text
1 2 3 
2 4 6 
3 6 9 
```

内层循环每跑完一轮, 外层才前进一步。`break` 只跳出**离它最近的那一层**。

## 5.7 例子: 判断质数

```c
function main() -> int {
    int n = 29
    bool is_prime = n > 1
    for (int d = 2; d * d <= n; d++) {
        if (n % d == 0) {
            is_prime = false
            break                  // 找到因子就不用再找了
        }
    }
    println(n + (is_prime ? " 是质数" : " 不是质数"))
    return 0
}
```

```text
29 是质数
```

把 `n` 改成 `91` (= 7 × 13), 输出会变成 `91 不是质数`。

## 5.8 例子: 反转数字

```c
function main() -> int {
    int n = 12345
    int rev = 0
    while (n > 0) {
        rev = rev * 10 + n % 10     // 取出末位, 接到结果后面
        n = idiv(n, 10)             // 去掉末位 (整数除法)
    }
    println("反转结果 = " + rev)
    return 0
}
```

```text
反转结果 = 54321
```

## 5.9 死循环与保护

如果循环条件永远为真, 程序会一直跑。CIN 有**指令数上限**兜底
(默认 1 亿条指令), 到上限会停止并报错。你可以调小它来快速暴露问题:

```bash
codecin prog.cin --max-instructions 100000
```

::: danger 三种典型死循环
1. `while (n > 0) { ... }` 但循环体里忘了 `n--`;
2. `for (int i = 0; i < n; i--)` 方向写反;
3. `while (i < 10)` 里 `i` 只在 `if` 分支里自增, 某些情况下不增。

调试手段: 在循环体里打印 `i`, 或者用 `--debug` 看程序停在哪条指令
(见 [第 12 章](/beginner/ch12-debug))。
:::

## 5.10 常见错误

| 现象 | 原因 | 解决 |
|------|------|------|
| 程序卡住不返回 | 死循环 | 检查循环变量是否变化; 用 `--max-instructions` 限制 |
| 结果少算/多算 1 | 差一错误 (`<` 与 `<=` 混用) | 想清楚“数到几”, 必要时打印首末轮 |
| `break` 没生效 | 它在更内层的循环里 | 检查嵌套层级 |
| `continue` 后条件变量没变 | 把自增写在了 `continue` 之后 | 把 `i++` 放进 `for` 的第三段 |
| 内层循环次数不对 | 内层用了和外层相同的循环变量 | 内层换名 (`j`) |

## 5.11 练习

1. 计算 1 到 20 中所有偶数的和。
2. 打印 5 的乘法表 (`5 x 1 = 5` … `5 x 9 = 45`)。
3. 求 1 到 100 中能同时被 3 和 5 整除的数的个数。
4. 用 `while` 计算一个整数有多少位 (提示: 不断 `idiv(n, 10)` 直到 0)。
5. 打印 1 到 50 之间的所有质数 (提示: 把 5.7 的质数判断放进 `for`)。

参考实现见 [习题与答案 · 第 5 章](/beginner/exercises#第-5-章)。

## 5.12 本章小结

- `while` 先判断后执行, `do-while` 先执行后判断, `for` 适合已知次数;
- `break` 结束本层循环, `continue` 跳过本轮;
- 累加用 `sum += x`, 计数用 `count++`, 循环变量从哪到哪要想清楚;
- 嵌套循环里 `break` 只影响最近一层;
- 死循环靠 `--max-instructions` 兜底, 排查时打印循环变量最有效。

下一章: [函数与递归](/beginner/ch06-functions)。
