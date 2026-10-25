---
description: Code CIN 官方开源组织（gitee.com/codecin）：官方 pic 库仓库列表、通过 pic 安装官方包，以及与标准库、主仓库的分工。
---

# 官方生态与开源组织

Code CIN 的官方 pic 库集中托管在 Gitee 组织 **Code CIN**（[gitee.com/codecin](https://gitee.com/codecin)）。
该组织用于发布**可安装的 pic 包**；工具链、运行时与文档源码仍在
[ByUsi Studio](https://gitee.com/byusistudio) 组织下的主仓库与文档仓库中维护。

## 与标准库的分工

| 类型 | 位置 | 使用方式 |
| --- | --- | --- |
| 标准库 | 随工具链分发的 `codecin/lib/` | `import "math.cin"`，无需安装 |
| 官方 pic 库 | 独立仓库发布到中央注册表 | 先 `pic install`，再按包名 `import` |

标准库覆盖语言基础能力（数组、排序、数学、JSON、网络、FFI 等），见 [标准库总览](/stdlib/)；
官方 pic 库面向可独立演进的扩展能力，按包管理器的方式分发与升级。

## 官方仓库

| 仓库 | 说明 |
| --- | --- |
| [rich](https://gitee.com/codecin/rich) | 终端富文本库：markup、面板、表格、进度条、文本树、Markdown 渲染、CIN 源码高亮，以及实时动画与终端输入缓存。MIT 许可证 |
| [package-basic](https://gitee.com/codecin/package-basic) | 最小 pic / mkn 示例包，演示 `mkn build` / `run` / `test` 与包发布流程 |

`rich` 的完整使用说明见 [rich 终端富文本库](/ecosystem/rich)。

## 安装官方库

```bash
pic install rich              # 安装到全局
pic install rich --project    # 安装到当前项目的 pic_modules/，可直接 import
pic install rich@^1.1         # 指定版本范围
```

安装后直接导入：

```cin
import "rich"
```

登录、离线模式、制品校验与中央记录格式见 [pic 包管理](/tools/pic)。
中央注册表记录可查看 `https://package.codecin.org.cn/api/v1/packages/rich/`。

## 官方包约定

官方库统一遵循以下约定，便于被 `pic` / `mkn` 直接消费：

- **双清单**：`pic.toml` 负责分发与版本，`mkn.toml` 负责构建、测试与运行；
- **入口固定**：`src/<package>.cin` 作为包入口（不含 `main`），内部模块放在 `src/internal/`；
- **符号前缀**：公开函数使用库名前缀（如 `rich_`），内部符号使用短前缀（如 `rch_`），避免污染全局命名空间；
- **自带测试**：通过 `mkn test` 运行断言测试，README 列出 API、限制与更新日志；
- **许可证**：默认 MIT。

## 参与与反馈

问题与合并请求直接提到对应仓库，例如 [rich issues](https://gitee.com/codecin/rich/issues)。
通用开发约定见 [贡献指南](/dev/contributing)。
