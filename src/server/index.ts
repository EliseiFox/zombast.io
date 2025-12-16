import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { SOCKET_EVENTS, SERVER_PORT, WORLD_SIZE } from '@shared/constants';
import { Player } from './entities/Player';
import { IInput, IResource } from '@shared/types';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});



// Хранилище
const players: Record<string, Player> = {};
const inputs: Record<string, IInput> = {};

// Генерируем ресурсы (Деревья)
let resources: IResource[] = [];
for (let i = 0; i < 50; i++) { // 50 деревьев
    resources.push({
        id: i,
        x: Math.random() * WORLD_SIZE,
        y: Math.random() * WORLD_SIZE,
        type: 'tree'
    });
}

app.use(express.static(path.join(__dirname, '../../public')));

io.on(SOCKET_EVENTS.CONNECT, (socket) => {
    console.log(`[+] Игрок ${socket.id}`);

    // Создаем игрока
    players[socket.id] = new Player(socket.id);
    inputs[socket.id] = { up: false, down: false, left: false, right: false };

    // Переопределим координаты, чтобы использовать весь WORLD_SIZE
    players[socket.id].x = Math.random() * WORLD_SIZE;
    players[socket.id].y = Math.random() * WORLD_SIZE;

    inputs[socket.id] = { up: false, down: false, left: false, right: false };

    // ОТПРАВЛЯЕМ ИГРОКУ ДАННЫЕ О МИРЕ (Деревья)
    socket.emit(SOCKET_EVENTS.INIT_WORLD, resources);

    socket.on('input', (data: IInput) => {
        inputs[socket.id] = data;
    });

    // Обработка поворота мыши
    socket.on(SOCKET_EVENTS.PLAYER_ROTATE, (angle: number) => {
        if (players[socket.id]) {
            players[socket.id].r = angle;
        }
    });

    // Обработка Атаки (Клик)
    socket.on(SOCKET_EVENTS.PLAYER_ATTACK, () => {
        const player = players[socket.id];
        if (!player) return;

        // Сообщаем ВСЕМ клиентам (включая самого игрока), что этот игрок ударил.
        // Клиенты сами решат, какой рукой махнуть.
        io.emit(SOCKET_EVENTS.PLAYER_ANIMATION, { id: socket.id, type: 'punch' });

        // Проверяем коллизию с каждым деревом
        // В реальной игре нужен QuadTree, но для 50 деревьев цикл сойдет
        for (let i = 0; i < resources.length; i++) {
            const res = resources[i];
            // Теорема Пифагора: расстояние между двумя точками
            const dx = res.x - player.x;
            const dy = res.y - player.y;
            const dist = Math.sqrt(dx*dx + dy*dy);

            if (dist < 70) { // 60px - радиус удара (20 тело + 20 дерево + 30 запас)
                // Удаляем ресурс
                resources.splice(i, 1);
                
                // Даем лут
                player.inventory.wood += 10;

                // Сообщаем всем, что дерево исчезло
                io.emit(SOCKET_EVENTS.RESOURCE_DESTROYED, res.id);
                
                // Прерываем цикл (за один клик рубим одно дерево)
                break;
            }
        }
    });
    
    socket.on(SOCKET_EVENTS.DISCONNECT, () => {
        console.log(`[-] Игрок ${socket.id}`);
        delete players[socket.id];
        delete inputs[socket.id];
    });
});

// === GAME LOOP (60 раз в секунду) ===
const TICK_RATE = 60;
setInterval(() => {
    // 1. Обновляем физику всех игроков
    for (const id in players) {
        if (inputs[id]) {
            players[id].processInput(inputs[id]);
        }
    }

    // 2. Отправляем состояние мира всем клиентам
    // io.emit (broadcast) - очень затратно, но для начала ОК
    io.emit(SOCKET_EVENTS.GAME_UPDATE, players);
}, 1000 / TICK_RATE);

httpServer.listen(SERVER_PORT, () => {
    console.log(`Server running on port ${SERVER_PORT}`);
});