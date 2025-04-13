@echo off
setlocal EnableDelayedExpansion

echo Creating project directory structure...

:: Tạo thư mục client
mkdir client
cd client

:: Tạo thư mục assets và file phaser-dude.png
mkdir assets
cd assets
echo Placeholder for phaser-dude.png > phaser-dude.png
cd ..

:: Tạo thư mục maps và file map1.json
mkdir maps
cd maps
echo { "tiles": [] } > map1.json
cd ..

:: Tạo thư mục scripts và các file js
mkdir scripts
cd scripts

:: Tạo file game.js
(
echo import Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3.55.2/dist/phaser.min.js';
echo import { initWebSocket, sendMessage } from './socket.js';
echo import { initMinimap, updateMinimap } from './minimap.js';
echo import { initInventory, updateInventoryUI } from './inventory.js';
echo import { initParty } from './party.js';
echo import { initTeleport } from './teleport.js';
echo.
echo const config = {
echo     type: Phaser.AUTO,
echo     width: 800,
echo     height: 600,
echo     parent: 'game-canvas',
echo     scene: {
echo         preload: preload,
echo         create: create,
echo         update: update
echo     },
echo     physics: {
echo         default: 'arcade',
echo         arcade: {
echo             gravity: { y: 0 }
echo         }
echo     }
echo };
echo.
echo let game = new Phaser.Game(config);
echo let player, players = {}, cursors, tiles = [];
echo let playerId, playerName;
echo let ws;
echo let coins = 0, inventory = [];
echo let mining = false;
echo.
echo function preload() {
echo     this.load.image('dude', '../assets/phaser-dude.png');
echo }
echo.
echo function create() {
echo     this.cameras.main.setBackgroundColor('#87CEEB');
echo     cursors = this.input.keyboard.createCursorKeys();
echo     this.input.keyboard.on('keydown-SPACE', () => {
echo         if (!mining) {
echo             mining = true;
echo             setTimeout(() => {
echo                 let tile = tiles.find(t => Phaser.Math.Distance.Between(t.x, t.y, player.x, player.y) ^< 50);
echo                 if (tile) {
echo                     sendMessage({ type: 'mine_tile', tile: { x: tile.x, y: tile.y } });
echo                     tiles = tiles.filter(t => t.x !== tile.x ^|^ t.y !== tile.y);
echo                     coins += 10;
echo                     updateInventoryUI(coins, inventory);
echo                     sendMessage({ type: 'update_coins', id: playerId, coins });
echo                 }
echo                 mining = false;
echo             }, 2000);
echo         }
echo     });
echo     initWebSocket(onMessage);
echo     initUI();
echo     initMinimap(this);
echo     initInventory(this);
echo     initParty(this);
echo     initTeleport(this);
echo }
echo.
echo function update() {
echo     if (!player) return;
echo     let speed = 200;
echo     let velocity = { x: 0, y: 0 };
echo     if (cursors.left.isDown) velocity.x = -speed;
echo     if (cursors.right.isDown) velocity.x = speed;
echo     if (cursors.up.isDown) velocity.y = -speed;
echo     if (cursors.down.isDown) velocity.y = speed;
echo     player.setVelocity(velocity.x, velocity.y);
echo     if (velocity.x !== 0 ^|^ velocity.y !== 0) {
echo         sendMessage({ type: 'move', id: playerId, x: player.x, y: player.y });
echo         updateMinimap(player.x, player.y, Object.values(players));
echo     }
echo }
echo.
echo function onMessage(data) {
echo     switch (data.type) {
echo         case 'login_success':
echo             playerId = data.id;
echo             document.getElementById('auth-container').style.display = 'none';
echo             if (data.newUser) {
echo                 document.getElementById('name-container').style.display = 'block';
echo             } else {
echo                 playerName = data.characterName;
echo                 startGame(data);
echo             }
echo             break;
echo         case 'register_success':
echo             document.getElementById('auth-container').style.display = 'none';
echo             document.getElementById('name-container').style.display = 'block';
echo             break;
echo         case 'name_success':
echo             playerName = data.characterName;
echo             startGame(data);
echo             break;
echo         case 'init_players':
echo             data.players.forEach(p => {
echo                 if (p.id !== playerId) {
echo                     players[p.id] = game.scene.scenes[0].physics.add.sprite(p.x, p.y, 'dude');
echo                 }
echo             });
echo             updateMinimap(player.x, player.y, Object.values(players));
echo             break;
echo         case 'init_tiles':
echo             tiles = data.tiles;
echo             tiles.forEach(t => {
echo                 let tile = game.scene.scenes[0].add.rectangle(t.x, t.y, 32, 32, 0x666666);
echo                 tiles.push({ x: t.x, y: t.y });
echo             });
echo             break;
echo         case 'move':
echo             if (data.id !== playerId ^&^ players[data.id]) {
echo                 players[data.id].setPosition(data.x, data.y);
echo                 updateMinimap(player.x, player.y, Object.values(players));
echo             }
echo             break;
echo         case 'join':
echo             if (data.id !== playerId) {
echo                 players[data.id] = game.scene.scenes[0].physics.add.sprite(data.x, data.y, 'dude');
echo                 updateMinimap(player.x, player.y, Object.values(players));
echo             }
echo             break;
echo         case 'leave':
echo             if (players[data.id]) {
echo                 players[data.id].destroy();
echo                 delete players[data.id];
echo                 updateMinimap(player.x, player.y, Object.values(players));
echo             }
echo             break;
echo         case 'chat':
echo             let chatBox = document.getElementById('chat-box');
echo             chatBox.innerHTML += `<div>${data.sender}: ${data.message}</div>`;
echo             chatBox.scrollTop = chatBox.scrollHeight;
echo             break;
echo         case 'mine_tile':
echo             tiles = tiles.filter(t => t.x !== data.tile.x ^|^ t.y !== data.tile.y);
echo             break;
echo         case 'spawn_tile':
echo             tiles.push(data.tile);
echo             let tile = game.scene.scenes[0].add.rectangle(data.tile.x, data.tile.y, 32, 32, 0x666666);
echo             break;
echo         case 'party_invite':
echo             if (data.to === playerId) {
echo                 if (confirm(`${data.fromName} invited you to a party. Accept?`)) {
echo                     sendMessage({ type: 'party_accept', from: data.from, to: playerId });
echo                 }
echo             }
echo             break;
echo         case 'party_message':
echo             let chatBox = document.getElementById('chat-box');
echo             chatBox.innerHTML += `<div>[Party] ${data.sender}: ${data.message}</div>`;
echo             chatBox.scrollTop = chatBox.scrollHeight;
echo             break;
echo         case 'error':
echo             alert(data.message);
echo             break;
echo     }
echo }
echo.
echo function startGame(data) {
echo     document.getElementById('name-container').style.display = 'none';
echo     document.getElementById('game-container').style.display = 'block';
echo     player = game.scene.scenes[0].physics.add.sprite(data.x ^|^ 400, data.y ^|^ 300, 'dude');
echo     game.scene.scenes[0].cameras.main.startFollow(player);
echo     sendMessage({ type: 'join', id: playerId, x: player.x, y: player.y });
echo     if (data.inventory) inventory = data.inventory;
echo     if (data.coins) coins = data.coins;
echo     updateInventoryUI(coins, inventory);
echo }
echo.
echo function initUI() {
echo     let authBtn = document.getElementById('auth-btn');
echo     let authTitle = document.getElementById('auth-title');
echo     let toggleAuth = document.getElementById('toggle-auth');
echo     let nameBtn = document.getElementById('name-btn');
echo     let chatSend = document.getElementById('chat-send');
echo     let chatInput = document.getElementById('chat-input');
echo.
echo     let isLogin = true;
echo     toggleAuth.onclick = () => {
echo         isLogin = !isLogin;
echo         authTitle.textContent = isLogin ? 'Login' : 'Register';
echo         toggleAuth.textContent = isLogin ? "Don't have an account? Register" : 'Already have an account? Login';
echo     };
echo.
echo     authBtn.onclick = () => {
echo         let username = document.getElementById('username').value;
echo         let password = document.getElementById('password').value;
echo         if (isLogin) {
echo             sendMessage({ type: 'login', username, password });
echo         } else {
echo             sendMessage({ type: 'register', username, password });
echo         }
echo     };
echo.
echo     nameBtn.onclick = () => {
echo         let characterName = document.getElementById('character-name').value;
echo         sendMessage({ type: 'set_name', characterName });
echo     };
echo.
echo     chatSend.onclick = () => {
echo         let message = chatInput.value;
echo         if (message) {
echo             sendMessage({ type: 'chat', sender: playerName, message });
echo             chatInput.value = '';
echo         }
echo     };
echo.
echo     chatInput.onkeypress = (e) => {
echo         if (e.key === 'Enter') chatSend.click();
echo     };
echo }
) > game.js

