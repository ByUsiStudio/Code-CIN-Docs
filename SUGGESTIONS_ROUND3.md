---
description: "Code CIN 第三轮优化与缺陷审查报告：struct 聚合初始化与存储模型、const 命名常量、字符串 +=、exit()，以及本轮新发现的问题清单（含实测证据与修复状态）。"
---

# Code CIN (UCPU) 更新建议 — 第三轮

> 审查对象：`D:\ByUsi\Projects\UCPU`
> 审查环境：Windows / Python 3.14.6 / Go 1.26.5，本机沙箱（workspace-write）
> 方式：先读语言文档与编译器实现建立「文档承诺」清单，再写探针程序对**解释器**与
> **Go 原生 VM** 两条路径逐条实测；每条结论都附可复现命令或字节码证据。
> 上一轮报告见 [`SUGGESTIONS_NEXT.md`](SUGGESTIONS_NEXT.md)（面向 5.4.x），本轮**不重复**
> 其条目，只报新发现的问题，并记录本轮已落地的修复。

::: warning 状态标记
下表与各节中的 **「本轮已修复」** 表示本仓库当前工作区已改并已有回归测试；
**「仅报告」** 表示已实测确认、本轮未改，留待决策。所有「同上」的判断都由
`tests/test_aggregate_and_const.py`（99 个用例，覆盖 interp / native / JIT）固化。
:::

---

## 0. 摘要：先看这 16 条

| # | 问题 | 影响 | 状态 |
|---|------|------|------|
| R3-1 | `P p = {3, 4}` 聚合初始化写穿指针槽，第 2 个字面量落到 `FP+0`，**覆盖保存的帧指针** | 静默内存破坏 + 返回值垃圾 | **本轮已修复** |
| R3-2 | `P ps[3]` 的成员访问把「值内嵌」的元素槽当指针解引用 → `ps[0].y = 1` 写到**绝对地址 8** | 静默破坏数据段（字符串字面量住那里） | **本轮已修复** |
| R3-3 | `P p = {1,2,3}`（字段不足）解释器越界写返回 65536，原生 VM 抛 `ExecutionError` | **同一程序两条路径结论不同** | **本轮已修复**（改为编译期报错） |
| R3-4 | 全局 `P o = {3, 4}` 覆盖对象指针槽 | 静默读到地址垃圾 | **本轮已修复** |
| R3-5 | struct **整体赋值 / 声明即初始化**是指针别名，而 `structs.md` 承诺「值拷贝，之后互不影响」 | 文档承诺 ≠ 实际行为，静默串改 | **本轮已修复**（见 §2） |
| R3-6 | 嵌套 struct 字段只按 **1 槽**推进偏移 → `struct Out { In i; int c }` 的 `c` 压在 `i.b` 上 | 静默字段覆盖 | **本轮已修复** |
| R3-7 | 局部固长数组**不是**全零（栈帧复用），而 `types.md` 把它列进「可靠：全零」 | 文档承诺 ≠ 实际行为 | **本轮已修复**（改文档，见 §5.1） |
| R3-8 | `main()` 的返回值不进入进程退出码，但 `stdlib/reference.md` 写「可直接 `return t_report()` 作为 `main` 的退出码」 | 两处文档互相矛盾，`test.cin` 文档用法空转 | **仅报告**（建议见 §5.2） |
| R3-9 | 纯 Python 路径的 `+` / `substr` / `indexof` 先做 UTF-8 解码，非法字节序列被替换成 U+FFFD | **同一程序两条路径结果不同**（实测 `strlen` 9 vs 3） | **本轮已修复**（见 §4） |
| R3-10 | `upper` / `lower` 实际是 **Unicode 感知**的，而 `builtins.md` 写「ASCII 大小写转换」 | 文档承诺 ≠ 实际行为（两路径一致，只是文档错） | **仅报告**（见 §5.5） |
| R3-11 | 受限环境下 `pytest` 的 `tmp_path` 不可用，导致 5 个用例在 setup 阶段 ERROR | 本机全量结果无法解释，容易掩盖真实缺陷 | **本轮已修复**（改用 `workdir`，见 §8.1） |
| R3-12 | 纯 Python 解释路径极慢：192×192 的 LCS 单次要 **79 s**，2 万次空循环 11.7 s | 标准库容量被迫从 192/256 降到 128/64；教学场景的 `O(n²)` 代码体感很差 | **仅报告**（见 §5.6） |
| R3-13 | `for (P q : ps)` 的循环变量是**别名**，而 C/C++ 里它是一次值拷贝 | 与刚统一的「整体赋值 = 值拷贝」不一致 | **仅报告**（见 §5.8） |
| R3-14 | 用户自定义函数与内建/宿主内建**同名时永远不会被调用**，两条路径结论还不同 | 用户意图被静默忽略 + 路径分歧 | **本轮已修复**（见 §4.2） |
| R3-15 | struct 形参**不做类型检查**：把 `float` 传给 `fr_equals(Frac, Frac)` 能编译，运行期才越界 | 类型安全缺口，错误推迟到运行期且信息难懂 | **仅报告**（见 §5.10） |
| R3-16 | `string` 以 NUL 结尾，**无法包含字节 0**；`strlen("\x00\x01\x02")` 实测 **0** | 与"字节语义"承诺存在缺口；导致新库 `codec.cin` 整张字节表退化为空串 | **仅报告**（见 §5.11） |

已修复的条目都同时覆盖了三条执行路径（interp / native / JIT），
回归护栏为 `tests/test_aggregate_and_const.py`（138 个用例）与原有测试。

## 0.1 本轮验证结果（证据）

| 项目 | 本轮结束时 | 会话开始时（同一台机器） |
|------|-----------|--------------------------|
| `python -m pytest -q` | **1034 passed / 3 failed / 49 skipped** | 565 passed / 3 failed / 49 skipped / **5 errors** |
| `tests/test_aggregate_and_const.py`（新） | **138 passed**（interp / native / JIT） | — |
| `tests/test_struct_value_semantics.py`（新） | **194 用例**，与上者合计 314 passed | — |
| `python script/check_paths.py` | **6/6 passed**（三条路径逐字节一致） | 6/6 passed |
| `python script/gen_native_isa.py --check` | 三个生成文件 **up to date** | 通过 |
| `python script/gen_isa_docs.py --check` | ISA 文档 **up to date** | 通过 |
| `python -m ruff check codecin cpu.py script tests` | **All checks passed** | 通过 |
| `tests/test_version.py` | **30 passed** | 4 passed |

::: warning 仅剩的 3 个失败是环境限制，不是仓库缺陷
`tests/test_aot.py` 的 `test_build_host_executable`、`test_build_respects_error_exit_code`、
`test_cross_compile_linux_amd64_is_static` 都停在
`os.makedirs('codecin/native/.aotbuild-…')` 的 `PermissionError: [WinError 5]`，
**发生在调用 `go` 之前**（见 §8.3 的 Low integrity 根因）。
会话开始时是同样的 3 个失败 —— 本轮既没有引入也没有消除它们（无法在沙箱内消除）。
**会话开始时还有的 5 个 `tmp_path` ERROR 已在本轮清零**（见 §8.1）。
:::


