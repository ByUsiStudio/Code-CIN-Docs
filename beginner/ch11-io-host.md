---
description: "第 11 章：CIN 读写的文件、画布绘图、系统信息与环境变量、执行命令与安全注意事项。"
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
`file_write` / `file_delete` / `exec` 用的是当前用户的真实权限, 不会自动沙箱化。
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
因为 `input()` 目前不读键盘 (见 [第 2 章](/beginner/ch02-variables#_2-8-读取用户输入-重要-当前版本现状)),
**用文件当输入**是最实用的替代: 把数据写进 `data.txt`, 程序读进来处理后输出结果。
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

## 11.5 执行命令

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

## 11.6 画布: 生成图片

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

## 11.7 音频与 Termux (了解即可)

- **音频**: `audio_play(url)` 支持 `http/https` 或本地 **WAV(PCM)** 文件, 配套
  `audio_stop` / `audio_volume` / `audio_wait`。MP3/OGG 暂不支持。
- **Termux (安卓)**: 装了 Termux:API 后可以用 `termux_notify` / `termux_toast` /
  `termux_vibrate` / `termux_tts` / `termux_battery` 等, 非 Termux 环境会优雅失败。

完整清单见 [宿主能力](/language/host-abilities)。

## 11.8 常见错误

| 现象 | 原因 | 解决 |
|------|------|------|
| `host builtins ... require the native Go runtime` | 用了 `--no-native` | 去掉该选项; 或确认原生库已加载 |
| `file_read` 返回空串 | 路径不对 / 文件不存在 | 先 `file_exists` 检查, 注意相对路径基于当前目录 |
| 写文件返回 `-1` | 目录不存在或无权限 | 先 `mkdir`, 或换可写目录 |
| 图片没生成 | `save_png` 返回了 `-1` | 检查目标目录是否存在 |
| `exec` 卡住 | 命令等待输入 | 换用不交互的命令 |

## 11.9 练习

1. 让程序把 `1` 到 `5` 每行一个数写入 `nums.txt`, 再读回来打印。
2. 读取一个文本文件, 统计它有多少行、多少字节。
3. 生成一张 200×200 的 PNG: 红色方框 + 蓝色对角线。
4. 打印当前系统名、当前目录与一个自设的环境变量。
5. 用 `exec_output` 执行一个打印数字的命令, 再用 `atoi` 把输出转成整数并加 1 打印。
   (提示: Windows 用 `echo 41`, Linux/macOS 用 `echo 41`, 注意 `exec_output` 可能带换行,
   可用 `trim` 清理。)

参考实现见 [习题与答案 · 第 11 章](/beginner/exercises#第-11-章)。

## 11.10 本章小结

- 宿主能力 (文件 / 画布 / 音频 / 命令 / Termux) 需要 Go 原生运行时;
- 文件: `file_write` / `file_append` / `file_read` / `file_exists` / `file_size` / `mkdir`;
- `io.cin` 提供按行与分段的文本处理 (`io_line_count` / `io_get_line` / `io_split_get`);
- 系统信息: `os_name` / `hostname` / `username` / `cwd` / `home_dir`; 环境变量 `getenv` / `setenv`;
- 画布: `canvas` + `set_color` + 形状函数 + `save_png`; `gui.cin` 提供图表封装;
- 权限是真实的, 谨慎运行来路不明的程序。

下一章: [调试与排错](/beginner/ch12-debug)。
