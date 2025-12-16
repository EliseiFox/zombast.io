import Phaser from 'phaser';
import { io, Socket } from 'socket.io-client';
import { SOCKET_EVENTS, WORLD_SIZE } from '@shared/constants';
import { IPlayer, IInput } from '@shared/types';

class GameScene extends Phaser.Scene {
    private socket!: Socket;
    private playersMap: Map<string, Phaser.GameObjects.Container> = new Map();
    private resourcesGroup!: Phaser.GameObjects.Group;
    
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private wasd!: any;
    private myPlayerId: string = "";
    private woodText!: Phaser.GameObjects.Text;

    // === НОВЫЕ ПЕРЕМЕННЫЕ ===
    private lastAttackTime: number = 0; // Для ограничения скорости атаки
    private attackRate: number = 400;   // Задержка между ударами (мс) - 400мс это примерно 2.5 удара в сек
    // Храним состояние: какой рукой сейчас бить (для каждого игрока)
    private punchState: Map<string, boolean> = new Map(); // true = left, false = right

    constructor() { super('GameScene'); }

    preload() {
        // Текстуры (Дерево)
        const graphics = this.make.graphics({ x: 0, y: 0 });
        graphics.fillStyle(0x228b22);
        graphics.fillCircle(20, 20, 20);
        graphics.generateTexture('tree', 40, 40);

        // Текстура руки
        graphics.clear();
        graphics.fillStyle(0x333333); // Темно-серые перчатки
        graphics.fillCircle(6, 6, 6); // Чуть больше
        graphics.generateTexture('hand', 12, 12);
    }

    create() {
        this.socket = io('http://localhost:3000');
        this.physics.world.setBounds(0, 0, WORLD_SIZE, WORLD_SIZE);
        this.add.grid(WORLD_SIZE/2, WORLD_SIZE/2, WORLD_SIZE, WORLD_SIZE, 64, 64, 0x006400).setAltFillStyle(0x005000).setOutlineStyle();
        this.resourcesGroup = this.add.group();
        
        this.woodText = this.add.text(20, 20, 'Wood: 0', { fontSize: '24px', color: '#fff' }).setScrollFactor(0).setDepth(100);

        if (this.input.keyboard) {
            this.cursors = this.input.keyboard.createCursorKeys();
            this.wasd = this.input.keyboard.addKeys({ up: 38, down: 40, left: 37, right: 39, W: 87, A: 65, S: 83, D: 68 }) as any;
        }

        // Поворот за мышкой
        this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            const myContainer = this.playersMap.get(this.myPlayerId);
            if (myContainer) {
                const angle = Phaser.Math.Angle.Between(
                    this.cameras.main.width / 2, this.cameras.main.height / 2, pointer.x, pointer.y
                );
                this.socket.emit(SOCKET_EVENTS.PLAYER_ROTATE, angle);
            }
        });

        // УБРАЛИ pointerdown, перенесли в update

        // Сетевые события
        this.socket.on('connect', () => { this.myPlayerId = this.socket.id || ""; });
        
        this.socket.on(SOCKET_EVENTS.INIT_WORLD, (resources: any[]) => {
            resources.forEach(res => {
                const tree = this.add.image(res.x, res.y, 'tree');
                tree.setName(res.id.toString());
                this.resourcesGroup.add(tree);
            });
        });

        this.socket.on(SOCKET_EVENTS.RESOURCE_DESTROYED, (id: number) => {
            const tree = this.resourcesGroup.getChildren().find(child => child.name === id.toString());
            if (tree) tree.destroy();
        });

        this.socket.on(SOCKET_EVENTS.GAME_UPDATE, (serverPlayers) => this.handleServerUpdate(serverPlayers));

        // === НОВОЕ: Слушаем команду анимации от сервера ===
        this.socket.on(SOCKET_EVENTS.PLAYER_ANIMATION, (data: { id: string, type: string }) => {
            this.playAttackAnimation(data.id);
        });
    }

    update() {
        if (!this.socket || !this.input.keyboard) return;

        // 1. Движение
        const input: IInput = {
            up: this.cursors.up.isDown || this.wasd.W.isDown,
            down: this.cursors.down.isDown || this.wasd.S.isDown,
            left: this.cursors.left.isDown || this.wasd.A.isDown,
            right: this.cursors.right.isDown || this.wasd.D.isDown
        };
        this.socket.emit('input', input);

        // 2. Атака (Зажатие кнопки)
        // input.activePointer - это мышка (или палец на телефоне)
        if (this.input.activePointer.isDown) {
            const now = Date.now();
            // Проверяем кулдаун (не чаще чем раз в 400мс)
            if (now - this.lastAttackTime > this.attackRate) {
                this.lastAttackTime = now;
                this.socket.emit(SOCKET_EVENTS.PLAYER_ATTACK);
                // Анимацию не запускаем здесь! Мы ждем ответа от сервера (PLAYER_ANIMATION),
                // чтобы все было синхронно у всех.
            }
        }
    }

    // Функция анимации удара
    private playAttackAnimation(playerId: string) {
        const container = this.playersMap.get(playerId);
        if (!container) return;

        // Определяем, какой рукой бить (Left/Right)
        const isLeft = this.punchState.get(playerId) || false;
        this.punchState.set(playerId, !isLeft); // Меняем руку для следующего раза

        // Индексы в контейнере: 0-Body, 1-LeftHand, 2-RightHand
        const handIndex = isLeft ? 1 : 2; 
        const hand = container.getAt(handIndex) as Phaser.GameObjects.Image;

        if (hand) {
            this.tweens.add({
                targets: hand,
                x: hand.x + 10, // Выдвигаем вперед (относительно контейнера)
                duration: 100,
                yoyo: true, // Возврат назад
                ease: 'Power1'
            });
        }
    }

    private handleServerUpdate(serverPlayers: Record<string, IPlayer>) {
        for (const id in serverPlayers) {
            const p = serverPlayers[id];

            if (id === this.myPlayerId) {
                this.woodText.setText(`Wood: ${p.inventory.wood}`);
            }

            if (this.playersMap.has(id)) {
                const container = this.playersMap.get(id);
                if (container) {
                    container.x = Phaser.Math.Linear(container.x, p.x, 0.5);
                    container.y = Phaser.Math.Linear(container.y, p.y, 0.5);
                    container.rotation = Phaser.Math.Angle.RotateTo(container.rotation, p.r, 0.2);
                }
            } else {
                // Создание игрока с ДВУМЯ руками
                const container = this.add.container(p.x, p.y);
                
                const body = this.add.circle(0, 0, 20, p.color);
                body.setStrokeStyle(2, 0x000000);
                
                // Левая рука (смещена влево и чуть вперед)
                const leftHand = this.add.image(15, -12, 'hand');
                // Правая рука
                const rightHand = this.add.image(15, 12, 'hand');
                
                // Важен порядок добавления! 
                // getAt(0) = body, getAt(1) = left, getAt(2) = right
                container.add([body, leftHand, rightHand]);
                
                this.playersMap.set(id, container);

                if (id === this.myPlayerId) {
                    this.cameras.main.startFollow(container);
                }
            }
        }
        
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
    width: window.innerWidth, 
    height: window.innerHeight,
    backgroundColor: '#1a1a1a',
    scene: [GameScene],
    physics: { default: 'arcade', arcade: { debug: false } },
    scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH }
};
new Phaser.Game(config);