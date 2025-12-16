import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { SOCKET_EVENTS, SERVER_PORT, WORLD_SIZE, TILE_SIZE,  } from '@shared/constants';
import { Player } from './entities/Player';
import { IInput, IResource, IBuilding  } from '@shared/types';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// ВАЖНО: Render выдает порт через переменную окружения
const PORT = process.env.PORT || 3000;

// ВАЖНО: Раздаем папку 'dist', которую создаст Vite при сборке
// Мы будем запускать сервер из корня проекта, поэтому путь просто 'dist'
app.use(express.static(path.join(process.cwd(), 'dist')));



// Хранилище
const players: Record<string, Player> = {};
const inputs: Record<string, IInput> = {};

// Генерируем ресурсы (Деревья)
let resources: IResource[] = [];

let buildings: IBuilding[] = [];

for (let i = 0; i < 50; i++) { // 50 деревьев
    resources.push({
        id: i,
        x: Math.random() * WORLD_SIZE,
        y: Math.random() * WORLD_SIZE,
        type: 'tree'
    });
}

app.use(express.static(path.join(__dirname, '../../public')));

// Вспомогательная функция проверки коллизии (Круг игрока vs Квадрат стены)
function checkCollision(player: Player, newX: number, newY: number): boolean {
    const playerRadius = 20;
    
    // Проверяем каждую стену
    for (const b of buildings) {
        // Простая AABB проверка (квадрат с квадратом для скорости)
        // Стена - это квадрат TILE_SIZE x TILE_SIZE с центром в (b.x, b.y) (или левый верхний угол? В Phaser обычно центр)
        // Давайте договоримся: координаты стены - это её ЦЕНТР.
        
        const halfTile = TILE_SIZE / 2;
        
        // Границы стены
        const wallLeft = b.x - halfTile;
        const wallRight = b.x + halfTile;
        const wallTop = b.y - halfTile;
        const wallBottom = b.y + halfTile;

        // Границы игрока (приближенно квадрат)
        if (newX + playerRadius > wallLeft && 
            newX - playerRadius < wallRight && 
            newY + playerRadius > wallTop && 
            newY - playerRadius < wallBottom) {
            return true; // Столкновение!
        }
    }
    return false;
}

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
    socket.emit(SOCKET_EVENTS.INIT_WORLD, { resources, buildings });

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
    
    // Обработка строительства
    socket.on(SOCKET_EVENTS.PLAYER_BUILD, (data: { x: number, y: number }) => {
        const player = players[socket.id];
        if (!player) return;

        // 1. Проверка ресурсов (Цена стены: 20 дерева)
        if (player.inventory.wood < 20) return;

        // 2. Проверка дистанции (нельзя строить далеко)
        const dist = Math.sqrt((data.x - player.x)**2 + (data.y - player.y)**2);
        if (dist > 150) return;

        // 3. Проверка: занято ли место? (нельзя строить одну стену в другой)
        const isOccupied = buildings.some(b => 
            Math.abs(b.x - data.x) < 10 && Math.abs(b.y - data.y) < 10
        );
        if (isOccupied) return;

        // СТРОИМ!
        player.inventory.wood -= 20; // Списываем ресурсы

        const newWall: IBuilding = {
            id: Math.random().toString(36).substr(2, 9), // Простой ID
            x: data.x,
            y: data.y,
            hp: 100,
            maxHp: 100,
            ownerId: socket.id
        };
        
        buildings.push(newWall);
        io.emit(SOCKET_EVENTS.NEW_BUILDING, newWall);
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
    for (const id in players) {
        const p = players[id];
        const input = inputs[id];
        if (!input) continue;

        // Предсказываем следующую позицию
        let nextX = p.x;
        let nextY = p.y;
        
        if (input.up) nextY -= p.speed;
        if (input.down) nextY += p.speed;
        if (input.left) nextX -= p.speed;
        if (input.right) nextX += p.speed;

        // Ограничение миром
        nextX = Math.max(0, Math.min(WORLD_SIZE, nextX));
        nextY = Math.max(0, Math.min(WORLD_SIZE, nextY));

        // ПРОВЕРКА КОЛЛИЗИЙ СО СТЕНАМИ
        // Проверяем X и Y отдельно, чтобы можно было скользить вдоль стены
        if (!checkCollision(p, nextX, p.y)) {
            p.x = nextX;
        }
        if (!checkCollision(p, p.x, nextY)) {
            p.y = nextY;
        }
    }

    io.emit(SOCKET_EVENTS.GAME_UPDATE, players);
}, 1000 / TICK_RATE);

httpServer.listen(SERVER_PORT, () => {
    console.log(`Server running on port ${SERVER_PORT}`);
});