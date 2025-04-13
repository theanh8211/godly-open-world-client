function handleParty(ws, data, parties, wss) {
    if (data.type === 'party_invite') {
        if (!parties[data.from]) {
            parties[data.from] = { leader: data.from, members: [data.from] };
        }
        if (parties[data.from].members.length < 4) { // Giới hạn 4 thành viên
            parties[data.from].members.push(data.to);
            wss.clients.forEach(client => {
                client.send(JSON.stringify({ type: 'party_update', partyId: data.from, members: parties[data.from].members }));
            });
        }
    } else if (data.type === 'party_message') {
        const partyId = Object.keys(parties).find(id => parties[id].members.includes(data.id));
        if (partyId) {
            wss.clients.forEach(client => {
                if (parties[partyId].members.includes(client.id)) {
                    client.send(JSON.stringify(data));
                }
            });
        }
    }
}

module.exports = { handleParty };