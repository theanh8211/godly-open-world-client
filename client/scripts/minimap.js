let miniMap, miniMapPlayers = {};

function initMinimap(scene) {
    miniMap = scene.add.rectangle(10, 10, 200, 200, 0x333333, 0.8).setOrigin(0).setScrollFactor(0);
    scene.add.rectangle(10, 10, 200, 200).setOrigin(0).setScrollFactor(0).setStrokeStyle(2, 0xffffff);
    miniMapPlayers[scene.player.id] = scene.add.circle(10 + 100, 10 + 100, 5, 0xff0000).setOrigin(0.5).setScrollFactor(0);

    scene.add.text(10 + 100, 220, `X: ${Math.floor(scene.player.x)}, Y: ${Math.floor(scene.player.y)}`, {
        color: '#fff', fontSize: '14px', stroke: '#000', strokeThickness: 2
    }).setOrigin(0.5).setScrollFactor(0);
}

function updateMinimap(player, players) {
    const miniMapScale = 200 / 10000;
    miniMapPlayers[player.id].x = 10 + (player.x * miniMapScale);
    miniMapPlayers[player.id].y = 10 + (player.y * miniMapScale);
    Object.values(players).forEach(p => {
        if (miniMapPlayers[p.id]) {
            miniMapPlayers[p.id].x = 10 + (p.x * miniMapScale);
            miniMapPlayers[p.id].y = 10 + (p.y * miniMapScale);
        }
    });
}

function addOrUpdatePlayer(id, x, y, characterName) {
    const scene = game.scene.scenes[0];
    if (!game.players[id]) {
        game.players[id] = scene.physics.add.sprite(x, y, 'player').setDepth(2);
        game.players[id].chatText = scene.add.text(x - 16, y - 32, characterName, 
            {color: '#fff', fontSize: '12px', stroke: '#000', strokeThickness: 2}).setDepth(3);
        game.players[id].characterName = characterName;
        miniMapPlayers[id] = scene.add.circle(10 + (x * 200 / 10000), 
            10 + (y * 200 / 10000), 5, 0x00ff00).setOrigin(0.5).setScrollFactor(0);
    } else {
        game.players[id].x = x;
        game.players[id].y = y;
        game.players[id].chatText.setText(characterName);
        miniMapPlayers[id].x = 10 + (x * 200 / 10000);
        miniMapPlayers[id].y = 10 + (y * 200 / 10000);
    }
}

export { initMinimap, updateMinimap, addOrUpdatePlayer };