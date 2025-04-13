import { initWebSocket, sendMessage } from './socket.js';
import { initMinimap, updateMinimap } from './minimap.js';
import { initInventory, updateInventoryUI } from './inventory.js';
import { initParty } from './party.js';
import { initTeleport } from './teleport.js';

let game, player, players = {}, inventory = [], quests = [], tiles = [];
const MAP_SIZE = 10000;
const TILE_SIZE = 50;
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

let userData = null, targetPosition = null, isMining = false;

function preload() {
    this.load.image('player', './assets/phaser-dude.png');
}

function create() {
    this.add.rectangle(0, 0, MAP_SIZE, MAP_SIZE, 0x228B22).setOrigin(0).setDepth(0);
    
    const startX = userData.lastX || (Math.random() * (MAP_SIZE - 100) + 50);
    const startY = userData.lastY || (Math.random() * (MAP_SIZE - 100) + 50);

    player = this.physics.add.sprite(startX, startY, 'player').setDepth(2);
    player.setCollideWorldBounds(true);
    player.coins = userData.coins || 0;
    player.id = userData.id;
    player.chatText = this.add.text(0, 0, userData.characterName, {
        color: '#fff', fontSize: '12px', stroke: '#000', strokeThickness: 2
    }).setDepth(3);

    this.cameras.main.setBounds(0, 0, MAP_SIZE, MAP_SIZE);
    this.cameras.main.startFollow(player, true, 0.1, 0.1);
    this.physics.world.setBounds(0, 0, MAP_SIZE, MAP_SIZE);

    this.input.on('pointerdown', (pointer) => {
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        targetPosition = { x: Phaser.Math.Clamp(worldPoint.x, 0, MAP_SIZE), y: Phaser.Math.Clamp(worldPoint.y, 0, MAP_SIZE) };
    });

    initMinimap(this);
    initInventory();
    initParty();
    initTeleport(this);

    quests = questTypes.map(q => ({...q}));
    updateQuests();

    if (ws.readyState === WebSocket.OPEN) {
        sendMessage({type: 'join', id: player.id, x: player.x, y: player.y, characterName: userData.characterName});
    }

    setInterval(checkAndSpawnTiles, 5000);
}

function update() {
    player.chatText.setPosition(player.x - 16, player.y - 32);

    Object.values(players).forEach(p => {
        if (p.chatText) p.chatText.setPosition(p.x - 16, p.y - 32);
    });

    if (targetPosition) {
        const distance = Phaser.Math.Distance.Between(player.x, player.y, targetPosition.x, targetPosition.y);
        if (distance > 5) {
            this.physics.moveTo(player, targetPosition.x, targetPosition.y, 250);
            sendMessage({type: 'move', id: player.id, x: targetPosition.x, y: targetPosition.y});
        } else {
            player.setVelocity(0);
            targetPosition = null;
        }
    }

    if (!isMining) checkMining.call(this);
    updateMinimap(player, players);
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
            mineAura.call(this, nearestTile.tile);
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
    updateInventoryUI();
    sendMessage({type: 'mine_tile', id: player.id, tile: tileData});
    sendMessage({type: 'update_coins', id: player.id, coins: player.coins});
    sendMessage({type: 'update_inventory', id: player.id, inventory});
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
                colors[Math.floor(Math.random() * colors.length)]).setOrigin(0).setDepth(1);
            tiles.push(tile);
            sendMessage({type: 'spawn_tile', tile: {x, y, color: tile.fillColor}});
        }
    }
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
                sendMessage({type: 'update_coins', id: player.id, coins: player.coins});
            }
        }
    });
    updateQuests();
}

function startGame(data) {
    userData = data;
    inventory = data.inventory || [];
    localStorage.setItem('userData', JSON.stringify(userData));
    document.getElementById('auth-container').style.display = 'none';
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

    window.addEventListener('resize', () => {
        game.scale.resize(window.innerWidth * 0.8, window.innerHeight);
    });
}

export { game, player, players, inventory, tiles, startGame };