---

## 1. P0 — struct 聚合初始化与存储模型（本轮已修复）

### R3-1 `P p = {3, 4}` 覆盖保存的帧指针 ⭐

**根因**：struct 变量的槽里存的是**堆对象指针**（`gen_function` 序言里 `MALLOC` 后写入），
但 `gen_decl` 对花括号初始化器走的是数组字面量那条路（`gen_init_1d_literal`），
它把「变量地址」当成对象基址直接 `SD`。

**字节码证据**（`struct P { int x; int y }`，`P p = {3, 4}`）：

```text
 6  MOV   x0, 16            ; 为对象分配 16 字节
 7  SYS   MALLOC(20)
 8  MOV   x2, x0
 9  ADDI  x0, x29, -8       ; x0 = &槽
10  SD    x2, [x0]          ; 槽 = 对象指针   <-- 正确
11  MOV   x0, 3             ; 字面量 3
12  MOV   x2, x0
13  ADDI  x0, x29, -8       ; 又是 &槽
14  SD    x2, [x0]          ; 槽被覆盖成 3   <-- 指针丢了
15  MOV   x0, 4
16  MOV   x2, x0
17  ADDI  x0, x29, -8
18  ADDI  x0, x0, 8         ; &槽 + 8 = FP + 0
19  SD    x2, [x0]          ; 用 4 覆盖保存的 x29 ! <-- 栈帧被破坏
```

**实测**：

| 路径 | `P p = {3,4}; return p.x*10+p.y` |
|------|----------------------------------|
| 解释器 | `0`（且 `p.x` 读出 4028704 之类的垃圾） |
| JIT | `0` |
| Go 原生 VM | `0` |
| 期望 | `34` |

**修复**：新增 `gen_init_struct_literal` / `gen_init_struct_array_literal` /
`_struct_literal_stores`，按 `_struct_leaf_slots()` 把初始化器逐字段写进**对象**，
并在字段数不匹配时报编译错误。全局 side 由 `_emit_struct_const_init` +
`emit_globals_init` 对称处理。

### R3-2 struct 数组成员访问写到绝对地址 0 / 8 ⭐

**根因**：`_gen_index` 对 struct 元素走的是「标量元素」分支，会 `LD` 元素槽取出**指针**；
但定长 struct 数组被 `_type_slots()` 算成 `n × 1` 槽（值内嵌），槽里根本没有指针。

**实测**（`P ps[2]`，两个字段）：

```cin
P ps[3]
ps[0].y = 111      // 实际写到 绝对地址 8
ps[1].x = 555      // 实际写到 绝对地址 0
```

后果不止是「读到错值」：**地址 0 与 8 正是数据段开头**，那里住着字符串字面量。
审查中用 `println` 观察时输出被写成 `+111555`、`d10020301002030100` —— 字面量被就地覆盖。
这类破坏完全静默，且三条路径**一致地**破坏（所以差分测试抓不到）。

**修复**：统一为「struct 值 = 堆对象指针」：`_alloc_struct_array_slots` /
`_layout_struct_array` 为每个元素分配对象并把指针写进各自的槽，成员访问语义因此自洽。

### R3-3 初始化器过多：解释器与原生 VM 结论不同 ⭐

```cin
struct P { int x }
function main() -> int { P p = {1, 2, 3}; return p.x }
```

| 路径 | 结果 |
|------|------|
| 解释器 | 返回 `65536`（越界写内存后返回残值，退出 0） |
| Go 原生 VM | `Execution Error: Address 0x10000 out of bounds`，退出 1 |

**修复**：改为编译期报错 `Too many initializers for struct P: got 3, expected at most 1`
（数组形式同理）。这条对整个项目意义最大：它把「两条路径不同」变成「一条路径直接拒绝」。

### R3-4 全局 struct 聚合字面量

```cin
struct P { int x; int y }
P o = {3, 4}
function main() -> int { return o.x * 10 + o.y }
```

| 路径 | 结果 |
|------|------|
| 修复前 | `43980465111040`（对象指针被字面量覆盖后当整数读） |
| 修复后 | `34` |

同类：全局 <span v-pre>`P ps[2] = {{1,2},{3,4}}`</span> 修复前返回 `6473924464345088`，修复后 `34`。

---

## 2. P0 — struct 整体赋值：文档承诺 ≠ 实际行为（本轮已修复 R3-5）

`docs/language/structs.md`「值语义：整体赋值、传参、返回」一节的原文表格是：

| 操作 | 文档承诺 | 修复前实测（解释器与原生 VM 一致） |
|---|---|---|
| 整体赋值 `P b = a` | **值拷贝**（逐槽复制），`b.x = 7` 不改 `a.x` | `P a={1,2}; P b=a; b.x=7` → `a.x == 7`（**别名**，应为 1） |
| 作为数组元素 | 值内嵌，`P ps[3]` 是 3 份完整 `P` | 字段读写互不干扰 ✔，但 `ps[1]=ps[0]; ps[1].x=9` → `ps[0].x == 9`（**别名**，应为 1） |
| 作为函数参数 | **引用可见**（同一块存储） | `a.x == 7` ✔ 与文档一致 |
| 作为数组参数元素 | 引用可见 | ✔ 与文档一致 |
| 作为返回值 | 值拷贝返回 | ✔ 每次调用为新对象 |

**关键结论：文档在这一点上内部是自洽的**——它把「整体赋值」定义为值拷贝、
把「传参」**刻意**定义为引用可见。真正不成立的是**整体赋值与数组元素赋值**那两行，
以及 `gen_decl` 里「声明即初始化」（`P b = a`）走的是同一条错误路径。

**影响**：这是「照着文档写、结果被静默串改」的典型；对教学语言尤其有害，
因为学生第一直觉就是文档里表格的第一行。

**修复**：把整体赋值（`gen_decl` 的初始化分支与 `_gen_assign`）实现为逐槽值拷贝，
**保持传参与数组参数元素的「引用可见」语义不变**（那是文档明确写出的行为）。
回归护栏见本轮新增的 `tests/test_struct_value_semantics.py`，
它同时断言「赋值是拷贝」与「传参是引用可见」。

::: tip 设计口径提醒
这种「赋值拷贝、传参引用」的组合不是 C 的语义（C 两者都是值拷贝），
所以文档里那句「值语义」的小标题容易误导。建议把该节标题改成
**「struct 的赋值、传参与返回」**，并在开头一句话点明这个组合。
:::

---

## 3. P1 — 嵌套 struct 与解析器缺陷（本轮已修复）

### R3-6 嵌套 struct 字段只按 1 槽推进

