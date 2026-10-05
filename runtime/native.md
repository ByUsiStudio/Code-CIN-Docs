---
description: Code CIN 的 Go 原生运行时：ABI v2 导出符号、ctypes 加载顺序、请求/响应缓冲布局、宿主能力边界与失败语义。
---

# Go 原生运行时

Go 原生运行时是 Code CIN 的**语言实现核心**：CIN 编译器、字节码 VM、CROM 编解码、
AOT 运行时与全部宿主能力都实现为纯 Go 代码，编译成一个 `c-shared` 共享库，由
Python 侧用 `ctypes` 载入。v5.9.0 起项目是 **native-only 单引擎架构**——纯 Python
解释器与 JIT 已移除，原生库不是"可选加速"，而是唯一的执行引擎。本页说明它的架构
定位、导出符号、加载顺序与失败语义。

## 架构定位：Go 是语言实现，Python 只是 CLI 外壳

| 层 | 落地文件 | 职责 |
| --- | --- | --- |
| CLI 外壳 | `codecin/cli.py`、`cpu.py` | 参数解析、日志、退出码、编排 |
| 前端（Python） | `codecin/cin.py`、`codecin/assembler.py` | CIN / PL / ASM 源码 → UCBC 字节码 |
| 语言实现核心（Go） | `codecin/native/compiler/`、`codecin/native/engine/` | CIN 编译器、字节码 VM、CROM 编解码、宿主能力 |
| AOT 运行时（Go） | `codecin/native/aot/` | 独立可执行文件内嵌的 VM 入口 |
| ABI 桥 | `codecin/native.py` | `ctypes` 载入共享库、请求编解码、结果解析 |

**Go 侧不提供任何 CLI**。`codecin/native/` 下唯一允许的 `package main` 是 cgo 的
c-shared 库入口 `codecin/native/main.go`，它只导出 C ABI 符号并提供一个空的
`main()`；`tests/test_no_go_cli.py` 与 CI 都会断言"Go 源码树里没有第二个
`package main`"。唯一的命令行入口是 Python 侧的 `codecin`（pip 安装后的 console
script）。AOT（`--build-exe`）产出的是**用户程序的产物**，它自带 Go VM，但不是
工具链 CLI。

### 一次原生执行的数据流

```text
program.cin ──codecin/cin.py──► UCBC 字节码 + 初始内存段 (稀疏分页快照)
   ──native.encode_program()──► v2 请求缓冲
        │
        ▼
   codecin_run_v2(...)            （Go: 整程序一次执行, 脏页位图记录写入）
        │
        ▼
   status/pc/sp/heap/steps/regs/vec/flags/脏内存段/output/error
        │
        ▼
   Python 侧写回 4 KiB 稀疏内存 → 输出文本 → （出错则抛 ExecutionError）
```

Go 侧用 `make([]byte, memSize)` 分配执行内存（OS 懒提交，1 GiB 不会真占 1 GiB
物理内存），并用**脏页位图**记录执行期间被写过的 4 KiB 页；执行结束只把这些页
按段回传，Python 侧写回 `FastMemory` 的 4 KiB 稀疏分页内存。持久化同样是段式
（CROM v4 / BIN v3，见[二进制格式](/runtime/formats)）。

## 导出的 C ABI 符号表

符号定义在 `codecin/native/main.go`（`//export` 注释即导出名），Python 侧的签名
声明在 `codecin/native.py` 的 `NativeEngine._configure()`，两边必须一致。

