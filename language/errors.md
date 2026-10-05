---
description: "CIN 语言限制、常见编译/运行错误对照表与排错流程：从报错信息定位到修复方式。"
---

# 限制与常见错误

这一页汇总 CIN 与 C/其它语言**最不一样的地方**, 以及编译器/运行时的真实报错与修复方式。

## 语言限制

1. **没有指针与取地址运算**: `*` 只是乘法, `&` 只是位与 (不是解引用/取地址);
   “引用语义”仅通过数组与 struct 传参隐式获得。
2. **`/` 恒为浮点除法**: 整数除法用内建 `idiv(a, b)` (向零截断); `%` 仅支持整数,
   浮点取模报错。
3. **位运算只接受整数**: `& | ^ << >> ~` 不接受 float/string; `>>` 是算术右移 (符号扩展),
   移位量按低 6 位取模。
4. **递归深度受栈区限制**: 默认内存 1 GiB (4 KiB 稀疏分页, 按需提交), 大数组开箱即用;
   但栈与堆相向生长, 过深递归报 `Stack overflow: frame needs ...`。需要时用 `--mem-size` 扩容。
5. **struct 字段限制**: 字段可以是标量、嵌套 struct、固长数组, 但**不能是变长指针数组
   (`T[]`)**; 字符串字段是指针, 拼接/复制会产生新堆块。
6. **全局初始化顺序**: 按声明顺序写入数据区; 数组字面量长度超过声明维度会报错。
7. **函数可先用后定义**: 同文件内的函数互相调用不受顺序限制 (两遍编译);
   但**变量必须先声明后使用**。
8. **字符串不可原地修改**: `strcpy` / 拼接 / `upper` 都返回新堆块; 没有可变的原地字符替换。
9. **字符串不能用 `==` 比内容**: `==` 比较的是 64 位指针值, 请用 `strcmp(a, b) == 0`
   (见 [字符串](/language/strings))。
10. **数组不携带长度**: 所有数组接口都要显式传入元素个数 `n`; 默认不做越界检查
    (需要时用 `--bounds-check`)。
11. **范围 for 只接受定长数组**: `for (T v : arr)` 的 `arr` 必须声明为定长数组
    (`int[]` 指针形式与多维数组报错, 改用下标循环)。
12. **enum 成员是只读常量**: 不能给成员赋值; 成员的初值表达式只能引用**先前已定义**的成员
    (见 [类型系统](/language/types))。

## 常见错误对照表