`_parse_struct` 用 `_type_slots(t)` 推进字段偏移，而 `_type_slots()` 对任何 struct
都返回 `1`（那是「变量槽里的 struct 值是指针」的语义，不是「字段值内嵌」的语义）。

```cin
struct In  { int a; int b }
struct Out { In i; int c }      // 修复前: c 的偏移 = 1, 与 i.b 重叠
```

**实测**：<span v-pre>`Out o = {{5,6},7}; return o.i.a*100+o.i.b*10+o.c`</span> → 修复前 `560`，修复后 `567`。

**修复**：新增 `_struct_slots(t, structs)`（嵌套 struct 按内层 `size_slots` 内嵌），
`_parse_struct` 改用它；嵌套 struct 若在字段位置**尚未定义**，现在给出明确错误
（`Struct field of unknown type 'I'; the nested struct must be defined before...`），
而不是静默按 1 槽算错。

### R3-7' 嵌套 struct 字段取值被当成指针解引用

`_gen_member` 只对**固长数组**字段返回「字段地址」，对 struct 字段会落到 `LD` 分支，
把内嵌对象的**前 8 字节当成指针**用。修复后 struct 字段与数组字段一样返回字段地址
（`_is_struct(ftype)` 分支）。这与 R3-6 是同一个「值内嵌 vs 指针」的语义混淆。

### R3-8' `parse_array_literal` 静默丢弃尾部平铺元素

```python
return rows if rows else current        # 旧实现
```

对 <span v-pre>`{{5, 6}, 7}`</span>：`rows = [[5,6]]`，而 `7` 被收进 `current` 后**整段丢掉**。
即 <span v-pre>`Out o = {{5,6}, 7}`</span> 里的 `7` 凭空消失，导致 `o.c` 保持 0。

修复：`rows` 非空时把 `current` 也作为一行追加（`[[5,6],[7]]`），
本轮的单元测试 `nested_array_literal_trailing` 固化该行为。

### R3-9' struct 数组字段：必须在编译期拒绝，而不是静默算错

`struct Bag { Point items[3] }` 这类字段（文档第 262 行标注「值内嵌」）在当前实现下
没有任何地方为元素分配对象，成员访问会解引用未初始化槽。本轮改为**编译期明确拒绝**：

```text
struct array field Bag.items is not supported (elements would need separate
objects); use a fixed array of struct variables instead
```

多维 struct 数组（`P ps[2][3]`）同理明确拒绝，不再静默按错误的步长算。
**建议后续决定**：要么实现「数组字段 = 对象指针数组 + 构造时逐个分配」，
要么把 `structs.md` 第 262 行从「支持」改成「不支持」。

---

## 4. P0 — 两处「同一程序两条路径结果不同」（本轮已修复）

### 4.1 R3-9 字符串字节语义：Python 路径的 UTF-8 解码造成分歧

**根因**：`codecin/memory.py` 的 `read_string()` 是
`bytes(chars).decode('utf-8', errors='replace')`。字符串内建里凡是「读出来再编码回去」的
实现，都会把**非法 UTF-8 字节序列**变成 U+FFFD（每个 3 字节）：

```python
# 修复前 codecin/cpu.py
elif call_id == Syscall.STR_CONCAT:
    sa = self.memory.read_string(x0)          # 有损解码
    sb = self.memory.read_string(x1)
    data = (sa + sb).encode('utf-8') + b'\x00'   # U+FFFD 被编成 EF BF BD
```

而 Go 侧 `vm.go` 的 `sysSUBSTR` 直接切 `[]byte`、`sysINDEXOF` 用 `strings.Index`
（字节下标）、`sysCONCAT` 直接拼字节。CIN 的 `strlen` / `substr` / `s[i]` 又都**明确是字节语义**，
所以 Python 侧的有损解码是缺陷。

**实测**（`"中"` 的 UTF-8 是 `E4 B8 AD`，从字节 1 或 2 处切片必然产生非法序列）：

| 程序 | 解释器 | 原生 VM | 结论 |
|------|--------|---------|------|
| `strlen(substr("中",2,1) + substr("中",1,1))` | `6` | `2` | **分歧** |
| `strlen(substr("中",1,2) + substr("中",2,1))` | `9` | `3` | **分歧** |
| `strlen("中")` | `3` | `3` | 一致（合法序列不受影响） |

**为什么这条特别要紧**：`substr(s, i, 1)` 切多字节字符的中间字节是**正常的字节级操作**，
而它恰好是分词/逐字节处理的标准手法——本轮新增的 `text.cin` / `token.cin` 就需要这样做。
写库的人只能绕开 `indexof`、手写逐字节匹配、并且"按连续同类段整段搬运"来规避它
（见 §6 的库实现说明）。也就是说：**这不是冷门角落，而是字节级字符串处理的地基。**

**修复**：`Memory` 新增 `read_cstr_bytes()`（不做解码，直接读原始字节），
`cpu.py` 的 `STR_CONCAT` / `SUBSTR` / `INDEXOF` 全部改用字节路径，
与 Go 侧逐字节对齐。回归：

```powershell
python .scratch\probe_utf8_divergence.py     # 修复后 4 个用例全部 SAME
python -m pytest tests/test_aggregate_and_const.py -q -k byte_semantics
python -m pytest tests/test_lib_text.py tests/test_lib_token.py -q -p no:cacheprovider
```

::: tip 顺带说明
`TOUPPER` / `TOLOWER` / `TRIM` 等**没有**改成字节语义：Go 侧用的是
`strings.ToUpper` / `strings.ToLower` / `strings.TrimSpace`（Unicode 感知），
Python 侧的 `str.upper()` / `str.strip()` 与它们行为一致，改反而会制造新的分歧。
这留下一个文档问题，见 §5.5。
:::

### 4.2 R3-14 用户函数与内建同名时被静默忽略，且两条路径结论不同 ⭐

**发现途径**：写 `path.cin` 时想提供 `path_join` / `path_basename` / `path_dirname`
（纯字符串版本，不依赖宿主能力），结果这三个名字**永远不会被调用**——
它们恰好是宿主能力内建名（`isa.py` 的 `PATHJOIN` / `PATHBASENAME` / `PATHDIRNAME`）。

**根因**：`CodeGen._gen_call` 的分派顺序是「内建/宿主内建 → … → 用户函数」，
用户函数在**最后**。所以任何与内建同名的用户函数都形同不存在。

**实测**（用户自己定义 `file_read`，让它返回 `"user"`）：

| 路径 | 结果 |
|------|------|
| `--no-native` | `Execution error: host builtins … require the native Go runtime` |
| 原生 VM | 静默调用**宿主**实现，返回宿主结果 |

即同一个程序：一条路径报错、另一条路径安静地做另一件事。
`user_path_join` 同样两条路径不一致（返回 2 而不是 1）。

**为什么这是 P0**：它同时踩中本项目两条红线——
"用户写的代码被静默忽略"和"同一程序两条路径结论不同"。
而且触发条件很自然：`path_*` / `file_*` / `exec` / `abs` / `strlen` 这些名字
都是写库或写示例时很容易撞上的。

