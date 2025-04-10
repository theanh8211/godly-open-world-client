let game;
let player, players = {}, auras = [], inventory = [], quests = [], tiles = [];
const MAP_SIZE = 10000;
const TILE_SIZE = 50;
const TILE_SPAWN_INTERVAL = 5000;
const TILE_SPAWN_CHANCE = 0.1;
const MIN_TILES = 50;
const auraTypes = [
    {name: 'Fire', color: 0xff4500}, {name: 'Ice', color: 0x00b7eb},
    {name: 'Thunder', color: 0xffff00}, {name: 'Dark', color: 0x4b0082},
    {name: 'Light', color: 0xffffff}, {name: 'Nature', color: 0x00ff00},
    {name: 'Wind', color: 0x87ceeb}, {name: 'Earth', color: 0x8b4513},
    {name: 'Void', color: 0x000000}, {name: 'Star', color: 0xffd700}
];
const questTypes = [
    {desc: 'Collect 5 auras', reward: 500, progress: 0, goal: 5},
    {desc: 'Travel 1000 units', reward: 300, progress: 0, goal: 1000},
    {desc: 'Trade 3 times', reward: 400, progress: 0, goal: 3}
];

let ws = null;
let userData = null;
let selectedAuraIndex = null;
let selectedTradeTarget = null;
let targetPosition = null;
let isMining = false;
let miniMap, miniMapPlayers = {};
let currentMenuTab = null;

function initWebSocket() {
    ws = new WebSocket('wss://godly-open-world.fly.dev:8080');
    ws.onopen = () => console.log('WebSocket connected');
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setTimeout(initWebSocket, 2000); // Thử lại sau 2 giây
    };
    ws.onclose = () => console.log('WebSocket closed');
    return ws;
  }

function preload() {
    this.load.image('player', 'https://raw.githubusercontent.com/phaserjs/examples/master/public/assets/sprites/phaser-dude.png');
}

function create() {
    this.add.rectangle(0, 0, MAP_SIZE, MAP_SIZE, 0x228B22).setOrigin(0).setDepth(0);

    const startX = userData.lastX || (Math.random() * (MAP_SIZE - 100) + 50);
    const startY = userData.lastY || (Math.random() * (MAP_SIZE - 100) + 50);

    player = this.physics.add.sprite(startX, startY, 'player');
    player.setCollideWorldBounds(true);
    player.setDepth(1);
    player.coins = userData.coins || 0;
    player.id = userData.id;
    player.chatText = this.add.text(0, 0, userData.characterName, {color: '#fff', fontSize: '12px', stroke: '#000', strokeThickness: 2});

    this.cameras.main.setBounds(0, 0, MAP_SIZE, MAP_SIZE);
    this.cameras.main.startFollow(player, true, 0.1, 0.1);
    this.physics.world.setBounds(0, 0, MAP_SIZE, MAP_SIZE);

    this.input.on('pointerdown', (pointer) => {
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        targetPosition = { x: Phaser.Math.Clamp(worldPoint.x, 0, MAP_SIZE), y: Phaser.Math.Clamp(worldPoint.y, 0, MAP_SIZE) };
    });

    ws.onmessage = handleWebSocketMessage.bind(this);
    document.getElementById('chat-input').addEventListener('keypress', handleChatInput);
    document.getElementById('chat-send').onclick = () => {
        const msg = document.getElementById('chat-input').value;
        if (msg && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({type: 'chat', id: player.id, characterName: userData.characterName, message: msg}));
            document.getElementById('chat-input').value = '';
        }
    };

    quests = questTypes.map(q => ({...q}));
    updateQuests();

    const infoBtn = document.getElementById('info-btn');
    const inventoryBtn = document.getElementById('inventory-btn');
    const tradeBtn = document.getElementById('trade-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const exitBtn = document.getElementById('exit-btn');

    infoBtn.onclick = () => toggleMenuTab('info', infoBtn);
    inventoryBtn.onclick = () => toggleMenuTab('inventory', inventoryBtn);
    tradeBtn.onclick = () => showTradeInterface();
    settingsBtn.onclick = () => toggleMenuTab('settings', settingsBtn);
    exitBtn.onclick = logout;

    miniMap = this.add.rectangle(10, 10, 200, 200, 0x333333, 0.8).setOrigin(0).setScrollFactor(0);
    this.add.rectangle(10, 10, 200, 200).setOrigin(0).setScrollFactor(0).setStrokeStyle(2, 0xffffff);
    miniMapPlayers[player.id] = this.add.circle(10 + 100, 10 + 100, 5, 0xff0000).setOrigin(0.5).setScrollFactor(0);

    const coordText = this.add.text(10 + 100, 220, `X: ${Math.floor(player.x)}, Y: ${Math.floor(player.y)}`, {
        color: '#fff',
        fontSize: '14px',
        stroke: '#000',
        strokeThickness: 2
    }).setOrigin(0.5).setScrollFactor(0);

    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({type: 'join', id: player.id, x: player.x, y: player.y, characterName: userData.characterName}));
    }

    setInterval(checkAndSpawnTiles, TILE_SPAWN_INTERVAL);
}

