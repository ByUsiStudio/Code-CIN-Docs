---
description: "CIN 宿主能力：GUI 窗口（Windows Win32 / Linux X11）、2D 画布导出 PNG、本地音频（beep 合成 / 进度 / 暂停恢复 / 音量）、命令行参数与行输入、文件/路径/进程/系统信息、网络（HTTP/TCP/UDP/DNS）、FFI 动态库调用、哈希与 Base64、桌面集成（剪贴板/通知/打开 URL）与 Termux/Android API，均由 Go 原生引擎实现。"

---

# 宿主能力

除了纯计算, CIN 还能直接调用宿主: GUI 窗口 (Windows Win32 / Linux X11)、画布绘图
(导出 PNG)、本地音频 (beep 合成 / 播放进度 / 暂停恢复 / 音量)、命令行参数与行输入、
文件与路径操作、进程与系统信息、网络 (HTTP / TCP / UDP / DNS)、FFI 动态库调用、
哈希与 Base64、桌面集成 (剪贴板 / 通知 / 打开 URL), 以及在 Android Termux 下调用
Termux 与 Android API。

::: danger `--sandbox` 下宿主 SYS 被拦截
v5.9.0 起所有程序都由 Go 原生引擎执行, 宿主能力内建就是引擎里的 SYS 调用。
`--sandbox` 运行不可信程序时, 仅放行内存帧分配与高精度计时 (`ALLOCFRAME` 137 /
`TIMEUS` 138 / `TIMENS` 139), 其余宿主 SYS (网络 / FFI / 音频 / 画布 / 文件 / GUI /
Termux 等) 一律报错并以退出码 1 结束:

```text
ERROR    Execution error: Host capability disabled in sandbox mode (SYS 147: TCPDIAL)
+------------------------------ Execution Error ------------------------------+
| Host capability disabled in sandbox mode (SYS 147: TCPDIAL)                 |
+-----------------------------------------------------------------------------+
```
:::

其余语言功能 (含全部纯 CIN 标准库) 不发起宿主 SYS 调用, 在 `--sandbox` 下也可正常运行。

## 2D 绘图画布

CIN 内置一个跨平台的 2D 画布 (Go 标准库实现, 可导出 PNG)。同一时刻存在一个“当前画布”
与一个“当前画笔颜色”(默认黑色, 背景白色)。

| 函数 | 签名 | 说明 |
|------|------|------|
| `canvas(w, h)` | void | 新建 `w×h` 画布 (白底) |
| `set_color(rgb)` | void | 设置画笔颜色 `0xRRGGBB` |
| `fill_rect(x, y, w, h)` | void | 填充矩形 |
| `fill_circle(cx, cy, r)` | void | 填充圆 |
| `draw_line(x0, y0, x1, y1)` | void | 画线 (Bresenham) |
| `draw_text(x, y, s)` | void | 绘制文本 (内置 5×7 点阵字库; 小写自动转大写) |
| `save_png(path)` | int | 导出 PNG, `0` 成功 / `-1` 失败 |
| `show_canvas()` | int | 存到临时 PNG 并用系统查看器打开 (跨平台“窗口”) |

