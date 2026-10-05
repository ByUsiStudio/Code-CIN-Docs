---
description: "Code CIN 的 rich 日志与错误输出: 日志级别、--log-file 落盘、DEBUG 级别埋点、红色错误面板与退出码约定。"
---

# 日志与错误输出

Code CIN 的全部日志与错误输出基于 **rich**：彩色面板、表格与完整堆栈回溯。模块**禁止直接 `print`**，统一经 `codecin/console.py` 适配层输出；日志器由 `codecin/logger.py` 的 `Logger` 提供，底层是 `rich.logging.RichHandler`。

- 配置项与命令行开关见 [/guide/cli](/guide/cli)；
- 内存模型与运行时开关见 [/tools/memory-cache](/tools/memory-cache)；
- 寄存器与内存模型见 [/reference/registers-memory](/reference/registers-memory)。

## 输出架构

| 组件 | 职责 |
|------|------|
| `codecin/console.py` → `Console` | rich 控制台封装：`print`、`rule`、`clear`、`print_exception`（彩色 traceback） |
| `codecin/console.py` → `Panel` / `Table` / `Colors` | 面板、表格适配器与 ANSI 颜色码；字符串中的 ANSI 自动转 rich `Text` |
| `codecin/logger.py` → `Logger` | 独占 `codecin` logger，`RichHandler` 输出到 `Console.rich`；提供 `debug/info/warning/error/critical/exception` |
| `codecin/logger.py` → `trace/dump/hexdump` | 超详细调试辅助：字段表格 dump、内存十六进制转储（仅 DEBUG 生效） |

`Logger` 的 handler 形式为：显示时间（`%H:%M:%S`）、显示级别、不显示文件路径、不启用 rich markup，消息格式为 `%(message)s`。

::: tabs

== 默认: 输出到 stdout

```bash
codecin hello.cin
```

日志与程序输出**共用同一个 stdout**（程序文本由 `sys.stdout.write` 直接写出），因此重定向或管道里两者交织在一起。

== 落盘: --log-file

```bash
codecin hello.cin --log-file logs/run.log
```

文件 handler 以覆盖模式（`mode='w'`）写入 UTF-8 文本，目录会自动创建；文件记录**固定为 DEBUG 全量**，与 `--log-level` 无关。

:::

## 日志级别

| 级别 | 内容 |
|------|------|
| `ERROR` | 仅错误面板与错误日志 |
| `WARNING` | + 兼容/降级告警（如旧格式镜像提示、原生库加载异常细节） |
| `INFO`（默认） | + 编译汇总（指令数）、执行起止、`.crom` 加载信息 |
| `DEBUG` | **超详细**：编译/汇编细节、CPU 初始化快照与原生执行结果埋点 |
| `CRITICAL` | 仅致命错误（`Logger.critical`） |

命令行可选值与内部级别码对应关系：

| `--log-level` | codecin 级别码 | logging 级别 |
|---------------|----------------|--------------|
| `DEBUG` | 0 | 10 |
| `INFO`（默认） | 1 | 20 |
| `WARNING` | 2 | 30 |
| `ERROR` | 3 | 40 |
| `CRITICAL` | 4 | 50 |

### 默认（INFO）输出示例

```text
$ codecin hello.cin
08:37:15 INFO     CIN compiled: 30 instructions
         INFO     Starting program execution (Go native engine)
Hello, Code CIN!
2 + 3 = 5
         INFO     HALT (native)
         INFO     Program execution finished
```

### 只保留程序输出

```text
$ codecin hello.cin --log-level ERROR
Hello, Code CIN!
2 + 3 = 5
```

::: tip 脚本 / OA 场景
把日志级别压到 `ERROR`，stdout 就只剩程序自身的输出，便于直接比对或入库；需要审计时再叠加 `--log-file`，落盘文件里仍保留全量 DEBUG 记录。
:::

## DEBUG 级别的埋点

`--log-level DEBUG` 会打开全部 DEBUG 埋点。v5.9.0 起单执行路径（Go 原生引擎），不再有逐指令追踪；DEBUG 覆盖的是**编译/汇编细节与引擎执行结果**。

### CPU 初始化快照

```text
DEBUG               CPU 初始化
                    memory    0x40000000 bytes (sparse)
                    sp_init   0x3ffffff8
                    heap_base 0x20000000
                    sandbox   False
                    log_level DEBUG
```

`memory` 显示逻辑大小与 `(sparse)` 标记，`sp_init`/`heap_base` 随 `--mem-size` 缩放（含义见 [/tools/memory-cache](/tools/memory-cache)）。

### 编译与汇编埋点

| 阶段 | DEBUG 内容 |
|------|------------|
| CIN 前端 | `CIN tokenize: N tokens`、`CIN parse: X structs, Y globals, Z functions`、`CIN function <name>: N params`、`CIN global '<name>': type=… addr=0x… block=…`、`CIN codegen function '<name>' done`、`CIN codegen total: …` |
| 汇编 | `logger.dump("汇编标签表", …)` 表格（标签 → 地址），以及逐行汇编器 debug 输出 |
| 原生执行 | `Native result: status=… steps=… pc=… elapsed=…ms error=…`（`steps` 为引擎回传的指令数） |

