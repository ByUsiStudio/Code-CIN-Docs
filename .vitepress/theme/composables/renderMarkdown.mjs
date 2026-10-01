/**
 * 极简 Markdown -> HTML 渲染器 (零依赖, 可被 node 直接执行以便单测)。
 *
 * 为什么不用 markdown-it: 文档站并未安装它 (只有 @types), 直接 import 会让
 * `vitepress build` 在没跑过 npm install 的环境里失败。这里用一个自带的子集渲染器,
 * 好处是**可验证** (纯 ESM, node 能直接跑) 且**不引入新依赖**。
 *
 * 安全模型: **先转义, 再格式化**。
 *   1. 所有文本先做 HTML 转义 (& < > " '), 因此 release body 里写什么 HTML 都只会
 *      以文本形式出现, 不会变成标签;
 *   2. 只有本文件明确生成的标签才会进入最终 HTML;
 *   3. 链接/图片的 URL 经过 safeUrl() 白名单过滤 (只允许 http/https/mailto/相对/锚点),
 *      因此 `javascript:` 之类的协议不会进入 href。
 * 于是组件里的 `v-html` 只可能渲染出本文件构造的标签 —— 注入面被限制在这里。
 *
 * 支持的语法 (覆盖 GitHub release notes 的常见写法):
 *   标题 #..######, 围栏代码块 ```lang, 无序/有序列表, 任务列表 - [x],
 *   引用 >, 表格 | a | b |, 分隔线 ---, 段落;
 *   行内: `code`, **粗体**, *斜体*, ~~删除线~~, [文本](链接), ![alt](图片), 裸链接。
 */

