const fs = require('fs');
const http = require('http');
const WebSocket = require('ws');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 8080;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on ws://0.0.0.0:${PORT}`);
});

let users = {};
let onlinePlayers = {};
let tiles = [];

if (fs.existsSync('users.json')) {
  users = JSON.parse(fs.readFileSync('users.json'));
}

function generateInitialTiles() {
  for (let x = 0; x < 10000; x += 50) {
    for (let y = 0; y < 10000; y += 50) {
      if (Math.random() < 0.1) {
        const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff];
        tiles.push({
          x: x,
          y: y,
          color: colors[Math.floor(Math.random() * colors.length)],
        });
      }
    }
  }
}

if (tiles.length === 0) {
  generateInitialTiles();
}

wss.on('connection', (ws) => {
  console.log('New client connected'); // Giữ log từ local
  ws.on('message', (message) => {
    const data = JSON.parse(message);

    if (data.type === 'login') {
      if (users[data.username] && users[data.username].password === data.password) {
        const user = users[data.username];
        if (onlinePlayers[user.id]) {
          onlinePlayers[user.id].send(
            JSON.stringify({ type: 'force_logout', message: 'Account logged in from another tab' })
          );
          onlinePlayers[user.id].close();
        }
        onlinePlayers[user.id] = ws;
        ws.send(JSON.stringify({ type: 'auth', success: true, ...user }));
      } else {
        ws.send(JSON.stringify({ type: 'auth', success: false, message: 'Invalid username or password' }));
      }
    } else if (data.type === 'register') {
      if (users[data.username]) {
        ws.send(JSON.stringify({ type: 'auth', success: false, message: 'Username already exists' }));
      } else {
        const user = {
          id: data.username,
          username: data.username,
          password: data.password,
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
        fs.writeFileSync('users.json', JSON.stringify(users));
        ws.send(JSON.stringify({ type: 'auth', success: true, ...user }));
      }
    } else if (data.type === 'join') {
      const initPlayers = Object.keys(onlinePlayers)
        .filter((id) => id !== data.id && users[id])
        .map((id) => ({
          id,
          x: users[id].lastX || 0,
          y: users[id].lastY || 0,
          characterName: users[id].characterName,
        }));
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
        fs.writeFileSync('users.json', JSON.stringify(users));
      }
    } else if (data.type === 'move') {
      if (users[data.id]) {
        users[data.id].lastX = data.x;
        users[data.id].lastY = data.y;
        fs.writeFileSync('users.json', JSON.stringify(users));
      }
      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(data));
        }
      });
    } else if (data.type === 'chat') {
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(data));
        }
      });
    } else if (data.type === 'trade') {
      if (onlinePlayers[data.to]) {
        onlinePlayers[data.to].send(
          JSON.stringify({
            type: 'trade',
            from: data.from,
            to: data.to,
            aura: data.aura,
            coinsPay: data.coinsReceive,
            coinsReceive: data.coinsPay,
          })
        );
      }
      if (users[data.from]) {
        if (data.aura) {
          users[data.from].inventory = users[data.from].inventory.filter((a) => a.name !== data.aura.name);
        }
        users[data.from].coins = users[data.from].coins - data.coinsPay + data.coinsReceive;
        fs.writeFileSync('users.json', JSON.stringify(users));
      }
      if (users[data.to] && data.aura) {
        users[data.to].inventory.push(data.aura);
        users[data.to].coins = users[data.to].coins + data.coinsPay - data.coinsReceive;
        fs.writeFileSync('users.json', JSON.stringify(users));
      }
    } else if (data.type === 'save_position') {
      if (users[data.id]) {
        users[data.id].lastX = data.x;
        users[data.id].lastY = data.y;
        users[data.id].coins = data.coins;
        users[data.id].inventory = data.inventory;
        fs.writeFileSync('users.json', JSON.stringify(users));
      }
    } else if (data.type === 'update_inventory') {
      if (users[data.id]) {
        users[data.id].inventory = data.inventory;
        fs.writeFileSync('users.json', JSON.stringify(users));
      }
    } else if (data.type === 'update_coins') {
      if (users[data.id]) {
        users[data.id].coins = data.coins;
        fs.writeFileSync('users.json', JSON.stringify(users));
      }
    } else if (data.type === 'update_name') {
      if (users[data.id]) {
        users[data.id].characterName = data.characterName;
        users[data.id].nameChangeCount = (users[data.id].nameChangeCount || 0) + 1;
        users[data.id].nameChangeCost = Math.floor((users[data.id].nameChangeCost || 100) * 1.5);
        users[data.id].coins = data.coins;
        fs.writeFileSync('users.json', JSON.stringify(users));
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
    }
  });

  ws.on('close', () => {
    for (let id in onlinePlayers) {
      if (onlinePlayers[id] === ws) {
        if (users[id]) {
          fs.writeFileSync('users.json', JSON.stringify(users));
        }
        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'leave', id }));
          }
        });
        delete onlinePlayers[id];
        break;
      }
    }
    console.log('Client disconnected');
  });
});