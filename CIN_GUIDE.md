# CIN 编程指南

> CIN 是 Code CIN 的高级语言, 语法近似 C/Go: 函数、struct、数组 (含多维)、浮点、字符串。
> CIN 编译为 Code CIN 字节码后由 Go 原生引擎统一执行 (v5.9.0 起 native-only,
> 纯 Python 解释器与 JIT 已删除, 无解释器回退)。
> 开发环境/构建相关见 [开发者编译文档](BUILDING.md)。

---

## 目录

- [1. 第一个程序](#1-第一个程序)
- [2. 词法规则](#2-词法规则)
- [3. 类型系统](#3-类型系统)
- [4. 变量与作用域](#4-变量与作用域)
- [5. 运算符](#5-运算符)
- [6. 控制流](#6-控制流)
- [7. 函数](#7-函数)
- [8. struct](#8-struct)
- [9. 数组](#9-数组)
- [10. 字符串](#10-字符串)
- [11. 内建函数](#11-内建函数)
- [12. 内嵌 CPU 指令语句](#12-内嵌-cpu-指令语句)
- [13. 编译与运行](#13-编译与运行)
- [14. 限制与注意事项](#14-限制与注意事项)
- [15. 常见错误](#15-常见错误)

---

## 1. 第一个程序

```cin
function main() -> int {
    println("Hello, Code CIN!")
    println("2 + 3 = " + (2 + 3))
    return 0
}
```

运行:

```bash
codecin hello.cin
```

`main` 为入口 (不要求必须有 `main`, 程序从第一条指令开始执行, 按源码顺序先执行全局初始化)。

**语句以换行结尾** (分号可选)。字符串用 `+` 与任意类型拼接, `println` 自动追加换行。

---

## 2. 词法规则

| 元素 | 规则 |
|------|------|
| 注释 | `// 行注释` 与 `/* 块注释 */` |
| 标识符 | 字母/`_` 开头, 字母/数字/`_` 组成, 区分大小写 |
| 整数字面量 | `42`, `-7`, 前缀 `0xFF`(16) / `0b1010`(2) / `0o17`(8), 后缀 `u/U/l/L/f/F` 忽略, 数字下划线 `1_000` 允许 |
| 浮点字面量 | `3.14`, `1e-5`, `1.5f` (支持科学计数法与 `f` 后缀) |
| 字符字面量 | `'a'` `'\n'` `'\t'` `'\''` `'\\'` `'\0'` `'\a'` `'\b'` `'\f'` `'\v'` (值为整数字符编码) |
| 字符串字面量 | `"..."`, 支持转义 `\n \t \r \a \b \f \v \" \\ \0` 以及 `\xH` / `\xHH` (原始字节)、`\uHHHH` / `\UHHHHHHHH` (Unicode 码点) |
| 布尔字面量 | `true` / `false` |
| 语句分隔 | 换行 (推荐) 或 `;` |

**续行规则**: 圆括号/方括号内换行会自动连接; 行尾以运算符 (`+ - * / % & | ^ ~ << >> = += -= *= /= %= &= |= ^= <<= >>= ++ -- < > <= >= == != && || , . ->`) 结尾也会连接。花括号 `{}` 块内换行必须保留 (语句终止符)。

> 源文件开头的 UTF-8 BOM (`\ufeff`) 会被自动忽略。

```cin
// 可行: 行尾运算符续行
int long_result = value1 + value2 +
                  value3

// 可行: 括号内续行
float x = (a + b) *
          (c + d)
```

### 转义序列

字符字面量只接受**单字符转义** (见上表); 字符串字面量在此之上还支持十六进制字节与 Unicode 码点转义:

| 转义 | 含义 | 示例 |
|------|------|------|
| `\xH` / `\xHH` | **原始字节** (1~2 位十六进制, 直接写进字符串) | `"\xE4\xB8\xAD"` 就是 `"中"` 的 UTF-8 三字节 |
| `\uHHHH` | Unicode 码点 (必须正好 4 位十六进制), 按 UTF-8 编码写入 | `"\u4E2D"` 与 `"中"` 等价 |
| `\UHHHHHHHH` | Unicode 码点 (必须正好 8 位十六进制), 按 UTF-8 编码写入 | `"\U0001F600"` |
| `\a` `\b` `\f` `\v` | 报警 / 退格 / 换页 / 垂直制表 | 与 C 一致 |

```cin
string a = "\xE4\xB8\xAD"       // 原始字节: 中 (UTF-8: E4 B8 AD)
string b = "\u4E2D"             // Unicode 码点: 同样是 中
println(int_to_str(strlen(a)) + " " + int_to_str(strlen(b)))   // 3 3
println("\u4F60\u597D")         // 你好
println("A\tB\vC")              // 含制表与垂直制表
```

- `\x` 是**字节**语义: `"\xE4"` 写入的是单个字节 `0xE4`, 而不是按 UTF-8 编码的字符;
- `\u` / `\U` 是**码点**语义: 先解析出码点, 再按 UTF-8 编码写入 (所以 `\u4E2D` 也是 3 个字节);
- `\u` 必须写满 4 位、`\U` 必须写满 8 位, 否则报 `\u escape needs exactly 4 hex digits`
  (或 `\U escape needs exactly 8 hex digits`); 码点超过 `0x10FFFF` 报 `\u escape out of Unicode range`;
- `\x` 至少要有一位十六进制数字, 否则报 `\x escape needs at least one hex digit`;
- 未知转义 (如 `\q`) 保持**原样**: `"\q"` 得到的就是 `q`。

---

## 3. 类型系统

| 类型 | 说明 | 默认值 |
|------|------|--------|
| `int` | 64 位有符号整数 | `0` |
| `char` / `short` / `long` | 整数语法别名 (存储仍为 64 位槽) | `0` |
| `unsigned int` (及 `unsigned char/short/long`) | 无符号修饰 (同 64 位槽, 主要用于大数值字面量) | `0` |
| `float` | 64 位 IEEE754 浮点 | `0.0` |
| `bool` | 布尔 | `false` |
| `string` | NUL 结尾字符串指针 | `""` |
| `void` | 仅函数返回类型 | - |
| `StructName` | 用户定义 struct | 全零 |
| `EnumName` | 用户定义 enum (等价于 `int`) | `0` |
| `T[n]` / `T[n][m]` | 固长数组 (值语义) | 全零 |
| `T[]` / `int[][]` | 指针形式数组 (参数/返回) | 空指针 |

类型转换规则:

- `int` / `bool` 参与浮点运算时**自动提升**为 `float` ( `/` 恒为浮点除法; 整数取模用 `%` );
- `float -> int` 在赋值 (`int i = f`) 或显式内建 (`int_to_str`) 时截断转换;
- `bool` 打印为 `"true"` / `"false"`, 数值上下文中为 `1` / `0`。

### enum 枚举

`enum` 定义的成员是**编译期整数常量**, 枚举类型名可以直接当 `int` 使用:

```cin
enum Color { RED, GREEN = 5, BLUE }      // RED=0, GREEN=5, BLUE=6

Color c = BLUE                           // 枚举类型名等价于 int
println(int_to_str(c))                   // 6

int flags = RED | (1 << 8)               // 成员可直接参与表达式
switch (c) {
    case RED:         println("red");        break
    case GREEN, BLUE: println("green/blue"); break
    default:          println("other")
}
```

- 声明写在**文件顶层** (与 `struct` 同级), 语法为 `enum Name { 成员, ... }`, 结尾分号可省略;
- 未显式赋值的成员从 `0` 开始**自动递增** (上一个成员的值 +1);
- `= <整数常量表达式>` 可引用**先前已定义**的成员 (同一 enum 的先前成员, 或更早 enum 的成员),
  支持 `+ - * / % << >> & | ^` 与一元 `-` / `~`; 引用变量/函数等非常量会报
  `Enum member X initializer must be an integer constant expression`;
- 成员可用于表达式、全局初始化与 `case` 标签; 使用处**不受定义顺序限制** (成员名在整份文件解析完后才解析);
- 成员是**只读常量**: 赋值报 `Cannot assign to enum member: X (constants are read-only)`;
- 重复成员名报 `Duplicate enum member: X`; 空 enum 报 `Empty enum X`;
  成员名与关键字/全局变量冲突报 `Name 'X' is already used as an enum member or keyword`;
  成员值超出 64 位有符号范围报 `Enum member X out of 64-bit range`。

---

## 4. 变量与作用域

```cin
// 全局变量 (文件顶层)
int counter = 0
float pi = 3.14159265
string greeting = "hello"
Person admin                 // struct 默认全零
int primes[20]               // 固长数组
float grid[7][24]            // 二维数组
int matrix[2][3] = { {1, 2, 3}, {4, 5, 6} }   // 数组字面量

function demo() -> void {
    int local = 10           // 局部变量
    int a = 1, b = 2         // 一行多声明
    string s = "x" + "y"
    local = local + a        // 赋值
}
```

- 全局变量支持数组字面量 `{...}` 初始化 (可嵌套表示多维)。
- 局部变量在进入所在块时分配, 离开释放; 同名内层变量遮蔽外层。
- 未初始化的变量为类型默认值。

---

## 5. 运算符

按优先级从低到高 (越靠后结合越紧):

| 优先级 | 运算符 | 说明 | 适用类型 |
|--------|--------|------|----------|
| 1 | `?:` | 三目 `cond ? a : b` (短路, 结果可赋值) | bool 条件 |
| 2 | `\|\|` | 逻辑或 (短路) | bool (任意类型可转 bool) |
| 3 | `&&` | 逻辑与 (短路) | bool |
| 4 | `\|` | 位或 | int/bool |
| 5 | `^` | 位异或 | int/bool |
| 6 | `&` | 位与 | int/bool |
| 7 | `==` `!=` | 相等比较 | 全部 |
| 8 | `<` `>` `<=` `>=` | 关系比较 | int/float |
| 9 | `<<` `>>` | 左移 / 算术右移 (保留符号) | int/bool |
| 10 | `+` `-` | 加减, `+` 兼作字符串拼接 | int/float/string |
| 11 | `*` `/` `%` | 乘除取模 (`/` 浮点除, `%` 仅整数) | int/float |
| 12 | `!` `~` `-x` `++x` `--x` | 逻辑非 / 位取反 / 负号 / 前缀自增自减 | - |
| 13 | `x++` `x--` `[]` `.` `f()` | 后缀自增自减 / 下标 / 成员 / 调用 | - |
| 14 | `=` `+=` `-=` `*=` `/=` `%=` `&=` `\|=` `^=` `<<=` `>>=` | 赋值 (右结合, 左值地址只求值一次) | int/float 左值 |

`int` / `float` 均可复合赋值与自增自减 (自增对 float 每次 ±1.0); `%=` 及位运算复合赋值仅整数。
赋值/复合赋值/自增自减同时也是**表达式** (值为结果), 例如 `int y = ++x * 2`。

**位运算** (`& | ^ ~ << >>`, 仅整数; 复合 `&= |= ^= <<= >>=`):

```cin
int a = 0b1100 & 0b1010     // 8   (1000)
int b = 0b1100 | 0b1010     // 14  (1110)
int c = 0b1100 ^ 0b1010     // 6   (0110)
int d = 1 << 4              // 16
int e = -16 >> 2            // -4  (算术右移, 保留符号)
int f = ~0                  // -1  (位取反)
int m = 0xFF
m &= 0x0F                   // 15
m <<= 4                     // 240
```

> `<<` 左移在低位补 0; `>>` 为**算术右移** (符号位扩展), 对负数保持符号。移位量按低 6 位 (`& 63`) 取模。

字符串拼接: `+` 任意一侧为 `string` 时, 另一侧自动字符串化 (int/float/bool)。

```cin
println("Age: " + 18)            // Age: 18
println("PI: " + 3.14)           // PI: 3.14
println("OK: " + true)           // OK: true
```

---

## 6. 控制流

### if / else

```cin
if (x > 0) {
    println("positive")
} else if (x == 0) {
    println("zero")
} else {
    println("negative")
}

// 单语句体可省略花括号
if (done) return
```

### while

```cin
while (n > 0) {
    sum = sum + n
    n = n - 1
}
```

### for

```cin
for (int i = 0; i < 10; i = i + 1) {
    println("i = " + i)
}
```

三段均可省略: `for (;;) { break }`。init 段支持类型声明, 也支持**赋值表达式**:

```cin
int i
for (i = 0; i < 10; i = i + 1) {    // init 段直接给已有变量赋值
    println("i = " + i)
}
```

update 段同样是赋值表达式。

### 范围 for (遍历定长数组)

`for (T v : arr)` 依次把 `arr` 的每个元素拷进 `v`, 元素类型可以是标量、`string` 或 struct:

```cin
int data[5] = {10, 20, 30, 40, 50}

int total = 0
for (int v : data) {
    total = total + v               // 10+20+30+40+50
}
println(int_to_str(total))          // 150

string names[3] = {"ann", "bob", "cid"}
for (string s : names) {
    println(s)                      // 每行一个名字
}
```

- 被遍历对象必须是**定长数组** (`int a[5]` / `float m[3]` / `string names[3]`, 含声明为
  `int[5]` 的形参): 指针形式 (`int[]` / `int[][]`) 会报
  `range-for requires a fixed-size array`;
- 元素类型**不能是数组**: 多维数组请用下标循环 (`for (int i = 0; i < n; i++)`),
  否则报 `range-for over multi-dimensional arrays is not supported`;
- 循环变量在每轮迭代开始时**拷贝**当前元素, 修改它不会写回原数组;
- `break` / `continue` 与普通 `for` 一致 (`continue` 走到下一个元素)。

### break / continue

```cin
while (true) {
    x = x + 1
    if (x >= 10) {
        break
    }
    if (x % 2 == 0) {
        continue
    }
    println("odd: " + x)
}
```

条件短路求值: `&&` 左侧为假时右侧不求值; `||` 左侧为真时右侧不求值。

### do-while

```cin
int n = 0
do {
    n++
} while (n < 3)          // 至少执行一次, n 最后为 3
```

`continue` 跳转到条件求值处; `break` 直接退出。

### switch / case / default

```cin
int tier = grade / 25     // 除法为 float, 赋值给 int 即截断
switch (tier) {
    case 0: println("low");    break
    case 1: println("medium"); break
    case 2:
    case 3: println("high");   break   // case 贯穿 (fallthrough)
    default: println("top")            // 无 break 将贯穿到后续语句
}
```

- 选择表达式与 `case` 常量必须是整数 (支持 `case 2+3` 常量表达式、`'A'` 等字面量与**枚举成员**);
- 分支体 **默认贯穿**到下一个 case (与 C 一致), 用 `break` 跳出整个 switch;
- `break` 跳出的是最近一层 switch/loop; switch 内嵌套循环时 `continue` 仍作用于循环;
- `default` 可出现在任意位置, 无匹配时执行; 无 `default` 且无匹配则整段跳过。

一个 `case` 标签还可以列出**多个值**或**闭区间** `lo..hi` (逗号分隔, 可混用, 支持负数):

```cin
switch (n) {
    case 1, 2, 7..9:  println("small or 7-9"); break
    case -3..-1:      println("negative");     break
    case 10, 20..25:  println("mixed");        break
    default:          println("other")
}
```

`7..9` 含 7 与 9 (闭区间), 要求 `lo <= hi`, 否则报 `Empty case range: lo..hi`;
多值/范围只是把多个比较合并到一个分支, **贯穿语义不变**。

### 三目表达式

```cin
string status = (score >= 60) ? "pass" : "fail"
int sign = (x < 0) ? -1 : 1
```

三目为短路表达式: 只求值被选中一侧; int/float 混用时按 float 提升, 两侧同为 string 才允许字符串结果。

---

## 7. 函数

```cin
// 定义: function 名(参数表) -> 返回类型 { ... }
function add(int a, int b) -> int {
    return a + b
}

function swap(int[] arr, int i, int j) -> void {
    int t = arr[i]
    arr[i] = arr[j]
    arr[j] = t
}

// 无返回值时 -> 可省略 (默认 void)
function greet() {
    println("hi")
}
```

- 参数按值传递; 数组参数 (`int[]` / `T[]`) 与 struct 退化为引用传递 (修改可见)。
- 固长数组作参数写 `int[5]`, 传入后衰减为指针形式。
- 递归支持 (调用栈由 VM 栈承载, 默认栈深有限, 见 [限制](#14-限制与注意事项))。
- 返回值通过 `X0` 传递, `void` 函数 `return` 可省略。

---

## 8. struct

```cin
struct Point {
    float x
    float y
}

struct Rectangle {
    Point top_left        // 嵌套 struct (值内嵌)
    Point bottom_right
    float area
}

function area(Rectangle r) -> float {
    float w = r.bottom_right.x - r.top_left.x
    float h = r.bottom_right.y - r.top_left.y
    return w * h
}
```

- 成员访问用 `.`, 支持链式: `r.bottom_right.x`。
- struct 可整体赋值/传参/返回 (值语义拷贝); 数组字段为值内嵌。

```cin
struct Student {
    Person info
    int grades[5]         // 固长数组字段
    float gpa
}

function make(string name, int age) -> Student {
    Student s
    s.info.name = name
    s.info.age = age
    s.grades[0] = 95
    s.gpa = 88.5
    return s
}
```

> struct 字段不能是变长指针数组 (`T[]`); 只允许标量、嵌套 struct 与固长数组。

---

## 9. 数组

```cin
int a[5]                        // 一维, 全零
float m[3][4]                   // 二维 (行主序)
int init[4] = {1, 2, 3, 4}      // 字面量初始化
int ident[2][2] = { {1, 0}, {0, 1} }

function sum(int[] arr, int n) -> int {
    int s = 0
    for (int i = 0; i < n; i = i + 1) {
        s = s + arr[i]
    }
    return s
}

function zeros(int n) -> int[] {   // 指针数组作返回值
    int[] r
    for (int i = 0; i < n; i = i + 1) {
        r[i] = 0
    }
    return r
}
```

- 下标从 0 开始; 多维逐维下标: `m[day][hour]`。
- 数组名作表达式使用时是指针 (基址); `arr[i]` 即基址偏移取值。
- 局部声明中 `int[] r` 为指针形式, 指向堆/数据区由运行时分配。

---

## 10. 字符串

字符串是 NUL 结尾的字节序列, `string` 变量持有指针。

```cin
string s = "hello"
string t = s + " " + "world"    // 拼接产生新堆块
println(t)                      // hello world
println(strlen(t))              // 11

if (strcmp(s, "hello") == 0) {
    println("equal")
}

string copy = strcpy(s)         // 拷贝为新堆块
```

- `+` 拼接右侧任意类型: `"n = " + 42`、`"pi = " + 3.14`、`"ok = " + true`。
- 字符串字面量支持 `\n \t \r \a \b \f \v` 与 `\x`(原始字节) / `\u` / `\U`(Unicode 码点) 转义, 见 [词法规则](#转义序列)。
- 支持 `s[i]` 读取单字节 (按字节下标, 返回 0–255 整数编码, 无越界检查);
  字符串不可原地修改, `s[i]` 不能作为赋值左值。
- 字符串内建: `strlen` / `strcmp` / `strcpy` / `substr` / `indexof` / `trim` / `atoi` 等 (见下表)。

---

## 11. 内建函数

| 函数 | 签名 | 说明 |
|------|------|------|
| `print(x, ...)` | void | 依次输出各参数 (无分隔符, 自动字符串化) |
| `println(x, ...)` | void | 同上并追加换行; **无参输出空行** |
| `input()` | int | 读入一行并解析为整数 (失败为 0) |
| `abs(x)` | int | 整数绝对值 |
| `sqrt(x)` | float | 平方根 |
| `pow(x, y)` | float | x 的 y 次幂 |
| `sin(x)` / `cos(x)` / `tan(x)` | float | 三角函数 (弧度) |
| `rand()` | int | 非负随机整数 |
| `srand(n)` | void | 设置随机种子 |
| `time()` | int | Unix 时间戳 (秒) |
| `time_us()` | int | 单调时钟微秒数 (高精度基准测试) |
| `time_ns()` | int | 单调时钟纳秒数 (time_us 的高分辨率版本) |
| `to_int(x)` | int | 显式转 int (float 向零截断; 非数值报编译错) |
| `to_float(x)` | float | 显式转 float (整数提升) |
| `arg_count()` | int | 传给 CIN 程序的参数个数 (不含程序文件名) |
| `arg(i)` | string | 第 i 个命令行参数 (越界为空串) |
| `input_str()` | string | 读入一行 UTF-8 文本 (不含行尾; EOF 为空串) |
| `strlen(s)` | int | 字符串长度 |
| `strcmp(a, b)` | int | 字典序比较 (<0 / 0 / >0) |
| `strcpy(s)` | string | 复制为新堆块 |
| `int_to_str(n)` (别名 `itoa`) | string | 整数 → 十进制字符串 |
| `float_to_str(f)` (别名 `ftoa`) | float | 浮点 → 字符串 (自动提升 int/bool) |
| `bool_to_str(b)` | string | 布尔 → `"true"` / `"false"` |
| `substr(s, start, len)` | string | 子串 (新堆块, 越界自动裁剪) |
| `indexof(hay, needle)` | int | 首次出现位置, 未找到为 `-1` |
| `upper(s)` / `lower(s)` | string | ASCII 大小写转换 (新堆块) |
| `trim(s)` / `ltrim(s)` / `rtrim(s)` | string | 去首尾 / 前导 / 尾部空白 (新堆块) |
| `atoi(s)` | int | 字符串 → 十进制整数 (前导空白忽略, 失败为 `0`) |
| `floor(x)` / `ceil(x)` | float | 向下 / 向上取整 (结果仍为 float) |
| `round(x)` | float | 四舍五入 (`floor(x + 0.5)`, 半值向 +∞) |
| `min(a, b)` / `max(a, b)` | int/float | 数值最小 / 最大值 (int/float 混用按 float 提升) |
| `idiv(a, b)` | int | 整数除法 (向零截断; `/` 恒为浮点除) |

内建在表达式任意位置可用; 数值参数按需自动提升为 float。

`print` / `println` 支持**多个参数**, 依次字符串化后连续输出 (参数之间**不加分隔符**),
需要分隔时自己拼进字符串:

```cin
int a = 3
string b = "cin"
println("a=", a, " b=", b)      // a=3 b=cin
print("no", "newline")          // 不换行
println()                       // 空行
```

示例:

```cin
function math_demo() -> void {
    float angle = pi / 4
    println("sin(45°): " + sin(angle))
    println("sqrt(16): " + sqrt(16))
    println("pow(2, 8): " + pow(2, 8))
    println("abs(-42): " + abs(-42))
}
```

### 宿主能力: 2D 绘图画布 (导出 PNG)

CIN 内置一个跨平台的 2D 绘图画布（Go 标准库实现，导出 PNG）。同一时刻存在一个「当前画布」与「当前画笔颜色」（默认黑色，背景白色）。

| 函数 | 签名 | 说明 |
|------|------|------|
| `canvas(w, h)` | void | 新建 w×h 画布 (白底) |
| `set_color(rgb)` | void | 设置画笔颜色 `0xRRGGBB` |
| `fill_rect(x, y, w, h)` | void | 填充矩形 |
| `fill_circle(cx, cy, r)` | void | 填充圆 |
| `draw_line(x0, y0, x1, y1)` | void | 画线 (Bresenham) |
| `draw_text(x, y, s)` | void | 绘制文本 (内置 5×7 点阵字库; 小写自动转大写) |
| `save_png(path)` | int | 导出 PNG, 返回 `0` 成功 / `-1` 失败 |
| `show_canvas()` | int | 保存当前画布到临时 PNG 并用系统查看器打开 (跨平台「窗口」) |

```cin
function draw() -> int {
    canvas(200, 100)
    set_color(0xFF0000)            // 红
    fill_rect(0, 0, 80, 100)
    set_color(0x0000FF)            // 蓝
    fill_circle(140, 50, 40)
    set_color(0x00FF00)            // 绿
    draw_line(0, 0, 199, 99)
    set_color(0x000000)            // 黑
    draw_text(4, 4, "HELLO")
    return save_png("out.png")     // 0 成功
}
```

也可以直接用系统查看器弹出窗口查看: `show_canvas()`。

> 交互式**控件**版 (按钮/输入框) 依赖桌面图形库（如 Fyne），当前沙箱无网络无法引入外部依赖，
> 故先提供画布 + PNG 导出 + 系统查看器窗口；控件版为后续项。

### 宿主能力: 联网音频 (下载 + 播放 + 控制)

| 函数 | 签名 | 说明 |
|------|------|------|
| `audio_play(url)` | int | 下载 `http/https` URL 或读取本地文件并播放 (WAV/PCM)，返回 `0` 成功 / `-1` 失败 |
| `audio_stop()` | void | 停止当前播放 |
| `audio_volume(v)` | void | 设置音量 `0..100` (支持则生效, 否则忽略) |
| `audio_wait()` | void | 阻塞到当前播放结束 (按 WAV 头时长估算) |

```cin
function music() -> int {
    int ok = audio_play("https://example.com/tone.wav")
    if (ok == 0) {
        audio_volume(80)
        audio_wait()
    }
    return ok
}
```

> MP3/OGG 解码依赖外部库，当前仅支持 WAV(PCM)；音频与 GUI 由 **Go 原生引擎**实现。

### 宿主能力: 系统原生交互 (Windows / Linux / macOS)

| 函数 | 签名 | 说明 |
|------|------|------|
| `file_read(path)` | string | 读文件内容 (失败为空串) |
| `file_write(path, s)` | int | 覆盖写; `0` 成功 / `-1` 失败 |
| `file_append(path, s)` | int | 追加写 |
| `file_exists(path)` | int | `1` 存在 / `0` 不存在 |
| `file_delete(path)` | int | 删除文件或空目录 |
| `file_size(path)` | int | 字节数 / `-1` |
| `mkdir(path)` | int | 递归创建目录 |
| `dir_list(path)` | string | 换行分隔条目 (目录名带 `/`) |
| `exec(cmd)` | int | 执行 shell 命令, 返回退出码 |
| `exec_output(cmd)` | string | 执行并返回 stdout |
| `getenv(name)` | string | 读环境变量 (未设置为空串) |
| `setenv(name, value)` | int | 设置环境变量 |
| `os_name()` | string | `"windows"` / `"darwin"` / `"linux"`; Android 原生构建返回 `"android"` |
| `hostname()` | string | 主机名 |
| `username()` | string | 用户名 |
| `cwd()` | string | 当前工作目录 |
| `home_dir()` | string | 用户主目录 |

```cin
string f = "data.txt"
file_write(f, "hello")
file_append(f, " world")
println(file_read(f))                       // hello world
println("size=" + int_to_str(file_size(f)))
println("os=" + os_name())
println("cwd=" + cwd())
println(exec_output("echo hi"))             // hi
setenv("MY_VAR", "42")
println(getenv("MY_VAR"))                   // 42
```

> `exec` / `exec_output` 经平台默认 shell 执行 (Windows: `cmd /c`, 其他: `sh -c`)。
> 系统交互为 **Go 原生能力**, 具备真实文件/进程权限, 请谨慎使用。

### 宿主能力: Termux API (Android)

在 Termux 中执行 `pkg install termux-api` 并安装 **Termux:API** 应用后可用; 非 Termux 环境所有调用优雅失败 (返回 `-1` 或空串)。

| 函数 | 签名 | 说明 |
|------|------|------|
| `termux_available()` | int | `1` 可用 / `0` 不可用 |
| `termux_notify(title, content)` | int | 系统通知 |
| `termux_toast(msg)` | int | Toast 提示 |
| `termux_clipboard_get()` | string | 读剪贴板 |
| `termux_clipboard_set(s)` | int | 写剪贴板 |
| `termux_battery()` | string | 电池状态 (JSON) |
| `termux_vibrate(ms)` | int | 振动指定毫秒 |
| `termux_tts(text)` | int | 文字转语音 |
| `termux_location()` | string | 定位信息 (JSON) |
| `termux_wifi_info()` | string | WiFi 连接信息 (JSON) |
| `termux_dialog(title)` | string | 弹出输入对话框 (JSON) |
| `termux_sms_send(number, text)` | int | 发送短信 |

```cin
if (termux_available() == 1) {
    termux_notify("Code CIN", "任务完成")
    termux_toast("hello from CIN")
    termux_vibrate(200)
    termux_tts("done")
    println(termux_battery())
    println(termux_clipboard_get())
}
```

> 示例: `examples/system_interaction.cin`; Termux 一键安装见 `script/install_termux.sh`。

### 宿主能力: 路径与文件系统扩展

| 函数 | 签名 | 说明 |
|------|------|------|
| `path_join(dir, name)` | string | 拼接路径 (使用**当前平台**分隔符: Windows `\`, Linux/Android `/`) |
| `path_basename(p)` | string | 路径末段名 |
| `path_dirname(p)` | string | 去掉末段后的目录 (同样使用当前平台分隔符) |
| `path_abs(p)` | string | 绝对路径 (不要求路径已存在; 失败为空串) |
| `file_copy(src, dst)` | int | 复制文件; `0` 成功 / `-1` 失败 |
| `file_move(src, dst)` | int | 移动或重命名; `0` 成功 / `-1` 失败 |
| `dir_remove(p)` | int | **递归删除**目录及其全部内容; `0` 成功 / `-1` 失败 |
| `is_dir(p)` | int | `1` 是目录 / `0` 不是目录 (含不存在) |
| `file_mtime(p)` | int | 修改时间 (Unix 秒) / `-1` 失败 |
| `temp_dir()` | string | 系统临时目录 |
| `chdir(p)` | int | 切换当前工作目录; `0` 成功 / `-1` 失败 |

```cin
string dir = temp_dir()
string file = path_join(dir, "cin_demo.txt")

file_write(file, "hello")
println(path_basename(file))            // cin_demo.txt
println(path_dirname(file))             // 与 temp_dir() 同样的目录
println(path_abs("cin_demo.txt"))       // 绝对路径
println("是目录? " + int_to_str(is_dir(dir)))     // 1
println("修改时间: " + int_to_str(file_mtime(file)))
chdir(dir)                              // 之后相对路径基于 dir
file_copy(file, path_join(dir, "copy.txt"))
file_move(path_join(dir, "copy.txt"), path_join(dir, "moved.txt"))
println("清理: " + int_to_str(dir_remove(path_join(dir, "moved.txt"))))
```

### 宿主能力: 时间与系统信息

| 函数 | 签名 | 说明 |
|------|------|------|
| `time_ms()` | int | Unix 时间戳 (毫秒) |
| `sleep_ms(ms)` | int | 阻塞睡眠指定毫秒, 返回 `0`; **单次上限 10 分钟** (超出按 10 分钟计) |
| `cpu_count()` | int | 逻辑 CPU 数 |
| `arch_name()` | string | 目标架构: `"amd64"` / `"arm64"` / `"386"` / `"arm"` … |
| `mem_info()` | string | JSON `{"total_kb":N,"free_kb":M}`; 未知平台为 `{"total_kb":0,"free_kb":0}` |
| `is_android()` | int | `1` Android (含 Termux) / `0` |

```cin
println("秒: " + int_to_str(time()))
println("毫秒: " + int_to_str(time_ms()))
println("CPU: " + int_to_str(cpu_count()) + " 架构: " + arch_name())
println(mem_info())                     // {"total_kb":...,"free_kb":...}
println("Android? " + int_to_str(is_android()))
sleep_ms(200)                           // 睡 200 毫秒 (上限 600000)
```

### 宿主能力: 网络 (HTTP/HTTPS)

| 函数 | 签名 | 说明 |
|------|------|------|
| `http_get(url)` | string | GET 并返回响应体; 失败为空串 (**15 秒超时, 响应体上限 8 MiB**) |
| `http_post(url, body)` | string | POST (`text/plain; charset=utf-8`) 并返回响应体; 失败为空串 (同样 15 秒 / 8 MiB) |
| `http_req(method, url, headers, body)` | string | 自定义方法/头部/请求体的 HTTP 请求; `headers` 为 `\n` 分隔的 `"K: V"`, 无则传空串; 失败为空串 |
| `http_code()` | int | 最近一次 `http_get` / `http_post` / `http_req` 的 HTTP 状态码 (无请求为 `-1`) |
| `download(url, path)` | int | 下载到本地文件; `0` 成功 / `-1` 失败 (**非 2xx 状态码算失败**; 落盘上限 256 MiB) |

> `http_get` / `http_post` / `http_req` **不检查状态码**: 非 2xx 也会返回响应体,
> 状态码一律用 `http_code()` 读取 (三者语义一致); `download` 则把非 2xx 视为失败。

```cin
string body = http_get("https://example.com/")
println("状态码: " + int_to_str(http_code()))
if (strlen(body) > 0) {
    println("长度: " + int_to_str(strlen(body)))
}
string echo = http_post("https://example.com/api", "name=cin")
println("POST 返回 " + int_to_str(strlen(echo)) + " 字节")
int rc = download("https://example.com/logo.png", "logo.png")
println("download = " + int_to_str(rc))       // 0 成功
```

### 宿主能力: 网络 (TCP / UDP / DNS, 标准库 `lib/net.cin`)

| 函数 | 签名 | 说明 |
|------|------|------|
| `tcp_dial(host, port)` | int | 连接 TCP 服务端, 返回连接句柄 (失败 `-1`) |
| `tcp_send(h, data, len)` | int | 发送数据, 返回已发送字节 (失败 `-1`) |
| `tcp_recv(h, buf, max)` | int | 接收到 `buf`, 返回实际字节 (对端关闭为 `0`) |
| `tcp_close(h)` | int | 关闭连接; `0` 成功 / `-1` 失败 |
| `tcp_listen(port)` | int | 监听端口, 返回监听句柄 (失败 `-1`) |
| `tcp_accept(lh)` | int | 接受连接, 返回连接句柄 (失败 `-1`) |
| `udp_open(port)` | int | 打开 UDP 套接字 (`port` 传 `0` 由系统分配), 返回句柄 (失败 `-1`) |
| `udp_sendto(h, host, port, data, len)` | int | 发送数据报到指定地址, 返回已发送字节 (失败 `-1`; 地址解析偏好 IPv4) |
| `udp_recvfrom(h, buf, max, src_buf)` | int | 接收数据报, 返回实际字节; 来源 `"ip:port"` 写入 `src_buf` (传 `0` 不关心) |
| `udp_close(h)` | int | 关闭套接字; `0` 成功 / `-1` 失败 |
| `dns_lookup(host)` | string | 解析域名, 返回首个 IP 地址 (失败为空串) |

```cin
import "net.cin"

// TCP echo 一步到位: 连接 -> 发送 -> 收一行 -> 关闭 (失败返回空串)
string resp = tcp_roundtrip("127.0.0.1", 7000, "hello")
println(resp)

// UDP 单发 (底层内建; 失败返回 -1, 不抛异常)
int u = udp_open(0)                      // port 传 0 由系统分配
if (u != -1) {
    udp_sendto(u, "127.0.0.1", 9000, "hi", 2)
    udp_close(u)
}
```

> `import "net.cin"` 提供字符串收发 / 按行接收 / 自定义头 HTTP 等封装
> (`tcp_send_str` / `tcp_recv_line` / `http_get_headers` / `http_ok` ...);
> 底层内建签名见上表。注意: 引擎的地址解析偏好 IPv4, 在 fake-ip 代理
> 环境下任意域名都可能"解析成功", 请以实际连接结果为准。

### 宿主能力: FFI 动态库调用 (标准库 `lib/ffi.cin`)

加载本机动态库 (`.dll` / `.so` / `.dylib`) 并调用其导出函数, 最多 8 个 int64 参数;
`ffi_callf` 用于返回浮点的函数 (浮点参数正确走 XMM 寄存器)。

| 函数 | 签名 | 说明 |
|------|------|------|
| `dlopen(path)` | int | 加载动态库, 返回库句柄 (失败 `-1`) |
| `dlsym(h, name)` | int | 取符号地址, 返回函数句柄 (失败 `-1`) |
| `ffi_call(fn, args, n)` | int | 调用函数: `args` 为 8 字节对齐的 int64 数组指针, `n` 为参数个数 (≤8), 返回 int64 |
| `ffi_callf(fn, args, n)` | float | 同上, 返回值按 float64 解释 |
| `lib_close(h)` | int | 卸载动态库; `0` 成功 / `-1` 失败 |

```cin
import "ffi.cin"

// 库内封装: ffi_load / ffi_find / ffi_call0..8 / ffi_free (失败返回 0)
int lib = ffi_load("kernel32.dll")       // Linux: "libc.so.6"; macOS: "libc.dylib"
if (lib != 0) {
    int fn = ffi_find(lib, "GetTickCount64")
    if (fn != 0) {
        println(int_to_str(ffi_call0(fn)))   // 开机毫秒数
    }
    ffi_free(lib)
}
```

> FFI 调用的是**宿主机原生代码**, 无任何沙箱隔离, 请只加载可信库;
> `--sandbox` 模式下整组 FFI 调用被禁用。

### 宿主能力: 编码与哈希

| 函数 | 签名 | 说明 |
|------|------|------|
| `sha256(s)` | string | SHA-256 十六进制摘要 (**小写**) |
| `base64_encode(s)` | string | 标准 Base64 编码 (带 `=` 填充) |
| `base64_decode(s)` | string | Base64 解码; **非法输入返回空串** |

```cin
string sum = sha256("hello")
println(sum)                                  // 2cf24dba5fb0a30e...
string enc = base64_encode("hello")
println(enc)                                  // aGVsbG8=
println(base64_decode(enc))                   // hello
println("长度 " + int_to_str(strlen(base64_decode("!!非法!!"))))   // 0
```

### 宿主能力: 桌面集成 (剪贴板 / 通知 / 打开 URL)

| 函数 | 签名 | 说明 |
|------|------|------|
| `clipboard_get()` | string | 读剪贴板文本 (失败为空串, 末尾换行会被去掉) |
| `clipboard_set(s)` | int | 写剪贴板; `0` 成功 / `-1` 失败 |
| `notify(title, body)` | int | 弹出系统通知; `0` 成功 / `-1` 失败 |
| `open_url(url)` | int | 用默认浏览器/查看器打开; `0` 成功 / `-1` 失败 |

分发顺序是 **Termux 优先 → 平台原生命令**; 依赖的命令不存在时**优雅失败** (返回 `-1` 或空串), 不抛异常:

| 平台 | 剪贴板读 | 剪贴板写 | 通知 | 打开 URL |
|------|----------|----------|------|----------|
| Windows | PowerShell `Get-Clipboard -Raw` | `cmd /c clip` | PowerShell `Wscript.Shell.Popup` (**10 秒后自动消失**) | `cmd /c start "" <url>` |
| Linux | `wl-paste` → `xclip -o` → `xsel -b` | `wl-copy` → `xclip -i` → `xsel -b -i` | `notify-send` | `xdg-open` |
| macOS | `pbpaste` | `pbcopy` | `osascript` (`display notification`) | `open` |
| Android / Termux | `termux-clipboard-get` | `termux-clipboard-set` | `termux-notification` | `termux-open-url` |

```cin
clipboard_set("来自 CIN 的文本")
println(clipboard_get())                // 来自 CIN 的文本
println("通知结果: " + int_to_str(notify("Code CIN", "任务完成")))
println("打开结果: " + int_to_str(open_url("https://example.com")))
```

### 宿主能力: 键盘输入监听 (非阻塞轮询)

面向游戏循环 / TUI 的**非阻塞**键盘轮询, 需**真实终端**: 首次调用会把终端切到
原始输入 (不回显、无行缓冲), 程序退出自动恢复。管道 / 重定向 / IDE 捕获输出的
环境下**优雅失败** (`key_hit` 恒 `0`, `get_key` 恒 `-1`), 不阻塞、不报错。

键码约定:

| 返回值 | 含义 |
|--------|------|
| `0..255` | 原始字节: 字母 / 数字 / `Enter`=13 / `Tab`=9 / `Backspace`=8 / `Esc`=27; Ctrl+字母 = 字母 & 0x1F (Ctrl+C 即 `3`, 监听期间**不会**终止程序) |
| `1001..1010` | `↑ ↓ ← →` / Home / End / PgUp / PgDn / Ins / Del |
| `1021..1030` | F1 .. F10 |
| `-1` | 无按键 |

| 函数 | 签名 | 说明 |
|------|------|------|
| `key_hit()` | int | `1` 有待读按键 / `0` 无 |
| `get_key()` | int | 取出一个键码 (原始字节或扩展码); 无按键 `-1` |
| `key_flush()` | int | 清空键盘输入缓冲; `0` |

推荐 `import "key.cin"` 用 `K_*` 常量与辅助函数:

```cin
import "key.cin"

// 小游戏循环: 方向键移动, Q 退出
while (1) {
    int k = get_key()
    if (k == K_LEFT)  { x = x - 1 }
    if (k == K_RIGHT) { x = x + 1 }
    if (k == K_UP)    { y = y - 1 }
    if (k == K_DOWN)  { y = y + 1 }
    if (k == k_ctrl('Q') || k == K_ESC) { break }
    // ... 更新 / 重绘 ...
    sleep_ms(16)
}
```

> Windows 用 msvcrt `_kbhit`/`_getch`, Linux / macOS / Termux 用 termios 原始输入
> (只关行缓冲 / 回显 / Ctrl+C 信号, 输出处理保留, `println` 不受影响);
> 激活监听时会**清空终端输入残留** (Windows `FlushConsoleInputBuffer` /
> Unix 非阻塞排空), Windows 下还先用 `GetConsoleMode` 校验 stdin 为真实控制台。
>
> **输出顺序**: 真实终端下原生路径先打印激活前已缓冲的输出, 之后逐条直写
> stdout 实时显示 —— "提示 → 等按键 → 反馈"顺序正确, 不会等程序结束一股脑输出;
> 管道 / 重定向 / 测试捕获环境保持缓冲回传, 行为不变。

### 宿主能力: Android / Termux 扩展

在 Android/Termux 之外, 这一组调用**一律优雅失败** (返回 `-1` 或空串), 不抛异常:

| 函数 | 签名 | 说明 |
|------|------|------|
| `android_intent(action, uri)` | int | 发起系统 Intent (`am start -a <action> -d <uri>`; Termux 下回退 `termux-am`); Android 之外返回 `-1` |
| `termux_call(number)` | int | 拨号 (`termux-telephony-call`) |
| `termux_share(file)` | int | 系统分享文件 (`termux-share -a send`) |
| `termux_torch(on)` | int | 手电筒开/关 (`termux-torch`, 非 0 视为开) |
| `termux_volume(stream, vol)` | int | 设置某个音频流的音量 (`termux-volume <stream> <vol>`) |
| `termux_brightness(level)` | int | 设置屏幕亮度 (`termux-brightness`, 通常 `0..255`) |
| `termux_camera_photo(path)` | int | 后置摄像头拍照并保存 (`termux-camera-photo -c 0`) |
| `termux_fingerprint()` | string | 指纹认证结果 (JSON; 失败为空串) |
| `termux_sensor(type)` | string | 单个传感器的一次读数 (JSON, `termux-sensor -s <type> -n 1`; 失败为空串) |

```cin
if (is_android() == 1) {
    android_intent("android.intent.action.VIEW", "https://example.com")
    termux_share("photo.jpg")
    termux_torch(1)                     // 开灯
    termux_volume("music", 8)
    termux_brightness(120)
    termux_camera_photo("photo.jpg")
    println(termux_fingerprint())       // JSON
    println(termux_sensor("accelerometer"))
} else {
    println("非 Android: 这组调用返回 -1 / 空串")
}
```

> 以上全部宿主 API (画布 / GUI / 音频 / 系统交互 / 路径 / 网络 / FFI / 编码 / 桌面 / Termux / 键盘)
> 都是 **Go 原生引擎实现**。原生库缺失或版本不匹配时程序无法启动 (抛 `CPUSimulatorError`
> 并附重建指引, 见 [BUILDING](BUILDING.md))。
> 它们具备**真实文件与网络权限** (`exec` / `file_*` / `dir_remove` / `download` /
> `http_*` / `tcp_*` / `udp_*` / `chdir` / `dlopen`), 请只运行可信脚本;
> `--sandbox` 模式下仅放行核心 VM 机制 (ALLOCFRAME/TIMEUS/TIMENS), 其余宿主 SYS 一律拒绝。

---

## 12. 内嵌 CPU 指令语句

CIN 保留了 7 条 CPU 风格语句, 直接对变量/立即数做寄存器级操作 (以当前语句所在变量的栈槽为操作数):

| 语句 | 等价含义 |
|------|----------|
| `set x 30` | `x = 30` |
| `add x y` | `x = x + y` |
| `subtract x 5` | `x = x - 5` |
| `multiply x 2` | `x = x * 2` |
| `divide x 4` | `x = x / 4` |
| `increment x` | `x = x + 1` |
| `decrement x` | `x = x - 1` |

```cin
function cpu_ops() -> void {
    int x = 10
    set x 30
    add x 12          // x = 42
    multiply x 2      // x = 84
    subtract x 42     // x = 42
    divide x 6        // x = 7
    increment x       // x = 8
    println("x = " + x)
}
```

第二操作数可为变量或立即数。这组语句是低级特性, 一般场景用常规表达式即可。

---

## 13. 编译与运行

```bash
codecin prog.cin                    # 编译并由 Go 原生引擎执行
codecin prog.cin --compile-only     # 仅编译为 prog.bin (UCBC 字节码)
codecin prog.bin                    # 运行字节码
codecin prog.cin --save             # 运行后保存 prog.crom 内存镜像
codecin prog.cin --build-exe prog   # AOT 编译为独立可执行文件
codecin prog.cin --log-level DEBUG --log-file codecin.log   # 全量日志落盘
```

编译错误输出红色 rich 面板, 带 `文件:行号` 定位:

```
┌──────────────────────── Load Error ────────────────────────┐
│ prog.cin:12: Compiler error: Unknown function: printline   │
└────────────────────────────────────────────────────────────┘
```

---

## 模块与标准库 (import)

`import "..."` 只能出现在**文件顶部 (列首)**。解析规则只有两条 (B3):

| 写法 | 解析到 |
|------|--------|
| `import "./util.cin"`、`import "../shared/x.cin"` | **相对当前 .cin 文件**所在目录 (可以带子目录) |
| `import "math.cin"`、`import "lib/math.cin"` | **codecin 内置标准库** `codecin/lib/` (随 pip 包分发) |

> 也就是说: 想引用自己项目里的文件就写 `"./"` 前缀; 不写前缀一律当作内置库名。
> `codecin/lib/` 前缀是历史写法的兼容别名, 等价于 `math.cin`。
> 同一文件每个编译仅包含一次 (防重复), 循环引用报错, 缺失的模块报
> `Import file not found` 并指出查了哪里。

```cin
// main.cin
import "math.cin"         // f_abs/f_floor/f_ceil/f_round/f_min/f_max/i_min/i_max/i_clamp
import "str.cin"          // s_upper/s_lower/s_contains/s_starts_with/s_ends_with/
                          // s_count/s_repeat
import "./helpers.cin"    // 自建模块 (与 main.cin 同目录)

function main() -> int {
    int v = f_floor(3.9)
    string up = s_upper("hi")
    println(float_to_str(f_round(2.5)) + " " + up + " " + int_to_str(v))
    return v
}
```

- 模块文件本身可用 `import` 层层引用 (DAG); 编译主文件时按需展开, 不做独立编译单元;
- 库函数名建议 `f_*` (浮点) / `s_*` (字符串) / `i_*` (整数) 前缀避免冲突;
- 模块示例: `examples/modules_demo.cin`、`examples/stdlib_demo.cin`。

### 官方标准库清单 (`codecin/lib/`)

| 库 | 前缀 | 主要函数 |
|----|------|----------|
| `codecin/lib/math.cin` | `f_` `i_` | `f_abs` `f_floor` `f_ceil` `f_round` `f_min` `f_max` `i_min` `i_max` `i_clamp` |
| `codecin/lib/str.cin` | `s_` | `s_upper` `s_lower` `s_contains` `s_starts_with` `s_ends_with` `s_count` `s_repeat` |
| `codecin/lib/array.cin` | `a_` | `a_sum` `a_max` `a_min` `a_avg` `a_find` `a_contains` `a_count` `a_reverse` `a_fill` `a_copy` `a_index_of_max` `a_index_of_min` `a_sum_range` `a_lower_bound` |
| `codecin/lib/sort.cin` | `sort_` `bin_` | `sort_bubble` `sort_selection` `sort_insertion` `sort_quick` `sort_quick_all` `sort_is_sorted` `bin_search` |
| `codecin/lib/conv.cin` | `c_` | `c_to_hex` `c_parse_hex` `c_to_bin` `c_parse_bin` `c_pad_left` `c_pad_right` `c_pad_int` `c_repeat` `c_chr` `c_to_int` `c_parse_float` |
| `codecin/lib/vec.cin` | `v_` | `v_sum` `v_mean` `v_var` `v_std` `v_dot` `v_min` `v_max` `v_add` `v_scale` `v_normalize` `v_norm` `v_lerp` |
| `codecin/lib/rand.cin` | `r_` | `r_range` `r_bool` `r_float` `r_float_range` `r_shuffle` `r_choice` `r_chance` |
| `codecin/lib/json.cin` | `j_` | `j_raw` `j_str` `j_int` `j_float` `j_bool` `j_has` (扁平 JSON 取值) |
| `codecin/lib/time.cin` | `t_` | `t_now` `t_hms` `t_ms` `t_breakdown` `t_human` `t_two` |
| `codecin/lib/io.cin` | `io_` | `io_read` `io_write` `io_append` `io_exists` `io_size` `io_remove` `io_mkdir` `io_list` `io_join` `io_basename` `io_dirname` `io_line_count` `io_get_line` `io_split_get` `io_split_count` |
| `codecin/lib/gui.cin` | `g_` | `g_rgb` `g_new` `g_clear` `g_rect_outline` `g_bar_chart` `g_line_chart` `g_grid` `g_save` `g_show` |
| `codecin/lib/termux.cin` | `tx_` | `tx_ok` `tx_notify` `tx_toast` `tx_copy` `tx_paste` `tx_vibrate` `tx_say` `tx_sms` `tx_battery_level` `tx_battery_temp` `tx_battery_plugged` `tx_latitude` `tx_longitude` `tx_wifi_ssid` `tx_prompt` `tx_alert` |
| `codecin/lib/test.cin` | `t_` | `t_eq_int` `t_eq_str` `t_near` `t_true` `t_false` `t_reset` `t_report` |
| `codecin/lib/bits.cin` | `bits_` | `bits_popcount` `bits_clz` `bits_ctz` `bits_is_pow2` `bits_next_pow2` `bits_test` `bits_set` `bits_clear` `bits_toggle` `bits_rotl` `bits_rotr` `bits_reverse` `bits_range_mask` `bits_extract` `bits_insert` `bits_bswap` |
| `codecin/lib/stat.cin` | `stat_` | `stat_sum` `stat_min` `stat_max` `stat_range` `stat_mean` `stat_count` `stat_mode` `stat_median_sorted` `stat_percentile_sorted` `stat_q1_sorted` `stat_q3_sorted` `stat_histogram` `stat_variance_x1000` `stat_stdev_x100` `stat_is_sorted` |
| `codecin/lib/hash.cin` | `hash_` | `hash_djb2` `hash_fnv1a` `hash_sdbm` `hash_int` `hash_combine` `hash_bucket` `hash_string_bucket` |
| `codecin/lib/validate.cin` | `val_` | `val_is_digit` `val_is_alpha` `val_is_alnum` `val_is_hex` `val_is_space` `val_is_upper` `val_is_lower` `val_is_int` `val_is_float` `val_is_ident` `val_is_blank` `val_is_hex_color` `val_count_char` `val_clamp_int` `val_parse_int` |
| `codecin/lib/matrix.cin` | `mat_` | `mat_zero` `mat_identity` `mat_get` `mat_set` `mat_add` `mat_sub` `mat_scale` `mat_mul` `mat_transpose` `mat_trace` `mat_sum` `mat_equals` `mat_is_symmetric` `mat_det` `mat_print` |
| `codecin/lib/queue.cin` | `queue_` `stack_` | `queue_clear` `queue_push` `queue_pop` `queue_front` `queue_back` `queue_size` `queue_is_empty` `queue_is_full` `queue_capacity` + `stack_clear` `stack_push` `stack_pop` `stack_peek` `stack_size` `stack_is_empty` `stack_capacity` |
| `codecin/lib/key.cin` | `k_` `K_*` | 键码常量 `K_UP` `K_DOWN` `K_LEFT` `K_RIGHT` `K_HOME` `K_END` `K_PGUP` `K_PGDN` `K_INS` `K_DEL` `K_F1..K_F10` `K_ESC` `K_ENTER` `K_TAB` `K_BACKSPACE` + `k_ctrl` `k_is_special` `key_wait` (依赖宿主能力) |
| `codecin/lib/ffi.cin` | `ffi_` | `ffi_load` `ffi_find` `ffi_free` `ffi_call0..8` (整数调用) `ffi_callf*` (浮点返回, 封装 SYS 140-144; 依赖宿主能力) |
| `codecin/lib/net.cin` | `http_` `tcp_` `udp_` `dns_` | `http_get_headers` `http_post_headers` `http_ok` `tcp_send_str` `tcp_send_line` `tcp_recv_str` `tcp_recv_line` `tcp_roundtrip` `tcp_server` + UDP/DNS 封装 (封装 SYS 145-157; 依赖宿主能力) |

> `codecin/lib/io.cin` / `codecin/lib/gui.cin` / `codecin/lib/termux.cin` / `codecin/lib/key.cin` 依赖宿主能力 (Go 原生引擎实现);
> 其余库为纯 CIN。示例见 `examples/stdlib_demo.cin`。
>
> `codecin/lib/matrix.cin` 的矩阵以一维数组行主序存放 (`m[i*n + j]`), `mat_det` 用拉普拉斯
> 递归展开, 适合 `n <= 6`。`codecin/lib/queue.cin` 的队列/栈使用库内全局状态, 同一程序内
> 各只有一份实例 (容量 64)。

---

## 14. 限制与注意事项

1. **无指针/取地址运算**: `*` 仅是乘法、`&` 仅是位与 (不是解引用/取地址); "引用" 仅通过数组/struct 传参隐式实现。
2. **`/` 恒为浮点除**: 整数除法用内建 `idiv(a, b)` (向零截断); `%` 仅支持整数取模, 浮点取模报错。
3. **位运算仅整数**: `&` `|` `^` `<<` `>>` `~` 不接受 float/string 操作数; `>>` 为算术右移 (符号位扩展)。
4. **递归深度**: 每层调用消耗栈槽 (栈位于内存高端向下生长, 默认内存 1 GiB, 4 KiB 分页按需提交); 过深递归触发栈溢出错误, 可用 `--mem-size` 加大内存。
5. **struct 字段**: 不支持变长指针数组字段; 字符串字段是指针, 拼接/复制会产生新堆块。
6. **全局初始化顺序**: 按声明顺序写入数据区; 数组字面量长度超过声明维度会报错。
7. **函数先定义后使用不强制**: 同文件内的函数可互相调用 (两遍编译); 但变量必须先声明后使用。
8. **字符串不可原位修改**: `strcpy` 返回新堆块; 没有可变的原地字符替换。
9. **范围 for 只遍历定长数组**: `int[]` 指针形式与多维数组不能用 `for (T v : arr)`, 请用下标循环。
10. **enum 成员是只读常量**: 成员不能赋值, 也不能作为 `for` 范围循环变量名; 成员初始值只能引用先前已定义的成员。

---

## 15. 常见错误

| 错误信息 | 原因 | 修正 |
|----------|------|------|
| `Unknown function: xxx` | 调用了未定义/拼错的函数 | 检查函数名或自定义该函数 |
| `Unsupported int operator: xx` | 对整数使用了不支持的运算 | 使用 `+ - * / % & \| ^ << >>` |
| `Float modulo not supported` | 浮点使用 `%` | 先取整或改用整数 |
| `Bitwise operator ... requires integer operands` | 对 float/string 使用位运算 | 位运算仅支持 int/bool |
| `Expected RBRACE ... at line N` | 花括号不配对 / 块内缺换行 | 检查第 N 行附近括号 |
| `Undefined variable: xxx` | 使用未声明变量 | 先声明 |
| `Type mismatch ...` | 赋值/传参类型不匹配 | 显式转换或修改类型 |
| `Stack overflow` | 递归过深 / 栈耗尽 | 减少深度或 `--mem-size` 扩容 |
| `Cannot assign to enum member: X (constants are read-only)` | 给枚举成员赋值 | 成员是编译期常量, 改用普通变量累加 |
| `range-for requires a fixed-size array` | `for (T v : arr)` 遍历了 `int[]` 指针形式数组 | 改用定长数组或下标循环 |
| `range-for over multi-dimensional arrays is not supported` | 遍历了多维数组 | 用两层下标循环 |
| `Empty case range: lo..hi` | `case` 范围写反 (`lo > hi`) | 保证 `lo <= hi` |
| `case value must be an integer constant` | `case` 用了非常量表达式 | 用整数常量表达式或枚举成员 |
| `\x escape needs at least one hex digit` / `\u escape needs exactly 4 hex digits` | 十六进制转义位数不足 | 补足位数 (`\x` 1~2 位, `\u` 4 位, `\U` 8 位) |

**调试技巧**:

```bash
codecin prog.cin --log-level DEBUG --log-file codecin.log   # 全量日志落盘
codecin prog.cin --disasm             # 反汇编字节码
```