| 符号 | 参数 | 返回值 / 作用 |
| --- | --- | --- |
| `codecin_run_v2` | 请求缓冲 `ptr,len`、`entry i64`、`sp i64`、`heap_base i64`、`mem_size i64`、`max_steps i64`、`seed i64`、`flags i32` | 执行整程序，返回**结果缓冲指针**（`NULL` 表示分配失败）。`flags` bit0 = 沙箱模式 |
| `codecin_set_args` | `char** argv, int argc` | 注入 CIN 程序的命令行参数（`arg_count()` / `arg(i)` 的数据源），每次运行前都会调用（空列表即清空） |
| `codecin_crom_pack` | `data ptr,len`、`compress int`、`out_len *int` | 打包为 CROM 字节流，返回缓冲指针，长度写回 `out_len` |
| `codecin_crom_unpack` | `data ptr,len`、`mem_len *int`、`flags *int` | 校验收包，返回载荷指针与长度/标志；失败返回 `NULL` |
| `codecin_version` | 无 | `const char*`，内容形如 `codecin-native <版本> (Go)` |
| `codecin_free` | `ptr` | 释放任意由上面接口返回的缓冲；`NULL` 安全 |

`codecin_version` 返回的指针是**进程级常量**，调用方不要 `free`。

### 请求缓冲布局（`codecin_run_v2` 第一个参数）

```text
bc_len  u32 | 字节码 ...
seg_count u32
  每段:  addr u64 | len u32 | 数据 ...     （初始内存段, 只传非零页）
in_len  u32 | stdin 预填数据 ...
```

### 结果缓冲布局（与 Python 严格一致）

`codecin_run_v2` 返回一段紧凑的小端缓冲，`codecin/native.py:_parse_result_v2()`
按同一偏移解析：

```text
offset 0    status      u8   (+flags u8 +2B padding; flags bit0..3 = N/Z/C/V)
offset 4    pc          u64
offset 12   sp          u64
offset 20   heap_ptr    u64
offset 28   steps       u64
offset 36   regs        33 × u64      (32 通用 + SP)
offset 300  vec_regs    32 × 4 × f64
offset 1324 seg_count   u64
            每段:       addr u64 | len u64 | 数据 ...   (只回传被写过的 4 KiB 页)
            out_len     u64 | stdout 输出 ...
            err_len     u16 | 错误文本 ...
```

状态码语义：

| `status` | 名称 | Python 侧行为 |
| --- | --- | --- |
| 0 | OK | 正常结束（HALT） |
| 1 | Done | 正常停机 |
| 2 | Unsupported | **报错**（v5.9.0 起无解释器回退，未实现指令即错误） |
| 3 | Error | 抛出 `ExecutionError`，错误文本取自 `err` 字段 |

两点加固行为值得记住：Go 侧 `recover()` 把 panic 降级为一条 `status=3`、
`err="native panic: ..."` 的结果，**绝不让 panic 跨越 CGO 边界**终止宿主进程；
步数用尽是错误而不是"正常结束"，错误文本为
`instruction limit reached (N steps)`（`--max-instructions`，默认 `100000000`）。

## ctypes 加载与候选路径查找顺序

`codecin/native.py:get_engine(logger)` 会按顺序尝试候选路径，命中即缓存
（模块级 `_LIB_CACHE`），因此同一进程只加载一次。

候选名由平台决定：

| 平台 | 通用名（canonical） | 架构专属名（specific） |
| --- | --- | --- |
| Windows | `codecin_native.dll` | `codecin_native-windows-x64.dll` |
| Linux / Termux | `libcodecin_native.so`、`codecin_native.so` | `libcodecin_native-linux-arm64.so` |
| macOS | `libcodecin_native.dylib`、`codecin_native.dylib` | `libcodecin_native-macos-arm64.dylib` |

其中 `os` 段取 `windows` / `macos` / `linux`，`arch` 段把 `x86_64`/`amd64` 归一为
`x64`，`aarch64`/`arm64` 归一为 `arm64`，`i386`/`i686`/`x86` 归一为 `x86`。

查找顺序（**架构专属名排在通用名之前**，目录顺序其次）：

1. 环境变量 `CODECIN_NATIVE_LIB` 指定的路径；
2. `codecin/native/<架构专属名>`；
3. `codecin/native/<通用名>`；
4. `codecin/<架构专属名>`；
5. `codecin/<通用名>`；
6. 若被 PyInstaller 打包（`sys.frozen`）：`sys._MEIPASS/<名>` 与可执行文件所在
   目录下的 `<名>`。