function update() {
    player.chatText.setPosition(player.x - 16, player.y - 32);

    Object.values(players).forEach(p => {
        if (p.chatText) {
            p.chatText.setPosition(p.x - 16, p.y - 32);
        }
    });

    if (targetPosition) {
        const distance = Phaser.Math.Distance.Between(player.x, player.y, targetPosition.x, targetPosition.y);
        if (distance > 5) {
            game.scene.scenes[0].physics.moveTo(player, targetPosition.x, targetPosition.y, 250);
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({type: 'move', id: player.id, x: targetPosition.x, y: targetPosition.y}));
            }
        } else {
            player.setVelocity(0);
            targetPosition = null;
        }
    }

    if (!isMining) checkMining();

    const miniMapScale = 200 / MAP_SIZE;
    miniMapPlayers[player.id].x = 10 + (player.x * miniMapScale);
    miniMapPlayers[player.id].y = 10 + (player.y * miniMapScale);
    Object.values(players).forEach(p => {
        if (miniMapPlayers[p.id]) {
            miniMapPlayers[p.id].x = 10 + (p.x * miniMapScale);
            miniMapPlayers[p.id].y = 10 + (p.y * miniMapScale);
        }
    });
    game.scene.scenes[0].children.list.forEach(child => {
        if (child.type === 'Text' && child.text.startsWith('X:')) {
            child.setText(`X: ${Math.floor(player.x)}, Y: ${Math.floor(player.y)}`);
        }
    });
}

function checkMining() {
    const nearestTile = tiles.reduce((closest, tile) => {
        const centerX = tile.x + TILE_SIZE / 2;
        const centerY = tile.y + TILE_SIZE / 2;
        const distance = Phaser.Math.Distance.Between(player.x, player.y, centerX, centerY);
        return distance < closest.distance ? { tile, distance } : closest;
    }, { tile: null, distance: Infinity });

    if (nearestTile.tile && nearestTile.distance <= TILE_SIZE) {
        isMining = true;
        player.setVelocity(0);
        setTimeout(() => {
            mineAura(nearestTile.tile);
            isMining = false;
        }, 1000);
    }
}

function mineAura(tile) {
    if (!tile || !tiles.includes(tile)) return;
    const tileData = { x: tile.x, y: tile.y, color: tile.fillColor };
    tile.destroy();
    tiles = tiles.filter(t => t !== tile);

    const auraChance = Math.random();
    if (auraChance < 0.7) {
        const aura = auraTypes[Math.floor(Math.random() * auraTypes.length)];
        inventory.push(aura);
        updateQuestProgress('Collect', 1);
    }
    player.coins += Math.floor(Math.random() * 100) + 50;
    updateMenuContent('inventory');
    updateMenuContent('info');

    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({type: 'mine_tile', id: player.id, tile: tileData}));
        ws.send(JSON.stringify({type: 'update_coins', id: player.id, coins: player.coins}));
        ws.send(JSON.stringify({type: 'update_inventory', id: player.id, inventory}));
    }
}

function spawnTiles(tileData) {
    tiles.forEach(t => t.destroy());
    tiles = [];
    tileData.forEach(t => {
        const tile = game.scene.scenes[0].add.rectangle(t.x, t.y, TILE_SIZE, TILE_SIZE, t.color).setOrigin(0);
        tile.setDepth(0);
        tiles.push(tile);
    });
}

