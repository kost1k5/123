import { Vec2 } from '../utils/Vec2.js';
import { Sprite } from '../engine/Sprite.js';

export class Enemy {
    constructor(x, y, { spritesheet }) {
        this.position = new Vec2(x, y);
        this.velocity = new Vec2(-50, 0); // Двигаться влево

        this.width = 32;
        this.height = 32;
        this.isActive = true;

        this.startPos = new Vec2(x, y);
        this.moveRange = 100; // Патрулировать на 100px в каждую сторону

        this.sprite = null;
        if (spritesheet) {
            this.sprite = new Sprite({
                image: spritesheet,
                frameWidth: this.width,
                frameHeight: this.height,
                animations: {
                    walk: { row: 0, frameCount: 2, frameInterval: 200 }
                }
            });
            this.sprite.setState('walk');
        }
    }

    update(deltaTime) {
        if (!this.isActive) return;

        const dt = deltaTime / 1000;
        this.position.x += this.velocity.x * dt;

        // Патрулирование
        if (this.position.x < this.startPos.x - this.moveRange) {
            this.position.x = this.startPos.x - this.moveRange;
            this.velocity.x *= -1;
        } else if (this.position.x > this.startPos.x + this.moveRange) {
            this.position.x = this.startPos.x + this.moveRange;
            this.velocity.x *= -1;
        }

        if (this.sprite) {
            this.sprite.update(deltaTime);
        }
    }

    draw(context) {
        if (!this.isActive) return;

        if (this.sprite) {
            context.save();
            // Отражаем спрайт в зависимости от направления
            if (this.velocity.x > 0) {
                context.scale(-1, 1);
                this.sprite.draw(context, -this.position.x - this.width, this.position.y);
            } else {
                this.sprite.draw(context, this.position.x, this.position.y);
            }
            context.restore();
        } else {
            context.fillStyle = 'red';
            context.fillRect(this.position.x, this.position.y, this.width, this.height);
        }
    }
}
