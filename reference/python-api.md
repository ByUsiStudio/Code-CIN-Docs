---
description: "把 Code CIN 当作 Python 库使用: 包导出、Config 全部字段、CPU 构造与运行、异常层次、原生库/AOT/CROM/反汇编/统计入口。"
---

# Python 嵌入 API

Code CIN 除了命令行工具, 也可以直接当作 Python 库嵌入到自己的程序里: 构造一个
`Config`, 交给 `CPU`, 调用 `run()` 一次性执行。v5.9.0 起是 **native-only 单引擎**:
整份字节码一次调用交给 Go 原生引擎 (`codecin_run_v2`), 不再有逐条解释 / JIT /
单步调试路径。整条工具链 (汇编器、CIN 编译器、Go 原生 VM 桥接、CROM 读写、AOT、
反汇编、统计) 都是公开可调用的。

本页所有签名均以当前源码为准: 包导出见 `codecin/__init__.py`, 配置字段见
`codecin/config.py`, 运行时见 `codecin/cpu.py`。

## 顶层导出

`from codecin import ...` 可以拿到下面这些名字 (即 `codecin.__all__`, 见
`codecin/__init__.py`):

| 名称 | 类型 | 说明 |
|------|------|------|
| `CPU` | class | CPU 核心: 加载程序、一次性原生执行、状态查看 |
| `Config` | dataclass | 运行配置, 全部字段见下表 |
| `Opcode` | `enum.Enum` | 112 条指令的枚举, 值即 UCBC 编码 |
| `Constants` | class | 常量集合: 寄存器数/`OPCODE_NAMES`/`ARG_COUNTS`/`OPCODE_NAME_TO_ENUM`/`PL_KEYWORDS` 等 |
| `Syscall` | `enum.IntEnum` | SYS 功能号 0–157 (含 FFI 140–144 与网络 145–157) |
| `CPUSimulatorError` | exception | 所有 Code CIN 错误的基类 |
| `AssemblerError` | exception | 汇编阶段 (`.pl` / `.asm`) 错误 |
| `CompilerError` | exception | CIN 编译阶段错误 |
| `ExecutionError` | exception | 指令执行阶段错误 |
| `MemoryAccessError` | exception | 内存越界 / 保护违例 |
| `__version__` | str | 版本号单一真源 (`"x.y.z"`) |

```python
import codecin
from codecin import CPU, Config, Opcode, Constants, Syscall

print(codecin.__version__)            # 打印版本号
print(len(list(Opcode)))              # 112
print(Constants.OPCODE_NAMES[Opcode.SYS])   # 'SYS'
print(Syscall.ALLOCFRAME)             # 137
```

其余子系统需要按模块导入 (它们都是包的公开模块, 只是不在顶层短名单里):

```python
from codecin import (native, aot, crom, disasm, stats, memory, registers,
                     version)
from codecin.cin import CINCompiler
from codecin.assembler import Assembler
```

## `Config` 全字段

`Config` 是一个 `@dataclass` (`codecin/config.py`), 所有字段都有默认值, 因此
`Config()` 就是"命令行什么都不传"的行为。`CPU` **不会**替你调用
`Config.validate()` —— 需要夹取取值范围时自己调一次。

| 字段 | 类型 | 默认值 | 含义 |
|------|------|--------|------|
| `mem_size` | `int` | `1 << 30` | 逻辑内存字节数 (默认 1 GiB, 稀疏分页按需提交); `validate()` 夹到 `[256, 1 TiB]` |
| `auto_save_crom` | `bool` | `False` | `run()` 结束后自动保存同名 `.crom` 镜像 |
| `max_instructions` | `int` | `100_000_000` | 指令数上限, 超出按失败处理; `< 1` 抬到 `1` |
| `sandbox_mode` | `bool` | `False` | 沙箱模式: 只放行 ALLOCFRAME / TIMEUS / TIMENS 等核心系统调用 |
| `log_level` | `str` | `'INFO'` | `DEBUG` / `INFO` / `WARNING` / `ERROR` |
| `log_file` | `Optional[str]` | `None` | 日志文件路径 (非空则同时写入文件) |
| `strict_mode` | `bool` | `False` | 汇编器严格模式 |
| `output_file` | `Optional[str]` | `None` | `.bin` / `.crom` 输出路径 |
| `optimize` | `int` | `0` | 优化级别 0–3 (夹取) |
| `compress_crom` | `bool` | `True` | `.crom` 是否 zlib 压缩 |
| `compile_to_bin` | `bool` | `False` | 编译为 `.bin` 后继续执行 |
| `compile_only` | `bool` | `False` | 只编译不执行 |
| `seed` | `Optional[int]` | `None` | SYS RAND 确定性种子 (`None` / `0` = 随机) |
| `bounds_check` | `bool` | `False` | CIN 定长数组越界检查 (编译期注入, 与原生引擎兼容) |
| `program_args` | `List[str]` | `[]` | 传给 CIN 程序的参数 (`arg_count()` / `arg(i)` 的数据源) |

