# 打字小勇士（小学生英文打字练习）

基于 Cloudflare Pages 的纯静态站点，面向小学生练习英文打字。本地优先、无需登录、进度存浏览器。

## 功能
- 英文打字引擎：实时正确率 / WPM / CPM / 错误统计，支持退格纠错
- 11 个渐进关卡：回家键行 → 上行/下行 → 词句 → 大写 → 数字 → 符号 → 混合 → 文章 → 随机综合
- 传统英文键盘虚拟键位（数字与符号共用键）+ 透明虚拟手型 + 指法提示
- 每关内置「课前小课堂」教材，键盘可全局显隐
- 星星奖励 + 进步趋势线（WPM / 正确率曲线）
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

### 方式一 · 连接 Git 仓库（推荐，零命令行）
1. 在 Cloudflare Pages 控制台「Create a project」→ 连接你的 Git 仓库；
2. 构建命令留空，构建输出目录填 `public`；
3. 推送代码即自动部署，全球边缘分发，免费额度充足。

### 方式二 · 命令行上传（无需连接 Git）
```
npx wrangler pages deploy public
# 首次运行会引导你登录 Cloudflare 账号
```

部署后即可获得一个 `*.pages.dev` 域名，也可绑定自定义域名。