function checkAndSpawnTiles() {
    if (tiles.length < MIN_TILES) {
        const tilesToAdd = MIN_TILES - tiles.length;
        for (let i = 0; i < tilesToAdd; i++) {
            let x, y, overlap;
            do {
                x = Math.floor(Math.random() * (MAP_SIZE / TILE_SIZE)) * TILE_SIZE;
                y = Math.floor(Math.random() * (MAP_SIZE / TILE_SIZE)) * TILE_SIZE;
                overlap = tiles.some(tile => tile.x === x && tile.y === y);
            } while (overlap);
            const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff];
            const tile = game.scene.scenes[0].add.rectangle(x, y, TILE_SIZE, TILE_SIZE, 
                colors[Math.floor(Math.random() * colors.length)]).setOrigin(0);
            tile.setDepth(0);
            tiles.push(tile);
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({type: 'spawn_tile', tile: {x, y, color: tile.fillColor}}));
            }
        }
    }
}

function toggleMenuTab(tab, button) {
    const menuContainer = document.getElementById('menu-content');
    if (currentMenuTab === tab) {
        menuContainer.style.display = 'none';
        currentMenuTab = null;
        button.classList.remove('active');
    } else {
        currentMenuTab = tab;
        document.querySelectorAll('.menu-btn').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        menuContainer.style.display = 'block';
        updateMenuContent(tab);
    }
}

function updateMenuContent(type) {
    const contentDiv = document.getElementById('menu-content');
    if (type === 'info') {
        contentDiv.innerHTML = `
            <div class="menu-option">Name: ${userData.characterName}</div>
            <div class="menu-option">Coins: ${player.coins}</div>
            <button class="menu-option" id="change-name-btn">Change Name</button>
        `;
        document.getElementById('change-name-btn').onclick = changeName;
    } else if (type === 'inventory') {
        contentDiv.innerHTML = `
            <div class="menu-option">Bag (Coins: ${player.coins})</div>
            <div id="inventory-grid"></div>
            <button class="menu-option" id="equip-btn" style="display: ${selectedAuraIndex !== null ? 'block' : 'none'};">Equip</button>
        `;
        const grid = document.getElementById('inventory-grid');
        inventory.forEach((aura, index) => {
            const item = document.createElement('div');
            item.className = 'aura-item';
            item.style.background = `#${aura.color.toString(16).padStart(6, '0')}`;
            item.innerHTML = `<span class="aura-name">${aura.name}</span>`;
            item.onclick = () => {
                selectedAuraIndex = index === selectedAuraIndex ? null : index;
                updateMenuContent('inventory');
            };
            if (index === selectedAuraIndex) item.classList.add('selected');
            grid.appendChild(item);
        });
        if (document.getElementById('equip-btn')) {
            document.getElementById('equip-btn').onclick = () => {
                if (selectedAuraIndex !== null) {
                    console.log(`Equipped ${inventory[selectedAuraIndex].name}`);
                    selectedAuraIndex = null;
                    updateMenuContent('inventory');
                }
            };
        }
    } else if (type === 'settings') {
        contentDiv.innerHTML = `
            <button class="menu-option" id="logout-btn">Logout</button>
        `;
        document.getElementById('logout-btn').onclick = logout;
    }
}

function changeName() {
    const cost = userData.nameChangeCost || 100;
    if (player.coins < cost) {
        alert(`Not enough coins! Need ${cost} coins.`);
        return;
    }
    const newName = prompt(`Enter new name (Cost: ${cost} coins):`, userData.characterName);
    if (newName && newName !== userData.characterName) {
        player.coins -= cost;
        userData.characterName = newName;
        userData.nameChangeCount = (userData.nameChangeCount || 0) + 1;
        userData.nameChangeCost = Math.floor(cost * 1.5);
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({type: 'update_name', id: player.id, characterName: newName, coins: player.coins}));
        }
        updateMenuContent('info');
        player.chatText.setText(newName);
    }
}

function logout() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({type: 'save_position', id: player.id, x: player.x, y: player.y, coins: player.coins, inventory}));
        ws.send(JSON.stringify({type: 'leave', id: player.id}));
        ws.close();
    }
    game.destroy(true);
    ws = null;
    players = {};
    miniMapPlayers = {};
    document.getElementById('game-container').style.display = 'none';
    document.getElementById('auth-container').style.display = 'flex';
    localStorage.removeItem('userData');
}

