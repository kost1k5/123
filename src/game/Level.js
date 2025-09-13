export class Level {
    constructor() {
        this.width = 0;
        this.height = 0;
        this.tileSize = 0;
        this.tileData = [];
        this.entities = [];
        this.tiles = []; // Массив для хранения геометрии тайлов для столкновений
    }

    async load(levelUrl) {
        const response = await fetch(levelUrl);
        const data = await response.json();

        this.width = data.width;
        this.height = data.height;
        this.tileSize = data.tileSize;
        this.tileData = data.tileData;
        this.entities = data.entities;

        this.buildLevel();
        return this.entities; // Возвращаем сущности для инициализации в main
    }

    buildLevel() {
        for (let row = 0; row < this.height; row++) {
            for (let col = 0; col < this.width; col++) {
                const tileType = this.tileData[row * this.width + col];
                if (tileType === 1) { // 1 = твердый блок
                    this.tiles.push({
                        x: col * this.tileSize,
                        y: row * this.tileSize,
                        width: this.tileSize,
                        height: this.tileSize
                    });
                }
            }
        }
    }

    // Проверяет, является ли тайл твердым по координатам в пикселях
    isSolid(x, y) {
        if (x < 0 || x >= this.width * this.tileSize || y < 0 || y >= this.height * this.tileSize) {
            return true; // Считаем, что за пределами уровня всё твердое
        }
        const col = Math.floor(x / this.tileSize);
        const row = Math.floor(y / this.tileSize);
        return this.tileData[row * this.width + col] === 1;
    }

    draw(context) {
        context.fillStyle = '#808080'; // Серый цвет для платформ
        this.tiles.forEach(tile => {
            context.fillRect(tile.x, tile.y, tile.width, tile.height);
        });
    }
}
