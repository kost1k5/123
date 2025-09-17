import { Logger } from '../utils/Logger.js';

export class Level {
    constructor(logger) {
        this.logger = logger || new Logger('Level-Default');
        this.width = 0;
        this.height = 0;
        this.tileSize = 0;
        this.tileData = [];
        this.entities = [];
        this.tiles = []; // Массив для хранения ОБЪЕКТОВ тайлов
        this.backgroundLayers = [];
    }

    async load(levelUrl) {
        const response = await fetch(levelUrl);
        const data = await response.json();

        this.width = data.width;
        this.height = data.height;
        this.tileSize = data.tileSize;
        this.tileData = data.tileData;
        this.entities = data.entities || [];
        // ... any other top-level data from JSON can be assigned here

        this.buildLevel();
        return data; // Возвращаем весь объект данных уровня
    }

    buildLevel() {
        this.tiles = []; // Очищаем тайлы перед перестройкой
        for (let row = 0; row < this.height; row++) {
            for (let col = 0; col < this.width; col++) {
                const tileType = this.tileData[row * this.width + col];
                if (tileType === 0) continue; // Пропускаем пустые тайлы

                const tile = {
                    x: col * this.tileSize,
                    y: row * this.tileSize,
                    width: this.tileSize,
                    height: this.tileSize,
                    type: tileType
                };

                if (tileType === 2) { // 2 = разрушающийся блок
                    tile.state = 'idle'; // 'idle', 'crumbling', 'gone'
                    tile.crumbleTimer = 500; // 0.5 секунды до разрушения
                }

                this.tiles.push(tile);
            }
        }
        this.logger.info(`Level built with ${this.tiles.length} solid tiles.`);

        // Создаем процедурные фоны для параллакса
        this.backgroundLayers = [
            { color: '#2c3e50', scrollFactor: 0.2 },
            { color: '#34495e', scrollFactor: 0.4 },
        ];
    }

    update(deltaTime) {
        const tilesToRemove = [];
        for (const tile of this.tiles) {
            if (tile.type === 2 && tile.state === 'crumbling') {
                tile.crumbleTimer -= deltaTime;
                if (tile.crumbleTimer <= 0) {
                    tile.state = 'gone';
                    tilesToRemove.push(tile);
                }
            }
        }
        // Удаляем тайлы, которые полностью разрушились
        this.tiles = this.tiles.filter(tile => !tilesToRemove.includes(tile));
    }

    drawBackground(context, camera) {
        this.backgroundLayers.forEach(layer => {
            context.fillStyle = layer.color;
            // Рассчитываем положение фона на основе положения камеры и фактора скроллинга
            const bgX = -camera.position.x * (1 - layer.scrollFactor);
            const bgY = 0; // Фон по вертикали не двигается
            const bgWidth = camera.width;
            const bgHeight = camera.height;
            // Рисуем фон, который "заполняет" вид камеры
            context.fillRect(bgX, bgY, bgWidth, bgHeight);
        });
    }

    drawWorld(context) {
        this.tiles.forEach(tile => {
            if (tile.type === 1) {
                context.fillStyle = '#808080'; // Сплошной блок
            } else if (tile.type === 2) {
                if (tile.state === 'idle') {
                    context.fillStyle = '#CD853F'; // Перуанский
                } else {
                    // Делаем блок "мерцающим" при разрушении
                    const alpha = Math.abs(Math.sin(tile.crumbleTimer * 0.1));
                    context.fillStyle = `rgba(205, 133, 63, ${alpha})`;
                }
            }
            context.fillRect(tile.x, tile.y, tile.width, tile.height);
        });
    }
}