:: Tạo file socket.js
(
echo export let ws;
echo.
echo export function initWebSocket(onMessage) {
echo     ws = new WebSocket('wss://godly-open-world.fly.dev');
echo     ws.onmessage = (event) => {
echo         const data = JSON.parse(event.data);
echo         onMessage(data);
echo     };
echo     ws.onclose = () => {
echo         console.log('Disconnected from server');
echo     };
echo }
echo.
echo export function sendMessage(message) {
echo     if (ws ^&^ ws.readyState === WebSocket.OPEN) {
echo         ws.send(JSON.stringify(message));
echo     }
echo }
) > socket.js

:: Tạo file minimap.js
(
echo export function initMinimap(scene) {
echo     const minimap = scene.add.graphics();
echo     minimap.setScrollFactor(0);
echo     minimap.setDepth(1000);
echo     return minimap;
echo }
echo.
echo export function updateMinimap(playerX, playerY, players) {
echo     const minimap = initMinimap(game.scene.scenes[0]);
echo     minimap.clear();
echo     minimap.fillStyle(0x000000, 0.5);
echo     minimap.fillRect(650, 10, 140, 140);
echo     minimap.fillStyle(0x00ff00, 1);
echo     minimap.fillRect(650 + (playerX / 800) * 140, 10 + (playerY / 600) * 140, 5, 5);
echo     minimap.fillStyle(0xff0000, 1);
echo     players.forEach(p => {
echo         minimap.fillRect(650 + (p.x / 800) * 140, 10 + (p.y / 600) * 140, 5, 5);
echo     });
echo }
) > minimap.js

