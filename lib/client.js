window.__ModuleLoader__.load({
	id: "dsh-ui-taskpanel",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const react = require("react");
		const { jsx, jsxs, Fragment } = require("react/jsx-runtime");
		const primitives = require("@deepseek-ai/dsh-client-ui-primitives");

		//#region constants
		const { useState, useEffect, useMemo, useRef, useCallback } = react;

		/** Locale namespace owned by this plugin. */
		const NS = "taskpanel";
		/** Services this plugin's apply() touches. */
		const inject = ["slots", "locale", "sessions"];

		/** localStorage key for the persisted drawer shape (v4: width absent = margin-adaptive). */
		const STORAGE_KEY = "dsh.taskpanel.v4";
		const MIN_WIDTH = 315;
		const MAX_WIDTH = 630;
		const DEFAULT_WIDTH = 383;
		const DEFAULT_PANELS = { todos: true, subagents: true, jobs: true };

		/** Module-level constants so snapshot selectors keep stable references. */
		const EMPTY_JOBS = Object.freeze([]);
		const EMPTY_ROWS = Object.freeze([]);
		const EMPTY_RECORD = Object.freeze({});
		const NO_DESCENDANTS = Object.freeze({ count: 0, runningCount: 0 });

		/** todo sort rank: in_progress first, then pending, completed last. */
		const TODO_RANK = { in_progress: 0, pending: 1, completed: 2 };
		/** Job statuses that still count as live. */
		const JOB_LIVE_STATUS = new Set(["running", "stopping"]);
		const JOB_STATUS_KEYS = new Set(["running", "stopping", "completed", "killed", "failed"]);

		/** Index uninterrupted subagent descendants under each ancestor (local impl, no runtime dep). */
		function indexSubagentDescendants(summaries) {
			const indexed = new Map();
			for (const descendant of Object.values(summaries)) {
				if (descendant.origin !== "subagent") continue;
				const seen = new Set();
				let current = descendant;
				while (current?.origin === "subagent" && current.parentId !== void 0 && !seen.has(current.id)) {
					seen.add(current.id);
					const aggregate = indexed.get(current.parentId);
					if (aggregate === void 0) indexed.set(current.parentId, {
						count: 1,
						runningCount: descendant.running ? 1 : 0
					});
					else {
						aggregate.count += 1;
						if (descendant.running) aggregate.runningCount += 1;
					}
					current = summaries[current.parentId];
				}
			}
			return indexed;
		}
		const runtime = { indexSubagentDescendants };

		/** Primitives are shell-provided; keep direct refs and degrade softly. */
		const DisclosureRow = typeof primitives?.DisclosureRow === "function" ? primitives.DisclosureRow : null;
		const IconPanelLeftOutline16 = primitives?.IconPanelLeftOutline16;
		const IconChevronRightOutline14 = primitives?.IconChevronRightOutline14;
		const IconChecklistOutline14 = primitives?.IconChecklistOutline14;
		const IconAgentPresetOutline16 = primitives?.IconAgentPresetOutline16;
		const IconQueueOutline14 = primitives?.IconQueueOutline14;
		const IconRefreshOutline14 = primitives?.IconRefreshOutline14;
		const IconLoadingOutline16 = primitives?.IconLoadingOutline16;
		const IconCheckOutline16 = primitives?.IconCheckOutline16;
		const IconStopFill16 = primitives?.IconStopFill16;
		const IconWarningOutline16 = primitives?.IconWarningOutline16;
		//#endregion

		//#region css
		// Only --dsw-alias-* tokens verified against shipped dsh-client-ui-* bundles.
		const css = '/* dsh-ui-taskpanel: right-side task drawer */\n'
			+ '.dsh-tp-root{position:absolute;right:0;bottom:0;display:flex;flex-direction:column;pointer-events:auto;box-sizing:border-box;background:var(--dsw-alias-bg-layer-1);background:color-mix(in srgb, var(--dsw-alias-bg-layer-1) 88%, transparent);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border-left:1px solid var(--dsw-alias-border-l2);box-shadow:0 8px 24px rgba(0,0,0,0.08);transition:top 0.15s ease,width 0.2s ease;z-index:1}\n'
			+ '.dsh-tp-root[data-dragging="true"]{transition:none}\n'
			+ '.dsh-tp-root[data-collapsed="true"]{width:48px}\n'
			+ '\n'
			+ '.dsh-tp-rail{flex:1;display:flex;flex-direction:column;align-items:center;gap:8px;padding:10px 0;box-sizing:border-box}\n'
			+ '.dsh-tp-rail-btn{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border:none;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;padding:0}\n'
			+ '.dsh-tp-rail-btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}\n'
			+ '.dsh-tp-badge{min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary-inverted);font-size:11px;line-height:18px;text-align:center;box-sizing:border-box;font-variant-numeric:tabular-nums}\n'
			+ '\n'
			+ '.dsh-tp-collapse-strip{position:absolute;left:0;top:0;bottom:0;width:4px;border:none;padding:0;background:transparent;cursor:pointer}\n'
			+ '.dsh-tp-collapse-strip:hover{background:var(--dsw-alias-interactive-bg-hover)}\n'
			+ '.dsh-tp-resize{position:absolute;left:4px;top:0;bottom:0;width:6px;cursor:col-resize;touch-action:none}\n'
			+ '.dsh-tp-resize::after{content:"";position:absolute;top:50%;left:2px;width:2px;height:28px;transform:translateY(-50%);border-radius:1px;background:var(--dsw-alias-border-l3);opacity:0;transition:opacity 0.15s ease}\n'
			+ '.dsh-tp-root:hover .dsh-tp-resize::after{opacity:1}\n'
			+ '\n'
			+ '.dsh-tp-header{flex:none;display:flex;align-items:center;justify-content:space-between;padding:10px 10px 6px 16px;box-sizing:border-box}\n'
			+ '.dsh-tp-header-title{font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n'
			+ '.dsh-tp-iconbtn{display:inline-flex;align-items:center;justify-content:center;flex:none;width:24px;height:24px;border:none;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;padding:0}\n'
			+ '.dsh-tp-iconbtn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}\n'
			+ '\n'
			+ '.dsh-tp-body{flex:1;min-height:0;overflow-y:auto;box-sizing:border-box;padding:4px 10px 12px 16px;display:flex;flex-direction:column;gap:2px;scrollbar-width:thin;scrollbar-color:var(--dsw-alias-scrollbar-bg-l2) transparent}\n'
			+ '.dsh-tp-body::-webkit-scrollbar{width:8px}\n'
			+ '.dsh-tp-body::-webkit-scrollbar-thumb{background:var(--dsw-alias-scrollbar-bg-l2);border-radius:4px}\n'
			+ '.dsh-tp-body::-webkit-scrollbar-thumb:hover{background:var(--dsw-alias-scrollbar-hover-l2)}\n'
			+ '\n'
			+ '.dsh-tp-panel{display:flex;flex-direction:column;gap:6px;padding:2px 2px 10px 2px;box-sizing:border-box}\n'
			+ '.dsh-tp-meta{font-size:11px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;white-space:nowrap}\n'
			+ '.dsh-tp-empty{padding:8px 4px;font-size:12px;color:var(--dsw-alias-label-tertiary)}\n'
			+ '.dsh-tp-hint{padding:6px 4px 2px;font-size:11px;color:var(--dsw-alias-label-dimmed)}\n'
			+ '\n'
			+ '.dsh-tp-progress-row{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--dsw-alias-label-secondary);padding:0 4px}\n'
			+ '.dsh-tp-track{flex:1;height:4px;border-radius:2px;background:var(--dsw-alias-border-l2);overflow:hidden}\n'
			+ '.dsh-tp-fill{height:100%;border-radius:2px;background:var(--dsw-alias-brand-primary);transition:width 0.2s ease}\n'
			+ '\n'
			+ '.dsh-tp-todo{display:flex;align-items:flex-start;gap:8px;padding:3px 4px;font-size:12px;line-height:1.45;color:var(--dsw-alias-label-primary)}\n'
			+ '.dsh-tp-todo-icon{flex:none;display:inline-flex;margin-top:1px}\n'
			+ '.dsh-tp-todo-text{flex:1;min-width:0;overflow-wrap:anywhere}\n'
			+ '.dsh-tp-strike{text-decoration:line-through;color:var(--dsw-alias-label-dimmed)}\n'
			+ '\n'
			+ '.dsh-tp-dot{flex:none;display:inline-block;width:8px;height:8px;border-radius:50%}\n'
			+ '.dsh-tp-dot-idle{background:var(--dsw-alias-label-dimmed)}\n'
			+ '.dsh-tp-dot-ok{background:var(--dsw-alias-state-success-primary)}\n'
			+ '.dsh-tp-dot-warn{background:var(--dsw-alias-state-warn-primary)}\n'
			+ '.dsh-tp-brand{color:var(--dsw-alias-brand-primary)}\n'
			+ '.dsh-tp-ok{color:var(--dsw-alias-state-success-primary)}\n'
			+ '.dsh-tp-warn{color:var(--dsw-alias-state-warn-primary)}\n'
			+ '.dsh-tp-err{color:var(--dsw-alias-state-error-primary)}\n'
			+ '@keyframes dsh-taskpanel-spin{to{transform:rotate(360deg)}}\n'
			+ '.dsh-tp-spin{display:inline-flex;flex:none;animation:dsh-taskpanel-spin 1s linear infinite}\n'
			+ '@media (prefers-reduced-motion: reduce){.dsh-tp-spin{animation:none}}\n'
			+ '\n'
			+ '.dsh-tp-sub{display:flex;align-items:flex-start;gap:8px;width:100%;text-align:left;background:transparent;border:none;border-radius:8px;padding:6px 8px;cursor:pointer;color:inherit}\n'
			+ '.dsh-tp-sub:hover{background:var(--dsw-alias-interactive-bg-hover)}\n'
			+ '.dsh-tp-sub-icon{flex:none;display:inline-flex;margin-top:2px}\n'
			+ '.dsh-tp-sub-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}\n'
			+ '.dsh-tp-sub-title{font-size:12px;color:var(--dsw-alias-label-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n'
			+ '.dsh-tp-sub-meta{display:flex;align-items:center;gap:6px;min-width:0;font-size:11px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n'
			+ '.dsh-tp-sub-time{margin-left:auto;flex:none;font-variant-numeric:tabular-nums}\n'
			+ '\n'
			+ '.dsh-tp-diag{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:8px;font-size:11px;color:var(--dsw-alias-label-tertiary)}\n'
			+ '.dsh-tp-error{display:flex;align-items:center;gap:8px;padding:6px 4px;font-size:12px;color:var(--dsw-alias-state-error-primary)}\n'
			+ '.dsh-tp-error-msg{flex:1;min-width:0;overflow-wrap:anywhere}\n'
			+ '\n'
			+ '.dsh-tp-job{display:flex;flex-direction:column;gap:2px;padding:5px 4px;border-radius:8px}\n'
			+ '.dsh-tp-job:hover{background:var(--dsw-alias-interactive-bg-hover)}\n'
			+ '.dsh-tp-job-line{display:flex;align-items:center;gap:6px;min-width:0}\n'
			+ '.dsh-tp-job-icon{flex:none;display:inline-flex}\n'
			+ '.dsh-tp-job-kind{flex:none;max-width:84px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;line-height:1;padding:2px 5px;border-radius:4px;box-sizing:border-box;background:var(--dsw-alias-interactive-bg-hover);border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);text-transform:uppercase;letter-spacing:0.02em}\n'
			+ '.dsh-tp-job-label{flex:1;min-width:0;font-size:12px;color:var(--dsw-alias-label-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n'
			+ '.dsh-tp-job-time{flex:none;font-size:11px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}\n'
			+ '.dsh-tp-job-detail{font-size:11px;color:var(--dsw-alias-label-tertiary);padding-left:20px;overflow-wrap:anywhere}\n'
			+ '\n'
			+ '.dsh-tp-subhead{display:flex;align-items:center;gap:4px;width:100%;background:transparent;border:none;border-radius:6px;padding:4px;font-size:11px;color:var(--dsw-alias-label-secondary);cursor:pointer;box-sizing:border-box}\n'
			+ '.dsh-tp-subhead:hover{background:var(--dsw-alias-interactive-bg-hover)}\n'
			+ '.dsh-tp-chev{display:inline-flex;flex:none;transition:transform 0.15s ease}\n'
			+ '.dsh-tp-chev-open{transform:rotate(90deg)}\n'
			+ '\n'
			+ '.dsh-tp-localdisc{display:flex;flex-direction:column;gap:4px}\n'
			+ '.dsh-tp-localdisc-row{display:flex;align-items:center;gap:8px;width:100%;background:transparent;border:none;border-radius:6px;padding:6px 4px;font-size:12px;color:var(--dsw-alias-label-primary);cursor:pointer;box-sizing:border-box}\n'
			+ '.dsh-tp-localdisc-row:hover{background:var(--dsw-alias-interactive-bg-hover)}\n'
			+ '.dsh-tp-localdisc-title{flex:none;font-size:12px;font-weight:500;color:var(--dsw-alias-label-primary)}\n'
			+ '.dsh-tp-localdisc-body{padding:2px 2px 8px 4px}\n'
			+ '/* left-align the conversation body with the Chat tab (28px = header 20px + tabs 8px) */\n'
			+ '[data-conversation-scroll] .EvIC1a_scroll{padding-left:0px}\n'
			+ '[data-conversation-scroll] .EvIC1a_column{margin:0 auto 0 0}\n'
			+ '[data-conversation-scroll] .wSkVaW_viewArea{padding-left:28px}\n'
			+ '[data-conversation-scroll] .uV2eYG_root{padding-left:28px;align-items:flex-start}\n'
			+ '[data-conversation-scroll] .lXshSW_root{margin:0 auto 0 28px}\n'
			+ '[data-conversation-scroll] .uV2eYG_card{max-width:var(--dsh-chat-content-width)}\n'
			+ '[data-conversation-scroll] .uV2eYG_notice{max-width:var(--dsh-chat-content-width)}\n'
			+ '[data-conversation-scroll] .nLMEza_dock{margin:0 auto 0 28px}\n'
			+ '[data-conversation-scroll] .nLMEza_bar{margin:0 auto 0 0}\n'
			+ '[data-conversation-scroll] ._7yHdaG_dock{margin-left:28px;padding:0}\n'
			+ '[data-conversation-scroll] .EvIC1a_toBottomSlot{padding-right:max(0px, calc(100% - var(--dsh-chat-content-width)))}\n';

		const tagId = "dsh-ui-taskpanel/taskpanel.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-ui-taskpanel";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		//#endregion

		//#region dictionaries
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			"panel.title": "任务面板",
			"panel.collapse": "收起",
			"panel.expand": "展开",
			"panel.resize": "拖拽调整宽度",
			"panel.badge": "{count} 项进行中",
			"todos.title": "任务进度",
			"todos.empty": "暂无任务清单",
			"todos.progress": "已完成 {done} / 共 {total}",
			"subagents.title": "子代理",
			"subagents.empty": "暂无子代理",
			"subagents.refresh": "刷新",
			"subagents.retry": "重试",
			"subagents.loading": "目录加载中",
			"subagents.unavailable": "目录不可用",
			"subagents.notLoaded": "刷新以加载目录",
			"subagents.summary": "{count} 个子代理 · {running} 运行中",
			"subagents.rel.just": "刚刚",
			"subagents.rel.minutes": "{m} 分钟前",
			"subagents.rel.hours": "{h} 小时前",
			"subagents.diagnostic": "异常记录：{reason}",
			"jobs.title": "后台任务",
			"jobs.empty": "暂无后台任务",
			"jobs.live": "进行中",
			"jobs.history": "历史",
			"jobs.elapsed": "已运行 {t}",
			"jobs.duration": "耗时 {t}",
			"jobs.dur.seconds": "{s}秒",
			"jobs.dur.minutes": "{m}分{s}秒",
			"jobs.dur.hours": "{h}小时{m}分",
			"jobs.status.running": "运行中",
			"jobs.status.stopping": "正在停止",
			"jobs.status.completed": "已完成",
			"jobs.status.killed": "已取消",
			"jobs.status.failed": "已失败"
		};

		/** English dictionary, key-identical to the Chinese source of truth. */
		const en = {
			"panel.title": "Task Panel",
			"panel.collapse": "Collapse",
			"panel.expand": "Expand",
			"panel.resize": "Drag to resize",
			"panel.badge": "{count} active",
			"todos.title": "Todos",
			"todos.empty": "No todo list yet",
			"todos.progress": "{done} of {total} done",
			"subagents.title": "Subagents",
			"subagents.empty": "No subagents",
			"subagents.refresh": "Refresh",
			"subagents.retry": "Retry",
			"subagents.loading": "Loading catalog",
			"subagents.unavailable": "Catalog unavailable",
			"subagents.notLoaded": "Refresh to load catalog",
			"subagents.summary": "{count} subagents · {running} running",
			"subagents.rel.just": "just now",
			"subagents.rel.minutes": "{m}m ago",
			"subagents.rel.hours": "{h}h ago",
			"subagents.diagnostic": "Unavailable: {reason}",
			"jobs.title": "Background Jobs",
			"jobs.empty": "No background jobs",
			"jobs.live": "Live",
			"jobs.history": "History",
			"jobs.elapsed": "{t} elapsed",
			"jobs.duration": "{t} total",
			"jobs.dur.seconds": "{s}s",
			"jobs.dur.minutes": "{m}m {s}s",
			"jobs.dur.hours": "{h}h {m}m",
			"jobs.status.running": "running",
			"jobs.status.stopping": "stopping",
			"jobs.status.completed": "completed",
			"jobs.status.killed": "killed",
			"jobs.status.failed": "failed"
		};
		//#endregion

		//#region utilities
		/** Join truthy class-name parts. */
		function cx() {
			let out = "";
			for (const part of arguments) {
				if (part) out = out === "" ? part : out + " " + part;
			}
			return out;
		}

		function clampWidth(value) {
			if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_WIDTH;
			return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(value)));
		}

		/** Coerce any host string into a safe plain-text child. */
		function textOf(value) {
			return typeof value === "string" ? value : value == null ? "" : String(value);
		}

		function normalizePanels(value) {
			const panels = { todos: true, subagents: true, jobs: true };
			if (value != null && typeof value === "object") {
				for (const key of ["todos", "subagents", "jobs"]) {
					if (typeof value[key] === "boolean") panels[key] = value[key];
				}
			}
			return panels;
		}

		/** Read the persisted drawer shape; any failure falls back to defaults. */
		function loadDrawerState() {
			let parsed = null;
			try {
				const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(STORAGE_KEY);
				parsed = raw === null ? null : JSON.parse(raw);
			} catch (error) {
				parsed = null;
			}
			if (parsed === null || typeof parsed !== "object") {
				return { collapsed: true, width: null, panels: { ...DEFAULT_PANELS } };
			}
			return {
				collapsed: parsed.collapsed === true,
				width: typeof parsed.width === "number" && Number.isFinite(parsed.width) ? clampWidth(parsed.width) : null,
				panels: normalizePanels(parsed.panels)
			};
		}

		function saveDrawerState(state) {
			try {
				localStorage.setItem(STORAGE_KEY, JSON.stringify({
					collapsed: state.collapsed === true,
					...(state.width == null ? {} : { width: clampWidth(state.width) }),
					panels: normalizePanels(state.panels)
				}));
			} catch (error) {
				/* storage unavailable (private mode/quota) — shape stays in-memory only */
			}
		}

		function pad2(value) {
			return value < 10 ? "0" + value : String(value);
		}

		/** Wall-clock style HH:MM:SS for live job elapsed readouts. */
		function formatClock(elapsedMs) {
			const total = Math.max(0, Math.floor((Number.isFinite(elapsedMs) ? elapsedMs : 0) / 1000));
			return pad2(Math.floor(total / 3600)) + ":" + pad2(Math.floor(total / 60) % 60) + ":" + pad2(total % 60);
		}

		/** Compact settled duration, mirroring ui-jobs vocabulary widths. */
		function formatDuration(elapsedMs, t) {
			const total = Math.max(0, Math.floor((Number.isFinite(elapsedMs) ? elapsedMs : 0) / 1000));
			const seconds = total % 60;
			const minutes = Math.floor(total / 60) % 60;
			const hours = Math.floor(total / 3600);
			if (hours > 0) return t("jobs.dur.hours", { h: hours, m: minutes });
			if (minutes > 0) return t("jobs.dur.minutes", { m: minutes, s: seconds });
			return t("jobs.dur.seconds", { s: seconds });
		}

		/** Relative update time for subagent rows; null when not computable. */
		function relTime(deltaMs, t) {
			if (!Number.isFinite(deltaMs) || deltaMs < 0) return null;
			const minutes = Math.floor(deltaMs / 60000);
			if (minutes < 1) return t("subagents.rel.just");
			if (minutes < 60) return t("subagents.rel.minutes", { m: minutes });
			return t("subagents.rel.hours", { h: Math.floor(minutes / 60) });
		}

		/** Sort todos in_progress → pending → completed, stable inside a status. */
		function sortTodos(items) {
			const rank = (item) => {
				const value = TODO_RANK[item?.status];
				return typeof value === "number" ? value : 3;
			};
			return items.map((item, index) => ({ item, index })).sort((left, right) => {
				const byRank = rank(left.item) - rank(right.item);
				return byRank !== 0 ? byRank : left.index - right.index;
			}).map((entry) => entry.item);
		}

		/** Direct subagent children of a session, newest update first. */
		function subagentRowsOf(ids, byId, parentId) {
			if (parentId == null || !Array.isArray(ids) || byId == null || typeof byId !== "object") return EMPTY_ROWS;
			const rows = [];
			for (const id of ids) {
				const row = byId[id];
				if (row == null || row.origin !== "subagent" || row.parentId == null || row.parentId !== parentId) continue;
				rows.push(row);
			}
			rows.sort((left, right) => (Number.isFinite(right.updatedAt) ? right.updatedAt : 0) - (Number.isFinite(left.updatedAt) ? left.updatedAt : 0));
			return rows;
		}

		/** Render an icon component defensively, degrading to a neutral dot. */
		function renderIcon(Comp, props, fallbackClassName) {
			if (typeof Comp === "function") return jsx(Comp, props ?? {});
			return jsx("span", { className: fallbackClassName ?? "dsh-tp-dot dsh-tp-dot-idle", "aria-hidden": true });
		}

		/** Minimal local disclosure used only when the shell primitive is absent. */
		function LocalDisclosure(props) {
			const { icon, title, open, expandable, onToggle, collapsedContent, children } = props;
			return jsxs("div", { className: "dsh-tp-localdisc", children: [
				jsxs("button", {
					type: "button",
					className: "dsh-tp-localdisc-row",
					"aria-expanded": open === true,
					onClick: () => {
						if (expandable !== false && typeof onToggle === "function") onToggle();
					},
					children: [
						jsx("span", { className: "dsh-tp-sub-icon", children: icon ?? null }),
						jsx("span", { className: "dsh-tp-localdisc-title", children: title }),
						collapsedContent ?? null,
						renderIcon(IconChevronRightOutline14, { className: cx("dsh-tp-chev", open ? "dsh-tp-chev-open" : "") })
					]
				}),
				open ? jsx("div", { className: "dsh-tp-localdisc-body", children }) : null
			] });
		}

		const PanelDisclosure = typeof DisclosureRow === "function" ? DisclosureRow : LocalDisclosure;
		//#endregion

		//#region geometry
		/** Measure the content-area top edge, its bottom edge (composer seat top), and the right margin. */
		function measureScrollportGeometry(scrollBody, seat) {
			if (!(scrollBody instanceof HTMLElement)) return { topPx: null, bottomPx: 0, adaptiveWidth: DEFAULT_WIDTH };
			const rect = scrollBody.getBoundingClientRect();
			let contentWidth = 800;
			try {
				const raw = window.getComputedStyle(scrollBody).getPropertyValue("--dsh-chat-content-width");
				const parsed = parseFloat(raw);
				if (Number.isFinite(parsed) && parsed > 0) contentWidth = parsed;
			} catch (error) {
				/* keep the fallback */
			}
			// The body is left-aligned now; measure the real right gap after the content column.
			let columnRight = null;
			const column = scrollBody.querySelector(".EvIC1a_column");
			if (column instanceof HTMLElement) {
				const columnRect = column.getBoundingClientRect();
				if (columnRect.width > 0) columnRight = columnRect.right;
			}
			const margin = columnRight == null
				? Math.max(0, (rect.width - contentWidth) / 2 - 8)
				: Math.max(0, rect.right - columnRight - 8);
			// The drawer spans exactly the transcript area: from the scrollport top edge
			// down to the composer seat top edge (the body area bottom).
			let bottomPx = 0;
			if (seat instanceof HTMLElement) {
				const seatRect = seat.getBoundingClientRect();
				if (Number.isFinite(seatRect.top)) bottomPx = Math.max(0, window.innerHeight - seatRect.top);
			}
			return { topPx: rect.top, bottomPx, adaptiveWidth: clampWidth(Math.min(DEFAULT_WIDTH, margin)) };
		}

		/** Track the content-area geometry (top/bottom edges) for the current session.
		* Re-runs when the session changes: the conversation column is recreated per
		* session, so stale element references must not be carried across. */
		function useScrollportGeometry(currentId) {
			const [geometry, setGeometry] = useState(() => ({ topPx: null, bottomPx: 0, adaptiveWidth: DEFAULT_WIDTH }));
			useEffect(() => {
				const scrollBody = document.querySelector('[data-conversation-scroll]');
				if (!(scrollBody instanceof HTMLElement)) return;
				const seat = scrollBody.querySelector('[data-composer-seat]');
				let disposed = false;
				let raf1 = 0;
				let raf2 = 0;
				const measure = () => {
					if (disposed) return;
					// Re-query every pass: the column may be recreated between sessions,
					// and a transient teardown must keep the last good geometry instead
					// of jumping to the corner.
					const body = document.querySelector('[data-conversation-scroll]');
					if (!(body instanceof HTMLElement) || !body.isConnected) return;
					const s = body.querySelector('[data-composer-seat]');
					setGeometry(measureScrollportGeometry(body, s instanceof HTMLElement && s.isConnected ? s : null));
				};
				measure();
				raf1 = window.requestAnimationFrame(measure);
				raf2 = window.requestAnimationFrame(measure);
				let observer = null;
				if (typeof ResizeObserver === "function") {
					observer = new ResizeObserver(measure);
					observer.observe(scrollBody);
					if (seat instanceof HTMLElement) observer.observe(seat);
					// The header above the scrollport changes height per session type,
					// moving the scrollport without resizing it — watch the root too.
					if (scrollBody.parentElement instanceof HTMLElement && scrollBody.parentElement !== scrollBody) {
						observer.observe(scrollBody.parentElement);
					}
				}
				window.addEventListener("resize", measure);
				return () => {
					disposed = true;
					window.cancelAnimationFrame(raf1);
					window.cancelAnimationFrame(raf2);
					if (observer !== null) observer.disconnect();
					window.removeEventListener("resize", measure);
				};
			}, [currentId]);
			return geometry;
		}

		/** True while the details column is open — the drawer yields the right edge entirely.
		* The details resize pill ([data-side="details"]) mounts only while the column is
		* open, so the always-mounted SIDEBAR handle locates the frame and its marker. */
		function useDetailsOpen() {
			const [open, setOpen] = useState(() => {
				const frame = document.querySelector('[data-side="sidebar"]')?.parentElement;
				if (frame == null) return false;
				return !frame.hasAttribute("data-details-collapsed");
			});
			useEffect(() => {
				const frame = document.querySelector('[data-side="sidebar"]')?.parentElement;
				if (frame == null || typeof MutationObserver !== "function") return;
				const observer = new MutationObserver(() => {
					setOpen(!frame.hasAttribute("data-details-collapsed"));
				});
				observer.observe(frame, { attributes: true, attributeFilter: ["data-details-collapsed"] });
				return () => observer.disconnect();
			}, []);
			return open;
		}
		//#endregion

		//#region selectors
		/** Todos of the current session; undefined = capability missing, null/[] = empty. */
		function selectCurrentTodos(state) {
			const current = state?.current;
			if (current == null || state.byId == null || typeof state.byId !== "object") return undefined;
			const row = state.byId[current];
			if (row == null) return undefined;
			const projectionValues = row.projectionValues;
			if (projectionValues == null || typeof projectionValues !== "object") return undefined;
			return projectionValues.todos;
		}

		/** Jobs of the current session; missing key = empty set (host sends no baseline). */
		function selectCurrentJobs(state) {
			const current = state?.current;
			if (current == null || state.jobsBySession == null || typeof state.jobsBySession !== "object") return undefined;
			return state.jobsBySession[current];
		}

		/** Single number (primitive, identity-stable) counting all "active" work. */
		function countActiveWork(state) {
			const current = state?.current;
			if (current == null) return 0;
			let count = 0;
			const byId = state.byId != null && typeof state.byId === "object" ? state.byId : EMPTY_RECORD;
			const row = byId[current];
			if (row != null && row.projectionValues != null && Array.isArray(row.projectionValues.todos)) {
				for (const todo of row.projectionValues.todos) {
					if (todo != null && todo.status === "in_progress") count++;
				}
			}
			if (Array.isArray(state.ids)) {
				for (const id of state.ids) {
					const child = byId[id];
					if (child != null && child.origin === "subagent" && child.parentId === current && child.running === true) count++;
				}
			}
			const jobs = state.jobsBySession != null && typeof state.jobsBySession === "object" ? state.jobsBySession[current] : undefined;
			if (Array.isArray(jobs)) {
				for (const job of jobs) {
					if (job != null && JOB_LIVE_STATUS.has(job.status)) count++;
				}
			}
			return count;
		}
		//#endregion

		//#region todos panel
		/**
		* Current session todo list with progress summary. Renders nothing while the
		* capability is absent (projection key missing) so ordinary sessions stay clean.
		* @param props - drawer props plus the controlled disclosure state.
		* @returns the panel, or null when the session has no todo capability.
		*/
		function TodosPanel({ useSessions, t, open, onOpenChange }) {
			const todos = useSessions(selectCurrentTodos);
			const sorted = useMemo(() => sortTodos(Array.isArray(todos) ? todos : []), [todos]);
			if (todos === undefined) return null;
			const total = sorted.length;
			const done = sorted.reduce((accumulator, item) => (item?.status === "completed" ? accumulator + 1 : accumulator), 0);
			const percent = total > 0 ? Math.round((done / total) * 100) : 0;
			return jsx(PanelDisclosure, {
				icon: renderIcon(IconChecklistOutline14, { size: 14 }),
				title: t("todos.title"),
				open: open === true,
				expandable: true,
				expandOnRowClick: true,
				onToggle: () => onOpenChange(!(open === true)),
				collapsedContent: total > 0 ? jsx("span", { className: "dsh-tp-meta", children: done + " / " + total }) : undefined,
				children: jsxs("div", { className: "dsh-tp-panel", children: [
					jsxs("div", { className: "dsh-tp-progress-row", children: [
						jsx("span", { children: t("todos.progress", { done, total }) }),
						jsx("span", { className: "dsh-tp-track", role: "progressbar", "aria-valuenow": done, "aria-valuemin": 0, "aria-valuemax": total, children: jsx("span", { className: "dsh-tp-fill", style: { width: percent + "%" } }) })
					] }),
					total === 0 ? jsx("div", { className: "dsh-tp-empty", children: t("todos.empty") }) : sorted.map((item, index) => {
						const status = item?.status === "in_progress" || item?.status === "pending" || item?.status === "completed" ? item.status : "pending";
						const content = textOf(item?.content);
						const leading = status === "in_progress"
							? renderIcon(IconLoadingOutline16, { size: 14, className: "dsh-tp-spin dsh-tp-brand" })
							: status === "completed"
								? renderIcon(IconCheckOutline16, { size: 14, className: "dsh-tp-ok" })
								: jsx("span", { className: "dsh-tp-dot dsh-tp-dot-idle", "aria-hidden": true });
						return jsxs("div", { className: "dsh-tp-todo", "data-status": status, children: [
							jsx("span", { className: "dsh-tp-todo-icon", children: leading }),
							jsx("span", { className: status === "completed" ? "dsh-tp-todo-text dsh-tp-strike" : "dsh-tp-todo-text", title: content, children: content })
						] }, index);
					})
				] })
			});
		}
		//#endregion

		//#region subagents panel
		/**
		* Current session's subagent rows (from session summaries) plus catalog
		* diagnostics, with live catalog subscription while visible.
		* @param props - drawer props, the sessions service face, and disclosure state.
		* @returns the panel.
		*/
		function SubagentsPanel({ useSessions, sessions, t, currentId, drawerExpanded, open, onOpenChange }) {
			const ids = useSessions((state) => state?.ids);
			const byId = useSessions((state) => state?.byId);
			const catalog = useSessions((state) => (state?.current == null ? undefined : state.subagentsByParent?.[state.current]));
			const rows = useMemo(() => subagentRowsOf(Array.isArray(ids) ? ids : EMPTY_ROWS, byId, currentId), [ids, byId, currentId]);
			const descendants = useMemo(() => {
				if (indexSubagentDescendants === null || currentId == null || byId == null || typeof byId !== "object") return NO_DESCENDANTS;
				try {
					return indexSubagentDescendants(byId).get(currentId) ?? NO_DESCENDANTS;
				} catch (error) {
					return NO_DESCENDANTS;
				}
			}, [byId, currentId]);
			const catalogActivity = useMemo(() => {
				const map = new Map();
				if (catalog != null && Array.isArray(catalog.entries)) {
					for (const entry of catalog.entries) {
						if (entry != null && entry.kind === "child" && entry.id != null) map.set(entry.id, entry.activity);
					}
				}
				return map;
			}, [catalog]);
			const diagnostics = useMemo(() => {
				if (catalog == null || !Array.isArray(catalog.entries)) return EMPTY_ROWS;
				return catalog.entries.filter((entry) => entry != null && entry.kind === "diagnostic");
			}, [catalog]);
			const catalogOpen = drawerExpanded === true && open === true;
			const [now, setNow] = useState(() => Date.now());
			const [refreshing, setRefreshing] = useState(false);
			const refreshingRef = useRef(false);
			const sessionsRef = useRef(sessions);
			sessionsRef.current = sessions;

			// Subscribe to catalog pushes only while the panel is actually visible.
			useEffect(() => {
				if (!catalogOpen || currentId == null) return;
				const parentId = currentId;
				try {
					sessionsRef.current.setSubagentCatalogOpen(parentId, true);
				} catch (error) {
					/* service hiccup — the manual refresh path still works */
				}
				return () => {
					try {
						sessionsRef.current.setSubagentCatalogOpen(parentId, false);
					} catch (error) {
						/* teardown races a disposed service — nothing to recover */
					}
				};
			}, [catalogOpen, currentId]);

			// Coarse ticker so "x 分钟前" labels stay honest while the panel is open.
			useEffect(() => {
				if (!catalogOpen) return;
				const timer = setInterval(() => setNow(Date.now()), 30000);
				return () => clearInterval(timer);
			}, [catalogOpen]);

			const refresh = useCallback(() => {
				if (currentId == null || refreshingRef.current) return;
				refreshingRef.current = true;
				setRefreshing(true);
				let finished = false;
				const finish = () => {
					if (finished) return;
					finished = true;
					refreshingRef.current = false;
					setRefreshing(false);
				};
				try {
					const promise = sessionsRef.current.refreshSubagents(currentId);
					if (promise != null && typeof promise.then === "function") promise.then(finish, finish);
					else finish();
				} catch (error) {
					finish();
				}
				// Safety net: never leave the spinner stuck on a dropped promise.
				setTimeout(finish, 15000);
			}, [currentId]);

			const openRow = (row) => {
				try {
					const address = sessionsRef.current.subagentAddress(row.id);
					if (address != null) sessionsRef.current.openSubagent(address);
					else sessionsRef.current.open(row.id);
				} catch (error) {
					/* navigation is best-effort; the row stays clickable */
				}
			};

			const catalogState = catalog == null ? undefined : catalog.state;
			const catalogError = catalogState === "error" ? catalog.error : null;
			const isEmpty = rows.length === 0 && diagnostics.length === 0 && catalogState !== "error";

			return jsx(PanelDisclosure, {
				icon: renderIcon(IconAgentPresetOutline16, { size: 14 }),
				title: t("subagents.title"),
				open: open === true,
				expandable: true,
				expandOnRowClick: true,
				onToggle: () => onOpenChange(!(open === true)),
				collapsedContent: jsxs(Fragment, { children: [
					jsx("span", { className: "dsh-tp-meta", children: t("subagents.summary", { count: descendants.count, running: descendants.runningCount }) }),
					jsx("button", {
						type: "button",
						className: "dsh-tp-iconbtn",
						title: t("subagents.refresh"),
						"aria-label": t("subagents.refresh"),
						onClick: (event) => {
							event.stopPropagation();
							refresh();
						},
						children: renderIcon(IconRefreshOutline14, { className: refreshing ? "dsh-tp-spin" : undefined })
					})
				] }),
				keepContentWhenOpen: true,
				children: jsxs("div", { className: "dsh-tp-panel", children: [
					isEmpty ? jsx("div", { className: "dsh-tp-empty", children: t("subagents.empty") }) : null,
					rows.map((row) => {
						const activity = catalogActivity.get(row.id);
						const running = row.running === true || activity === "running";
						const title = textOf(row.displayTitle ?? row.title ?? row.id);
						const preset = textOf(row.agentPreset);
						const rel = relTime(now - (Number.isFinite(row.updatedAt) ? row.updatedAt : NaN), t);
						const leading = running
							? renderIcon(IconLoadingOutline16, { size: 14, className: "dsh-tp-spin dsh-tp-brand" })
							: row.pendingInteraction != null
								? jsx("span", { className: "dsh-tp-dot dsh-tp-dot-warn", "aria-hidden": true })
								: row.completed === true
									? jsx("span", { className: "dsh-tp-dot dsh-tp-dot-ok", "aria-hidden": true })
									: jsx("span", { className: "dsh-tp-dot dsh-tp-dot-idle", "aria-hidden": true });
						return jsxs("button", {
							type: "button",
							className: "dsh-tp-sub",
							title: title,
							onClick: () => openRow(row),
							children: [
								jsx("span", { className: "dsh-tp-sub-icon", children: leading }),
								jsxs("span", { className: "dsh-tp-sub-main", children: [
									jsx("span", { className: "dsh-tp-sub-title", children: title }),
									jsxs("span", { className: "dsh-tp-sub-meta", children: [
										preset !== "" ? jsx("span", { children: preset }) : null,
										rel !== null ? jsx("span", { className: "dsh-tp-sub-time", children: rel }) : null
									] })
								] })
							]
						}, row.id);
					}),
					diagnostics.map((entry) => jsxs("div", { className: "dsh-tp-diag", children: [
						renderIcon(IconWarningOutline16, { size: 14, className: "dsh-tp-warn" }),
						jsx("span", { children: t("subagents.diagnostic", { reason: textOf(entry.reason) }) })
					] }, entry.id)),
					catalogState === "error" ? jsxs("div", { className: "dsh-tp-error", children: [
						jsx("span", { className: "dsh-tp-error-msg", children: textOf(catalogError?.message) !== "" ? textOf(catalogError?.message) : t("subagents.unavailable") }),
						jsx("button", {
							type: "button",
							className: "dsh-tp-iconbtn",
							title: t("subagents.retry"),
							"aria-label": t("subagents.retry"),
							onClick: refresh,
							children: renderIcon(IconRefreshOutline14, {})
						})
					] }) : null,
					catalogState === undefined && rows.length === 0 ? jsx("div", { className: "dsh-tp-hint", children: t("subagents.notLoaded") }) : null,
					catalogState === "loading" ? jsx("div", { className: "dsh-tp-hint", children: t("subagents.loading") }) : null
				] })
			});
		}
		//#endregion

		//#region jobs panel
		/** Status icon for one job row; live states spin, settled states color-code. */
		function jobStatusIcon(job) {
			if (job.status === "running") return renderIcon(IconLoadingOutline16, { size: 14, className: "dsh-tp-spin dsh-tp-brand" });
			if (job.status === "stopping") return renderIcon(IconLoadingOutline16, { size: 14, className: "dsh-tp-spin dsh-tp-warn" });
			if (job.status === "completed") return renderIcon(IconCheckOutline16, { size: 14, className: "dsh-tp-ok" });
			if (job.status === "killed") return renderIcon(IconStopFill16, { size: 14, className: "dsh-tp-warn" });
			if (job.status === "failed") return renderIcon(IconWarningOutline16, { size: 14, className: "dsh-tp-err" });
			return jsx("span", { className: "dsh-tp-dot dsh-tp-dot-idle", "aria-hidden": true });
		}

		function jobStatusText(job, t) {
			return JOB_STATUS_KEYS.has(job.status) ? t("jobs.status." + job.status) : textOf(job.status);
		}

		/**
		* Read-only listing of the current session's background jobs: live rows on
		* top with a per-second elapsed readout, settled rows folded into history.
		* @param props - drawer props plus the controlled disclosure state.
		* @returns the panel.
		*/
		function JobsPanel({ useSessions, t, open, onOpenChange }) {
			const jobsStored = useSessions(selectCurrentJobs);
			const jobs = Array.isArray(jobsStored) ? jobsStored : EMPTY_JOBS;
			const live = useMemo(() => jobs
				.filter((job) => job != null && JOB_LIVE_STATUS.has(job.status))
				.sort((left, right) => (Number.isFinite(left.startedAt) ? left.startedAt : 0) - (Number.isFinite(right.startedAt) ? right.startedAt : 0)), [jobs]);
			const settled = useMemo(() => jobs
				.filter((job) => job != null && !JOB_LIVE_STATUS.has(job.status))
				.sort((left, right) => (Number.isFinite(right.finishedAt ?? right.startedAt) ? right.finishedAt ?? right.startedAt : 0) - (Number.isFinite(left.finishedAt ?? left.startedAt) ? left.finishedAt ?? left.startedAt : 0)), [jobs]);
			const [now, setNow] = useState(() => Date.now());
			const [historyOpen, setHistoryOpen] = useState(false);

			// Tick only while live jobs exist — an idle panel costs no timers.
			useEffect(() => {
				if (live.length === 0) return;
				setNow(Date.now());
				const timer = setInterval(() => setNow(Date.now()), 1000);
				return () => clearInterval(timer);
			}, [live.length]);

			const renderJob = (job, liveRow) => {
				const label = textOf(job.label);
				const detail = textOf(job.detail);
				const startedAt = Number.isFinite(job.startedAt) ? job.startedAt : null;
				const timeText = startedAt == null
					? ""
					: liveRow
						? t("jobs.elapsed", { t: formatClock(now - startedAt) })
						: t("jobs.duration", { t: formatDuration(((Number.isFinite(job.finishedAt) ? job.finishedAt : startedAt) - startedAt), t) });
				const statusText = jobStatusText(job, t);
				return jsxs("div", { className: "dsh-tp-job", "data-status": textOf(job.status), children: [
					jsxs("div", { className: "dsh-tp-job-line", children: [
						jsx("span", { className: "dsh-tp-job-icon", title: statusText, children: jobStatusIcon(job) }),
						jsx("span", { className: "dsh-tp-job-kind", children: textOf(job.kind) }),
						jsx("span", { className: "dsh-tp-job-label", title: label, children: label }),
						timeText !== "" ? jsx("span", { className: "dsh-tp-job-time", children: timeText }) : null
					] }),
					detail !== "" ? jsx("div", { className: "dsh-tp-job-detail", title: detail, children: detail }) : null
				] }, textOf(job.id));
			};

			return jsx(PanelDisclosure, {
				icon: renderIcon(IconQueueOutline14, { size: 14 }),
				title: t("jobs.title"),
				open: open === true,
				expandable: true,
				expandOnRowClick: true,
				onToggle: () => onOpenChange(!(open === true)),
				collapsedContent: live.length > 0 ? jsx("span", { className: "dsh-tp-meta", children: String(live.length) }) : undefined,
				children: jsxs("div", { className: "dsh-tp-panel", children: [
					jobs.length === 0 ? jsx("div", { className: "dsh-tp-empty", children: t("jobs.empty") }) : null,
					live.length > 0 ? jsx("div", { className: "dsh-tp-subhead", style: { cursor: "default" }, children: t("jobs.live") }) : null,
					live.map((job) => renderJob(job, true)),
					settled.length > 0 ? jsxs("button", {
						type: "button",
						className: "dsh-tp-subhead",
						"aria-expanded": historyOpen,
						onClick: () => setHistoryOpen((value) => !value),
						children: [
							renderIcon(IconChevronRightOutline14, { className: cx("dsh-tp-chev", historyOpen ? "dsh-tp-chev-open" : "") }),
							jsx("span", { children: t("jobs.history") }),
							jsx("span", { className: "dsh-tp-meta", children: String(settled.length) })
						]
					}) : null,
					historyOpen ? jsx(Fragment, { children: settled.map((job) => renderJob(job, false)) }) : null
				] })
			});
		}
		//#endregion

		//#region drawer shell
		/**
		* The single shell.overlay entry: a collapsible right drawer hosting the
		* todos / subagents / jobs panels. Renders nothing on the hero screen
		* (no current session). The root only spans the drawer itself so the
		* pointer-transparent overlay never shields the app below.
		* @param props - standard root kit (useSessions), the slot-injected
		* sessions face, and the namespace translator.
		* @returns the drawer, or null without a current session.
		*/
		function TaskPanelDrawer({ useSessions, sessions, t }) {
			const currentId = useSessions((state) => state?.current);
			const activeCount = useSessions(countActiveWork);
			const geometry = useScrollportGeometry(currentId);
			const detailsOpen = useDetailsOpen();
			const [state, setState] = useState(loadDrawerState);
			const [dragging, setDragging] = useState(false);
			const widthRef = useRef(state.width);

			const patchState = useCallback((patch) => {
				setState((previous) => {
					const next = { ...previous, ...patch };
					saveDrawerState(next);
					return next;
				});
			}, []);

			const setPanelOpen = useCallback((key, open) => {
				setState((previous) => {
					const next = { ...previous, panels: { ...previous.panels, [key]: open } };
					saveDrawerState(next);
					return next;
				});
			}, []);

			const expand = useCallback(() => patchState({ collapsed: false }), [patchState]);
			const collapse = useCallback(() => patchState({ collapsed: true }), [patchState]);

			// Resize by dragging the left handle; width commits to storage on release.
			const onResizeStart = (event) => {
				if (state.collapsed || event.button !== 0) return;
				event.preventDefault();
				const startX = event.clientX;
				const startWidth = effectiveWidth;
				widthRef.current = startWidth;
				setDragging(true);
				const onMove = (moveEvent) => {
					const width = clampWidth(startWidth + (startX - moveEvent.clientX));
					widthRef.current = width;
					setState((previous) => ({ ...previous, width }));
				};
				const onEnd = () => {
					window.removeEventListener("pointermove", onMove);
					window.removeEventListener("pointerup", onEnd);
					window.removeEventListener("pointercancel", onEnd);
					setDragging(false);
					setState((previous) => {
						const next = { ...previous, width: clampWidth(widthRef.current) };
						saveDrawerState(next);
						return next;
					});
				};
				window.addEventListener("pointermove", onMove);
				window.addEventListener("pointerup", onEnd);
				window.addEventListener("pointercancel", onEnd);
			};

			if (currentId == null || geometry.topPx == null || detailsOpen) return null;

			const collapsed = state.collapsed === true;
			const effectiveWidth = state.width == null ? geometry.adaptiveWidth : state.width;
		if (collapsed) {
			return jsxs("div", {
				className: "dsh-tp-root",
				"data-plugin": "dsh-ui-taskpanel",
				"data-collapsed": "true",
				style: { top: geometry.topPx + "px", bottom: geometry.bottomPx + "px" },
				children: jsxs("div", { className: "dsh-tp-rail", children: [
					jsx("button", {
						type: "button",
						className: "dsh-tp-rail-btn",
						title: t("panel.expand"),
						"aria-label": t("panel.expand"),
						"aria-expanded": false,
						onClick: expand,
						children: renderIcon(IconPanelLeftOutline16, {})
					}),
					activeCount > 0 ? jsx("span", { className: "dsh-tp-badge", title: t("panel.badge", { count: activeCount }), children: String(activeCount) }) : null
				] })
			});
		}
		return jsxs("div", {
			className: "dsh-tp-root",
			"data-plugin": "dsh-ui-taskpanel",
			"data-collapsed": "false",
			"data-dragging": dragging ? "true" : "false",
			style: { top: geometry.topPx + "px", bottom: geometry.bottomPx + "px", width: clampWidth(effectiveWidth) + "px" },
			children: [
				jsx("button", {
					type: "button",
					className: "dsh-tp-collapse-strip",
					title: t("panel.collapse"),
					"aria-label": t("panel.collapse"),
					onClick: collapse
				}),
				jsx("div", {
					className: "dsh-tp-resize",
					role: "separator",
					"aria-orientation": "vertical",
					"aria-label": t("panel.resize"),
					title: t("panel.resize"),
					onPointerDown: onResizeStart
				}),
				jsxs("div", { className: "dsh-tp-header", children: [
					jsx("span", { className: "dsh-tp-header-title", children: t("panel.title") }),
					jsx("button", {
						type: "button",
						className: "dsh-tp-iconbtn",
						title: t("panel.collapse"),
						"aria-label": t("panel.collapse"),
						onClick: collapse,
						children: renderIcon(IconChevronRightOutline14, {})
					})
				] }),
				jsxs("div", { className: "dsh-tp-body", children: [
					jsx(TodosPanel, { useSessions, t, open: state.panels.todos, onOpenChange: (open) => setPanelOpen("todos", open) }),
					jsx(SubagentsPanel, { useSessions, sessions, t, currentId, drawerExpanded: true, open: state.panels.subagents, onOpenChange: (open) => setPanelOpen("subagents", open) }),
					jsx(JobsPanel, { useSessions, t, open: state.panels.jobs, onOpenChange: (open) => setPanelOpen("jobs", open) })
				] })
			]
		});
		}
		//#endregion

		//#region apply
		/**
		* Register the dictionaries and the single shell.overlay entry. The host
		* half of this plugin is a no-op — everything below runs in the browser.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "ui-taskpanel: dictionaries");
			ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "taskpanel-right",
				order: 50,
				locale: NS,
				inject: () => ({ sessions: ctx.sessions })
			}, TaskPanelDrawer));
		}
		//#endregion

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