`Config.validate()` 会把越界值夹回合法区间: `mem_size < 256 → 256`、
`mem_size > 1 TiB → 1 TiB`、`max_instructions < 1 → 1`、`optimize` 夹到 `0..3`。

```python
from codecin import CPU, Config

cfg = Config(
    max_instructions=5_000_000,
    seed=1234,                 # 确定性 rand()
    log_level='ERROR',
    program_args=['--input', 'data.txt'],
)
cfg.validate()
cpu = CPU(cfg, 'program.cin')
cpu.run()
print('failed =', cpu.execution_failed)
```

::: tip 嵌入式场景的注意事项
建议 `log_level='ERROR'`, 避免 rich 表格污染你自己的 stdout。需要捕获程序输出时,
把 `cpu._capture_output` 置 `True`, 结果会收进 `cpu.output_buffer` (见下)。
默认 1 GiB 内存是稀疏分页的, 不必为嵌入式场景刻意调小 `mem_size`。
:::

## `CPU` 构造与方法

```python
CPU(config: Config,
    filename: Optional[str] = None,
    crom_file: Optional[str] = None,
    from_bin: bool = False,
    console: Optional[Console] = None)
```

| 参数 | 说明 |
|------|------|
| `config` | 运行配置, 必填 |
| `filename` | 程序路径。按扩展名分派: `.cin` → CIN 编译器, `.bin` / `from_bin=True` → UCBC 字节码, `.pl` / `.asm` → 汇编器 |
| `crom_file` | 汇编路径下要预加载的 `.crom` 内存镜像; 传 `None` 时会尝试同名 `.crom` |
| `from_bin` | 强制按 `.bin` 解释 `filename` (扩展名不是 `.bin` 时也有用) |
| `console` | 自定义 `codecin.console.Console`; 默认新建一个 |

构造时如果 `filename` 非空, 会立即调用 `load_program()` 完成加载。也可以在
`filename=None` 构造空 CPU, 然后手工灌入指令 (测试辅助 `tests/helpers.py: new_cpu()`
就是这么做的)。

### 方法

v5.9.0 起执行是**一次性**的: `run()` 把整份字节码交给 Go 原生引擎, 结束后把
寄存器 / 标志位 / 指针 / 脏内存段同步回 Python 侧对象。不再提供逐条
`step()` / `execute()`、断点与交互调试会话。

| 方法 | 说明 |
|------|------|
| `load_program(filename, crom_file=None, from_bin=False)` | 重新加载程序; 文件不存在抛 `CPUSimulatorError` |
| `run()` | 装载好的程序一次性交给原生引擎执行; 内部捕获异常并置 `execution_failed` |
| `display_state(title='CPU State', ...)` | 渲染寄存器/内存/栈状态面板 |

### 实例状态 (嵌入式最常读的几个)

| 属性 | 说明 |
|------|------|
| `pc` / `sp` / `heap_ptr` / `heap_base` | 程序计数器 / 栈指针 / 堆指针 / 堆基址 |
| `regs` | `RegisterFile`, 读 `cpu.regs.read(n)`, 全量 `cpu.regs.get_all()` |
| `vec_regs` | `VectorRegisterFile`, `read_vector(n)` / `get_all()` |
| `pstate` | `{'N': bool, 'Z': bool, 'C': bool, 'V': bool}` |
| `memory` | `FastMemory` 实例 (4 KiB 稀疏分页, `resident_bytes` 给出常驻字节数) |
| `stats` | `Statistics` 实例, 见下文 |
| `instructions` / `labels` / `data_labels` / `entry_pc` | 已加载的程序与符号表 |
| `input_buffer` / `_input_pos` | 程序读入内容的缓冲 (`read()` 内建的数据源) |
| `output_buffer` / `_capture_output` | 输出重定向缓冲 (见下) |
| `native_engine` / `native_used` | 原生引擎实例与本次执行是否真的走了 Go 原生 VM |
| `execution_failed` | 执行期是否发生过错误 (CLI 用它决定退出码) |