```c
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

> 交互式**控件**版 (按钮/输入框) 依赖桌面图形库, 目前未提供; 画布 + PNG 导出 +
> 系统查看器窗口已覆盖大部分可视化需求。更高层的绘图辅助函数 (`g_rect_outline` /
> `g_bar_chart` / `g_line_chart` / `g_grid`) 见标准库 `gui.cin`
> ([标准库参考](/stdlib/reference))。

## GUI 窗口 (Windows Win32 / Linux X11)

5.8 新增**真·窗口**: 不经系统查看器, 程序自己创建窗口并把当前画布作为后备缓冲,
事件驱动式渲染 (每次 `gui_update()` 处理事件并呈现), 还能读鼠标。无显示环境
(SSH 无 X11、服务会话等) 下 `gui_new` 优雅失败返回 `-1`, 不抛异常。

| 函数 | 返回 | 说明 |
|------|------|------|
| `gui_new(w, h, title)` | `int` | 创建 `w×h` 窗口 (画布成为窗口后备缓冲), `0` 成功 / `-1` 失败 |
| `gui_update()` | `int` | 处理事件 + 呈现当前画布, `0` / 无窗口 `-1` (帧循环每帧调用) |
| `gui_closed()` | `int` | `1` 用户已请求关闭 (点 X / Alt+F4) / `0` |
| `gui_active()` | `int` | `1` 窗口已打开 / `0` |
| `gui_close()` | `int` | 销毁窗口 (画布保留, 仍可 `save_png`) |
| `mouse_x()` / `mouse_y()` | `int` | 光标在窗口内的坐标 / 无窗口 `-1` |
| `mouse_button()` | `int` | 位掩码: `bit0` 左键 / `bit1` 右键 / `bit2` 中键按住 |

```c
import "key.cin"

