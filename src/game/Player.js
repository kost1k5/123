import { Vec2 } from '../utils/Vec2.js';
import { checkAABBCollision } from '../utils/Collision.js';
import { Sprite } from '../engine/Sprite.js';

export class Player {
    constructor(x, y, { sprites, audioManager, timeManager, particleSystem }) {
        this.position = new Vec2(x, y);
        this.velocity = new Vec2(0, 0);

        this.width = 32;
        this.height = 64;

        this.isGrounded = false;
        this.wasGrounded = false;
        this.onPlatform = null;
        this.hasKey = false;
        this.facingDirection = 1;

        this.jumps = 0;
        this.maxJumps = 2;
        this.isJumping = false;

        this.audioManager = audioManager;
        this.timeManager = timeManager;
        this.particleSystem = particleSystem;

        // Физические константы
        this.gravity = 980;
        this.moveSpeed = 250; // Возвращаем адекватную скорость
        this.jumpForce = 500;
        this.maxSpeedX = 300;
        this.terminalVelocityY = 1000;
        this.friction = 0.85; // Немного увеличим трение для лучшего контроля

        this.yOffset = -10;
        this.sprite = new Sprite({
            frameWidth: this.width,
            frameHeight: this.height,
            animations: {
                idle: { image: sprites.idle, row: 0, frameCount: 4, frameInterval: 200 },
                run: { image: sprites.run, row: 1, frameCount: 8, frameInterval: 100 },
                jump: { image: sprites.jump, row: 2, frameCount: 1, frameInterval: 100 },
                fall: { image: sprites.fall, row: 3, frameCount: 1, frameInterval: 100 },
            }
        });
    }

    update(deltaTime, input, level, enemies, platforms, keys, doors) {
        this.wasGrounded = this.isGrounded;
        const dt = deltaTime / 1000;

        // --- Обработка ввода ---
        this.handleInput(input);

        // --- Горизонтальное движение и столкновения ---
        this.velocity.x *= this.friction;
        if (Math.abs(this.velocity.x) < 0.1) this.velocity.x = 0;

        // Ограничение скорости
        this.velocity.x = Math.max(-this.maxSpeedX, Math.min(this.maxSpeedX, this.velocity.x));

        this.position.x += this.velocity.x * dt;
        this.handleCollisions('horizontal', level.tiles, doors);

        // --- Вертикальное движение и столкновения ---
        this.velocity.y += this.gravity * dt;
        if (this.velocity.y > this.terminalVelocityY) this.velocity.y = this.terminalVelocityY;

        this.position.y += this.velocity.y * dt;
        this.isGrounded = false; // Сбрасываем перед проверкой
        this.onPlatform = null;

        this.handleCollisions('vertical', level.tiles, doors, platforms);

        // Если стоим на движущейся платформе, двигаемся вместе с ней
        if (this.onPlatform) {
            this.position.x += this.onPlatform.velocity.x * this.onPlatform.direction * dt;
        }

        // Проверка приземления
        if (this.isGrounded && !this.wasGrounded) {
            this.jumps = 0;
            this.audioManager.playSound('land', this.timeManager.timeScale);
            this.emitLandingParticles();
        }

        // Ограничения по границам мира
        this.clampToLevelBounds(level);

        // --- Столкновения с предметами и врагами ---
        this.handleItemCollisions(keys, doors);
        const enemyCollision = this.handleEnemyCollisions(enemies);
        if (enemyCollision.gameOver) {
            return { gameOver: true };
        }

        // --- Обновление анимации ---
        this.updateAnimationState();
        this.sprite.update(deltaTime * this.timeManager.timeScale);
        return { gameOver: false };
    }

    handleInput(input) {
        // Горизонтальное движение
        if (input.keys.has('ArrowLeft')) {
            this.velocity.x = -this.moveSpeed;
            this.facingDirection = -1;
        } else if (input.keys.has('ArrowRight')) {
            this.velocity.x = this.moveSpeed;
            this.facingDirection = 1;
        } else {
            // Применяем трение, только если нет ввода
            this.velocity.x *= this.friction;
        }

        // Прыжок
        const jumpPressed = input.keys.has('Space') || input.keys.has('ArrowUp');
        if (jumpPressed && !this.isJumping) {
            if (this.isGrounded || this.jumps < this.maxJumps) {
                this.jump();
            }
        }
        this.isJumping = jumpPressed;
    }

