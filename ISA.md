# Code CIN 指令集参考

> 操作码表由 `python script/gen_isa_docs.py` 从 `codecin/isa.py` 自动生成, 请勿手工编辑。
> 「SYS 功能号」一节为**手工维护**, 与 `codecin/isa.py: Syscall` 同步
> (Go 端常量 `codecin/native/engine/isa_gen.go` / `compiler/syscalls.go` 由
> `python script/gen_native_isa.py` 自动生成, 勿手工改动)。

## 总览

- 指令总数: **112** (Opcode 0..111)
- 分组: Base: 28 | ARM64: 40 | FP: 10 | Vector: 6 | RISC-V: 27 | SYS: 1

| 分组 | 数量 | 范围 | 说明 |
|------|------|------|------|
| Base ISA | 28 | 0..27 | 基础指令集: 数据传输/算术/逻辑/控制/栈/IO |
| ARM64 扩展 | 40 | 28..67 | ARM64 风格: 条件/移位/加载存储/分支/位操作 (WFE/WFI/SEV 无事件模型, 语义等同 NOP) |
| FP 浮点扩展 | 10 | 68..77 | IEEE-754 单精度浮点运算与转换 |
| Vector 向量扩展 | 6 | 78..83 | 4-lane 向量算术与加载存储 |
| RISC-V 扩展 | 27 | 84..110 | RV64I 风格: 加载存储/立即数/分支/跳转 |
| SYS 宿主调用 | 1 | 111..111 | 宿主系统调用 (CIN 内建函数/浮点支撑) |

## 执行模型 (v5.9.0 native-only)

全部程序由 **Go 原生引擎**统一执行: Python 侧完成编译/装载
(`.cin` / `.asm` / `.pl` / `.bin` / `.crom`), 通过 ABI v2 (`codecin_run_v2`)
一次调用把字节码、段式内存与输入交给原生 VM, 结束后回传寄存器、向量、NZCV
标志、脏内存段与程序输出。纯 Python 解释器与 JIT 已整体删除, 没有解释器回退;
原生库缺失或缺少 `codecin_run_v2` 导出 (版本不匹配) 时抛 `CPUSimulatorError`,
并附重建指引 (`codecin/native/build.ps1` / `build.sh`)。

## Base ISA (28 条)

| 助记符 | 编码 | 助记符 | 编码 | 助记符 | 编码 |
|--------|------|--------|------|--------|------|
| `MOV` | 0 | `LOAD` | 1 | `STORE` | 2 |
| `ADD` | 3 | `SUB` | 4 | `MUL` | 5 |
| `DIV` | 6 | `AND` | 7 | `OR` | 8 |
| `XOR` | 9 | `SHL` | 10 | `SHR` | 11 |
| `INC` | 12 | `DEC` | 13 | `CMP` | 14 |
| `JMP` | 15 | `JZ` | 16 | `JNZ` | 17 |
| `JE` | 18 | `JL` | 19 | `JG` | 20 |
| `PUSH` | 21 | `POP` | 22 | `CALL` | 23 |
| `RET` | 24 | `IN` | 25 | `OUT` | 26 |
| `HALT` | 27 |  |  |  |  |

## ARM64 扩展 (40 条)

| 助记符 | 编码 | 助记符 | 编码 | 助记符 | 编码 |
|--------|------|--------|------|--------|------|
| `ADDS` | 28 | `SUBS` | 29 | `ADDC` | 30 |
| `SUBC` | 31 | `LSL` | 32 | `LSR` | 33 |
| `ASR` | 34 | `ROR` | 35 | `MVN` | 36 |
| `EOR` | 37 | `BIC` | 38 | `ORN` | 39 |
| `LDR` | 40 | `STR` | 41 | `LDP` | 42 |
| `STP` | 43 | `CBZ` | 44 | `CBNZ` | 45 |
| `TBZ` | 46 | `TBNZ` | 47 | `B` | 48 |
| `BL` | 49 | `BR` | 50 | `NOP` | 51 |
| `WFE` | 52 | `WFI` | 53 | `SEV` | 54 |
| `CSEL` | 55 | `CSINC` | 56 | `CSINV` | 57 |
| `CSNEG` | 58 | `SXTB` | 59 | `SXTH` | 60 |
| `SXTW` | 61 | `UXTB` | 62 | `UXTH` | 63 |
| `CLZ` | 64 | `CLS` | 65 | `RBIT` | 66 |
| `REV` | 67 |  |  |  |  |