```python
from codecin import CPU, Config

cpu = CPU(Config(log_level='ERROR'), 'examples/control_flow.cin')
cpu._capture_output = True          # 把 OUT / SYS 打印收进 output_buffer
cpu.run()
text = ''.join(cpu.output_buffer)
print(text)
print('pc=0x%x sp=0x%x failed=%s native=%s'
      % (cpu.pc, cpu.sp, cpu.execution_failed, cpu.native_used))
```

::: warning `run()` 不抛异常
`CPU.run()` 内部 `try/except` 掉所有 `Exception`, 写日志并置
`execution_failed = True`。**判断成功要看 `cpu.execution_failed`**, 而不是等异常。
真的需要异常请直接调用底层模块 (见下文 `codecin.native`) —— 原生引擎返回
错误状态时, 桥接层会抛 `ExecutionError`。
:::

::: danger 原生库缺失时没有回退
v5.9.0 起 native-only: 找不到/加载不了 Go 原生库时, `run()` 直接报错并给出
重建提示 (NATIVE_HINT), **不会**回退到 Python 解释器。构建方法见
[Go 原生运行时](/runtime/native)。
:::

## 异常层次

```
Exception
└── CPUSimulatorError                 # 基类: message + detail
    ├── AssemblerError                # 附加 line / line_num / filename
    ├── CompilerError                 # 附加 line_num / filename
    ├── ExecutionError                # 除零、未实现指令、栈溢出、SYS 未知号
    └── MemoryAccessError             # 越界 / 保护违例
```

| 异常 | 触发条件 |
|------|----------|
| `CPUSimulatorError` | 文件不存在、`.crom` 头非法、版本或校验和不符、字节码 magic 错误 |
| `AssemblerError` | 汇编语法错误、未定义标签/符号、操作数个数不符; 消息形如 `file:line: Assembler error: <原文> -- <详情>` |
| `CompilerError` | CIN 词法/语法/语义错误 (如 `Unknown function`、参数过少、非恒定 `case`) |
| `ExecutionError` | `Division by zero`、`Stack overflow (collides with heap)`、`Heap exhausted: …`、`instruction limit reached (N steps)`、原生引擎回传的运行期错误 |
| `MemoryAccessError` | 地址越界、对只读页写入、保护位不允许该访问 |

```python
from codecin import CPU, Config
from codecin.errors import (
    CPUSimulatorError, ExecutionError, MemoryAccessError,
)

try:
    cpu = CPU(Config(log_level='ERROR'), 'prog.cin')
    cpu.memory.set_protection(0x1000, 'r')   # 制造只读页
    cpu.memory.write_qword(0x1000, 1)
except MemoryAccessError as e:
    print('访问违例:', e)
except CPUSimulatorError as e:
    print('其它 Code CIN 错误:', e.message, e.detail)
```

## 版本与环境: `codecin.version`

`codecin/version.py` 把版本号从"一个字符串"升级为可编程、可自检的设施。
**唯一真源始终是 `codecin/__init__.py` 的 `__version__`**，本模块只做解析、比较与探测。
`version` 是包的公开子模块，但**不在** `codecin.__all__` 里（顶层短名单只导出 `CPU` /
`Config` 等），用 `from codecin import version` 或 `import codecin.version` 导入。

| 接口 | 说明 |
|------|------|
| `current_version()` | 返回 `__version__` 字符串（每次动态读取） |
| `version_info()` | 当前版本的 `(major, minor, patch)`；非 `x.y.z` 抛 `VersionError` |
| `version_tuple(text)` | 解析任意版本串为整数三元组（纯函数，允许 `v` 前缀与 `-` / `+` 后缀） |
| `try_version_tuple(text)` | 同上但失败返回 `None`（不抛异常） |
| `is_version_string(text)` | 是否是合法版本串（与 `version_tuple` 接受的形式一致） |
| `compare(a, b)` | 只比较 `x.y.z` 三段数值，返回 `-1` / `0` / `1`；任一入参非法抛 `VersionError` |
| `build_info()` | 运行环境字典，**永不抛异常** |
| `build_info_json(info=None)` | 渲染成可 `json.loads` 的 JSON 字符串 |
| `format_build_info(info=None)` | 渲染成可读的多行纯文本（无 ANSI, 便于重定向/贴报告） |
| `VersionError` | `version_tuple()` / `version_info()` 解析失败时抛出（`ValueError` 子类） |