function showTradeInterface() {
    const tradeContainer = document.getElementById('trade-container');
    tradeContainer.style.display = 'block';
    tradeContainer.innerHTML = `
        <h2>Trade</h2>
        <div id="trade-player-list"></div>
        <div id="trade-aura-list" style="display: none;"></div>
        <div style="display: none;" id="trade-coins">
            <div>
                <label>Coins to Pay: </label>
                <input id="coins-pay" type="number" min="0" value="0" class="auth-input">
            </div>
            <div>
                <label>Coins to Receive: </label>
                <input id="coins-receive" type="number" min="0" value="0" class="auth-input">
            </div>
        </div>
        <button id="trade-btn" style="display: none;">Trade</button>
        <button id="cancel-trade-btn">Cancel</button>
    `;

    const playerList = document.getElementById('trade-player-list');
    Object.keys(players).forEach(id => {
        if (id === player.id) return;
        const playerItem = document.createElement('div');
        playerItem.className = 'trade-player-item';
        playerItem.innerHTML = `${players[id].characterName} <button class="trade-player-btn">Trade</button>`;
        playerItem.querySelector('.trade-player-btn').onclick = () => {
            selectedTradeTarget = id;
            document.querySelectorAll('.trade-player-item').forEach(i => i.style.background = '#f0f0f0');
            playerItem.style.background = '#d0d0d0';
            document.getElementById('trade-aura-list').style.display = 'block';
            document.getElementById('trade-coins').style.display = 'block';
            document.getElementById('trade-btn').style.display = 'block';

            const auraList = document.getElementById('trade-aura-list');
            auraList.innerHTML = '';
            inventory.forEach((aura, index) => {
                const item = document.createElement('div');
                item.className = 'trade-aura-item';
                item.style.background = `#${aura.color.toString(16).padStart(6, '0')}`;
                item.textContent = aura.name;
                item.onclick = () => {
                    selectedAuraIndex = index;
                    document.querySelectorAll('.trade-aura-item').forEach(i => i.style.border = 'none');
                    item.style.border = '2px solid #007aff';
                };
                auraList.appendChild(item);
            });
        };
        playerList.appendChild(playerItem);
    });

    document.getElementById('trade-btn').onclick = () => {
        if (!selectedTradeTarget) {
            alert('Please select a player to trade with!');
            return;
        }
        const coinsPay = parseInt(document.getElementById('coins-pay').value) || 0;
        const coinsReceive = parseInt(document.getElementById('coins-receive').value) || 0;
        if (coinsPay < 0 || coinsReceive < 0) {
            alert('Coins must be greater than or equal to 0!');
            return;
        }
        if (coinsPay > player.coins) {
            alert('Not enough coins to pay!');
            return;
        }

        const aura = selectedAuraIndex !== null ? inventory[selectedAuraIndex] : null;
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'trade',
                from: player.id,
                to: selectedTradeTarget,
                aura,
                coinsPay,
                coinsReceive
            }));
        }
        if (aura) {
            inventory.splice(selectedAuraIndex, 1);
        }
        player.coins = player.coins - coinsPay + coinsReceive;
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({type: 'update_coins', id: player.id, coins: player.coins}));
            ws.send(JSON.stringify({type: 'update_inventory', id: player.id, inventory}));
        }
        updateMenuContent('inventory');
        updateMenuContent('info');
        updateQuestProgress('Trade', 1);
        tradeContainer.style.display = 'none';
        selectedTradeTarget = null;
        selectedAuraIndex = null;
    };

    document.getElementById('cancel-trade-btn').onclick = () => {
        tradeContainer.style.display = 'none';
        selectedTradeTarget = null;
        selectedAuraIndex = null;
    };
}

function addChatMessage(characterName, msg) {
    const chatBox = document.getElementById('chat-box');
    const div = document.createElement('div');
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    div.textContent = `[${timeStr}] ${characterName}: ${msg}`;
    chatBox.insertBefore(div, chatBox.firstChild);
    chatBox.scrollTop = 0;
}

function updateQuests() {
    const questsDiv = document.getElementById('quests');
    questsDiv.innerHTML = '<h3>Quests</h3>';
    quests.forEach(q => {
        questsDiv.innerHTML += `<div>${q.desc}: ${q.progress}/${q.goal} (${q.reward} coins)</div>`;
    });
}

