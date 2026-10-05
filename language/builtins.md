---
description: "CIN 内建函数完整参考：I/O、数学、随机与时间、字符串/转换、命令行参数、网络、FFI 内建，含签名、返回值与边界行为。"
---

# 内建函数

内建函数由编译器/运行时直接提供 (不需要 `import`), 可以在**表达式任意位置**使用。
数值参数按需自动提升为 `float`; 整数与浮点混用时结果按浮点计算。

## 输入输出

| 函数 | 签名 | 说明 |
|------|------|------|
| `print(x, ...)` | void | 输出不换行 (自动字符串化; 多参数依次输出且不加分隔符) |
| `println(x, ...)` | void | 输出并换行; **无参调用输出空行** |
| `input()` | int | 读一行标准输入并转成 int (**非法行 / EOF 返回 `0`**; 见下方说明) |
| `exit(code)` | void | **立即结束程序**, `code` 作为程序的终止码 (见下方说明) |

::: tip `exit(code)`: 立刻结束整个程序
`exit(code)` 不再执行后续任何语句, 也不返回调用它的函数:

```c
function main() -> int {
    println("before")
    exit(3)                 // 程序在这里结束
    println("never")        // 不会执行
    return 0
}
```

- Go 原生引擎与 AOT 产物**一致地**立即终止;
- `code` 会留在寄存器 `x0` (也就是 `main` 的返回值位置), 因此被 `exit` 结束的程序
  其"程序结果"就是 `code`;
- **进程退出码**遵循 CLI 约定 (`0` 正常 / `1` 错误 / `2` 参数错误),
  见 [命令行参考](/guide/cli); 不要把 `exit(code)` 当作 `sys.exit(code)` 使用;
- `exit()` 参数个数不对会在编译期报错; 用户若自己定义了 `exit` 函数, 以用户的为准。
:::

多参数输出:

```c
int a = 3
string b = "cin"
println("a=", a, " b=", b)      // a=3 b=cin (无分隔符, 分隔符要自己写)
print("no", "newline")
println()                       // 空行
```

::: tip `input()` 从标准输入读一行整数
`input()` 编译为 `IN` 指令, 从标准输入逐行读取并转成 int:

```c
int n = input()
println("你输入的是 " + n)
```

实测:

```bash
echo 42 | codecin prog.cin --log-level ERROR
```

```text
你输入的是 42
```

边界行为:

- **非法行** (非整数字符串) 与 **EOF / 无输入** 返回 `0`, 不报错;
- 交互运行时逐行等待键盘输入; 管道运行时由 CLI 预读全部标准输入;
- 需要逐字符键盘轮询 (游戏循环) 时用 `key_hit` / `get_key`
  (见 [宿主能力: 键盘输入监听](/language/host-abilities));
- 也可以用汇编 `IN` 指令直接读: 见 [指令语义参考](/asm/instructions)。
:::

## 数学

| 函数 | 签名 | 说明 |
|------|------|------|
| `abs(x)` | int | 整数绝对值 |
| `sqrt(x)` | float | 平方根 |
| `pow(x, y)` | float | `x` 的 `y` 次幂 |
| `sin(x)` / `cos(x)` / `tan(x)` | float | 三角函数 (弧度) |
| `floor(x)` / `ceil(x)` | float | 向下 / 向上取整 (**结果仍是 float**) |
| `round(x)` | float | 四舍五入 (`floor(x + 0.5)`, 半值向 +∞) |
| `min(a, b)` / `max(a, b)` | int/float | 最小 / 最大值 (混用按 float 提升) |
| `idiv(a, b)` | int | 整数除法 (向零截断) |

```c
function math_demo() -> void {
    float angle = 3.14159265 / 4
    println("sin(45°) = " + sin(angle))
    println("sqrt(16) = " + sqrt(16))       // 4
    println("pow(2, 8) = " + pow(2, 8))     // 256
    println("abs(-42) = " + abs(-42))       // 42
    println("floor(3.7) = " + floor(3.7))   // 3 (float)
    println("ceil(3.2) = " + ceil(3.2))     // 4 (float)
    println("round(2.5) = " + round(2.5))   // 3 (float)
    println("idiv(17, 5) = " + idiv(17, 5)) // 3
}
```