**修复**：把**用户函数的分派提到 `_gen_call` 最前面**，
内建（含宿主能力内建）只在没有同名用户函数时才生效。
这与既有先例一致（`exit` 之前就用 `name not in self.functions` 做过同样的事，
本轮把它推广到全部内建）。

回归护栏：`tests/test_aggregate_and_const.py` 新增 `test_user_function_shadows_builtin`
（6 组用例 × interp/native/JIT），覆盖宿主内建名（`path_join`/`file_read`）、
普通内建名（`abs`/`strlen`/`atoi`）、以及"没有同名用户函数时内建仍然生效"的控制组。

::: warning 顺带的影响
`codecin/lib/path.cin` 因此把三个函数命名为
`path_str_join` / `path_str_basename` / `path_str_dirname`。
修复之后，即使改回 `path_join` 等原名也能正常工作；
是否改名由你决定（保留 `path_str_*` 更明确地表达"纯字符串、不碰宿主"）。
:::

---

## 5. P1 — 仅报告（本轮未改或只改文档，附建议）

### 5.1 R3-7 局部固长数组不是全零（本轮已改文档）

`docs/language/types.md` 的默认值表把它列为可靠：

| 位置 | 默认值 | 是否可靠 |
|---|---|---|
| 固长数组（全局或局部声明） | 全零 | 声明为固长数组即可靠 |

实测（先用同一栈槽塞满非零值，再在后续调用里读未初始化的局部数组）：

```cin
function dirty() -> int { int a[4]; a[0]=111; a[1]=222; a[2]=333; a[3]=444; return 0 }
function probe() -> int { int b[4]; return b[0]+b[1]+b[2]+b[3] }
function main()  -> int { dirty(); return probe() }
```

| 路径 | `probe()` 返回值 |
|------|------------------|
| 解释器 | `1110` |
| Go 原生 VM | `1110` |
| 文档承诺 | `0` |

局部**标量**的同类问题文档已经用 danger 提示写清了（`types.md` §默认值表下方的警告框），
**唯独局部数组被错列为可靠**。两条路建议二选一：

1. **改文档**（最小改动）：把「固长数组（全局或局部声明）」改成「全局：可靠全零；
   局部：**不可靠**，与局部标量同样读到栈帧残留值」，并把它并进已有的 danger 提示；
2. **改实现**：在 `gen_function` 序言里对局部固长数组发一段清零循环（不建议展开成
   逐槽 `SD`，`int a[600]` 会膨胀 600 条指令），代价是每次函数调用多一次循环开销。

本项目一向把「文档承诺 ≠ 实际行为」当硬伤，所以无论选哪条，都建议同轮把文档与实现对齐。

**本轮选择：改文档**（第 1 条）。已改 `docs/language/types.md` 与
`docs/language/variables.md`：把默认值表拆成「全局默认值 / 局部默认值」两列，
标明局部固长数组与局部标量都不可靠，并各给一个可复现的实测例子
（`dirty()` 填 `111/222/333/444` 后另一个函数读到 `1110`）。
**没有**改实现去清零局部数组，因为那要给每个函数序言加一段清零循环，
对 `int a[600]` 这类缓冲会明显增加指令数与调用开销——这个取舍留给你决定。

### 5.2 R3-8 `main()` 返回值不进入进程退出码，而标准库文档承诺它是

`codecin/cli.py` 的退出码只有三种来源：`execution_failed → 1`、参数错误 `→ 2`、
其余 `→ 0`（`cli.py` 末尾 `if getattr(cpu, 'execution_failed', False): return 1; return 0`）。

实测：

```powershell
Set-Content t.cin 'function main() -> int { return 3 }'
python cpu.py t.cin; Write-Output $LASTEXITCODE      # 0   <- 不是 3
Set-Content t2.cin 'function main() -> int { exit(4); return 0 }'
python cpu.py t2.cin; Write-Output $LASTEXITCODE     # 0   <- 不是 4
```

而 `docs/stdlib/reference.md`（`## test` 一节）写着：

> 结束时调用 `t_report()` 输出汇总并**返回失败数**，因此可直接 `return t_report()` 作为 `main` 的退出码。

**这是两处文档互相矛盾**：`docs/guide/cli.md` 的退出码表只承认 `0/1/2`，
`reference.md` 却让用户以为 `main` 的返回值就是退出码。
直接后果是 `test.cin` 的**推荐用法空转**：断言失败数被算出来、打印出来，却不会影响 CI。

**建议**（按代价从低到高）：

1. **只改文档**：把 `reference.md` 那句改成
   「`t_report()` 返回失败数；若要让 CI 感知失败，请自行在 `main` 里判断并调用
   `exit(1)`（或按项目约定的错误路径）」。同时把 `exit()` 的语义写进 `builtins.md`：
   **立即结束程序，进程退出码遵循 CLI 约定（0/1/2）**。
2. **让 `exit(code)` 进入退出码**（推荐，且与 R3-8' 一起做）：`exit(n)` 已降为
   `MOV x0, n; HALT`，只要在数据段放一个隐藏的「显式退出码」单元、
   由 `cli.py` 运行结束后读取，就能让 `exit(3)` → 进程退出码 3，
   而**完全不影响**不调用 `exit()` 的现有程序（回归风险最低）。
   注意 AOT 产物的 Go stub 也要读同一个单元，否则 `--build-exe` 产物与
   `cpu.py` 行为又会分叉。
3. 让 `main()` 的返回值直接成为退出码：语义最"正统"，但会改变所有现有脚本与
   `tests/test_cli.py` 的预期，属于破坏性变更，需要单独的版本说明。

本轮实现了 `exit(code)`（三路径一致地立即终止、`x0` 保留终止码），
**但没有改退出码传播**，因为那涉及 CLI 与 AOT 两侧的约定，属于需要你拍板的破坏性改动。

### 5.3 `MALLOC` 不清零 + 静态缓冲借用堆区（上一轮 §4.4 仍未闭环）

Python 侧 `cpu.py` 的 `MALLOC` 与 Go 侧 `vm.go` 的 `sysMALLOC` 都只推进 `heap_ptr`，
**不清零**（两端一致，所以不是差分问题）。本轮已据此把 **struct 对象**在序言里显式清零
（否则 `P p` 的「字段默认全零」只是「堆恰好是干净的」这一巧合）。

仍未闭环的是 `_sys_buffer()`：它取 `heap_ptr + 2048 + idx*64` 且**不推进 `heap_ptr`**
（`cpu.py`、`vm.go` 同构），因此当程序累计分配超过 ~2 KiB 后，
`MALLOC` 会把这块静态缓冲交出去，之后 `itoa` / `ftoa` / 字符串拼接会覆盖已分配对象。
本轮用一个 16 字节的复现没触发它（需要更大分配量），所以**本轮未修**，维持上一轮结论：
建议把静态缓冲移到内存顶端独立区，或让它也走堆分配语义。

