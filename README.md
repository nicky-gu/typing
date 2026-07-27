# 打字小勇士（小学生英文打字练习）

基于 Cloudflare Pages 的纯静态站点，面向小学生练习英文打字。本地优先、无需登录、进度存浏览器。

## 功能
- 英文打字引擎：实时正确率 / WPM / 错误统计，支持退格纠错
- 5 个渐进关卡：回家键行 → 上行键 → 下行键 → 常用词 → 小句子
- 屏幕键盘 + 指法提示（高亮当前键并提示使用哪根手指）
- 星星奖励 + 完成庆祝动画
- 本地进度保存（localStorage），可一键重置
- 键入音效（Web Audio，无外部音频文件），可开关

## 目录
```
typing-practice/
├── public/            # 静态站点根目录（部署时用这个目录）
│   ├── index.html
│   ├── styles.css
│   ├── lessons.js     # 关卡与练习文本
│   └── app.js         # 打字引擎与逻辑
├── 需求分析.md         # 需求分析文档
└── README.md
```

## 本地预览
直接用浏览器打开 `public/index.html` 即可；或起一个本地静态服务：
```
cd public && python3 -m http.server 8787
```
然后访问 http://localhost:8787

## 部署到 Cloudflare Pages
本站点为零后端纯静态，所有计算都在浏览器本地完成。

### 方式一 · 命令行上传（推荐，无需 Git）
```
npx wrangler pages deploy public
# 首次运行会引导你登录 Cloudflare 账号
```

### 方式二 · 连接 Git 仓库
1. 在 Cloudflare Pages 控制台「Create a project」→ 连接你的 Git 仓库；
2. 构建命令留空，构建输出目录填 `public`；
3. 推送代码即自动部署，全球边缘分发，免费额度充足。

部署后即可获得一个 `*.pages.dev` 域名，也可绑定自定义域名。
