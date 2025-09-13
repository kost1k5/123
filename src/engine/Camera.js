import { Vec2 } from '../utils/Vec2.js';

export class Camera {
    constructor(x, y, width, height) {
        this.position = new Vec2(x, y);
        this.width = width;
        this.height = height;
        this.zoom = 1;
    }

    // Follow a target entity (like the player)
    follow(target, gameWidth, gameHeight) {
        // Smoothly follow the target
        const targetX = target.position.x + target.width / 2 - this.width / 2;
        const targetY = target.position.y + target.height / 2 - this.height / 2;

        // Simple linear interpolation for smooth camera movement
        this.position.x += (targetX - this.position.x) * 0.1;

        // Keep the camera within the bounds of the level if needed (not implemented here for simplicity)
    }

    apply(context) {
        context.translate(-this.position.x, -this.position.y);
    }

    remove(context) {
        context.translate(this.position.x, this.position.y);
    }
}