### 5.4 `exit()` 之后没有 `_epilogue`：栈不平衡，但已终止

`exit(code)` 直接 `HALT`，不执行函数尾声。这是**有意的**（终止语义），
但要注意两点：`--profile` / `--debug` 的收尾统计仍会正常输出；
`exit()` 出现在被 `assert` 消息求值的表达式里时不会有额外副作用。已在测试中覆盖。

### 5.5 R3-10 `upper` / `lower` 是 Unicode 感知的，文档写的是 ASCII

`docs/language/builtins.md` 的字符串表格写：

> `upper(s)` / `lower(s)` | string | ASCII 大小写转换 (新堆块)

实际两侧都是 **Unicode 感知**的：

| 路径 | 实现 | `upper("é")` |
|------|------|--------------|
| 解释器 | `str.upper()`（Unicode） | `"É"`（2 字节） |
| Go 原生 | `strings.ToUpper`（Unicode） | `"É"`（2 字节） |

两条路径**一致**，所以这不是差分问题，只是**文档写错了**。但它会让写库的人误以为
"只动 ASCII、字节数不变"——本轮新增的 `text.cin` 就不得不只在纯 ASCII 字母段上调用它们。

**建议**：把 `builtins.md` 的描述改成
「Unicode 感知的大小写转换（非 ASCII 字符可能改变字节长度）」；
若你希望它是 ASCII-only（更符合"字节语义"的整体设计），
那两侧要一起改成只处理 `a-z` / `A-Z` 的字节映射，并在文档里说明。

### 5.6 纯 Python 解释路径的绝对速度：`O(n²)` 算法在默认容量下会变成分钟级

本轮写 `dp.cin` / `graph.cin` 时实测（同一台机器，`--no-native` 强制解释执行）：

| 负载 | 解释路径耗时 |
|------|--------------|
| 2 万次空循环 | **11.7 s** |
| 192 × 192 的 LCS（一次调用） | **79 s** |
| 完整的 dp 测试集（原容量 `DP_STR_MAX=192` / `DP_LIS_MAX=256`） | **225 s** |

这不是"有点慢"，而是**直接决定了标准库能把容量定到多大**：为了让测试可用，
最终把 `DP_STR_MAX` 从 192 降到 128、`DP_LIS_MAX` 从 256 降到 64，
于是 dp 测试从 225 s 降到约 16 s。**容量不是被内存限制的，而是被解释速度限制的。**

**影响**：教学场景里学生最常写的就是 `O(n²)` 的双重循环（排序、LCS、矩阵）。
本项目的定位是"三路径一致 + 可教学"，但默认 `--no-native` 一旦被用来讲解语义，
体感会非常差；而 `--jit` 与原生路径在讲"逐指令语义"时又用不上。

**建议**（按性价比）：

1. **`--jit` 的覆盖率**：先确认 JIT 对"双重循环 + 数组下标 + 内建调用"这类
   `O(n²)` 热点的基本块是否都能编译；若能，文档里应明确写
   "讲解语义用 `--no-native`，跑 `O(n²)` 请加 `--jit`"（现在 `execution-paths.md`
   只给了速度示意 `1× / 4× / 8×`，没有给"何时必须换路径"的判据）；
2. **给解释器热点做低风险优化**：`cpu.py` 的 `_dispatch` 是纯 Python 大 `if/elif` 链，
   把最热的十几条（`MOV/ADD/ADDI/LD/SD/CMP/B*/JMP`）换成**按 opcode 索引的 handler 表**
   通常能拿到明显收益，且不改变语义、不影响三路径一致性；
3. **在文档与示例里给出"规模预算"**：例如"默认解释路径下，`O(n²)` 算法的 `n` 建议 ≤ 100"，
   比只写"解释最慢"更有用。

::: tip 这条与 R3-9 是同一类问题的两面
R3-9 是"两条路径结果不同"，这条是"三条路径都对，但其中一条慢到不可用"。
两者都会把使用者推离"默认路径"，而三路径一致性的价值恰恰建立在默认路径好用的前提上。
:::

### 5.7 堆不回收：字节级重建的规模上限比想象中低

字符串拼接每个新堆块**都不回收**（`MALLOC` 只推进 `heap_ptr`），
所以"重建字符串"类函数的堆开销是输入长度的平方级。
本轮 `text.cin` 的实测边界：对 `'ab '×30`（90 字节）连续做
`txt_reverse` + `txt_swap_case` + `txt_title` 可以通过，
对 `'ab '×40`（120 字节）会以 `Stack overflow (collides with heap)` 结束。

**建议**：这是一个**应该写进文档的具体数字**（现在 `stdlib` 文档只说"循环拼接会占堆"，
没给量级），并且值得考虑让 `--mem-size` 的推荐值出现在这条错误信息里
（当前报错只说与堆相撞，没有提示"可以用 `--mem-size` 放宽"）。

### 5.8 range-for 的 struct 循环变量是别名（与 C/C++ 不同）

本轮修好「整体赋值是值拷贝」之后，发现**同一族语义里还剩一处**：

```c
struct P { int x; int y }
function main() -> int {
    P ps[2] = {{1, 2}, {3, 4}}
    for (P q : ps) {
        q.x = 99          // 改的是数组元素本身 (C/C++ 里改的是副本)
    }
    return ps[0].x       // 实测 99; C/C++ 语义下应为 1
}
```

`gen_rangefor` 对 struct 元素只把**元素指针**载入循环变量，所以 `q` 是别名而不是副本；
现有 `RF_STRUCT_FIELD` 用例只读不写，因此没有测试暴露它。

**为什么值得单列**：`structs.md` 现在写「整体赋值 = 值拷贝」，而 range-for 的循环变量
在 C/C++ 里等价于一次赋值（`P q = ps[i]`）。两者不一致会让"值语义"这个承诺再次失效。
**要么改实现，要么在 `control-flow.md` / `structs.md` 明确写出"range-for 的 struct 循环变量是引用"**。
建议先补文档（一句话），并在同段给出"需要副本就显式 `P q = ps[i]`"；
若要向 C/C++ 看齐，在 `gen_rangefor` 里对 struct 元素插一次值拷贝即可
（可直接复用本轮新增的 `_struct_assign` 路径，改动很小）。

### 5.9 其它已确认的边界（记录备查）

| 限制 | 现状 | 说明 |
|------|------|------|
| 三层以上花括号字面量 <span v-pre>`{{{5},6},7}`</span> | 报 `Unexpected token LBRACE` | 解析器既有边界；深层嵌套可用逐字段写入 + 整体赋值绕过 |
| 多维 struct 数组 `P ps[2][3]` | 编译期明确拒绝 | 本轮改为**报错**而非按错误步长静默算，并提示 flatten 成一维 |
| `struct Bag { P items[3] }`（struct 数组字段） | 编译期明确拒绝 | 与上一轮文档「值内嵌」冲突，`structs.md` 已校正 |
| struct 写入标量槽 `int a[2]; P p; a[0] = p;` | 本轮新增编译期错误 | 原先静默把指针当整数存进数组 |
| 跨 struct 类型赋值 `P p; Q q; p = q;` | 本轮新增编译期错误 | 原先静默按第一个类型的槽数拷贝 |