:: Tạo file inventory.js
(
echo let inventory = [];
echo let coins = 0;
echo.
echo export function initInventory(scene) {
echo     const inventoryBtn = document.getElementById('inventory-btn');
echo     const menuContent = document.getElementById('menu-content');
echo.
echo     inventoryBtn.onclick = () => {
echo         menuContent.style.display = 'block';
echo         menuContent.innerHTML = `
echo             <h3>Inventory</h3>
echo             <p>Coins: ${coins}</p>
echo             <ul>${inventory.map(item => `<li>${item}</li>`).join('')}</ul>
echo         `;
echo     };
echo }
echo.
echo export function updateInventoryUI(newCoins, newInventory) {
echo     coins = newCoins;
echo     inventory = newInventory;
echo     const menuContent = document.getElementById('menu-content');
echo     if (menuContent.style.display === 'block') {
echo         menuContent.innerHTML = `
echo             <h3>Inventory</h3>
echo             <p>Coins: ${coins}</p>
echo             <ul>${inventory.map(item => `<li>${item}</li>`).join('')}</ul>
echo         `;
echo     }
echo }
) > inventory.js

:: Tạo file party.js
(
echo export function initParty(scene) {
echo     const partyBtn = document.getElementById('party-btn');
echo     const menuContent = document.getElementById('menu-content');
echo.
echo     partyBtn.onclick = () => {
echo         menuContent.style.display = 'block';
echo         menuContent.innerHTML = `
echo             <h3>Party</h3>
echo             <input id="party-invite" type="text" placeholder="Player ID to invite">
echo             <button id="invite-btn">Invite</button>
echo             <input id="party-message" type="text" placeholder="Party message">
echo             <button id="party-send">Send</button>
echo         `;
echo         document.getElementById('invite-btn').onclick = () => {
echo             const to = document.getElementById('party-invite').value;
echo             sendMessage({ type: 'party_invite', from: playerId, to, fromName: playerName });
echo         };
echo         document.getElementById('party-send').onclick = () => {
echo             const message = document.getElementById('party-message').value;
echo             sendMessage({ type: 'party_message', sender: playerName, message });
echo         };
echo     };
echo }
) > party.js

