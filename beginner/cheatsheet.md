---
description: "CIN 语法速查表：程序骨架、类型与 enum、运算符、控制流（含范围 for 与 case 范围）、函数、数组、字符串、struct、模块、标准库、宿主能力、CLI 与常见错误。"
---

# CIN 语法速查表

一页装下日常写 CIN 需要的所有东西。建议打印或固定在编辑器旁边。

## 程序骨架

```c
// 1) import 必须在文件最上面 (可选; 注意: import 行不能写行尾注释)
import "math.cin"

int counter = 0                // 2) 全局变量 (可选)

struct Point {                 // 3) struct 定义 (可选)
    int x
    int y
}

function helper(int n) -> int {  // 4) 函数 (顺序随意)
    return n * 2
}

function main() -> int {         // 5) 入口
    println("hi")
    return 0
}
```

- 语句以**换行**结尾, 分号可选;
- 注释: `// 单行`、`/* 多行 */`;
- 运行: `codecin prog.cin`, 只看程序输出加 `--log-level ERROR`。

## 类型与字面量

| 类型 | 默认值 | 字面量示例 |
|------|--------|-----------|
| `int` (含 `char` `short` `long` `unsigned *`) | `0` | `42` `-7` `0xFF` `0b1010` `0o17` `'A'` `1_000` |
| `float` | `0.0` | `3.14` `1e-5` `1.5f` |
| `bool` | `false` | `true` `false` |
| `string` | **必须写 `= ""`** | `"hello\n"` |
| struct | 数值字段 `0`, **字符串字段不是空串** | — |
| `T[n]` 固长数组 | 全零 | `int a[3] = {1,2,3}` |
| `T[]` 指针数组 | 空指针 | 用于参数/返回 |
| enum 类型名 | 同 `int` (`0`) | `enum Color { RED, GREEN = 5, BLUE }` |

转换: 整数→浮点自动; 浮点→整数**截断**; `atoi` / `int_to_str` / `float_to_str` / `bool_to_str`。

enum 成员是**编译期整数常量** (只读, 可用于表达式与 `case`):

```c
enum Color { RED, GREEN = 5, BLUE }     // 0, 5, 6 (未赋值自动 +1)
Color c = BLUE
println(int_to_str(c))                  // 6
```

## 运算符 (从高到低)

| 优先级 | 运算符 |
|--------|--------|
| 高 | `()` `[]` `.` `f()` `x++` `x--` |
| | `!` `~` `-x` `++x` `--x` |
| | `*` `/` `%` |
| | `+` `-` |
| | `<<` `>>` |
| | `<` `>` `<=` `>=` |
| | `==` `!=` |
| | `&` → `^` → `\|` |
| | `&&` → `\|\|` |
| 低 | `?:` 与 `=` `+=` `-=` `*=` `/=` `%=` `&=` `\|=` `^=` `<<=` `>>=` |

口诀: **要小数用 `/`, 要整数商用 `idiv`, 要余数用 `%`; 字符串比较用 `strcmp`。**

## 控制流

```c
if (cond) { ... } else if (cond) { ... } else { ... }

while (cond) { ... }

for (int i = 0; i < n; i++) { ... }     // 三段可省: for (;;) { break }
for (i = 0; i < n; i = i + 1) { ... }   // init 段也可以是赋值 (用已有变量)

for (int v : arr) { ... }               // 范围 for: arr 必须是定长数组!

do { ... } while (cond);                // 至少执行一次

switch (x) {                            // 分支默认贯穿!
    case 1:
    case 2: println("一或二"); break
    case 3, 4: println("三或四"); break
    case 7..9: println("七到九"); break  // 闭区间 (lo <= hi)
    default: println("其他")
}

int m = cond ? a : b;                   // 三目
```

`break` 结束本层循环/switch; `continue` 跳过本轮。
范围 for **只能遍历定长数组** (`int[]` 参数与多维数组报 `range-for requires a fixed-size array`),
循环变量是拷贝, 改它不影响原数组。

