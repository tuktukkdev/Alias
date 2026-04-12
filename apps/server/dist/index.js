"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const authRoutes_1 = require("./routes/authRoutes");
const collectionsRoutes_1 = require("./routes/collectionsRoutes");
const friendsRoutes_1 = require("./routes/friendsRoutes");
const roomRoutes_1 = require("./routes/roomRoutes");
const socketServer_1 = require("./ws/socketServer");
const app = (0, express_1.default)();
const uploadsDir = path_1.default.join(__dirname, "..", "uploads");
if (!fs_1.default.existsSync(uploadsDir)) {
    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
}
app.use("/uploads", express_1.default.static(uploadsDir));
app.use(express_1.default.json({ limit: "4mb" }));
app.use((_, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    res.header("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
    next();
});
app.options(/.*/, (_, res) => {
    res.sendStatus(204);
});
(0, authRoutes_1.registerAuthRoutes)(app);
(0, collectionsRoutes_1.registerCollectionsRoutes)(app);
(0, friendsRoutes_1.registerFriendsRoutes)(app);
(0, roomRoutes_1.registerRoomRoutes)(app);
const server = app.listen(3000, () => {
    console.log("Server running on port 3000");
});
(0, socketServer_1.registerSocketServer)(server);
//# sourceMappingURL=index.js.map