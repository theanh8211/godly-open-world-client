const bcrypt = require('bcryptjs');

function handleLogin(ws, data, users, onlinePlayers) {
    if (!users[data.username]) {
        ws.send(JSON.stringify({ type: 'auth', success: false, message: 'Username does not exist' }));
    } else if (bcrypt.compareSync(data.password, users[data.username].password)) {
        const user = users[data.username];
        if (onlinePlayers[user.id]) {
            onlinePlayers[user.id].send(JSON.stringify({ type: 'force_logout', message: 'Account logged in elsewhere' }));
            onlinePlayers[user.id].close();
        }
        onlinePlayers[user.id] = ws;
        ws.send(JSON.stringify({ type: 'auth', success: true, ...user }));
    } else {
        ws.send(JSON.stringify({ type: 'auth', success: false, message: 'Invalid password' }));
    }
}

function handleRegister(ws, data, users, onlinePlayers) {
    if (users[data.username]) {
        ws.send(JSON.stringify({ type: 'auth', success: false, message: 'Username already exists' }));
    } else {
        const hashedPassword = bcrypt.hashSync(data.password, 10);
        const user = {
            id: data.username,
            username: data.username,
            password: hashedPassword,
            coins: 0,
            inventory: [],
            lastX: null,
            lastY: null,
            characterName: null
        };
        users[data.username] = user;
        onlinePlayers[user.id] = ws;
        ws.send(JSON.stringify({ type: 'auth', success: true, ...user }));
    }
}

module.exports = { handleLogin, handleRegister };