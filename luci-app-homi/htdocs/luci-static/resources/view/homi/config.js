'use strict';
'require view';
'require ui';
'require tools.homi as homi';

function notify(message, type) {
	ui.addNotification(null, E('p', {}, message), type || 'info');
}

return view.extend({
	load: function () {
		return Promise.all([
			homi.version(),
			L.resolveDefault(homi.listConfigs(), { configs: [], active: '' })
		]);
	},
	render: function (data) {
		let activePath = (data[1] && data[1].active) || data[0].config || '';
		let configs = (data[1] && data[1].configs) || [];

		const wrap = function (title, bodyEl) {
			return E('div', { 'class': 'cbi-section', style: 'padding:6px 10px !important; margin-bottom:8px !important;' }, [
				E('h3', { style: 'font-size:13px; margin:0 0 4px !important;' }, title),
				E('div', {}, [bodyEl])
			]);
		};
		const line = function (label, el) {
			return E('div', { style: 'display:flex; align-items:center; gap:6px; margin:1px 0;' }, [
				E('span', { style: 'min-width:86px; color:#555;' }, label),
				E('div', {}, [el])
			]);
		};
		const smallBtn = function (label, style, onclick) {
			const b = E('button', {
				'class': 'btn cbi-button ' + style,
				type: 'button',
				style: 'padding:1px 10px; font-size:12px; line-height:1.7; height:auto; min-height:0;'
			}, label);
			b.addEventListener('click', onclick);
			return b;
		};
		const nameOf = function (p) { return p ? p.split('/').pop() : _('未设置'); };

		/* ---------- 订阅管理（多订阅：内置模板 + 填订阅地址即用） ---------- */
		const subListBox = E('div', { style: 'margin-bottom:6px;' });
		const subAddInput = E('input', {
			'class': 'cbi-input-text', type: 'text',
			style: 'width:100%; max-width:520px;',
			placeholder: 'https://… 添加订阅地址'
		});
		let subActive = false;
		const refreshSub = function () {
			return L.resolveDefault(homi.getSubscriptions(), { urls: [], active: false }).then((d) => {
				const urls = (d && d.urls) || [];
				subActive = !!(d && d.active);
				subListBox.innerHTML = '';
				if (!urls.length) {
					subListBox.appendChild(E('div', { style: 'font-size:12px; color:#555; margin-bottom:4px;' },
						_('未设置订阅地址，填入后自动生成配置并启用')));
				}
				urls.forEach(function (u, i) {
					const idx = i + 1;
					const inp = E('input', {
						'class': 'cbi-input-text', type: 'text',
						style: 'width:100%; max-width:420px;', value: u
					});
					subListBox.appendChild(E('div', { style: 'display:flex; gap:8px; align-items:center; margin-bottom:4px; flex-wrap:wrap;' }, [
						E('span', { style: 'color:#555; font-size:12px;' }, '#' + idx),
						inp,
						smallBtn(_('更新'), 'cbi-button-action', function () {
							const nu = inp.value.trim();
							if (!nu) { notify(_('订阅地址不能为空'), 'error'); return; }
							homi.updateSubscription(String(idx), nu)
								.then((r) => {
									if (r && r.success) {
										homi.logMsg('[App] 订阅地址已更新（已重载服务）');
										notify(_('已更新，正在重载服务…'));
										return homi.reload().catch(() => {}).then(() => refreshAll().then(refreshSub));
									}
									const detail = (r && r.error === 'invalid_url') ? _('（地址格式不正确）') : '';
									notify(_('更新失败') + detail, 'error');
								})
								.catch((e) => notify(_('更新失败：') + ((e && e.message) || e), 'error'));
						}),
						smallBtn(_('删除'), 'cbi-button-negative', function () {
							if (!confirm(_('确定删除这条订阅吗？'))) return;
							homi.removeSubscription(String(idx))
								.then((r) => {
									if (r && r.success) {
										notify(r.stopped ? _('已删除，服务已停止。') : _('已删除，正在重载服务…'));
										const p = r.stopped ? Promise.resolve() : homi.reload().catch(() => {});
										return p.then(() => refreshAll().then(refreshSub));
									}
									notify(_('删除失败'), 'error');
								})
								.catch((e) => notify(_('删除失败：') + ((e && e.message) || e), 'error'));
						})
					]));
				});
				if (urls.length) {
					subListBox.appendChild(E('div', { style: 'font-size:12px; color:#555; margin:2px 0 6px;' },
						subActive ? _('订阅配置正使用中') : _('订阅已保存，但正使用的不是订阅配置')));
				}
			});
		};
		const subAddBtn = smallBtn(_('添加订阅'), 'cbi-button-positive', function () {
			const url = subAddInput.value.trim();
			if (!url) {
				notify(_('请填写订阅地址'), 'error');
				return;
			}
			homi.addSubscription(url)
				.then((r) => {
					if (r && r.success) {
						subAddInput.value = '';
						homi.logMsg('[App] 已添加订阅并设为正使用配置（已重载服务）');
						notify(_('已添加，正在重载服务…'));
						return homi.reload().catch(() => {}).then(() => refreshAll().then(refreshSub));
					}
					const detail = (r && r.error === 'invalid_url') ? _('（地址格式不正确）')
						: ((r && r.error === 'duplicate') ? _('（该地址已存在）') : '');
					notify(_('添加失败') + detail, 'error');
				})
				.catch((e) => notify(_('添加失败：') + ((e && e.message) || e), 'error'));
		});
		const subCard = wrap(_('订阅管理'), E('div', {}, [
			subListBox,
			line(_('添加订阅'), E('div', { style: 'display:flex; gap:8px; align-items:center; flex-wrap:wrap;' }, [subAddInput, subAddBtn]))
		]));


		/* ---------- 在线编辑（先建，列表的编辑按钮要调用） ---------- */
		const editorSel = E('select', { 'class': 'cbi-input-select', style: 'min-width:180px;' });
		const editorArea = E('textarea', {
			'class': 'cbi-input-textarea',
			style: 'width:100%; min-height:300px; font-family:monospace; font-size:12px; margin-top:6px;',
			spellcheck: 'false',
			wrap: 'off'
		});
		let editorPath = '';
		const loadIntoEditor = function (path) {
			editorPath = path;
			editorSel.value = path;
			if (!path) {
				editorArea.value = '';
				return;
			}
			homi.readConfig(path)
				.then((content) => { editorArea.value = content || ''; })
				.catch((e) => notify(_('读取失败：') + ((e && e.message) || e), 'error'));
		};
		const openInEditor = function (path) {
			loadIntoEditor(path);
			editorArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
			editorArea.focus();
		};
		editorSel.addEventListener('change', function () {
			loadIntoEditor(editorSel.value);
		});
		const refreshEditorOptions = function () {
			const cur = editorSel.value;
			editorSel.innerHTML = '';
			editorSel.appendChild(E('option', { value: '' }, _('-- 请选择 --')));
			configs.forEach(function (c) {
				const opt = E('option', { value: c.path }, c.name + (c.path === activePath ? _('（正使用）') : ''));
				if (c.path === cur) opt.selected = true;
				editorSel.appendChild(opt);
			});
		};
		const editorSave = E('button', { 'class': 'btn cbi-button cbi-button-save', type: 'button' }, _('保存'));
		const editorSaveApply = E('button', { 'class': 'btn cbi-button cbi-button-apply', type: 'button' }, _('保存并应用'));
		const doSave = function (apply) {
			if (!editorPath) {
				notify(_('请先选择一个配置文件'), 'error');
				return;
			}
			const name = nameOf(editorPath);
			homi.writeConfig(editorPath, editorArea.value)
				.then((wr) => {
					if (!(wr && wr.success)) {
						notify(_('保存失败：') + ((wr && wr.error) || ''), 'error');
						return null;
					}
					if (apply) {
						homi.logMsg('[App] 编辑保存并应用：' + name + '（已重载服务）');
						notify(_('保存成功，已重载服务。'));
						return homi.reload().catch(() => {});
					}
					homi.logMsg('[App] 编辑保存：' + name);
					notify(_('保存成功。'));
					return null;
				})
				.catch((e) => notify(_('保存失败：') + ((e && e.message) || e), 'error'));
		};
		editorSave.addEventListener('click', () => doSave(false));
		editorSaveApply.addEventListener('click', () => doSave(true));
		const editorCard = wrap(_('在线编辑'), E('div', {}, [
			line(_('选择文件'), editorSel),
			editorArea,
			E('div', { style: 'display:flex; gap:8px; align-items:center; margin-top:6px;' }, [editorSave, editorSaveApply])
		]));

		/* ---------- 配置列表 ---------- */
		const listBox = E('div', { id: 'config_list_box' });
		const listCard = wrap(_('配置列表'), listBox);

		/* ---------- 配置列表（文件夹内的全部 yaml 配置） ---------- */
		const renderList = function () {
			listBox.innerHTML = '';
			if (!configs.length) {
				listBox.appendChild(E('em', {}, _('暂无配置文件')));
				return;
			}
			configs.forEach(function (c) {
				const isActive = c.path === activePath;
				const rowEl = E('div', { style: 'display:flex; align-items:center; gap:6px; padding:1px 0;' }, [
					E('code', {}, c.name),
					isActive ? E('span', { style: 'color:green; font-size:12px;' }, _('（正使用）')) : E('span', {}, ''),
					c.name === 'subscription.yaml' ? E('span', { style: 'color:#888; font-size:12px;' }, _('（订阅生成）')) : E('span', {}, '')
				]);
				if (!isActive) {
					rowEl.appendChild(smallBtn(_('删除'), 'cbi-button-negative', function () {
						if (!confirm(_('确定删除 ') + c.name + _(' 吗？'))) return;
						homi.deleteConfig(c.path)
							.then((r) => {
								if (r && r.success) {
									homi.logMsg('[App] 删除配置：' + c.name);
									notify(_('已删除：') + c.name);
									return refreshAll();
								}
								notify(_('删除失败'), 'error');
							})
							.catch((e) => notify(_('删除失败：') + ((e && e.message) || e), 'error'));
					}));
				}
				listBox.appendChild(rowEl);
			});
		};

		/* ---------- 上传 ---------- */
		/* 刷新时以后端回读的 UCI 真值为准，同步列表的（正使用）标记 */
		const refreshAll = function () {
			return homi.listConfigs().then((d) => {
				configs = (d && d.configs) || [];
				if (d && d.active) activePath = d.active;
				renderList();
				refreshEditorOptions();
			});
		};
		const fileInput = E('input', { type: 'file', accept: '.yaml,.yml' });
		const uploadBtn = E('button', { 'class': 'btn cbi-button cbi-button-action', type: 'button' }, _('上传检测'));
		uploadBtn.addEventListener('click', function () {
			const f = fileInput.files[0];
			if (!f) {
				notify(_('请先选择一个配置文件'), 'error');
				return;
			}
			const dest = '/etc/homi/' + f.name;
			homi.uploadFile(f, dest)
				.then(() => homi.testConfig(dest))
				.then((r) => {
					if (r && r.success) {
						/* 成功不弹窗，只记日志并刷新页面 */
						homi.logMsg('[App] 上传配置：' + f.name + '（校验通过，已设为正使用配置）');
						return homi.setConfig(dest).then((sr) => {
							if (!(sr && sr.success)) {
								notify(_('设置正使用配置失败'), 'error');
								return null;
							}
							return refreshAll();
						});
					} else {
						homi.logMsg('[App] 上传配置校验未通过：' + f.name);
						const emsg = r && r.error ? r.error : '';
						const detail = emsg === 'timeout'
							? _('（校验超时：网络慢或下载卡住，请稍后重试）')
							: emsg === 'mmdb_download_failed'
							? _('（MMDB 下载失败：请检查网络后重试，路由器需能访问 gh-proxy 或 GitHub）')
							: (emsg ? '（' + emsg + '）' : '');
						notify(_('配置校验未通过，请检查文件内容。') + detail, 'error');
					}
				})
				.catch((e) => {
					homi.logMsg('[App] 上传失败：' + f.name + '（' + ((e && e.message) || e) + '）');
					notify(_('上传失败：') + ((e && e.message) || e), 'error');
				});
		});
		const uploadCard = wrap(_('上传'), line(_('上传配置文件'), E('div', {}, [fileInput, ' ', uploadBtn])));

		renderList();
		refreshEditorOptions();
		refreshSub();

		return E('div', {}, [
			E('h2', { style: 'margin:6px 0;' }, _('配置文件')),
			subCard,
			listCard,
			uploadCard,
			editorCard
		]);
	}
});
