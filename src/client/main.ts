import Phaser from 'phaser';
import { io, Socket } from 'socket.io-client';
import { SOCKET_EVENTS, WORLD_SIZE } from '@shared/constants';
import { IPlayer, IInput } from '@shared/types';

class GameScene extends Phaser.Scene {
    private socket!: Socket;
    private playersMap: Map<string, Phaser.GameObjects.Arc> = new Map();
    
    // Группа для ресурсов (деревьев)
    private resourcesGroup!: Phaser.GameObjects.Group;

    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private wasd!: any;
    private myPlayerId: string = "";

    constructor() {
        super('GameScene');
    }

    // 1. Создаем текстуры программно (чтобы не качать картинки)
    preload() {
        // Рисуем кружок дерева в памяти
        const graphics = this.make.graphics({ x: 0, y: 0, add: false });
        graphics.fillStyle(0x228b22); // Forest Green
        graphics.fillCircle(20, 20, 20); // x, y, radius
        graphics.generateTexture('tree', 40, 40);
    }

    create() {
        this.socket = io('http://localhost:3000');
        
        // 2. Настраиваем границы мира и камеру
        this.physics.world.setBounds(0, 0, WORLD_SIZE, WORLD_SIZE);
        
        // Рисуем сетку на земле (Трава)
        this.add.grid(WORLD_SIZE/2, WORLD_SIZE/2, WORLD_SIZE, WORLD_SIZE, 64, 64, 0x006400).setAltFillStyle(0x005000).setOutlineStyle();

        this.resourcesGroup = this.add.group();

        // Управление
        if (this.input.keyboard) {
            this.cursors = this.input.keyboard.createCursorKeys();
            this.wasd = this.input.keyboard.addKeys({
                up: Phaser.Input.Keyboard.KeyCodes.W,
                down: Phaser.Input.Keyboard.KeyCodes.S,
                left: Phaser.Input.Keyboard.KeyCodes.A,
                right: Phaser.Input.Keyboard.KeyCodes.D
            });
        }

        // Событие подключения
        this.socket.on('connect', () => {
            console.log('Connected');
            this.myPlayerId = this.socket.id || "";
        });

        // 3. Получаем карту ресурсов (Деревья) один раз при старте
        this.socket.on(SOCKET_EVENTS.INIT_WORLD, (resources: any[]) => {
            resources.forEach(res => {
                const tree = this.add.image(res.x, res.y, 'tree');
                this.resourcesGroup.add(tree);
            });
        });

        // Обновление игроков
        this.socket.on(SOCKET_EVENTS.GAME_UPDATE, (serverPlayers: Record<string, IPlayer>) => {
            this.handleServerUpdate(serverPlayers);
        });
    }

    update() {
        if (!this.socket || !this.input.keyboard) return;

        const input: IInput = {
            up: this.cursors.up.isDown || this.wasd.up.isDown,
            down: this.cursors.down.isDown || this.wasd.down.isDown,
            left: this.cursors.left.isDown || this.wasd.left.isDown,
            right: this.cursors.right.isDown || this.wasd.right.isDown
        };
        this.socket.emit('input', input);
    }

    private handleServerUpdate(serverPlayers: Record<string, IPlayer>) {
        for (const id in serverPlayers) {
            const p = serverPlayers[id];

            if (this.playersMap.has(id)) {
                // Игрок существует
                const sprite = this.playersMap.get(id);
                if (sprite) {
                    // Интерполяция
                    sprite.x = Phaser.Math.Linear(sprite.x, p.x, 0.5);
                    sprite.y = Phaser.Math.Linear(sprite.y, p.y, 0.5);
                }
            } else {
                // Новый игрок
                const newSprite = this.add.circle(p.x, p.y, 20, p.color);
                // Добавляем обводку, чтобы отличать
                newSprite.setStrokeStyle(2, 0x000000);
                
                this.playersMap.set(id, newSprite);

                // 4. ЕСЛИ ЭТО МЫ - ВЕШАЕМ КАМЕРУ
                if (id === this.myPlayerId) {
                    this.cameras.main.startFollow(newSprite, true, 0.1, 0.1);
                    this.cameras.main.setZoom(1); // Можно отдалить камеру (0.8)
                }
            }
        }

        // Удаление вышедших
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
    width: window.innerWidth, // На весь экран
    height: window.innerHeight,
    backgroundColor: '#1a1a1a',
    scene: [GameScene],
    physics: { default: 'arcade', arcade: { debug: false } },
    scale: {
        mode: Phaser.Scale.RESIZE, // Авто-ресайз окна
        autoCenter: Phaser.Scale.CENTER_BOTH
    }
};

new Phaser.Game(config);