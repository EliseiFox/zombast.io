import { IPlayer, IInput } from '@shared/types';
import { WORLD_SIZE } from '@shared/constants';

export class Player implements IPlayer {
    public id: string;
    public x: number;
    public y: number;
    public r: number = 0;
    public color: number;
    public speed: number = 5;

    public inventory = {
        wood: 0,
        stone: 0
    };

    constructor(id: string) {
        this.id = id;
        this.x = Math.random() * 800; // Случайная позиция
        this.y = Math.random() * 600;
        this.color = Math.random() * 0xffffff; // Случайный цвет
    }

    public processInput(input: IInput) {
        // Простая физика движения
        // В будущем здесь будет проверка коллизий со стенами
        if (input.up) this.y -= this.speed;
        if (input.down) this.y += this.speed;
        if (input.left) this.x -= this.speed;
        if (input.right) this.x += this.speed;

        // Ограничение границами мира (0-WORLD_SIZE, 0-WORLD_SIZE)
        this.x = Math.max(0, Math.min(WORLD_SIZE, this.x));
        this.y = Math.max(0, Math.min(WORLD_SIZE, this.y));
    }
}