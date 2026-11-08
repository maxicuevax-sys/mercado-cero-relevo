/* One-time setup over Kuma's local Socket.IO API; never prints credentials. */
const fs = require('node:fs');
const { io } = require('socket.io-client');
const credentials = JSON.parse(fs.readFileSync(0, 'utf8'));
const socket = io('http://127.0.0.1:4591', {
    transports: ['websocket'], reconnection: false,
    extraHeaders: { Origin: 'http://127.0.0.1:4591' },
});
const timeout = setTimeout(() => { console.error('Kuma API timeout'); process.exit(1); }, 30000);
const emit = (event, ...args) => new Promise((resolve, reject) => {
    socket.timeout(10000).emit(event, ...args, (error, result) => {
        if (error) reject(error);
        else if (result && result.ok === false) reject(new Error(result.msg));
        else resolve(result);
    });
});
socket.on('connect_error', () => { console.error('Kuma connection failed'); process.exit(1); });
let monitorList = {};
socket.on('monitorList', list => { monitorList = list; });
// Kuma awaits sendInfo() before registering its request handlers.
socket.once('info', async () => {
    try {
        if (await emit('needSetup')) await emit('setup', credentials.username, credentials.password);
        await emit('login', credentials);
        await emit('getMonitorList');
        const existing = Object.values(monitorList);
        const monitors = [
            { name: 'Mercado Cero · build de aplicación', type: 'keyword',
                url: 'http://127.0.0.1:4590/api/health',
                keyword: '09b4f8d1aa63f40682e2e4082034fe952a1dd1e2', accepted_statuscodes: ['200'] },
            { name: 'Mercado Cero · túnel listo', type: 'http',
                url: 'http://127.0.0.1:20459/ready', accepted_statuscodes: ['200'] },
            { name: 'Mercado Cero · barrera Access', type: 'http',
                url: 'https://mercado.zicua.com/inicio', accepted_statuscodes: ['302'] },
        ];
        if (credentials.backupPushToken) monitors.push({
            name: 'Mercado Cero · respaldo reciente', type: 'push',
            pushToken: credentials.backupPushToken, interval: 7200,
            accepted_statuscodes: ['200'],
        });
        for (const monitor of monitors) {
            if (existing.some(item => item.name === monitor.name)) continue;
            const result = await emit('add', {
                interval: 60, retryInterval: 60, maxretries: 2, timeout: 10,
                maxredirects: 0, method: 'GET', active: true,
                notificationIDList: {}, upsideDown: false, ignoreTls: false,
                conditions: [], kafkaProducerBrokers: [],
                kafkaProducerSaslOptions: {}, rabbitmqNodes: [],
                ...monitor,
            });
            console.log(JSON.stringify({ name: monitor.name, id: result.monitorID, created: true }));
        }
        console.log('Kuma configured. Notification delivery is not configured.');
    } catch (error) {
        console.error(error.message); process.exitCode = 1;
    } finally {
        clearTimeout(timeout); socket.disconnect();
    }
});
