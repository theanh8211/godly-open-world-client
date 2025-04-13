import { sendMessage } from './socket.js';

let party = [];

function initParty() {
    document.getElementById('party-btn').onclick = () => toggleMenuTab('party', document.getElementById('party-btn'));
}

function toggleMenuTab(tab, button) {
    const menuContainer = document.getElementById('menu-content');
    const currentTab = document.querySelector('.menu-btn.active')?.id;
    if (currentTab === button.id) {
        menuContainer.style.display = 'none';
        button.classList.remove('active');
    } else {
        document.querySelectorAll('.menu-btn').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        menuContainer.style.display = 'block';
        if (tab === 'party') updatePartyUI();
    }
}

function updatePartyUI() {
    const contentDiv = document.getElementById('menu-content');
    contentDiv.innerHTML = `
        <div class="menu-option">Party</div>
        <div id="party-list"></div>
        <button class="menu-option" id="invite-btn">Invite</button>
        <div id="party-chat"></div>
        <input id="party-chat-input" type="text" placeholder="Party chat..." class="chat-input">
    `;
    const partyList = document.getElementById('party-list');
    party.forEach(member => {
        const item = document.createElement('div');
        item.textContent = member.characterName;
        partyList.appendChild(item);
    });
    document.getElementById('invite-btn').onclick = () => {
        const targetId = prompt('Enter player ID to invite:');
        if (targetId && game.players[targetId]) {
            sendMessage({type: 'party_invite', from: game.player.id, to: targetId});
        }
    };
    document.getElementById('party-chat-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && e.target.value) {
            sendMessage({type: 'party_message', id: game.player.id, characterName: game.player.characterName, message: e.target.value});
            e.target.value = '';
        }
    });
}

function addPartyMessage(characterName, msg) {
    const partyChat = document.getElementById('party-chat');
    if (partyChat) {
        const div = document.createElement('div');
        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        div.textContent = `[${timeStr}] ${characterName}: ${msg}`;
        partyChat.insertBefore(div, partyChat.firstChild);
    }
}

export { initParty, addPartyMessage, party };