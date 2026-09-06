# dsh-ui-taskpanel

DSH（DeepSeek Harness）Web UI 的纯客户端插件：在 UI 右侧浮层（`shell.overlay` slot）加一个可折叠抽屉，聚合当前会话的三类运行信息。

- **任务进度清单** — 当前会话的 todo 投影（`projectionValues.todos`），`in_progress → pending → completed` 排序，含 "已完成 N / 共 M" 进度条。会话不具备该能力（键缺失）时整个面板不渲染。
- **子代理运行状态** — 当前会话的直接子代理（summmaries 中 `origin === "subagent"` 且 `parentId === current`），运行态旋转图标、待交互琥珀点、完成绿点；行点击经 `subagentAddress` → `openSubagent` 跳转；面板可见时通过 `setSubagentCatalogOpen` 订阅目录推送，头部含 `indexSubagentDescendants` 汇总与手动刷新。
- **后台运行任务** — 当前会话的 `jobsBySession` 快照，纯展示：live（running/stopping）置顶并每秒显示已运行时长（仅存在 live 任务时起计时器），settled 折叠进"历史"分区。

## 文件

| 文件 | 说明 |
| --- | --- |
| `package.json` | 包清单；`dsh.client.inject` 声明运行库由 shell 静态表提供，无任何 npm 依赖 |
| `cordis.patch.yml` | bundle patch：注册插件入口（host 半边 no-op） |
| `lib/index.js` | host 加载器入口 stub（`apply()` 为空） |
| `lib/client.js` | 浏览器 bundle：手写 CJS 工厂（`window.__ModuleLoader__.load`），导出 `apply` / `inject` |

## 安装（参考，本仓库不代执行）

把本目录 compose 进 profile `~/.dsh/profiles/web` 后由 DSH client-modules 子系统提供服务，浏览器加载 `lib/client.js`。

dsh plugin --profile web add file:<本插件目录>
（新增 loader entry 后需重启 dsh web 并刷新页面；此后仅改 lib/client.js 会自动 HMR 热重载）

## 行为细节

- 抽屉根节点 `position:absolute; top/right/bottom:0; pointer-events:auto`，只覆盖抽屉自身宽度，不遮挡下方应用（overlay 层本身 `pointer-events:none`）。
- 折叠态为 48px 竖条（展开按钮 + 活跃徽标：in_progress todo 数 + 运行中子代理数 + live 任务数的合计）；展开态默认 340px，左侧 4px 点击折叠条 + 6px 拖拽手柄，宽度可调 280–560px。
- 状态持久化到 `localStorage["dsh.taskpanel.v1"]`：`{ collapsed, width, panels: { todos, subagents, jobs } }`，读写均有 try/catch 兜底。
- 主题只使用经核实的 `--dsw-alias-*` CSS 变量（`bg-layer-1` / `label-*` / `border-l2` / `state-*-primary` / `brand-primary` 等），暗色主题自动生效；容器背景为 `color-mix` 半透明 + `backdrop-filter: blur(12px)`，并保留不透明兜底声明。
- CSS 经 `<style data-plugin="dsh-ui-taskpanel" data-plugin-css="dsh-ui-taskpanel/taskpanel.css">` 注入，HMR 卸载标签后重载会重新注入。
- 所有快照选取器只返回原语或存量引用（数组/对象派生一律走 `useMemo`），避免 `useSyncExternalStoreWithSelector` 的引用不稳定循环。
- 所有文案走 `t()`（NS=`taskpanel`，zh 为键集真源），动态字符串一律以 React 文本节点渲染。

## 自检

```
node --check lib/index.js   # 通过
node --check lib/client.js  # 通过
```
