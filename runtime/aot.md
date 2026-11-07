---
description: AOT 独立可执行文件：--build-exe 的 C/native/VM 后端、交叉编译、优化、缓存、调试构建，以及对象/链接/静态库。
---

# AOT 独立可执行文件

`--build-exe` 把程序编译成**独立可执行文件**（Windows / Linux / macOS）。产物不依赖 Python 或 Code CIN 动态库，可选三种后端：

- **c（默认）**：`codecin/cbackend.py` 把每条 UCBC 指令展开为 C 语句（寄存器数组 + 显式标志位 + 扁平内存），交给 GCC/Clang 或 `zig cc` 生成机器码；
- **native（旧 Go 后端）**：`codecin/native_codegen.py` 把核心整数/控制流/内存/SYS 指令直接生成 Go 代码，再由 Go 编译器产出机器码；
- **vm**：把 UCBC 字节码与初始内存段表内嵌进产物，由内置 Go VM 执行。

`auto`（默认）优先 C 后端；C 后端不支持程序所用指令时，回退 Go native 或 VM。
前端支持 `.cin` / `.asm` / `.pl` / `.sdgcc` / `.bin` / `.co`。

- **运行时不需要 Python**，不需要 Code CIN 动态库；
- **C 后端**默认动态链接系统 C 库，`--build-static` 时静态链接（macOS 自动忽略）；
- **Go native/VM 后端**强制 `CGO_ENABLED=0` 纯静态、无 cgo（对 FFI 的影响见[下文](#静态构建与-ffi)）；
- `import` 依赖闭包在**编译期展开**并嵌入产物，产物运行时不读取任何 `.cin`；
- **构建期**：C 后端需要 `gcc`/`clang` 或 `zig`；Go 后端需要 Go 工具链 + 仓库里的 Go 源码树。

## 前置条件

| 项目 | 要求 |
| --- | --- |
| C 后端 | 系统 C 编译器（GCC/Clang，Windows 可用 MinGW-w64），或 `zig`（交叉编译时会自动查找 `zig cc`） |
| Go 后端 | Go 1.26+（`codecin/native/go.mod` 声明 `go 1.26`；实测 1.26.5 可用），且源码树包含 `codecin/native/` |
| 输入 | `.cin` / `.asm` / `.pl` 源文件、`.sdgcc` / `.bin` 字节码、链接后的 `.co` 对象 |
| 网络 | 不需要（本地编译） |

::: warning Go 后端不适用于已安装的 wheel

Go native/VM 后端是**面向源码检出**的构建期功能。发行 wheel / 独立 CLI 里不含 `codecin/native/` 的 Go 源码，因此会报：

```text
找不到 Go 模块目录 <...>\codecin\native (AOT 构建需要仓库中的 Go 源码)
找不到 AOT 模板 <...>\aot\stub_main.go.txt; --build-exe 需要包含 codecin/native/ 的源码树
```

C 后端只要系统里有 C 编译器即可，不依赖 Go 源码树。
:::

## 基本用法

```bash
codecin program.cin --build-exe program      # 本机平台
codecin program.cin --build-exe              # 省略路径: 输出 <程序名>[.exe]
```

| 选项 | 说明 |
| --- | --- |
| `--build-exe [OUT]` | 编译成独立可执行文件后**退出**（不执行）；省略 `OUT` 时输出 `<程序名>` + 平台后缀 |
| `--build-target OS/ARCH` | 交叉编译目标，默认当前平台（`aot.host_target()`） |
| `--build-backend auto\|c\|native\|vm` | `auto`（默认）优先 C 后端；`c` 强制 C；`native` 强制旧 Go 代码生成；`vm` 强制内嵌字节码 |
| `--build-static` | C 后端产物静态链接（macOS 目标自动忽略） |
| `--build-strip` | C 后端产物去掉符号表，减小体积 |
| `--build-keep-c` | 保留 C 后端生成的 `program.c`（输出到 `<OUT>.c`） |
| `--build-verify` | 构建后校验 ELF/PE 头部与目标架构 |
| `--optimize 0-3` | IR 优化：0 关闭 / 1 窥孔 / 2 常量折叠 / 3 不可达代码删除 |
| `--no-build-cache` | 禁用 AOT 增量构建缓存（含对象/归档链接缓存） |
| `--build-debug` | Go 后端保留符号表/DWARF，不传 `-s -w` |
| `--build-keep-temp` | 保留 Go 构建的临时包目录，排查失败用 |
| `--mem-size BYTES` | 内存逻辑大小，默认 `1073741824`（1 GiB）；产物按段式只嵌入数据段实际覆盖的范围 |

两点容易踩的细节：

- **输出名与 `-o` 无关**。`--build-exe` 只认自己的可选参数；Windows 目标若输出名不以 `.exe` 结尾，会**自动补 `.exe`**（`hello-aot` → `hello-aot.exe`）。
- **C 后端目标只有 `windows/amd64`、`linux/amd64`、`linux/arm64`**；`windows/arm64`、`darwin/amd64`、`darwin/arm64` 请显式用 `--build-backend native` 或 `vm`。Go 后端支持 `SUPPORTED_TARGETS` 列出的六种 `os/arch` 组合，`--build-target` 只校验两段非空，其余交给 Go 工具链判断。

成功时的两行日志（C 后端）：

```text
AOT build: program.cin -> program (目标 windows/amd64, 后端 c)
AOT build 完成: D:\...\program.exe
```

失败时打印 `Build Error` 面板并返回退出码 1（未知选项/非法目标、依赖缺失、编译错误、C/Go 编译失败都走这条路径）。

## 后端选择

`--build-backend` 控制最终产物如何执行：

| 后端 | 行为 | 适用 |
| --- | --- | --- |
| `auto`（默认） | C 后端支持程序所用指令时用 `c`，否则按指令数选 Go `native` / `vm` | 大多数程序 |
| `c` | 指令流 → C 源码 → GCC/Clang/`zig cc`；当前覆盖整数/比较跳转/内存/栈/调用返回/`OUT` 与核心 SYS | 追求小体积、构建快、可读 C 源码 |
| `native` | 旧 Go 代码生成后端：直接操作 `engine.NativeRuntime`；超过阈值仍强制 native 会提示可能较慢 | 需要 Go 后端语义或 C 不支持的平台 |
| `vm` | 内嵌 UCBC 字节码，由 Go VM 执行 | 指令数极大或依赖 VM 特有语义 |

C 后端未实现的指令或 SYS 会在运行期以退出码 **70** 明确报错，不会静默产生错误结果；构建前 `cbackend.supports()` 会先做指令/系统调用白名单检查，`auto` 不适用时自动改走 Go 后端。

native 代码生成本身在**超过 800 条指令**时自动切换为基本块模式，把大函数拆成多个 Go 代码块，避免单个 Go 函数过大导致编译极慢。native 后端直接降低整数、控制流、内存、SYS、ARM64/RISC-V、浮点与常见向量指令；无法静态求值的动态控制流/内存操作数会走 `rt.Exec`，复用 VM 语义。

```bash
# 强制 C + O3 + 静态链接
codecin prog.cin --build-exe prog-c --build-backend c --optimize 3 --build-static

# 强制 C 并保留生成的 C 源码
codecin prog.cin --build-exe prog-c --build-backend c --build-keep-c

# 强制 Go native + O3
codecin prog.cin --build-exe prog-native --build-backend native --optimize 3

# 强制 VM
codecin prog.cin --build-exe prog-vm --build-backend vm

# 保留符号/DWARF 的调试构建 (Go 后端)
codecin prog.cin --build-exe prog-debug --build-debug
```

### 构建缓存

AOT 默认启用增量缓存：缓存键包含源文件/import 闭包、目标平台、后端、优化级别、内存/步数、debug 以及 Python/Go 工具链指纹。命中时直接复制产物，跳过代码生成与 `go build`。

- `--no-build-cache` 禁用；
- `CODECIN_AOT_CACHE` 指定缓存目录；
- 对象/归档链接按输入对象内容与链接选项单独缓存。

## 对象、链接与静态库

除整程序 AOT 外，也可以先独立编译再链接（CIN 使用 `extern` 声明跨对象符号）：

```bash
# ASM/PL/CIN -> 可重定位对象
codecin --emit-object main.cin -o main.co
codecin --emit-object lib.cin  -o lib.co

# 链接（可加 --optimize / --gc-sections）
codecin --link main.co --link lib.co -o app --optimize 3 --gc-sections

# 也可以把源文件直接交给链接器
codecin --link main.cin --link lib.cin -o app

# 打包静态库；链接器只拉取能解决未定义符号的成员
codecin --emit-archive --link lib.co --link lib2.co -o lib.colib
codecin --link main.co --link lib.colib -o app
```

`.co` 对象保存未解析代码/数据标签、内存段与入口信息；链接器负责合并代码/数据基址、解析 `NAME±N`、`DW/DD/DQ label` 数据指针与 CIN 字符串/全局/struct 指针槽重定位。`--gc-sections` 从入口做保守可达性分析，删除未调用函数；遇到动态 `CALL/JMP` 或代码指针时自动放弃以避免误删。

CIN 库文件不写 `main`，用 `extern function` / `extern int` 声明跨对象函数与全局：

```cin
// lib.cin
int counter = 5
function bump() { counter = counter + 1 }

// main.cin
extern int counter
extern function bump()

function main() -> int {
    bump()
    println(int_to_str(counter))
    return 0
}
```

::: tip 输入格式
`--build-exe` 接受 `.cin/.asm/.pl/.bin/.co`；`--link` 接受 `.cin/.asm/.pl/.co/.colib`。`.bin`/`.co` 不再需要先转回源码。
:::

## 完整示例

::: tabs

== 本机平台 (Windows)

```powershell
codecin hello.cin --build-exe hello-aot
.\hello-aot.exe
```

```text
AOT build: hello.cin -> hello-aot (目标 windows/amd64, 后端 c)
AOT build 完成: D:\...\hello-aot.exe

Hello, Code CIN!
2 + 3 = 5
```

C 后端产物实测通常**几百 KB**；Go native/VM 后端为 **约 3.4–6.6 MiB**（随程序、后端与平台浮动）。

== 交叉编译 Linux

```bash
# C 后端交叉编译依赖 zig cc
codecin hello.cin --build-exe hello-linux --build-target linux/amd64 --build-static
```

`--build-static` 时产物是**无 `PT_INTERP` 的 ELF**，不依赖 glibc，可拷到任意同架构 Linux
（含 Alpine/musl）直接运行；不加静态链接则依赖目标机 C 库。

== 交叉编译 macOS

```bash
codecin hello.cin --build-exe hello-mac --build-target darwin/arm64 --build-backend native
```

C 后端不支持 macOS 目标, 必须显式选 Go native/VM 后端。产物是 Mach-O；Go 交叉编译
不需要 macOS 本机。

== 带依赖库的程序

```bash
codecin prog.cin --build-exe prog --mem-size 1048576
```

```text
依赖库 1 个 (编译期嵌入产物): stat.cin
AOT build: prog.cin -> prog (目标 windows/amd64, 后端 c)
AOT build 完成: D:\...\prog.exe
```

:::

## 构建流程做了什么

`codecin/aot.py:build_program()` 的顺序（每一步失败都给出明确错误，不留半成品）：

1. **程序文件存在性**：不存在报 `找不到程序文件: <path>`；
2. **依赖完整性检查**：CIN 用 `collect_imported_files()` 展开 `import` 闭包，缺失/循环引用报 `依赖检查失败: ...`，缺失文件报 `依赖库缺失: <列表>`——不必等编译器才失败；
3. **编译/装载**：CIN 走 `CINCompiler().compile()`，ASM/PL 走汇编器，`.sdgcc` / `.bin` 走 `crom.load_bin`（`.sdgcc` 先取 `CODE` 段），`.co` 走对象读取；失败报 `编译失败: ...`；
4. **优化**：`--optimize > 0` 时先跑 IR 优化器（窥孔/常量折叠/不可达代码删除）；
5. **后端选择**：`auto` 先问 `cbackend.supports()`；C 可用则 `codegen` 生成 C 源码并调用 GCC/Clang/`zig cc`；否则按指令数选 Go native 或 VM。`--build-backend c` 不支持时直接报错，不静默回退；
6. **生成初始内存段表**：默认 1 GiB（`--mem-size` 覆盖，下限 256）；不再预填整个地址空间的零块，只为数据段实际覆盖的范围分配内容；数据段写入落在声明大小之外时**直接报错**（见下文「数据段越界与 `--mem-size`」）；
7. **清扫陈旧残留**：建新目录之前先调 `aot.sweep_stale_build_dirs()`，删掉 `codecin/native/` 下**超过 6 小时**的 `.aotbuild-*` / `.aotprobe-*` 残留（仅 Go 后端；清理是尽力而为，失败绝不影响本次构建）；
8. **C 后端**：调用 C 编译器（或 `zig cc`，交叉编译时自带目标 libc），按 `-O0..3`、`--build-static`、`--build-strip` 生成产物；`--build-keep-c` 时把生成的 `program.c` 复制到 `<OUT>.c`；
9. **Go 后端**：生成临时包——VM 路径写入 `main.go`（来自 `codecin/native/aot/stub_main.go.txt`）、`program.ucbc`、`program.segs`；native 路径写入生成好的 `main.go`；强制 `CGO_ENABLED=0`（纯静态、无 cgo）+ `GOOS`/`GOARCH` 执行

   ```text
   go build -trimpath -tags netgo,osusergo -ldflags "-s -w" -o <输出> ./.aotbuild-xxxx
   ```

   `--build-debug` 会去掉 `-ldflags "-s -w"`，保留符号/DWARF。

10. **缓存**：成功后将产物写入 AOT 缓存（默认启用，`--no-build-cache` 禁用）；
11. **清理**：默认删除临时目录；`--build-keep-temp` 时保留并打印 `AOT 临时目录保留: <tmp>`。删除失败会记一条 **warning**（残留目录的**绝对路径** + 失败原因 + 手动删除命令），不再静默吞掉。

VM 路径生成的入口 shell 极薄——把两个资源文件 `//go:embed` 进去，然后交给 `aot.Main`：

```go
//go:embed program.ucbc
var bytecode []byte

//go:embed program.segs
var segFile []byte

func main() {
	os.Exit(aot.Main(bytecode, segFile))
}
```

同一份模板被 Go 侧（`codecin/native/aot/aot.go`）与 Python 侧（`codecin/aot.py`）共用，避免模板漂移；`tests/test_aot.py` 断言两边都引用 `stub_main.go.txt`。

native 路径不写 `//go:embed`，而是直接生成类似下面的入口：

```go
func main() {
    rt := engine.NewNativeRuntime(memSize, sp, heapBase, nativeSegments, maxSteps)
    rt.SetInput(in)
    ok := run(rt)
    os.Exit(rt.Finish(ok))
}
```

`run(rt)` 内部就是逐条核心指令对应的 `rt.Mov` / `rt.Add` / `rt.Load` / `rt.B` 等原语调用；动态/复杂指令通过 `rt.Exec` 复用 VM。

### 临时构建目录的生命周期 (仅 Go 后端)

`go build` 需要一个真实的包目录，所以每次 **Go 后端**构建都会在 `codecin/native/` 下建一个
`.aotbuild-<随机十六进制>/`（`tempfile.mkdtemp` 的 0700 权限在受限环境里会被拒绝写入，
因此用 `os.makedirs`）。C 后端使用系统临时目录 `.aotc-*`，编译结束即删；C 源码仅在
`--build-keep-c` 时保留到 `<OUT>.c`。这些 Go 目录的生命周期规则如下：

| 阶段 | 行为 |
| --- | --- |
| **每次构建之前** | 先清扫 `codecin/native/` 下**超过 6 小时**（`DEFAULT_STALE_AGE_SECONDS = 6 * 3600`）的 `.aotbuild-*` / `.aotprobe-*` 残留，再建新目录 |
| 正常结束 | 删除本次的临时目录 |
| 删除失败 | 记 **warning**（不再静默）：残留目录**绝对路径** + 失败原因 + 手动删除命令 |
| `--build-keep-temp` | 保留本次目录并打印 `AOT 临时目录保留: <tmp>`；**它同样会被之后的构建清扫**（超过 6 小时即删） |
| 打包 | 这些残留不会进 wheel（见 [打包与发布](/dev/packaging) 的 `exclude-package-data`） |

清扫只处理 `codecin/native/` 的**直接子目录**（不递归），名字必须带 `.aotbuild-` /
`.aotprobe-` 前缀，且**不是符号链接**；普通文件、别处的目录、指向别处的链接一律跳过。
`max_age_seconds=0` 会删除全部匹配目录，并发构建时不要这么用。

清理失败的 warning 形如（路径是绝对路径，提示里给出两个平台的删除命令）：

```text
AOT: 残留临时目录清理失败: D:\...\codecin\native\.aotbuild-1a2b3c4d5e6f (7.3 小时前, [WinError 5] 拒绝访问。); 请手动删除该目录 —— Windows PowerShell: Remove-Item -LiteralPath "D:\...\codecin\native\.aotbuild-1a2b3c4d5e6f" -Recurse -Force ; Linux/macOS: rm -rf "D:\...\codecin\native\.aotbuild-1a2b3c4d5e6f"
```

::: tip 沙箱 / 只读 ACL 环境
清理失败说明"这一层目录删不掉"，但**构建本身照常进行**——清扫与删除都是尽力而为，
任何异常都被降级为 warning。真正需要人工介入时按提示里的命令删一次即可。
:::

### 依赖闭包如何在编译期展开

`import` 的解析规则与普通编译完全一致：

- `import "./x.cin"` / `import "../x.cin"` → 相对**当前 `.cin` 文件**所在目录；
- `import "x.cin"`（裸名字）→ 解析到内置标准库 `codecin/lib/<name>/src/`（`lib/` 前缀保留为兼容写法）；
- 同一文件每次编译只包含一次，循环引用报错。

因为展开发生在编译期，**产物不读任何 `.cin`**。实测：把带 `import "stat.cin"` 的程序构建到临时目录后，在没有 `codecin/lib` 的目录里直接运行产物，输出与直接 `codecin` 运行一致（`sum=55 stat=15`）。

## 产物行为

| 行为 | 说明 |
| --- | --- |
| 启动 | **C 后端**从生成的 C 入口进入同一套指令语义；**VM 后端**从 PC 0 执行内嵌字节码（CIN 首条是 bootstrap `CALL main; HALT`）；**native 后端**直接进入生成的 `run(rt)` |
| 初始状态 | `SP = 内存大小 - 8`（栈从内存末尾向下增长），堆基址 = 内存大小 / 2；默认 1 GiB 下即 `SP = 0x3ffffff8`、堆基址 `0x20000000` |
| 步数上限 | 默认不限制；仅构建时显式传入已弃用的隐藏参数 `--max-instructions` 才生效 |
| 内存 | 由运行时按 `mem_size` 分配（OS 懒提交），实际物理占用只有写过的页 |
| stdout | 打印程序输出（`OUT` / `println` 等） |
| stdin | **只在被重定向（管道/文件）时读取**；交互式终端下不会挂起等待 EOF |
| FFI | 不可用：Go AOT 静态构建无 cgo；C 后端 SYS 白名单不含 140–144。相关调用返回运行时报错 |
| 正常结束 | 退出码 **0** |
| 运行期错误 | 消息写 **stderr**，退出码 **1**；C 后端未实现指令/SYS 为 **70** |

运行期错误的实测形态（程序先打印了 `before`，随后除零）：

```text
$ ./boom.exe
before
runtime error: Division by zero          ← stderr
$ echo $?
1
```

若原生 VM 返回空结果，stderr 为 `runtime error: no result`；未实现的指令会给出 `runtime error: unsupported instruction (原生 VM 未实现该指令)`。

## 静态链接与体积

| 后端 | 做法 | 效果 |
| --- | --- | --- |
| C（默认） | GCC/Clang/`zig cc`；默认动态链接系统 C 库，`--build-static` 加 `-static` | 体积小、构建快；静态模式下不依赖目标机 libc |
| Go native/VM | `CGO_ENABLED=0`（构建时强制，不依赖环境）+ `-tags netgo,osusergo` + `-trimpath -ldflags "-s -w"` | 纯静态，不链接 libc/任何动态库 |
| 体积 | C 后端通常几百 KB；Go 后端实测约 3.4–6.6 MiB（含 Go 运行时与引擎） | — |

`tests/test_aot.py` 会把 **Go 静态产物**按 ELF 解析并断言**不存在 `PT_INTERP` 段**——
这是"Linux 产物不依赖 glibc"的机器可验证形式；C 后端是否静态由 `--build-static` 决定。

## 静态构建与 FFI

FFI 在所有 AOT 形态下都不可用，但原因不同：

| 后端 | 原因 | 运行期表现 |
| --- | --- | --- |
| Go native / VM | 构建把 `CGO_ENABLED` 固定为 `0`，`ffi_windows.go` / `ffi_unix.go` 被排除，改用 `ffi_nocgo.go` 桩 | `FFI unavailable: built without cgo (static AOT build); use the dynamic-library runtime for ffi_*` |
| C | `cbackend.SUPPORTED_SYS` 白名单不含 140–144 | 未实现 SYS，按 C 后端约定以退出码 70 报错 |

也就是说：**AOT 产物调用 FFI 会得到运行时报错，而不是构建期链接失败**。其余能力（网络、音频、画布、键盘）在 Go 后端产物里走纯 Go 实现；C 后端只覆盖其 SYS 白名单内的能力（见 [C 后端能力](#后端选择)）。需要 FFI 的程序请用动态库原生路径运行（`codecin program.cin`）。

::: tip 网络与 FFI 的取舍

`HTTPREQ` / `TCPDIAL` 等网络系统调用由 Go 标准库实现，在 **Go 后端** AOT 产物里完全可用
（这正是 `-tags netgo,osusergo` 的意义）；C 后端覆盖 HTTP/TCP/UDP/DNS 的 SYS 白名单，
但被关掉的只有依赖 C 动态库加载的 FFI。

:::

## 数据段越界与 `--mem-size`

编译期生成内存段表时，任何落在声明大小之外的数据段写入都会**直接报错**（不会静默丢弃）：

```text
数据段超出内存大小 1048576 字节: addr=0x0 size=1048592; 用 --mem-size 增大后重试
```

默认内存已是 1 GiB，绝大多数程序的数据段直接放下；只有显式给了更小的 `--mem-size`、或数据真的巨大（例如一个上吉字节的字符串字面量）才会触发。按提示增大后即可通过：

```bash
codecin bigstr.cin --build-exe bigstr2 --mem-size 4294967296
```

注意这一点**只在构建期检查数据段**；运行期对栈/堆的越界行为与动态库原生路径一致（需要数组越界检查时用 `--bounds-check`，见 [CIN 语言限制与常见错误](/language/errors)）。`--mem-size` 小于 256 会被抬到 256。

::: tip 内存大小要一次定对

产物内置的内存大小在构建时固化。数据段放不下时构建直接失败（好事），但运行期才发现的"内存不够"需要重新构建，所以给够余量。得益于 1 GiB 默认值与稀疏分页（大数组不再需要显式 `--mem-size`），这一步通常不用操心。

:::

## 排错

::: details `go build` 失败 / 缓存不可写

受限环境（沙箱、只读 HOME、部分 CI）下 Go 默认构建缓存可能不可写。构建器检测到这类错误时会**自动回退到仓库内 `.gocache` 重试一次**；仍失败则提示：

```text
go build 失败 (目标 <os>/<arch>): ...
提示: 默认 Go 构建缓存不可写且回退失败; 可显式设置 GOCACHE 指向可写目录后重试
```

也可以自己指定：

```bash
GOCACHE=/tmp/gocache codecin prog.cin --build-exe prog
```

:::

::: details 想看 Go 后端 `go build` 到底在做什么

```bash
codecin prog.cin --build-exe prog --build-backend native --build-keep-temp --log-level DEBUG
```

`--build-keep-temp` 会保留 `codecin/native/.aotbuild-<rand>/`，里面有生成的 `main.go`（VM 路径还包含 `program.ucbc` 与 `program.segs`）；可以手动在该目录里复现编译命令。DEBUG 级日志会打印完整 `go build` 命令行与 `GOOS`/`GOARCH`/`CGO_ENABLED`。`.aotbuild-*` 以 `.` 开头，Go 工具链会忽略它，因此不影响 `go build ./...`。**保留目录不是永久的**：超过 6 小时后会被下一次 AOT 构建清扫，要长期留存请拷到仓库外。C 后端想看生成源码用 `--build-keep-c`。

:::

::: details 提示找不到 `go` 命令

```text
未找到 go 命令; AOT 构建需要 Go 工具链 (https://go.dev/dl/)
```

安装 Go 1.26+ 并确认 `go version` 在 `PATH` 里可用。`go build` 超时上限为 1800 秒，超时报 `go build 超时`。

:::

::: details 交叉编译很慢

Go 后端首次为目标平台构建需要重新编译 Go 标准库，1–2 分钟属正常（`tests/test_aot.py` 也因此默认只跑本机构建，交叉编译用例需 `CODECIN_AOT_TESTS=1` 才启用）；C 后端交叉编译通常快得多。

:::

## 与其它路径的关系

| 对比 | `.sdgcc` | AOT 产物 | `--native` (cincc) |
| --- | --- | --- | --- |
| 运行需要 | Python + codecin-native 动态库 | 无 (独立可执行文件) | 无 (机器码) |
| 输入形态 | UCBC 字节码容器 | C/Go 编译产物或内嵌字节码 | cincc 直出机器码 |
| 适用 | 开发期反复运行、反汇编检查 | 分发用户程序、完整宿主能力 | 分发子集程序、追求不经字节码 |
| 体积 | 几十 KB 级 (含元数据/源码清单) | C 后端几百 KB；Go 后端约 3.4–6.6 MiB | 几十 KB 级 |

Go 后端产物里的引擎与动态库原生路径共享同一套 Go 运行时（`codecin/native/engine`
的寄存器、内存、栈、SYS 与宿主能力），因此文件/进程/音频/画布/Termux/网络在 AOT
产物里同样可用，且不依赖 Python——唯一例外是无 cgo 下的 FFI（见[上节](#静态构建与-ffi)）。
C 后端是独立实现的 C 运行时, 只覆盖其 SYS 白名单; `cincc` 又是另一套独立后端,
覆盖更小的子集。执行语义见 [执行路径](/guide/execution-paths)。

## 相关页面

- [二进制格式](/runtime/formats)——VM 后端内嵌的 UCBC 字节码、`.sdgcc` 与内存段表格式
- [Go 原生运行时](/runtime/native)——被内嵌的 Go 引擎、`cincc` 与宿主能力
- [Python 嵌入 API](/reference/python-api)——`codecin.aot.build_program()` 与 `codecin.object` 的编程接口
- [命令行参考](/guide/cli)——`--build-exe` / `--build-target` / `--build-backend` / `--emit-object` / `--link`
- [常见问题 (FAQ)](/guide/faq)
