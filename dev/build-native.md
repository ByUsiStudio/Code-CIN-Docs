---
description: "编译 Code CIN 的 Go 原生库: Go 1.26+ 与 cgo 环境要求、三平台构建命令、产物路径、静态链接策略与 CODECIN_STATIC、//go:build 约定、跨平台自检与常量生成脚本。"
---

# 编译 Go 原生库

原生库是 Code CIN 的**唯一执行引擎** (v5.9.0 起): 由 Go 编译成 **c-shared 共享库**,
Python 侧用 ctypes 加载 (`codecin/native.py`), 把整程序字节码一次交给原生 VM 执行。
没有它程序无法运行 —— 缺库时会抛 `CPUSimulatorError` (红色错误面板 + 退出码 1),
错误信息自带本页的重建指引, **不再有解释器回退**。

## 环境要求

| 组件 | 版本 | 必需 | 说明 |
|------|------|:----:|------|
| Go | **1.26+** | 是 | `go.mod` 声明 `go 1.26`; 旧版本无法编译 |
| C 编译器 | gcc / clang | 是 | cgo 与 `-buildmode=c-shared` 需要 |
| Python | 3.8+ | 是 | 加载库并运行 (与构建本身无关) |
| 平台工具 | 见下 | 是 | Linux/Termux: gcc; macOS: Xcode CLT; Windows: MinGW-w64 / TDM-GCC |

`codecin/native/go.mod` 全文只有三行, **没有任何第三方依赖**:

```text
module codecin-native

go 1.26
```

安装工具链示例:

```bash
# Debian / Ubuntu
sudo apt install golang gcc

# Termux (Android)
pkg install golang        # 自带 cgo 工具链, 支持 -buildmode=c-shared

# macOS
xcode-select --install    # clang
brew install go
```

```powershell
# Windows: 装 Go 1.26+ 后, 确保 gcc 在 PATH 里 (MinGW-w64 / TDM-GCC / MSYS2)
gcc --version
go version
```

::: warning Windows 上必须先有 C 编译器
`CGO_ENABLED=1` 加 `-buildmode=c-shared` 时 Go 会调用 `gcc`。如果 PATH 里没有 C
编译器, `go build` 会报 `cgo: C compiler "gcc" not found`。装 MinGW-w64 并把
`<mingw>\bin` 加进 PATH 即可。
:::

## 三平台构建命令

构建脚本位于 `codecin/native/`, 始终在脚本所在目录执行 (`build.sh` 内部会
`cd "$(dirname "$0")"`, `build.ps1` 会 `Set-Location`)。两者都会设置
`CGO_ENABLED=1`, 并删掉 c-shared 附带的头文件 (Python ctypes 不需要)。

::: tabs

== Windows

在仓库根目录执行 (不受执行策略影响, 推荐写法):

```powershell
powershell -ExecutionPolicy Bypass -File codecin\native\build.ps1
```

或进目录后直接运行脚本:

```powershell
cd codecin\native
.\build.ps1
```

== Linux

```bash
sudo apt install golang gcc
cd codecin/native
sh build.sh
```

== Termux (Android)

```bash
pkg install golang
cd codecin/native
sh build.sh
```

== macOS

```bash
xcode-select --install
cd codecin/native
sh build.sh
```

:::

::: tabs

== 已完成构建 (缓存命中)

```text
$ sh build.sh
Building (static linking)...
Built: ../libcodecin_native.so
```

== 静态链接不可用, 自动回退

```text
$ sh build.sh
Building (static linking)...
static linking unavailable, falling back to dynamic
Building (dynamic linking)...
Built: ../libcodecin_native.so
```

:::

## 产物路径与文件名

三个脚本都把库写到 `codecin/native/` 的**上一级**, 也就是 Python 包目录
`codecin/` 里, 这样 `codecin/native.py` 的默认查找路径就能直接命中。