### 其它调试辅助（宿主/扩展可用）

- `Logger.dump(title, fields)`：以无表头 rich 表格输出键值快照；
- `Logger.hexdump(title, addr, data, width=16)`：十六进制转储，单次最多 256 字节，超出追加 `... (N bytes total)`；
- 两者都只在 DEBUG 级别生效（`is_debug` 为真）。

## --log-file 落盘

```bash
codecin hello.cin --log-file logs/hello.log
```

```powershell
codecin hello.cin --log-file logs\hello.log
```

| 项目 | 行为 |
|------|------|
| 模式 | `FileHandler(mode='w', encoding='utf-8')`，同名文件会被覆盖 |
| 行格式 | `[HH:MM:SS] [LEVELNAME] <message>` |
| 级别 | 文件 handler 固定 `logging.DEBUG`，**记录全量**，不受 `--log-level` 影响 |
| 目录 | 自动 `makedirs` 创建父目录 |
| 关闭 | 重复调用 `set_log_file` 会移除并关闭旧 handler；`Logger.close()` 显式关闭 |

## 错误面板与退出码

加载、汇编、编译、运行错误统一输出**红色 rich Panel**；`.` 异常信息里的 `文件:行号` 由 `codecin/errors.py` 拼接（`{filename}:{line_num}: `，无文件名时退化为 `Line {line_num}: `）。

| 面板标题 | 触发场景 |
|----------|----------|
| `Load Error` | 程序文件不存在、原生库缺失/ABI 不符、`.crom` 校验失败/解压超限、`CPUSimulatorError` 类的加载错误 |
| `Disasm Error` | `--disasm` 反汇编失败 |
| `Error` | 运行期 `CPUSimulatorError`（汇编错误、编译错误、执行错误、内存错误） |
| `Execution Error` | `CPU.run()` 内未被识别为 `CPUSimulatorError` 的执行期异常 |
| `Unexpected Error` | `cpu.run()` 抛出的其它异常，附带 `print_exception` 彩色 traceback |
| `Build Error` | `--build-exe` AOT 构建失败（依赖检查、目标平台、`go build`） |

```text
┌──────────────────────── Load Error ────────────────────────┐
│ prog.cin:12: Compiler error: Unknown function: printline   │
└────────────────────────────────────────────────────────────┘
```

- 普通模式下运行时错误只记 `ERROR` 日志 + 红色面板；
- 非预期异常（`Unexpected Error`）附带 `print_exception` 彩色完整堆栈回溯。

### 退出码约定

| 退出码 | 含义 |
|--------|------|
| `0` | 成功：`--help`、`--version`、`--compile-only`、程序正常结束 |
| `1` | 失败：缺少程序文件、原生库缺失/加载失败、加载/汇编/编译/运行错误、指令上限用尽、`execution_failed` 为真 |
| `2` | 参数错误：argparse 拒绝未知选项或非法取值（`parser.parse_args` 的 `SystemExit.code`） |

实测样例：

```text
$ codecin --version
Code CIN x.y.z
$ echo $LASTEXITCODE      # 0
$ codecin --definitely-not-an-option
$ echo $LASTEXITCODE      # 2
$ codecin no_such_file.cin --log-level ERROR
$ echo $LASTEXITCODE      # 1
```

::: info 指令上限按失败处理
`--max-instructions` 用尽不再伪装成正常结束：引擎返回失败状态，CLI 退出码为 1。参见 `tests/test_cli.py` 的用例。
:::

## 完整示例命令

::: tabs

== 日常运行

```bash
codecin hello.cin --log-level ERROR
```

== 排查编译/执行问题

```bash
codecin hello.cin --log-level DEBUG --log-file logs/hello.log
```

== 只记录不刷屏

```bash
codecin hello.cin --log-level WARNING --log-file logs/hello.log
```

:::

## 常见问题

- **日志跑到程序输出里了**：这是设计如此，日志默认写 stdout。要分离，用 `--log-file` 或 `--log-level ERROR`。
- **DEBUG 行比以前少了**：v5.9.0 起单执行路径，逐指令追踪随解释器一并移除；DEBUG 只覆盖编译/汇编/引擎结果等埋点。若想看更多细节，确认没有用 `--log-level` 提高过级别。
- **`--log-file` 里没有 DEBUG 行**：文件 handler 固定记录全量 DEBUG，若为空说明该次运行确实没有产生对应埋点（例如未编译 CIN 而是直接载入 `.bin`）。
- **错误面板没有行号**：只有编译/汇编阶段的错误带 `文件:行号`；运行期错误（除零、越界）本身没有源码位置。
- 更多异常对照见 [/guide/faq](/guide/faq) 与 [/language/errors](/language/errors)。