## FP 浮点扩展 (10 条)

| 助记符 | 编码 | 助记符 | 编码 | 助记符 | 编码 |
|--------|------|--------|------|--------|------|
| `FADD` | 68 | `FSUB` | 69 | `FMUL` | 70 |
| `FDIV` | 71 | `FCMP` | 72 | `FCVT` | 73 |
| `FABS` | 74 | `FNEG` | 75 | `LDRS` | 76 |
| `STRS` | 77 |  |  |  |  |

## Vector 向量扩展 (6 条)

| 助记符 | 编码 | 助记符 | 编码 | 助记符 | 编码 |
|--------|------|--------|------|--------|------|
| `VADD` | 78 | `VSUB` | 79 | `VMUL` | 80 |
| `VDIV` | 81 | `VLD1` | 82 | `VST1` | 83 |

## RISC-V 扩展 (27 条)

| 助记符 | 编码 | 助记符 | 编码 | 助记符 | 编码 |
|--------|------|--------|------|--------|------|
| `LB` | 84 | `LH` | 85 | `LW` | 86 |
| `LD` | 87 | `SB` | 88 | `SH` | 89 |
| `SW` | 90 | `SD` | 91 | `ADDI` | 92 |
| `SLTI` | 93 | `SLTIU` | 94 | `XORI` | 95 |
| `ORI` | 96 | `ANDI` | 97 | `SLLI` | 98 |
| `SRLI` | 99 | `SRAI` | 100 | `BEQ` | 101 |
| `BNE` | 102 | `BLT` | 103 | `BGE` | 104 |
| `BLTU` | 105 | `BGEU` | 106 | `JALR` | 107 |
| `JAL` | 108 | `LUI` | 109 | `AUIPC` | 110 |

## SYS 宿主调用 (1 条)

| 助记符 | 编码 | 助记符 | 编码 | 助记符 | 编码 |
|--------|------|--------|------|--------|------|
| `SYS` | 111 |  |  |  |  |

---

## SYS 功能号 (Syscall 0..157)

`SYS` 指令按 `X0` (功能号约定见各组注释, 实际传参以 `codecin/isa.py` 与
`codecin/cin.py: HOST_BUILTINS` 为准) 携带的功能号分派。参数经 X0-X2 (整数)
传递, 浮点参数/结果以 float64 位模式存于 X0/X1, 返回值写入 X0。
下表为手工维护的功能号总表:

### 浮点 / 数学 / 字符串基础 (0..38)

| 编号 | 名称 | 编号 | 名称 | 编号 | 名称 |
|------|------|------|------|------|------|
| 0 | `SQRT` | 1 | `POW` | 2 | `ABS` |
| 3 | `SIN` | 4 | `COS` | 5 | `TAN` |
| 6 | `FADD` | 7 | `FSUB` | 8 | `FMUL` |
| 9 | `FDIV` | 10 | `FCMP` | 11 | `FTOI` |
| 12 | `ITOF` | 13 | `RAND` | 14 | `SRAND` |
| 15 | `TIME` | 16 | `STRLEN` | 17 | `STRCMP` |
| 18 | `STRCPY` | 19 | `STRCAT` | 20 | `MALLOC` |
| 21 | `PRINT_FLOAT` | 22 | `ITOA` | 23 | `FTOA` |
| 24 | `PRINT_STR` | 25 | `STR_CONCAT` | 26 | `BOOL_STR` |
| 27 | `ABORT` | 28 | `SUBSTR` | 29 | `INDEXOF` |
| 30 | `TOUPPER` | 31 | `TOLOWER` | 32 | `FLOOR` |
| 33 | `CEIL` | 34 | `ROUND` | 35 | `ATOI` |
| 36 | `TRIM` | 37 | `LTRIM` | 38 | `RTRIM` |

### 联网音频 (39..42)

| 编号 | 名称 | 编号 | 名称 |
|------|------|------|------|
| 39 | `AUDIOPLAY` | 40 | `AUDIOSTOP` |
| 41 | `AUDIOVOL` | 42 | `AUDIOWAIT` |

### 2D 绘图画布 (43..50)

| 编号 | 名称 | 编号 | 名称 |
|------|------|------|------|
| 43 | `CANVASNEW` | 44 | `CANVASSET` |
| 45 | `CANVASRECT` | 46 | `CANVASCIRC` |
| 47 | `CANVASTEXT` | 48 | `CANVASLINE` |
| 49 | `CANVASSAVE` | 50 | `CANVASSHOW` |