function updateQuestProgress(type, value) {
    quests.forEach(q => {
        if (q.desc.includes(type)) {
            q.progress += value;
            if (q.progress >= q.goal) {
                player.coins += q.reward;
                q.progress = 0;
                updateMenuContent('info');
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({type: 'update_coins', id: player.id, coins: player.coins}));
                }
            }
        }
    });
    updateQuests();
}

function handleWebSocketMessage(event) {
    const data = JSON.parse(event.data);
    if (data.type === 'auth' && data.success) {
        userData = { 
            id: data.id, 
            username: data.username, 
            coins: data.coins, 
            characterName: data.characterName,
            nameChangeCount: data.nameChangeCount,
            nameChangeCost: data.nameChangeCost,
            lastX: data.lastX,
            lastY: data.lastY,
            inventory: data.inventory || []
        };
        inventory = data.inventory || [];
        localStorage.setItem('userData', JSON.stringify(userData));
        document.getElementById('auth-container').style.display = 'none';
        if (data.characterName) {
            startGame();
        } else {
            document.getElementById('name-container').style.display = 'flex';
        }
    } else if (data.type === 'auth' && !data.success) {
        alert(data.message);
    } else if (data.type === 'force_logout') {
        alert(data.message);
        logout();
    } else if (data.type === 'init_players') {
        data.players.forEach(p => {
            if (p.id === player.id) return;
            if (!players[p.id]) {
                players[p.id] = game.scene.scenes[0].physics.add.sprite(p.x, p.y, 'player');
                players[p.id].setDepth(1);
                players[p.id].chatText = game.scene.scenes[0].add.text(p.x - 16, p.y - 32, p.characterName, 
                    {color: '#fff', fontSize: '12px', stroke: '#000', strokeThickness: 2});
                players[p.id].characterName = p.characterName;
                miniMapPlayers[p.id] = game.scene.scenes[0].add.circle(10 + (p.x * 200 / MAP_SIZE), 
                    10 + (p.y * 200 / MAP_SIZE), 5, 0x00ff00).setOrigin(0.5).setScrollFactor(0);
            } else {
                players[p.id].x = p.x;
                players[p.id].y = p.y;
            }
        });
    } else if (data.type === 'join') {
        if (data.id === player.id) return;
        if (!players[data.id]) {
            players[data.id] = game.scene.scenes[0].physics.add.sprite(data.x, data.y, 'player');
            players[data.id].setDepth(1);
            players[data.id].chatText = game.scene.scenes[0].add.text(data.x - 16, data.y - 32, data.characterName, 
                {color: '#fff', fontSize: '12px', stroke: '#000', strokeThickness: 2});
            players[data.id].characterName = data.characterName;
            miniMapPlayers[data.id] = game.scene.scenes[0].add.circle(10 + (data.x * 200 / MAP_SIZE), 
                10 + (data.y * 200 / MAP_SIZE), 5, 0x00ff00).setOrigin(0.5).setScrollFactor(0);
        }
    } else if (data.type === 'move') {
        if (data.id === player.id) return;
        if (players[data.id]) {
            players[data.id].x = data.x;
            players[data.id].y = data.y;
        }
    } else if (data.type === 'chat') {
        addChatMessage(data.characterName, data.message);
    } else if (data.type === 'trade') {
        if (data.to === player.id) {
            if (data.aura) inventory.push(data.aura);
            player.coins = player.coins + data.coinsPay - data.coinsReceive;
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({type: 'update_coins', id: player.id, coins: player.coins}));
                ws.send(JSON.stringify({type: 'update_inventory', id: player.id, inventory}));
            }
            updateMenuContent('inventory');
            updateMenuContent('info');
        }
    } else if (data.type === 'leave') {
        if (players[data.id]) {
            players[data.id].destroy();
            miniMapPlayers[data.id].destroy();
            delete players[data.id];
            delete miniMapPlayers[data.id];
        }
    } else if (data.type === 'update_coins') {
        if (data.id === player.id) {
            player.coins = data.coins;
            updateMenuContent('info');
            updateMenuContent('inventory');
        }
    } else if (data.type === 'update_inventory') {
        if (data.id === player.id) {
            inventory = data.inventory;
            updateMenuContent('inventory');
        }
    } else if (data.type === 'update_name') {
        if (data.id === player.id) {
            userData.characterName = data.characterName;
            userData.nameChangeCount = data.nameChangeCount;
            userData.nameChangeCost = data.nameChangeCost;
            updateMenuContent('info');
            player.chatText.setText(data.characterName);
        }
        if (players[data.id]) {
            players[data.id].characterName = data.characterName;
            players[data.id].chatText.setText(data.characterName);
        }
    } else if (data.type === 'init_tiles') {
        spawnTiles(data.tiles);
    } else if (data.type === 'mine_tile') {
        tiles = tiles.filter(t => !(t.x === data.tile.x && t.y === data.tile.y));
    } else if (data.type === 'spawn_tile') {
        const tile = game.scene.scenes[0].add.rectangle(data.tile.x, data.tile.y, TILE_SIZE, TILE_SIZE, data.tile.color).setOrigin(0);
        tile.setDepth(0);
        tiles.push(tile);
    }
}

