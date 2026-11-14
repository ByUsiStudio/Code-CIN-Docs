# Code CIN 后续更新目标（Roadmap）

> 起点：7.22.10 收尾发布（2026-11-07）
> 主线方向：**CIN → Go 编译器 → 目标机器码**，Python 只保留 CLI 与日志。
> 本文按版本节奏组织，每个阶段都给出可验收的完成定义（DoD）。

---

## 0. 总体节奏

| 版本 | 主题 | 关键结果 |
|---|---|---|
| **7.23.0** | 机器码后端补齐 | Windows PE 直出；AArch64 可运行；剩余常用 syscall |
| **7.24.0** | 移除自带指令集（阶段 2） | 删除 `.asm`/BIN/UCBC/`.crom`/VM 执行层，仅保留 `.sdgcc` 兼容读取 |
| **8.0.0** | 编译器统一到 Go（阶段 3） | 删除 Python 编译器与内部 IR，Python 只剩 CLI/日志 |
| 8.x | 运行时扩展 | GUI / 音频 / 画布 / HTTP / DNS / 更多平台 |

---

## 0.1 8.0.x 本轮能力补强（2026-11 已实现）

| 能力 | 用法 | 行为 |
|---|---|---|
| 通用系统调用 | `syscall(nr, a0..a4)` / `syscall_str(nr, ...)` | 运行期按 **ISA SYS 号**直接分派宿主能力, 不做平台封装; 平台差异与参数适配完全交给用户源码 |
| 相对路径通配导入 | `import "./src/*.cin"` | 按路径排序展开并去重, 仅收录 `.cin`; 多文件项目不必逐条维护 import |
| 平台专用源码 | `foo_win.cin` / `foo_linux.cin` / `foo_macos.cin` / `foo_android.cin` | 导入 `foo.cin` 时优先选当前平台文件, 缺失则回退 `foo.cin`; `CIN_TARGET_PLATFORM` 可覆盖 |

边界与约定:

- `syscall()` 依赖运行期分派, 默认 Go 引擎（含沙箱/VM）可用;
  `--native`（cincc 机器码后端）与 C AOT 后端会明确报错, 不静默降级。
- 平台后缀按**编译期平台**选择: Windows → `win`, Linux → `linux`,
  macOS → `macos`, Android/Termux → `android`（Termux 优先于 linux）。
- 通配支持 `*` / `?`; `*` 展开时排除其它平台专用文件, 当前平台专用文件
  优先于同名基础文件, 结果按路径排序。

---

## 1. 现状基线（7.22.10）

**已完成**

- `.sdgcc` 默认产物，兼容读取 BIN v3；`cvm` 读 `mkn.toml` 多文件。
- `cincc`（Go）直出 x86-64 ELF，覆盖：控制台、字符串全套、数组/struct/全局、
  分支与循环、函数与实参、多文件 `import`、`malloc`、时间/随机/休眠、
  文件与目录、TCP、UDP。
- Python `codecin --native`、`mkn build --native` 均调用 `cincc`。
- 测试：Python 91 项、`go test ./mc`、`go vet` 全绿。

**未完成（本文目标）**

- 未移除自带指令集；Windows PE 未做；AArch64 仅骨架（无 qemu 验证）；
  GUI/音频/画布/HTTP/DNS 未做。

**代码足迹（用于估算删除/迁移工作量）**

| 文件 | 行数 | 去向 |
|---|---:|---|
| `codecin/assembler.py` | 556 | 阶段 2 删除 |
| `codecin/disasm.py` | 120 | 阶段 2 删除 |
| `codecin/aot.py` | 879 | 阶段 2 删除（改由 `cincc` 承担） |
| `codecin/cvm.py` | 607 | 阶段 2 改造（只保留 `.sdgcc` 读取） |
| `codecin/sdgcc.py` | 395 | 保留（容器） |
| `codecin/cin.py` | 3794 | 阶段 3 迁移到 Go 后删除 |
| `codecin/cbackend.py` | 2783 | 阶段 2 删除（VM→C 过渡管线） |
| `codecin/nativegen.py` | 718 | 阶段 2 删除（已 LEGACY） |
| `codecin/native/`（Go） | ~16 500 | 保留并扩展 |