### 系统原生交互 (51..67)

| 编号 | 名称 | 编号 | 名称 | 编号 | 名称 |
|------|------|------|------|------|------|
| 51 | `FILEREAD` | 52 | `FILEWRITE` | 53 | `FILEAPPEND` |
| 54 | `FILEEXISTS` | 55 | `FILEDELETE` | 56 | `FILESIZE` |
| 57 | `MKDIR` | 58 | `DIRLIST` | 59 | `EXEC` |
| 60 | `EXECOUTPUT` | 61 | `GETENV` | 62 | `SETENV` |
| 63 | `OSNAME` | 64 | `HOSTNAME` | 65 | `USERNAME` |
| 66 | `CWD` | 67 | `HOMEDIR` |  |  |

### Termux API (68..79)

| 编号 | 名称 | 编号 | 名称 | 编号 | 名称 |
|------|------|------|------|------|------|
| 68 | `TERMUXAVAIL` | 69 | `TERMUXNOTIFY` | 70 | `TERMUXTOAST` |
| 71 | `TERMUXCLIPGET` | 72 | `TERMUXCLIPSET` | 73 | `TERMUXBATTERY` |
| 74 | `TERMUXVIBRATE` | 75 | `TERMUXTTS` | 76 | `TERMUXLOCATION` |
| 77 | `TERMUXWIFI` | 78 | `TERMUXDIALOG` | 79 | `TERMUXSMS` |

### 路径与文件系统扩展 (80..90)

| 编号 | 名称 | 编号 | 名称 | 编号 | 名称 |
|------|------|------|------|------|------|
| 80 | `PATHJOIN` | 81 | `PATHBASENAME` | 82 | `PATHDIRNAME` |
| 83 | `PATHABS` | 84 | `FILECOPY` | 85 | `FILEMOVE` |
| 86 | `DIRREMOVE` | 87 | `ISDIR` | 88 | `FILEMTIME` |
| 89 | `TEMPDIR` | 90 | `CHDIR` |  |  |

### 时间与系统信息 (91..96)

| 编号 | 名称 | 编号 | 名称 |
|------|------|------|------|
| 91 | `TIMEMS` | 92 | `SLEEPMS` |
| 93 | `CPUCOUNT` | 94 | `ARCHNAME` |
| 95 | `MEMINFO` | 96 | `ISANDROID` |

### 网络 HTTP (97..99)

| 编号 | 名称 | 编号 | 名称 |
|------|------|------|------|
| 97 | `HTTPGET` | 98 | `HTTPPOST` |
| 99 | `DOWNLOAD` |  |  |

### 编码与哈希 (100..102)

| 编号 | 名称 | 编号 | 名称 |
|------|------|------|------|
| 100 | `SHA256` | 101 | `BASE64ENC` |
| 102 | `BASE64DEC` |  |  |

### 桌面集成 (103..106)

| 编号 | 名称 | 编号 | 名称 |
|------|------|------|------|
| 103 | `CLIPGET` | 104 | `CLIPSET` |
| 105 | `NOTIFY` | 106 | `OPENURL` |

### Android / Termux 扩展 (107..115)

| 编号 | 名称 | 编号 | 名称 | 编号 | 名称 |
|------|------|------|------|------|------|
| 107 | `ANDROIDINTENT` | 108 | `TERMUXCALL` | 109 | `TERMUXSHARE` |
| 110 | `TERMUXTORCH` | 111 | `TERMUXVOLUME` | 112 | `TERMUXBRIGHT` |
| 113 | `TERMUXCAMERA` | 114 | `TERMUXFINGER` | 115 | `TERMUXSENSOR` |

### 键盘输入监听 (116..118)

| 编号 | 名称 | 编号 | 名称 |
|------|------|------|------|
| 116 | `KEYHIT` | 117 | `KEYGET` |
| 118 | `KEYFLUSH` |  |  |

### GUI 窗口 / 鼠标 / 本地音频扩展 (119..128)

| 编号 | 名称 | 编号 | 名称 | 编号 | 名称 |
|------|------|------|------|------|------|
| 119 | `GUINEW` | 120 | `GUIUPDATE` | 121 | `GUICLOSE` |
| 122 | `GUICLOSED` | 123 | `MOUSEX` | 124 | `MOUSEY` |
| 125 | `MOUSEBTN` | 126 | `AUDIOPOS` | 127 | `AUDIOBEEP` |
| 128 | `GUIACTIVE` |  |  |  |  |

