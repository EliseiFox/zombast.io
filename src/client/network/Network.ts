import { io, Socket } from 'socket.io-client';
import { SOCKET_EVENTS } from '@shared/constants';

export class Network {
    private socket: Socket;
    public id: string = "";

    constructor() {
        this.socket = io('http://localhost:3000');
        
        this.socket.on('connect', () => {
            this.id = this.socket.id || "";
            console.log('Network connected, ID:', this.id);
        });
    }

    // Методы-обертки
    public on(event: string, callback: (...args: any[]) => void) {
        this.socket.on(event, callback);
    }

    public emit(event: string, data?: any) {
        this.socket.emit(event, data);
    }

    public getSocketID(): string {
        return this.id;
    }
}