::: warning 取整函数返回 float
`floor` / `ceil` / `round` 返回的是 `float`, 赋给 `int` 时会截断转换:

```c
int n = floor(3.7)      // 3
float f = floor(3.7)    // 3.0
```
:::

## 随机与时间

| 函数 | 签名 | 说明 |
|------|------|------|
| `rand()` | int | 非负随机整数 |
| `srand(n)` | void | 设置随机种子 |
| `time()` | int | Unix 时间戳 (秒) |
| `time_us()` | int | 单调微秒计时 (SYS 138), 高精度基准测试 |
| `time_ns()` | int | 单调纳秒计时 (SYS 139), `time_us` 的高分辨率版本 |

```c
function roll() -> int {
    srand(42)                    // 固定种子 -> 序列可复现
    return rand() % 6 + 1
}
```

```cin
function bench() -> int {
    int t0 = time_us()                       // SYS 138: 单调微秒
    int s = 0
    for (int i = 0; i < 1000000; i = i + 1) { s = s + i }
    println("耗时 " + int_to_str(time_us() - t0) + " 微秒")
    return s
}
```

> 命令行 `--seed <n>` 也能让整个程序的随机序列确定 (见 [命令行参考](/guide/cli))。

## 字符串

| 函数 | 签名 | 说明 |
|------|------|------|
| `strlen(s)` | int | 字节长度 (不含 NUL) |
| `strcmp(a, b)` | int | 字典序比较 (`<0` / `0` / `>0`) |
| `strcpy(s)` | string | 复制为新堆块 |
| `substr(s, start, len)` | string | 子串 (新堆块, 越界自动裁剪)。**按字节索引**, 与 `strlen` / `s[i]` 一致 |
| `indexof(hay, needle)` | int | 首次出现的**字节下标**, 未找到 `-1` |
| `upper(s)` / `lower(s)` | string | 大小写转换 (新堆块)。**Unicode 感知**: 非 ASCII 字符也会转换, 因此结果字节长度可能变化 |
| `trim(s)` / `ltrim(s)` / `rtrim(s)` | string | 去首尾 / 前导 / 尾部空白 (新堆块) |
| `atoi(s)` | int | 字符串 → 十进制整数 (前导空白忽略, 失败为 `0`) |

::: tip 字符串内建是字节语义, 只有大小写转换是 Unicode 感知
`strlen` / `substr` / `indexof` / `s[i]` / 拼接 `+` 全程按**字节**处理, 不会先做 UTF-8
解码 —— 所以非法字节序列不会被替换成 `U+FFFD`, 长度与下标完全由字节语义确定
(例如 `"a\xE4\xB8b"` 的 `strlen` 是 4, `indexof(s, "\xE4\xB8")` 是 1)。

`upper` / `lower` 是刻意的例外: 它们做 Unicode 大小写映射 (`café` → `CAFÉ`), 由于映射
结果可能变长, 不要假设"转换后长度不变"。
:::

## 类型转换

| 函数 | 签名 | 说明 |
|------|------|------|
| `int_to_str(n)` / `itoa(n)` | string | 整数 → 十进制字符串 |
| `float_to_str(f)` / `ftoa(f)` | string | 浮点 → 字符串 (int/bool 自动提升) |
| `bool_to_str(b)` | string | 布尔 → `"true"` / `"false"` |
| `to_int(x)` | int | int/float/bool 间显式转换; 语义与隐式提升一致 (float → int 向零截断); 非数值参数编译期报错 |
| `to_float(x)` | float | int/float/bool 间显式转换; 语义与隐式提升一致; 非数值参数编译期报错 |

