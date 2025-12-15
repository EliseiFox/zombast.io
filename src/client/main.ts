import Phaser from 'phaser';
import { io, Socket } from 'socket.io-client';
import { SOCKET_EVENTS } from '../shared/constants';

class GameScene extends Phaser.Scene {
    private socket!: Socket;
    private statusText!: Phaser.GameObjects.Text;

    constructor() {
        super('GameScene');
    }

    create() {
        // Подключение к серверу
        // В Vite dev режиме нам нужно указать порт сервера явно, 
        // так как клиент крутится на другом порту (5173)
        this.socket = io('http://localhost:3000');

        this.statusText = this.add.text(10, 10, 'Connecting...', { 
            fontSize: '20px', 
            color: '#ffffff' 
        });

        this.socket.on('connect', () => {
            console.log('[CLIENT] Connected to server!');
            this.statusText.setText(`Connected! ID: ${this.socket.id}`);
        });
    }
}

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    backgroundColor: '#2d2d2d',
    scene: [GameScene],
    physics: {
        default: 'arcade', // Пока используем простую физику для теста
        arcade: { debug: true }
    }
};

new Phaser.Game(config);