function main() -> int {
    if (gui_new(320, 240, "CIN 窗口") == -1) {
        println("无显示环境"); return 1
    }
    while (gui_closed() == 0) {
        fill_rect(0, 0, 320, 240)            // 清屏 (画到窗口后备缓冲)
        draw_text(8, 8, "HELLO CIN")
        gui_update()                          // 事件 + 呈现
        if (key_hit() == 1 && get_key() == K_ESC) { break }
        sleep_ms(16)                          // ~60 FPS
    }
    gui_close()
    return 0
}
```

- 完整示例见仓库 `examples/gui_demo.cin`; 画布内建 (`fill_rect` / `draw_text` …)
  在窗口打开期间直接画进后备缓冲;
- 窗口内的键盘事件与 [非阻塞键盘轮询](#键盘输入监听-非阻塞轮询) 共用同一套键码
  (含 F11/F12、Ctrl/Shift + 方向键)。

## 本地音频 (beep 合成 / 进度 / 暂停恢复 / 音量)

音频组覆盖「合成蜂鸣 + 文件/URL 播放 + 全套播放控制」。同一时刻只有一段播放,
`audio_play` / `beep` 都会打断上一次播放:

| 函数 | 返回 | 说明 |
|------|------|------|
| `audio_play(url)` | `int` | 下载 `http/https` URL 或读取本地文件并播放 (WAV/PCM), `0` 成功 / `-1` 失败 |
| `beep(freq, ms)` | `int` | 合成正弦蜂鸣 `freq` Hz × `ms` 毫秒 (`20..20000` Hz / `ms>=1`), `0` / `-1` |
| `audio_stop()` | `void` | 停止当前播放 (并解除暂停态) |
| `audio_wait()` | `void` | 阻塞到当前播放结束 |
| `audio_volume(v)` | `void` | 设置音量 `0..100` (越界自动钳制) |
| `audio_level()` | `int` | 读取当前音量 `0..100` (无播放时为默认/上次设置值) |
| `audio_duration()` | `int` | 播放总时长毫秒; 无播放 / 自然播完 / 时长未知 `-1` |
| `audio_pos()` | `int` | 已播放毫秒; 无播放 / 自然播完 `-1` (**暂停期间冻结**) |
| `audio_playing()` | `int` | `1` 正在发声 (已开始 / 未暂停 / 未播完), 否则 `0` |
| `audio_pause()` | `int` | 暂停播放, `0` 成功; 无播放 / 已暂停 / 平台不支持 `-1` |
| `audio_resume()` | `int` | 恢复播放 (进度无缝续走, 结束时刻相应后移), `0` / 无暂停可恢复 `-1` |

```c
function main() -> int {
    audio_volume(80)
    beep(440, 300)                    // A4 蜂鸣 (阻塞式)
    if (audio_play("tone.wav") == 0) {    // 本地文件 (或 https:// URL)
        audio_pause()
        println("pos=" + int_to_str(audio_pos()) + " dur=" + int_to_str(audio_duration()))
        audio_resume()
        audio_wait()
    }
    return 0
}
```

- 只支持 **WAV(PCM)**; MP3/OGG 需要额外解码库, 尚未纳入;
- 播放后端按平台选择 (Windows `waveOut`, 其它平台 `afplay` / `aplay` / `paplay` /
  `ffplay`), 无可用后端时 `audio_play` / `beep` 返回 `-1`;
- 暂停/恢复的平台实现: Windows `waveOutPause/Resume`, Unix 向播放器进程投递
  `SIGSTOP`/`SIGCONT`; 平台不支持时 `audio_pause`/`audio_resume` 返回 `-1`,
  程序可优雅跳过 (示例见 `examples/local_audio.cin`);
- `audio_pos` 在暂停期间**冻结**在暂停时刻, 不随真实时间前进。

## 命令行参数与行输入

跨平台一致的输入语义 (SYS 129..131, 由 Go 原生引擎实现):

| 函数 | 返回 | 说明 |
|------|------|------|
| `arg_count()` | `int` | 传给 CIN 程序的参数个数 (不含程序文件名本身) |
| `arg(i)` | `string` | 第 `i` 个参数; 越界为空串 |
| `input_str()` | `string` | 读入一行 UTF-8 文本 (不含行尾); EOF 为空串; **自带回显** |

```c
function main() -> int {
    int n = arg_count()
    for (int i = 0; i < n; i = i + 1) {
        println("arg[" + int_to_str(i) + "] = " + arg(i))
    }
    print("你的名字: ")
    string name = input_str()
    if (strcmp(name, "") != 0) { println("hi, " + name) }
    return 0
}
```

```bash
codecin demo.cin -- alpha beta      # `--` 之后的全部转交 CIN 程序 (见 CLI 参考)
echo Alice | codecin demo.cin       # 管道输入同样走 input_str
```

- 命令行参数: CLI 用 `--` 分隔; AOT 产物直接取 `os.Args[1:]` (标准库 `gostd.cin`
  的 `go_os_args_len` / `go_os_args_get` 即其包装);
- `input_str` 与行内建 `input` (读整数) 不同: 返回**一整行文本**, 交互运行时逐行
  等待键盘输入, 管道运行时由 CLI 预读全部标准输入再逐行分发。

## 文件系统

| 函数 | 签名 | 说明 |
|------|------|------|
| `file_read(path)` | string | 读文件内容 (失败为空串) |
| `file_write(path, s)` | int | 覆盖写, `0` 成功 / `-1` 失败 |
| `file_append(path, s)` | int | 追加写 |
| `file_exists(path)` | int | `1` 存在 / `0` 不存在 |
| `file_delete(path)` | int | 删除文件或空目录 |
| `file_size(path)` | int | 字节数 / `-1` |
| `mkdir(path)` | int | 递归创建目录 |
| `dir_list(path)` | string | 换行分隔条目 (目录名带 `/`) |
| `path_join(dir, name)` | string | 拼接路径 (**当前平台**分隔符: Windows `\`, Linux/Android `/`) |
| `path_basename(p)` | string | 路径末段名 |
| `path_dirname(p)` | string | 去掉末段后的目录 (同样用当前平台分隔符) |
| `path_abs(p)` | string | 绝对路径 (不要求已存在; 失败空串) |
| `file_copy(src, dst)` | int | 复制文件, `0` 成功 / `-1` 失败 |
| `file_move(src, dst)` | int | 移动或重命名, `0` 成功 / `-1` 失败 |
| `dir_remove(p)` | int | **递归删除**目录及其内容, `0` 成功 / `-1` 失败 |
| `is_dir(p)` | int | `1` 是目录 / `0` 不是 (含不存在) |
| `file_mtime(p)` | int | 修改时间 (Unix 秒) / `-1` 失败 |
| `temp_dir()` | string | 系统临时目录 |
| `chdir(p)` | int | 切换当前工作目录, `0` 成功 / `-1` 失败 |

实测示例 (Windows, 原生路径):

```c
function main() -> int {
    string f = "cin_io.txt"
    file_write(f, "hello")
    file_append(f, " world")
    println(file_read(f))
    println("size = " + int_to_str(file_size(f)))
    println("exists = " + int_to_str(file_exists(f)))
    return 0
}
```

```text
hello world
size = 11
exists = 1
```

路径与文件管理:

```c
string dir = temp_dir()
string f = path_join(dir, "cin_io.txt")
file_write(f, "hello")
println(path_basename(f))              // cin_io.txt
println(path_dirname(f))               // 与 temp_dir() 相同的目录
println("is_dir = " + int_to_str(is_dir(dir)))          // 1
println("mtime = " + int_to_str(file_mtime(f)))         // Unix 秒
file_copy(f, path_join(dir, "b.txt"))
file_move(path_join(dir, "b.txt"), path_join(dir, "c.txt"))
println("删除 = " + int_to_str(dir_remove(path_join(dir, "c.txt"))))   // 0
chdir(dir)                             // 之后的相对路径基于 dir
```

## 进程与环境

| 函数 | 签名 | 说明 |
|------|------|------|
| `exec(cmd)` | int | 执行 shell 命令, 返回退出码 |
| `exec_output(cmd)` | string | 执行并返回 stdout |
| `getenv(name)` | string | 读环境变量 (未设置为空串) |
| `setenv(name, value)` | int | 设置环境变量 |
| `os_name()` | string | `"windows"` / `"darwin"` / `"linux"`; Android 原生构建返回 `"android"` |
| `hostname()` | string | 主机名 |
| `username()` | string | 用户名 |
| `cwd()` | string | 当前工作目录 |
| `home_dir()` | string | 用户主目录 |
| `time_ms()` | int | Unix 时间戳 (毫秒) |
| `sleep_ms(ms)` | int | 阻塞睡眠, 返回 `0`; **单次上限 10 分钟** (600000 ms) |
| `cpu_count()` | int | 逻辑 CPU 数 |
| `arch_name()` | string | 目标架构 (`"amd64"` / `"arm64"` / `"386"` / `"arm"` …) |
| `mem_info()` | string | JSON `{"total_kb":N,"free_kb":M}`; 未知平台为 `{"total_kb":0,"free_kb":0}` |
| `is_android()` | int | `1` Android (含 Termux) / `0` |

```c
println("os = " + os_name())            // os = windows
println("cwd = " + cwd())               // cwd = D:\ByUsi\Projects\UCPU
setenv("MY_VAR", "42")
println(getenv("MY_VAR"))               // 42
println(exec_output("echo hi"))         // hi
println("ms = " + int_to_str(time_ms()))
println("cpu = " + int_to_str(cpu_count()) + " arch = " + arch_name())
println(mem_info())                     // {"total_kb":...,"free_kb":...}
sleep_ms(100)                           // 睡 100 毫秒 (上限 600000)
```

::: warning 这是真实的宿主权限
`exec` / `file_write` / `file_delete` / `dir_remove` / `download` / `http_get` / `http_post` /
`tcp_dial` / `udp_sendto` / `dlopen` / `chdir`
具备当前进程的文件与网络权限, 不会沙箱化。
运行不可信程序时用 `--sandbox` (仅放行内存与计时 SYS) 与 `--no-io` (禁止 `IN`/`OUT` 与宿主 I/O)。
:::

## 网络 (HTTP / TCP / UDP / DNS)

HTTP 之外, 5.9.0 新增自定义方法请求、状态码查询、TCP 客户端/服务端、UDP 数据报与
DNS 解析 (SYS 145..157, Go 标准库实现)。主机名参数统一支持域名
(`tcp_dial("example.com", 80)` / `udp_sendto(fd, "example.com", 53, ...)`), 不必先手工解析 IP。

### HTTP

| 函数 | 签名 | 说明 |
|------|------|------|
| `http_get(url)` | string | GET 并返回响应体; 失败空串 (**15 秒超时, 8 MiB 上限**) |
| `http_post(url, body)` | string | POST (`text/plain; charset=utf-8`) 并返回响应体; 失败空串 (同样 15 秒 / 8 MiB) |
| `http_req(method, url, headers, body)` | string | 自定义方法与头部 (SYS 145); `headers` 为 `"Key: Value\n"` 换行分隔, 空串表示无头; 失败空串 |
| `http_code()` | int | 最近一次 HTTP 请求状态码 (SYS 146); 从未请求 `-1` (`http_get` / `http_post` / `http_req` 语义一致) |
| `download(url, path)` | int | 下载到文件; `0` 成功 / `-1` 失败 (**非 2xx 算失败**, 落盘上限 256 MiB) |

> `http_get` / `http_post` / `http_req` 不检查状态码, 非 2xx 也会返回响应体 (用
> `http_code()` 自行判断); `download` 把非 2xx 视为失败。

```cin
function main() -> int {
    string body = http_req("GET", "https://api.example.com/v1/info",
                           "Authorization: Bearer xxx\nAccept: application/json", "")
    println("HTTP " + int_to_str(http_code()))     // 200 / 404 ...
    println("长度 = " + int_to_str(strlen(body)))
    return 0
}
```

### TCP (SYS 147..152)

| 函数 | 签名 | 说明 |
|------|------|------|
| `tcp_dial(host, port)` | int | 建立连接 (10 秒超时), 返回连接句柄; 失败 `-1` |
| `tcp_send(fd, buf, n)` | int | 发送 `n` 字节, 返回发送字节数; 失败 `-1` |
| `tcp_recv(fd, buf, max)` | int | 接收至多 `max` 字节写入 `buf`; 对端关闭 `0`, 失败 `-1` (单次上限 4/8 MiB) |
| `tcp_close(fd)` | int | 关闭连接, `0` / `-1` |
| `tcp_listen(port)` | int | 监听端口, 返回监听句柄; 失败 `-1` |
| `tcp_accept(lfd)` | int | 阻塞接受一个连接, 返回连接句柄; 失败 `-1` |

```cin
function main() -> int {
    int fd = tcp_dial("example.com", 80)      // 域名直接可连
    if (fd <= 0) { println("连接失败"); return 1 }
    string req = "GET / HTTP/1.0\r\nHost: example.com\r\n\r\n"
    tcp_send(fd, req, strlen(req))
    int buf[512]
    int n = tcp_recv(fd, buf, 4096)           // 字节流原样写入缓冲内存
    println("收到 " + int_to_str(n) + " 字节")
    tcp_close(fd)
    return 0
}
```

### UDP (SYS 153..156)

| 函数 | 签名 | 说明 |
|------|------|------|
| `udp_open(port)` | int | 打开 UDP 套接字并绑定端口 (`0` = 系统分配); 失败 `-1` |
| `udp_sendto(fd, host, port, buf, n)` | int | 发送数据报 (host 支持域名/IP), 返回发送字节数; 失败 `-1` |
| `udp_recvfrom(fd, buf, max, srcbuf)` | int | 接收数据报, 源地址 `"ip:port"` 写入 `srcbuf` (传 `0` 忽略); 失败 `-1` |
| `udp_close(fd)` | int | 关闭套接字, `0` / `-1` |

### DNS (SYS 157)

| 函数 | 签名 | 说明 |
|------|------|------|
| `dns_lookup(host)` | string | 解析主机名为 IP 字符串 (偏好 IPv4); 失败空串 |

- CIN 数组每个元素占 8 字节, `tcp_recv` / `udp_recvfrom` 把收到的字节流**原样写入缓冲内存**;
- 按行收发、`http_ok()` 判断、TCP 回环等便捷封装见标准库 `net.cin`
  ([标准库参考](/stdlib/reference#net))。

## FFI 动态库调用

5.9.0 新增 (SYS 140..144): 加载动态库 (`dlopen`)、查找导出符号 (`dlsym`)、
调用外部函数 (`ffi_call` / `ffi_callf`)、卸载 (`lib_close`)。最多 8 个参数、每个占 8 字节;
`argbuf` 是 VM 内存中 8 字节对齐的参数缓冲 —— int 数组槽即 int64 位模式,
float 数组槽即 IEEE754 位模式; 浮点参数经 Windows x64 `XMM0-3` / SysV `XMM0-7`
寄存器正确传参。

| 函数 | 返回 | 说明 |
|------|------|------|
| `dlopen(path)` | int | 加载动态库, 返回库句柄; 失败返回 `0` (不抛异常) |
| `dlsym(handle, symbol)` | int | 查找导出符号, 返回函数句柄; 失败返回 `0` |
| `ffi_call(fn, argbuf, n)` | int | 以 `n` 个整数参数调用函数, 返回 int64 |
| `ffi_callf(fn, argbuf, n)` | float | 以 `n` 个浮点参数调用函数, 返回值按 double 位模式进 X0 |
| `lib_close(handle)` | int | 卸载动态库, `0` 成功 / `-1` 失败 |

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

## 编码与哈希

| 函数 | 签名 | 说明 |
|------|------|------|
| `sha256(s)` | string | SHA-256 十六进制摘要 (**小写**) |
| `base64_encode(s)` | string | 标准 Base64 (带 `=` 填充) |
| `base64_decode(s)` | string | Base64 解码; **非法输入返回空串** |

```c
println(sha256("hello"))            // 2cf24dba5fb0a30e26e83b2ac5b9e29e...
string enc = base64_encode("hello")
println(enc)                        // aGVsbG8=
println(base64_decode(enc))         // hello
println(int_to_str(strlen(base64_decode("!!"))))   // 0 (非法输入 -> 空串)
```

## 桌面集成 (剪贴板 / 通知 / 打开 URL)

| 函数 | 签名 | 说明 |
|------|------|------|
| `clipboard_get()` | string | 读剪贴板文本 (失败空串; 末尾换行被去掉) |
| `clipboard_set(s)` | int | 写剪贴板, `0` 成功 / `-1` 失败 |
| `notify(title, body)` | int | 系统通知, `0` 成功 / `-1` 失败 |
| `open_url(url)` | int | 用默认浏览器/查看器打开, `0` 成功 / `-1` 失败 |

分发顺序是 **Termux 优先 → 平台原生命令**; 命令缺失时优雅失败 (返回 `-1` 或空串), 不抛异常:

| 平台 | 剪贴板读 | 剪贴板写 | 通知 | 打开 URL |
|------|----------|----------|------|----------|
| Windows | PowerShell `Get-Clipboard -Raw` | `cmd /c clip` | `Wscript.Shell.Popup` (**10 秒自动消失**) | `cmd /c start "" <url>` |
| Linux | `wl-paste` → `xclip -o` → `xsel -b` | `wl-copy` → `xclip -i` → `xsel -b -i` | `notify-send` | `xdg-open` |
| macOS | `pbpaste` | `pbcopy` | `osascript` | `open` |
| Android / Termux | `termux-clipboard-get` | `termux-clipboard-set` | `termux-notification` | `termux-open-url` |

```c
clipboard_set("来自 CIN 的文本")
println(clipboard_get())                                  // 来自 CIN 的文本
println("notify = " + int_to_str(notify("Code CIN", "完成")))
println("open = " + int_to_str(open_url("https://example.com")))
```

## Termux API (Android)

在 Termux 中 `pkg install termux-api` 并安装 **Termux:API** 应用后可用; 非 Termux 环境下
所有调用会优雅失败 (返回 `-1` 或空串)。

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

```c
if (termux_available() == 1) {
    termux_notify("Code CIN", "任务完成")
    termux_toast("hello from CIN")
    termux_vibrate(200)
    termux_tts("done")
    println(termux_battery())
    println(termux_clipboard_get())
}
```

更高的封装 (`tx_notify` / `tx_battery_level` / `tx_latitude` …) 见标准库 `termux.cin`
与 [标准库参考](/stdlib/reference); 一键安装脚本见仓库 `script/install_termux.sh`。

## Android / Termux 扩展

这一组在 **Android/Termux 之外一律优雅失败** (返回 `-1` 或空串), 不抛异常:

| 函数 | 签名 | 说明 |
|------|------|------|
| `is_android()` | int | `1` Android (含 Termux) / `0` |
| `android_intent(action, uri)` | int | 发起系统 Intent (`am start -a <action> -d <uri>`; Termux 下回退 `termux-am`); Android 之外返回 `-1` |
| `termux_call(number)` | int | 拨号 (`termux-telephony-call`) |
| `termux_share(file)` | int | 系统分享文件 (`termux-share -a send`) |
| `termux_torch(on)` | int | 手电筒开/关 (`termux-torch`, 非 0 视为开) |
| `termux_volume(stream, vol)` | int | 设置音频流音量 (`termux-volume <stream> <vol>`) |
| `termux_brightness(level)` | int | 设置屏幕亮度 (`termux-brightness`, 通常 `0..255`) |
| `termux_camera_photo(path)` | int | 后置摄像头拍照保存 (`termux-camera-photo -c 0`) |
| `termux_fingerprint()` | string | 指纹认证结果 (JSON; 失败空串) |
| `termux_sensor(type)` | string | 传感器单次读数 (JSON, `termux-sensor -s <type> -n 1`; 失败空串) |

```c
if (is_android() == 1) {
    android_intent("android.intent.action.VIEW", "https://example.com")
    termux_share("photo.jpg")
    termux_torch(1)                       // 开灯
    termux_volume("music", 8)
    termux_brightness(120)
    termux_camera_photo("photo.jpg")
    println(termux_fingerprint())
    println(termux_sensor("accelerometer"))
} else {
    println("非 Android: 这组调用返回 -1 / 空串")
}
```

## 键盘输入监听 (非阻塞轮询)

面向游戏循环 / TUI 的**非阻塞**键盘轮询, 需要**真实终端**: 首次调用会把终端切到原始输入
(不回显、无行缓冲), 程序退出自动恢复。管道 / 重定向 / IDE 捕获输出的环境下**优雅失败**
(`key_hit` 恒 `0`, `get_key` 恒 `-1`), 不阻塞、不报错; `--sandbox` 下同样拦截
(报 `Host capability disabled in sandbox mode`)。

| 函数 | 返回 | 说明 |
|------|------|------|
| `key_hit()` | `int` | `1` 有待读按键 / `0` 无 |
| `get_key()` | `int` | 取出一个键码; 无按键 `-1` |
| `key_flush()` | `int` | 清空键盘输入缓冲, 返回 `0` |

键码约定:

| 返回值 | 含义 |
|--------|------|
| `0..127` | Unicode 码点: 字母 / 数字 / `Enter`=13 / `Tab`=9 / `Backspace`=8 / `Esc`=27; Ctrl+字母 = 字母 & 0x1F (Ctrl+C 即 `3`, 监听期间**不会**终止程序) |
| `1001..1010` | `↑ ↓ ← →` / Home / End / PgUp / PgDn / Ins / Del |
| `1021..1032` | F1 .. F12 |
| `1101..1104` | Ctrl + `↑ ↓ ← →` |
| `1105..1108` | Shift + `↑ ↓ ← →` |
| `1109` | Shift+Tab (反向遍历) |
| `-1` | 无按键 |

- **Unicode 码点**: Windows 端 UTF-16 代理对会组合成单个码点, 中文 / Emoji 等
  非 ASCII 输入不再丢失;
- **修饰键组合**: Ctrl/Shift + 方向键与 Shift+Tab 在 Windows 控制台与 Unix
  终端 (CSI 修饰序列) 下键码一致, 游戏 / TUI 跨平台可用。

真实终端下激活监听时, 原生引擎先把已缓冲输出落到终端, 之后逐条直写 stdout,
"提示 → 等按键 → 反馈"顺序实时可见; 非终端环境 (管道 / 重定向 / 测试捕获) 保持
"缓冲 + 结束回传"不变。

::: tip 推荐 key.cin 标准库
[`codecin/lib/key.cin`](/stdlib/reference#key) 提供 `enum Key` 键码常量 (`K_UP`..`K_F10`、
`K_ESC` `K_ENTER` `K_TAB` `K_BACKSPACE`) 与 `k_ctrl` (Ctrl 组合键码)、
`k_is_special` (扩展键码判定)、`key_wait` (10ms 轮询阻塞等一键)。
:::

```c
import "key.cin"