::: tip 这一族的价值
R3-1 ～ R3-9 与上面这张表是同一件事的不同侧面：**struct 的"值 vs 指针"语义
此前散落在 5 个代码位置各自为政**。本轮把它们统一成
"槽里存对象指针 + 整体赋值逐槽拷贝 + 传参引用"，
并把所有无法自洽的写法（多维数组、数组字段、跨类型赋值、struct 写标量）
从"静默算错"改成"编译期报错"——这是本轮**最重要的结构性改进**。
:::

### 5.10 R3-15 struct 形参不做类型检查，错误推迟到运行期

写 `frac.cin` 时发现：**把 `float` 传给需要 `Frac` 的函数可以编译通过**，
运行期才炸，而且报的是内存越界而不是类型错误：

```c
struct Frac { int num; int den }
function fr_equals(Frac a, Frac b) -> int { return a.num * b.den == b.num * a.den }

function main() -> int {
    Frac x = {1, 2}
    return fr_equals(1.5, x)      // 编译通过!
}
```

| 阶段 | 表现 |
|------|------|
| 编译 | 无任何报错 |
| 运行 | `Execution error: Address 0x3fd0000000000000 out of bounds` |

`0x3fd0000000000000` 正是 `1.5` 的 IEEE-754 位模式被当成 struct 指针去解引用。

**根因**：`_gen_call` 对用户函数的实参只做 `_convert(at, _param_promote(ptype))`，
而 `_convert` 对「标量 → struct 指针」是**无操作**（注释写着 "string/struct/array
指针无需转换"），于是 float 的位模式被原样当成对象指针传了进去。

**建议**：在 `_gen_call` 的实参处理里加一条编译期检查——
目标形参是 struct（或数组）而实参类型是标量/string 时报
`Cannot pass <src> to parameter of type <struct>`。这是纯编译期检查，
约 5 行，不影响任何合法程序的语义，但能把一类"看不懂的越界报错"变成一句话。

**注**：本轮已顺带把两个更严重的同类静默错误改成编译期报错
（跨 struct 类型赋值、struct 写入标量槽，见 §5.9），
**形参这一处是同一族里剩下的最后一个缺口**。

### 5.11 R3-16 `string` 无法包含字节 0 —— 字节语义里的一个洞

`strlen` / `substr` / `s[i]` 在 5.6.0 起都统一成**字节**语义，但 `string` 是
**NUL 结尾**的，所以**字节 0 不可表示**。实测：

| 程序 | 结果 |
|------|------|
| `strlen("\x00\x01\x02")` | **0**（整个字面量在第一个字节就被截断成空串） |
| `strlen("A\x00B")` | **1** |
| `strlen("\xFF")` | 1（非 0 字节正常） |

**这条限制本轮造成了一个真实的坏库**：新写的 `codec.cin` 想用一张 256 字节的
"字节 ↔ 字符"双向表来把整数值还原成单字节字符串：

```c
string codec_bytes = "\x00\x01\x02…\xFF"      // 本意是 256 字节
// 实际 strlen(codec_bytes) == 0 —— 整张表是空的
function codec_chr_of(int b) -> string { return substr(codec_bytes, b & 0xFF, 1) }
```

于是 `codec_chr_of()` 恒返回空串，`codec_rot13("Uryyb")` 得不到 `"Hello"`，
13 个用例里 12 个是红的。作者（子任务）按照"字节语义"的直觉写，却撞上了一个
字节语义**覆盖不到**的洞。

**影响面**：任何"输出任意字节"的函数在语义上都不可能完备——
`codec_hex_decode` / `codec_base64_decode` / `codec_xor_cipher` 都无法产出字节 0，
所以"解码 → 编码往返一致"这类性质**在含 NUL 的输入上必然不成立**。
这不只是 codec 的问题：任何二进制处理（压缩、校验、协议打包）都会撞上它。

**建议**（按代价）：

1. **先写进文档**（必须做）：在 `docs/language/strings.md` 的字节语义一节点明
   「字符串以 NUL 结尾，**不能包含字节 0**；需要真正的二进制数据请用 `int[]` 或
   `\x01..\xFF` 的可表示子集」，并给出一条实测例子；
2. **在词法层给个警告**（推荐）：字面量里出现 `\x00` 且**后面还有内容**时，
   编译期给一条 warning（现在完全静默地截断，是最难查的一类）；
3. **库作者约定**（推荐写进 `stdlib` 文档）：需要 0..255 全值域的场景用
   `int[]` 传字节，而不是 `string`；
4. 可选：让 `strlen`/`substr` 接受显式长度参数（`strnlen(s, n)` / `substr_n(s, start, len, n)`），
   这样二进制串就能用 `string` 表示——但这会改动既有内建语义，属于较大的设计决策。

::: tip 这一条与 R3-9 是同一个"字节语义"主题的两端
R3-9 修的是"字节语义没落实"（解释器偷偷做 UTF-8 解码）；
R3-16 指出的是"字节语义的边界"（NUL 结尾让字节 0 不可表示）。
两者都说明：**"字节语义"目前是部分成立的，文档值得把边界写清楚**。
:::

---

## 6. 本轮新增功能（`const` / 聚合初始化 / `string +=` / `exit()`）

### 6.1 `const` 命名常量（此前是裸 `KeyError` 崩溃）

**修复前实测**：

| 写法 | 结果 |
|------|------|
| `const int N = 4`（全局） | `Compiler error: Name 'int' is already used as an enum member or keyword`（把 `const` 当 struct 类型名，`int` 当变量名） |
| `const int N = 4`（局部） | **裸 `KeyError: 'const'`** —— 未处理的 Python 异常 + 完整 traceback |
| `const float PI = 3.14` | 同上误导性报错 |

**本轮实现**：`const` 是**纯编译期**命名常量（不占数据段、不产生指令），支持
`int / float / bool / string`，支持
`+ - * / % << >> & | ^`、一元 `-`/`~`、字符串 `+`，可引用先前定义的 `const` 与 `enum` 成员；
按声明类型规范化（`float→int` 向零截断、`bool←非零`）；重复定义、
非常量初值、常量除零都是清晰的 `CompilerError`。
局部变量可以**遮蔽**同名 `const`（正常词法作用域）；全局变量与 `const` 同名则明确报错。

### 6.2 数组维度接受整型常量表达式（此前只认裸字面量）

**修复前**：`int a[N]`、`int a[2 + 3]` 都报 `Expected RBRACKET`；
`enum` 成员能在循环边界里用，却**不能**当数组维度。