```c
println(int_to_str(-7))          // -7
println(float_to_str(3.5))       // 3.5
println(bool_to_str(1 > 2))      // false
println(int_to_str(to_int(3.9)))   // 3 (向零截断)
```

::: tip 拼接会自动转换
`"n = " + 42` 与 `"n = " + int_to_str(42)` 结果相同; 需要固定格式时用显式转换。
:::

::: tip 显式转换用 `to_int` / `to_float`
写 `int(x)` / `float(x)` 会得到编译错误, 错误提示会引导改用 `to_int(x)` / `to_float(x)`。
:::

## 命令行参数与行输入

| 函数 | 返回 | 说明 |
|------|------|------|
| `arg_count()` | int | 传给 CIN 程序的参数个数 (不含程序文件名本身; SYS 129) |
| `arg(i)` | string | 第 `i` 个参数; 越界返回空串 (SYS 130) |
| `input_str()` | string | 读一行 UTF-8 文本 (不含行尾); EOF 返回空串 (SYS 131) |

```cin
function main() -> int {
    int n = arg_count()
    for (int i = 0; i < n; i = i + 1) {
        println("arg[" + int_to_str(i) + "] = " + arg(i))
    }
    return 0
}
```

程序文件名之后的裸参数直传给 CIN 程序, `--` 分隔符优先级最高 (见 [宿主能力](/language/host-abilities))。

## 网络 (SYS 145-157)

HTTP / TCP / UDP / DNS 内建, 全部由 Go 原生引擎实现; 主机名参数统一支持域名
(如 `tcp_dial("example.com", 80)`)。

| 函数 | 返回 | 说明 |
|------|------|------|
| `http_req(method, url, headers, body)` | string | 自定义方法与头部的 HTTP 请求; `headers` 为 `"Key: Value\n"` 换行分隔 (空串表示无头), 返回响应体; 失败空串 (SYS 145) |
| `http_code()` | int | 最近一次 HTTP 请求状态码; 从未请求为 `-1` (`http_get` / `http_post` / `http_req` 语义一致; SYS 146) |
| `tcp_dial(host, port)` | int | 建立 TCP 连接 (10 秒超时), 返回连接句柄; 失败 `-1` (SYS 147) |
| `tcp_send(fd, buf, n)` | int | 发送 `buf` 的前 `n` 字节, 返回发送字节数; 失败 `-1` (SYS 148) |
| `tcp_recv(fd, buf, max)` | int | 接收至多 `max` 字节写入 `buf`, 返回实际字节数; 对端关闭 `0`, 失败 `-1` (SYS 149) |
| `tcp_close(fd)` | int | 关闭连接, `0` 成功 / `-1` 失败 (SYS 150) |
| `tcp_listen(port)` | int | 监听端口, 返回监听句柄; 失败 `-1` (SYS 151) |
| `tcp_accept(lfd)` | int | 阻塞接受一个连接, 返回连接句柄; 失败 `-1` (SYS 152) |
| `udp_open(port)` | int | 打开 UDP 套接字并绑定端口 (`0` = 系统分配); 失败 `-1` (SYS 153) |
| `udp_sendto(fd, host, port, buf, n)` | int | 发送数据报, 返回发送字节数; 失败 `-1` (SYS 154) |
| `udp_recvfrom(fd, buf, max, srcbuf)` | int | 接收数据报, 源地址 `"ip:port"` 写入 `srcbuf` (传 `0` 忽略); 失败 `-1` (SYS 155) |
| `udp_close(fd)` | int | 关闭套接字, `0` 成功 / `-1` 失败 (SYS 156) |
| `dns_lookup(host)` | string | 解析主机名为 IP 字符串 (偏好 IPv4); 失败空串 (SYS 157) |

约定:

