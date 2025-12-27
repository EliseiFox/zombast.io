import Phaser from 'phaser';

export class UIScene extends Phaser.Scene {
    private woodText!: Phaser.GameObjects.Text;

    constructor() {
        super('UIScene');
    }

    create() {
        this.woodText = this.add.text(20, 20, 'Wood: 0', { fontSize: '24px', color: '#fff' });
        this.add.text(20, 50, '[B] Build Mode', { fontSize: '16px', color: '#aaa' });

        // Слушаем события от GameScene
        const gameScene = this.scene.get('GameScene');
        gameScene.events.on('update-inventory', (wood: number) => {
            this.woodText.setText(`Wood: ${wood}`);
        });
    }
}