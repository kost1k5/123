export class Sprite {
    constructor({
        image,
        frameWidth,
        frameHeight,
        animations = {}
    }) {
        this.image = image;
        this.frameWidth = frameWidth;
        this.frameHeight = frameHeight;
        this.animations = animations;

        this.currentState = Object.keys(animations)[0] || null; // По умолчанию первая анимация
        this.currentFrame = 0;

        this.frameTimer = 0;
        this.animationChanged = false;
    }

    // Устанавливает новое состояние анимации, если оно отличается от текущего
    setState(newState) {
        if (this.currentState !== newState) {
            this.currentState = newState;
            this.currentFrame = 0;
            this.frameTimer = 0;
        }
    }

    update(deltaTime) {
        if (!this.currentState) return;

        const animation = this.animations[this.currentState];
        if (!animation) return;

        this.frameTimer += deltaTime;
        if (this.frameTimer > animation.frameInterval) {
            this.frameTimer = 0;
            this.currentFrame = (this.currentFrame + 1) % animation.frameCount;
        }
    }

    draw(context, x, y) {
        if (!this.image || !this.currentState) return;

        const animation = this.animations[this.currentState];
        if (!animation) return;

        const sx = this.currentFrame * this.frameWidth;
        const sy = animation.row * this.frameHeight;

        context.drawImage(
            this.image,
            sx, sy, this.frameWidth, this.frameHeight,
            x, y, this.frameWidth, this.frameHeight
        );
    }
}
