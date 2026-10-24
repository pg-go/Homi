'use strict';
'require form';
'require view';
'require uci';
'require poll';
'require ui';
'require tools.homi as homi';

function updateStatus(element, running) {
	if (element) {
		element.style.color = running ? 'green' : 'red';
		element.textContent = running ? _('运行中') : _('未运行');
	}
	return element;
}

function notify(message, type) {
	ui.addNotification(null, E('p', {}, message), type || 'info');
}

function actionButton(title, style, onclick) {
	const btn = E('button', { 'class': 'btn cbi-button cbi-button-' + style, type: 'button' }, title);
	btn.addEventListener('click', onclick);
	return btn;
}

return view.extend({
	load: function () {
		return Promise.all([
			uci.load('homi'),
			homi.version(),
			homi.status(),
			L.resolveDefault(homi.listConfigs(), { configs: [] })
		]);
	},
	render: function (data) {
		const appVersion = data[1].app ?? '';
		const coreVersion = data[1].core ?? '';
		const running = data[2];
		const configs = (data[3] && data[3].configs) || [];

		let m = new form.Map('homi', _('Homi'),
			`${_('在 OpenWrt 上使用 Mihomo 内核运行你的配置。')} <a href="https://github.com/pg-go/Homi" target="_blank">${_('使用说明')}</a>`);
		let s = m.section(form.NamedSection, 'main', _('基本设置'));
		let o = s.option(form.Flag, 'enabled', _('启用'), _('开机自动启动 Mihomo 内核，勾选后点下方「保存并应用」'));
		o.rmempty = false;

		o = s.option(form.ListValue, 'config_file', _('配置文件'), _('选择要运行的配置文件，保存并应用后生效'));
		configs.forEach(function (c) {
			o.value(c.path, c.name);
		});
		o.rmempty = false;
		/* 配置文件下拉框缩小：限制宽度与高度 */
		document.head.appendChild(E('style', {},
			'[id="widget.homi.main.config_file"] { max-width: 320px; height: 30px; font-size: 13px; }'));

		o = s.option(form.DummyValue, '_status', _('状态'));
		o.cfgvalue = function () {
			return E('div', { style: 'display: flex; gap: 1.5em; align-items: center; flex-wrap: wrap;' }, [
				E('span', {}, [_('软件版本：'), E('b', {}, appVersion || _('未知'))]),
				E('span', {}, [_('内核版本：'), E('b', {}, coreVersion || _('未知'))]),
				E('span', {}, [_('内核状态：'), updateStatus(
					E('span', { id: 'core_status', style: 'font-style: italic; font-weight: bold;' }),
					running
				)])
			]);
		};
		poll.add(function () {
			return L.resolveDefault(homi.status()).then(function (r) {
				updateStatus(document.getElementById('core_status'), r);
			});
		}, 5);

		o = s.option(form.DummyValue, '_actions', _('服务操作'));
		o.cfgvalue = function () {
			return E('div', { style: 'display: flex; gap: 8px; flex-wrap: wrap;' }, [
				actionButton(_('重启服务'), 'negative', function () {
					homi.restart()
						.then(() => homi.logMsg('[App] 重启命令已发送'))
						.catch((e) => { notify(_('重启失败：') + e, 'error'); homi.logMsg('[App] 重启失败：' + e); });
				}),
				actionButton(_('更新面板'), 'positive', function () {
					homi.logMsg('[App] 开始更新面板…');
					homi.updateDashboard()
						.then((r) => homi.logMsg((r && r.success) ? '[App] 面板更新成功' : '[App] 面板更新失败'))
						.catch((e) => homi.logMsg('[App] 面板更新失败：' + e));
				}),
				actionButton(_('打开面板'), 'primary', function () {
					homi.openDashboard()
						.catch((e) => {
							if (e === 'not_configured')
								notify(_('请先在配置文件中设置 external-controller（API 监听地址），例如：external-controller: 0.0.0.0:9090'), 'error');
							else if (e === 'ui_missing')
								notify(_('面板文件缺失且下载失败，请检查网络后重试「更新面板」'), 'error');
							else
								notify(_('打开面板失败'), 'error');
						});
				}),
				actionButton(_('更新规则'), 'positive', function () {
					homi.logMsg('[App] 开始更新规则…');
					homi.updateRules()
						.then((r) => {
							if (r && r.success) {
								const failed = (r.failed && r.failed.length) ? r.failed : [];
								const failNames = failed.length ? _('（失败：') + failed.join(', ') + '）' : '';
								homi.logMsg('[App] 规则更新完成：成功 ' + r.updated + ' 个，失败 ' + failed.length + ' 个，共 ' + r.total + ' 个');
								notify(_('规则更新完成：成功 ') + r.updated + _(' 个，失败 ') + failed.length + _(' 个') + failNames);
							} else {
								const err = (r && r.error) || 'failed';
								if (err === 'not_configured')
									notify(_('请先在配置文件中设置 external-controller（API 监听地址）'), 'error');
								else if (err === 'not_running')
									notify(_('服务未运行或控制器不可达，请先启动服务'), 'error');
								else if (err === 'no_providers')
									notify(_('当前配置没有规则提供者'), 'error');
								else if (err === 'no_config')
									notify(_('请先上传配置文件'), 'error');
								else
									notify(_('规则更新失败'), 'error');
								homi.logMsg('[App] 规则更新失败：' + err);
							}
						})
						.catch((e) => { notify(_('规则更新失败：') + e, 'error'); homi.logMsg('[App] 规则更新失败：' + e); });
				})
			]);
		};

		return m.render();
	}
});
