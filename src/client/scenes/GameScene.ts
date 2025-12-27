import Phaser from 'phaser';
import { Network } from '../network/Network';
import { InputSystem } from '../systems/InputSystem';
import { ClientPlayer } from '../entities/ClientPlayer';
import { SOCKET_EVENTS, WORLD_SIZE, TILE_SIZE } from '@shared/constants';
import { IPlayer, IBuilding } from '@shared/types';

export class GameScene extends Phaser.Scene {
    private network!: Network;
    private inputSystem!: InputSystem;

    private playersMap: Map<string, ClientPlayer> = new Map();
    private resourcesGroup!: Phaser.GameObjects.Group;
    private buildingsGroup!: Phaser.GameObjects.Group;
    
    // Стройка
    private ghostWall!: Phaser.GameObjects.Image;
    private punchState: Map<string, boolean> = new Map();

    constructor() {
        super('GameScene');
    }

    create() {
        this.network = new Network();
        
        // Мир
        this.physics.world.setBounds(0, 0, WORLD_SIZE, WORLD_SIZE);
        this.add.grid(WORLD_SIZE/2, WORLD_SIZE/2, WORLD_SIZE, WORLD_SIZE, TILE_SIZE, TILE_SIZE, 0x004400).setAltFillStyle(0x003300).setOutlineStyle();
        
        this.resourcesGroup = this.add.group();
        this.buildingsGroup = this.add.group();

        // Призрак стены
        this.ghostWall = this.add.image(0, 0, 'wall').setAlpha(0.5).setVisible(false).setDepth(50);

        // Инициализация системы ввода
        // Передаем функцию получения координат призрака
        this.inputSystem = new InputSystem(this, this.network, () => ({ x: this.ghostWall.x, y: this.ghostWall.y }));

        // Обработка переключения режима стройки (от InputSystem)
        this.events.on('toggle-build-mode', (isActive: boolean) => {
            this.ghostWall.setVisible(isActive);
        });

        // === СЕТЕВЫЕ СОБЫТИЯ ===
        
        // 1. Инициализация мира
        this.network.on(SOCKET_EVENTS.INIT_WORLD, (data: { resources: any[], buildings: IBuilding[] }) => {
            data.resources.forEach(res => {
                const tree = this.add.image(res.x, res.y, 'tree');
                tree.setName(res.id.toString());
                this.resourcesGroup.add(tree);
            });
            data.buildings.forEach(b => this.addBuilding(b));
        });

        // 2. Новая постройка
        this.network.on(SOCKET_EVENTS.NEW_BUILDING, (b: IBuilding) => this.addBuilding(b));

        // 3. Уничтожение ресурса
        this.network.on(SOCKET_EVENTS.RESOURCE_DESTROYED, (id: number) => {
            const tree = this.resourcesGroup.getChildren().find(child => child.name === id.toString());
            if (tree) tree.destroy();
        });

        // 4. Обновление игры (Основной цикл)
        this.network.on(SOCKET_EVENTS.GAME_UPDATE, (players: Record<string, IPlayer>) => {
            this.handleGameUpdate(players);
        });

        // 5. Анимация
        this.network.on(SOCKET_EVENTS.PLAYER_ANIMATION, (data: { id: string }) => {
            const player = this.playersMap.get(data.id);
            if (player) {
                const isLeft = this.punchState.get(data.id) || false;
                this.punchState.set(data.id, !isLeft);
                player.playPunchAnimation(isLeft);
            }
        });
    }

    update() {
        // Логика ввода
        if (this.inputSystem) {
            this.inputSystem.update();
            
            // Логика призрака (перенес сюда из main, чтобы было чище)
            if (this.inputSystem.isBuildMode) {
                const pointer = this.input.activePointer;
                const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
                const snapX = Math.floor(worldPoint.x / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
                const snapY = Math.floor(worldPoint.y / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
                this.ghostWall.setPosition(snapX, snapY);
                
                const myContainer = this.playersMap.get(this.network.getSocketID());
                if (!myContainer) return;
                // Красим призрака в красный, если далеко
                const dist = Phaser.Math.Distance.Between(myContainer.x, myContainer.y, snapX, snapY);
                this.ghostWall.setTint(dist > 150 ? 0xff0000 : 0xffffff);
            }
        }
    }

    private addBuilding(b: IBuilding) {
        const wall = this.add.image(b.x, b.y, 'wall');
        this.buildingsGroup.add(wall);
    }

    private handleGameUpdate(serverPlayers: Record<string, IPlayer>) {
        const myId = this.network.getSocketID();

        for (const id in serverPlayers) {
            const p = serverPlayers[id];

            // Обновляем UI, если это мы
            if (id === myId) {
                this.events.emit('update-inventory', p.inventory.wood);
            }

            if (this.playersMap.has(id)) {
                // Обновляем существующего
                this.playersMap.get(id)?.updateServerData(p.x, p.y, p.r);
            } else {
                // Создаем нового через наш класс
                const newPlayer = new ClientPlayer(this, p.x, p.y, p.color);
                this.playersMap.set(id, newPlayer);

                if (id === myId) {
                    this.cameras.main.startFollow(newPlayer, true, 0.1, 0.1);
                }
            }
        }

        // Удаление
        this.playersMap.forEach((player, id) => {
            if (!serverPlayers[id]) {
                player.destroy();
                this.playersMap.delete(id);
            }
        });
    }
}