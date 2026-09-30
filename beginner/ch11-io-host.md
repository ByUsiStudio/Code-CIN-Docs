---
description: "第 11 章：CIN 读写的文件与路径、网络请求、哈希/编码、桌面集成（剪贴板/通知）、画布绘图、系统信息与环境变量、Android/Termux 扩展、键盘输入监听与安全注意事项。"
---

# 第 11 章 文件、画布与系统交互

::: info 本章目标
让程序与“外面”打交道: 读写文件、生成图片、获取系统信息、执行命令。
这些能力属于**宿主能力**, 需要 Go 原生运行时 (默认路径)。
:::

## 11.1 前提: 需要原生运行时

用默认命令运行即可 (会自动使用已安装的原生库):

```bash
codecin prog.cin
```

如果加了 `--no-native` (或者原生库没装上), 程序会在**调用宿主功能的那一行**
报错并退出码 1:

```text
ERROR    Execution error: host builtins (GUI/audio/system/Termux) require the
         native Go runtime (run without --no-native)
```

::: warning 宿主能力是真实的系统权限
`file_write` / `file_delete` / `dir_remove` / `exec` / `download` / `http_get` / `http_post` / `chdir`
用的是当前用户的真实文件与网络权限, 不会自动沙箱化。
运行别人的程序前先看一眼代码; 不放心时加 `--sandbox` (限制宿主访问) 或 `--no-io`。
:::

## 11.2 读写文件 (内建函数)

| 函数 | 作用 |
|------|------|
| `file_read(path)` | 读整个文件为字符串 (失败返回空串) |
| `file_write(path, text)` | 覆盖写, 返回 `0` 成功 / `-1` 失败 |
| `file_append(path, text)` | 追加写 |
| `file_exists(path)` | `1` 存在 / `0` 不存在 |
| `file_size(path)` | 字节数 (失败 `-1`) |
| `file_delete(path)` | 删除文件或空目录 |
| `mkdir(path)` | 递归创建目录 |
| `dir_list(path)` | 列出目录内容 (换行分隔, 目录名带 `/`) |

```c
function main() -> int {
    string path = "diary.txt"

    file_write(path, "第一天: 开始学 CIN\n")     // 覆盖写
    file_append(path, "第二天: 学会了循环\n")     // 追加

    string text = file_read(path)
    println(text)
    println("存在? " + file_exists(path))
    println("大小: " + file_size(path) + " 字节")
    return 0
}
```

```text
第一天: 开始学 CIN
第二天: 学会了循环

存在? 1
大小: 52 字节
```

> 示例里写的是相对路径, 相对**当前工作目录** (即你运行 `codecin` 的目录)。

### 路径与文件管理

