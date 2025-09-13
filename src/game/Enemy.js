import { Vec2 } from '../utils/Vec2.js';
import { Sprite } from '../engine/Sprite.js';

export class Enemy {
    constructor(x, y, { spritesheet }) {
        this.position = new Vec2(x, y);
        this.startPos = new Vec2(x, y);
        this.width = 32;
        this.height = 32; // Предполагаем, что враг тоже 32x32
        this.speed = 50;
        this.direction = 1;
        this.moveRange = 100;
        this.isActive = true;

        // ЗАМЕЧАНИЕ: Параметры анимации (row, frameCount) здесь являются предположением.
        // Их нужно будет настроить под реальный спрайтшит врага.
        this.sprite = new Sprite({
            image: spritesheet,
            frameWidth: this.width,
            frameHeight: this.height,
            animations: {
                walk: { row: 0, frameCount: 4, frameInterval: 200 }
            }
        });
        this.sprite.setState('walk');
    }

    update(deltaTime) {
        if (!this.isActive) return;

        const dt = deltaTime / 1000;
        this.position.x += this.speed * this.direction * dt;

        if (Math.abs(this.position.x - this.startPos.x) >= this.moveRange) {
            this.direction *= -1;
        }

        this.sprite.update(deltaTime);
    }

    draw(context) {
        if (!this.isActive) return;

        context.save();
        // Отражаем спрайт в зависимости от направления
        if (this.direction === 1) {
            context.scale(-1, 1);
            this.sprite.draw(context, -this.position.x - this.width, this.position.y);
        } else {
            this.sprite.draw(context, this.position.x, this.position.y);
        }
        context.restore();
    }
}
