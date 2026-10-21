'use strict';
'require view';
'require poll';
'require ui';
'require tools.homi as homi';

function notify(message, type) {
	ui.addNotification(null, E('p', {}, message), type || 'info');
}

return view.extend({
	render: function () {
		let logType = 'plugin';
		const logPre = E('pre', {
			style: 'background: #111; color: #ddd; padding: 10px; border-radius: 6px; height: calc(100vh - 250px); min-height: 350px; overflow-y: auto; font-size: 12px; line-height: 1.5; white-space: pre-wrap; word-break: break-all;'
		}, _('点击刷新查看日志…'));

		const getFn = () => (logType === 'core' ? homi.getCoreLog() : homi.getAppLog());
		const showText = function (text) {
			logPre.textContent = '';
			const lines = (text || '').split('\n');
			/* 去掉末尾空行造成的空白行 */
			while (lines.length && !lines[lines.length - 1]) lines.pop();
			if (!lines.length) {
				logPre.textContent = _('（空）');
			} else {
				lines.forEach((ln, i) => {
					logPre.appendChild(E('div', {
						style: 'border-bottom: 1px solid #222; padding: 2px 0; word-break: break-all;' +
							(i % 2 ? 'background: #161616;' : '')
					}, ln || ' '));
				});
			}
			logPre.scrollTop = logPre.scrollHeight;
		};

		const loadLog = function () {
			logPre.textContent = _('加载中…');
			getFn()
				.then(showText)
				.catch((e) => { logPre.textContent = _('读取失败：') + ((e && e.message) || e); });
		};

		const tabPlugin = E('button', { 'class': 'btn cbi-button cbi-button-action', type: 'button' }, _('插件日志'));
		const tabCore = E('button', { 'class': 'btn cbi-button', type: 'button' }, _('内核日志'));
		const setTab = function (t) {
			logType = t;
			tabPlugin.className = 'btn cbi-button ' + (t === 'plugin' ? 'cbi-button-action' : '');
			tabCore.className = 'btn cbi-button ' + (t === 'core' ? 'cbi-button-action' : '');
			loadLog();
		};
		tabPlugin.addEventListener('click', () => setTab('plugin'));
		tabCore.addEventListener('click', () => setTab('core'));

		const refreshBtn = E('button', { 'class': 'btn cbi-button cbi-button-positive', type: 'button' }, _('刷新'));
		refreshBtn.addEventListener('click', loadLog);
		const clearBtn = E('button', { 'class': 'btn cbi-button cbi-button-negative', type: 'button' }, _('清空日志'));
		clearBtn.addEventListener('click', function () {
			if (!confirm(_('确定清空日志吗？'))) return;
			const clearFn = (logType === 'core' ? homi.clearCoreLog() : homi.clearAppLog());
			clearFn
				.then(() => { logPre.textContent = _('（已清空）'); })
				.catch((e) => notify(_('清空失败：') + ((e && e.message) || e), 'error'));
		});

		poll.add(function () {
			if (document.body.contains(logPre))
				return getFn().then(showText).catch(() => {});
		}, 5);

		/* 初次加载 */
		loadLog();

		return E('div', {}, [
			E('h2', {}, _('日志')),
			E('div', { 'class': 'cbi-section' }, [
				E('div', { 'class': 'cbi-section-node' }, [
					E('div', { style: 'display: flex; gap: 8px; margin-bottom: 8px;' }, [tabPlugin, tabCore, refreshBtn, clearBtn]),
					logPre,
					E('p', { 'class': 'cbi-value-description', style: 'margin-top: 8px;' }, _('日志只保留最后 500 行，5 秒自动刷新。'))
				])
			])
		]);
	}
});
