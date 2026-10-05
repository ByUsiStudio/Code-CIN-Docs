# Code CIN 官方文档站 (Code-CIN-Docs)

本仓库是 **Code CIN** (`pip install codecin`) 的官方文档站源码, 基于
[VitePress](https://vitepress.dev/) 与
[vitepress-plugin-tabs](https://vitepress-plugins.sapphi.red/tabs/) 构建。
它以 **git submodule** 的方式内嵌在主仓库
[Code-CIN](https://github.com/ByUsiStudio/Code-CIN) 的 `docs/` 目录下。

| 远程 | 地址 |
|------|------|
| origin (Gitee) | `git@gitee.com:byusistudio/codecin-docs.git` |
| github | `git@github.com:ByUsiStudio/Code-CIN-Docs.git` |

## 关于 Code CIN (v5.9.0)

[Code CIN](https://github.com/ByUsiStudio/Code-CIN) (`pip install codecin`) 是一门
语法近似 C/Go 的高级语言 (CIN) 及其工具链。v5.9.0 起 **native-only**: 全部程序由
Go 原生引擎统一执行, 纯 Python 解释器与 JIT 已整体删除, 无解释器回退。

- **单执行路径**: Python 侧负责编译/装载 (`.cin/.asm/.pl/.bin/.crom`), 通过
  ABI v2 (`codecin_run_v2`) 一次调用回传寄存器/向量/NZCV/脏内存段/输出;
- **FFI 与网络**: `dlopen` / `dlsym` / `ffi_call` / `ffi_callf` / `lib_close`
  (标准库 `lib/ffi.cin`), `http_req` / `http_code` / `tcp_*` / `udp_*` /
  `dns_lookup` (标准库 `lib/net.cin`);
- **1 GiB 稀疏内存**: 默认 1073741824 字节, 4 KiB 分页按需提交, 大数组无需调整
  `--mem-size`; 堆基址 = `mem_size//2`, 栈顶 = `(mem_size-8) & ~0x7`;
- **持久化**: 段式 CROM v4 / BIN v3 (只存已分配页), 旧版可读不可写;
- **GUI / 音频 / 键盘**: 窗口 (Win32/X11)、2D 画布、WAV 播放、非阻塞键盘轮询等
  宿主能力, 全部由原生引擎实现;
- **AOT**: `--build-exe` 产出静态单文件可执行程序 (`CGO_ENABLED=0`)。

快速开始 (源码检出):

```bash
git clone https://github.com/ByUsiStudio/Code-CIN.git
cd Code-CIN

# 1) 构建原生库 (必需步骤, 需要 Go 1.26+)
powershell -ExecutionPolicy Bypass -File codecin\native\build.ps1   # Windows
sh codecin/native/build.sh                                          # Linux / macOS / Termux

# 2) 运行
codecin basic.cin                                # 编译并由原生引擎执行
codecin --build-info                             # 版本 / 平台 / 原生库状态
codecin basic.cin --compile-only -o basic.bin    # 仅编译为 UCBC 字节码
codecin basic.cin --build-exe basic              # AOT 独立可执行文件
```

> 原生库缺失或版本不匹配时, 程序启动即抛 `CPUSimulatorError` 并附重建指引。
> `pip install codecin` 从 sdist 安装时会在用户机器上现场编译原生库。
> 完整 CLI 选项以 `codecin --help` 为准; 开发细节见 [BUILDING](BUILDING.md)。

## 本地开发

```bash
npm install          # Node.js >= 18, 首次安装
npm run docs:dev     # 开发预览, 默认 http://localhost:5173
npm run docs:build   # 构建静态站点到 .vitepress/dist
npm run docs:preview # 本地预览构建产物
```

`node_modules/`, `.vitepress/cache/`, `.vitepress/dist/` 均不入库 (见 `.gitignore`)。

## 目录结构

```text
docs/
├── .vitepress/
│   ├── config.mts          # 站点配置: nav / sidebar / 搜索 / tabs markdown 插件
│   └── theme/
│       ├── index.ts        # 注册 vitepress-plugin-tabs 的 Tabs 组件
│       └── style.css       # 品牌色等轻量自定义样式
├── public/                 # 静态资源 (logo.svg 等, 原样拷贝到站点根)
├── index.md                # 首页 (home layout)
├── beginner/               # 初学者教程 (13 章) + 习题与答案 + 语法速查表
├── guide/                  # 安装、快速开始、命令行、执行路径、架构、示例、FAQ
├── language/               # CIN 语言: 词法/类型/运算符/控制流/函数/struct/数组/字符串/内建/宿主能力/模块
├── asm/                    # 汇编: 总览、语法参考、指令语义参考
├── stdlib/                 # 内置标准库总览与逐函数参考
├── runtime/                # Go 原生运行时、二进制格式、AOT
├── tools/                  # 日志与错误输出、性能分析、内存与运行时开关
├── reference/              # 指令集编码表、寄存器与内存模型、Python API、更新日志
├── dev/                    # 项目结构、编译原生库、测试与 CI、打包、扩展、贡献
├── README.md               # 本文件 (不打进站点)
└── ISA.md / CIN_GUIDE.md / BUILDING.md / SUGGESTIONS*.md
                            # 主仓库的开发用文档, 由 config.mts 的 srcExclude 排除, 不作为站点页面
```

> `reference/isa.md` (指令集编码表) 由主仓库脚本 `python script/gen_isa_docs.py` 从
> `codecin/isa.py` 自动生成, **请勿手工编辑**; 同一次运行也会重新生成仓库文档 `ISA.md`。

## 写作约定

- **frontmatter**: 每个页面以三行 frontmatter 开头, 只写一行 `description`
  (含冒号时必须用引号包住, 否则 YAML 解析失败); 正文以唯一的 `# 一级标题` 开始。
- **代码块语言**: CIN 源码用 ` ```c `, 汇编 (ASM/PL) 用 ` ```asm `, shell 用
  ` ```bash ` (Windows 专用命令用 ` ```powershell `), Python 用 ` ```python `,
  Go 用 ` ```go `, 终端输出或纯文本用 ` ```text `。
- **站内链接**: 用绝对路径且不带 `.md` 后缀, 例如 `/language/functions`;
  不要链接被 `srcExclude` 排除的开发文档 (`/ISA`, `/CIN_GUIDE`, `/BUILDING`, ...)。
  VitePress 在构建时会做**死链检查**, 断链会直接让构建失败。
- **提示容器**: `::: tip` / `::: info` / `::: warning` / `::: danger` /
  `::: details 标题`, 结束行是单独一行 `:::`。
- **标签页 (vitepress-plugin-tabs)**: 语法如下, `== 标题` 前后各留空行:

  ````md
  ::: tabs

  == CIN

  ```cin
  println("hi")
  ```

  == PL

  ```asm
  set x0, 1
  output x0
  stop
  ```

  :::
  ````

  多组标签页需要联动时, 给容器加同一个 `key:`:
  `::: tabs key:platform` (同名 key 的标签页会共享选中状态);
  需要移动端/桌面端两套内容时用 `variant:mobile` / `variant:desktop`。

## 新增页面

1. 在对应目录新建 `.md` 文件 (目录约定见上表);
2. 在 `.vitepress/config.mts` 的 `sidebar` 对应分组里加一条
   `{ text: '侧边栏标题', link: '/目录/文件名' }`;
3. 需要出现在顶部导航时改 `nav` (章节级入口);
4. 跑一次 `npm run docs:build` 确认没有死链与 YAML 报错。

## 部署

构建产物是纯静态文件 (`.vitepress/dist`), 可直接托管到任意静态服务器 / 对象存储 /
GitHub Pages / Gitee Pages / Netlify 等:

```bash
npm run docs:build
# 产物目录: docs/.vitepress/dist
```

## 许可

文档内容版权归 ByUsi Studio 所有, 与主项目一致采用 MIT 许可证发布。
问题与反馈: admin@byusistudio.fun
