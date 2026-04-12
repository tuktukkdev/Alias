"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasAnotherSocketForPlayer = void 0;
const ws_1 = require("ws");
const serverState_1 = require("../state/serverState");
const hasAnotherSocketForPlayer = (roomId, playerId, ignoredSocket) => {
    const sockets = serverState_1.roomSockets.get(roomId);
    if (!sockets) {
        return false;
    }
    for (const socket of sockets) {
        if (socket === ignoredSocket) {
            continue;
        }
        if (serverState_1.socketPlayers.get(socket) === playerId && socket.readyState === ws_1.WebSocket.OPEN) {
            return true;
        }
    }
    return false;
};
exports.hasAnotherSocketForPlayer = hasAnotherSocketForPlayer;
//# sourceMappingURL=socketPresenceService.js.map