/** HTML 转义 (含单引号, 便于安全地放入属性)。 */
export function escapeHtml(input) {
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** 只允许安全协议: 空(锚点/相对)、http、https、mailto。其余一律丢弃。 */
export function safeUrl(raw) {
  const url = String(raw || '').trim()
  if (!url) return ''
  // 去掉可能用于绕过的控制字符与空白
  const cleaned = url.replace(/[\u0000-\u001F\u007F\s]/g, '')
  if (/^(https?:|mailto:)/i.test(cleaned)) return cleaned
  if (/^[#/.]/.test(cleaned)) return cleaned // 锚点或相对路径
  if (/^[\w.-]+@[\w.-]+$/.test(cleaned)) return 'mailto:' + cleaned
  return ''
}

const PLACEHOLDER = '\u0000'

/**
 * 行内格式化。**入参必须是已经转义过的文本**。
 * 用占位符保护 code / 链接 / 图片, 避免后续的强调规则误改标签内部。
 */
export function renderInline(escaped) {
  const slots = []
  const keep = (html) => {
    slots.push(html)
    return `${PLACEHOLDER}${slots.length - 1}${PLACEHOLDER}`
  }

  let out = escaped

  // 1) 行内代码 (内容已转义, 直接放进 <code>)
  out = out.replace(/`([^`\n]+)`/g, (_m, code) => keep(`<code>${code}</code>`))

  // 2) 图片 ![alt](url) —— 渲染成懒加载图片; URL 不合法则退化为纯 alt 文本
  //    URL 允许一层配对括号, 否则 `javascript:alert(1)` 这种会被从中间截断、
  //    在正文里留下一个孤立的 ')'
  out = out.replace(/!\[([^\]]*)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/g, (_m, alt, url) => {
    const safe = safeUrl(url)
    if (!safe) return alt
    return keep(
      `<img src="${safe}" alt="${alt}" loading="lazy" referrerpolicy="no-referrer">`
    )
  })

  // 3) 链接 [文本](url) —— URL 不合法则只保留文本
  out = out.replace(/\[([^\]]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/g, (_m, text, url) => {
    const safe = safeUrl(url)
    if (!safe) return text
    const external = /^https?:/i.test(safe)
    const attrs = external ? ' target="_blank" rel="noreferrer noopener"' : ''
    return keep(`<a href="${safe}"${attrs}>${text}</a>`)
  })

  // 4) 裸链接 (GitHub 会这样做)
  out = out.replace(/(^|[\s(])(https?:\/\/[^\s<>()"']+)/gi, (_m, pre, url) => {
    const safe = safeUrl(url)
    if (!safe) return pre + url
    return pre + keep(`<a href="${safe}" target="_blank" rel="noreferrer noopener">${url}</a>`)
  })

  // 5) 粗体 / 斜体 / 删除线 (顺序: 先 ** 再 *, 避免 ** 被 * 先吃掉)
  out = out.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/__([^_\n]+)__/g, '<strong>$1</strong>')
  out = out.replace(/(^|[^*\w])\*([^*\n]+)\*/g, '$1<em>$2</em>')
  out = out.replace(/(^|[^_\w])_([^_\n]+)_/g, '$1<em>$2</em>')
  out = out.replace(/~~([^~\n]+)~~/g, '<del>$1</del>')

  // 6) 还原占位符
  out = out.replace(
    new RegExp(`${PLACEHOLDER}(\\d+)${PLACEHOLDER}`, 'g'),
    (_m, i) => slots[Number(i)] ?? ''
  )
  return out
}

const RE_HEADING = /^(#{1,6})\s+(.*)$/
const RE_HR = /^\s*([-*_])(?:\s*\1){2,}\s*$/
const RE_FENCE = /^\s*(```|~~~)\s*([\w+#-]*)\s*$/
const RE_UL = /^\s*[-*+]\s+(.*)$/
const RE_OL = /^\s*\d+[.)]\s+(.*)$/
const RE_QUOTE = /^\s*>\s?(.*)$/
const RE_TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/

const splitRow = (line) =>
  line
    .replace(/^\s*\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
    .map((c) => c.trim())

/** 列表项: 识别 `[ ]` / `[x]` 任务标记。 */
function renderListItem(raw) {
  const task = /^\[([ xX])\]\s+(.*)$/.exec(raw)
  if (task) {
    const checked = task[1].toLowerCase() === 'x'
    return (
      `<input type="checkbox" disabled${checked ? ' checked' : ''}> ` +
      renderInline(escapeHtml(task[2]))
    )
  }
  return renderInline(escapeHtml(raw))
}

/**
 * 把 Markdown 渲染为 HTML 字符串。
 * @param {string} markdown
 * @returns {string}
 */
export function renderMarkdown(markdown) {
  const lines = String(markdown || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
  const html = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (!line.trim()) {
      i++
      continue
    }

    // 围栏代码块
    const fence = RE_FENCE.exec(line)
    if (fence) {
      const marker = fence[1]
      const lang = fence[2]
      i++
      const buf = []
      while (i < lines.length && !new RegExp(`^\\s*${marker}\\s*$`).test(lines[i])) {
        buf.push(lines[i])
        i++
      }
      i++ // 跳过结束围栏 (缺失时 i 越界, 循环自然结束)
      const cls = lang ? ` class="language-${escapeHtml(lang)}"` : ''
      html.push(`<pre class="cin-md-pre"><code${cls}>${escapeHtml(buf.join('\n'))}</code></pre>`)
      continue
    }

    // 分隔线
    if (RE_HR.test(line)) {
      html.push('<hr class="cin-md-hr">')
      i++
      continue
    }

    // 标题
    const heading = RE_HEADING.exec(line)
    if (heading) {
      const level = heading[1].length
      html.push(`<h${level}>${renderInline(escapeHtml(heading[2]))}</h${level}>`)
      i++
      continue
    }

    // 表格: 当前行含 |, 下一行是分隔行
    if (line.includes('|') && i + 1 < lines.length && RE_TABLE_SEP.test(lines[i + 1])) {
      const head = splitRow(line)
      i += 2
      const rows = []
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        rows.push(splitRow(lines[i]))
        i++
      }
      const thead = head.map((c) => `<th>${renderInline(escapeHtml(c))}</th>`).join('')
      const tbody = rows
        .map(
          (r) =>
            '<tr>' +
            r.map((c) => `<td>${renderInline(escapeHtml(c))}</td>`).join('') +
            '</tr>'
        )
        .join('')
      html.push(
        `<div class="cin-md-table-wrap"><table class="cin-md-table">` +
          `<thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table></div>`
      )
      continue
    }

    // 引用
    if (RE_QUOTE.test(line)) {
      const buf = []
      while (i < lines.length && RE_QUOTE.test(lines[i])) {
        buf.push(RE_QUOTE.exec(lines[i])[1])
        i++
      }
      html.push(
        `<blockquote class="cin-md-quote">${renderMarkdown(buf.join('\n'))}</blockquote>`
      )
      continue
    }

    // 列表 (连续同类项归为一个列表)
    if (RE_UL.test(line) || RE_OL.test(line)) {
      const ordered = !RE_UL.test(line)
      const items = []
      while (i < lines.length) {
        const m = ordered ? RE_OL.exec(lines[i]) : RE_UL.exec(lines[i])
        if (!m) {
          // 支持列表项的续行 (缩进的普通行)
          if (items.length && /^\s+\S/.test(lines[i])) {
            items[items.length - 1] += ' ' + lines[i].trim()
            i++
            continue
          }
          break
        }
        items.push(m[1])
        i++
      }
      const tag = ordered ? 'ol' : 'ul'
      html.push(
        `<${tag} class="cin-md-list">` +
          items.map((t) => `<li>${renderListItem(t)}</li>`).join('') +
          `</${tag}>`
      )
      continue
    }

    // 段落 (连续非空行合并)
    const para = []
    while (
      i < lines.length &&
      lines[i].trim() &&
      !RE_HEADING.test(lines[i]) &&
      !RE_FENCE.test(lines[i]) &&
      !RE_HR.test(lines[i]) &&
      !RE_QUOTE.test(lines[i]) &&
      !RE_UL.test(lines[i]) &&
      !RE_OL.test(lines[i])
    ) {
      para.push(lines[i].trim())
      i++
    }
    html.push(`<p class="cin-md-p">${renderInline(escapeHtml(para.join(' ')))}</p>`)
  }

  return html.join('\n')
}
