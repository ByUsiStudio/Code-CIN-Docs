---
description: "第 8 章：CIN 字符串——拼接、长度、比较、大小写、截取、查找、去空白、字符遍历与回文判断。"
---

# 第 8 章 字符串与文本处理

::: info 本章目标
学会处理文本: 拼接、求长度、比较、大小写转换、截取子串、查找、转数字,
以及逐字节遍历字符串 (做统计和回文判断)。
:::

## 8.1 字符串是什么

CIN 的 `string` 是 **NUL 结尾的字节序列**, 变量里保存的是“这段文本的地址”:

- 字面量 `"hello"` 放在**数据区**;
- 拼接 (`+`)、`strcpy`、`substr`、`upper` 等操作会产生**新的字符串**;
- 字符串**不能原地修改**: 想改就生成一个新的。

::: warning 因为是指针, 所以 `==` 不能比较内容
```c
string a = "ab" + "c"
string b = "abc"
println(a == b)              // false (地址不同)
println(strcmp(a, b) == 0)   // true  (内容相同)
```
**结论**: 字符串比较一律用 `strcmp(a, b) == 0` (相等)、`strcmp(a, b) < 0` (字典序在前)。
:::

## 8.2 拼接与转义

```c
function main() -> int {
    string first = "Code"
    string last = "CIN"
    string full = first + " " + last          // 拼接
    println(full)
    println("长度: " + strlen(full))
    println("带引号: \"引号\"")
    println("制表:\tTAB")                    // \t 是制表符
    println("第一行\n第二行")                 // \n 是换行
    return 0
}
```

```text
Code CIN
长度: 8
带引号: "引号"
制表:	TAB
第一行
第二行
```

常见转义: `\n` 换行、`\t` 制表、`\r` 回车、`\"` 双引号、`\\` 反斜杠、`\0` 空字符。

## 8.3 长度、比较、复制

```c
function main() -> int {
    string a = "apple"
    string b = "banana"

    println("strlen(a) = " + strlen(a))
    println("strcmp(a, b) = " + strcmp(a, b))
    println("strcmp(a, a) = " + strcmp(a, a))

    if (strcmp(a, "apple") == 0) {
        println("a 就是 apple")
    }

    string copy = strcpy(a)               // 复制出新字符串
    println(copy + " / " + a)
    return 0
}
```

```text
strlen(a) = 5
strcmp(a, b) = -1
strcmp(a, a) = 0
a 就是 apple
apple / apple
```

`strcmp` 的返回值: 负数表示前者在前, `0` 表示相等, 正数表示后者在前。不要假设一定是 `-1` / `1`。

## 8.4 大小写、去空白、截取、查找

```c
function main() -> int {
    string s = "  Hello, CIN  "
    println("原始长度: " + strlen(s))

    string t = trim(s)                        // 去掉首尾空白
    println("[" + t + "]")
    println("大写: " + upper(t))
    println("小写: " + lower(t))

    println("子串: " + substr(t, 0, 5))       // 从下标 0 取 5 个字符
    println("查找 CIN: " + indexof(t, "CIN"))
    println("查找 xyz: " + indexof(t, "xyz")) // 找不到返回 -1

    println("字符串转数字: " + atoi("456"))
    println("数字转字符串: " + int_to_str(789))
    return 0
}
```

```text
原始长度: 14
[Hello, CIN]
大写: HELLO, CIN
小写: hello, cin
子串: Hello
查找 CIN: 7
查找 xyz: -1
字符串转数字: 456
数字转字符串: 789
```

`ltrim` / `rtrim` 只去左边 / 右边; `substr(s, start, len)` 的 `len` 超出末尾会自动裁剪。

## 8.5 逐字符遍历: `s[i]`

`s[i]` 返回第 `i` 个字节的**整数编码** (`0..255`), 只能读、不能写:

```c
function main() -> int {
    string s = "Hello Code CIN"
    int n = strlen(s)
    int upper_cnt = 0
    int lower_cnt = 0
    int space_cnt = 0

    for (int i = 0; i < n; i++) {
        int c = s[i]
        if (c >= 'A' && c <= 'Z') { upper_cnt++ }
        if (c >= 'a' && c <= 'z') { lower_cnt++ }
        if (c == ' ') { space_cnt++ }
    }
    println("大写 " + upper_cnt + " 个, 小写 " + lower_cnt + " 个, 空格 " + space_cnt + " 个")
    return 0
}
```

```text
大写 5 个, 小写 7 个, 空格 2 个
```

字符和整数可以互相比较: `'A'` 就是 65, `c + 1` 也能用。

::: warning `s[i]` 不是数组元素
字符串不可原地修改, 所以 `s[0] = 'H'` 是**不允许**的。需要替换字符时:
用 `substr` 拼接出新的字符串。
:::

## 8.6 例子: 回文判断

回文 = 正着读和倒着读一样 (`level`、`上海自来水来自海上`)。

```c
function main() -> int {
    string s = "level"
    int n = strlen(s)
    bool ok = true
    for (int i = 0; i < idiv(n, 2); i++) {
        if (s[i] != s[n - 1 - i]) {
            ok = false
            break
        }
    }
    println(s + (ok ? " 是回文" : " 不是回文"))
    return 0
}
```

```text
level 是回文
```

把 `s` 换成 `"hello"`, 输出 `hello 不是回文`。

## 8.7 例子: 统计单词个数

思路: 数“从空白进入非空白”的次数。

```c
function main() -> int {
    string text = "the quick brown fox"
    int n = strlen(text)
    int words = 0
    bool in_word = false

    for (int i = 0; i < n; i++) {
        int c = text[i]
        bool is_space = (c == ' ') || (c == '\t') || (c == '\n')
        if (!is_space && !in_word) {
            words++
            in_word = true
        } else if (is_space) {
            in_word = false
        }
    }
    println("单词数: " + words)
    return 0
}
```

```text
单词数: 4
```

## 8.8 常见错误

| 现象 | 原因 | 解决 |
|------|------|------|
| 两个相同内容字符串比较为 false | 用了 `==` | 用 `strcmp(a, b) == 0` |
| `s[i] = ...` 报错 | 字符串不可原地修改 | 用 `substr` + 拼接生成新字符串 |
| 打印出乱码/截断 | 越界写坏了字符串 | 检查 `s[i]` 的 `i` 范围 |
| `atoi("abc")` 得到 0 | 解析失败返回 0, 不报错 | 先校验 (标准库 `validate` 的 `val_is_int`) |
| 循环里拼字符串后内存报错 | 每步都产生新字符串 | 减少拼接次数或 `--mem-size` 扩容 |

## 8.9 练习

1. 求字符串 `"Code CIN"` 的长度, 并打印第 1 个和最后 1 个字符的整数编码。
2. 把 `"  cin programming  "` 去空白后转大写并打印。
3. 统计字符串里数字字符 (`'0'..'9'`) 的个数。
4. 判断 `"上海自来水来自海上"` 是否是回文 (提示: 上面的代码直接用)。
5. 把 `"2026-09-26"` 拆成 `2026` / `09` / `26` 三个部分打印 (提示: `substr` + `indexof`)。

参考实现见 [习题与答案 · 第 8 章](/beginner/exercises#第-8-章)。

## 8.10 本章小结

- `string` 是 NUL 结尾的字节序列, 变量保存地址, 比较用 `strcmp`;
- 拼接用 `+`; 长度 `strlen`; 复制 `strcpy`; 截取 `substr`; 查找 `indexof`;
- 大小写 `upper`/`lower`; 去空白 `trim`/`ltrim`/`rtrim`; 转数字 `atoi`, 转文本 `int_to_str`;
- `s[i]` 逐字节只读访问, 字符就是整数编码;
- 所有“修改”都会产生新字符串, 循环里注意内存开销。

下一章: [struct 与数据建模](/beginner/ch09-structs)。
