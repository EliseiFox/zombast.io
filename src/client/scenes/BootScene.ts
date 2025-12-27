import Phaser from 'phaser';
import { TILE_SIZE } from '@shared/constants';

export class BootScene extends Phaser.Scene {
    constructor() {
        super('BootScene');
    }

    create() {
        const graphics = this.make.graphics({ x: 0, y: 0});

        // Tree
        graphics.fillStyle(0x228b22);
        graphics.fillCircle(20, 20, 20);
        graphics.generateTexture('tree', 40, 40);

        // Hand
        graphics.clear();
        graphics.fillStyle(0x333333);
        graphics.fillCircle(6, 6, 6);
        graphics.generateTexture('hand', 12, 12);

        // Wall
        graphics.clear();
        graphics.lineStyle(4, 0x333333);
        graphics.fillStyle(0x888888);
        graphics.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
        graphics.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
        graphics.generateTexture('wall', TILE_SIZE, TILE_SIZE);

        // Запускаем игру и UI
        this.scene.start('GameScene');
        this.scene.start('UIScene'); // Запускаем параллельно
    }
}