| 错误信息 | 原因 | 修正 |
|----------|------|------|
| `Unknown function: xxx` | 调用了未定义或拼错的函数 | 检查函数名; 库函数需要先 `import "xxx.cin"` |
| `Undefined variable: xxx` | 使用了未声明 (或声明在使用之后) 的变量 | 先声明再使用 |
| `Unsupported int operator: xx` | 对整数用了不支持的运算 | 使用 `+ - * / % & \| ^ << >>` |
| `Float modulo not supported` | 对浮点用了 `%` | 先取整或改用 `idiv` |
| `Bitwise operator ... requires integer operands` | 对 float/string 使用位运算 | 位运算仅支持 int/bool |
| `Type mismatch ...` | 赋值/传参类型不匹配 | 显式转换或修正类型 |
| `Expected RBRACE ... at line N` | 花括号不配对, 或块内语句缺少换行 | 检查第 N 行附近 |
| `Import file not found` | 模块名写错, 或自建模块漏了 `"./"` 前缀 | 见 [模块与标准库](/language/modules) |
| `Stack overflow: frame needs N bytes, stack headroom only M bytes ...` | 递归过深 / 局部数组过大, 栈帧分配后 SP 低于堆警戒线 | `--mem-size` 扩容, 或减少递归深度 / 局部大对象 |
| `Heap exhausted: need N bytes, free M bytes ...` | 堆分配空间不足 | `--mem-size` 扩容, 或减少分配 |
| `Address 0x... out of bounds` (可能带 `negative address: stack overflow or bad pointer?` hint) | 越界读写; 按位模 2^64 后为负的地址通常意味着栈溢出或野指针 | 打开 `--bounds-check` 定位 (见下方内存错误说明) |
| `Host capability disabled in sandbox mode (SYS N: NAME)` | `--sandbox` 下调用了白名单 (`ALLOCFRAME` / `TIMEUS` / `TIMENS`) 之外的宿主 SYS | 去掉 `--sandbox` (见 [宿主能力](/language/host-abilities)) |
| `Cannot assign to enum member: X (constants are read-only)` | 给枚举成员赋值 | 成员是编译期常量, 改用普通变量 |
| `range-for requires a fixed-size array` | `for (T v : arr)` 遍历了 `int[]` 指针形式数组 | 用定长数组或下标循环 |
| `range-for over multi-dimensional arrays is not supported` | 遍历了多维数组 | 用两层下标循环 |
| `Empty case range: lo..hi` | `case` 范围写反 (`lo > hi`) | 保证 `lo <= hi` |
| `case value must be an integer constant` | `case` 用了非常量表达式 | 用整数常量表达式或枚举成员 |
| `\u escape needs exactly 4 hex digits` 等 | 十六进制转义位数不足 | `\x` 写 1~2 位, `\u` 写 4 位, `\U` 写 8 位 |
| `Unknown instruction: xxx` (汇编) | 用了本 ISA 没有的指令 (例如 `jle`) | 见 [指令语义参考](/asm/instructions); 比较用 `JG`/`JL`/`JE` |

错误输出统一为 rich 红色面板, 带 `文件:行号` 定位:

```text
┌──────────────────────── Load Error ────────────────────────┐
│ prog.cin:12: Compiler error: Unknown function: printline   │
└────────────────────────────────────────────────────────────┘
```

## 内存错误 (5.8.2+)

所有内存访问错误统一为 `MemoryAccessError` (旧的 `PageFaultError` 已并入, `MemoryError`
是其兼容别名)。5.8.2 起错误信息带具体数值与提示:

```text
Stack overflow: frame needs 720896 bytes, stack headroom only 4096 bytes (SP 0x..., guard 0x..., memory 1073741824 bytes). Try --mem-size or smaller local arrays
Heap exhausted: need 1048576 bytes, free 4096 bytes (heap 0x...). Try --mem-size or reduce allocations
Address 0xffffffffffffe000 out of bounds (negative address: stack overflow or bad pointer?)
```

- 默认内存 **1 GiB** (4 KiB 稀疏分页, 按需提交), 大数组不再需要预先扩容;
- `negative address` hint 表示地址按位模 2^64 后为负, 典型成因是栈溢出 (SP 被推到负地址) 或野指针;
- 深递归 / 更大堆占用仍可用 `--mem-size` 扩容。

## 排错流程

::: tabs

== 1. 先看定位

```bash
codecin prog.cin                # 面板里的 文件:行号 就是第一现场
codecin prog.cin --log-level DEBUG --log-file codecin.log
```

== 2. 边界与资源

```bash
codecin prog.cin --bounds-check                 # 数组越界检查
codecin prog.cin --mem-size 262144              # 栈/堆扩容
codecin prog.cin --max-instructions 1000000     # 死循环保护 (默认 1 亿)
```

:::

更多排错入口:

- [日志与错误输出](/tools/logging) — 日志级别与退出码
- [常见问题 (FAQ)](/guide/faq) — 安装、性能、产物、宿主能力等问答

## 相关页面

- [类型系统](/language/types) — 提升与截断
- [运算符](/language/operators) — `/` 与 `idiv`、位运算规则
- [字符串](/language/strings) — 指针语义与 `strcmp`
- [内存与缓存](/tools/memory-cache) — 内存布局、`--mem-size`、越界与保护
