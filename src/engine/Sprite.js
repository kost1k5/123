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
        if (!animation) return;

        this.frameTimer += deltaTime;
        if (this.frameTimer > animation.frameInterval) {
            this.frameTimer = 0;
            this.currentFrame = (this.currentFrame + 1) % animation.frameCount;
        }
    }

    draw(context, x, y) {
        if (!this.currentState) return;

        const animation = this.animations[this.currentState];
        if (!animation || !animation.image) return;

        const sx = this.currentFrame * this.frameWidth;
        const sy = animation.row * this.frameHeight;

        context.drawImage(
            animation.image,
            sx, sy, this.frameWidth, this.frameHeight,
            x, y, this.frameWidth, this.frameHeight
        );
    }
}
