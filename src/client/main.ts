import Phaser from 'phaser';
import { io, Socket } from 'socket.io-client';
import { SOCKET_EVENTS, WORLD_SIZE, TILE_SIZE } from '@shared/constants';
import { IPlayer, IInput, IBuilding } from '@shared/types';

class GameScene extends Phaser.Scene {
    private socket!: Socket;
    private playersMap: Map<string, Phaser.GameObjects.Container> = new Map();
    private resourcesGroup!: Phaser.GameObjects.Group;
    private buildingsGroup!: Phaser.GameObjects.Group; // Группа стен
    
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private wasd!: any;
    private myPlayerId: string = "";
    private woodText!: Phaser.GameObjects.Text;

    // === НОВЫЕ ПЕРЕМЕННЫЕ ===
    private lastAttackTime: number = 0; // Для ограничения скорости атаки
    private attackRate: number = 400;   // Задержка между ударами (мс) - 400мс это примерно 2.5 удара в сек
    // Храним состояние: какой рукой сейчас бить (для каждого игрока)
    private punchState: Map<string, boolean> = new Map(); // true = left, false = right
    
    // СТРОИТЕЛЬСТВО
    private isBuildMode: boolean = false;
    private ghostWall!: Phaser.GameObjects.Image; // Призрак
    private keyB!: Phaser.Input.Keyboard.Key; // Кнопка B

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

        // WALL (Квадратная стена)
        graphics.clear();
        graphics.lineStyle(4, 0x333333); // Темная обводка
        graphics.fillStyle(0x888888);    // Серый цвет
        graphics.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
        graphics.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
        graphics.generateTexture('wall', TILE_SIZE, TILE_SIZE);
    }

    create() {
        this.socket = io('http://localhost:3000');
        this.physics.world.setBounds(0, 0, WORLD_SIZE, WORLD_SIZE);
        this.add.grid(WORLD_SIZE/2, WORLD_SIZE/2, WORLD_SIZE, WORLD_SIZE, TILE_SIZE, TILE_SIZE, 0x004400).setAltFillStyle(0x003300).setOutlineStyle();
        this.resourcesGroup = this.add.group();
        this.buildingsGroup = this.add.group(); // Создаем группу стен
        
        this.woodText = this.add.text(20, 20, 'Wood: 0', { fontSize: '24px', color: '#fff' }).setScrollFactor(0).setDepth(100);

        // Подсказка
        this.add.text(20, 50, '[B] Build Mode', { fontSize: '16px', color: '#aaa' }).setScrollFactor(0).setDepth(100);

        if (this.input.keyboard) {
            this.cursors = this.input.keyboard.createCursorKeys();
            this.wasd = this.input.keyboard.addKeys({ up: 38, down: 40, left: 37, right: 39, W: 87, A: 65, S: 83, D: 68 }) as any;
        
            // Кнопка B
            this.keyB = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.B);
            this.keyB.on('down', () => {
                this.isBuildMode = !this.isBuildMode;
                this.ghostWall.setVisible(this.isBuildMode);
            });
        
        }

        // Призрачная стена (Скрыта по умолчанию)
        this.ghostWall = this.add.image(0, 0, 'wall');
        this.ghostWall.setAlpha(0.5); // Полупрозрачная
        this.ghostWall.setVisible(false);
        this.ghostWall.setDepth(50); // Поверх земли, но под игроком

        // Поворот за мышкой
        this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            const myContainer = this.playersMap.get(this.myPlayerId);
            if (myContainer) {
                const angle = Phaser.Math.Angle.Between(
                    this.cameras.main.width / 2, this.cameras.main.height / 2, pointer.x, pointer.y
                );
                this.socket.emit(SOCKET_EVENTS.PLAYER_ROTATE, angle);
            }

            // Движение призрака (Snap to Grid)
            if (this.isBuildMode) {
                const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
                // Округляем до сетки.
                // Смещаем на половину тайла, т.к. якорь спрайта в центре
                const snapX = Math.floor(worldPoint.x / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
                const snapY = Math.floor(worldPoint.y / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
                
                this.ghostWall.setPosition(snapX, snapY);
            
                // Красим призрака в красный, если далеко
                if (myContainer) {
                    const dist = Phaser.Math.Distance.Between(myContainer.x, myContainer.y, snapX, snapY);
                    this.ghostWall.setTint(dist > 150 ? 0xff0000 : 0xffffff);
                }
            }
        });

        // INIT WORLD (теперь приходит объект {resources, buildings})
        this.socket.on(SOCKET_EVENTS.INIT_WORLD, (data: { resources: any[], buildings: IBuilding[] }) => {
            // Ресурсы
            data.resources.forEach(res => {
                const tree = this.add.image(res.x, res.y, 'tree');
                tree.setName(res.id.toString());
                this.resourcesGroup.add(tree);
            });
            // Стены
            data.buildings.forEach(b => {
                this.addBuilding(b);
            });
        });

        // Новая стена построена кем-то
        this.socket.on(SOCKET_EVENTS.NEW_BUILDING, (b: IBuilding) => {
            this.addBuilding(b);
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

        // Слушаем команду анимации от сервера ===
        this.socket.on(SOCKET_EVENTS.PLAYER_ANIMATION, (data: { id: string, type: string }) => {
            this.playAttackAnimation(data.id);
        });
    }

    private addBuilding(b: IBuilding) {
        const wall = this.add.image(b.x, b.y, 'wall');
        this.buildingsGroup.add(wall);
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

        // input.activePointer - это мышка (или палец на телефоне)
        // Клик (Атака ИЛИ Стройка)
        if (this.input.activePointer.isDown) {
            const now = Date.now();
            if (now - this.lastAttackTime > 400) { // Общий кулдаун
                this.lastAttackTime = now;

                if (this.isBuildMode) {
                    // РЕЖИМ СТРОЙКИ: Отправляем координаты призрака
                    this.socket.emit(SOCKET_EVENTS.PLAYER_BUILD, { 
                        x: this.ghostWall.x, 
                        y: this.ghostWall.y 
                    });
                } else {
                    // РЕЖИМ БОЯ: Бьем
                    this.socket.emit(SOCKET_EVENTS.PLAYER_ATTACK);
                }
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