| 函数 | 作用 |
|------|------|
| `path_join(dir, name)` | 拼接路径 (用**当前平台**分隔符: Windows `\`, Linux/Android `/`) |
| `path_basename(p)` / `path_dirname(p)` | 取路径的末段名 / 目录部分 (同样用当前平台分隔符) |
| `path_abs(p)` | 绝对路径 (不要求存在; 失败空串) |
| `file_copy(src, dst)` / `file_move(src, dst)` | 复制 / 移动(重命名), `0` 成功 / `-1` 失败 |
| `dir_remove(p)` | **递归删除**目录及其内容 |
| `is_dir(p)` | `1` 是目录 / `0` 不是 |
| `file_mtime(p)` | 修改时间 (Unix 秒, 失败 `-1`) |
| `temp_dir()` | 系统临时目录 |
| `chdir(p)` | 切换当前工作目录 |

```c
function main() -> int {
    string dir = temp_dir()
    string f = path_join(dir, "demo.txt")

    file_write(f, "hello")
    println("文件名: " + path_basename(f))       // demo.txt
    println("目录: " + path_dirname(f))          // 与 temp_dir() 相同
    println("绝对路径: " + path_abs(f))
    println("是目录? " + is_dir(dir))            // 1
    println("修改时间: " + file_mtime(f))        // Unix 秒

    file_copy(f, path_join(dir, "copy.txt"))
    println("清理: " + dir_remove(path_join(dir, "copy.txt")))   // 0
    return 0
}
```

> `chdir` 会改变整个进程的工作目录, 之后的**相对路径**都基于新目录; 出错时返回 `-1` 且不改动。

## 11.3 按行处理文件 (`io.cin`)

`io.cin` 把常见的文本操作包装好了。注意 `io_line_count` / `io_get_line` 接收的是
**文本内容**而不是路径:

```c
import "io.cin"

function main() -> int {
    io_write("numbers.txt", "10\n20\n30\n")

    string text = io_read("numbers.txt")
    println("行数: " + io_line_count(text))
    println("第二行: " + io_get_line(text, 1))
    println("文件大小: " + io_size("numbers.txt"))
    println("逗号分段: " + io_split_get("a,b,c", ",", 1))
    println("存在性: " + io_exists("numbers.txt"))
    return 0
}
```

```text
行数: 4
第二行: 20
文件大小: 9
逗号分段: b
存在性: 1
```

(内容是 `10\n20\n30\n`, 末尾换行会多算出一行, 所以行数是 4。)

::: tip 把数据文件当“输入源”
交互输入用 `input()` 即可 (见 [第 2 章](/beginner/ch02-variables#_2-8-读取用户输入))。
数据量较大时, **用文件当输入**更实用: 把数据写进 `data.txt`, 程序读进来处理后输出结果。
:::

## 11.4 系统信息与环境变量

```c
function main() -> int {
    println("系统: " + os_name())          // windows / darwin / linux
    println("主机名: " + hostname())
    println("用户名: " + username())
    println("当前目录: " + cwd())
    println("主目录: " + home_dir())

    setenv("CIN_DEMO", "42")
    println("环境变量 CIN_DEMO = " + getenv("CIN_DEMO"))
    return 0
}
```

```text
系统: windows
主机名: <你的主机名>
用户名: <你的用户名>
当前目录: <你的当前目录>
主目录: <你的用户主目录>
环境变量 CIN_DEMO = 42
```

尖括号部分是随机器变化的, 所以不写死具体值。

### 时间与系统信息

| 函数 | 作用 |
|------|------|
| `time_ms()` | Unix 时间戳 (毫秒); `time()` 是秒 |
| `sleep_ms(ms)` | 阻塞睡眠指定毫秒, 返回 `0`; **单次上限 10 分钟** (600000 ms) |
| `cpu_count()` | 逻辑 CPU 数 |
| `arch_name()` | 目标架构 (`"amd64"` / `"arm64"` / `"386"` / `"arm"` …) |
| `mem_info()` | 内存信息 JSON `{"total_kb":N,"free_kb":M}`; 未知平台为 0 |
| `is_android()` | `1` Android (含 Termux) / `0` |

```c
function main() -> int {
    println("毫秒时间戳: " + time_ms())
    println("CPU: " + cpu_count() + " 架构: " + arch_name())
    println(mem_info())                    // {"total_kb":...,"free_kb":...}
    println("是 Android? " + is_android())
    sleep_ms(100)                          // 睡 0.1 秒 (上限 600000)
    return 0
}
```

> `os_name()` 除 `"windows"` / `"darwin"` / `"linux"` 外, **Android 原生构建会返回 `"android"`**。

## 11.5 网络请求 (HTTP/HTTPS)

| 函数 | 作用 |
|------|------|
| `http_get(url)` | GET 并返回响应体; 失败返回空串 (**15 秒超时, 8 MiB 上限**) |
| `http_post(url, body)` | POST (`text/plain; charset=utf-8`) 并返回响应体; 失败空串 |
| `download(url, path)` | 下载到文件; `0` 成功 / `-1` 失败 (**非 2xx 算失败**, 上限 256 MiB) |

```c
function main() -> int {
    string page = http_get("https://example.com/")
    println("拿到 " + strlen(page) + " 字节")

    string echo = http_post("https://example.com/api", "name=cin")
    println("POST 返回 " + strlen(echo) + " 字节")

    int rc = download("https://example.com/logo.png", "logo.png")
    println("download = " + rc)         // 0 成功
    return 0
}
```

::: warning 会真的联网
`http_get` / `http_post` **不检查状态码** (非 2xx 也会把响应体返回给你),
`download` 把非 2xx 视为失败。请求超时 15 秒、响应体上限 8 MiB, 下载上限 256 MiB。
:::

## 11.6 编码与哈希

| 函数 | 作用 |
|------|------|
| `sha256(s)` | SHA-256 摘要, 十六进制**小写**字符串 |
| `base64_encode(s)` | 标准 Base64 编码 (带 `=`) |
| `base64_decode(s)` | Base64 解码; **非法输入返回空串** |

```c
function main() -> int {
    println(sha256("hello"))
    string enc = base64_encode("hello")
    println(enc)                        // aGVsbG8=
    println(base64_decode(enc))         // hello
    println(strlen(base64_decode("!!")))// 0 (非法输入 -> 空串)
    return 0
}
```

## 11.7 桌面集成: 剪贴板 / 通知 / 打开链接

| 函数 | 作用 |
|------|------|
| `clipboard_get()` | 读剪贴板文本 (失败空串; 末尾换行被去掉) |
| `clipboard_set(s)` | 写剪贴板, `0` 成功 / `-1` 失败 |
| `notify(title, body)` | 弹系统通知, `0` 成功 / `-1` 失败 |
| `open_url(url)` | 用默认浏览器打开, `0` 成功 / `-1` 失败 |

```c
function main() -> int {
    clipboard_set("来自 CIN 的文本")
    println(clipboard_get())
    println("通知: " + notify("Code CIN", "任务完成"))
    println("打开: " + open_url("https://example.com"))
    return 0
}
```

底层实现按平台分发 (**Termux 优先**, 然后是各平台的原生命令), 命令缺失时**优雅失败**
(返回 `-1` 或空串), 不会抛异常:

| 平台 | 剪贴板 | 通知 | 打开 URL |
|------|--------|------|----------|
| Windows | PowerShell `Get-Clipboard` / `cmd /c clip` | `Wscript.Shell.Popup` (**10 秒自动消失**) | `cmd /c start` |
| Linux | `wl-paste` / `xclip` / `xsel` (写为 `wl-copy` / `xclip -i` / `xsel -b -i`) | `notify-send` | `xdg-open` |
| macOS | `pbpaste` / `pbcopy` | `osascript` | `open` |
| Android / Termux | `termux-clipboard-get` / `termux-clipboard-set` | `termux-notification` | `termux-open-url` |

## 11.8 执行命令

| 函数 | 作用 |
|------|------|
| `exec(cmd)` | 执行命令, 返回退出码 |
| `exec_output(cmd)` | 执行命令并返回它的标准输出 |

```c
function main() -> int {
    println("echo 的输出: " + exec_output("echo hello"))
    int code = exec("exit 3")
    println("退出码: " + code)
    return 0
}
```

命令通过平台默认 shell 执行 (Windows 是 `cmd /c`, 其它平台是 `sh -c`)。

::: danger 不要拼接待执行的命令
`exec_output("echo " + user_input)` 这类写法会把用户输入当成命令执行 (命令注入)。
需要传参时, 固定命令字符串、只把数据写进文件或用环境变量传递。
:::

## 11.9 画布: 生成图片

内置 2D 画布可以画矩形、圆、线、文字, 并导出 PNG:

| 函数 | 作用 |
|------|------|
| `canvas(w, h)` | 新建 `w×h` 画布 (白底) |
| `set_color(rgb)` | 设置画笔颜色 `0xRRGGBB` |
| `fill_rect(x, y, w, h)` | 填充矩形 |
| `fill_circle(cx, cy, r)` | 填充圆 |
| `draw_line(x0, y0, x1, y1)` | 画线 |
| `draw_text(x, y, text)` | 写文字 (内置 5×7 点阵字库) |
| `save_png(path)` | 导出 PNG, `0` 成功 / `-1` 失败 |
| `show_canvas()` | 存到临时文件并用系统查看器打开 |

```c
function main() -> int {
    canvas(320, 200)
    set_color(0x3366FF)
    fill_rect(20, 20, 120, 120)
    set_color(0xFF6600)
    fill_circle(240, 80, 50)
    set_color(0x000000)
    draw_text(20, 160, "Code CIN")
    return save_png("picture.png")
}
```

运行后当前目录会出现 `picture.png`。也可以在 `gui.cin` 里用图表函数直接画柱状图:

```c
import "gui.cin"

function main() -> int {
    int vals[4] = {30, 70, 50, 90}
    g_new(320, 200)
    g_clear(320, 200, g_rgb(255, 255, 255))
    g_bar_chart(vals, 4, 320, 200)
    int rc = g_save("chart.png")
    println("g_save = " + rc)
    return 0
}
```

```text
g_save = 0
```

`g_line_chart` / `g_grid` / `g_rect_outline` 可以画折线图、网格与边框。

## 11.10 音频与 Termux / Android (了解即可)

- **音频**: `audio_play(url)` 支持 `http/https` 或本地 **WAV(PCM)** 文件, 配套
  `audio_stop` / `audio_volume` / `audio_wait`。MP3/OGG 暂不支持。
- **Termux (安卓)**: 装了 Termux:API 后可以用 `termux_notify` / `termux_toast` /
  `termux_vibrate` / `termux_tts` / `termux_battery` 等, 非 Termux 环境会优雅失败。
- **Android / Termux 扩展**: 用 `is_android()` 先判断环境, 再调用 `android_intent` /
  `termux_call` / `termux_share` / `termux_torch` / `termux_volume` /
  `termux_brightness` / `termux_camera_photo` / `termux_fingerprint` / `termux_sensor`。
  这些在**非 Android 环境一律优雅失败** (返回 `-1` 或空串), 不会抛异常:

```c
function main() -> int {
    if (is_android() == 1) {
        termux_torch(1)                          // 打开手电筒
        termux_volume("music", 8)
        termux_camera_photo("photo.jpg")
        println(termux_sensor("accelerometer"))  // JSON
    } else {
        println("非 Android: 这组调用返回 -1 / 空串")
    }
    return 0
}
```

完整清单见 [宿主能力](/language/host-abilities)。

## 11.11 键盘输入监听 (了解即可)

内建 `key_hit()` / `get_key()` / `key_flush()` 提供非阻塞键盘轮询, 适合游戏循环:
`key_hit()` 返回 `1` 表示有按键可读, `get_key()` 取出键码 (无按键返回 `-1`),
`key_flush()` 清空键盘输入缓冲。需要**真实终端** (管道 / 重定向下 `key_hit` 恒 `0`、
`get_key` 恒 `-1`, 不报错), 程序退出自动恢复终端设置。

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

`key.cin` 的 `enum Key` 提供 `K_UP`..`K_F10`、`K_ESC` 等键码常量。不用常量时:
`0..255` 是原始字节 (Ctrl+C 在监听期间是键码 `3`, **不会**终止程序),
方向键 / Home / End / PgUp / PgDn / Ins / Del 是 `1001..1010`, F1..F10 是 `1021..1030`。
完整键码表见 [宿主能力 · 键盘输入监听](/language/host-abilities#键盘输入监听-非阻塞轮询)。

::: warning 循环要有退出条件
监听期间 Ctrl+C 不再终止程序 (表现为键码 `3`), 所以键盘轮询循环一定要有退出条件,
比如按 `K_ESC` 跳出。
:::

## 11.12 常见错误

| 现象 | 原因 | 解决 |
|------|------|------|
| `host builtins ... require the native Go runtime` | 用了 `--no-native` | 去掉该选项; 或确认原生库已加载 |
| `file_read` 返回空串 | 路径不对 / 文件不存在 | 先 `file_exists` 检查, 注意相对路径基于当前目录 |
| 写文件返回 `-1` | 目录不存在或无权限 | 先 `mkdir`, 或换可写目录 |
| 图片没生成 | `save_png` 返回了 `-1` | 检查目标目录是否存在 |
| `exec` 卡住 | 命令等待输入 | 换用不交互的命令 |
| `http_get` / `download` 返回空串 / `-1` | 断网、超时 (15 秒)、非 2xx 或超过大小上限 | 检查 URL 与网络; `download` 换 2xx 直链 |
| 剪贴板 / 通知返回 `-1` | 平台命令缺失 (如 Linux 没装 `xclip` / `notify-send`) | 安装对应工具; Android 装 Termux:API |
| 键盘轮询没反应 | 管道 / 重定向 / IDE 捕获输出, 不是真实终端 | 在真实终端运行; `key_hit` 恒 `0`、`get_key` 恒 `-1` 是预期行为 |
| `base64_decode` 返回空串 | 输入不是合法 Base64 | 先校验输入 |

## 11.13 练习

1. 让程序把 `1` 到 `5` 每行一个数写入 `nums.txt`, 再读回来打印。
2. 读取一个文本文件, 统计它有多少行、多少字节。
3. 生成一张 200×200 的 PNG: 红色方框 + 蓝色对角线。
4. 打印当前系统名、当前目录与一个自设的环境变量。
5. 用 `exec_output` 执行一个打印数字的命令, 再用 `atoi` 把输出转成整数并加 1 打印。
   (提示: Windows 用 `echo 41`, Linux/macOS 用 `echo 41`, 注意 `exec_output` 可能带换行,
   可用 `trim` 清理。)
6. 用 `path_join` + `temp_dir` 拼出一个临时文件路径, 写入内容后打印 `file_mtime`, 最后 `dir_remove` 清理。
7. 计算某个字符串的 `sha256`, 再用 `base64_encode` 编码同一个字符串, 打印两个结果。

参考实现见 [习题与答案 · 第 11 章](/beginner/exercises#第-11-章)。

## 11.14 本章小结

- 宿主能力 (文件 / 路径 / 网络 / 哈希 / 桌面 / 画布 / 音频 / 命令 / Termux / 键盘) 需要 Go 原生运行时,
  `--no-native` 下调用会报 `host builtins ... require the native Go runtime`;
- 文件: `file_write` / `file_append` / `file_read` / `file_exists` / `file_size` / `mkdir`;
  路径与管理: `path_join` / `path_basename` / `path_dirname` / `path_abs` / `file_copy` /
  `file_move` / `dir_remove` / `is_dir` / `file_mtime` / `temp_dir` / `chdir`;
- `io.cin` 提供按行与分段的文本处理 (`io_line_count` / `io_get_line` / `io_split_get`);
- 系统信息: `os_name` / `hostname` / `username` / `cwd` / `home_dir` / `time_ms` /
  `cpu_count` / `arch_name` / `mem_info` / `is_android`; 环境变量 `getenv` / `setenv`;
- 网络与编码: `http_get` / `http_post` / `download`、`sha256` / `base64_encode` / `base64_decode`;
- 桌面: `clipboard_get` / `clipboard_set` / `notify` / `open_url`;
- 画布: `canvas` + `set_color` + 形状函数 + `save_png`; `gui.cin` 提供图表封装;
- 键盘: `key_hit` / `get_key` / `key_flush` 非阻塞轮询, 需真实终端; `key.cin` 提供 `K_*` 常量与 `key_wait`;
- 权限是真实的 (含文件与网络), 谨慎运行来路不明的程序。

下一章: [调试与排错](/beginner/ch12-debug)。