> 为什么顺序不能反：Release 资产按 `libcodecin_native-<os>-<arch>.<ext>` 命名，
> 同一个目录里可能同时躺着两种架构的库。先命中本机架构的那一个，否则会
> `dlopen` 到一个"能加载但架构不对/符号不对"的库。
> `tests/test_native_lib_lookup.py` 专门断言了这条顺序。

### 加载失败 = 明确报错，没有回退

候选逐个 `ctypes.CDLL` 尝试，捕获两类异常后**继续尝试下一个候选**：`OSError`
（架构不符、依赖缺失、根本不是动态库）与 `AttributeError`（能加载但缺
`codecin_run_v2` 导出符号——典型是旁边放着一个旧版本的库）。全部失败时记一条
warning 并返回 `None`：

```text
原生库不可用 (v5.9.0 起无解释器回退, 请重建原生库): <path> (<err>)
```

随后 `codecin/cpu.py` 抛出带重建指引的 `CPUSimulatorError`：

```text
原生引擎不可用: 未找到 codecin-native 动态库。
请先构建原生库: 运行 codecin/native/build.ps1 (Windows)
或 codecin/native/build.sh (Linux/Termux/macOS), 然后重试。
```

原生引擎返回空结果（库版本不匹配）同样报
`原生引擎返回空结果 (库版本不匹配? 请重建原生库)`。

## 构建与验证

原生库是构建产物，不进发行包（`pyproject.toml` 的 `package-data` 与 `MANIFEST.in`
都刻意不含 `.dll/.so/.dylib`）。构建需要 Go 1.26+（`codecin/native/go.mod`），
Windows 还需要一个 cgo 可用的 C 编译器。

::: tabs

== Windows

```powershell
powershell -ExecutionPolicy Bypass -File codecin\native\build.ps1
```

产物：`codecin\codecin_native.dll`（附带生成的 `.h` 会被脚本删除）。

== Linux / Termux

```bash
sudo apt install golang gcc
sh codecin/native/build.sh
```

产物：`codecin/libcodecin_native.so`。Termux 同法（`pkg install golang` 后
`sh codecin/native/build.sh`），产物为 Android/arm64 版 `.so`。

== macOS

```bash
xcode-select --install
brew install go
sh codecin/native/build.sh
```

产物：`codecin/libcodecin_native.dylib`。

:::

等价的裸命令是在 `codecin/native/` 下执行
`go build -buildmode=c-shared -o ../codecin_native.dll .`。构建脚本默认先尝试
`-linkmode external -extldflags -static` 静态链入 C 运行时，失败时回退动态链接；
macOS 不支持共享库完全静态链接，始终动态。AOT 独立可执行文件则强制
`CGO_ENABLED=0` 纯静态构建，见 [AOT](/runtime/aot)。

### 验证命令

```bash
python -c "from codecin import native; print(native.get_engine())"
```

打印出 `NativeEngine` 对象即加载成功；打印 `None` 表示没有可用库（运行程序会
报上面的 `CPUSimulatorError`）。

**判断"库是否过期、是否与包版本一致"请用构建信息，不要再手工比对两串版本号**：

```bash
codecin --build-info
```

输出里的 `native` / `native version` / `native library` / `native matches` 四行
就是答案：

```text
  native           : 可用: codecin-native 5.9.0 (Go)
  native version   : codecin-native 5.9.0 (Go)
  native library   : D:\...\codecin\codecin_native.dll
  native matches   : 一致
```

`native matches` 为 `不一致 (原生库可能过期)` 说明旁边放的是旧库——v5.9.0 起
缺 `codecin_run_v2` 导出的旧库会被直接识别，运行时报错并提示重建。脚本里判断
请用 JSON 形式：

```bash
codecin --build-info --json
# 字段 native / native_version / native_path / native_version_matches
```

