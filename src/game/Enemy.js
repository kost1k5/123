import { Vec2 } from '../utils/Vec2.js';

export class Enemy {
    constructor(x, y) {
        this.position = new Vec2(x, y);
        this.startPos = new Vec2(x, y);
        this.width = 32;
        this.height = 32;
        this.speed = 50;
        this.direction = 1;
        this.moveRange = 100;
        this.isActive = true;
    }

    update(deltaTime) {
        if (!this.isActive) return;

        const dt = deltaTime / 1000;
        this.position.x += this.speed * this.direction * dt;

        // Простое патрулирование
        if (Math.abs(this.position.x - this.startPos.x) >= this.moveRange) {
            this.direction *= -1;
        }
    }

    draw(context) {
        if (!this.isActive) return;
        context.fillStyle = 'red';
        context.fillRect(this.position.x, this.position.y, this.width, this.height);
    }
}
