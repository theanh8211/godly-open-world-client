const fs = require('fs');
const http = require('http');
const WebSocket = require('ws');
const bcrypt = require('bcryptjs');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 8080;
const USER_FILE = '/data/users.json';

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on ws://0.0.0.0:${PORT} - Primary region: ${process.env.FLY_REGION || 'unknown'}`);
});

let users = {};
let onlinePlayers = {};
let tiles = [];
const connectionLimits = new Map();
const MAX_CONNECTIONS_PER_IP = 5;
const MESSAGE_RATE_LIMIT = 10; // 10 tin nhắn/phút
const rateLimits = new Map();

if (fs.existsSync(USER_FILE)) {
  try {
    users = JSON.parse(fs.readFileSync(USER_FILE));
    console.log(`Loaded ${Object.keys(users).length} users from ${USER_FILE}`);
  } catch (error) {
    console.error('Error loading users.json:', error.message);
  }
} else {
  console.log('No users.json found, initializing empty user store');
}

function generateInitialTiles() {
  for (let x = 0; x < 10000; x += 50) {
    for (let y = 0; y < 10000; y += 50) {
      if (Math.random() < 0.1) {
        const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff];
        tiles.push({ x, y, color: colors[Math.floor(Math.random() * colors.length)] });
      }
    }
  }
}

if (tiles.length === 0) {
  generateInitialTiles();
  console.log(`Generated ${tiles.length} initial tiles`);
}

function saveUsers() {
  try {
    fs.writeFileSync(USER_FILE, JSON.stringify(users, null, 2));
    console.log(`Saved ${Object.keys(users).length} users to ${USER_FILE}`);
  } catch (error) {
    console.error('Error saving users:', error.message);
  }
}

function checkRateLimit(clientIp) {
  const now = Date.now();
  if (!rateLimits.has(clientIp)) {
    rateLimits.set(clientIp, { count: 1, lastReset: now });
    return true;
  }
  const limit = rateLimits.get(clientIp);
  if (now - limit.lastReset > 60000) {
    limit.count = 1;
    limit.lastReset = now;
    return true;
  }
  if (limit.count >= MESSAGE_RATE_LIMIT) {
    console.log(`Rate limit exceeded for IP ${clientIp}`);
    return false;
  }
  limit.count++;
  return true;
}

wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress || 'unknown';
  console.log(`New client connected from ${clientIp} - Total clients: ${wss.clients.size}`);

  const ipCount = (connectionLimits.get(clientIp) || 0) + 1;
  if (ipCount > MAX_CONNECTIONS_PER_IP) {
    console.log(`Connection limit (${MAX_CONNECTIONS_PER_IP}) exceeded for ${clientIp}`);
    ws.send(JSON.stringify({ type: 'error', message: 'Too many connections from your IP' }));
    ws.close();
    return;
  }
  connectionLimits.set(clientIp, ipCount);

  ws.on('message', async (message) => {
    try {
      if (!checkRateLimit(clientIp)) {
        ws.send(JSON.stringify({ type: 'error', message: 'Rate limit exceeded, please slow down!' }));
        return;
      }

      const data = JSON.parse(message);
      console.log(`Received: ${data.type} from ${data.id || data.username || clientIp}`);

      if (data.type === 'login') {
        if (!users[data.username]) {
          ws.send(JSON.stringify({ type: 'auth', success: false, message: 'Username does not exist' }));
        } else if (await bcrypt.compare(data.password, users[data.username].password)) {
          const user = users[data.username];
          if (onlinePlayers[user.id]) {
            console.log(`Forcing logout for ${user.id} from previous session`);
            onlinePlayers[user.id].send(JSON.stringify({ type: 'force_logout', message: 'Account logged in elsewhere' }));
            onlinePlayers[user.id].close();
          }
          onlinePlayers[user.id] = ws;
          ws.send(JSON.stringify({ type: 'auth', success: true, ...user }));
          console.log(`${user.id} logged in successfully`);
        } else {
          ws.send(JSON.stringify({ type: 'auth', success: false, message: 'Invalid password' }));
        }
      } else if (data.type === 'register') {
        if (users[data.username]) {
          ws.send(JSON.stringify({ type: 'auth', success: false, message: 'Username already exists' }));
        } else {
          const hashedPassword = await bcrypt.hash(data.password, 10); // Cho phép ký tự đặc biệt
          const user = {
            id: data.username,
            username: data.username,
            password: hashedPassword,
            coins: 0,
            inventory: [],
            lastX: null,
            lastY: null,
            characterName: null,
            nameChangeCount: 0,
            nameChangeCost: 100,
          };
          users[data.username] = user;
          onlinePlayers[user.id] = ws;
          saveUsers();
          ws.send(JSON.stringify({ type: 'auth', success: true, ...user }));
          console.log(`New user ${user.id} registered`);
        }
      } else if (data.type === 'change_password') {
        if (!users[data.id] || !onlinePlayers[data.id] || onlinePlayers[data.id] !== ws) {
          ws.send(JSON.stringify({ type: 'change_password', success: false, message: 'Not authenticated' }));
        } else if (!(await bcrypt.compare(data.oldPassword, users[data.id].password))) {
          ws.send(JSON.stringify({ type: 'change_password', success: false, message: 'Incorrect old password' }));
        } else {
          users[data.id].password = await bcrypt.hash(data.newPassword, 10);
          saveUsers();
          ws.send(JSON.stringify({ type: 'change_password', success: true, message: 'Password changed successfully' }));
          console.log(`${data.id} changed password`);
        }
      } else if (data.type === 'join') {
        const initPlayers = Object.keys(onlinePlayers)
          .filter((id) => id !== data.id && users[id])
          .map((id) => ({ id, x: users[id].lastX || 0, y: users[id].lastY || 0, characterName: users[id].characterName }));
        ws.send(JSON.stringify({ type: 'init_players', players: initPlayers }));
        ws.send(JSON.stringify({ type: 'init_tiles', tiles }));
        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
          }
        });
        if (users[data.id]) {
          users[data.id].lastX = data.x;
          users[data.id].lastY = data.y;
          saveUsers();
        }
        console.log(`${data.id} joined the game`);
      } else if (data.type === 'move') {
        if (users[data.id]) {
          users[data.id].lastX = data.x;
          users[data.id].lastY = data.y;
          saveUsers();
        }
        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
          }
        });
      } else if (data.type === 'chat') {
        console.log(`Broadcasting chat from ${data.id}: ${data.message}`);
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
          }
        });
      } else if (data.type === 'trade') {
        if (onlinePlayers[data.to]) {
          onlinePlayers[data.to].send(JSON.stringify({
            type: 'trade',
            from: data.from,
            to: data.to,
            aura: data.aura,
            coinsPay: data.coinsReceive,
            coinsReceive: data.coinsPay,
          }));
        }
        if (users[data.from]) {
          if (data.aura) users[data.from].inventory = users[data.from].inventory.filter((a) => a.name !== data.aura.name);
          users[data.from].coins = users[data.from].coins - data.coinsPay + data.coinsReceive;
          saveUsers();
        }
        if (users[data.to] && data.aura) {
          users[data.to].inventory.push(data.aura);
          users[data.to].coins = users[data.to].coins + data.coinsPay - data.coinsReceive;
          saveUsers();
        }
      } else if (data.type === 'save_position') {
        if (users[data.id]) {
          users[data.id].lastX = data.x;
          users[data.id].lastY = data.y;
          users[data.id].coins = data.coins;
          users[data.id].inventory = data.inventory;
          saveUsers();
        }
      } else if (data.type === 'update_inventory') {
        if (users[data.id]) {
          users[data.id].inventory = data.inventory;
          saveUsers();
        }
      } else if (data.type === 'update_coins') {
        if (users[data.id]) {
          users[data.id].coins = data.coins;
          saveUsers();
        }
      } else if (data.type === 'update_name') {
        if (users[data.id]) {
          users[data.id].characterName = data.characterName;
          users[data.id].nameChangeCount = (users[data.id].nameChangeCount || 0) + 1;
          users[data.id].nameChangeCost = Math.floor((users[data.id].nameChangeCost || 100) * 1.5);
          users[data.id].coins = data.coins;
          saveUsers();
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify(data));
            }
          });
        }
      } else if (data.type === 'mine_tile') {
        tiles = tiles.filter((t) => !(t.x === data.tile.x && t.y === data.tile.y));
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
          }
        });
      } else if (data.type === 'spawn_tile') {
        tiles.push(data.tile);
        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
          }
        });
      } else if (data.type === 'leave') {
        delete onlinePlayers[data.id];
        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'leave', id: data.id }));
          }
        });
        console.log(`${data.id} left the game`);
      }
    } catch (error) {
      console.error(`Error processing message from ${clientIp}:`, error.message);
      ws.send(JSON.stringify({ type: 'error', message: 'Server error, please try again' }));
    }
  });

  ws.on('close', () => {
    const ipCount = connectionLimits.get(clientIp) - 1;
    if (ipCount <= 0) connectionLimits.delete(clientIp);
    else connectionLimits.set(clientIp, ipCount);
    for (let id in onlinePlayers) {
      if (onlinePlayers[id] === ws) {
        if (users[id]) saveUsers();
        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'leave', id }));
          }
        });
        delete onlinePlayers[id];
        console.log(`Client ${id} disconnected from ${clientIp} - Remaining clients: ${wss.clients.size}`);
        break;
      }
    }
  });

  ws.on('error', (error) => {
    console.error(`WebSocket error from ${clientIp}:`, error.message);
  });
});

server.on('error', (error) => {
  console.error('Server error:', error.message);
});

setInterval(() => {
  saveUsers();
  console.log(`Autosave completed - Online players: ${Object.keys(onlinePlayers).length}`);
}, 60000);