/* Scoped Kuma setup/reconciliation. Credentials are stdin-only and never logged. */
const fs = require('node:fs');
const DEFAULT_TARGET_PATH = '/opt/mercado-cero/pilot/runtime-target.json';
const LEGACY_SHA = '09b4f8d1aa63f40682e2e4082034fe952a1dd1e2';
const BUILD_NAME = 'Mercado Cero · build de aplicación';
const BUILD_URL = 'http://127.0.0.1:4590/api/health';

function validateRuntimeTarget(value) {
    if (!value || Array.isArray(value) || typeof value !== 'object' ||
        Object.keys(value).sort().join(',') !== 'buildSha,requireJudgeAccounts,version' ||
        value.version !== 1 || typeof value.buildSha !== 'string' ||
        !/^[a-fA-F0-9]{40}$/.test(value.buildSha) || typeof value.requireJudgeAccounts !== 'boolean') {
        throw new Error('Invalid runtime target configuration');
    }
    return { ...value, buildSha: value.buildSha.toLowerCase() };
}

function loadRuntimeTarget(path = DEFAULT_TARGET_PATH) {
    let text;
    try { text = fs.readFileSync(path, 'utf8').replace(/^\uFEFF/, ''); }
    catch (error) {
        if (error.code === 'ENOENT') return { version: 1, buildSha: LEGACY_SHA, requireJudgeAccounts: false };
        throw error;
    }
    if (text.length > 4096) throw new Error('Runtime target exceeds size limit');
    const value = validateRuntimeTarget(JSON.parse(text));
    // Configuration values cannot contain object keys; reject duplicate keys,
    // including escaped spellings, rather than accepting JSON.parse's last value.
    const keys = [...text.matchAll(/"((?:[^"\\]|\\.)*)"\s*:/g)].map(match => JSON.parse('"' + match[1] + '"'));
    if (keys.length !== 3 || new Set(keys).size !== 3) throw new Error('Duplicate runtime target key');
    return value;
}

function buildMonitors(target, backupPushToken) {
    target = validateRuntimeTarget(target);
    const monitors = [
        { name: BUILD_NAME, type: 'keyword', url: BUILD_URL,
            keyword: target.buildSha, accepted_statuscodes: ['200'] },
        { name: 'Mercado Cero · túnel listo', type: 'http',
            url: 'http://127.0.0.1:20459/ready', accepted_statuscodes: ['200'] },
        { name: 'Mercado Cero · barrera Access', type: 'http',
            url: 'https://mercado.zicua.com/inicio', accepted_statuscodes: ['302'] },
    ];
    if (backupPushToken) monitors.push({ name: 'Mercado Cero · respaldo reciente', type: 'push',
        pushToken: backupPushToken, interval: 7200, accepted_statuscodes: ['200'] });
    return monitors;
}

function planBuildUpdate(existing, target) {
    target = validateRuntimeTarget(target);
    if (!existing || existing.name !== BUILD_NAME || existing.type !== 'keyword' ||
        existing.url !== BUILD_URL || !Number.isInteger(existing.id) || existing.id < 1) {
        throw new Error('Managed build monitor identity does not match');
    }
    return existing.keyword === target.buildSha ? null : { ...existing, keyword: target.buildSha };
}

async function reconcile(emit, existing, target, backupPushToken, report = () => {}) {
    const desired = buildMonitors(target, backupPushToken);
    for (const monitor of desired) {
        const matches = existing.filter(item => item.name === monitor.name);
        if (matches.length > 1) throw new Error('Ambiguous managed monitor name');
        if (matches.length) {
            if (monitor.name !== BUILD_NAME) continue;
            // getMonitor and editMonitor verified against installed Kuma 2.5.9
            // /app/server/server.js:1016 and :818. Edit requires the FULL object.
            if (planBuildUpdate(matches[0], target)) {
                const full = (await emit('getMonitor', matches[0].id)).monitor;
                if (full?.id !== matches[0].id) throw new Error('Managed monitor ID changed');
                const update = planBuildUpdate(full, target);
                if (update) {
                    await emit('editMonitor', update);
                    report({ name: BUILD_NAME, id: update.id, updated: true });
                }
            }
            continue;
        }
        const result = await emit('add', {
            interval: 60, retryInterval: 60, maxretries: 2, timeout: 10,
            maxredirects: 0, method: 'GET', active: true,
            notificationIDList: {}, upsideDown: false, ignoreTls: false,
            conditions: [], kafkaProducerBrokers: [], kafkaProducerSaslOptions: {}, rabbitmqNodes: [],
            ...monitor,
        });
        report({ name: monitor.name, id: result.monitorID, created: true });
    }
}

function targetPathFromArgs(args) {
    if (args.length === 0) return DEFAULT_TARGET_PATH;
    if (args.length === 2 && args[0] === '--target' && args[1]) return args[1];
    throw new Error('Usage: configure-kuma.cjs [--target runtime-target.json]');
}

async function main() {
    // A container invocation may explicitly use a copied nonsecret target file.
    const targetPath = targetPathFromArgs(process.argv.slice(2));
    if (process.argv.length > 2 && !fs.existsSync(targetPath)) throw new Error('Explicit runtime target is missing');
    const target = loadRuntimeTarget(targetPath); // fail closed before connecting or reading secrets
    const credentials = JSON.parse(fs.readFileSync(0, 'utf8'));
    const { io } = require('socket.io-client');
    const socket = io('http://127.0.0.1:4591', {
        transports: ['websocket'], reconnection: false,
        extraHeaders: { Origin: 'http://127.0.0.1:4591' },
    });
    const timeout = setTimeout(() => { socket.disconnect(); process.exitCode = 1; }, 30000);
    const emit = (event, ...args) => new Promise((resolve, reject) => {
        socket.timeout(10000).emit(event, ...args, (error, result) => {
            if (error || result?.ok === false) reject(new Error('Kuma operation failed'));
            else resolve(result);
        });
    });
    socket.on('connect_error', () => {
        clearTimeout(timeout); socket.disconnect(); console.error('Kuma connection failed'); process.exitCode = 1;
    });
    let monitorList = {};
    socket.on('monitorList', list => { monitorList = list; });
    socket.once('info', async () => {
        try {
            if (await emit('needSetup')) await emit('setup', credentials.username, credentials.password);
            await emit('login', credentials);
            await emit('getMonitorList');
            await reconcile(emit, Object.values(monitorList), target, credentials.backupPushToken,
                result => console.log(JSON.stringify(result)));
            console.log('Kuma configured. Notification delivery is not configured.');
        } catch {
            console.error('Kuma configuration failed'); process.exitCode = 1;
        } finally { clearTimeout(timeout); socket.disconnect(); }
    });
}

module.exports = { validateRuntimeTarget, loadRuntimeTarget, buildMonitors, planBuildUpdate, reconcile, targetPathFromArgs };
if (require.main === module) main().catch(() => { console.error('Kuma setup failed'); process.exitCode = 1; });
