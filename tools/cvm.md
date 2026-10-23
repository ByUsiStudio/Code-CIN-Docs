---
description: cvm 虚拟机与 .cvm 模块格式：构建、校验、运行、模块路径；CPU 仅作为内部执行核。
---

# cvm：虚拟机 (JVM 风格)

v6.2.0 起，对外运行时概念是 **CVM (Code CIN Virtual Machine)**。
`CPU` 仍然存在，但只作为内部的寄存器/内存/指令执行核，不再是用户工具。

## `.cvm` 模块

```
app.cvm (zip)
├── CVM-INF/MANIFEST.TOML
├── code/program.bin          # UCBC BIN v3
└── META-INF/SHA256SUMS
```

`MANIFEST.TOML` 示例：

```toml
[cvm]
format = 1
engine = "codecin-native"
abi = 2
generator = "cvm 6.2.0"

[module]
name = "hello"
version = "1.0.0"
main = "hello"
created = "2026-10-23T10:00:00+00:00"

[build]
source = "src/main.cin"
optimize = 0
mem_size = 1073741824
bin_version = 3
```

## 构建

```bash
cvm build src/main.cin -o hello.cvm --name hello --module-version 1.0.0
cvm build . -o app.cvm              # 含 mkn.toml 的项目目录
cvm build program.bin -o app.cvm    # 包装已有字节码
```

- `.cin/.asm/.pl` 会先编译为 BIN v3；
- 含 `mkn.toml` 的项目会先调用 `mkn build`（自动解析依赖）；
- 库项目（无 `main`）不能构建 `.cvm`，请用 `mkn package` 分发源码/对象。

## 运行

```bash
cvm run hello.cvm
cvm run hello.cvm -- arg1 arg2
cvm run hello                       # 从模块路径解析
```

可用 `--mem-size`、`--max-instructions`、`--sandbox` 控制运行时。

## 校验与查看

```bash
cvm verify hello.cvm     # 校验清单、校验和、字节码 magic/版本
cvm inspect hello.cvm    # 查看模块清单
cvm inspect hello.cvm --json
```

模块中任一字节被篡改，`verify`/`run` 都会失败。

## 模块路径

类似 `CLASSPATH`：

1. `CVM_MODULE_PATH`（`os.pathsep` 分隔）；
2. `$CVM_HOME/modules`（默认 `~/.cvm/modules`）。

```bash
cvm install hello.cvm     # 安装到 $CVM_HOME/modules/hello/<version>.cvm
cvm which hello           # 打印解析到的路径
cvm list                  # 列出模块路径中的模块
cvm env                   # 引擎、ABI、平台、模块路径
```

## 与 JVM 的差异

- 模块内是已编译的 UCBC 字节码，不是可跨版本演进的 class 文件；
- 模块间不做运行期符号解析：CIN 的跨模块依赖在 `mkn/pic` 构建期已展开；
- CVM 负责装载、校验、模块路径与执行，编译仍由 CIN 编译器完成。

## Python API

```python
from codecin.cvm import CVM, build_module, run_module

path = build_module('src/main.cin', 'app.cvm', name='app', version='1.0.0')
runtime = CVM()
module = runtime.load('app.cvm')
cpu = runtime.run(module, ['arg1'])
```