- HTTP 15 秒超时、响应体上限 8 MiB; TCP 10 秒连接超时、单次收发上限 4/8 MiB;
- CIN 数组每个元素占 8 字节, `tcp_recv` / `udp_recvfrom` 把收到的字节流**原样写入缓冲内存**;
- 按行收发、状态码判断等便捷封装见标准库 `net.cin` ([标准库参考](/stdlib/reference#net))。

```cin
import "net.cin"

function main() -> int {
    string ip = dns_lookup("example.com")
    if (strcmp(ip, "") == 0) { println("DNS 解析失败"); return 1 }
    println("example.com -> " + ip)
    string body = http_req("GET", "https://example.com/", "", "")
    println("HTTP " + int_to_str(http_code()) + ", " + int_to_str(strlen(body)) + " 字节")
    return 0
}
```

## FFI 动态库调用 (SYS 140-144)

加载动态库并调用其导出函数。最多 8 个参数、每个占 8 字节; `argbuf` 是 VM 内存中
8 字节对齐的参数缓冲 —— int 数组槽即 int64 位模式, float 数组槽即 IEEE754 位模式;
浮点参数经 Windows x64 `XMM0-3` / SysV `XMM0-7` 寄存器正确传参。

| 函数 | 返回 | 说明 |
|------|------|------|
| `dlopen(path)` | int | 加载动态库, 返回库句柄; 失败返回 `0` (不抛异常) (SYS 140) |
| `dlsym(handle, symbol)` | int | 查找导出符号, 返回函数句柄; 失败返回 `0` (SYS 141) |
| `ffi_call(fn, argbuf, n)` | int | 以 `n` 个整数参数调用函数, 返回 int64 (SYS 142) |
| `ffi_callf(fn, argbuf, n)` | float | 以 `n` 个浮点参数调用函数, 返回值按 double 位模式进 X0 (SYS 143) |
| `lib_close(handle)` | int | 卸载动态库, `0` 成功 / `-1` 失败 (SYS 144) |

- `dlopen` / `dlsym` 失败返回 `0` 不抛异常, 调用前应检查句柄; 无效句柄 / 参数越界报明确运行时错误;
- 整数调用 `ffi_call0` .. `ffi_call8`、浮点调用 `ffi_callf1` .. `ffi_callf4` 便捷封装见标准库
  `ffi.cin` ([标准库参考](/stdlib/reference#ffi))。

```cin
import "ffi.cin"

function main() -> int {
    int lib = ffi_load("kernel32.dll")       // Linux/macOS: libc.so.6 / libc.dylib
    if (lib == 0) { println("加载失败"); return 1 }
    int fn = ffi_find(lib, "GetTickCount64")
    if (fn == 0) { ffi_free(lib); return 1 }
    println("开机毫秒 = " + int_to_str(ffi_call0(fn)))
    ffi_free(lib)
    return 0
}
```

## 内嵌 CPU 指令语句

除了函数调用, CIN 还保留了 7 条寄存器风格的语句 (`set x 30`、`add x y` …),
它们直接作用于当前变量, 见 [内嵌 CPU 指令语句](/language/inline-cpu)。

## 宿主能力内建

下列内建由 Go 原生引擎以 SYS 指令实现。`--sandbox` 下仅放行 `ALLOCFRAME` (137) /
`TIMEUS` (138) / `TIMENS` (139), 其余宿主 SYS (网络 / FFI / 音频 / 画布 / 文件 / GUI /
Termux 等) 一律报 `Host capability disabled in sandbox mode`; 完整签名与示例见
[宿主能力](/language/host-abilities):

| 分类 | 函数 |
|------|------|
| 2D 画布 | `canvas` `set_color` `fill_rect` `fill_circle` `draw_line` `draw_text` `save_png` `show_canvas` |
| GUI 窗口与鼠标 | `gui_new` `gui_update` `gui_close` `gui_closed` `gui_active` `mouse_x` `mouse_y` `mouse_button` |
| 本地音频 | `audio_play` `beep` `audio_stop` `audio_wait` `audio_volume` `audio_level` `audio_pos` `audio_duration` `audio_playing` `audio_pause` `audio_resume` |
| 命令行参数与行输入 | `arg_count` (129) `arg` (130) `input_str` (131) |
| 文件系统 | `file_read` `file_write` `file_append` `file_exists` `file_delete` `file_size` `mkdir` `dir_list` |
| 路径与文件系统扩展 | `path_join` `path_basename` `path_dirname` `path_abs` `file_copy` `file_move` `dir_remove` `is_dir` `file_mtime` `temp_dir` `chdir` |
| 进程/环境 | `exec` `exec_output` `getenv` `setenv` |
| 系统信息 | `os_name` `hostname` `username` `cwd` `home_dir` |
| 时间与系统 | `time_ms` `time_us` (138) `time_ns` (139) `sleep_ms` `cpu_count` `arch_name` `mem_info` `is_android` |
| 网络 | `http_get` `http_post` `download` `http_req` (145) `http_code` (146) `tcp_dial` (147) `tcp_send` (148) `tcp_recv` (149) `tcp_close` (150) `tcp_listen` (151) `tcp_accept` (152) `udp_open` (153) `udp_sendto` (154) `udp_recvfrom` (155) `udp_close` (156) `dns_lookup` (157) |
| FFI 动态库调用 | `dlopen` (140) `dlsym` (141) `ffi_call` (142) `ffi_callf` (143) `lib_close` (144) |
| 编码与哈希 | `sha256` `base64_encode` `base64_decode` |
| 桌面集成 | `clipboard_get` `clipboard_set` `notify` `open_url` |
| Termux (Android) | `termux_available` `termux_notify` `termux_toast` `termux_clipboard_get` `termux_clipboard_set` `termux_battery` `termux_vibrate` `termux_tts` `termux_location` `termux_wifi_info` `termux_dialog` `termux_sms_send` |
| Android / Termux 扩展 | `android_intent` `termux_call` `termux_share` `termux_torch` `termux_volume` `termux_brightness` `termux_camera_photo` `termux_fingerprint` `termux_sensor` |
| 键盘轮询 | `key_hit` `get_key` `key_flush` |

## 内建速查示例

```c
function builtins_demo() -> int {
    println("len = " + int_to_str(strlen("hello")))          // 5
    println("cmp = " + int_to_str(strcmp("a", "b")))         // -1
    println("idx = " + int_to_str(indexof("hello", "ll")))   // 2
    println("up  = " + upper("abc"))                          // ABC
    println("num = " + int_to_str(atoi(" 42 ")))              // 42
    println("min = " + int_to_str(min(5, 3)))                 // 3
    println("max = " + int_to_str(max(5, 3)))                 // 5
    println("div = " + int_to_str(idiv(17, 5)))               // 3
    return 0
}
```

## 常见错误

| 现象 | 原因 | 处理 |
|------|------|------|
| 调用未定义的“函数” | 拼错名字或忘记 `import` 标准库 | 检查拼写; 库函数需 `import "xxx.cin"` |
| `atoi` / `input` 返回 0 | 解析失败返回 0 (不抛错) | 先校验输入 (见标准库 `validate`) |
| `floor` 结果被截断 | 取整函数返回 float | 需要 int 时显式赋值截断 |
| 宿主内建报错 `Host capability disabled in sandbox mode` | `--sandbox` 下调用了白名单 (内存 / 计时) 之外的宿主内建 | 去掉 `--sandbox`, 或只使用纯计算与 `time_us` / `time_ns` |
| 浮点打印出现多余位 | `float_to_str` 按实现格式化 | 需要固定格式时自行取整/拼接 |

## 相关页面

- [字符串](/language/strings) — 字符串语义与陷阱
- [宿主能力](/language/host-abilities) — 画布 / 音频 / 文件 / 进程 / Termux
- [标准库概览](/stdlib/) — 41 个内置库 (数组、排序、统计、哈希、矩阵、网络、FFI…)
- [标准库参考](/stdlib/reference) — 逐库逐函数签名
