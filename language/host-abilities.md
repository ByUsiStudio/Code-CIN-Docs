---
description: "CIN 宿主能力：2D 画布导出 PNG、联网音频、文件/路径/进程/系统信息、HTTP 网络、哈希与 Base64、桌面集成（剪贴板/通知/打开 URL）与 Termux/Android API，均需 Go 原生运行时。"
---

# 宿主能力

除了纯计算, CIN 还能直接调用宿主: 画布绘图 (导出 PNG)、联网音频播放、文件与路径操作、
进程与系统信息、HTTP 网络请求、哈希与 Base64、桌面集成 (剪贴板 / 通知 / 打开 URL),
以及在 Android Termux 下调用 Termux 与 Android API。

::: danger 这些能力只有 Go 原生实现
宿主能力内建**没有纯 Python 实现**。用 `--no-native` (或原生库加载失败) 时调用它们会直接
报错并以退出码 1 结束:

```text
ERROR    Execution error: host builtins (GUI/audio/system/Termux) require the
         native Go runtime (run without --no-native)
+------------------------------ Execution Error ------------------------------+
| host builtins (GUI/audio/system/Termux) require the native Go runtime (run  |
| without --no-native)                                                        |
+-----------------------------------------------------------------------------+
```
:::

除此之外的所有语言功能 (含全部纯 CIN 标准库) 在三路径下行为一致。

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

## 联网音频

| 函数 | 签名 | 说明 |
|------|------|------|
| `audio_play(url)` | int | 下载 `http/https` URL 或读取本地文件并播放 (WAV/PCM), `0` 成功 / `-1` 失败 |
| `audio_stop()` | void | 停止当前播放 |
| `audio_volume(v)` | void | 设置音量 `0..100` (支持则生效, 否则忽略) |
| `audio_wait()` | void | 阻塞到当前播放结束 (按 WAV 头时长估算) |

```c
function music() -> int {
    int ok = audio_play("https://example.com/tone.wav")
    if (ok == 0) {
        audio_volume(80)
        audio_wait()
    }
    return ok
}
```

- 目前**只支持 WAV(PCM)**; MP3/OGG 需要额外解码库, 尚未纳入;
- 播放后端按平台选择 (Windows `winmm`, 其它平台 `afplay` / `aplay` / `paplay` / `ffplay`),
  无可用后端时返回 `-1`。

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
`exec` / `file_write` / `file_delete` / `dir_remove` / `download` / `http_get` / `http_post` / `chdir`
具备当前进程的文件与网络权限, 不会沙箱化。
运行不可信程序时用 `--sandbox` (限制宿主访问) 与 `--no-io` (禁止 `IN`/`OUT` 与宿主 I/O),
或者根本不要在原生路径下运行。
:::

## 网络 (HTTP/HTTPS)

| 函数 | 签名 | 说明 |
|------|------|------|
| `http_get(url)` | string | GET 并返回响应体; 失败空串 (**15 秒超时, 8 MiB 上限**) |
| `http_post(url, body)` | string | POST (`text/plain; charset=utf-8`) 并返回响应体; 失败空串 (同样 15 秒 / 8 MiB) |
| `download(url, path)` | int | 下载到文件; `0` 成功 / `-1` 失败 (**非 2xx 算失败**, 落盘上限 256 MiB) |

> `http_get` / `http_post` 不检查状态码, 非 2xx 也会返回响应体; `download` 把非 2xx 视为失败。

```c
string page = http_get("https://example.com/")
println("长度 = " + int_to_str(strlen(page)))

string echo = http_post("https://example.com/api", "name=cin")
println("返回 " + int_to_str(strlen(echo)) + " 字节")

int rc = download("https://example.com/logo.png", "logo.png")
println("download = " + int_to_str(rc))          // 0 成功
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

## 能力矩阵

| 能力 | 纯 Python / JIT | Go 原生 | 说明 |
|------|:---------------:|:-------:|------|
| 画布 / PNG 导出 / 查看器 | ❌ | ✅ | `canvas` 系列 |
| 联网音频 | ❌ | ✅ | 仅 WAV(PCM) |
| 文件 / 目录 / 路径 | ❌ | ✅ | 真实文件系统权限 (`file_*` / `path_*` / `dir_remove` / `chdir`) |
| 进程 / 环境变量 / 系统信息 | ❌ | ✅ | `exec` / `getenv` / `os_name` / `time_ms` / `mem_info` |
| 网络 (HTTP/HTTPS) | ❌ | ✅ | `http_get` / `http_post` / `download` |
| 编码与哈希 | ❌ | ✅ | `sha256` / `base64_*` |
| 桌面集成 | ❌ | ✅ | 剪贴板 / 通知 / `open_url` |
| Termux API 与 Android 扩展 | ❌ | ✅ | 需 Termux:API; 非 Android 优雅失败 |
| 纯 CIN 标准库 (`math`/`sort`/`hash`…) | ✅ | ✅ | 三路径一致 |

## 相关页面

- [执行路径](/guide/execution-paths) — 为什么宿主能力必须走原生
- [Go 原生运行时](/runtime/native) — 原生库加载与宿主调用区段
- [内建函数](/language/builtins) — 宿主内建的完整清单
- [标准库参考](/stdlib/reference) — `io` / `gui` / `termux` 库的封装函数