`build_info()` 的字段:

| 字段 | 类型 | 说明 |
|------|------|------|
| `version` | str | 当前版本 |
| `version_info` | list[int] \| None | 解析结果（解析不了就是 `None`） |
| `python` / `python_implementation` | str | 解释器版本 / 实现名 |
| `platform` | str | `"<sys.platform>/<machine>"` 形式（本机为 `win32/AMD64`） |
| `system` / `machine` | str | `platform.system()` / `platform.machine()`（如 `Windows` / `AMD64`） |
| `native` | bool | 原生库是否**可用**（v5.9.0 起不可用即无法执行程序） |
| `native_version` | str \| None | 原生库自报版本串原文 |
| `native_path` | str \| None | 实际加载的库文件路径 |
| `native_version_matches` | bool \| None | 自报串是否包含包版本；无法判定为 `None` |
| `package_path` | str | 包目录 |
| `executable` | str | 当前解释器可执行文件 |

```python
from codecin import version

info = version.build_info()          # 原生库缺失/加载失败也会正常返回
print(info['native'], info['native_version_matches'])

# 判断"原生库是否需要重建"
if info['native_version_matches'] is False:
    print('原生库版本与包不一致, 建议重新构建')
```

::: tip 发布流程
`python script/bump_version.py x.y.z` 会一次性改真源 → 重新生成 Go 侧
`engine/version_gen.go` → 在 `CHANGELOG.md` 插入新版本小节骨架，**先校验后落盘**、任一步
失败按字节备份回滚（自检失败时 Go 生成物可能已更新，脚本会提示）；加 `--dry-run` 可先预演，
`--date` / `--root` 可指定小节日期与目标仓库副本。仓库里有测试强制 `CHANGELOG.md` 必须出现
当前版本号，所以"提了版本但忘写更新日志"会在 CI 上失败。
:::

## Go 原生库: `codecin.native`

`codecin/native.py` 是 ctypes 桥接层。库文件按
`codecin/native/` → 包目录 的顺序查找, 先试带平台/架构后缀的 Release 资产名
(`libcodecin_native-linux-x64.so` / `libcodecin_native-win-amd64.dll`), 再试通用名
(`libcodecin_native.so` / `.dll` / `.dylib`); 也支持环境变量 `CODECIN_NATIVE_LIB`
强制指定。

| 接口 | 说明 |
|------|------|
| `get_engine(logger=None) -> Optional[NativeEngine]` | 查找并加载原生库; 失败返回 `None` (结果被缓存, 只尝试一次) |
| `NativeEngine.version()` | 库自报版本字符串, 如 `codecin-native <版本> (Go)` |
| `NativeEngine.run_v2(bytecode, segments, entry, sp, heap_base, mem_size, ...)` | ABI v2 整程序执行, 返回结果字典 (见下) |
| `NativeEngine.crom_pack(mem, compress)` / `crom_unpack(data)` | CROM 打包/解包 |
| `encode_program(instructions, entry=0, labels=None) -> bytes` | 指令元组列表 → UCBC 字节码 (`labels` 把 `('label', name)` 操作数解析为立即数) |
| `decode_program(data) -> (instructions, entry)` | UCBC 字节码 → 指令元组列表 |

### `run_v2` 详解

```python
run_v2(bytecode: bytes,
       segments,                     # List[Tuple[int, bytes]]: 初始内存段
       entry: int, sp: int, heap_base: int, mem_size: int,
       input_data: bytes = b'',      # 程序 stdin
       max_steps: int = 0,           # 0 = 不限
       args: Optional[List[str]] = None,   # arg_count()/arg(i) 数据源
       seed: Optional[int] = None,   # SYS RAND 种子
       sandbox: bool = False,        # 沙箱标志
       ) -> Optional[Dict[str, Any]]
```

返回字典 (底层通信失败返回 `None`):