## 函数

```c
function name(int a, string b) -> int {
    return a;
}

function no_return(int a) -> void {     // -> void 可省略
    println(a)
}
```

- 参数按值; 数组 (`int[]`) 与 struct 数组是引用, 函数内改动能被外面看到;
- 只能返回一个值 → 需要多个结果时传入结果数组;
- 递归要有出口; 深递归用 `--mem-size` 扩容。

常用内建: `print` `println` `abs` `sqrt` `pow` `sin` `cos` `tan` `floor` `ceil` `round` `min` `max` `rand` `srand` `time` `idiv`。

字符串内建: `strlen` `strcmp` `strcpy` `substr` `indexof` `upper` `lower` `trim` `ltrim` `rtrim` `atoi` `int_to_str` `float_to_str` `bool_to_str`。

## 数组

```c
int a[5]                    // 声明, 全 0
int b[4] = {1, 2, 3, 4}     // 一维字面量初始化 (有效)

int m[2][3]                 // 二维: 用循环填充 (局部字面量初始化无效!)
for (int i = 0; i < 2; i++) {
    for (int j = 0; j < 3; j++) { m[i][j] = i * 3 + j }   // 行主序
}

for (int i = 0; i < n; i++) { a[i] } // 遍历: 条件一定写 i < n

function sum(int[] arr, int n) -> int { ... }   // 传参要带长度
```

- 下标从 0 开始; 数组**不记录长度**;
- 默认**不检查越界**; 排查时用 `--bounds-check` (指针形式参数抓不到, 需自己保证 `n`);
- 二维也可以用一维代替: `flat[i * cols + j]`。

## 字符串

```c
string s = "hello"
string t = s + " " + "world"        // 拼接会产生新字符串
println(strlen(t))                  // 长度
if (strcmp(s, "hello") == 0) { }    // 比较内容 (不要用 ==)
string u = upper(t)                 // 大写 (新字符串)
string v = substr(t, 0, 5)          // 子串
int p = indexof(t, "world")         // 查找, 找不到 -1
int c = s[0]                        // 单字节只读访问 ('h' = 104)
println("a=", a, " b=", b)          // 多参数: 依次输出, 无分隔符
```

字符串不可原地修改 (没有 `s[i] = ...`)。

转义: `\n \t \r \0 \" \\` + `\a \b \f \v`, 以及 `\xH`/`\xHH`(**原始字节**)、
`\uHHHH`/`\UHHHHHHHH`(**Unicode 码点**, 按 UTF-8 写入):

```c
string a = "\xE4\xB8\xAD"           // 中 的 UTF-8 三字节
string b = "\u4E2D"                 // 同样是 中
```

## struct

```c
struct Student {
    string name
    int score
    int grades[5]           // 固长数组字段可以, T[] 字段不行
}

Student s                   // 声明后立刻给字符串字段赋值
s.name = "小明"
s.score = 92
println(s.score)
```

- 单个 struct 变量可靠; **struct 数组 (表格数据) 与嵌套 struct 字段当前不可靠** ——
  表格用并行数组, 多段数据用多个独立 struct 变量;
- struct 传参是**值语义**; 想改到外面就返回新 struct 或传数组。

## 已知限制 (避坑清单)

