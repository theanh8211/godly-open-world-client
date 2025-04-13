import { updateMinimap, addOrUpdatePlayer } from './minimap.js';
import { updateInventoryUI } from './inventory.js';
import { addPartyMessage } from './party.js';
import { startGame } from './game.js';

let ws = null;

function initWebSocket() {
    ws = new WebSocket('wss://godly-open-world.fly.dev');
    ws.onopen = () => console.log('WebSocket connected');
    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setTimeout(initWebSocket, 2000);
    };
    ws.onclose = () => console.log('WebSocket closed');

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        switch (data.type) {
            case 'auth':
                if (data.success) {
                    startGame(data);
                } else {
                    alert(data.message);
                }
                break;
            case 'init_players':
                data.players.forEach(p => {
                    if (p.id !== game.player.id) addOrUpdatePlayer(p.id, p.x, p.y, p.characterName);
                });
                break;
            case 'join':
                if (data.id !== game.player.id) addOrUpdatePlayer(data.id, data.x, data.y, data.characterName);
                break;
            case 'move':
                if (data.id !== game.player.id && game.players[data.id]) {
                    game.players[data.id].x = data.x;
                    game.players[data.id].y = data.y;
                    updateMinimap(game.player, game.players);
                }
                break;
            case 'chat':
                addChatMessage(data.characterName, data.message);
                break;
            case 'party_message':
                addPartyMessage(data.characterName, data.message);
                break;
            case 'update_inventory':
                if (data.id === game.player.id) {
                    game.inventory = data.inventory;
                    updateInventoryUI();
                }
                break;
            case 'update_coins':
                if (data.id === game.player.id) {
                    game.player.coins = data.coins;
                }
                break;
        }
    };
}

function sendMessage(data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    }
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

initWebSocket();

export { ws, sendMessage };