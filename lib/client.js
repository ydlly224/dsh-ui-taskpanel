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

		/** localStorage key for the persisted panel shape. */
		const STORAGE_KEY = "dsh.taskpanel.v4";
		/** Right-sidebar tab type identity (registry id + kind). */
		const TAB_TYPE_ID = "dsh-ui-taskpanel";
		const TAB_KIND = "taskpanel";
		const DEFAULT_PANELS = { todos: true, subagents: true, jobs: true };

		/** Module-level constants so snapshot selectors keep stable references. */
		const EMPTY_JOBS = Object.freeze([]);
		const EMPTY_ROWS = Object.freeze([]);
		const EMPTY_RECORD = Object.freeze({});
		const NO_DESCENDANTS = Object.freeze({ count: 0, runningCount: 0 });
		/** Frozen empty jobs-model snapshot for hosts without the `jobs` service. */
		const EMPTY_JOBS_SNAPSHOT = Object.freeze({ rows: EMPTY_RECORD, observed: EMPTY_RECORD });
		/** Stand-in jobs source so the entry's hook face never changes shape across hosts. */
		const EMPTY_JOBS_SOURCE = Object.freeze({
			getSnapshot: () => EMPTY_JOBS_SNAPSHOT,
			subscribe: () => () => { /* nothing to listen to */ }
		});

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

		/** Primitives are shell-provided; keep direct refs and degrade softly.
		* 0.1.7-rc.1 renamed every icon export from the *16/*14 suffix scheme to
		* *Medium/*Regular (Regular = 1px stroke, the old 16px look); resolve the
		* rc.1 names first and keep the legacy spellings as fallback. */
		const DisclosureRow = typeof primitives?.DisclosureRow === "function" ? primitives.DisclosureRow : null;
		const pickIcon = (modern, legacy) => primitives?.[modern] ?? primitives?.[legacy];
		const IconPanelLeftOutline16 = pickIcon("IconPanelLeftOutlineRegular", "IconPanelLeftOutline16");
		const IconChevronRightOutline14 = pickIcon("IconChevronRightOutlineRegular", "IconChevronRightOutline14");
		const IconChecklistOutline14 = pickIcon("IconChecklistOutlineRegular", "IconChecklistOutline14");
		const IconAgentPresetOutline16 = pickIcon("IconAgentPresetOutlineRegular", "IconAgentPresetOutline16");
		const IconQueueOutline14 = pickIcon("IconQueueOutlineRegular", "IconQueueOutline14");
		const IconRefreshOutline14 = pickIcon("IconRefreshOutlineRegular", "IconRefreshOutline14");
		const IconLoadingOutline16 = pickIcon("IconLoadingOutlineRegular", "IconLoadingOutline16");
		const IconCheckOutline16 = pickIcon("IconCheckOutlineRegular", "IconCheckOutline16");
		const IconStopFill16 = pickIcon("IconStopFillRegular", "IconStopFill16");
		const IconWarningOutline16 = pickIcon("IconWarningOutlineRegular", "IconWarningOutline16");
		//#endregion

		//#region css
		// Only --dsw-alias-* tokens verified against shipped dsh-client-ui-* bundles.
		const css = '/* dsh-ui-taskpanel: right-side task drawer */\n'
						+ '.dsh-tp-panel-root{display:flex;flex-direction:column;height:100%;min-height:0;box-sizing:border-box;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary)}\n'
			+ '.dsh-tp-tab-title{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px;display:inline-block;vertical-align:bottom}\n'
		+ '\n'
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
			+ '.dsh-tp-sub-model{font-size:11px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-interactive-bg-hover);border-radius:4px;padding:0 4px;flex:none}\n'
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
			+ '';

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
			"tabTitle": "任务面板",
			"guideTitle": "任务面板",
			"guideDesc": "当前会话的待办进度、子代理运行状态与后台任务",
			"todos.title": "任务进度",
			"todos.empty": "暂无任务清单",
			"todos.progress": "已完成 {done} / 共 {total}",
			"todos.counts": "进行中 {running} · 待办 {pending}",
			"subagents.title": "子代理",
			"subagents.empty": "暂无子代理",
			"subagents.refresh": "刷新",
			"subagents.retry": "重试",
			"subagents.loading": "目录加载中",
			"subagents.unavailable": "目录不可用",
			"subagents.notLoaded": "刷新以加载目录",
			"subagents.summary": "{count} 个子代理 · {running} 运行中",
			"subagents.tokens": "{n} tokens",
			"subagents.turns": "{turns} 轮 / {steps} 步",
			"subagents.context": "上下文 {pct}%",
			"subagents.duration": "耗时 {t}",
			"subagents.showAll": "显示其余 {count} 个",
			"subagents.collapseAll": "收起",
			"subagents.rel.just": "刚刚",
			"subagents.rel.minutes": "{m} 分钟前",
			"subagents.rel.hours": "{h} 小时前",
			"subagents.diagnostic": "异常记录：{reason}",
			"subagents.openHint": "点击在右侧栏打开，Alt/⌘ 点击在主视图打开",
			"jobs.title": "后台任务",
			"jobs.empty": "暂无后台任务",
			"jobs.live": "进行中",
			"jobs.history": "历史",
			"jobs.elapsed": "已运行 {t}",
			"jobs.duration": "耗时 {t}",
			"jobs.kill": "终止",
			"jobs.killConfirm": "再点一次确认终止",
			"jobs.progress": "进度：{text}",
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
			"tabTitle": "Task Panel",
			"guideTitle": "Task Panel",
			"guideDesc": "Todos, subagent status and background jobs for this session",
			"todos.title": "Todos",
			"todos.empty": "No todo list yet",
			"todos.progress": "{done} of {total} done",
			"todos.counts": "{running} in progress · {pending} pending",
			"subagents.title": "Subagents",
			"subagents.empty": "No subagents",
			"subagents.refresh": "Refresh",
			"subagents.retry": "Retry",
			"subagents.loading": "Loading catalog",
			"subagents.unavailable": "Catalog unavailable",
			"subagents.notLoaded": "Refresh to load catalog",
			"subagents.summary": "{count} subagents · {running} running",
			"subagents.tokens": "{n} tokens",
			"subagents.turns": "{turns} turns / {steps} steps",
			"subagents.context": "context {pct}%",
			"subagents.duration": "took {t}",
			"subagents.showAll": "Show {count} more",
			"subagents.collapseAll": "Show less",
			"subagents.rel.just": "just now",
			"subagents.rel.minutes": "{m}m ago",
			"subagents.rel.hours": "{h}h ago",
			"subagents.diagnostic": "Unavailable: {reason}",
			"subagents.openHint": "Click opens in the right sidebar; Alt/⌘-click opens in the main view",
			"jobs.title": "Background Jobs",
			"jobs.empty": "No background jobs",
			"jobs.live": "Live",
			"jobs.history": "History",
			"jobs.elapsed": "{t} elapsed",
			"jobs.duration": "{t} total",
			"jobs.kill": "Terminate",
			"jobs.killConfirm": "Click again to confirm",
			"jobs.progress": "progress: {text}",
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

		/** Read the persisted panel shape; any failure falls back to defaults. */
		function loadDrawerState() {
			let parsed = null;
			try {
				const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(STORAGE_KEY);
				parsed = raw === null ? null : JSON.parse(raw);
			} catch (error) {
				parsed = null;
			}
			if (parsed === null || typeof parsed !== "object") {
				return { panels: { ...DEFAULT_PANELS } };
			}
			return { panels: normalizePanels(parsed.panels) };
		}

		function saveDrawerState(state) {
			try {
				localStorage.setItem(STORAGE_KEY, JSON.stringify({ panels: normalizePanels(state.panels) }));
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

		/** Compact token count for subagent rows. */
		function formatTokens(count) {
			if (!Number.isFinite(count) || count < 0) return "";
			if (count < 1000) return String(Math.round(count));
			if (count < 1e6) return (count / 1000).toFixed(count < 1e5 ? 1 : 0).replace(/.0$/, "") + "k";
			return (count / 1e6).toFixed(1).replace(/.0$/, "") + "M";
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

		/** The id of the main (current) session.
		* 0.1.7-rc.1 dropped the `current` field from the sessions list snapshot
		* ({ids, byId, phase, projectionsBySession}): the main session is now the
		* row the main view retains — the same derivation the host's own
		* DocumentTitle uses. Older hosts keep `current`; read the rc.1 shape
		* first and fall back to the legacy field so both hosts work. */
		function currentSessionIdOf(state) {
			if (state == null || typeof state !== "object") return undefined;
			const main = Object.values(state.byId).find((row) => (row?.retainedBy?.mainView ?? 0) > 0);
			return main?.id ?? state.current;
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



		/** Live jobs among service-provided rows; legacy rosters are already counted by countActiveWork. */
		function countLiveJobs(rows) {
			if (!Array.isArray(rows)) return 0;
			let count = 0;
			for (const job of rows) {
				if (job != null && JOB_LIVE_STATUS.has(job.status)) count++;
			}
			return count;
		}

		//#region selectors
		/** Todos of one exact session; undefined = capability missing, null/[] = empty. */
		function selectTodosFor(sessionId) {
			return (state) => {
				if (sessionId == null || state == null || state.byId == null || typeof state.byId !== "object") return undefined;
				const row = state.byId[sessionId];
				if (row == null) return undefined;
				const projectionValues = row.projectionValues;
				if (projectionValues == null || typeof projectionValues !== "object") return undefined;
				return projectionValues.todos;
			};
		}

		/** Jobs of one exact session (legacy snapshot field); missing key = empty set. */
		function selectJobsFor(sessionId) {
			return (state) => {
				if (sessionId == null || state == null || state.jobsBySession == null || typeof state.jobsBySession !== "object") return undefined;
				return state.jobsBySession[sessionId];
			};
		}

		/** Todos of the current session; undefined = capability missing, null/[] = empty. */
		function selectCurrentTodos(state) {
			const current = currentSessionIdOf(state);
			if (current == null || state.byId == null || typeof state.byId !== "object") return undefined;
			const row = state.byId[current];
			if (row == null) return undefined;
			const projectionValues = row.projectionValues;
			if (projectionValues == null || typeof projectionValues !== "object") return undefined;
			return projectionValues.todos;
		}

		/** Jobs of the current session; missing key = empty set (host sends no baseline). */
		function selectCurrentJobs(state) {
			const current = currentSessionIdOf(state);
			if (current == null || state.jobsBySession == null || typeof state.jobsBySession !== "object") return undefined;
			return state.jobsBySession[current];
		}

		/** Single number (primitive, identity-stable) counting all "active" work. */
		function countActiveWork(state) {
			const current = currentSessionIdOf(state);
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
		function TodosPanel({ useSessions, t, sessionId, open, onOpenChange }) {
			const selector = useMemo(() => (typeof sessionId === "string" ? selectTodosFor(sessionId) : selectCurrentTodos), [sessionId]);
			const todos = useSessions(selector);
			const items = useMemo(() => {
				if (Array.isArray(todos)) return todos;
				if (todos != null && typeof todos === "object" && Array.isArray(todos.items)) return todos.items;
				return EMPTY_ROWS;
			}, [todos]);
			const sorted = useMemo(() => sortTodos(items), [items]);
			if (todos === undefined) return null;
			const total = sorted.length;
			const done = sorted.reduce((accumulator, item) => (item?.status === "completed" ? accumulator + 1 : accumulator), 0);
			const percent = total > 0 ? Math.round((done / total) * 100) : 0;
			const runningCount = sorted.reduce((accumulator, item) => (item?.status === "in_progress" ? accumulator + 1 : accumulator), 0);
			const pendingCount = total - done - runningCount;
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
						jsx("span", { className: "dsh-tp-track", role: "progressbar", "aria-valuenow": done, "aria-valuemin": 0, "aria-valuemax": total, children: jsx("span", { className: "dsh-tp-fill", style: { width: percent + "%" } }) }),
					jsx("span", { className: "dsh-tp-meta", children: t("todos.counts", { running: runningCount, pending: pendingCount }) })
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
		* @param props - drawer props, the sessions service face, the slot-injected
		* navigation face, and disclosure state.
		* @returns the panel.
		*/
		function SubagentsPanel({ useSessions, sessions, openSessionTarget, openSubagentAside, t, currentId, drawerExpanded, open, onOpenChange }) {
			const ids = useSessions((state) => state?.ids);
			const byId = useSessions((state) => state?.byId);
			const catalogSelector = useMemo(() => (state) => {
				if (currentId == null || state == null) return undefined;
				return state.subagentsByParent?.[currentId];
			}, [currentId]);
			const catalog = useSessions(catalogSelector);
			const [showAllRows, setShowAllRows] = useState(false);
			const rows = useMemo(() => subagentRowsOf(Array.isArray(ids) ? ids : EMPTY_ROWS, byId, currentId), [ids, byId, currentId]);
			const enriched = useMemo(() => rows.map((row) => {
				const pv = row.projectionValues != null && typeof row.projectionValues === "object" ? row.projectionValues : null;
				const sub = pv != null && pv.subagent != null && typeof pv.subagent === "object" ? pv.subagent : null;
				const usage = pv != null && pv.tokenUsage != null && typeof pv.tokenUsage === "object" ? pv.tokenUsage : null;
				const stats = pv != null && pv.sessionStats != null && typeof pv.sessionStats === "object" ? pv.sessionStats : null;
				const timing = pv != null && pv.subagentTiming != null && typeof pv.subagentTiming === "object" ? pv.subagentTiming : null;
				const modelSel = pv != null && pv.modelSelection != null && typeof pv.modelSelection === "object" ? pv.modelSelection : null;
				const pressure = pv != null && pv.contextPressure != null && typeof pv.contextPressure === "object" ? pv.contextPressure : null;
				const label = sub != null && typeof sub.label === "string" && sub.label !== "" ? sub.label : textOf(row.displayTitle ?? row.title ?? row.id);
				const tokens = usage == null ? null : (Number(usage.outputTokens) || 0) + (Number(usage.cacheReadTokens) || 0);
				const turns = stats != null && Number.isFinite(stats.turns) ? stats.turns : null;
				const steps = stats != null && Number.isFinite(stats.steps) ? stats.steps : null;
				const settledMs = timing != null && Number.isFinite(timing.settledMs) ? timing.settledMs : null;
				const lastCompleted = timing != null && timing.lastTurnCompleted === true;
				const model = modelSel != null && modelSel.lastUsed != null && typeof modelSel.lastUsed.model === "string" ? modelSel.lastUsed.model : (modelSel != null && modelSel.next != null && typeof modelSel.next.model === "string" ? modelSel.next.model : null);
				const pressurePct = pressure != null && Number.isFinite(pressure.pressureTokens) && Number.isFinite(pressure.contextWindow) && pressure.contextWindow > 0 ? Math.round((pressure.pressureTokens / pressure.contextWindow) * 100) : null;
				return { row, label, tokens, turns, steps, settledMs, lastCompleted, model, pressurePct };
			}).sort((left, right) => {
				const lr = left.row.running === true ? 1 : 0;
				const rr = right.row.running === true ? 1 : 0;
				if (lr !== rr) return rr - lr;
				return (Number.isFinite(right.row.updatedAt) ? right.row.updatedAt : 0) - (Number.isFinite(left.row.updatedAt) ? left.row.updatedAt : 0);
			}), [rows]);
			const runningRows = enriched.reduce((accumulator, entry) => (entry.row.running === true ? accumulator + 1 : accumulator), 0);
			const visibleRows = showAllRows ? enriched : enriched.slice(0, 8);
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

			// 默认点击在右侧栏打开子代理会话（原生 subagentchat 资源）；按住 Alt/⌘ 改在主视图打开。
			const openRow = (row, event) => {
				try {
					const sessions = sessionsRef.current;
					const address = sessions != null && typeof sessions.subagentAddress === "function" ? sessions.subagentAddress(row.id) : undefined;
					const aside = event == null ? false : !!(event.altKey || event.metaKey);
					const target = address !== undefined ? address : row.id;
					if (!aside && address !== undefined && typeof openSubagentAside === "function" && openSubagentAside(address)) return;
					if (typeof openSessionTarget === "function" && openSessionTarget(target)) return;
					if (sessions != null && typeof sessions.openSubagent === "function") sessions.openSubagent(target);
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
					jsx("span", { className: "dsh-tp-meta", children: t("subagents.summary", { count: descendants.count, running: runningRows }) }),
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
						visibleRows.map((entry) => {
							const row = entry.row;
							const activity = catalogActivity.get(row.id);
							const running = row.running === true || activity === "running";
							const title = entry.label;
							// 行悬停提示：说明默认（右侧栏）与 Alt/⌘ 修饰键（主视图）两种打开方式。
							const openHint = t("subagents.openHint");
							const rowTitle = openHint === "" || openHint === "subagents.openHint" ? title : title + " — " + openHint;
							const preset = textOf(row.agentPreset);
							const rel = relTime(now - (Number.isFinite(row.updatedAt) ? row.updatedAt : NaN), t);
							const durationText = !running && entry.settledMs != null && entry.settledMs >= 1000 ? t("subagents.duration", { t: formatDuration(entry.settledMs, t) }) : null;
							const tokensText = entry.tokens != null && entry.tokens > 0 ? t("subagents.tokens", { n: formatTokens(entry.tokens) }) : null;
							const turnsText = entry.turns != null ? t("subagents.turns", { turns: entry.turns, steps: entry.steps == null ? 0 : entry.steps }) : null;
							const contextText = entry.pressurePct != null ? t("subagents.context", { pct: entry.pressurePct }) : null;
							const modelText = entry.model != null && entry.model !== "" ? entry.model : null;
							const leading = running
								? renderIcon(IconLoadingOutline16, { size: 14, className: "dsh-tp-spin dsh-tp-brand" })
								: row.pendingInteraction != null
									? jsx("span", { className: "dsh-tp-dot dsh-tp-dot-warn", "aria-hidden": true })
									: row.completed === true || entry.lastCompleted
										? jsx("span", { className: "dsh-tp-dot dsh-tp-dot-ok", "aria-hidden": true })
										: jsx("span", { className: "dsh-tp-dot dsh-tp-dot-idle", "aria-hidden": true });
							return jsxs("button", {
								type: "button",
								className: "dsh-tp-sub",
								title: rowTitle,
								onClick: (event) => openRow(row, event),
								children: [
									jsx("span", { className: "dsh-tp-sub-icon", children: leading }),
									jsxs("span", { className: "dsh-tp-sub-main", children: [
										jsx("span", { className: "dsh-tp-sub-title", children: title }),
										jsxs("span", { className: "dsh-tp-sub-meta", children: [
											modelText != null ? jsx("span", { className: "dsh-tp-sub-model", children: modelText }) : null,
											tokensText != null ? jsx("span", { children: tokensText }) : null,
											turnsText != null ? jsx("span", { children: turnsText }) : null,
											contextText != null ? jsx("span", { children: contextText }) : null,
											durationText != null ? jsx("span", { children: durationText }) : null,
											preset !== "" ? jsx("span", { children: preset }) : null,
											rel !== null && !running ? jsx("span", { className: "dsh-tp-sub-time", children: rel }) : null
										] })
									] })
								]
							}, row.id);
						}),
					enriched.length > 8 ? jsx("button", {
						type: "button",
						className: "dsh-tp-subhead",
						style: { cursor: "pointer" },
						onClick: () => setShowAllRows((value) => !value),
						children: showAllRows ? t("subagents.collapseAll") : t("subagents.showAll", { count: enriched.length - 8 })
					}) : null,
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
		function JobsPanel({ jobs, killJob, t, open, onOpenChange }) {
			const jobsStored = Array.isArray(jobs) ? jobs : EMPTY_JOBS;
			const live = useMemo(() => jobsStored
				.filter((job) => job != null && JOB_LIVE_STATUS.has(job.status))
				.sort((left, right) => (Number.isFinite(left.startedAt) ? left.startedAt : 0) - (Number.isFinite(right.startedAt) ? right.startedAt : 0)), [jobsStored]);
			const settled = useMemo(() => jobsStored
				.filter((job) => job != null && !JOB_LIVE_STATUS.has(job.status))
				.sort((left, right) => (Number.isFinite(right.finishedAt ?? right.startedAt) ? right.finishedAt ?? right.startedAt : 0) - (Number.isFinite(left.finishedAt ?? left.startedAt) ? left.finishedAt ?? left.startedAt : 0)), [jobsStored]);
			const [now, setNow] = useState(() => Date.now());
			const [historyOpen, setHistoryOpen] = useState(false);
			const [killArmed, setKillArmed] = useState(null);

			// Disarm the two-step kill after a short pause.
			useEffect(() => {
				if (killArmed == null) return;
				const timer = setTimeout(() => setKillArmed(null), 3000);
				return () => clearTimeout(timer);
			}, [killArmed]);

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
				const progress = textOf(job.progress);
				const secondary = progress !== "" ? t("jobs.progress", { text: progress }) : detail;
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
						timeText !== "" ? jsx("span", { className: "dsh-tp-job-time", children: timeText }) : null,
						liveRow && typeof killJob === "function" ? jsx("button", {
							type: "button",
							className: "dsh-tp-iconbtn",
							title: killArmed === job.id ? t("jobs.killConfirm") : t("jobs.kill"),
							"aria-label": t("jobs.kill"),
							onClick: (event) => {
								event.stopPropagation();
								if (killArmed !== job.id) { setKillArmed(job.id); return; }
								setKillArmed(null);
								try { killJob(job.id); } catch (error) { /* best effort */ }
							},
							children: renderIcon(IconStopFill16, { size: 12 })
						}) : null
					] }),
					secondary !== "" ? jsx("div", { className: "dsh-tp-job-detail", title: secondary, children: secondary }) : null
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
					jobsStored.length === 0 ? jsx("div", { className: "dsh-tp-empty", children: t("jobs.empty") }) : null,
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

		//#region sidebar tab
		/**
		* Right-sidebar tab body: the todos / subagents / jobs panels for the tab's
		* session. The dock supplies width, split, fullscreen and session-scoped
		* layout memory; this body only owns the panel content.
		* @param props - standard root kit (useSessions), slot-injected sessions/jobs/
		* navigation faces, the tab's session id, and the namespace translator.
		* @returns the panel body.
		*/
		function TaskPanelBody({ useSessions, useJobs, watchJobRows, sessions, killJob, openSessionTarget, openSubagentAside, t, sessionId }) {
			const fromSessions = useSessions(currentSessionIdOf);
			const currentId = typeof sessionId === "string" ? sessionId : fromSessions;
			// rc.1 serves the current session's job roster from the independent `jobs`
			// service (an absent key = no roster); older hosts keep it in the sessions
			// list snapshot — prefer whichever source has data.
			const serviceJobs = useJobs((state) => (currentId == null ? undefined : state.rows[currentId]));
			const legacySelector = useMemo(() => (typeof currentId === "string" ? selectJobsFor(currentId) : selectCurrentJobs), [currentId]);
			const legacyJobs = useSessions(legacySelector);
			const jobsStored = serviceJobs !== undefined ? serviceJobs : legacyJobs;
			const [state, setState] = useState(loadDrawerState);

			// rc.1 keeps a session's roster alive only while a watcher holds the
			// refcounted job.list stream open — hold it for the tab's session.
			useEffect(() => {
				if (watchJobRows == null || currentId == null) return;
				return watchJobRows(currentId);
			}, [watchJobRows, currentId]);

			const setPanelOpen = useCallback((key, open) => {
				setState((previous) => {
					const next = { ...previous, panels: { ...previous.panels, [key]: open } };
					saveDrawerState(next);
					return next;
				});
			}, []);

			return jsx("div", {
				className: "dsh-tp-panel-root",
				"data-plugin": "dsh-ui-taskpanel",
				children: [
					jsx("div", { className: "dsh-tp-header", children: jsx("span", { className: "dsh-tp-header-title", children: t("panel.title") }) }),
					jsxs("div", { className: "dsh-tp-body", children: [
						jsx(TodosPanel, { useSessions, t, sessionId: currentId, open: state.panels.todos, onOpenChange: (open) => setPanelOpen("todos", open) }),
						jsx(SubagentsPanel, { useSessions, sessions, openSessionTarget, openSubagentAside, t, currentId, drawerExpanded: true, open: state.panels.subagents, onOpenChange: (open) => setPanelOpen("subagents", open) }),
						jsx(JobsPanel, { jobs: jobsStored, killJob: typeof killJob === "function" && currentId != null ? (jobId) => killJob(currentId, jobId) : undefined, t, open: state.panels.jobs, onOpenChange: (open) => setPanelOpen("jobs", open) })
					] })
				]
			});
		}

		/** Right-sidebar tab chip label. */
		function TaskPanelTabTitle({ t }) {
			return jsx("span", { className: "dsh-tp-tab-title", children: t("panel.title") });
		}
		//#endregion

		//#region apply
		/**
		* Register the dictionaries and the native right-sidebar tab (scheme B).
		* The tab services are provided by a bundle that may apply after this one, so
		* registration waits on `ctx.inject(["sidebarRightTabs"])` instead of a one-shot
		* `ctx.get` probe (a probe here loses the race on some load orders).
		* rc.1 serves background jobs from the independent `jobs` service (the
		* sessions list snapshot no longer carries jobsBySession), while older
		* hosts served them from that snapshot: the tab BODY re-registers with the
		* jobs face while the service is provided and with a frozen empty stand-in
		* source otherwise, so the component's hook shape never changes and the
		* legacy store read stays the fallback on both hosts. The tab TYPE and its
		* chip title are registered exactly once (the registry rejects duplicate ids).
		* Subagent rows open the native `subagentchat` resource in the right sidebar
		* (`sidebarRight.openResource`) and fall back to the workspace main view on Alt/⌘
		* or when that service is missing.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "ui-taskpanel: dictionaries");
			ctx.inject(["sidebarRightTabs"], (scope) => {
				const tabs = scope.sidebarRightTabs;
				if (tabs == null || typeof tabs.register !== "function") return;
				const t = typeof ctx.locale.bind === "function" ? ctx.locale.bind(NS) : (k) => k;
				scope.effect(() => tabs.register({
					id: TAB_TYPE_ID,
					kind: TAB_KIND,
					title: () => t("tabTitle"),
					guide: [{
						id: "taskpanel",
						order: 21,
						title: () => t("guideTitle"),
						description: () => t("guideDesc")
					}]
				}), "ui-taskpanel: right-sidebar tab type");
				scope.slots.inject("sidebar.right.pane.tab.title", () => scope.slots.register({
					name: "sidebar.right.pane.tab.title",
					key: TAB_TYPE_ID,
					locale: NS
				}, TaskPanelTabTitle));
				let disposeBody = null;
				const register = (jobsFace) => {
					if (disposeBody != null) disposeBody();
					disposeBody = scope.slots.inject("sidebar.right.pane.tab", () => scope.slots.register({
						name: "sidebar.right.pane.tab",
						key: TAB_TYPE_ID,
						locale: NS,
						inject: () => ({
							sessions: ctx.sessions,
							// 0.2.1 dropped `sessions.openSubagent`; the workspace service owns
							// subagent navigation now (ui-subagent does the same). Resolved lazily
							// and by name so hosts without ui-workspace still load this plugin.
							openSessionTarget: (target) => {
								const uiw = ctx.get("uiWorkspace");
								if (uiw == null || typeof uiw.openSession !== "function") return false;
								uiw.openSession(target);
								return true;
							},
							// 默认在右侧栏打开子代理会话：注册原生 subagentchat 资源（与官方 ui-subagent
							// 的 openChildAside 同款地址与调用）。右侧栏服务缺失/调用失败时返回 false，
							// 由 openRow 回退到主视图打开。按名称懒解析，宿主无右侧栏时插件照常加载。
							openSubagentAside: (address) => {
								try {
									const sidebar = ctx.get("sidebarRight");
									if (sidebar == null || typeof sidebar.openResource !== "function") return false;
									const query = new URLSearchParams({ parent: address.parentSessionId, mode: address.mode });
									const resource = "dsh-resource://subagentchat/session/" + encodeURIComponent(address.childSessionId) + "?" + query.toString();
									sidebar.openResource(resource, { kind: "subagentchat", preferNewPane: true });
									return true;
								} catch (error) {
									return false;
								}
							},
							...jobsFace
						})
					}, TaskPanelBody));
				};
				register({ hooks: { jobs: EMPTY_JOBS_SOURCE } });
				scope.inject(["jobs"], (jobCtx) => {
					register({
						hooks: { jobs: jobCtx.jobs.state },
						watchJobRows: (sessionId) => jobCtx.jobs.watchRows(sessionId),
						killJob: async (sessionId, jobId) => {
							try {
								const result = await jobCtx.jobs.kill(sessionId, jobId);
								// 0.2.1 contract: RemoteResult<JobKillValue> carries { outcome }; tolerate legacy { ok }.
								const outcome = result && typeof result === "object" ? result.outcome : undefined;
								return !!(result && (result.ok === true || outcome === "requested" || outcome === "already-finished"));
							} catch (error) {
								return false;
							}
						}
					});
					jobCtx.effect(() => () => {
						try {
							register({ hooks: { jobs: EMPTY_JOBS_SOURCE } });
						} catch (error) {
							/* teardown race — the host is going down anyway */
						}
					}, "ui-taskpanel: jobs fallback");
				});
			});
		}
		//#endregion

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