    jump() {
        this.velocity.y = -this.jumpForce;
        this.isGrounded = false;
        this.onPlatform = null;
        this.jumps++;
        this.audioManager.playSound('jump', this.timeManager.timeScale);
        this.emitJumpParticles();
    }

    handleCollisions(axis, tiles, doors, platforms = []) {
        const allObstacles = [...tiles, ...platforms, ...doors.filter(d => d.isLocked)];

        for (const obstacle of allObstacles) {
            // Пропускаем проверку с платформами при горизонтальном движении
            if (axis === 'horizontal' && platforms.includes(obstacle)) continue;

            if (checkAABBCollision(this, obstacle)) {
                if (axis === 'vertical') {
                    // --- Вертикальные столкновения ---
                    if (this.velocity.y > 0) { // Движемся вниз (падаем)
                        // Проверяем, что игрок действительно приземляется сверху, а не касается сбоку
                        const prevBottom = this.position.y + this.height - (this.velocity.y * (1/60)); // Приблизительная позиция в прошлом кадре
                        if (prevBottom <= obstacle.y) {
                            this.position.y = obstacle.y - this.height;
                            this.velocity.y = 0;
                            this.isGrounded = true;
                            if (platforms.includes(obstacle)) {
                                this.onPlatform = obstacle;
                            }
                        }
                    } else if (this.velocity.y < 0) { // Движемся вверх (прыгаем)
                        this.position.y = obstacle.y + obstacle.height;
                        this.velocity.y = 0;
                    }
                } else if (axis === 'horizontal') {
                    // --- Горизонтальные столкновения ---
                    if (this.velocity.x > 0) { // Движемся вправо
                        this.position.x = obstacle.x - this.width;
                    } else if (this.velocity.x < 0) { // Движемся влево
                        this.position.x = obstacle.x + obstacle.width;
                    }
                    this.velocity.x = 0;
                }
            }
        }
    }

    clampToLevelBounds(level) {
        const levelPixelWidth = level.width * level.tileSize;
        if (this.position.x < 0) {
            this.position.x = 0;
            this.velocity.x = 0;
        } else if (this.position.x + this.width > levelPixelWidth) {
            this.position.x = levelPixelWidth - this.width;
            this.velocity.x = 0;
        }
    }

    updateAnimationState() {
        if (!this.isGrounded) {
            if (this.velocity.y < 0) {
                this.sprite.setState('jump');
            } else {
                this.sprite.setState('fall');
            }
        } else {
            if (Math.abs(this.velocity.x) > 1) { // Используем небольшое пороговое значение
                this.sprite.setState('run');
            } else {
                this.sprite.setState('idle');
            }
        }
    }

    emitLandingParticles() {
        this.particleSystem.emit({
            x: this.position.x + this.width / 2,
            y: this.position.y + this.height,
            count: 8, color: '#D2B48C', speed: 80,
            lifetime: 300, size: 3, gravity: -200
        });
    }

    emitJumpParticles() {
        this.particleSystem.emit({
            x: this.position.x + this.width / 2,
            y: this.position.y + this.height,
            count: 5, color: 'white', speed: 50,
            lifetime: 400, size: 2, gravity: 200
        });
    }

    handleEnemyCollisions(enemies) {
        for (const enemy of enemies) {
            if (!enemy.isActive) continue;
            if (checkAABBCollision(this, enemy)) {
                const isStomping = this.velocity.y > 0 && (this.position.y + this.height) < (enemy.position.y + enemy.height * 0.5);
                if (isStomping) {
                    enemy.isActive = false;
                    this.velocity.y = -this.jumpForce * 0.6;
                    this.audioManager.playSound('enemy_stomp', this.timeManager.timeScale);
                } else {
                    return { gameOver: true };
                }
            }
        }
        return { gameOver: false };
    }

    handleItemCollisions(keys, doors) {
        keys.forEach(key => {
            if (key.isActive && checkAABBCollision(this, key)) {
                key.isActive = false; this.hasKey = true;
            }
        });
        doors.forEach(door => {
            if (door.isLocked && this.hasKey && checkAABBCollision(this, door)) {
                door.isLocked = false; this.hasKey = false;
            }
        });
    }

    draw(context) {
        const drawX = this.position.x;
        const drawY = this.position.y + this.yOffset;

        context.save();
        if (this.facingDirection === -1) {
            context.scale(-1, 1);
            this.sprite.draw(context, -drawX - this.width, drawY);
        } else {
            this.sprite.draw(context, drawX, drawY);
        }
        context.restore();
    }
}
