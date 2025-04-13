const fs = require('fs');
const http = require('http');
const WebSocket = require('ws');
const bcrypt = require('bcryptjs');
const { handleLogin, handleRegister } = require('./socket/handlers.js');
const { handleMovement } = require('./socket/player-movement.js');
const { handleTeleport } = require('./socket/teleport.js');
const { handleParty } = require('./socket/party.js');

const server = http.createServer((req, res) => {
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('OK');
    } else {
        res.writeHead(404);
        res.end();
    }
});
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 8080;
const USER_FILE = './data/users.json';
const MAP_FILE = './data/maps.json';

let users = {}, onlinePlayers = {}, tiles = [], parties = {};
const connectionLimits = new Map();
const MAX_CONNECTIONS_PER_IP = 5;
const MESSAGE_RATE_LIMIT = 20;
const rateLimits = new Map();

if (fs.existsSync(USER_FILE)) {
    users = JSON.parse(fs.readFileSync(USER_FILE));
}

if (fs.existsSync(MAP_FILE)) {
    tiles = JSON.parse(fs.readFileSync(MAP_FILE)).tiles;
}

function saveUsers() {
    fs.writeFileSync(USER_FILE, JSON.stringify(users, null, 2));
}

function checkRateLimit(clientIp) {
    const now = Date.now();
    if (!rateLimits.has(clientIp)) {
        rateLimits.set(clientIp, { count: 1, lastReset: now, logged: false });
        return true;
    }
    const limit = rateLimits.get(clientIp);
    if (now - limit.lastReset > 60000) {
        limit.count = 1;
        limit.lastReset = now;
        limit.logged = false;
        return true;
    }
    if (limit.count >= MESSAGE_RATE_LIMIT) {
        if (!limit.logged) {
            console.log(`Rate limit exceeded for IP ${clientIp}`);
            limit.logged = true;
        }
        return false;
    }
    limit.count++;
    return true;
}

wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress || 'unknown';
    console.log(`New client connected from ${clientIp}`);

    const ipCount = (connectionLimits.get(clientIp) || 0) + 1;
    if (ipCount > MAX_CONNECTIONS_PER_IP) {
        ws.send(JSON.stringify({ type: 'error', message: 'Too many connections' }));
        ws.close();
        return;
    }
    connectionLimits.set(clientIp, ipCount);

    ws.on('message', async (message) => {
        if (!checkRateLimit(clientIp)) {
            ws.send(JSON.stringify({ type: 'error', message: 'Rate limit exceeded' }));
            return;
        }

        const data = JSON.parse(message);
        switch (data.type) {
            case 'login':
                handleLogin(ws, data, users, onlinePlayers);
                break;
            case 'register':
                handleRegister(ws, data, users, onlinePlayers);
                break;
            case 'move':
                handleMovement(ws, data, users, wss);
                break;
            case 'teleport':
                handleTeleport(ws, data, users, wss);
                break;
            case 'party_invite':
            case 'party_message':
                handleParty(ws, data, parties, wss);
                break;
            case 'join':
                ws.send(JSON.stringify({ type: 'init_players', players: Object.values(users).map(u => ({
                    id: u.id, x: u.lastX || 0, y: u.lastY || 0, characterName: u.characterName
                })) }));
                ws.send(JSON.stringify({ type: 'init_tiles', tiles }));
                wss.clients.forEach(client => {
                    if (client !== ws) client.send(JSON.stringify(data));
                });
                break;
            case 'chat':
                wss.clients.forEach(client => client.send(JSON.stringify(data)));
                break;
            case 'mine_tile':
                tiles = tiles.filter(t => !(t.x === data.tile.x && t.y === data.tile.y));
                wss.clients.forEach(client => client.send(JSON.stringify(data)));
                break;
            case 'spawn_tile':
                tiles.push(data.tile);
                wss.clients.forEach(client => {
                    if (client !== ws) client.send(JSON.stringify(data));
                });
                break;
            case 'update_inventory':
                if (users[data.id]) {
                    users[data.id].inventory = data.inventory;
                    saveUsers();
                }
                break;
            case 'update_coins':
                if (users[data.id]) {
                    users[data.id].coins = data.coins;
                    saveUsers();
                }
                break;
        }
    });

    ws.on('close', () => {
        const ipCount = connectionLimits.get(clientIp) - 1;
        if (ipCount <= 0) connectionLimits.delete(clientIp);
        else connectionLimits.set(clientIp, ipCount);
        for (let id in onlinePlayers) {
            if (onlinePlayers[id] === ws) {
                delete onlinePlayers[id];
                wss.clients.forEach(client => {
                    client.send(JSON.stringify({ type: 'leave', id }));
                });
            }
        }
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});