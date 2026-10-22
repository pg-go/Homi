'use strict';
'require baseclass';
'require rpc';
'require request';
'require fs';

const callRCList = rpc.declare({
    object: 'rc',
    method: 'list',
    params: ['name'],
    expect: { '': {} }
});

const callRCInit = rpc.declare({
    object: 'rc',
    method: 'init',
    params: ['name', 'action'],
    expect: { '': {} }
});

const callFileWrite = rpc.declare({
    object: 'file',
    method: 'write',
    params: ['path', 'data', 'append', 'mode']
});

const callVersion = rpc.declare({
    object: 'luci.homi',
    method: 'version',
    expect: { '': {} }
});

const callTestConfig = rpc.declare({
    object: 'luci.homi',
    method: 'test_config',
    params: ['path'],
    expect: { '': {} }
});

const callDashboard = rpc.declare({
    object: 'luci.homi',
    method: 'dashboard',
    expect: { '': {} }
});

const callUpdateDashboard = rpc.declare({
    object: 'luci.homi',
    method: 'update_dashboard',
    expect: { '': {} }
});

const callSetConfig = rpc.declare({
    object: 'luci.homi',
    method: 'set_config',
    params: ['path'],
    expect: { '': {} }
});

const callListConfigs = rpc.declare({
    object: 'luci.homi',
    method: 'list_configs',
    expect: { '': {} }
});

const callDeleteConfig = rpc.declare({
    object: 'luci.homi',
    method: 'delete_config',
    params: ['path'],
    expect: { '': {} }
});

const callLogMsg = rpc.declare({
    object: 'luci.homi',
    method: 'log_msg',
    params: ['msg'],
    expect: { '': {} }
});

const callGetSubscription = rpc.declare({
    object: 'luci.homi',
    method: 'get_subscription',
    expect: { '': {} }
});

const callSetSubscription = rpc.declare({
    object: 'luci.homi',
    method: 'set_subscription',
    params: ['url'],
    expect: { '': {} }
});

const callDeleteSubscription = rpc.declare({
    object: 'luci.homi',
    method: 'delete_subscription',
    expect: { '': {} }
});

const configPath = '/etc/homi/config.yaml';
const appLogPath = '/var/log/homi/app.log';
const coreLogPath = '/var/log/homi/core.log';

/* 只保留最后 500 行，防止内核日志过大 */
function tailLines(text) {
    const lines = String(text || '').split('\n');
    return lines.length > 500 ? lines.slice(lines.length - 500).join('\n') : String(text || '');
}

return baseclass.extend({
    configPath: configPath,
    appLogPath: appLogPath,
    coreLogPath: coreLogPath,

    status: async function () {
        return (await callRCList('homi'))?.homi?.running;
    },

    reload: function () {
        return callRCInit('homi', 'reload');
    },

    restart: function () {
        return callRCInit('homi', 'restart');
    },

    writefile: function (path, data, mode) {
        data = (data != null) ? String(data) : '';
        mode = (mode != null) ? mode : 0o644;

        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        const chunkSize = 8 * 1024;

        const bytes = encoder.encode(data);

        if (bytes.length <= chunkSize) {
            return callFileWrite(path, data, false, mode);
        }

        let promise = Promise.resolve();
        for (let offset = 0; offset < bytes.length; offset += chunkSize) {
            const chunkStart = offset;
            const chunkEnd = Math.min(offset + chunkSize, bytes.length);
            const isLastChunk = chunkEnd === bytes.length;
            const chunkBytes = bytes.slice(chunkStart, chunkEnd);
            const chunk = decoder.decode(chunkBytes, { stream: !isLastChunk });
            const append = offset > 0;
            promise = promise.then(() => callFileWrite(path, chunk, append, mode));
        }

        return promise;
    },

    version: function () {
        return callVersion();
    },

    testConfig: function (path) {
        return path ? callTestConfig(path) : callTestConfig();
    },

    dashboard: function () {
        return callDashboard();
    },

    updateDashboard: function () {
        return callUpdateDashboard();
    },

    setConfig: function (path) {
        return callSetConfig(path);
    },

    listConfigs: function () {
        return callListConfigs();
    },

    deleteConfig: function (path) {
        return callDeleteConfig(path);
    },

    /* 读文件：fs 直读（ACL file 权限管控），失败返回空串 */
    readConfig: function (path) {
        return L.resolveDefault(fs.read_direct(path), '');
    },

    /* 上传：走 LuCI 原生 cgi-upload 通道（form.FileUpload 同机制），受 ACL file 权限管控 */
    uploadFile: function (file, destPath) {
        const data = new FormData();
        data.append('sessionid', rpc.getSessionID());
        data.append('filename', destPath);
        data.append('filedata', file);
        return request.post(L.env.cgi_base + '/cgi-upload', data, { timeout: 0 }).then((res) => {
            const reply = res.json();
            if (L.isObject(reply) && reply.failure)
                throw new Error(reply.message || reply.failure);
            return reply;
        });
    },

    /* 编辑器保存：走标准 fs.write，按 8KB 分片（大内容一次写易被截断） */
    writeConfig: function (path, content) {
        return this.writefile(path, content).then(
            () => ({ success: true }),
            (e) => ({ success: false, error: String((e && e.message) || e || 'write_failed') })
        );
    },

    /* 日志读取：fs 直读文件（ACL file 权限管控），只取最后 500 行 */
    getAppLog: function () {
        return L.resolveDefault(fs.read_direct(appLogPath), '').then(tailLines);
    },

    getCoreLog: function () {
        return L.resolveDefault(fs.read_direct(coreLogPath), '').then(tailLines);
    },

    /* 清空日志：写空串 */
    clearAppLog: function () {
        return this.writefile(appLogPath, '');
    },

    clearCoreLog: function () {
        return this.writefile(coreLogPath, '');
    },

    logMsg: function (msg) {
        return callLogMsg(msg);
    },

    getSubscription: function () {
        return callGetSubscription();
    },

    setSubscription: function (url) {
        return callSetSubscription(url);
    },

    deleteSubscription: function () {
        return callDeleteSubscription();
    },

    openDashboard: async function () {
        const d = await callDashboard();
        if (!d || d.error || !d.controller) {
            return Promise.reject('not_configured');
        }

        const controller = String(d.controller);
        const port = controller.substring(controller.lastIndexOf(':') + 1);
        const protocol = d.tls ? 'https' : 'http';
        const query = new URLSearchParams({
            hostname: window.location.hostname,
            port: port,
            secret: d.secret ?? ''
        }).toString();
        const url = `${protocol}://${window.location.hostname}:${port}/ui/?${query}`;

        setTimeout(function () { window.open(url, '_blank'); }, 0);

        return Promise.resolve();
    }
});