`native matches` 的判定方式很朴素：原生库自报版本串（来自 `codecin_version`，
即 `engine.BuildVersion`）里**是否包含** `codecin.__version__`。原生库不可用、
或版本串无法判定时该字段为 `null`（文本形式显示 `(未知)`）——`--build-info`
**永远以退出码 0 结束**，它不会因为库缺失而失败。

## 宿主能力

音频、画布、文件、进程、Termux、网络与 FFI 相关 SYS 调用全部在 Go 引擎侧实现，
与整程序执行同一路径：

| SYS 区段 | 能力 | Go 侧实现 |
| --- | --- | --- |
| 39–42 | `audio_play` / `audio_stop` / `audio_volume` / `audio_wait` | `engine/audio*.go`（Windows 用 waveOut，其它平台走 `afplay`/`aplay`/`paplay`/`ffplay`） |
| 43–50 | 画布：新建、矩形、圆、文本、线、存 PNG、系统查看器打开 | `engine/canvas.go` |
| 51–58 | 文件：读写/追加/存在/删除/大小/递归建目录/列目录 | `engine/system.go` |
| 59–67 | 进程与环境：`exec`、`exec_output`、`getenv`/`setenv`、`os_name`、主机名、用户名、`cwd`、主目录 | `engine/system.go` |
| 68–79 | Termux API：通知、Toast、剪贴板、电量、震动、TTS、定位、WiFi、对话框、短信 | `engine/termux.go`（非 Termux 环境优雅失败） |
| 80–90 | 路径与文件系统扩展：`path_join`/`path_abs`、复制/移动/递归删除、`is_dir`、`file_mtime`、`temp_dir`、`chdir` | `engine/system.go` |
| 91–96 | 时间与系统信息：`time_ms`、`sleep_ms`、`cpu_count`、`arch_name`、`mem_info`、`is_android` | `engine/system.go` |
| 97–99 | 网络：`http_get` / `http_post` / `download`（15 秒超时、响应体 8 MiB / 落盘 256 MiB 上限） | `engine/hostnet.go` |
| 100–102 | 编码与哈希：`sha256` / `base64_encode` / `base64_decode` | `engine/hostcrypto.go` |
| 103–106 | 桌面集成：剪贴板读写、系统通知、`open_url`（Termux 优先 → 平台原生命令分发） | `engine/hostdesktop.go` |
| 107–115 | Android / Termux 扩展：Intent、拨号、分享、手电筒、音量、亮度、拍照、指纹、传感器 | `engine/termux.go` |
| 116–118 | 键盘轮询：`key_hit` / `get_key` / `key_flush`（Unicode 码点、F1..F12、Ctrl/Shift 组合） | `engine/keyboard*.go` |
| 119–125, 128 | GUI 窗口与鼠标：`gui_new`/`gui_update`/`gui_close`/`gui_closed`/`gui_active`、`mouse_x/y/button` | `engine/gui_windows.go`（Win32）/ `engine/gui_x11.go`（X11）/ `engine/gui_stub.go`（无显示环境优雅失败） |
| 126–127 | 本地音频扩展：`audio_pos`（播放进度）、`beep`（20..20000 Hz 正弦合成） | `engine/audio*.go` |
| 129–131 | 命令行参数 / 行输入：`arg_count` / `arg` / `input_str`（CLI `--` 之后转交） | `engine/args.go` + `engine/stdin*.go` |
| 132–136 | 音频控制增强：`audio_duration` / `audio_playing` / `audio_pause` / `audio_resume` / `audio_level` | `engine/audio*.go`（暂停 = waveOutPause / SIGSTOP） |
| 137–139 | 核心 VM 机制：`ALLOCFRAME` 栈帧分配（带栈余量防护）、`time_us` / `time_ns` 单调高精度计时 | `engine/vm.go` |
| 140–144 | FFI 动态库调用：`dlopen` / `dlsym` / `ffi_call` / `ffi_callf` / `lib_close`（浮点参数走 Windows x64 XMM0-3 / SysV XMM0-7） | `engine/ffi_windows.go` / `engine/ffi_unix.go` / `engine/ffi_nocgo.go`（AOT 无 cgo 桩） |
| 145–146 | HTTP 扩展：`http_req`（自定义方法与 `K: V\n` 头）、`http_code`（对 `http_get`/`http_post`/`http_req` 三者一致） | `engine/hostnet.go` |
| 147–152 | TCP：`tcp_dial` / `tcp_send` / `tcp_recv` / `tcp_close` / `tcp_listen` / `tcp_accept`（10 s 连接超时） | `engine/netsock.go` |
| 153–156 | UDP：`udp_open` / `udp_sendto` / `udp_recvfrom`（源地址回填 "ip:port"）/ `udp_close` | `engine/netsock.go` |
| 157 | DNS：`dns_lookup`（偏好 IPv4——Windows 下 `localhost` 常先返回 ::1） | `engine/netsock.go` |

