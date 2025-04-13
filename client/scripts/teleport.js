import { sendMessage } from './socket.js';

function initTeleport(scene) {
    scene.input.on('pointerdown', (pointer) => {
        if (pointer.rightButtonDown()) { // Right-click để teleport
            const worldPoint = scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
            const x = Phaser.Math.Clamp(worldPoint.x, 0, 10000);
            const y = Phaser.Math.Clamp(worldPoint.y, 0, 10000);
            if (confirm(`Teleport to X: ${Math.floor(x)}, Y: ${Math.floor(y)}?`)) {
                sendMessage({type: 'teleport', id: scene.player.id, x, y});
            }
        }
    });
}

export { initTeleport };