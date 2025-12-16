export const SOCKET_EVENTS = {
    CONNECT: 'connection',
    DISCONNECT: 'disconnect',
    GAME_UPDATE: 'update',
    
    INIT_WORLD: 'init_world', // Новое событие для загрузки карты
    PLAYER_ROTATE: 'player_rotate', // Игрок повернулся

    PLAYER_ATTACK: 'player_attack',      // Клиент -> Сервер (Я нажал атаку)
    PLAYER_ANIMATION: 'player_anim',     // Сервер -> Все клиенты (Проиграйте анимацию)

    RESOURCE_DESTROYED: 'res_destroyed', // Дерево сломалось
};

export const SERVER_PORT = 3000;

// Размеры игрового мира
export const WORLD_SIZE = 2000;