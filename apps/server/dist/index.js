"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const roomRoutes_1 = require("./routes/roomRoutes");
const socketServer_1 = require("./ws/socketServer");
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use((_, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    res.header("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
    next();
});
app.options(/.*/, (_, res) => {
    res.sendStatus(204);
});
(0, roomRoutes_1.registerRoomRoutes)(app);
const server = app.listen(3000, () => {
    console.log("Server running on port 3000");
});
(0, socketServer_1.registerSocketServer)(server);
//# sourceMappingURL=index.js.map