:: Tạo file teleport.js
(
echo export function initTeleport(scene) {
echo     scene.input.on('pointerdown', (pointer) => {
echo         if (pointer.rightButtonDown()) {
echo             const worldPoint = scene.input.activePointer.positionToCamera(scene.cameras.main);
echo             if (confirm(`Teleport to (${Math.round(worldPoint.x)}, ${Math.round(worldPoint.y)})?`)) {
echo                 player.setPosition(worldPoint.x, worldPoint.y);
echo                 sendMessage({ type: 'teleport', id: playerId, x: worldPoint.x, y: worldPoint.y });
echo                 updateMinimap(player.x, player.y, Object.values(players));
echo             }
echo         }
echo     });
echo }
) > teleport.js

cd ..

:: Tạo thư mục ui và các file html, css
mkdir ui
cd ui
(
echo ^<!DOCTYPE html^>
echo ^<html lang="en"^>
echo ^<head^>
echo     ^<meta charset="UTF-8"^>
echo     ^<meta name="viewport" content="width=device-width, initial-scale=1.0"^>
echo     ^<title^>Multiplayer Adventure^</title^>
echo     ^<link rel="stylesheet" href="./style.css"^>
echo ^</head^>
echo ^<body^>
echo     ^<div id="auth-container" class="container"^>
echo         ^<div class="auth-box"^>
echo             ^<h2 id="auth-title"^>Login^</h2^>
echo             ^<input id="username" type="text" placeholder="Username" class="auth-input"^>
echo             ^<input id="password" type="password" placeholder="Password" class="auth-input"^>
echo             ^<label^>^<input id="remember-me" type="checkbox"^> Remember me^</label^>
echo             ^<button id="auth-btn"^>Login^</button^>
echo             ^<span id="toggle-auth"^>Don't have an account? Register^</span^>
echo         ^</div^>
echo     ^</div^>
echo     ^<div id="name-container" class="container" style="display: none;"^>
echo         ^<div class="auth-box"^>
echo             ^<h2^>Choose Your Name^</h2^>
echo             ^<input id="character-name" type="text" placeholder="Character Name" class="auth-input"^>
echo             ^<button id="name-btn"^>Confirm^</button^>
echo         ^</div^>
echo     ^</div^>
echo     ^<div id="game-container" style="display: none;"^>
echo         ^<div id="game-canvas"^>^</div^>
echo         ^<div id="ui-container"^>
echo             ^<div id="leaderboard" class="ui-box"^>
echo             ^</div^>
echo             ^<div id="quests" class="ui-box"^>
echo             ^</div^>
echo             ^<div id="menu-container" class="ui-box"^>
echo                 ^<div id="menu-tabs"^>
echo                     ^<button class="menu-btn" id="info-btn"^>Info^</button^>
echo                     ^<button class="menu-btn" id="inventory-btn"^>Bag^</button^>
echo                     ^<button class="menu-btn" id="party-btn"^>Party^</button^>
echo                     ^<button class="menu-btn" id="trade-btn"^>Trade^</button^>
echo                     ^<button class="menu-btn" id="rank-btn"^>Rank^</button^>
echo                     ^<button class="menu-btn" id="settings-btn"^>Settings^</button^>
echo                     ^<button class="menu-btn" id="exit-btn"^>Exit^</button^>
echo                 ^</div^>
echo                 ^<div id="menu-content" class="menu-content" style="display: none;"^>
echo                 ^</div^>
echo             ^</div^>
echo             ^<div id="chat-container" class="ui-box"^>
echo                 ^<div id="chat-box"^>
echo                 ^</div^>
echo                 ^<div id="chat-input-container"^>
echo                     ^<input id="chat-input" type="text" placeholder="Type to chat..." class="chat-input"^>
echo                     ^<button id="chat-send" class="chat-send"^>Send^</button^>
echo                 ^</div^>
echo             ^</div^>
echo             ^<div id="trade-container" class="ui-box" style="display: none;"^>
echo             ^</div^>
echo         ^</div^>
echo     ^</div^>
echo     ^<script src="https://cdn.jsdelivr.net/npm/phaser@3.55.2/dist/phaser.min.js"^>
echo     ^</script^>
echo     ^<script src="../dist/bundle.js"^>
echo     ^</script^>
echo ^</body^>
echo ^</html^>
) > hud.html
echo ^<!DOCTYPE html^>^<html^>^<head^>^<title^>Inventory^</title^>^</head^>^<body^>^</body^>^</html^> > panel-inventory.html
echo ^<!DOCTYPE html^>^<html^>^<head^>^<title^>Minimap^</title^>^</head^>^<body^>^</body^>^</html^> > minimap.html