| 平台 | 产物 | 生成者 |
|------|------|--------|
| Windows | `codecin/codecin_native.dll` | `build.ps1` |
| Linux | `codecin/libcodecin_native.so` | `build.sh` |
| Termux (Android) | `codecin/libcodecin_native.so` | `build.sh` (`uname -s` 走 `*` 分支) |
| macOS | `codecin/libcodecin_native.dylib` | `build.sh` (`uname -s` = `Darwin`) |

`codecin/native.py: _lib_candidates()` 的查找顺序 (架构专属优先):

1. `$CODECIN_NATIVE_LIB` (环境变量, 最高优先级);
2. `codecin/native/<架构专属名>` → `codecin/native/<通用名>`;
3. `codecin/<架构专属名>` → `codecin/<通用名>`;
4. PyInstaller 冻结布局: `sys._MEIPASS/<名>` 与 exe 同级目录。

架构专属名形如 `libcodecin_native-linux-x64.so` /
`codecin_native-windows-x64.dll` / `libcodecin_native-macos-arm64.dylib`
(这正是 Release 资产的命名, 见 [打包与发布](/dev/packaging))。

::: warning c-shared 会顺手生成头文件
`go build -buildmode=c-shared` 会在输出文件旁生成 `codecin_native.h` /
`libcodecin_native.h`。两个脚本都会自动删除它们; 手动构建时请自己清理, 别提交进仓库
(`tests/test_no_go_cli.py` 会断言源码树里没有构建产物)。
:::

## 静态链接策略与 `CODECIN_STATIC`

脚本默认先尝试用 `-ldflags '-linkmode external -extldflags "-static"'` 把 C 运行时
静态链入共享库, 失败再回退动态链接。

| `CODECIN_STATIC` | 行为 |
|------------------|------|
| 未设置 / `auto` (默认) | 先试静态; 失败则打印提示并回退动态链接 |
| `1` | 强制静态; 失败直接 `exit 1` / `throw` (不回退) |
| `0` | 跳过静态, 直接动态链接 |

| 平台 | 静态链接 |
|------|----------|
| Linux / Termux | 支持, 默认尝试 |
| Windows | 默认尝试; 通常只依赖系统 DLL (`kernel32` / `msvcrt`), 无 MinGW 运行时依赖 |
| macOS | **不支持**共享库完全静态链接, `build.sh` 里 `STATIC_SUPPORTED=0`, 始终动态 (仅依赖系统库) |

::: tabs

== 强制静态 (CI / Release 用)

```bash
cd codecin/native
CODECIN_STATIC=1 sh build.sh
```

```powershell
cd codecin\native
$env:CODECIN_STATIC = '1'
.\build.ps1
```

== 强制动态 (排查加载问题时用)

```bash
cd codecin/native
CODECIN_STATIC=0 sh build.sh
```

```powershell
cd codecin\native
$env:CODECIN_STATIC = '0'
.\build.ps1
```

:::

Release 工作流对 Linux 资产使用 `-ldflags '-linkmode external -extldflags -static'`,
失败时回退动态 (见 `.github/workflows/release.yml` 的 `native` 矩阵)。

## 平台相关代码的 `//go:build` 约定

**凡是与操作系统绑定的实现, 必须用构建约束拆成多个文件**, 否则其它平台直接编不过。
两个典型范例:

| 文件 | 构建约束 | 实现 |
|------|----------|------|
| `codecin/native/engine/audio.go` | 无 (公共逻辑) | URL 下载、WAV 解析、播放编排 |
| `codecin/native/engine/audio_windows.go` | `//go:build windows` | winmm `PlaySoundW` |
| `codecin/native/engine/audio_other.go` | `//go:build !windows` | `afplay` / `aplay` / `paplay` / `ffplay` |
| `codecin/native/engine/ffi_windows.go` | `//go:build windows && cgo` | `LoadLibrary` / `GetProcAddress` |
| `codecin/native/engine/ffi_unix.go` | `//go:build !windows && cgo` | `dlopen` / `dlsym` |
| `codecin/native/engine/ffi_nocgo.go` | `//go:build !cgo` | FFI 桩 (见下文 CGO 说明) |