**本轮**：`parse_dims` 改为解析常量表达式并求值（`[N]`、`[2 + 3]`、`[enumMember + 1]`），
非整型常量 / 负长度给出明确错误。于是惯用写法可用了：

```cin
const int N = 5
int matrix[N][N]
```

### 6.3 `string +=`

**修复前**：`s += "b"` → `Cannot apply '+=' to type: string`。

**本轮**：字符串 `+=` 支持右侧任意可字符串化的值（`s += 42` 得到 `"n=42"`），
其余 `-=` / `*=` / `/= ` 仍明确拒绝。

### 6.4 `exit(code)`

**修复前**：`Unknown function: exit`。

**本轮**：`exit(code)` 立即终止程序（`MOV x0, code; HALT`），
解释器 / JIT / Go 原生 VM 三条路径一致；`exit` 只有在用户未自定义同名函数时才生效；
参数个数不匹配报编译错误。进程退出码的传播见 §5.2。

### 6.5 顺带修掉的静默行为：局部 struct 不再依赖「堆恰好干净」

`MALLOC` 不清零（§5.3），所以「`P p` 的字段默认全零」在修复前只是巧合。
现在 `_alloc_struct_slot` 在分配后显式清零 `size_slots` 个槽，使
`docs/language/structs.md` 的「实例化与默认全零」对**局部 struct** 也成立
（全局 struct 本来就在清零的数据段里）。

### 6.6 版本功能增强（把版本号从字符串升级为设施）

原先版本号只有"单一真源 + 一个字符串"，本轮补齐了**自检、可编程、可发布**三件事：

| 新增 | 内容 |
|------|------|
| `codecin/version.py` | `version_info()` / `try_version_tuple()` / `is_version_string()` / `compare(a, b)` / `current_version()` / `jit_available()` / `build_info()` / `format_build_info()` / `build_info_json()` / `VersionError` |
| `build_info()` | 版本、Python 实现与版本、平台/架构、JIT 可用性、包路径，以及**原生库是否可用 / 自报版本 / 是否与包版本一致**；每个探测都包了降级，**永不抛异常** |
| `--build-info` | 多行文本输出，不需要位置参数，退出 0 |
| `--build-info --json` | 同一份信息的 JSON（可直接 `json.loads`）；`--json` 单独用返回 2 |
| `script/bump_version.py x.y.z` | 一步完成：改 `codecin/__init__.py` → 重新生成 Go 侧 `engine/version_gen.go` → 在 `CHANGELOG.md` 插入新版本小节骨架 → 三处自检；**先校验后落盘**，任一步失败按字节备份回滚；支持 `--dry-run` / `--date` / `--root` |
| 发布门禁测试 | `test_changelog_lists_current_version`：`__version__` 提升而 `CHANGELOG.md` 没有对应 `## [x.y.z]` 小节即失败 |

**这一条解决的是真实缺口**：上一轮报告 `SUGGESTIONS_NEXT.md` 的 §5.5 指出
`release.yml` 只比对 tag 与
`__init__.py`，**可以发布一个完全没有变更日志的版本**。现在这个缺口由测试兜住了。

顺带确认：`CHANGELOG.md` 里**已经有** `## [5.6.0]`，所以本轮没有补写条目；
原生库自报串（`codecin-native 5.6.0 (Go)`）与包版本一致，
`native_version_matches = true` —— "原生库过期"这类问题现在一条命令就能判定。

---

## 7. 本轮新增标准库

标准库从 20 个扩到 **36 个**（全部为纯 CIN，只依赖语言内建，三条路径一致；
`io` / `gui` / `termux` / `key` 四库仍依赖 Go 原生运行时）：

| 方向 | 新增库 |
|------|--------|
| 数据结构与算法 | `tree.cin`（`tree_`）、`unionfind.cin`（`uf_`）、`heap.cin`（`heap_`）、`graph.cin`（`graph_`）、`set.cin`（`set_`）、`bitset.cin`（`bs_`）、`dp.cin`（`dp_`） |
| 文本与格式化 | `text.cin`（`txt_`）、`token.cin`（`tok_`）、`fmt.cin`（`fmt_`）、`csv.cin`（`csv_`） |
| 数值与科学计算 | `bigint.cin`（`bi_`）、`frac.cin`（`fr_`）、`combin.cin`（`comb_`） |
| 工程与系统 | `path.cin`（`path_`）、`codec.cin`（`codec_`） |

约定（与既有 20 个库一致，写进每个文件头）：

- **没有动态内存分配**：容器一律「定长全局数组 + 容量常量」，容量上限写在文件头注释；
- **全局数据段只有 64 KiB**：每个库的全局数据 < 8 KiB；
- 全部接口显式传元素个数 `n`（CIN 数组不携带长度）；
- 越界参数一律「裁剪或返回明确失败值」，不越界写内存。

逐库签名与示例见 [标准库参考](/stdlib/reference)。

---

## 8. 环境类问题（影响贡献者，不是仓库缺陷）

1. **`tmp_path` 在受限沙箱下不可用（本轮已修复）**。DSH 沙箱的子进程无法 `scandir`
   会话音量下的临时目录，`pytest` 的 `tmp_path` 因此在 setup 阶段就 `PermissionError`。
   本仓库已有应对（`tests/conftest.py` 的 `workdir` 夹具，指向仓库内 `.pytest_tmp/`），
   但 `tests/test_keyboard.py`、`tests/test_p0_fixes.py` 仍直接用 `tmp_path`，
   在本机表现为 **5 个 ERROR**。
   **本轮修复**：这两个文件改用 `workdir` 夹具（原因写在测试注释里）。
   于是本机全量测试只剩 `tests/test_aot.py` 的 3 个环境性失败，
   其余失败都能直接归因到代码——这本身就是一条重要的可观测性改进。
2. **AOT 临时目录建在源码树内且静默清理失败**（上一轮 §3.3，**本轮已加固**）。
   改动：`codecin/aot.py` 新增
   `sweep_stale_build_dirs(max_age_seconds=6h, logger=None) -> SweepResult(removed, failed)`，
   在每次构建创建临时目录**之前**清扫超过 6 小时的 `.aotbuild-*` / `.aotprobe-*` 残留
   （只扫一层、只认自己的前缀、显式拒绝 `..`/分隔符/绝对路径、再校验父目录就是 `codecin/native`、
   跳过符号链接、任何失败都不抛异常）；`build()` 的 `finally` 不再用
   `ignore_errors=True`，清理失败会以 `warning` 给出**残留目录绝对路径**与
   `Remove-Item -LiteralPath "<p>" -Recurse -Force` / `rm -rf "<p>"` 的手动清理命令；
   `pyproject.toml` 增 `[tool.setuptools.exclude-package-data] "codecin.native" =
   [".aotbuild-*", ".aotprobe-*"]`，并用真实 wheel 做了**阳性/阴性对照**
   （有排除 → 0 条 AOT 临时条目；删掉排除表 → 2 个残留 `main.go` 出现在 wheel 里）。
   另外确认：`codecin/native/aot/build.go` **已不存在**（该目录只有 `aot.go` + 模板），
   上一轮 §3.3 引用的 `build.go:86-88` 是过期引用，Go 侧无需同步。
   **本机的 3 个失败仍未消除**，原因见下一条——它不是 Go 缓存问题。
