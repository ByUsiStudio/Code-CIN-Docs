---
description: Code CIN 常见问题与故障排查：安装、原生库、语言语义、执行路径、调试日志、产物与交付。
---

# 常见问题 (FAQ)

## 安装与运行

### `pip install codecin` 装完没有原生库, 正常吗?

安装可以完成 (发行包是 sdist, 安装阶段会用**本机 Go 工具链**现场编译原生库, 没有
Go/cgo 时会跳过编译并打印提示), 但**原生库是运行必需组件**: 没有它运行程序会直接抛
`CPUSimulatorError` 并附重建指引, 不再有解释器回退。

补齐办法: 装好 Go 1.26+ 与 C 编译器后重装; 从 Release 下载对应平台的预编译库放进
包目录; 或在源码树 `codecin/native/` 下执行 `build.ps1` (Windows) / `build.sh`
(Linux/Termux/macOS) 重建 (见 [安装 Code CIN](/guide/installation))。

### 怎么确认原生库到底加载了没有?

```bash
python -c "from codecin import native; print(native.get_engine())"
```

输出非 `None` 即加载成功。也可以用 `codecin --build-info` 核对原生库版本与包版本
是否匹配。想手动指定库路径可以用环境变量 `CODECIN_NATIVE_LIB`。

### `codecin: command not found` / 不是内部或外部命令

console script 的目录不在 `PATH` 里。三种替代写法:

```bash
python -m codecin.cli prog.cin     # 模块方式
codecin prog.cin             # 源码树方式
python -c "from codecin.cli import main; raise SystemExit(main(['prog.cin']))"
```

### 支持哪些平台? Termux 能用吗?

Windows / Linux / macOS 全平台 (原生库为 c-shared, 构建脚本见
[编译 Go 原生库](/dev/build-native))。Android Termux 支持 `pkg install golang` 后现场编译,
Termux:API 应用 + `pkg install termux-api` 后可用 `termux_*` 宿主能力。

## 语言与语义

### 为什么 `1 / 2` 得到 `0.5` 而不是 `0`?

CIN 的 `/` **恒为浮点除法**。需要整数除法时用内建 `idiv(a, b)` (向零截断):

```c
int q = idiv(17, 5)      // 3
int r = idiv(-17, 5)     // -3
```

取模 `%` 仅支持整数, 对浮点使用会报 `Float modulo not supported`。见
[运算符](/language/operators) 与 [内建函数](/language/builtins)。

### 数组越界为什么不报错?

默认不做运行时越界检查 (与 C 一致)。需要检查时加 `--bounds-check`:

```bash
codecin prog.cin --bounds-check
```

### 递归报 `Stack overflow` 怎么办?

默认内存已是 **1 GiB** (4 KiB 稀疏分页、按需提交), 常规深度的递归直接可用。
确有特殊需求时再调大 `--mem-size`, 长循环注意 `--max-instructions` 上限 (默认 1 亿)。

### `input()` 读不到我输入的内容?

`input()` 目前是空实现: 两个编译器都把它编译成常量 `0`, 无论输入什么都得到 `0`
(仓库 `docs/SUGGESTIONS_NEXT.md` §1.4 已记录)。替代方案: 汇编 `IN` 指令、读文件
(`file_read` / `io_*`), 或直接在源码里赋值。见
[内建函数 · input()](/language/builtins)。

### 未初始化的 `string` / struct 字符串字段为什么打印出别的文字?

实测: 未初始化的字符串槽是未清零的指针, 可能指向相邻的字符串字面量, 于是打印出
“别人的文本”。**声明时就写 `string s = ""`**, struct 的字符串字段同理, 声明后立刻赋值。

### struct 数组、嵌套 struct、局部二维数组字面量能用吗?

这三项目前**不可靠** (实测):

