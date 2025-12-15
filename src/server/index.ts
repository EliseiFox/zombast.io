import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { SOCKET_EVENTS, SERVER_PORT } from '../shared/constants';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Разрешаем подключение с любого адреса (для разработки)
    methods: ["GET", "POST"]
  }
});

// Раздаем статику (собранный клиент или dev-версию)
// В режиме разработки Vite будет сам раздавать статику, 
// но для продакшена это нужно.
app.use(express.static(path.join(__dirname, '../../public')));

io.on(SOCKET_EVENTS.CONNECT, (socket) => {
    console.log(`[SERVER] Игрок подключился: ${socket.id}`);

    socket.on(SOCKET_EVENTS.DISCONNECT, () => {
        console.log(`[SERVER] Игрок отключился: ${socket.id}`);
    });
});

httpServer.listen(SERVER_PORT, () => {
    console.log(`[SERVER] Запущен на http://localhost:${SERVER_PORT}`);
});