# Personal Web

开源的静态个人网站，包含博客、在线工具箱和个人展示页面。无需前端构建或应用后端，可直接部署到静态托管平台。线上实例为 [huanfly.com](https://huanfly.com)。

## 功能

- **博客系统** — Markdown 驱动，客户端渲染，文章存放于 `posts/` 目录
- **工具箱** — 图片转 ICO、键位练习、链接转换器
- **工作室** — Three.js 手绘质感的嵌入式工作室（`studio.html`）：可拖动环视、缩放和切换分区镜头；包含 STM32 固件烧录与电路板展开、示波器波形 / 频率调节、焊台与排烟联动、CoreXY 打印机逐层打印无人机机架、FOC 驱动的无刷电机台架调速和机械臂取放演示。新增绿植浇水与模拟土壤湿度联动。支持昼夜灯光、双扇开窗、设备导览和手机触控；无边框显示器直接承载可操作的 HTML huanfly-os，内含终端（始终是浏览器内的访客模拟）、相册与 Robot（仅保留「研究中」占位界面），靠近或退后不会切换桌面或中断应用。
- **个人展示** — 首页、关于页面，响应式布局

## 设计风格

采用罗小黑战记主题，以森林绿（`#5da844`）为主色调，搭配灵气青（`#4fc4cf`）强调色，整体风格清新治愈。大圆角卡片、柔和阴影、玻璃拟态导航栏，配合自托管的滚动入场动画（CSS 关键帧 + IntersectionObserver），营造轻松自然的浏览体验。

首页是一幅会随时间变化的手绘森林绘本：天空按本地时间在清晨、白昼、黄昏与夜晚之间切换，太阳沿弧线移动，夜里换成月牙、星星与草间萤火；远山、森林、山丘三层内联 SVG 随指针与滚动产生视差，落叶会被鼠标的风吹动。坐在山坡上的小黑会用眼神追随指针，悬停时竖起耳朵，点一下会开心地跳起来并说一句话，久不理它就打起瞌睡。主题切换以按钮为圆心扩散揭示，卡片悬停带有跟随指针的柔光与纸片倾斜，页脚草地上还蜷着一只睡着的小黑。所有效果都是原生 HTML / CSS / Canvas，遵循 `prefers-reduced-motion`。

工作室将 Three.js 空间与插画式美术结合：转角木桌由靠墙钢架承重，桌前和中央留空，打印机置于左侧地面，右侧架子摆放三个立体动漫手办。窗扇向外开合，外墙接入近乎同层的庭院、缓坡与连续远地表，由实体墙自然遮挡景物，不再按窗洞投影裁剪。石径、花圃、果树、云鸟采用共享几何与实例化；闭合远景上的静态田园画布按世界方位构图，外围融入纸面留白。关窗平滑减弱微风，减少动态时固定户外动画。纸张、木纹和布料纹理由 Canvas 生成，模型由代码构建。显示器使用 CSS3D 与 WebGL 深度遮挡，保留原生点击、输入、文字选择和滚动。静置时以 30 fps 为目标并缓存阴影，操作镜头或运行设备时最高 60 fps；使用电脑时设备继续运行，切换到后台时暂停场景渲染。

## 技术栈

- HTML5 + CSS3 + 原生 JavaScript，无框架
- [Marked.js](https://github.com/markedjs/marked) — Markdown 解析
- [Font Awesome](https://fontawesome.com/) — 图标
- [Three.js](https://threejs.org/) 0.170.0 — 工作室的程序化模型、镜头与实时渲染（通过 CDN 加载）

## 项目结构

```
├── index.html            # 首页
├── blog.html             # 博客
├── tool.html             # 工具箱（含图片转 ICO）
├── studio.html           # 工作室：可交互场景 + huanfly-os
├── about.html            # 关于
├── css/style.css         # 全局样式
├── css/studio.css        # 3D 工作室的界面与响应式布局
├── css/studio-apps.css   # huanfly-os 应用样式
├── js/script.js          # 通用脚本
├── js/hero-scene.js      # 首页 Hero 景观：时段天空、视差、落叶 / 萤火、小黑互动
├── js/studio.js          # 设备状态、镜头导航与电脑入口
├── js/studio-room.js     # Three.js 场景、程序化模型与设备动画
├── js/studio-art.js      # 本地生成的纸张、木纹、布料与光斑
├── js/studio-monitor.js  # 屏幕原位 HTML 桌面、透视与遮挡
├── js/studio-window.js   # 窗框、玻璃、热区与双扇机械开合
├── js/studio-landscape.js # 同级庭院、连续地表、闭合背景与实例化户外动效
├── js/studio-landscape-art.js # 确定性的静态日夜田园画布
├── js/studio-figures.js  # 置物架上的三个程序化手办
├── js/studio-spirit.js   # 桌上的小精灵：程序化造型与待机 / 戳一戳动画
├── js/studio-spirit-speech.js # 小精灵语料与可替换的 speech provider 接口
├── js/studio-spirit-bubble.js # 跟随 3D 锚点的气泡便签
├── js/studio-apps.js     # huanfly-os：桌面 / 模拟终端 UI / 相册
├── js/studio-guest.js    # 纯浏览器模拟命令；不存在真实终端
├── posts/                # Markdown 博客文章
├── tools/                # 独立网页工具
│   ├── keyboard.html
│   └── buy.html
├── picture/              # 图片资源
└── run.sh                # 部署与测试脚本
```

## 使用

**本地预览：**

```bash
./run.sh test          # 启动本地服务器，默认端口 8080
./run.sh test 3000     # 指定端口
```

**工作室回归测试：**

启动本地服务器后打开 `http://localhost:8080/tests/studio-outdoor.html`，运行窗扇、景观、输出颜色、资源释放和重复初始化的浏览器契约测试。测试不需要包管理器，不随部署发布。软件渲染与移动视口模拟不能替代真机性能验收，待验收项见 [工作室真机验收](docs/todo/studio-real-device-acceptance.md)。

**生成文章索引：**

```bash
./run.sh gen
```

**访客终端与 Robot 状态：**

终端始终是浏览器内的模拟命令，不连接访客电脑或服务器，也没有管理员解锁模式。无需启动任何终端服务。

Robot 目前只保留显示器内的入口和「研究中」静态界面，没有聊天、配置、网络请求或应用后端。通用 Server 计划已移出工作区（git 历史 `2d9c4e7` 可查），暂不实现。

应用回归测试：

```bash
node --test tests/studio-guest.test.js
# 可选：已有 Puppeteer/Chromium 测试环境时运行，不安装前端依赖。
PUPPETEER_MODULE=/absolute/path/to/puppeteer-core node tests/studio-apps-browser.cjs
```

浏览器测试自行启动临时纯静态服务器，检查模拟终端、相册、Robot 占位及工作室契约，不需要 API Key。

**可选 rsync 部署：**

```bash
DEPLOY_TARGET='user@example.com:/srv/www/blog/' \
PUBLIC_BASE_URL='https://blog.example.com' \
./run.sh deploy HEAD
```

部署目标必须通过环境变量注入。仓库不管理 Nginx、TLS、DNS、服务器账号、生产目录或其他托管平台配置。GitHub Pages、Cloudflare Pages、Netlify、Vercel 等平台可直接使用各自的发布工作流，无需调用 `./run.sh deploy`。详细边界见 [发布产物与外部部署边界](docs/design/deployment-architecture.md)。
