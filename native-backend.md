# Code CIN 原生后端现状（交接文档）

## 1. 架构

```
CIN 源码
  ├─(默认) Python 编译器 ──► .sdgcc 容器（CODE 段 = BIN v3）──► VM / Go native
  └─(--native) cincc (Go) ──► 目标机器码 ──► ELF / (AArch64 骨架)
```

- **Python 只负责 CLI 与日志**：`codecin --native` / `mkn build --native`
  通过 `subprocess` 调用 `cincc`（`CODECIN_CINCC` 可覆盖路径）。
- `cincc` 前端复用 `codecin/native/compiler`（Go），产出 `ir.Program`；
  后端 `codecin/native/mc` 把 IR 直接编码成机器码，**不经过 C、不经过 UCBC**。

## 2. 构建与使用

```bash
cd codecin/native && go build -o cincc ./cmd/cincc

# 单文件
cincc -o hello hello.cin
# 多文件（import 闭包）
cincc -o app main.cin
# AArch64（仅结构校验）
cincc -target aarch64-linux -o app.arm64 main.cin
```

Python 入口：

```bash
codecin hello.cin --native            # 编译并运行（Windows 上自动经 WSL）
codecin hello.cin --native-out app    # 只产出二进制
mkn build --native                    # 多文件工程
```

## 3. x86-64 后端能力（WSL 实跑验证）

| 分类 | 内容 |
|---|---|
| 数据搬运 | `MOV`（imm / reg-reg）、`LD/SD`（mem 基址+偏移） |
| 算术 | `ADD/SUB/MUL/DIV/MOD/ADDI/INC/DEC`、`AND/OR/XOR`、位运算 |
| 控制流 | `CMP`、`JMP`、`JZ/JNZ`、条件分支 `B`（EQ/NE/LT/LE/GT/GE） |
| 函数 | `CALL/RET`（原生栈）、`PUSH/POP`（VM 栈）、实参传递 |
| 内存模型 | 入口 `mmap` 1 GiB 匿名内存（基址 `r15`）；`R32` 为 VM 栈指针；bump `malloc`（堆顶 `dataBase+0x480`） |
| 输出 | `OUT`（字符串/换行）、`SYS 22` ITOA、`SYS 23` FTOA、`SYS 24` PRINT_STR、`SYS 26` BOOLSTR |
| 字符串 | `SYS 16` strlen、`17` strcmp、`25` strcat、`28` substr、`29` indexof、`30/31` upper/lower、`35` atoi、`36/37/38` trim |
| 时间/随机 | `SYS 15` time、`13/14` rand/srand（xorshift64）、`91` time_ms、`92` sleep_ms |
| 文件 | `SYS 51` read、`52` write、`54` exists、`55` delete、`56` size、`57` mkdir |
| 目录/环境 | `SYS 63` os_name、`66` cwd、`89` temp_dir、`90` chdir |
| 网络 | `SYS 147` TCP dial、`148` send、`149` recv、`150` close；`153` UDP open、`154` sendto、`155` recvfrom、`156` close |

## 4. 未实现

| 项 | 原因 |
|---|---|
| Windows PE 直出 | 需要 PE 头 + 导入表 + Win64 ABI，尚未实现 |
| AArch64 运行验证 | WSL 无 `qemu-aarch64`，`sudo` 需密码；当前仅结构校验 |
| GUI / 音频 / 画布 | 需 X11/ALSA/窗口系统，纯机器码后端成本高 |
| HTTP / DNS | 可在 TCP 基础上实现，未做 |
| 删除自带指令集（阶段 2） | **破坏性**：`.asm`/BIN/`.crom`/Go AOT 后端/内部 opcode IR，需确认 |

## 5. 测试

```bash
cd codecin/native && go test ./mc
python -m pytest tests/test_nativegen.py tests/test_cli.py \
    tests/test_v620_mkn.py tests/test_version.py tests/test_sdgcc.py
```

网络用例依赖 WSL 内的 Python echo 服务器；端口被占用时需先清理残留进程。

## 6. 已知踩坑记录

| 现象 | 根因 |
|---|---|
| 字符串全空 | 数据拷贝 `rep movsb` 源/目标寄存器写反 |
| 循环不跳转 | ZF 标志字节与 `JZ/JNZ` 极性弄反 |
| 程序段错误 | `Encode` 在首个 `HALT` 提前返回，`CALL main` 跳到偏移 0 |
| `println(42)` 崩溃 | fixup 位置记录在操作码之前，回填把 `0F 85` 覆写了 |
| 裁剪无效 | `emitMalloc` 破坏 `rcx` 中的长度 |
| UDP 收不到包 | IPv4 解析累加器是 `eax`，却清零了 `r8d` |
