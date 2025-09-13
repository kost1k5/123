export class AssetManager {
    constructor() {
        this.cache = {};
        this.downloadQueue = [];
    }

    queueDownload(path) {
        this.downloadQueue.push(path);
    }

    getAsset(path) {
        const asset = this.cache[path];
        if (!asset) {
            console.error(`Asset not found in cache: ${path}`);
        }
        return asset;
    }

    downloadAll() {
        // Если очередь пуста, сразу возвращаем выполненный промис
        if (this.downloadQueue.length === 0) {
            return Promise.resolve();
        }

        const promises = [];
        for (const path of this.downloadQueue) {
            const promise = new Promise((resolve, reject) => {
                const img = new Image();
                img.addEventListener('load', () => {
                    this.cache[path] = img;
                    resolve(img);
                });
                img.addEventListener('error', (err) => {
                    console.error(`Failed to load asset: ${path}`);
                    reject(err);
                });
                img.src = path;
            });
            promises.push(promise);
        }

        // Очищаем очередь после того, как все промисы созданы
        this.downloadQueue = [];

        return Promise.all(promises);
    }
}