网络与 FFI 的语言侧用法（含标准库 `lib/net.cin` / `lib/ffi.cin` 封装）见
[宿主能力](/language/host-abilities)与[标准库](/stdlib/)。

::: warning 沙箱模式
`--sandbox` 下 Go 引擎侧只放行核心 VM 系统调用 ALLOCFRAME / TIMEUS / TIMENS，
其余全部宿主 SYS（网络 / FFI / 音频 / 画布 / 文件 / GUI / Termux 等）报
`Host capability disabled in sandbox mode`。
:::

## 排错

| 症状 | 处理 |
| --- | --- |
| 运行报 `原生引擎不可用: 未找到 codecin-native 动态库` | 先跑 `codecin --build-info` 看 `native` 与 `native library`（实际尝试加载的路径）；确认库位于 `codecin/` 或 `codecin/native/`（或设了 `CODECIN_NATIVE_LIB`）；确认架构与 Python 位数匹配（64 位 Python 配 `x64` 库、不要与 `arm64` 库混放）；用 `--log-level DEBUG` 看 `Failed to load native library <path>: <e>`——`OSError` 多为架构/依赖问题，`AttributeError` 多为旧库缺符号；最后重建（`sh codecin/native/build.sh`，Windows 用 `codecin\native\build.ps1`） |
| `native matches` 显示 `不一致` | 目录里放的是旧版本库；重新构建原生库（见 [编译 Go 原生库](/dev/build-native)），无需改任何配置 |
| 运行报 `原生引擎返回空结果 (库版本不匹配? 请重建原生库)` | 库能加载但 ABI 不兼容；重建原生库 |
| 构建脚本报 Go / 编译器缺失 | 需要 Go 1.26+ 与 cgo 可用的 C 编译器；Windows 把 MinGW-w64 / TDM-GCC 的 `gcc` 放进 `PATH`，Linux/Termux 用发行版的 `golang` + `gcc` |

::: warning 修改指令集后必须同步三处

Go 侧的操作码/操作数类型/SYS 常量由 `codecin/native/engine/isa_gen.go` 与
`codecin/native/compiler/syscalls.go` 提供，两者都是 `python script/gen_native_isa.py`
从 `codecin/isa.py` **自动生成**的（勿手工改）。正确顺序：改 `codecin/isa.py` →
跑生成器 → 重新编译原生库 → `python -m pytest`；CI 的
`script/gen_native_isa.py --check` 会拦截漂移。

:::

## 相关页面

- [执行路径](/guide/execution-paths)——native-only 单引擎的执行流程
- [编译 Go 原生库](/dev/build-native)——构建脚本、静态链接开关与 CI 校验细节
- [二进制格式](/runtime/formats)——CROM v4 / BIN v3 段式持久化
- [宿主能力](/language/host-abilities)——SYS 调用的语言侧用法
- [常见问题 (FAQ)](/guide/faq)