function main() -> int {
    println("方向键移动, ESC 退出")
    while (1) {
        int k = key_wait()
        if (k == K_ESC) { break }
        if (k == K_LEFT)  { println("left") }
        if (k == K_RIGHT) { println("right") }
    }
    return 0
}
```

## 能力矩阵

| 能力 | 内建 | 说明 |
|------|------|------|
| GUI 窗口 / 鼠标 | `gui_new` 系列 | Windows Win32 / Linux X11 |
| 画布 / PNG 导出 / 查看器 | `canvas` 系列 | — |
| 本地音频 (合成 / 播放控制) | `beep` / `audio_play` (WAV) / 进度 / 暂停恢复 / 音量 | — |
| 命令行参数 / 行输入 | `arg_count` / `arg` / `input_str` | CLI `--` 与管道注入 |
| 文件 / 目录 / 路径 | `file_*` / `path_*` / `dir_remove` / `chdir` | 真实文件系统权限 |
| 进程 / 环境变量 / 系统信息 | `exec` / `getenv` / `os_name` / `time_ms` / `mem_info` | — |
| 网络 (HTTP / TCP / UDP / DNS) | `http_get` / `http_req` / `tcp_*` / `udp_*` / `dns_lookup` | HTTP 15 s 超时 / 8 MiB 上限 |
| FFI 动态库调用 | `dlopen` / `dlsym` / `ffi_call` / `ffi_callf` / `lib_close` | 最多 8 个 8 字节参数 |
| 编码与哈希 | `sha256` / `base64_*` | — |
| 桌面集成 | 剪贴板 / 通知 / `open_url` | — |
| Termux API 与 Android 扩展 | `termux_*` / `android_intent` | 需 Termux:API; 非 Android 优雅失败 |
| 键盘输入 (非阻塞轮询) | `key_hit` / `get_key` / `key_flush` | 需真实终端; Unicode 码点 + F1..F12 + Ctrl/Shift 组合 |
| 纯 CIN 标准库 (`math`/`sort`/`hash`…) | — | 只依赖语言内建, `--sandbox` 下不受影响 |

以上宿主内建均由 Go 原生引擎实现; `--sandbox` 下仅放行内存与计时 SYS。

## 相关页面

- [Go 原生运行时](/runtime/native) — 原生库加载与宿主调用区段
- [内建函数](/language/builtins) — 宿主内建的完整清单
- [标准库参考](/stdlib/reference) — `io` / `gui` / `termux` / `key` / `net` / `ffi` 库的封装函数
