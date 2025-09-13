export class SaveManager {
    constructor(saveKey = 'chronoPlatformerSave') {
        this.saveKey = saveKey;
    }

    // Сохраняет объект состояния игры
    save(gameState) {
        try {
            const stateString = JSON.stringify(gameState);
            localStorage.setItem(this.saveKey, stateString);
            console.log("Игра сохранена:", gameState);
        } catch (e) {
            console.error("Ошибка при сохранении игры:", e);
        }
    }

    // Загружает объект состояния игры
    load() {
        try {
            const stateString = localStorage.getItem(this.saveKey);
            if (stateString) {
                const gameState = JSON.parse(stateString);
                console.log("Игра загружена:", gameState);
                return gameState;
            }
        } catch (e) {
            console.error("Ошибка при загрузке сохранения:", e);
        }
        // Возвращаем null, если сохранения нет или произошла ошибка
        return null;
    }

    // Очищает сохранение
    clear() {
        localStorage.removeItem(this.saveKey);
        console.log("Сохранение очищено.");
    }
}
