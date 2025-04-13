function handleTeleport(ws, data, users, wss) {
    if (users[data.id]) {
        const distance = Math.sqrt((data.x - users[data.id].lastX) ** 2 + (data.y - users[data.id].lastY) ** 2);
        if (distance < 10000) { // Giới hạn khoảng cách teleport
            users[data.id].lastX = data.x;
            users[data.id].lastY = data.y;
            wss.clients.forEach(client => {
                if (client !== ws) client.send(JSON.stringify({ type: 'move', id: data.id, x: data.x, y: data.y }));
            });
        }
    }
}

module.exports = { handleTeleport };