| 写法 | 实际行为 | 规避 |
|------|----------|------|
| `input()` 收到非整数行 / EOF | 返回 `0` (不报错) | 需要校验时自己检查语义 |
| `string s` 不初始化 | 指向相邻字面量 | 写 `string s = ""` |
| struct 字符串字段不赋值 | 不是空串 | 声明后立刻赋值 |
| 内层块重名声明变量 | 与外墙共用存储 | 内层换名字 |
| `Student cls[3]` | 元素字段互相覆盖 | 并行数组 |
| `r.a.x` 嵌套字段 | 互相覆盖 | 扁平字段 / 独立变量 |
| 函数内 `int m[2][3] = {...}` | 初始化无效 | 循环填充 / 全局字面量 / 一维 `flat[i*cols+j]` |
| `import "x.cin"  // 注释` | 编译失败 | 注释另起一行 |
| `sqrt(-1)` 等数学域错误 | 两条路径一致返回 `NaN` | 需要时先判断定义域 |
| `int[] a` 参数越界 | `--bounds-check` 管不到 | 自己保证循环用 `i < n` |
| `for (int v : intArrParam)` | `int[]` 参数不是定长数组, 报 `range-for requires a fixed-size array` | 用定长数组或下标循环 |
| `for (int v : m)` (多维) | 元素是数组, 报 `range-for over multi-dimensional arrays is not supported` | 两层下标循环 |
| `RED = 7` (给枚举成员赋值) | 成员只读, 报 `Cannot assign to enum member` | 成员是常量, 用普通变量 |

## 模块与标准库

```c
// 裸名字 = 内置标准库 codecin/lib/; "./x.cin" = 相对当前文件的路径
// 注意: import 行不能写行尾注释
import "math.cin"
import "./helpers.cin"
```

| 前缀 | 库 | 常用函数 |
|------|----|----------|
| `f_` `i_` | math | `f_round` `f_floor` `f_min` `i_clamp` |
| `s_` | str | `s_upper` `s_contains` `s_repeat` |
| `a_` | array | `a_sum` `a_max` `a_avg` `a_find` |
| `sort_` `bin_` | sort | `sort_bubble` `sort_quick_all` `bin_search` |
| `c_` | conv | `c_to_hex` `c_pad_int` |
| `v_` | vec | `v_mean` `v_std` `v_dot` |
| `stat_` | stat | `stat_mean` `stat_median_sorted` |
| `r_` | rand | `r_range` `r_shuffle` |
| `j_` | json | `j_int` `j_str` |
| `bits_` | bits | `bits_popcount` `bits_set` |
| `hash_` | hash | `hash_djb2` `hash_fnv1a` |
| `val_` | validate | `val_is_int` `val_parse_int` |
| `mat_` | matrix | `mat_mul` `mat_transpose` `mat_det` |
| `t_` | time / test | `t_now` `t_eq_int` `t_report` |
| `io_` `g_` `tx_` | io / gui / termux | 需原生运行时 |

## 宿主能力 (需原生运行时)

```c
file_read(p) file_write(p, s) file_append(p, s) file_exists(p) file_size(p) mkdir(p) dir_list(p)
file_copy(a, b) file_move(a, b) dir_remove(p) is_dir(p) file_mtime(p) chdir(p)
path_join(d, n) path_basename(p) path_dirname(p) path_abs(p) temp_dir()
exec(cmd) exec_output(cmd) getenv(n) setenv(n, v)
os_name() hostname() username() cwd() home_dir() time_ms() sleep_ms(ms)
cpu_count() arch_name() mem_info() is_android()
http_get(url) http_post(url, body) download(url, p)
sha256(s) base64_encode(s) base64_decode(s)
clipboard_get() clipboard_set(s) notify(t, b) open_url(url)
canvas(w, h) set_color(rgb) fill_rect(...) fill_circle(...) draw_line(...) draw_text(...) save_png(p)
audio_play(url) beep(freq, ms) audio_stop() audio_wait() audio_volume(v) audio_level()
audio_pos() audio_duration() audio_playing() audio_pause() audio_resume()
arg_count() arg(i) input_str()         // 命令行参数与行输入 (需原生)
gui_new(w, h, t) gui_update() gui_close() gui_closed() gui_active() mouse_x() mouse_y()
termux_notify(t, c) termux_toast(m) termux_vibrate(ms) termux_battery()
android_intent(a, u) termux_call(n) termux_share(f) termux_torch(on) termux_volume(s, v)
termux_brightness(lv) termux_camera_photo(p) termux_fingerprint() termux_sensor(t)
key_hit() get_key() key_flush()        // 键盘轮询, 需真实终端 (游戏循环)
```