GUI / 键盘 / 终端 / stdin 等宿主能力同样按 `windows` / `linux` / `darwin` / `!windows`
拆分文件; VM / 编译器 / CROM / 网络是纯 Go 跨平台实现。

```go
//go:build windows

package engine

// 仅 Windows 编译的实现
```

::: info `CGO_ENABLED=0` 只出现在 AOT 静态构建
常规 c-shared 构建始终需要 cgo (脚本会设 `CGO_ENABLED=1`)。只有
[AOT 静态构建](/runtime/aot) 强制 `CGO_ENABLED=0`, 此时两个 FFI cgo 实现
(`ffi_windows.go` / `ffi_unix.go`) 因 `cgo` 构建标签不满足而被排除, 由
`ffi_nocgo.go` 桩顶上: FFI 系统调用在运行时返回
`FFI unavailable: built without cgo (static AOT build); use the dynamic-library runtime for ffi_*`,
而不是构建期链接失败。其余能力 (VM / 网络 / 音频 / 画布) 不受影响 ——
需要 FFI 的程序请用动态库运行时运行。
:::

::: tip 新增平台相关 API 的检查方法
写完后跑一次交叉编译自检 (下一节)。若只在 `GOOS=windows` 下编过, 一定要再跑
`GOOS=linux` / `GOOS=darwin`, 否则 CI 的 `native` 作业会失败。
:::

## 跨平台编译自检

不需要 C 交叉工具链 —— 只检查纯 Go 包能否为各目标平台构建 (`CGO_ENABLED=0`)。

```bash
cd codecin/native
for t in linux/amd64 linux/arm64 darwin/amd64 darwin/arm64 windows/amd64; do
  echo "--> $t"
  GOOS="${t%/*}" GOARCH="${t#*/}" CGO_ENABLED=0 \
    go build ./engine ./ir ./compiler ./aot
done
```

CI 的 `native` 作业会执行同一段检查, 另外还跑:

```bash
cd codecin/native
go build ./...            # 全部包 (Go 侧不含 CLI 入口)
go vet ./...
gofmt -l .                # 必须无输出
go test ./... -race -count=1
```

```powershell
# Windows 上等价的 gofmt 门禁
cd codecin\native
$out = gofmt -l .
if ($out) { Write-Error "以下文件未格式化:`n$out" }
```

## 手动等价命令

不想用脚本 (或脚本环境不适配) 时, 手动命令完全等价于脚本的最终一步:

```bash
# 在 codecin/native/ 目录里执行
# Linux / Termux
go build -buildmode=c-shared -o ../libcodecin_native.so .

# macOS
go build -buildmode=c-shared -o ../libcodecin_native.dylib .

# 静态链接版本 (Linux)
go build -buildmode=c-shared \
  -ldflags '-linkmode external -extldflags -static' \
  -o ../libcodecin_native.so .
```

```powershell
# Windows (在 codecin\native\ 目录里执行)
$env:CGO_ENABLED = '1'
go build -buildmode=c-shared -o ..\codecin_native.dll .
```

::: info 导出符号
库对外只导出 7 个函数, 由 `codecin/native/main.go` 用 `//export` 声明:

| 符号 | 作用 |
|------|------|
| `codecin_run_v2` | 原生字节码 VM (**ABI v2, Python 侧当前使用**): 一次传入整程序字节码 + 初始内存段, 回传寄存器/向量/NZCV/脏内存段/输出 |
| `codecin_run` | 旧版 ABI (v1) 快照接口, 为兼容保留 |
| `codecin_free` | 释放 `codecin_run` / `codecin_run_v2` 返回的缓冲 |
| `codecin_set_args` | 设置 `--` 之后的程序参数 (argv) |
| `codecin_crom_pack` | CROM 打包 (含 zlib 压缩) |
| `codecin_crom_unpack` | CROM 解包校验 |
| `codecin_version` | 静态版本字符串, **不要在 Python 侧 free** (进程级常量) |

VM 入口内部有 `recover()`, 因为 Go 的未捕获 panic 会直接终止宿主进程 ——
这里降级为"返回一个带错误信息的结果", 由 Python 侧转成异常。
:::

