import { sendMessage } from './socket.js';

let selectedAuraIndex = null;

function initInventory() {
    document.getElementById('inventory-btn').onclick = () => toggleMenuTab('inventory', document.getElementById('inventory-btn'));
}

function updateInventoryUI() {
    const contentDiv = document.getElementById('menu-content');
    if (document.querySelector('.menu-btn.active')?.id === 'inventory-btn') {
        contentDiv.innerHTML = `
            <div class="menu-option">Bag (Coins: ${game.player.coins})</div>
            <div id="inventory-grid"></div>
            <button class="menu-option" id="equip-btn" style="display: ${selectedAuraIndex !== null ? 'block' : 'none'};">Equip</button>
        `;
        const grid = document.getElementById('inventory-grid');
        game.inventory.forEach((aura, index) => {
            const item = document.createElement('div');
            item.className = 'aura-item';
            item.style.background = `#${aura.color.toString(16).padStart(6, '0')}`;
            item.innerHTML = `<span class="aura-name">${aura.name}</span>`;
            item.onclick = () => {
                selectedAuraIndex = index === selectedAuraIndex ? null : index;
                updateInventoryUI();
            };
            if (index === selectedAuraIndex) item.classList.add('selected');
            grid.appendChild(item);
        });
        if (document.getElementById('equip-btn')) {
            document.getElementById('equip-btn').onclick = () => {
                if (selectedAuraIndex !== null) {
                    console.log(`Equipped ${game.inventory[selectedAuraIndex].name}`);
                    selectedAuraIndex = null;
                    updateInventoryUI();
                }
            };
        }
    }
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
        if (tab === 'inventory') updateInventoryUI();
        // Xử lý các tab khác
    }
}

export { initInventory, updateInventoryUI };