3. **本机 3 个 AOT 失败的真实根因：沙箱子进程是 Low integrity（no-write-up）**。
   实测在沙箱内 `Set-Content codecin\probe.txt`、`New-Item codecin\native\<任意名>`、
   `codecin\lib\probe.txt`、`tests\probe.txt`、`examples\probe.txt` **全部 `WinError 5`**，
   而**工作区根目录**（`.pytest_tmp/`、`.gocache/`、新建的根级目录）可写。
   也就是说：**已存在的仓库子目录一律写不进去**，只有根目录可写。
   3 个 `test_aot.py` 失败恰好都发生在 `os.makedirs('codecin/native/.aotbuild-…')` 这一行，
   **早于调用 `go`**，所以设 `GOCACHE` / `GOTMPDIR` 对它无效（我先前也据此误判过一次）。
   同理 `python -m build`、pytest 的 `.pytest_cache` 也都会失败。
   **这纯属本机沙箱限制**，不是仓库缺陷；在普通权限的环境里这些用例应当通过。
4. **字符串 `==` 比较的是指针而不是内容**——这一条**文档已经写清楚了**
   （`docs/language/strings.md` 的 danger 提示），不是缺陷；但它是新增库测试里
   最容易踩的坑：`s != "abc"` 恒为真，必须用 `strcmp(s, "abc") == 0`、判空用 `strlen(s) == 0`。
5. **多个 agent 并发改同一工作区时的 git 污染**。本轮为并行加速，同时有多个子任务在
   同一个工作区里写文件；其中有子任务在收尾时执行了 `git add -A && git commit`，
   于是：别人的**在途半成品**被一起提交；只能算是探针的临时文件（如 `tt_probe/`）
   被提交；`HEAD` 里出现过"同一文件的修正前版本"（例如 `tests/test_lib_text.py`）；
   有的改动（`codecin/aot.py` 的加固）被卷进了一条主题完全不同的提交
   （`f821a6d "feat: 新增 token 和 text 库测试…"`），变更边界丢失。
   **这不是仓库缺陷，但它是并行开发流程的真实风险**：给自动提交加上
   "只提交自己新建/修改的路径"或干脆禁止子任务提交，就能避免。
   本轮后续的子任务已明确禁止执行任何 git 写操作。
6. **`tests/conftest.py` 的 session 级 `_clean_tmp` 会 `rmtree(.pytest_tmp)`**，
   并发跑两个 pytest 会话时，先结束的那个会把另一个会话正在用的临时文件删掉
   （多个子任务都踩到，表现为"文件刚创建就被删 / Load Error"）。
   `tmp_path` 之外还有这个竞态。**建议**：把 `_clean_tmp` 改成只清理本会话自己的子目录
   （按 session id 分目录），而不是整个 `.pytest_tmp`。

---

## 9. 本轮实测命令（可复现）

```powershell
# 本轮新增回归（99 个用例，覆盖 interp / native / JIT）
python -m pytest tests/test_aggregate_and_const.py -q -p no:cacheprovider

# R3-1 聚合初始化覆盖帧指针（修复前 0，修复后 34）
python -m pytest tests/test_aggregate_and_const.py -q -k local_literal

# R3-2 struct 数组成员写到绝对地址 0/8（修复前破坏数据段）
python -m pytest tests/test_aggregate_and_const.py -q -k array_element_isolation

# R3-3 初始化器过多：修复前 interp=65536 / native=ExecutionError
python -m pytest tests/test_aggregate_and_const.py -q -k too_many

# R3-6 嵌套 struct 偏移（修复前 560，修复后 567）
python -m pytest tests/test_aggregate_and_const.py -q -k nested_literal

# 5.1 const（修复前局部 const 是裸 KeyError）
python -m pytest tests/test_aggregate_and_const.py -q -k const

# R3-7 局部数组默认值（实测 1110，文档承诺 0）
#   见 §5.1 的 dirty()/probe() 片段

# R3-8 退出码不传播（两者都是 0）
Set-Content t.cin 'function main() -> int { return 3 }'; python cpu.py t.cin; $LASTEXITCODE

# 三路径一致性门禁
python script/check_paths.py
python script/gen_native_isa.py --check
python script/gen_isa_docs.py --check
```

---

## 10. 建议的落地顺序

**第一批（文档与实现二选一，避免继续误导使用者）**

1. §5.1 局部固长数组默认值：改 `types.md`，或实现序言清零；
2. §5.2 退出码：先改 `reference.md` 的 `t_report()` 说法，再决定是否让
   `exit(code)` / `main` 的返回值进入进程退出码（含 AOT 侧）；
3. §3 的 `struct Bag { Point items[3] }`：实现它，或把 `structs.md` 第 262 行改为不支持。

**第二批（工程与治理）**

4. §8.1 把 `tests/test_keyboard.py`、`tests/test_p0_fixes.py` 的 `tmp_path` 换成 `workdir`，
   让受限环境下的全量测试结果可解释（**本轮已完成**）；
5. §5.3 `_sys_buffer` 归还堆区（上一轮 §4.4）；
6. 给新增的 16 个库补一条「全部库同时 import」的合并用例（各子任务已各自验证
   与自己相关的一批无符号冲突，但全局合并仍未一次覆盖）。

**第三批（可选增强）**

7. `sizeof(array)` / 数组元素个数：本轮用 `const` + `[N]` 覆盖了主要场景，
   若要提供内建，建议命名避开 C 的字节语义（例如 `len(a)`），并在文档里强调与 C 不同；
8. `switch` 支持字符串（下降为 `strcmp` 链）、带标签的 `break` / `continue`
   （实测目前 `outer:` 标签报 `Unexpected token COLON`）。

---

## 11. 本轮未核实的部分

- **`_sys_buffer` 与 `MALLOC` 的重叠**：只证明了机制（静态缓冲不推进 `heap_ptr`），
  本轮的小复现没有触发重叠，未做规模化的触发实验（上一轮已把它列为未决）。
- **AOT 产物在真实（非沙箱）Windows 上的退出码与临时目录行为**：本机沙箱拒绝
  `go build` 写临时目录，3 个 `test_aot.py` 用例无法完成，只能确认脚本级结论。
- **`const` 与 `enum` 在极端值下的边界**（如 `const int N = 1 << 63` 的符号处理）：
  已实现按 64 位回绕，但未逐值穷举与 Go 侧编译器对照（Go CLI 自 5.5.0 起停更，
  不再是 CLI 后端；AOT 与本解释器共用同一份 UCBC，因此不受影响）。
