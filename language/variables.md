---
description: CIN 变量与作用域：全局变量、局部变量、一行多声明、默认值、数组字面量初始化与遮蔽规则。
---

# 变量与作用域

CIN 的变量只有两类: **文件顶层的全局变量**与**函数/块内的局部变量**。类型必须显式写出
(没有 `auto`/类型推导), 每个变量在声明时就已经确定默认值。

> `enum` 成员是**编译期整数常量**而不是变量: 它们没有存储槽、不能赋值, 只读语义见
> [类型系统 · enum 类型](/language/types#enum-类型)。

## 全局变量

写在文件顶层 (任何 `function` / `struct` 之外) 的声明即全局变量, 它们位于数据区,
在程序开始执行前按**声明顺序**初始化:

```c
// 全局变量 (文件顶层)
int counter = 0
float pi = 3.14159265
string greeting = "hello"
Person admin                  // struct 变量: 默认全零
int primes[20]                // 固长数组: 全零
float grid[7][24]             // 二维数组: 全零
int matrix[2][3] = { {1, 2, 3}, {4, 5, 6} }   // 数组字面量 (可嵌套表示多维)

function demo() -> void {
    int local = 10            // 局部变量
    int a = 1, b = 2          // 一行多声明
    string s = "x" + "y"
    local = local + a         // 赋值
}
```

要点:

- 支持带类型前缀的数组字面量初始化, 嵌套 `{}` 表示多维 (行主序);
- 字面量长度**超过声明维度会报错** (不会被静默截断);
- 全局变量在整个程序生命周期内存在, 任何函数都能读写;
- 全局初始化在**第一条语句之前**完成, 因此 `main` 里读到的全局变量已经是初值。

::: tabs

== 全局数组字面量

```c
int matrix[2][3] = { {1, 2, 3}, {4, 5, 6} }

function main() -> int {
    println(int_to_str(matrix[1][2]))    // 6
    return 0
}
```

== 局部数组

```c
function main() -> int {
    int v[4] = {10, 20, 30, 40}
    println(int_to_str(v[3]))            // 40
    return 0
}
```

:::

## 局部变量

- 在**进入所在块 `{}` 时分配**, 离开块时释放 (栈槽回收);
- 同名内层变量会**遮蔽**外层变量, 离开块后外层变量恢复可见;
- 局部变量可以在声明时初始化, 也可以先声明后赋值;
- 声明必须出现在使用之前 —— CIN 不做变量提升。

```c
function scope_demo() -> void {
    int x = 1
    if (true) {
        int x = 2          // 遮蔽外层 x
        println("inner = " + int_to_str(x))    // inner = 2
    }
    println("outer = " + int_to_str(x))        // outer = 1
}
```

::: warning 循环体内的声明
`for` / `while` / `do-while` 的花括号体是块, 块内声明的变量每次迭代都重新分配;
`for` 的 init 段里声明的循环变量作用域覆盖整个循环 (含条件与 update 段):

```c
for (int i = 0; i < 3; i = i + 1) {
    int tmp = i * 2        // 每次迭代都是新的 tmp
    println(int_to_str(tmp))
}
```
:::

## 一行多声明

```c
int a = 1, b = 2, c
float x = 1.5, y = 2.5
string s = "a", t = "b"
```

每个声明项独立初始化; 没有初始化器的项取类型默认值。

## 命名常量 `const`

`const` 声明一个**编译期常量**：它不占数据段、不产生任何指令，凡是用到它的地方都会在
编译期直接替换成值。因此它可以出现在普通变量不能出现的位置——最典型的是**数组维度**：

```c
const int N = 5
int matrix[N][N]        // 数组维度必须是常量, 这里用 N

function main() -> int {
    const int RETRIES = 3          // 局部 const 同样可用
    const float PI = 3.14159
    const bool DEBUG = true
    const string NAME = "cin"

    for (int i = 0; i < N; i = i + 1) {
        matrix[i][i] = RETRIES
    }
    return matrix[4][4]            // 3
}
```

| 规则 | 说明 |
|------|------|
| 允许的类型 | `int` / `float` / `bool` / `string`（`char` / `short` / `long` 折叠为 `int`） |
| 初值 | 必须是**常量表达式**：字面量、其它 `const`、`enum` 成员，以及 `+ - * / % << >> & \| ^`、一元 `-` / `~`、字符串 `+` |
| 类型规范化 | 按声明类型转换：`float → int` 向零截断、数值 → `bool` 非零即真 |
| 只读 | 给 `const` 赋值报 `Cannot assign to const: N (constants are read-only)` |
| 作用域 | 全局 `const` 到处可用；局部 `const` 从声明点起可用，**可以被同名局部变量遮蔽** |
| 重名 | 与全局变量同名报错（`Name 'N' is already a const`）；重复定义报 `Duplicate const` |
| 与 `enum` 的区别 | `enum` 只能表达整数并成组命名；`const` 支持浮点、布尔与字符串 |

::: tip 数组维度就写常量表达式
`int a[5]`、`int a[N]`、`int a[2 + 3]`、`int a[K + 1]`（`K` 是 `enum` 成员）都合法。
维度必须是**整型**常量表达式：`int a[PI]`（`PI` 是 `float` 常量）或 `int a[-1]` 都会在编译期报错。
:::

## 默认值

**全局变量**由运行时把数据区清零，因此一定取类型默认值；**局部变量不保证**——
编译器在函数序言里只下移栈指针，不发射清零代码，栈槽会在同一进程内被复用。
所以：**局部变量总是先赋值再使用**。

| 类型 | 全局默认值 | 局部默认值 |
|------|-----------|-----------|
| `int` / `char` / `short` / `long` / `unsigned *` | `0` | 不可靠（栈帧残留值） |
| `float` | `0.0` | 不可靠 |
| `bool` | `false` | 不可靠 |
| `string` | `""`（空串） | 不可靠（可能是野指针） |
| struct 变量 | 所有字段全零 | 进入所在块时分配对象并全零 |
| 固长数组 `T[n]` | 所有元素全零 | **不可靠**（栈帧残留值，不是全零） |
| 指针形式数组 `T[]` | 空指针 | 不可靠（使用前必须赋值） |

::: danger 局部固长数组不是全零
这一点和 C 一致、和"全局一定清零"不同。实测：先调用一个把 `int a[4]` 填成
`111/222/333/444` 的函数，再在另一个函数里读未初始化的 `int b[4]`，会读到 `1110` 而不是 `0`：

```c
function dirty() -> void { int a[4]; a[0] = 111; a[1] = 222; a[2] = 333; a[3] = 444 }
function main() -> int {
    dirty()
    int b[4]
    println(int_to_str(b[0] + b[1] + b[2] + b[3]))   // 不是 0
    return 0
}
```

需要全零请在声明时显式初始化：`int b[4] = {0}`。
:::

类型细节 (64 位槽、别名、提升与截断) 见 [类型系统](/language/types)。

## 赋值与复合赋值

```c
int x = 10
x = x + 5           // 15
x += 5              // 20
x -= 4              // 16
x *= 2              // 32
x /= 4              // 8.0 -> 赋给 int 截断为 8  ('/' 是浮点除)
x %= 5              // 3
x++                 // 4
--x                 // 3
```

- 赋值语句本身也是表达式 (值为赋入的值), 可以嵌套: `int y = (x = 3) + 1`;
- 复合赋值左侧只求值一次 (对 `arr[i]` 这类左值更安全);
- `%=` 与位运算复合赋值 (`&= |= ^= <<= >>=`) 只接受整数;
- 自增自减对 `float` 每次 ±1.0。

详见 [运算符](/language/operators)。

## 常见问题

| 现象 | 原因 | 处理 |
|------|------|------|
| `Undefined variable: x` | 使用未声明的变量, 或声明在使用之后 | 先声明再使用; 检查拼写 |
| `Type mismatch ...` | 赋值/传参类型不兼容 | 显式转换 (见 [内建函数](/language/builtins)) 或改类型 |
| 内层变量修改后外层没变 | 那是一次**遮蔽**, 不是同一变量 | 换个变量名, 或调整块结构 |
| 数组字面量报错 | 字面量元素多于声明的维度 | 对齐字面量与声明长度 |
| 递归/深调用后崩 | 栈槽耗尽 | 用 `--mem-size` 扩容, 见 [限制与常见错误](/language/errors) |

## 相关页面

- [类型系统](/language/types) — 64 位槽、别名、提升与截断
- [运算符](/language/operators) — 优先级、位运算、复合赋值
- [函数](/language/functions) — 参数传递与作用域边界
- [数组](/language/arrays) — 固长数组与指针形式数组