| 键 | 说明 |
|----|------|
| `status` | `0` OK / `1` Done (两者均为正常结束) / `2` 未实现指令 / `3` 运行期错误 |
| `flags` | `{'N', 'Z', 'C', 'V'}` |
| `pc` / `sp` / `heap_ptr` | 结束时的指针 |
| `steps` | 已执行指令数 |
| `regs` | 33 个 `u64` (x0–x31 + sp/fp 等) |
| `vec_regs` | 32 × 4 个 `f64` |
| `segments` | `List[(addr, bytes)]` 脏内存段 (引擎按 64 KiB 页合并) |
| `output` | 程序全部 stdout (str) |
| `error` | `status` 为 `2` / `3` 时的错误文本, 否则 `None` |

`CPU.run()` 拿到结果后由 `_apply_native_state()` 同步: 寄存器/向量/标志位/指针写回,
脏段 `write_block` 进稀疏内存, `steps` 一次性批量记入统计。

```python
from codecin import native

engine = native.get_engine()
if engine is None:
    raise SystemExit('原生库未加载: 请先构建 (codecin/native/build.ps1 / build.sh)')
print('native version:', engine.version())

# 手工编码并执行一个小程序
prog = [
    ('MOV', [('reg', 0), ('imm', 21)]),
    ('ADD', [('reg', 0), ('imm', 21)]),
    ('HALT', []),
]
bc = native.encode_program(prog, entry=0)
mem_size = 1 << 30
res = engine.run_v2(bytecode=bc, segments=[], entry=0,
                    sp=(mem_size - 8) & ~0x7, heap_base=mem_size // 2,
                    mem_size=mem_size, max_steps=10_000)
print(res['status'], res['regs'][0])   # 正常结束, x0 = 42
```

::: tip 内存布局公式
`sp` 初值 = `(mem_size - 8) & ~0x7` (栈向下增长), `heap_base` = `mem_size // 2`
(堆向上增长)。与 [寄存器与内存模型](/reference/registers-memory) 的区域表一致。
:::

## AOT: `codecin.aot`

`codecin/aot.py` 把 CIN 程序编译成**独立静态可执行文件** (内嵌 UCBC 字节码与初始
内存段文件, 由内置 Go VM 执行, 运行时不需要 Python / Go / 动态库)。它只负责编排,
真正的入口 shell 是与 Go 侧共用的 `codecin/native/aot/stub_main.go.txt`。
构建强制 `CGO_ENABLED=0`, 因此 cgo 实现的 FFI 在 AOT 产物内调用会得到运行期错误
(详见 [AOT 独立可执行文件](/runtime/aot))。

| 接口 | 签名要点 |
|------|----------|
| `build_program(program_file, out=None, target=None, keep_temp=False, mem_size=None, logger=None) -> str` | 由 `.cin` 源文件一键构建, 返回产物绝对路径 |
| `build(bytecode, seg_file, out, target=None, keep_temp=False, logger=None) -> str` | 底层入口, 直接吃字节码与段文件 (`pack_seg_file` 的产物) |
| `pack_seg_file(mem_size, sp, heap_base, segs) -> bytes` | 打包初始内存段 + 布局参数为 `program.segs` 段文件 |
| `program_dependencies(program_file) -> List[str]` | 依赖闭包 (含自身, 去重保序) |
| `host_target() -> str` | 当前平台的 `os/arch` |
| `parse_target(target) -> (goos, goarch)` | 解析/校验目标三元组 |
| `supported_targets() -> List[str]` | 常用交叉编译目标列表 |
| `sweep_stale_build_dirs(...)` | 清理过期临时构建目录 (默认 > 6 小时) |
| `AotError` | 构建失败 (非 `CPUSimulatorError` 子类) |

```python
from codecin import aot

print(aot.host_target())                  # 例如 'windows/amd64'
print(aot.supported_targets())            # ['windows/amd64', 'linux/arm64', ...]

exe = aot.build_program('examples/control_flow.cin',
                        out='demo', target='linux/amd64')
print('产物:', exe)                        # 绝对路径; Windows 目标自动补 .exe
```

`build_program` 会先做依赖完整性检查 (缺失或循环 → `AotError`), 再把全部依赖在编译期
展开嵌入产物, 所以产物运行时不读取任何 `.cin`。交叉编译需要本机 Go 工具链。
详见 [AOT 独立可执行文件](/runtime/aot)。

## CROM 与 `.bin`: `codecin.crom`