:: Tạo file style.css
(
echo body {
echo     margin: 0;
echo     font-family: Arial, sans-serif;
echo }
echo .container {
echo     position: fixed;
echo     top: 0;
echo     left: 0;
echo     width: 100%%;
echo     height: 100%%;
echo     background: rgba(0, 0, 0, 0.5);
echo     display: flex;
echo     justify-content: center;
echo     align-items: center;
echo }
echo .auth-box {
echo     background: white;
echo     padding: 20px;
echo     border-radius: 5px;
echo     text-align: center;
echo }
echo .auth-input {
echo     display: block;
echo     margin: 10px 0;
echo     padding: 5px;
echo     width: 200px;
echo }
echo #game-canvas {
echo     position: absolute;
echo }
echo #ui-container {
echo     position: absolute;
echo     width: 100%%;
echo     height: 100%%;
echo     pointer-events: none;
echo }
echo .ui-box {
echo     background: rgba(255, 255, 255, 0.8);
echo     border-radius: 5px;
echo     padding: 10px;
echo     position: absolute;
echo     pointer-events: auto;
echo }
echo #leaderboard {
echo     top: 10px;
echo     left: 10px;
echo     width: 150px;
echo }
echo #quests {
echo     top: 10px;
echo     right: 10px;
echo     width: 150px;
echo }
echo #menu-container {
echo     bottom: 60px;
echo     right: 10px;
echo     width: 200px;
echo }
echo #menu-tabs {
echo     display: flex;
echo     justify-content: space-around;
echo }
echo .menu-btn {
echo     padding: 5px 10px;
echo     cursor: pointer;
echo }
echo .menu-content {
echo     margin-top: 10px;
echo     background: rgba(200, 200, 200, 0.9);
echo     padding: 10px;
echo }
echo #chat-container {
echo     bottom: 10px;
echo     left: 10px;
echo     width: 300px;
echo     height: 150px;
echo }
echo #chat-box {
echo     height: 110px;
echo     overflow-y: auto;
echo     border-bottom: 1px solid #ccc;
echo     margin-bottom: 5px;
echo }
echo #chat-input-container {
echo     display: flex;
echo     gap: 5px;
echo }
echo #chat-input {
echo     flex-grow: 1;
echo     padding: 5px;
echo }
echo #chat-send {
echo     padding: 5px 10px;
echo }
echo #trade-container {
echo     top: 50%%;
echo     left: 50%%;
echo     transform: translate(-50%%, -50%%);
echo     width: 300px;
echo }
) > style.css

cd ..

:: Tạo thư mục dist cho Webpack output
mkdir dist

cd ..

:: Tạo thư mục server
mkdir server
cd server

:: Tạo thư mục socket và các file js
mkdir socket
cd socket

