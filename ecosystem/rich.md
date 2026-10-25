---
description: rich 官方 pic 库：Code CIN 的终端富文本库，支持 markup、面板、表格、进度条、文本树、Markdown 渲染、CIN 源码高亮与实时动画。
---

# rich：终端富文本库

`rich` 是 Code CIN 官方开源组织（[gitee.com/codecin/rich](https://gitee.com/codecin/rich)）
发布的 pic 包，仿照 Python [rich](https://github.com/Textualize/rich) 的常用能力：
带 markup 的彩色输出、面板、分隔线、表格、进度条、文本树、分级日志、标题、Markdown 渲染、
CIN 源码高亮，以及实时动画与终端输入缓存。

静态渲染只依赖 CIN 内建函数，可在 `--sandbox` 下运行；实时动画与键盘读取使用宿主能力，
需要普通模式。当前版本 **1.1.1**，MIT 许可证。

## 特性

- **markup 标记**：`[bold red]text[/]`，支持嵌套、真彩色、背景色与转义。
- **宽字符对齐**：按 UTF-8 码点计算显示列，中文 / 日文 / 韩文与 emoji 计 2 列，组合字符计 0 列。
- **ANSI 感知**：测量、截断、折行都会跳过 ANSI 转义序列，带样式的文本也能正确对齐。
- **一套渲染件**：`rule` / `panel` / `bar` / `progress` / `tree` / `log` / `heading`。
- **定长表格**：列宽、对齐、自动数字右对齐、表头、标题、截断与省略号。
- **Markdown 渲染**：标题、列表、引用、围栏代码块、分隔线与行内样式，代码块直接复用语法高亮。
- **终端超链接**：`rich_link` 输出 OSC 8 链接，宽度计算会自动忽略控制序列。
- **源码高亮**：注释、字符串、数字、关键字、类型名与函数调用。
- **实时输出**：打字机、旋转指示器与原地进度条，边执行边刷新。
- **终端输入缓存**：动画期间提前键入的内容可直接读取，支持原始键码与显式清空。
- **可降级**：`rich_set_plain(1)` 关闭全部颜色，`rich_set_unicode(0)` 退化为 ASCII 边框。

## 安装

```bash
# 从注册表安装到全局
pic install rich

# 安装到当前项目的 pic_modules/ (可直接 import)
pic install rich --project
```

安装后直接 `import "rich"`。包管理与注册表细节见 [pic 包管理](/tools/pic)，
官方仓库清单见 [官方生态](/ecosystem/)。

## 快速开始

```cin
import "rich"

function main() -> int {
    rich_set_width(60)

    rich_print("[bold cyan]Hello[/] [yellow]rich[/] for Code CIN")

    rich_print_panel("支持中文宽字符对齐、markup、面板、表格与进度条。", "rich", 60)

    int widths[3] = {14, 6, 8}
    rich_table_init(widths, 3)
    rich_table_header("Name|Qty|Price")
    rich_table_add("apple|12|3.50")
    rich_table_add("香蕉|7|1.20")
    rich_table_print()

    rich_print_progress(0.42, 60, "[dim]downloading[/]")
    return 0
}
```

输出示意（颜色在支持 ANSI 的终端中显示）：

```text
Hello rich for Code CIN
╭─ rich ────────────────────────────────────────────────────╮
│ 支持中文宽字符对齐、markup、面板、表格与进度条。          │
╰──────────────────────────────────────────────────────────╯
┏━━━━━━━━━━━━━━━━┳━━━━━━━━┳━━━━━━━━━━┓
┃ Name           ┃ Qty    ┃ Price    ┃
┡━━━━━━━━━━━━━━━━╇━━━━━━━━╇━━━━━━━━━━┩
│ apple          │     12 │     3.50 │
│ 香蕉           │      7 │     1.20 │
└────────────────┴────────┴──────────┘
███████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░ 42% downloading
```

## API

### 全局配置

| 函数 | 说明 |
| --- | --- |
| `rich_version()` | 库版本字符串 |
| `rich_set_width(w)` / `rich_get_width()` | 默认输出宽度，钳制到 `[20, 240]` |
| `rich_set_plain(on)` | `1` 关闭全部 ANSI 颜色与样式 |
| `rich_set_unicode(on)` | `1` 使用 Unicode 边框；`0` 退化为 `+-` |
| `RICH_WIDTH` | 全局宽度变量，渲染函数的 `width <= 0` 时使用它 |

### 样式与 markup

| 函数 | 说明 |
| --- | --- |
| `rich_print(src)` / `rich_write(src)` | 渲染 markup 后输出（换行 / 不换行） |
| `rich_markup(src)` | markup -> ANSI 字符串 |
| `rich_style(text, spec)` | 给文本套样式，如 `"bold red on blue"` |
| `rich_sgr(spec)` | 样式串 -> 完整 ANSI 序列；空样式返回 `""` |

样式串用空格分隔，支持：

- 修饰：`bold` `dim` `italic` `underline` `blink` `reverse` `conceal` `strike` `overline`
- 前景色：`black` `red` `green` `yellow` `blue` `magenta` `cyan` `white` `default` `grey`
- 高亮色：`bright_black` ... `bright_white`
- 背景色：`on <color>`
- 真彩色：`#RGB` 或 `#RRGGBB`（前景与 `on` 背景都支持）

markup 标签：

```text
[bold]粗体[/] [red]红色[/] [bold red on blue]组合[/]
[bold #ff8800]真彩色[/] [on #102030]背景[/] [/bold red] 或 [/] 结束
\[red] 转义为字面量；arr[0] 这类无法识别的方括号原样保留
```

### 文本测量与排版

| 函数 | 说明 |
| --- | --- |
| `rich_width(s)` | 显示宽度，忽略 ANSI 序列 |
| `rich_plain(s)` | 去掉 ANSI 序列 |
| `rich_repeat(s, n)` | 重复字符串 |
| `rich_align(s, w, mode)` | 对齐：`0` 左 / `1` 右 / `2` 居中 |
| `rich_center(s, w)` | 居中 |
| `rich_truncate(s, w)` | 截断到 `w` 列 |
| `rich_fit(s, w)` | 截断并补 `…` 省略号 |
| `rich_cell(s, w, mode)` | 截断 + 对齐，用于表格单元格 |
| `rich_wrap(text, w)` | 按显示宽度折行，保留原换行 |

`rich_wrap` 接受已经渲染过的 ANSI 文本；需要 markup 时先调用 `rich_markup`。

### 渲染组件

| 函数 | 说明 |
| --- | --- |
| `rich_rule(title, w)` | 带标题的分隔线（青色） |
| `rich_rule_styled(title, w, spec)` | 自定义样式分隔线 |
| `rich_panel(body, title, w)` | 圆角面板（正文可含 markup） |
| `rich_panel_styled(body, title, w, border_spec, body_spec)` | 自定义边框与正文样式 |
| `rich_bar_str(ratio, w)` | 纯进度条 `████░░░░` |
| `rich_progress_str(ratio, w, label)` | 进度条 + 百分比 + 标签 |
| `rich_tree_str(block)` | 文本树（每 2 个空格一级） |
| `rich_log_str(level, msg)` / `rich_log(level, msg)` | 分级日志 |
| `rich_heading_str(text, level, w)` / `rich_print_heading(...)` | 三级标题 |

对应的 `rich_print_rule` / `rich_print_panel` / `rich_print_progress` / `rich_print_tree`
会直接输出。日志级别：`debug` / `info` / `success` / `warning` / `error` / `trace`，
未知级别按 `info` 处理。

文本树示例：

```cin
rich_print_tree("root\n  a\n    a1\n    a2\n  b")
```

```text
root
├── a
│   ├── a1
│   └── a2
└── b
```

### 表格

表格是全局单例构建器，最多 **8 列 / 64 行**；单元格用 `|` 分隔。

```cin
int widths[3] = {10, 6, 8}
rich_table_init(widths, 3)               // 每列内容宽度（不含左右各 1 空格）
rich_table_set_title("[bold]水果价格[/]")  // 可选标题，居中显示在表格上方
rich_table_header("Name|Qty|Price")
rich_table_add("apple|12|3.50")
rich_table_add("香蕉|7|1.20")

int modes[3] = {0, 3, 1}                 // 0 左 / 1 右 / 2 居中 / 3 自动
rich_table_align(modes, 3)

rich_table_print()
```

- 默认对齐为 `3`（自动）：形如数字的单元格右对齐，其余左对齐。
- 单元格支持 markup，超出列宽自动截断并补 `…`。
- `rich_table_set_title(title)` 设置表格标题，支持 markup。
- `rich_table_reset()` 清空表头、标题与数据行，保留列宽设置。

### 源码高亮

| 函数 | 说明 |
| --- | --- |
| `rich_syntax(code)` | 返回着色后的源码字符串 |
| `rich_print_syntax(code)` | 带行号输出着色源码 |

识别 `//` 与 `/* */` 注释、字符串 / 字符字面量、数字、关键字、类型名、`true` / `false`
以及后跟 `(` 的函数调用名。

### Markdown

| 函数 | 说明 |
| --- | --- |
| `rich_markdown(text, w)` | 渲染 Markdown 为带样式的多行字符串 |
| `rich_print_markdown(text, w)` | 渲染并直接输出 |
| `rich_link(text, url)` | 输出 OSC 8 超链接（纯文本模式下退化为普通文本） |

支持的块级语法：

- `#` ~ `######` 标题（1 / 2 级带横线，3 级带竖条，4 ~ 6 级带圆点）
- `-` / `*` / `+` 无序列表，`1.` 有序列表，每 2 个空格缩进一级
- `> ` 引用（左侧竖线 + 斜体，自动折行）
- ` ```lang ` 围栏代码块（整块交给 `rich_syntax` 着色，保留缩进）
- `---` / `***` / `___` 分隔线
- 空行分隔段落，段落内软换行合并为一个空格

行内语法：`**粗体**` / `__粗体__`、`*斜体*` / `_斜体_`、`~~删除线~~`、
反引号包裹的行内代码，以及 `[文本](url)`；反斜杠可转义 `*`、`_`、反引号、方括号与 `~`。

```cin
rich_print_markdown("## 发布说明\n\n- 新增 **Markdown** 渲染\n- 修复 `wrap` 断行\n\n> 详见 [文档](https://www.codecin.org.cn)。", 60)
```

### 实时输出与终端输入缓存

这组函数使用宿主时钟、休眠与键盘能力，需要普通模式；在 `--sandbox` 下调用会报
`Host capability disabled`。`rich_set_live(0)` 或 `rich_set_plain(1)` 会关闭动画，
只输出最终结果，适合日志、管道与重定向。

| 函数 | 说明 |
| --- | --- |
| `rich_set_live(on)` | `1` 开启实时动画（默认）；`0` 降级为静态输出 |
| `rich_clear_line()` | 清除当前行并回到行首 |
| `rich_typewrite(text, delay_ms)` | 逐码点打字机输出，中文 / emoji 不会被拆断 |
| `rich_spinner(label, duration_ms)` | 原地旋转指示器（青色） |
| `rich_spinner_styled(label, duration_ms, spec)` | 自定义样式的旋转指示器 |
| `rich_progress_frame(percent, width, label)` | 生成单帧进度条字符串，`percent` 钳制到 `0..100` |
| `rich_progress_live(percent, width, label)` | 原地刷新单帧进度条（不换行） |
| `rich_progress_animate(label, duration_ms, width)` | 在指定时长内从 `0%` 动画到 `100%` |
| `rich_key_label(k)` | 键码转可读标签（`Enter` / `空格` / `A` / `[1000]` 等） |
| `rich_read_keys(max)` | 一次性读出缓存按键，返回空格分隔的标签；无输入返回 `""` |
| `rich_flush_keys()` | 清空键码队列与终端残留输入 |
| `rich_prompt(prompt)` | 输出提示并读取一行，提前键入的内容会直接从缓存读到 |

```cin
rich_set_live(1)

rich_typewrite("准备中...\n", 15)
rich_spinner("加载模块", 600)
rich_progress_animate("同步资源", 1200, 60)

string line = rich_prompt("[bold cyan]继续? [/]")
string keys = rich_read_keys(16)
rich_flush_keys()
```

`rich_typewrite` 不解析 markup；需要颜色时可先调用 `rich_markup`，ANSI 序列会整段输出、
不会按字节拆开。`rich_spinner` / `rich_progress_animate` 的标签支持 markup。

终端输入缓存（type-ahead）是 Code CIN 宿主提供的特性：动画播放期间提前键入的字符不会丢失，
之后调用 `rich_prompt` / `rich_read_keys` 可立即读取。非真实终端（管道、重定向、测试环境）下
`input_str` 通常立即返回空串，按键队列也为空。

## 限制

- 表格是全局单例，且同一时刻只能有一张表；单元格文本里不能包含 `|`。
- Markdown 是轻量实现，不支持表格、HTML、脚注与任务列表；输入最多 256 行。
- 围栏代码块保留原始缩进且不折行，超长代码行可能超出设定宽度。
- 面板会先渲染 markup 再按宽度折行；跨行样式会在断行处 reset 并重新应用。
  为避免意外，建议 `[bold red]` 这类标签在同一段落内闭合。
- 真彩色需要终端支持；不支持时会显示为最接近的 256 / 16 色或普通文本。
- OSC 8 超链接在部分终端中只显示为带下划线的文本，不影响显示宽度。
- 实时函数依赖宿主的 `time_ms` / `sleep_ms` / `key_*` / `input_str`；`--sandbox` 下调用会失败，
  只使用静态渲染时不受影响。
- 动画会写入 `\r` 与清行控制序列；输出到文件或管道前请调用 `rich_set_live(0)`。
- 非真实终端下 `rich_prompt` 通常立即返回空串，`rich_read_keys` 也读不到按键。
- 库不会检测 TTY，颜色默认开启。写入文件或日志时请调用 `rich_set_plain(1)`。
- 所有返回字符串的函数都会分配新堆块，避免在超大循环里无节制地拼接。

## 目录结构

```text
src/
  rich.cin          包入口 (import 各内部模块, 不含 main)
  main.cin          演示程序 (mkn run)
  live_demo.cin     实时输出与终端缓存演示
  internal/
    core.cin        宽度、ANSI 感知、对齐、截断、折行
    style.cin       样式串、markup
    render.cin      rule / panel / progress / tree / log / heading
    table.cin       表格构建器
    syntax.cin      CIN 源码高亮
    markdown.cin    Markdown 渲染与 OSC 8 链接
    live.cin        打字机、指示器、实时进度、键码缓存
  test/
    rich_test.cin   103 项断言
```

公开符号统一使用 `rich_` 前缀，内部符号使用 `rch_` 前缀。

## 更新日志

### 1.1.1

- 新增实时输出：`rich_typewrite`、`rich_spinner` / `rich_spinner_styled`、
  `rich_progress_animate` / `rich_progress_live` / `rich_progress_frame` 与 `rich_clear_line`。
- 新增终端输入缓存：`rich_prompt`、`rich_read_keys`、`rich_flush_keys`、`rich_key_label`。
- 新增 `rich_set_live(on)`：关闭动画后只输出最终结果，适合日志与重定向。
- 新增 `src/live_demo.cin` 实时终端演示；测试增至 103 项断言。
- 静态渲染 API 与 0.2.x 保持兼容。

### 0.2.1

- 新增 Markdown 渲染：`rich_markdown` / `rich_print_markdown`，支持标题、列表、引用、
  围栏代码块、分隔线与行内样式。
- 新增 `rich_link`，输出 OSC 8 终端超链接。
- 表格新增 `rich_table_set_title`；`rich_table_reset` 同时清空标题。
- 行内 `_` 不再误判 `snake_case` 这类标识符。
- 测试增至 90 项断言。

## 相关链接

- 仓库：[gitee.com/codecin/rich](https://gitee.com/codecin/rich)
- 中央注册表记录：`https://package.codecin.org.cn/api/v1/packages/rich/`
- [官方生态与开源组织](/ecosystem/)
- [pic 包管理](/tools/pic)
