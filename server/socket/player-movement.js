function handleMovement(ws, data, users, wss) {
    if (users[data.id]) {
        const lastX = users[data.id].lastX || 0;
        const lastY = users[data.id].lastY || 0;
        const distance = Math.sqrt((data.x - lastX) ** 2 + (data.y - lastY) ** 2);
        if (distance <= 300) { // Giới hạn tốc độ di chuyển
            users[data.id].lastX = data.x;
            users[data.id].lastY = data.y;
            wss.clients.forEach(client => {
                if (client !== ws) client.send(JSON.stringify(data));
            });
        }
    }
}

module.exports = { handleMovement };