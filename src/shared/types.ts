export interface IPlayer {
    id: string;
    x: number;
    y: number;
    r: number; // Угол поворота (в радианах)
    color: number;
    inventory: {
        wood: number;
        stone: number;
    };
}

export interface IInput {
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
    // Мышку будем слать отдельным событием, чтобы не спамить в каждом тике
}

// Структура дерева
export interface IResource {
    id: number;
    x: number;
    y: number;
    type: 'tree' | 'stone';
}

export interface IBuilding {
    id: string; // Уникальный ID стены
    x: number;
    y: number;
    hp: number;
    maxHp: number;
    ownerId: string; // Кто построил
}