function handleChatInput(e) {
    if (e.key === 'Enter' && e.target.value) {
        const msg = e.target.value;
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({type: 'chat', id: player.id, characterName: userData.characterName, message: msg}));
            e.target.value = '';
        }
    }
}

const authContainer = document.getElementById('auth-container');
const nameContainer = document.getElementById('name-container');
const authTitle = document.getElementById('auth-title');
const authBtn = document.getElementById('auth-btn');
const toggleAuth = document.getElementById('toggle-auth');
const rememberMe = document.getElementById('remember-me');
const nameBtn = document.getElementById('name-btn');
let isLogin = true;

const savedCredentials = localStorage.getItem('credentials');
if (savedCredentials) {
    const { username, password } = JSON.parse(savedCredentials);
    document.getElementById('username').value = username;
    document.getElementById('password').value = password;
    rememberMe.checked = true;
}

toggleAuth.onclick = () => {
    isLogin = !isLogin;
    authTitle.textContent = isLogin ? 'Login' : 'Register';
    authBtn.textContent = isLogin ? 'Login' : 'Register';
    toggleAuth.textContent = isLogin ? "Don't have an account? Register" : 'Already have an account? Login';
};

authBtn.onclick = () => {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        ws = initWebSocket();
        ws.onopen = () => {
            ws.send(JSON.stringify({type: isLogin ? 'login' : 'register', username, password}));
            if (rememberMe.checked) {
                localStorage.setItem('credentials', JSON.stringify({ username, password }));
            } else {
                localStorage.removeItem('credentials');
            }
        };
    } else {
        ws.send(JSON.stringify({type: isLogin ? 'login' : 'register', username, password}));
        if (rememberMe.checked) {
            localStorage.setItem('credentials', JSON.stringify({ username, password }));
        } else {
            localStorage.removeItem('credentials');
        }
    }
};

nameBtn.onclick = () => {
    const characterName = document.getElementById('character-name').value;
    if (characterName) {
        userData.characterName = characterName;
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({type: 'update_name', id: userData.id, characterName}));
        }
        startGame();
    } else {
        alert('Please enter a character name!');
    }
};

function startGame() {
    nameContainer.style.display = 'none';
    document.getElementById('game-container').style.display = 'flex';

    const config = {
        type: Phaser.AUTO,
        width: window.innerWidth * 0.8,
        height: window.innerHeight,
        parent: 'game-canvas',
        scene: { preload, create, update },
        physics: { default: 'arcade', arcade: { debug: false } },
        pixelArt: true
    };
    game = new Phaser.Game(config);
}

ws = initWebSocket();
ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'auth' && data.success) {
        userData = { 
            id: data.id, 
            username: data.username, 
            coins: data.coins, 
            characterName: data.characterName,
            nameChangeCount: data.nameChangeCount,
            nameChangeCost: data.nameChangeCost,
            lastX: data.lastX,
            lastY: data.lastY,
            inventory: data.inventory || []
        };
        inventory = data.inventory || [];
        localStorage.setItem('userData', JSON.stringify(userData));
        authContainer.style.display = 'none';
        if (isLogin && data.characterName) {
            startGame();
        } else {
            nameContainer.style.display = 'flex';
        }
    } else if (data.type === 'auth' && !data.success) {
        alert(data.message);
    }
};