:: Tạo file handlers.js
(
echo const bcrypt = require('bcryptjs');
echo.
echo function handleLogin(ws, data, users, onlinePlayers) {
echo     const { username, password } = data;
echo     if (users[username]) {
echo         const match = bcrypt.compareSync(password, users[username].password);
echo         if (match ^&^ !onlinePlayers[username]) {
echo             onlinePlayers[username] = ws;
echo             ws.send(JSON.stringify({
echo                 type: 'login_success',
echo                 id: username,
echo                 newUser: !users[username].characterName,
echo                 characterName: users[username].characterName,
echo                 x: users[username].lastX ^|^ 400,
echo                 y: users[username].lastY ^|^ 300,
echo                 inventory: users[username].inventory ^|^ [],
echo                 coins: users[username].coins ^|^ 0
echo             }));
echo         } else {
echo             ws.send(JSON.stringify({ type: 'error', message: 'Invalid credentials or already logged in' }));
echo         }
echo     } else {
echo         ws.send(JSON.stringify({ type: 'error', message: 'User not found' }));
echo     }
echo }
echo.
echo function handleRegister(ws, data, users, onlinePlayers) {
echo     const { username, password } = data;
echo     if (users[username]) {
echo         ws.send(JSON.stringify({ type: 'error', message: 'Username already exists' }));
echo     } else {
echo         users[username] = { password: bcrypt.hashSync(password, 10), inventory: [], coins: 0 };
echo         onlinePlayers[username] = ws;
echo         ws.send(JSON.stringify({ type: 'register_success', id: username }));
echo     }
echo }
echo.
echo module.exports = { handleLogin, handleRegister };
) > handlers.js

:: Tạo file player-movement.js
(
echo function handleMovement(ws, data, users, wss) {
echo     if (users[data.id]) {
echo         users[data.id].lastX = data.x;
echo         users[data.id].lastY = data.y;
echo         wss.clients.forEach(client => {
echo             if (client !== ws) {
echo                 client.send(JSON.stringify({ type: 'move', id: data.id, x: data.x, y: data.y }));
echo             }
echo         });
echo     }
echo }
echo.
echo module.exports = { handleMovement };
) > player-movement.js

:: Tạo file teleport.js
(
echo function handleTeleport(ws, data, users, wss) {
echo     if (users[data.id]) {
echo         users[data.id].lastX = data.x;
echo         users[data.id].lastY = data.y;
echo         wss.clients.forEach(client => {
echo             if (client !== ws) {
echo                 client.send(JSON.stringify({ type: 'move', id: data.id, x: data.x, y: data.y }));
echo             }
echo         });
echo     }
echo }
echo.
echo module.exports = { handleTeleport };
) > teleport.js

:: Tạo file party.js
(
echo function handleParty(ws, data, parties, wss) {
echo     if (data.type === 'party_invite') {
echo         wss.clients.forEach(client => {
echo             client.send(JSON.stringify({ type: 'party_invite', from: data.from, to: data.to, fromName: data.fromName }));
echo         });
echo     } else if (data.type === 'party_accept') {
echo         if (!parties[data.from]) parties[data.from] = [];
echo         parties[data.from].push(data.to);
echo     } else if (data.type === 'party_message') {
echo         const party = parties[data.sender] ^|^ [];
echo         wss.clients.forEach(client => {
echo             if (party.includes(client.id) ^|^ client.id === data.sender) {
echo                 client.send(JSON.stringify({ type: 'party_message', sender: data.sender, message: data.message }));
echo             }
echo         });
echo     }
echo }
echo.
echo module.exports = { handleParty };
) > party.js

cd ..

:: Tạo thư mục data và các file json
mkdir data
cd data
echo {} > maps.json
echo {} > users.json
cd ..

:: Tạo thư mục models và các file js
mkdir models
cd models
echo // Player model > Player.js
echo // Inventory model > Inventory.js
cd ..