### 命令行参数 / 行输入 (129..131)

| 编号 | 名称 | 编号 | 名称 |
|------|------|------|------|
| 129 | `ARGC` | 130 | `ARGV` |
| 131 | `READLINE` |  |  |

### 音频控制增强 (132..136)

| 编号 | 名称 | 编号 | 名称 |
|------|------|------|------|
| 132 | `AUDIODUR` | 133 | `AUDIOPLAYING` |
| 134 | `AUDIOPAUSE` | 135 | `AUDIORESUME` |
| 136 | `AUDIOLEVEL` |  |  |

### 核心 VM 机制 (137..139, 沙箱模式仅放行这一组)

| 编号 | 名称 | 说明 |
|------|------|------|
| 137 | `ALLOCFRAME` | `alloc_frame(x0=字节数)`: SP -= x0; 低于堆警戒线则中止 |
| 138 | `TIMEUS` | `time_us()`: 单调微秒计时 (高精度基准测试) |
| 139 | `TIMENS` | `time_ns()`: 单调纳秒计时 (time_us 的高分辨率版本) |

### FFI 动态库调用 (140..144, 标准库 `lib/ffi.cin`)

| 编号 | 名称 | 说明 |
|------|------|------|
| 140 | `DLOPEN` | `dlopen(x0=路径)` -> 库句柄 (失败 -1) |
| 141 | `DLSYM` | `dlsym(x0=句柄, x1=符号名)` -> 函数句柄 (失败 -1) |
| 142 | `FFICALL` | `ffi_call(句柄, 参数缓冲, 参数个数)` -> int64 (最多 8 个 int64 参数) |
| 143 | `FFICALLF` | `ffi_callf(...)`: 同上, 返回值按 float64 位模式写入 X0 (浮点参数走 XMM) |
| 144 | `LIBCLOSE` | `lib_close(x0=库句柄)` -> 0 成功 / -1 失败 |

### 网络扩展 (145..157, 标准库 `lib/net.cin`)

| 编号 | 名称 | 说明 |
|------|------|------|
| 145 | `HTTPREQ` | `http_req(method, url, headers, body)` -> 响应体 (新堆字符串) |
| 146 | `HTTPCODE` | `http_code()`: 最近一次 http_req/http_get/http_post 的状态码 (无请求 -1) |
| 147 | `TCPDIAL` | `tcp_dial(host, port)` -> 连接句柄 (失败 -1) |
| 148 | `TCPSEND` | `tcp_send(句柄, 数据, 长度)` -> 已发送字节 |
| 149 | `TCPRECV` | `tcp_recv(句柄, 缓冲, 最大字节)` -> 实际字节数 (EOF 0) |
| 150 | `TCPCLOSE` | `tcp_close(句柄)` -> 0 成功 / -1 失败 |
| 151 | `TCPLISTEN` | `tcp_listen(port)` -> 监听句柄 (失败 -1) |
| 152 | `TCPACCEPT` | `tcp_accept(监听句柄)` -> 连接句柄 (失败 -1) |
| 153 | `UDPOPEN` | `udp_open(port, 0=系统分配)` -> 套接字句柄 (失败 -1) |
| 154 | `UDPSENDTO` | `udp_sendto(句柄, host, port, 数据, 长度)` -> 已发送字节 (偏好 IPv4) |
| 155 | `UDPRECVFROM` | `udp_recvfrom(句柄, 缓冲, 最大字节, 来源缓冲)` -> 实际字节数, 来源 "ip:port" |
| 156 | `UDPCLOSE` | `udp_close(句柄)` -> 0 成功 / -1 失败 |
| 157 | `DNSLOOKUP` | `dns_lookup(域名)` -> 首个 IP 地址 (新堆字符串; 失败为空串) |

### 沙箱模式

`--sandbox` 下只放行核心 VM 机制一组 (137 `ALLOCFRAME` / 138 `TIMEUS` /
139 `TIMENS`); 其余宿主 SYS 一律报
`Host capability disabled in sandbox mode (SYS <n>)`。

---
*操作码表由 `script/gen_isa_docs.py` 从 `codecin/isa.py` 生成;
SYS 功能号表手工维护, 与 `codecin/isa.py: Syscall` 同步。*
