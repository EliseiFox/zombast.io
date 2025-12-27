import Phaser from 'phaser';

export class ClientPlayer extends Phaser.GameObjects.Container {
    private bodyShape: Phaser.GameObjects.Arc;
    private leftHand: Phaser.GameObjects.Image;
    private rightHand: Phaser.GameObjects.Image;

    constructor(scene: Phaser.Scene, x: number, y: number, color: number) {
        super(scene, x, y);

        // Тело
        this.bodyShape = scene.add.circle(0, 0, 20, color);
        this.bodyShape.setStrokeStyle(2, 0x000000);

        // Руки
        this.leftHand = scene.add.image(15, -12, 'hand');
        this.rightHand = scene.add.image(15, 12, 'hand');

        this.add([this.bodyShape, this.leftHand, this.rightHand]);
        
        // Добавляем себя на сцену
        scene.add.existing(this);
    }

    // Плавное обновление позиции
    public updateServerData(targetX: number, targetY: number, targetRotation: number) {
        this.x = Phaser.Math.Linear(this.x, targetX, 0.5);
        this.y = Phaser.Math.Linear(this.y, targetY, 0.5);
        this.rotation = Phaser.Math.Angle.RotateTo(this.rotation, targetRotation, 0.2);
    }

    public playPunchAnimation(isLeftHand: boolean) {
        const hand = isLeftHand ? this.leftHand : this.rightHand;
        
        if (this.scene) {
            this.scene.tweens.add({
                targets: hand,
                x: hand.x + 10,
                duration: 100,
                yoyo: true,
                ease: 'Power1'
            });
        }
    }
}