:: Tạo các file server.js, package.json, fly.toml
(
echo const fs = require('fs');
echo const http = require('http');
echo const WebSocket = require('ws');
echo const bcrypt = require('bcryptjs');
echo const { handleLogin, handleRegister } = require('./socket/handlers.js');
echo const { handleMovement } = require('./socket/player-movement.js');
echo const { handleTeleport } = require('./socket/teleport.js');
echo const { handleParty } = require('./socket/party.js');
echo.
echo const server = http.createServer((req, res) => {
echo     if (req.url === '/health') {
echo         res.writeHead(200, { 'Content-Type': 'text/plain' });
echo         res.end('OK');
echo     } else {
echo         res.writeHead(404);
echo         res.end();
echo     }
echo });
echo.
echo const wss = new WebSocket.Server({ server });
echo.
echo const PORT = process.env.PORT ^|^ 8080;
echo const USER_FILE = './data/users.json';
echo const MAP_FILE = './data/maps.json';
echo.
echo let users = {}, onlinePlayers = {}, tiles = [], parties = {};
echo const connectionLimits = new Map();
echo const MAX_CONNECTIONS_PER_IP = 5;
echo const MESSAGE_RATE_LIMIT = 20;
echo const rateLimits = new Map();
echo.
echo if (fs.existsSync(USER_FILE)) {
echo     users = JSON.parse(fs.readFileSync(USER_FILE));
echo }
echo.
echo if (fs.existsSync(MAP_FILE)) {
echo     tiles = JSON.parse(fs.readFileSync(MAP_FILE)).tiles;
echo }
echo.
echo function saveUsers() {
echo     fs.writeFileSync(USER_FILE, JSON.stringify(users, null, 2));
echo }
echo.
echo function checkRateLimit(clientIp) {
echo     const now = Date.now();
echo     if (!rateLimits.has(clientIp)) {
echo         rateLimits.set(clientIp, { count: 1, lastReset: now, logged: false });
echo         return true;
echo     }
echo     const limit = rateLimits.get(clientIp);
echo     if (now - limit.lastReset ^> 60000) {
echo         limit.count = 1;
echo         limit.lastReset = now;
echo         limit.logged = false;
echo         return true;
echo     }
echo     if (limit.count ^>= MESSAGE_RATE_LIMIT) {
echo         if (!limit.logged) {
echo             console.log(`Rate limit exceeded for IP ${clientIp}`);
echo             limit.logged = true;
echo         }
echo         return false;
echo     }
echo     limit.count++;
echo     return true;
echo }
echo.
echo wss.on('connection', (ws, req) => {
echo     const clientIp = req.socket.remoteAddress ^|^ 'unknown';
echo     console.log(`New client connected from ${clientIp}`);
echo.
echo     const ipCount = (connectionLimits.get(clientIp) ^|^ 0) + 1;
echo     if (ipCount ^> MAX_CONNECTIONS_PER_IP) {
echo         ws.send(JSON.stringify({ type: 'error', message: 'Too many connections' }));
echo         ws.close();
echo         return;
echo     }
echo     connectionLimits.set(clientIp, ipCount);
echo.
echo     ws.on('message', async (message) => {
echo         if (!checkRateLimit(clientIp)) {
echo             ws.send(JSON.stringify({ type: 'error', message: 'Rate limit exceeded' }));
echo             return;
echo         }
echo.
echo         const data = JSON.parse(message);
echo         switch (data.type) {
echo             case 'login':
echo                 handleLogin(ws, data, users, onlinePlayers);
echo                 break;
echo             case 'register':
echo                 handleRegister(ws, data, users, onlinePlayers);
echo                 break;
echo             case 'move':
echo                 handleMovement(ws, data, users, wss);
echo                 break;
echo             case 'teleport':
echo                 handleTeleport(ws, data, users, wss);
echo                 break;
echo             case 'party_invite':
echo             case 'party_message':
echo                 handleParty(ws, data, parties, wss);
echo                 break;
echo             case 'join':
echo                 ws.send(JSON.stringify({ type: 'init_players', players: Object.values(users).map(u => ({
echo                     id: u.id, x: u.lastX ^|^ 0, y: u.lastY ^|^ 0, characterName: u.characterName
echo                 })) }));
echo                 ws.send(JSON.stringify({ type: 'init_tiles', tiles }));
echo                 wss.clients.forEach(client => {
echo                     if (client !== ws) client.send(JSON.stringify(data));
echo                 });
echo                 break;
echo             case 'chat':
echo                 wss.clients.forEach(client => client.send(JSON.stringify(data)));
echo                 break;
echo             case 'mine_tile':
echo                 tiles = tiles.filter(t => !(t.x === data.tile.x ^&^ t.y === data.tile.y));
echo                 wss.clients.forEach(client => client.send(JSON.stringify(data)));
echo                 break;
echo             case 'spawn_tile':
echo                 tiles.push(data.tile);
echo                 wss.clients.forEach(client => {
echo                     if (client !== ws) client.send(JSON.stringify(data));
echo                 });
echo                 break;
echo             case 'update_inventory':
echo                 if (users[data.id]) {
echo                     users[data.id].inventory = data.inventory;
echo                     saveUsers();
echo                 }
echo                 break;
echo             case 'update_coins':
echo                 if (users[data.id]) {
echo                     users[data.id].coins = data.coins;
echo                     saveUsers();
echo                 }
echo                 break;
echo             case 'set_name':
echo                 if (onlinePlayers[data.id]) {
echo                     users[data.id].characterName = data.characterName;
echo                     users[data.id].id = data.id;
echo                     saveUsers();
echo                     onlinePlayers[data.id].send(JSON.stringify({
echo                         type: 'name_success',
echo                         characterName: data.characterName,
echo                         x: users[data.id].lastX ^|^ 400,
echo                         y: users[data.id].lastY ^|^ 300
echo                     }));
echo                 }
echo                 break;
echo         }
echo     });
echo.
echo     ws.on('close', () => {
echo         const ipCount = connectionLimits.get(clientIp) - 1;
echo         if (ipCount ^<= 0) connectionLimits.delete(clientIp);
echo         else connectionLimits.set(clientIp, ipCount);
echo         for (let id in onlinePlayers) {
echo             if (onlinePlayers[id] === ws) {
echo                 delete onlinePlayers[id];
echo                 wss.clients.forEach(client => {
echo                     client.send(JSON.stringify({ type: 'leave', id }));
echo                 });
echo             }
echo         }
echo     });
echo });
echo.
echo server.listen(PORT, '0.0.0.0', () => {
echo     console.log(`Server running on port ${PORT}`);
echo });
) > server.js