以上全部是 **Go 原生实现**: `--no-native` 下调用会报
`host builtins ... require the native Go runtime`; 它们有**真实文件与网络权限**, 只运行可信脚本。

## 命令行速查

| 命令 | 作用 |
|------|------|
| `codecin prog.cin` | 运行 (默认走最快的原生路径) |
| `codecin prog.cin --log-level ERROR` | 只看程序输出 |
| `codecin prog.cin --no-native` | 强制纯 Python 解释执行 |
| `codecin prog.cin --jit --no-native` | 启用 JIT |
| `codecin prog.cin --no-native --debug` | 逐指令追踪 (定位崩溃) |
| `codecin prog.cin --no-native --step` | 交互式单步 (`b`/`p`/`list`/`c`/`q`) |
| `codecin prog.cin --no-native --bounds-check` | 数组越界检查 |
| `codecin prog.cin --profile` | 性能统计 |
| `codecin prog.cin --mem-size 262144` | 内存扩到 256 KiB |
| `codecin prog.cin --max-instructions 100000` | 限制指令数 (抓死循环) |
| `codecin prog.cin --seed 42` | 固定随机种子 |
| `codecin prog.cin --compile-only -o prog.bin` | 只编译成字节码 |
| `codecin prog.bin --disasm` | 反汇编查看 |
| `codecin prog.cin --build-exe prog` | 编译成独立可执行文件 |
| `codecin --help` | 全部选项 |

## 常见错误一句话对照

| 报错 | 一句话解决 |
|------|-----------|
| `Unknown function: xxx` | 名字拼错或忘记 `import` |
| `Undefined variable: xxx` | 先声明再使用 |
| `Type mismatch` | 显式转换 (`atoi` / `int_to_str`) |
| `Float modulo not supported` | 对浮点用了 `%` |
| `Bitwise operator ... requires integer operands` | 位运算只用于整数 |
| `Expected RBRACE ... at line N` | 花括号/换行问题 |
| `Import file not found` | 自建模块要写 `"./x.cin"` |
| `Stack overflow (collides with heap)` | 递归太深或局部数组太大 → `--mem-size` |
| `Runtime abort: bounds-check: ...` | 数组越界, 检查循环条件 |
| `host builtins ... require the native Go runtime` | 去掉 `--no-native` |
| `Unknown instruction: jle` | 本 ISA 没有该指令, 用 `JG`/`JL`/`JE` |

## 最容易踩的坑

1. **`/` 是浮点除法** —— 整数商用 `idiv`;
2. **字符串不能用 `==` 比内容** —— 用 `strcmp(a, b) == 0`;
3. **数组不记录长度** —— 传参必须带 `n`, 循环写 `i < n`;
4. **`switch` 分支默认贯穿** —— 记得 `break`;
5. **`input()` 收到非整数行 / EOF 返回 `0`** —— 需要校验时自己判断;
6. **未初始化的 `string` / struct 字符串字段不是空串** —— 声明时就赋值;
7. **struct 数组与嵌套 struct 字段当前不可靠** —— 表格用并行数组, 多段数据用独立变量;
8. **函数内二维数组字面量初始化无效** —— 循环填充或压成一维 `flat[i * cols + j]`。

> 完整清单 (含表现与规避写法) 见 [第 12 章 · 已知限制](/beginner/ch12-debug#_12-7-5-5-0-已知限制与规避-重点)。

## 相关页面

- [初学者教程](/beginner/) — 从零开始的分章教程
- [习题与答案](/beginner/exercises) — 练习参考实现
- [CIN 语言总览](/language/) — 系统化语言参考
- [标准库参考](/stdlib/reference) — 218 个库函数签名
- [命令行参考](/guide/cli) — 全部选项与退出码
- [常见问题 FAQ](/guide/faq) — 安装、性能、产物