| 接口 | 说明 |
|------|------|
| `save_crom(memory, path, compress=True, logger=None)` | 把 `FastMemory` 写成 **CROM v4** 段式镜像 (只存已分配页; 有原生库时走 Go 打包, 否则 zlib) |
| `load_crom(memory, path, logger=None)` | 读回镜像, 自动识别 CROM v4 (段式) 与 v3 (旧全量, 只读兼容) |
| `save_bin(cpu, path, logger=None)` | 把 CPU 的指令 + 内存镜像写成 **BIN v3** 容器 |
| `load_bin(cpu, path)` | 读回 `.bin` (v3, 亦可读 v2), 重建 `instructions` / `pc` / `sp` |

```python
from codecin import CPU, Config, crom

cfg = Config(log_level='ERROR')
cpu = CPU(cfg, 'examples/control_flow.cin')
cpu.run()

crom.save_crom(cpu.memory, 'snapshot.crom', compress=True)
crom.save_bin(cpu, 'snapshot.bin')

# 读回 CROM 到一个新 CPU
cpu2 = CPU(Config(log_level='ERROR'))
crom.load_crom(cpu2.memory, 'snapshot.crom')

# 读回 .bin (直接当作程序加载也可以: CPU(cfg, 'snapshot.bin'))
cpu3 = CPU(Config(log_level='ERROR'))
crom.load_bin(cpu3, 'snapshot.bin')
print(len(cpu3.instructions), hex(cpu3.pc))
```

格式细节 (段式头布局、flags、CRC32) 见 [二进制格式](/runtime/formats)。

## 反汇编: `codecin.disasm`

`disassemble_file()` 接受两种输入: CPUSA 容器 (`.bin`, `--compile-only` 的产物) 或
裸 UCBC 段, 返回按行拆分的文本清单 (`List[str]`)。

```python
from codecin import crom, disasm
from codecin import CPU, Config

cpu = CPU(Config(), 'examples/control_flow.cin')
crom.save_bin(cpu, 'prog.bin')

for line in disasm.disassemble_file('prog.bin')[:12]:
    print(line)
```

同模块还导出 `disassemble_bytes(data)` (直接吃 `bytes`) 与容器解析辅助
`_extract_from_cpusa(data)` / `_extract_from_bin_v3(data)` / `_extract_from_bin_v2(data)`
(返回 `(bytecode, mem_size, entry, sp)` 或 `None`)。命令行等价物是
`codecin prog.bin --disasm`, 见 [命令行参考](/guide/cli)。

## 统计: `codecin.stats`

`CPU.stats` 是一个 `Statistics` 实例。注意原生 VM 路径**不按指令逐个记账**
(整程序执行完毕一次性批量写入), 所以 `opcode_count` 是空的, 只有总数可靠。

| 成员 | 说明 |
|------|------|
| `instruction_count` | 已执行指令总数 |
| `opcode_count` | `defaultdict(int)`, 各助记符执行次数 (原生路径为空) |
| `execution_time` | `start()` / `stop()` 之间的墙钟秒数 |
| `memory_reads` / `memory_writes` | 内存读写次数 |
| `get_hot_instructions(top_n=10)` | 最热的指令列表 (原生路径只有 `'?'` 一项) |
| `inst_profiler` | `InstructionProfiler`: 指令周期表, `get_total_cycles()` |
| `performance_counters` | `PerformanceCounters`: `get_ipc()` / `get_stats()` 给出 IPC / 分支准确率等 |
| `display_summary(console=None, cache_stats=None, native_used=True)` | 渲染统计表 (`cache_stats` 为兼容保留的透传参数) |

```python
from codecin import CPU, Config

cpu = CPU(Config(log_level='ERROR'))
cpu.run()
print('instructions =', cpu.stats.instruction_count)
print('exec time    = %.4fs' % cpu.stats.execution_time)
print('perf         =', cpu.stats.performance_counters.get_stats())
cpu.stats.display_summary(cpu.console, native_used=cpu.native_used)
```

## 相关页面

- [寄存器与内存模型](/reference/registers-memory) — 寄存器/内存/栈帧约定
- [指令集编码表](/reference/isa) — `Opcode` 枚举的完整编码
- [执行路径](/guide/execution-paths) — native-only 单引擎的数据流与装载格式
- [Go 原生运行时](/runtime/native) — ABI v2、原生库查找顺序与重建
- [二进制格式 (.bin/.crom)](/runtime/formats) — UCBC 与 CROM v4 布局
- [内存模型与运行时开关](/tools/memory-cache) — 稀疏分页与 `--mem-size` 等
- [命令行参考](/guide/cli) — 与 `Config` 字段一一对应的 CLI 选项
