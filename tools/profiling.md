---
description: "Code CIN 性能分析与计时: time_us()/time_ns() 程序内打点、--max-instructions 防失控、--build-info 确认原生引擎环境与引擎侧 steps 统计。"
---

# 性能分析与计时

v5.9.0 起整程序由 Python 侧**一次调用**交给 Go 原生引擎执行（ABI v2），结束后回传寄存器/向量/NZCV/脏内存段/输出。Python 侧不再逐指令记账，因此旧版 `--profile` 逐指令统计报告已随解释器一并移除——性能测量改用**程序内计时**。

- 内存模型与 `--mem-size` 见 [/tools/memory-cache](/tools/memory-cache)；
- 日志级别与错误面板见 [/tools/logging](/tools/logging)；
- Python API 细节见 [/reference/python-api](/reference/python-api)。

## 程序内计时：time_us() / time_ns()

在 CIN 程序里直接打点。`time_us()` 返回单调微秒计时，`time_ns()` 是纳秒版本（更高分辨率）；两者的实现是引擎侧系统调用（SYS 138/139），不受 `--seed` 影响。

```c
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

## 防止失控：--max-instructions

批处理/判题脚本建议始终带上指令数上限（默认 `100000000`）：

```bash
codecin bench.cin --max-instructions 10000000
```

上限用尽按**失败**处理：引擎返回失败状态，CLI 打印错误面板并以退出码 `1` 结束，不会伪装成"跑完了"。缩小上限可以快速暴露死循环，但不影响正常程序的计时结果。

## 确认运行环境：--build-info

性能结论只在"确实跑在 Go 原生引擎上"时才有意义。发布/部署前先做一次环境自检：

```bash
codecin --build-info
```

它打印版本号、平台与原生库加载状态等环境信息（由 `codecin/version.py` 的 `build_info()` 生成，永不抛异常）。若动态库缺失或 ABI 不匹配，运行程序会直接抛 `CPUSimulatorError` 并附重建指引（`codecin/native/build.ps1` / `build.sh`）——v5.9.0 起没有解释器回退，构建方法见 [/dev/build-native](/dev/build-native)。

## 引擎侧只有 steps 一项计数

原生引擎随结果回传的唯一执行统计是 **steps（执行的指令数）**，由 Python 侧一次性写入 `CPU.stats`：

- `stats.instruction_count` = 引擎返回的步数；
- 逐操作码直方图等细粒度统计不再收集（直方图为空，计数集中在占位项）。

需要更细的性能归因（哪段代码慢）时，用上面的 `time_us()`/`time_ns()` 在程序内分段打点，这是 v5.9.0 起唯一的逐段测量方式。
