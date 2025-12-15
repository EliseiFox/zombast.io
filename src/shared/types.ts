export interface IPlayer {
    id: string;
    x: number;
    y: number;
    color: number; // Hex color (0xff0000)
}

export interface IInput {
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
}