---

## 2. 7.23.0 — 机器码后端补齐

### 2.1 Windows PE 直出（P0）

- **目标**：`cincc -target x86_64-windows` 产出可直接在 Windows 运行的 `.exe`。
- **要点**：PE32+ 头、`.text/.rdata/.data` 节、导入表（`kernel32`：
  `WriteFile`/`ReadFile`/`ExitProcess`/`GetStdHandle`）、Win64 ABI
  （`rcx/rdx/r8/r9`，32 字节 shadow space）。
- **DoD**：
  - `cincc -target x86_64-windows -o hi.exe hi.cin` → 本机直接运行输出 `hi`；
  - `println(42)`、`if/while`、`file_*` 至少各有 1 条本机运行测试；
  - Python CLI 在 `--build-target windows/amd64` 下自动选择该后端。

### 2.2 AArch64 可运行（P0）

- **目标**：把 AArch64 骨架补到与 x86-64 同等覆盖面（`CALL/RET/PUSH/POP`、
  `SYS 137/24/22/16/17/20/25`、`mmap` 内存模型）。
- **前置**：需要 `qemu-aarch64`（WSL 内无，且 `sudo` 需密码）。
  **决策点 D1**：安装 qemu / 提供静态二进制 / 仅在 CI 容器验证。
- **DoD**：`hello`、`add(2,3)`、`while` 三个程序在 qemu 下输出与 x86-64 一致。

### 2.3 剩余 syscall（P1）

| SYS | 名称 | 实现要点 |
|---|---|---|
| 61 | GETENV | 读 `/proc/self/environ` 并查找键 |
| 64/65/67 | HOSTNAME/USERNAME/HOMEDIR | `uname` / `getpwuid` 等价信息 |
| 58 | DIRLIST | `getdents64` 遍历 |
| 84/85 | FILECOPY/FILEMOVE | 读→写→（可选）`unlink` |
| 86/87/88 | DIRREMOVE/ISDIR/MTIME | `rmdir` / `stat` |
| 59/60 | EXEC/EXECOUTPUT | `fork`+`execve`+`pipe` |
| 97/98 | HTTPGET/HTTPPOST | TCP 基础 + 手写请求/响应解析 |
| 157 | DNSLOOKUP | `getaddrinfo` 不可用，需手写 DNS 报文或读 `/etc/hosts` |

- **DoD**：每项至少 1 条真实环境测试（不允许仅"能编译"）。

### 2.4 质量（P1）

- 网络测试改为**随机端口 + 重试 + 失败清理**（当前固定端口曾被残留进程占用）。
- `go test ./mc` 增加"指令编码字节快照"测试（防止寄存器/操作码回归）。
- CI：Windows（本机跑 PE）+ WSL（跑 ELF）双流水线。

---

## 3. 7.24.0 — 移除自带指令集（阶段 2，破坏性）

### 3.1 删除范围

| 对象 | 处理 |
|---|---|
| `.asm` 汇编源码支持 | 删除解析与执行路径 |
| `assembler.py` / `disasm.py` | 删除 |
| BIN v3 / UCBC 写出 | 删除；**读取保留**（兼容旧产物） |
| `.crom` | 删除 |
| Go AOT 后端（`codecin/native/aot`） | 删除 |
| `cbackend.py`（VM→C） | 删除 |
| `nativegen.py` | 删除 |
| VM 执行引擎（`codecin/native/engine`） | 保留只读 `.sdgcc` 兼容层，其余删除 |
| `aot.py` | 删除，`--build-exe` 改走 `cincc` |

### 3.2 兼容策略

- `.sdgcc` 的 `CODE` 段继续按 BIN v3 字节解释（旧文件可读）；
- 旧 `.bin`/`.crom` 文件：给出明确升级提示（`codecin migrate` 子命令）。

### 3.3 DoD

- 全仓不再出现 UCPU 指令集作为执行层（只有 `.sdgcc` 数据格式向后兼容）；
- `grep` 校验：无 `assembler`/`disasm`/`cbackend`/`UCBC` 写路径；
- 全量测试（含旧产物读取）通过；
- CHANGELOG 标注 **BREAKING**，附迁移指南。

