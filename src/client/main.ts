import Phaser from 'phaser';
import { io, Socket } from 'socket.io-client';
import { SOCKET_EVENTS } from '@shared/constants';
import { IPlayer, IInput } from '@shared/types';

class GameScene extends Phaser.Scene {
    private socket!: Socket;
    // Словарь: ID игрока -> Его спрайт на сцене
    private playersMap: Map<string, Phaser.GameObjects.Arc> = new Map();
    
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private wasd!: {
        up: Phaser.Input.Keyboard.Key;
        down: Phaser.Input.Keyboard.Key;
        left: Phaser.Input.Keyboard.Key;
        right: Phaser.Input.Keyboard.Key;
    };

    constructor() {
        super('GameScene');
    }

    create() {
        this.socket = io('http://localhost:3000');
        
        // Настройка управления (Стрелки + WASD)
        if (this.input.keyboard) {
            this.cursors = this.input.keyboard.createCursorKeys();
            this.wasd = this.input.keyboard.addKeys({
                up: Phaser.Input.Keyboard.KeyCodes.W,
                down: Phaser.Input.Keyboard.KeyCodes.S,
                left: Phaser.Input.Keyboard.KeyCodes.A,
                right: Phaser.Input.Keyboard.KeyCodes.D
            }) as any;
        }

        // Обработка обновлений от сервера
        this.socket.on(SOCKET_EVENTS.GAME_UPDATE, (serverPlayers: Record<string, IPlayer>) => {
            this.handleServerUpdate(serverPlayers);
        });
    }

    update() {
        // Каждый кадр читаем нажатия и шлем на сервер
        if (!this.socket || !this.input.keyboard) return;

        const input: IInput = {
            up: this.cursors.up.isDown || this.wasd.up.isDown,
            down: this.cursors.down.isDown || this.wasd.down.isDown,
            left: this.cursors.left.isDown || this.wasd.left.isDown,
            right: this.cursors.right.isDown || this.wasd.right.isDown
        };

        // Оптимизация: слать только если что-то нажато (или меняется)
        // Но пока шлем всегда для надежности
        this.socket.emit('input', input);
    }

    private handleServerUpdate(serverPlayers: Record<string, IPlayer>) {
        // 1. Обновляем или создаем игроков
        for (const id in serverPlayers) {
            const p = serverPlayers[id];

            if (this.playersMap.has(id)) {
                // Игрок уже есть - просто двигаем его
                const sprite = this.playersMap.get(id);
                if (sprite) {
                    // Простая интерполяция (lerp) для плавности
                    // sprite.x = p.x; // Резко
                    sprite.x = Phaser.Math.Linear(sprite.x, p.x, 0.5); // Плавно
                    sprite.y = Phaser.Math.Linear(sprite.y, p.y, 0.5);
                }
            } else {
                // Нового игрока - создаем
                const newSprite = this.add.circle(p.x, p.y, 20, p.color);
                this.playersMap.set(id, newSprite);
            }
        }

        // 2. Удаляем тех, кого нет на сервере (кто отключился)
        this.playersMap.forEach((sprite, id) => {
            if (!serverPlayers[id]) {
                sprite.destroy();
                this.playersMap.delete(id);
            }
        });
    }
}

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    backgroundColor: '#2d2d2d',
    scene: [GameScene],
    physics: { default: 'arcade', arcade: { debug: true } }
};

new Phaser.Game(config);