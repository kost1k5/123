import { Vec2 } from '../utils/Vec2.js';
import { checkAABBCollision } from '../utils/Collision.js';
import { Sprite } from '../engine/Sprite.js';

export class Player {
    constructor(x, y, { spritesheet, audioManager, timeManager }) {
        this.position = new Vec2(x, y);
        this.velocity = new Vec2(0, 0);

        this.width = 32;
        this.height = 64;

        this.isGrounded = false;
        this.wasGrounded = false; // Для отслеживания приземления
        this.facingDirection = 1;

        this.audioManager = audioManager;
        this.timeManager = timeManager;

        // Физические константы
        this.gravity = 980;
        this.moveSpeed = 250;
        this.jumpForce = 500;
        this.maxSpeedX = 300;
        this.terminalVelocityY = 1000;
        this.friction = 0.90;

        this.sprite = new Sprite({
            image: spritesheet,
            frameWidth: this.width,
            frameHeight: this.height,
            animations: {
                idle: { row: 0, frameCount: 4, frameInterval: 200 },
                run: { row: 1, frameCount: 8, frameInterval: 100 },
                jump: { row: 2, frameCount: 1, frameInterval: 100 },
                fall: { row: 3, frameCount: 1, frameInterval: 100 },
            }
        });
    }

    update(deltaTime, input, level) {
        this.wasGrounded = this.isGrounded;
        const dt = deltaTime / 1000;

        // --- Горизонтальное движение ---
        if (input.keys.has('ArrowLeft')) {
            this.velocity.x -= this.moveSpeed * dt;
            this.facingDirection = -1;
        } else if (input.keys.has('ArrowRight')) {
            this.velocity.x += this.moveSpeed * dt;
            this.facingDirection = 1;
        } else {
            this.velocity.x *= this.friction;
            if (Math.abs(this.velocity.x) < 0.1) this.velocity.x = 0;
        }
        this.velocity.x = Math.max(-this.maxSpeedX, Math.min(this.maxSpeedX, this.velocity.x));
        this.position.x += this.velocity.x;
        this.handleCollisions('horizontal', level);

        // --- Вертикальное движение ---
        if ((input.keys.has('ArrowUp') || input.keys.has('Space')) && this.isGrounded) {
            this.velocity.y = -this.jumpForce;
            this.isGrounded = false;
            this.audioManager.playSound('jump', this.timeManager.timeScale);
        }
        this.velocity.y += this.gravity * dt;
        if (this.velocity.y > this.terminalVelocityY) this.velocity.y = this.terminalVelocityY;

        this.isGrounded = false;
        this.position.y += this.velocity.y * dt;
        this.handleCollisions('vertical', level);

        // Проверка приземления
        if (this.isGrounded && !this.wasGrounded) {
            this.audioManager.playSound('land', this.timeManager.timeScale);
        }

        // --- Обновление анимации ---
        this.updateAnimationState();
        this.sprite.update(deltaTime * this.timeManager.timeScale); // Анимация тоже замедляется
    }

    updateAnimationState() {
        if (!this.isGrounded) {
            if (this.velocity.y < 0) {
                this.sprite.setState('jump');
            } else {
                this.sprite.setState('fall');
            }
        } else {
            if (Math.abs(this.velocity.x) > 0.1) {
                this.sprite.setState('run');
            } else {
                this.sprite.setState('idle');
            }
        }
    }

    handleCollisions(axis, level) {
        for (const tile of level.tiles) {
            if (checkAABBCollision(this, tile)) {
                if (axis === 'horizontal') {
                    if (this.velocity.x > 0) this.position.x = tile.x - this.width;
                    else if (this.velocity.x < 0) this.position.x = tile.x + tile.width;
                    this.velocity.x = 0;
                }
                if (axis === 'vertical') {
                    if (this.velocity.y > 0) {
                        this.position.y = tile.y - this.height;
                        this.isGrounded = true;
                    } else if (this.velocity.y < 0) {
                        this.position.y = tile.y + tile.height;
                    }
                    this.velocity.y = 0;
                }
            }
        }
    }

    draw(context) {
        context.save();
        if (this.facingDirection === -1) {
            context.scale(-1, 1);
            this.sprite.draw(context, -this.position.x - this.width, this.position.y);
        } else {
            this.sprite.draw(context, this.position.x, this.position.y);
        }
        context.restore();
    }
}