---

## 4. 8.0.0 — 编译器统一到 Go（阶段 3）

- **目标**：删除 `cin.py`（Python 编译器），CLI 全量走 `cincc`。
- **前置**：`cincc` 的语言面 = 现 Python 编译器（含全部标准库特性）。
- **步骤**：
  1. `codecin`（无 `--native`）也调用 `cincc`，产出 `.sdgcc` 或直接可执行；
  2. 保留 `sdgcc.py` 作为容器读写库（或迁到 Go）；
  3. 删除 `cin.py`、`cbackend.py` 残留、`nativegen.py`；
  4. Python 仅剩 `cli.py`、`logging`、`mkn.py`（工程管理）。
- **DoD**：Python 代码行数下降 > 60%；全链路测试只用 `cincc`。

---

## 5. 8.x — 运行时扩展

| 目标 | 说明 |
|---|---|
| GUI | 需平台后端：Win32 / X11；GUI 状态放进程内句柄表 |
| 音频 | ALSA/PulseAudio（Linux）、WASAPI（Windows） |
| 画布 | 软件光栅（无需 GPU）+ 可选 PNG 写出 |
| 多平台 | arm32 / riscv64 后端（复用 IR，新增编码器） |
| 包管理 | `mkn` 依赖解析 + 预编译 `.sdgcc` 缓存 |

---

## 6. 决策点（需要产品/架构确认）

| 编号 | 问题 | 建议 |
|---|---|---|
| D1 | AArch64 运行验证手段（qemu 安装权限） | 允许安装 `qemu-user-static` |
| D2 | 阶段 2 是否保留 VM 只读兼容层 | 保留一个版本周期，8.0 再删 |
| D3 | `.asm` 用户是否需要迁移工具 | 提供 `codecin migrate` 提示即可 |
| D4 | GUI/音频是否进入纯机器码后端 | 建议：机器码后端只做 syscall 封装，GUI 逻辑留在 CIN 标准库 |

---

## 7. 里程碑看板

### 7.23.0

- [x] Windows PE 后端骨架（MOV/算术/CALL/RET/HALT 已验证退出码）
- [ ] PE 控制台输出（WriteFile 调用返回失败，需 WinDbg/最小复现定位）
- [ ] AArch64 覆盖面补齐 + qemu 验证
- [ ] GETENV / DIRLIST / FILECOPY / ISDIR / MTIME
- [ ] HTTP GET/POST
- [ ] 网络测试随机端口 + 重试
- [ ] CI 双平台（Windows PE + WSL ELF）

### 7.24.0

- [ ] 删除 `assembler.py` / `disasm.py` / `aot.py` / `cbackend.py` / `nativegen.py`
- [ ] 删除 BIN/UCBC 写出与 `.crom`
- [ ] `.sdgcc` 只读兼容层 + `codecin migrate`
- [ ] CHANGELOG BREAKING + 迁移指南

### 8.0.0

- [ ] `cincc` 覆盖 Python 编译器全部语言面
- [ ] 删除 `cin.py`
- [ ] Python 只剩 CLI / 日志 / 工程管理

### 8.x

- [x] 通用系统调用 `syscall()` / `syscall_str()`（运行期 SYS 号分派）
- [x] 相对路径 `*` 通配导入
- [x] `foo_(win|linux|macos|android).cin` 平台专用源码
- [ ] GUI / 音频 / 画布
- [ ] arm32 / riscv64 后端
- [ ] 依赖缓存

---

## 8. 验收原则（所有阶段通用）

1. **能跑才算完成**：每个能力必须有真实执行测试（WSL/Windows/qemu），
   不接受"能编译"。
2. **失败要吵**：不支持的特性必须明确报错，不允许静默降级或产出会崩溃的二进制。
3. **文档同步**：CHANGELOG 记录行为变化；`docs/` 更新能力矩阵。
4. **版本纪律**：`codecin/__init__.py` 与 `version_gen.go` 单一来源同步，
   release 前跑 `tests/test_version.py`。
