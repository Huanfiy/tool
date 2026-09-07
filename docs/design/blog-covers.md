# 博客主题 SVG 封面

## 设计边界

**一类主题对应一张封面，同类文章长期复用。** 图片不表达某篇文章、某个工具教程、某种故障或某次生活事件；文件名与配置也不使用文章名称。

- 森林绿、雾青与少量暖橙，低饱和色块、圆润线条、留白；
- 纯 SVG 几何元素，不嵌入位图，没有字体依赖、动画或滤镜；
- 统一 `480 × 320` 画布，包含 `title` / `desc`，卡片替代文本使用主题名称；
- 保留原有的明暗适配、完整构图与简洁画框。

| 主题 | 文件（相对于 `picture/blog/`） | 通用视觉主体 | 标签匹配 |
|---|---|---|---|
| 嵌入式 | `embedded.svg` | 芯片、电路板、引脚与接口 | `嵌入式` |
| 调试 | `debug.svg` | 放大镜与象征程序错误的小虫 | `调试` |
| 实践 | `practice.svg` | 扳手与螺丝刀，表达动手实践 | `实践`、`工程实践` |
| 成长 | `growth.svg` | 幼芽到植株的三个生长阶段 | `成长` |
| 感悟 | `insight.svg` | 思绪与亮起的灯泡 | `感悟` |
| Linux | `linux.svg` | 企鹅与通用命令行窗口 | `Linux`（封面匹配忽略大小写） |
| 通用回退 | `field-notes.svg` | 摊开的笔记本与叶子 | 未知标签或加载失败 |

## 如何复用

新文章填写主题标签即可，通常不需要 `cover`：

```markdown
---
title: 一篇新的嵌入式文章
date: 2026-09-06
tag: 嵌入式
summary: 文章简介。
---

# 一篇新的嵌入式文章
```

运行 `./run.sh gen` 后，索引中的 `cover` 为空字符串，浏览器自动选择 `picture/blog/embedded.svg`。标题、摘要、文件名变化不会影响选图；更改主题标签才会切换主题封面。

少数文章确需自定义图片时，仍可显式指定 `cover` 覆盖默认值；其他页面也可以直接使用这些稳定的 SVG 路径。

## 配置与渲染

- `js/blog-covers.js` 是唯一的主题注册表，记录六类主题的名称、标签别名、图片路径和简短说明；博客及审核页共同使用，审核页不读取文章索引。
- `BlogCovers.getCoverUrl()` 优先取显式 `cover`，否则按 `tag` 匹配分类，未知标签使用通用回退图。匹配前去除标签首尾空白，英文转小写；不改变原有的标签展示与筛选规则。
- `BlogCovers.getCoverAlt()` 为主题插画提供分类级替代文本；自定义图片仍使用文章标题。
- `handleCoverError()` 在加载失败时回退一次，同时替换替代文本并清除错误处理器，不会循环请求。
- `picture/blog/` 下的插画使用 `.illustrated` 与 `object-fit: contain`，自定义图片原有的 `coverFit: contain` 行为仍兼容。
- `.blog-thumb` 的 `color-scheme` 跟随站点主题，SVG 内部通过 `prefers-color-scheme` 选择配色，不受系统主题与手动主题相反的影响。
- SVG 外围透明，由画框的 `--bg-soft` 填充，适应不同比例而不裁切主体。

## 审核与验证

启动 `./run.sh test 8080` 后访问：

- `/blog.html`：真实文章列表；
- `/tests/blog-covers.html`：六类主题及通用封面的日间 / 夜间对照，不绑定文章。

`tests/` 不进入部署产物；截图保存在已忽略的 `tmp/blog-covers-review/`。

```bash
node --test tests/blog-covers.test.js

# 使用环境中已有的 puppeteer-core，不给项目安装包
PUPPETEER_MODULE=/path/to/puppeteer-core \
CHROME_BINARY=/usr/bin/google-chrome \
node tests/blog-covers-browser.cjs
```

浏览器套件全页截图时仅临时禁用卡片的 `content-visibility` 跳过绘制行为，布局断言仍使用生产样式；手机尺寸是 Chromium 视口模拟，不等于真实设备验收。

站点身份 / PWA 图片 `picture/icon.png`、`picture/icon-192.png`、`picture/icon-512.png` 不属于封面体系，不得随封面素材调整。
