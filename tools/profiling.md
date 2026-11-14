---
description: "Code CIN 性能分析与计时: time_us()/time_ns() 程序内打点、--max-instructions 防失控、--build-info 确认原生引擎环境与引擎侧 steps 统计。"
---

# 性能分析与计时

v5.9.0 起整程序由 Python 侧**一次调用**交给 Go 原生引擎执行（ABI v2），结束后回传寄存器/向量/NZCV/脏内存段/输出。执行统计（逐操作码直方图、内存读写、分支结果）由 Go 引擎在解释循环中累加，随结果尾部一次性回传，Python 侧不再逐指令记账。逐段耗时仍建议在程序内用 `time_us()` / `time_ns()` 打点。

- 内存模型与 `--mem-size` 见 [/tools/memory-cache](/tools/memory-cache)；
- 日志级别与错误面板见 [/tools/logging](/tools/logging)；
- Python API 细节见 [/reference/python-api](/reference/python-api)。

## 程序内计时：time_us() / time_ns()

在 CIN 程序里直接打点。`time_us()` 返回单调微秒计时，`time_ns()` 是纳秒版本（更高分辨率）；两者的实现是引擎侧系统调用（SYS 138/139），不受 `--seed` 影响。

```cin
function main() -> int {
    int t0 = time_us()
    int sum = 0
    for (int i = 0; i < 1000000; i++) {
        sum += i
    }
    int t1 = time_us()
    println("耗时 " + int_to_str(t1 - t0) + " us, sum = " + int_to_str(sum))
    return 0
}
```

用法要点：

- **先 warm 再测**：首次运行包含编译/装载开销；把被测代码放进函数、循环里多次执行取平均更稳；
- **纳秒粒度**：极短代码段用 `time_ns()`，避免整数微秒截断成 0；
- **挂钟时间**：日历时间用 `time_ms()`（毫秒级时间戳），不要拿它算耗时。

## 防止失控：外部超时

`--max-instructions` 在 v7.22.10 已弃用（仅作为隐藏参数保留），默认**不限制指令数**，
不再建议用它来兜底：

```bash
# 旧写法 (仅兼容旧脚本; 默认不限制)
codecin bench.cin --max-instructions 10000000
```

批处理/判题请优先用外部超时（如 `timeout 10 codecin bench.cin`），避免依赖已弃用选项。
步数统计仍可通过 `stats.instruction_count` 读取。

## 确认运行环境：--build-info

性能结论只在确实跑在 Go 原生引擎上时才有意义。发布或部署前先做一次环境自检：

```bash
codecin --build-info
```

它打印版本号、平台与原生库加载状态等环境信息（由 `codecin/version.py` 的 `build_info()` 生成，永不抛异常）。若动态库缺失或 ABI 不匹配，运行程序会直接抛 `CPUSimulatorError` 并附重建指引（`codecin/native/build.ps1` / `build.sh`）。v5.9.0 起没有解释器回退，构建方法见 [/dev/build-native](/dev/build-native)。

## 引擎侧执行统计

原生引擎在解释循环中顺手累加以下计数，并通过 v2 结果缓冲的可选统计尾部一次性回传：

- **steps**：执行的指令总数（`stats.instruction_count`）；
- **逐操作码直方图**：`stats.opcode_count` / `get_hot_instructions()`，用于指令使用率与周期分布；
- **内存读写次数**：`stats.memory_reads` / `stats.memory_writes`；
- **分支数与预测命中**：`stats.performance_counters`，`--debug` 报告中的分支准确率由此计算。

`Instruction Cycle Profile` 的周期数按 `InstructionProfiler.latency` 的延迟表由真实直方图换算，不是硬件性能计数器；它适合比较指令构成，不适合测量绝对速度。绝对耗时仍以程序内 `time_us()` / `time_ns()` 为准。

若装载的是旧版 `codecin-native`（只回传 steps），统计尾部不存在：`stats.native_stats=False`，`--debug` 会把内存/分支指标显示为 `N/A` 并提示重建原生库，不会输出占位项 `?` 或伪造的 0/100%。

