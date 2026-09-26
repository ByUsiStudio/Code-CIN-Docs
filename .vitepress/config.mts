import { defineConfig } from 'vitepress'
import { tabsMarkdownPlugin } from 'vitepress-plugin-tabs'

/**
 * Code CIN 官方文档站配置 (VitePress + vitepress-plugin-tabs)
 *
 * - 站点根目录: docs/ (本目录同时是独立 git 仓库 Code-CIN-Docs)
 * - 主题增强:   docs/.vitepress/theme/index.ts (注册 tabs 组件)
 * - 标签页语法: ::: tabs / == 标题 / ::: (由 tabsMarkdownPlugin 解析)
 */
export default defineConfig({
  lang: 'zh-CN',
  title: 'Code CIN',
  description:
    'Code CIN —— 简洁的类 C 高级语言与跨平台运行时: CIN/PL/ASM 工具链、UCPU 字节码、Go 原生 VM / JIT / 解释器三路径一致执行。',

  // 仓库文档 (非站点页面): 保留在主仓库/子仓库中供开发查阅, 不打进站点
  srcExclude: [
    'README.md',
    'ISA.md',
    'CIN_GUIDE.md',
    'BUILDING.md',
    'REMOTE_DEBUG.md',
    'SUGGESTIONS.md',
    'SUGGESTIONS_NEXT.md'
  ],

  lastUpdated: true,
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
    ['meta', { name: 'theme-color', content: '#3b82f6' }],
    ['meta', { name: 'author', content: 'ByUsi Studio' }],
    ['meta', { name: 'keywords', content: 'Code CIN,CIN 语言,UCPU,虚拟机,汇编器,字节码,ISA,VitePress' }]
  ],

  markdown: {
    // vitepress-plugin-tabs: 解析 ::: tabs / == 标题 容器
    config(md) {
      md.use(tabsMarkdownPlugin)
    },
    lineNumbers: false,
    theme: { light: 'github-light', dark: 'github-dark' }
  },

  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'Code CIN',

    nav: [
      { text: '初学者教程', link: '/beginner/', activeMatch: '^/beginner/' },
      { text: '指南', link: '/guide/installation', activeMatch: '^/guide/' },
      { text: 'CIN 语言', link: '/language/', activeMatch: '^/language/' },
      {
        text: '汇编 / ISA',
        activeMatch: '^/(asm|reference/isa)',
        items: [
          { text: '汇编总览', link: '/asm/' },
          { text: '汇编语法', link: '/asm/syntax' },
          { text: '指令语义', link: '/asm/instructions' },
          { text: '指令编码表', link: '/reference/isa' }
        ]
      },
      { text: '标准库', link: '/stdlib/', activeMatch: '^/stdlib/' },
      {
        text: '运行时',
        activeMatch: '^/runtime/',
        items: [
          { text: '执行路径', link: '/guide/execution-paths' },
          { text: 'Go 原生运行时', link: '/runtime/native' },
          { text: 'JIT 编译', link: '/runtime/jit' },
          { text: '二进制格式', link: '/runtime/formats' },
          { text: 'AOT 独立可执行文件', link: '/runtime/aot' }
        ]
      },
      {
        text: '工具',
        activeMatch: '^/tools/',
        items: [
          { text: '交互式调试器', link: '/tools/debugger' },
          { text: '远程调试协议', link: '/tools/remote-debug' },
          { text: '日志与错误输出', link: '/tools/logging' },
          { text: '性能分析', link: '/tools/profiling' },
          { text: '内存与缓存', link: '/tools/memory-cache' }
        ]
      },
      {
        text: '参考',
        activeMatch: '^/reference/',
        items: [
          { text: '指令集编码表', link: '/reference/isa' },
          { text: '寄存器与内存模型', link: '/reference/registers-memory' },
          { text: 'Python 嵌入 API', link: '/reference/python-api' },
          { text: '更新日志', link: '/reference/changelog' }
        ]
      },
      { text: '开发', link: '/dev/structure', activeMatch: '^/dev/' },
      {
        text: '仓库',
        items: [
          { text: '主仓库 (GitHub)', link: 'https://github.com/ByUsiStudio/Code-CIN' },
          { text: '文档仓库 (GitHub)', link: 'https://github.com/ByUsiStudio/Code-CIN-Docs' },
          { text: '主仓库 (Gitee)', link: 'https://gitee.com/byusistudio/codecin' },
          { text: '文档仓库 (Gitee)', link: 'https://gitee.com/byusistudio/codecin-docs' }
        ]
      }
    ],

    sidebar: {
      '/beginner/': [
        {
          text: 'CIN 初学者教程',
          items: [
            { text: '教程导览', link: '/beginner/' },
            { text: '第 1 章 环境与第一个程序', link: '/beginner/ch01-hello' },
            { text: '第 2 章 变量、类型与输入输出', link: '/beginner/ch02-variables' },
            { text: '第 3 章 运算符与表达式', link: '/beginner/ch03-expressions' },
            { text: '第 4 章 条件分支', link: '/beginner/ch04-conditions' },
            { text: '第 5 章 循环', link: '/beginner/ch05-loops' }
          ]
        },
        {
          text: '数据结构与函数',
          items: [
            { text: '第 6 章 函数与递归', link: '/beginner/ch06-functions' },
            { text: '第 7 章 数组', link: '/beginner/ch07-arrays' },
            { text: '第 8 章 字符串与文本处理', link: '/beginner/ch08-strings' },
            { text: '第 9 章 struct 与数据建模', link: '/beginner/ch09-structs' },
            { text: '第 10 章 模块与标准库', link: '/beginner/ch10-modules' }
          ]
        },
        {
          text: '实战与速查',
          items: [
            { text: '第 11 章 文件、画布与系统交互', link: '/beginner/ch11-io-host' },
            { text: '第 12 章 调试与排错', link: '/beginner/ch12-debug' },
            { text: '第 13 章 综合实战 (六个项目)', link: '/beginner/projects' },
            { text: '习题与答案', link: '/beginner/exercises' },
            { text: '语法速查表', link: '/beginner/cheatsheet' }
          ]
        }
      ],
      '/guide/': [
        {
          text: '开始使用',
          items: [
            { text: '安装 Code CIN', link: '/guide/installation' },
            { text: '快速开始', link: '/guide/quickstart' },
            { text: '命令行参考', link: '/guide/cli' },
            { text: '执行路径', link: '/guide/execution-paths' }
          ]
        },
        {
          text: '深入',
          items: [
            { text: '架构总览', link: '/guide/architecture' },
            { text: '示例程序集', link: '/guide/examples' },
            { text: '常见问题 (FAQ)', link: '/guide/faq' }
          ]
        }
      ],
      '/language/': [
        {
          text: 'CIN 语言',
          items: [
            { text: '语言总览', link: '/language/' },
            { text: '词法规则', link: '/language/lexical' },
            { text: '类型系统', link: '/language/types' },
            { text: '变量与作用域', link: '/language/variables' },
            { text: '运算符', link: '/language/operators' },
            { text: '控制流', link: '/language/control-flow' }
          ]
        },
        {
          text: '数据结构与函数',
          items: [
            { text: '函数', link: '/language/functions' },
            { text: 'struct', link: '/language/structs' },
            { text: '数组', link: '/language/arrays' },
            { text: '字符串', link: '/language/strings' }
          ]
        },
        {
          text: '语言能力',
          items: [
            { text: '内建函数', link: '/language/builtins' },
            { text: '宿主能力', link: '/language/host-abilities' },
            { text: '模块与标准库', link: '/language/modules' },
            { text: '内嵌 CPU 指令语句', link: '/language/inline-cpu' }
          ]
        },
        {
          text: '排错',
          items: [{ text: '限制与常见错误', link: '/language/errors' }]
        }
      ],
      '/asm/': [
        {
          text: '汇编',
          items: [
            { text: '汇编总览', link: '/asm/' },
            { text: '汇编语法参考', link: '/asm/syntax' },
            { text: '指令语义参考', link: '/asm/instructions' },
            { text: '指令编码表', link: '/reference/isa' }
          ]
        }
      ],
      '/stdlib/': [
        {
          text: '标准库',
          items: [
            { text: '标准库总览', link: '/stdlib/' },
            { text: '逐库函数参考', link: '/stdlib/reference' }
          ]
        }
      ],
      '/runtime/': [
        {
          text: '运行时',
          items: [
            { text: '执行路径', link: '/guide/execution-paths' },
            { text: 'Go 原生运行时', link: '/runtime/native' },
            { text: 'JIT 编译', link: '/runtime/jit' },
            { text: '二进制格式 (.bin/.crom)', link: '/runtime/formats' },
            { text: 'AOT 独立可执行文件', link: '/runtime/aot' }
          ]
        }
      ],
      '/tools/': [
        {
          text: '工具',
          items: [
            { text: '交互式调试器', link: '/tools/debugger' },
            { text: '远程调试协议', link: '/tools/remote-debug' },
            { text: '日志与错误输出', link: '/tools/logging' },
            { text: '性能分析', link: '/tools/profiling' },
            { text: '内存与缓存', link: '/tools/memory-cache' }
          ]
        }
      ],
      '/reference/': [
        {
          text: '参考手册',
          items: [
            { text: '指令集编码表', link: '/reference/isa' },
            { text: '寄存器与内存模型', link: '/reference/registers-memory' },
            { text: 'Python 嵌入 API', link: '/reference/python-api' },
            { text: '更新日志', link: '/reference/changelog' }
          ]
        }
      ],
      '/dev/': [
        {
          text: '开发者文档',
          items: [
            { text: '项目结构', link: '/dev/structure' },
            { text: '编译 Go 原生库', link: '/dev/build-native' },
            { text: '测试与 CI', link: '/dev/testing' },
            { text: '打包与发布', link: '/dev/packaging' },
            { text: '扩展指令 / 系统调用', link: '/dev/extend' },
            { text: '贡献指南', link: '/dev/contributing' }
          ]
        }
      ]
    },

    outline: { level: [2, 3], label: '本页目录' },

    search: {
      provider: 'local',
      options: {
        translations: {
          button: {
            buttonText: '搜索文档',
            buttonAriaLabel: '搜索文档'
          },
          modal: {
            noResultsText: '无法找到相关结果',
            resetButtonTitle: '清除查询条件',
            footer: {
              selectText: '选择',
              navigateText: '切换',
              closeText: '关闭'
            }
          }
        },
        miniSearch: {
          options: {
            // 中文按字切分, 保证 “函数 / 寄存器” 这类查询可命中
            tokenize: (text: string) =>
              text
                .split(/[\s\p{P}\p{S}]+|(?<=\p{Script=Han})|(?=\p{Script=Han})/u)
                .filter(Boolean)
          }
        }
      }
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/ByUsiStudio/Code-CIN' }
    ],

    editLink: {
      pattern: 'https://github.com/ByUsiStudio/Code-CIN-Docs/edit/main/:path',
      text: '在 GitHub 上编辑此页'
    },

    docFooter: { prev: '上一篇', next: '下一篇' },
    lastUpdated: {
      text: '最后更新于',
      formatOptions: { dateStyle: 'short', timeStyle: 'short' }
    },
    returnToTopLabel: '回到顶部',
    sidebarMenuLabel: '目录',
    darkModeSwitchLabel: '主题',
    lightModeSwitchTitle: '切换到浅色模式',
    darkModeSwitchTitle: '切换到深色模式',

    footer: {
      message: '基于 MIT 许可证发布 · 文档由 VitePress 构建',
      copyright: 'Copyright © 2024-2026 ByUsi Studio · 开发者: 北啊呢'
    }
  }
})