| 写法 | 表现 | 规避 |
|------|------|------|
| `Student cls[3]` (struct 数组) | 元素字段互相覆盖, 全是最后一次写入的值 | 用并行数组 (名字一个数组、分数一个数组) |
| `r.a.x` (嵌套 struct 字段) | 多层字段访问互相覆盖 | 扁平字段, 或声明多个独立 struct 变量 |
| 函数内 `int m[2][3] = { {...} }` | 元素不会被写入 | 用循环填充、放全局用字面量, 或压成一维 `flat[i*cols+j]` |

完整的已知限制清单见 [初学者教程 · 已知限制](/beginner/ch12-debug#_12-7-5-5-0-已知限制与规避-重点)。

### 字符串能原地修改吗?

不能。字符串是 NUL 结尾的只读字节序列, `s[i]` 只能读单字节 (`0..255`),
拼接/`strcpy` 会产生新的堆块。见 [字符串](/language/strings)。

### 可以取地址 / 解引用吗?

不可以。`*` 只是乘法、`&` 只是位与; “引用语义”只通过数组与 struct 传参隐式获得。
见 [限制与常见错误](/language/errors)。

### `switch` 的 `case` 会自动跳出吗?

不会, 默认贯穿 (fallthrough, 与 C 一致), 需要用 `break` 跳出整个 `switch`。
见 [控制流](/language/control-flow)。

## 执行路径与性能

### 我的程序到底是怎么执行的?

v5.9.0 起只有**一条执行路径** (native-only): Python 侧完成编译与装载后, 通过 ABI v2
的 `codecin_run_v2` 把整程序一次调用交给 Go 原生引擎执行, 再回传寄存器/向量/NZCV/
脏内存段与输出。纯 Python 解释器与 JIT 已整体移除, `--no-native`、`--jit`、
`--debug`、`--step`、`--profile`、`--mmu`、`--debug-server`、`--stats` 等选项也随之删除。
详见 [执行路径](/guide/execution-paths)。

### 运行报 `CPUSimulatorError`, 提示原生库缺失怎么办?

原生引擎库是必需组件, 没有回退。到源码树 `codecin/native/` 下执行 `build.ps1`
(Windows) 或 `build.sh` (Linux/Termux/macOS) 重建即可, 需要 Go 1.26+; 也可以从
Release 下载预编译库放进包目录。构建后用 `codecin --build-info` 核对 native 版本
与包版本是否匹配。

### 大数组/大缓冲需要调 `--mem-size` 吗?

一般不需要。默认内存已是 **1 GiB**, 采用 4 KiB 稀疏分页、按需提交, 只有实际写入的
页才会占用真实内存。确有特殊需求时仍可用 `--mem-size` 调整。

### `--sandbox` 会限制哪些能力?

沙箱模式下仅放行 `ALLOCFRAME` / `TIMEUS` / `TIMENS` 三个宿主调用, 其余宿主 SYS
(文件/进程/画布/音频/FFI/网络/Termux 等) 一律报
`Host capability disabled in sandbox mode`。

## 调试与日志

### 程序输出里混着 `INFO CIN compiled: ...` 怎么办?

日志默认输出到 stdout, 与程序输出同一个流。要只保留程序输出:

```bash
codecin prog.cin --log-level ERROR
```

需要完整落盘时用 `--log-file`:

```bash
codecin prog.cin --log-level DEBUG --log-file codecin.log
```

### 怎么定位运行期崩溃的位置?

运行期错误会以 rich 彩色错误面板打印出错位置与寄存器现场; 需要更完整的上下文时,
用上一条的 `--log-level DEBUG --log-file` 落盘日志排查。

排查内存越界类问题可以加 `--bounds-check`, 让越界在发生时立即报错而不是静默读写。
(旧版 `--debug` / `--step` 交互式调试已随解释器一并移除。)

### `Ctrl+C` 中断会怎样?

终端收到 `KeyboardInterrupt` 后打印 `User interrupt` 并结束本次执行
(内存镜像若开了 `--save` 会尽量保存)。

## 宿主能力

### 程序里能调用动态库 / 访问网络吗?

可以。v5.9.0 新增两组宿主 SYS: **FFI 动态库调用** (SYS 140-144: `dlopen` / `dlsym` /
`ffi_call` / `ffi_callf` / `lib_close`, 标准库 `lib/ffi.cin`) 与**完整网络**
(SYS 145-157: `http_req` / `http_code`、`tcp_*`、`udp_*`、`dns_lookup`, 标准库
`lib/net.cin`)。注意 `--sandbox` 会拦截这些调用。详见
[宿主能力](/language/host-abilities)。

### 音频/画布在无桌面环境能用吗?

画布本身是纯计算 + 导出 PNG, 可以在无桌面环境使用; `show_canvas()` 需要系统查看器。
音频仅支持 WAV(PCM), 播放依赖各平台后端 (Windows `winmm`, 其它平台 `afplay`/`aplay`/
`paplay`/`ffplay`)。

### `exec` / `file_write` 安全吗?

它们是真实的宿主调用, 具备当前进程的文件与进程权限。运行不可信程序时用
`--sandbox` 限制宿主访问 (仅放行 `ALLOCFRAME` / `TIMEUS` / `TIMENS`)。

## 产物与交付

### `.bin` 和 `.crom` 有什么区别?

| 项 | `.bin` | `.crom` |
|----|--------|---------|
| 内容 | UCBC 字节码 (代码) | 虚拟机内存镜像 (整机状态快照) |
| 生成 | `--compile` / `--compile-only` | `--save` |
| 用途 | 分发/复用编译结果, 可直接运行 | 保存/恢复内存状态 (可选 zlib 压缩 + CRC32) |
| 通用性 | 只有 VM 能执行 | 不能当可执行文件用; `--crom` 仅在 `.pl` / `.asm` 路径生效 |

v5.9.0 起为段式 **BIN v3 / CROM v4**, 只保存实际使用的内存页; 旧 BIN v2 / CROM v3
产物仍可读取。细节见 [二进制格式](/runtime/formats)。

### 怎么把程序交付给没装 Python 的人?

```bash
codecin prog.cin --build-exe prog                       # 本机平台
codecin prog.cin --build-exe prog --build-target linux/amd64
```

产物是静态链接的单文件, 内嵌字节码与初始内存, 不依赖 Python、Go、libc 或任何动态库。
需要 Go 工具链与源码树 (不适用于已安装的 wheel)。见 [AOT](/runtime/aot)。

### 环境变量有哪些?

`CODECIN_NATIVE_LIB`、`CODECIN_SKIP_NATIVE`、`CODECIN_NO_GO`、`CODECIN_FORCE_REBUILD`、
`CODECIN_STATIC`、`CODECIN_AOT_TESTS`, 完整说明见 [命令行参考 · 环境变量](/guide/cli#环境变量)。

## 开发与文档

### Go 侧为什么没有 `codecin` 命令?

Go 是语言实现的唯一核心, 但**只以库的形式存在** (c-shared), 唯一命令行入口
是 Python 侧, 避免了两套 CLI / 两套语义的问题。见 [项目结构](/dev/structure)。

### 怎么新增一条指令或系统调用?

需要同步改动 ISA、Go 引擎、汇编器、CIN 内建, 并重新生成常量后回归测试, 步骤见
[扩展指令 / 系统调用](/dev/extend)。

### 怎么改文档 / 本地预览这个文档站?

```bash
cd docs
npm install
npm run docs:dev        # 开发预览 (默认 http://localhost:5173)
npm run docs:build      # 产出静态站点到 .vitepress/dist
npm run docs:preview    # 预览构建产物
```

文档站是独立仓库 (Code-CIN-Docs), 以 git submodule 内嵌于主仓库的 `docs/`,
写作规范与目录约定见 [贡献指南](/dev/contributing)。
