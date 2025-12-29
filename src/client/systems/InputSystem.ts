import Phaser from 'phaser';
import { Network } from '../network/Network';
import { SOCKET_EVENTS } from '@shared/constants';
import { IInput } from '@shared/types';

export class InputSystem {
    private scene: Phaser.Scene;
    private network: Network;
    
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private wasd!: any;
    private keyB!: Phaser.Input.Keyboard.Key;

    private lastAttackTime: number = 0;
    
    // Ссылки на внешние состояния (можно сделать красивее через StateManager, но пока так)
    public isBuildMode: boolean = false;
    private getGhostPosition: () => { x: number, y: number };

    constructor(scene: Phaser.Scene, network: Network, getGhostPos: () => {x: number, y: number}) {
        this.scene = scene;
        this.network = network;
        this.getGhostPosition = getGhostPos;

        if (this.scene.input.keyboard) {
            this.cursors = this.scene.input.keyboard.createCursorKeys();
            this.wasd = this.scene.input.keyboard.addKeys({ up: 38, down: 40, left: 37, right: 39, W: 87, A: 65, S: 83, D: 68 }) as any;
            
            this.keyB = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.B);
            this.keyB.on('down', () => {
                this.isBuildMode = !this.isBuildMode;
                // Эмитим событие внутри сцены, чтобы GameScene могла скрыть/показать призрака
                this.scene.events.emit('toggle-build-mode', this.isBuildMode);
            });
        }
    }

    public update() {
        // 1. Движение
        const input: IInput = {
            up: this.cursors.up.isDown || this.wasd.W.isDown,
            down: this.cursors.down.isDown || this.wasd.S.isDown,
            left: this.cursors.left.isDown || this.wasd.A.isDown,
            right: this.cursors.right.isDown || this.wasd.D.isDown
        };
        this.network.emit('input', input);

        // 2. Поворот (Отправляем каждый кадр или при движении мыши)
        const pointer = this.scene.input.activePointer;
        // Центр экрана всегда (потому что камера следит)
        const angle = Phaser.Math.Angle.Between(
            this.scene.cameras.main.width / 2, 
            this.scene.cameras.main.height / 2, 
            pointer.x, 
            pointer.y
        );
        this.network.emit(SOCKET_EVENTS.PLAYER_ROTATE, angle);

        // 3. Клик (Атака / Стройка)
        if (pointer.isDown) {
            const now = Date.now();
            if (now - this.lastAttackTime > 400) {
                this.lastAttackTime = now;
                
                if (this.isBuildMode) {
                    const pos = this.getGhostPosition();
                    this.network.emit(SOCKET_EVENTS.PLAYER_BUILD, pos);
                } else {
                    this.network.emit(SOCKET_EVENTS.PLAYER_ATTACK);
                }
            }
        }
    }
}