echo { "name": "godly-open-world-server", "version": "1.0.0", "main": "server.js", "scripts": { "start": "node server.js" }, "dependencies": { "ws": "^8.16.0", "bcryptjs": "^3.0.2" } } > package.json

:: Tạo file fly.toml với cấu hình đã sửa
(
echo app = "godly-open-world"
echo primary_region = "sin"
echo.
echo [build]
echo   builder = "paketobuildpacks/builder:base"
echo   buildpacks = ["gcr.io/paketo-buildpacks/nodejs"]
echo.
echo [env]
echo   PORT = "8080"
echo.
echo [http_service]
echo   internal_port = 8080
echo   force_https = true
echo   auto_stop_machines = false
echo   auto_start_machines = true
echo   min_machines_running = 1
echo.
echo [[http_service.checks]]
echo   interval = "15s"
echo   timeout = "2s"
echo   grace_period = "5s"
echo   method = "get"
echo   path = "/health"
echo.
echo [[services]]
echo   internal_port = 8080
echo   protocol = "tcp"
echo   processes = ["app"]
echo.
echo   [[services.ports]]
echo     port = 80
echo     handlers = ["http"]
echo.
echo   [[services.ports]]
echo     port = 443
echo     handlers = ["tls", "http"]
echo.
echo [mounts]
echo   source = "data"
echo   destination = "/data"
echo.
echo [processes]
echo   app = "node server.js"
echo.
echo [http_service.concurrency]
echo   type = "requests"
echo   soft_limit = 50
echo   hard_limit = 100
) > fly.toml

cd ..

:: Tạo file package.json tại thư mục gốc
echo { "name": "godly-open-world", "version": "1.0.0", "description": "A multiplayer MMORPG game", "scripts": { "build": "webpack" }, "devDependencies": { "webpack": "^5.94.0", "webpack-cli": "^5.1.4", "babel-loader": "^9.2.1", "@babel/core": "^7.25.8", "@babel/preset-env": "^7.25.8" } } > package.json

:: Tạo file webpack.config.js
(
echo const path = require('path');
echo.
echo module.exports = {
echo     entry: './client/scripts/game.js',
echo     output: {
echo         path: path.resolve(__dirname, 'client/dist'),
echo         filename: 'bundle.js'
echo     },
echo     mode: 'development',
echo     resolve: {
echo         extensions: ['.js'],
echo     },
echo     module: {
echo         rules: [
echo             {
echo                 test: /\.js$/,
echo                 exclude: /node_modules/,
echo                 use: {
echo                     loader: 'babel-loader',
echo                     options: {
echo                         presets: ['@babel/preset-env']
echo                     }
echo                 }
echo             }
echo         ]
echo     }
echo };
) > webpack.config.js

echo Directory structure created successfully!
echo Please follow the next steps to set up the environment and run the project.
pause