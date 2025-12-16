export const SOCKET_EVENTS = {
    CONNECT: 'connection',
    DISCONNECT: 'disconnect',
    GAME_UPDATE: 'update',

    INIT_WORLD: 'init_world', // Новое событие для загрузки карты
    PLAYER_ROTATE: 'player_rotate', // Игрок повернулся

    PLAYER_ATTACK: 'player_attack',      // Клиент -> Сервер (Я нажал атаку)
    PLAYER_ANIMATION: 'player_anim',     // Сервер -> Все клиенты (Проиграйте анимацию)

    RESOURCE_DESTROYED: 'res_destroyed', // Дерево сломалось

    PLAYER_BUILD: 'player_build', // Игрок хочет построить
    NEW_BUILDING: 'new_building'  // Сервер говорит: тут появилась стена
};

export const SERVER_PORT = 3000;

// Размеры игрового мира
export const WORLD_SIZE = 2000;

export const TILE_SIZE = 64; // Размер одной стены (и клетки сетки)