## 验证构建结果

```bash
python -c "from codecin import native; print(native.get_engine())"
```

- 输出形如 `<codecin.native.NativeEngine object at 0x...>` → 加载成功;
- 输出 `None` → 没找到或加载失败。此时直接运行程序会抛 `CPUSimulatorError`
  (红色错误面板 + 退出码 1), **不会回退解释执行** —— 按本页命令重建原生库即可。

想知道具体是哪个文件、哪个版本:

```bash
python -c "
from codecin import native
e = native.get_engine()
print('engine:', e)
if e is not None:
    print('version:', e.version())
"
```

想看查找与失败的细节, 传个 DEBUG 级别的 logger:

```powershell
codecin --log-level DEBUG examples\control_flow.cin *>&1 |
  Select-String -Pattern 'native|原生'
```

原生库缺失或加载失败时, 运行程序会得到红色错误面板与退出码 1, 错误文本就是
`codecin/cpu.py` 的 `NATIVE_HINT` —— 指向 `codecin/native/build.ps1` (Windows) /
`build.sh` (Linux/Termux/macOS) 的重建指引。

::: warning 架构不符是"能加载但跑不了"的典型
同一个目录里同时放两种架构的库时, 必须优先选本机架构: `_lib_candidates()` 因此把
架构专属名排在通用名**之前**。`get_engine()` 捕获 `OSError` (架构不符/依赖缺失/不是
动态库) 与 `AttributeError` (能加载但缺导出符号或 ABI 不符), 都会继续尝试下一个候选;
全部候选失败后返回 `None`, 运行程序时抛 `CPUSimulatorError` (附重建指引)。
`tests/test_native_lib_lookup.py` 覆盖了这个顺序。
:::

## 常量生成脚本

Go 侧的操作码/操作数类型码/SYS 功能号/版本常量**不是手写的**, 而是由
`script/gen_native_isa.py` 从 `codecin/isa.py` 生成。改完指令集必须重新生成:

```bash
python script/gen_native_isa.py           # 重写生成物
python script/gen_native_isa.py --check   # 只校验一致 (CI 用)
```

| 生成物 | 内容 |
|--------|------|
| `codecin/native/engine/isa_gen.go` | `op*` 操作码、`kind*`、`opcodeByName`、`argCounts`、`sys*` |
| `codecin/native/compiler/syscalls.go` | 编译器用的 `SysXXX` 常量 |
| `codecin/native/engine/version_gen.go` | `engine.BuildVersion` (真源: `codecin/__init__.py`) |

```text
$ python script/gen_native_isa.py --check
native isa_gen.go up to date.
compiler syscalls.go up to date.
native version_gen.go up to date.
```

守卫规则:

- 生成物必须是 **gofmt 干净的 LF 文件**; `--check` 会按**字节**比对, 因此 Windows 下
  被写成 CRLF 也会被判为不一致 (提示 `换行不是 LF (CRLF)`)。这正是
  `.gitattributes` 里 `*.go text eol=lf` 的原因;
- 生成文件头部带 `// Code generated by script/gen_native_isa.py ... DO NOT EDIT.`,
  **不要手工改** —— 下次生成会被覆盖;
- 生成后必须重新编译原生库, 否则二进制里还是旧常量。

::: tip 改了指令集之后的正确顺序
1. 改 `codecin/isa.py` 与 Go 引擎 / 编译器等实现;
2. `python script/gen_isa_docs.py` (重写指令表文档);
3. `python script/gen_native_isa.py` (重写 Go 常量);
4. 重新编译原生库 (本页上面的构建命令);
5. `python -m pytest`。

完整清单见 [扩展指令 / 系统调用](/dev/extend)。
:::

## 相关页面

- [项目结构](/dev/structure) — Go 侧各包职责与常量单一真源
- [测试与 CI](/dev/testing) — CI 的 `native` / `integration` 作业
- [打包与发布](/dev/packaging) — 安装期现场编译与 Release 预编译资产
- [Go 原生运行时](/runtime/native) — 加载顺序与宿主能力边界
