export class Sprite {
    constructor({
        frameWidth,
        frameHeight,
        animations = {}
    }) {
        this.frameWidth = frameWidth;
        this.frameHeight = frameHeight;
        this.animations = animations;

        this.currentState = Object.keys(animations)[0] || null;
        this.currentFrame = 0;
        this.frameTimer = 0;
    }

    setState(newState) {
        if (this.currentState !== newState && this.animations[newState]) {
            this.currentState = newState;
            this.currentFrame = 0;
            this.frameTimer = 0;
        }
    }

    update(deltaTime) {
        if (!this.currentState) return;

        const animation = this.animations[this.currentState];
        if (!animation || !animation.frameInterval) return;

        this.frameTimer += deltaTime;

        // Используем цикл while вместо if. Это гарантирует, что анимация
        // останется синхронизированной, даже если игра "залагивает" и deltaTime
        // становится очень большим. Анимация просто пропустит несколько кадров,
        // вместо того чтобы замедляться.
        while (this.frameTimer > animation.frameInterval) {
            this.frameTimer -= animation.frameInterval; // Вычитаем интервал, а не обнуляем
            this.currentFrame = (this.currentFrame + 1) % animation.frameCount;
        }
    }

    draw(context, x, y) {
        if (!this.currentState) return;

        const animation = this.animations[this.currentState];
        if (!animation || !animation.image) return;

        const sx = this.currentFrame * this.frameWidth;
        const sy = animation.row * this.frameHeight;

        // Добавлена проверка, чтобы избежать ошибок, если изображение еще не загружено
        if (animation.image.complete && animation.image.naturalHeight !== 0) {
            context.drawImage(
                animation.image,
                sx, sy, this.frameWidth, this.frameHeight,
                x, y, this.frameWidth, this.frameHeight
            );
        }
    }
}
