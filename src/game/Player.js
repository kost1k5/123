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
        this.wasGrounded = false; // Для отслеживания приземления
        this.onPlatform = null; // Платформа, на которой стоит игрок
        this.hasKey = false;
        this.facingDirection = 1;

        this.jumps = 0;
        this.maxJumps = 2; // Это будет проигнорировано для бесконечного прыжка
        this.isJumping = false; // Флаг для отслеживания состояния нажатия клавиши прыжка

        this.audioManager = audioManager;
        this.timeManager = timeManager;
        this.particleSystem = particleSystem;

        // Физические константы
        this.gravity = 980;
        this.moveSpeed = 85; // Уменьшено по просьбе пользователя (было 250)
        this.jumpForce = 500;
        this.maxSpeedX = 300;
        this.terminalVelocityY = 1000;
        this.friction = 0.90;

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

        // --- Обработка прыжка ---
        const jumpPressed = input.keys.has('Space') || input.keys.has('ArrowUp');
        if (jumpPressed && !this.isJumping) {
            this.jump();
        }
        this.isJumping = jumpPressed;


        // Если стоим на платформе, двигаемся вместе с ней
        if (this.onPlatform) {
            this.position.x += this.onPlatform.velocity.x * this.onPlatform.direction * dt;
        }

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
        this.position.x += this.velocity.x * dt; // Упс, здесь не хватало dt
        this.handleCollisions('horizontal', level);

        // --- Ограничения по границам мира ---
        const levelPixelWidth = level.width * level.tileSize;
        if (this.position.x < 0) {
            this.position.x = 0;
            this.velocity.x = 0;
        } else if (this.position.x > levelPixelWidth - this.width) {
            this.position.x = levelPixelWidth - this.width;
            this.velocity.x = 0;
        }


        // --- Вертикальное движение ---
        this.velocity.y += this.gravity * dt;
        if (this.velocity.y > this.terminalVelocityY) this.velocity.y = this.terminalVelocityY;

        this.isGrounded = false;
        this.onPlatform = null; // Сбрасываем платформу каждый кадр
        this.position.y += this.velocity.y * dt;
        this.handleCollisions('vertical', level, platforms, doors);

        // Проверка приземления
        if (this.isGrounded && !this.wasGrounded) {
            this.jumps = 0;
            this.audioManager.playSound('land', this.timeManager.timeScale);
            // Эффект приземления
            this.particleSystem.emit({
                x: this.position.x + this.width / 2,
                y: this.position.y + this.height,
                count: 8,
                color: '#D2B48C', // Tan
                speed: 80,
                lifetime: 300,
                size: 3,
                gravity: -200 // Частицы летят вверх
            });
        }

        // --- Столкновения с предметами и врагами ---
        this.handleItemCollisions(keys, doors);
        const enemyCollision = this.handleEnemyCollisions(enemies);
        if (enemyCollision.gameOver) {
            return { gameOver: true };
        }

        // --- Обновление анимации ---
        this.updateAnimationState();
        this.sprite.update(deltaTime * this.timeManager.timeScale); // Анимация тоже замедляется
        return { gameOver: false };
    }

    jump() {
        // Убрано ограничение на количество прыжков по просьбе пользователя
        this.velocity.y = -this.jumpForce;
        this.isGrounded = false;
        // this.jumps++; // Счетчик больше не нужен в контексте бесконечных прыжков
        this.audioManager.playSound('jump', this.timeManager.timeScale);
        // Эффект прыжка
        this.particleSystem.emit({
            x: this.position.x + this.width / 2,
            y: this.position.y + this.height,
            count: 5,
            color: 'white',
            speed: 50,
            lifetime: 400,
            size: 2,
            gravity: 200 // Частицы падают вниз
        });
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

    handleEnemyCollisions(enemies) {
        for (const enemy of enemies) {
            if (!enemy.isActive) continue;

            if (checkAABBCollision(this, enemy)) {
                // Проверяем, что игрок падает и находится выше врага (прыжок сверху)
                const isStomping = this.velocity.y > 0 &&
                                   (this.position.y + this.height) < (enemy.position.y + enemy.height / 2);

                if (isStomping) {
                    enemy.isActive = false;
                    this.velocity.y = -this.jumpForce * 0.6; // Отскок
                    this.audioManager.playSound('enemy_stomp', this.timeManager.timeScale);
                } else {
                    // Столкновение сбоку или снизу
                    return { gameOver: true };
                }
            }
        }
        return { gameOver: false };
    }

    handleItemCollisions(keys, doors) {
        // Сбор ключей
        for (const key of keys) {
            if (key.isActive && checkAABBCollision(this, key)) {
                key.isActive = false;
                this.hasKey = true;
                // Тут можно добавить звук подбора ключа
            }
        }

        // Открытие дверей
        for (const door of doors) {
            if (door.isLocked && this.hasKey && checkAABBCollision(this, door)) {
                door.isLocked = false;
                this.hasKey = false; // Ключ используется
                // Тут можно добавить звук открытия двери
            }
        }
    }

    handleCollisions(axis, level, platforms, doors) {
        // Столкновения с тайлами уровня
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
                        this.velocity.y = 0;

                        // Если тайл разрушаемый, запускаем процесс
                        if (tile.type === 2 && tile.state === 'idle') {
                            tile.state = 'crumbling';
                        }
                    } else if (this.velocity.y < 0) {
                        this.position.y = tile.y + tile.height;
                        this.velocity.y = 0;
                    }
                }
            }
        }

        // Столкновения с движущимися платформами
        if (axis === 'vertical') {
            for (const platform of platforms) {
                if (checkAABBCollision(this, platform)) {
                    // Условие: игрок падает (velocity.y > 0) и его ноги находятся чуть выше центра платформы
                    const isLandingOnTop = this.velocity.y > 0 && (this.position.y + this.height) < (platform.position.y + platform.height);
                    if (isLandingOnTop) {
                        this.position.y = platform.position.y - this.height;
                        this.isGrounded = true;
                        this.onPlatform = platform;
                        this.velocity.y = 0;
                    }
                }
            }
        }

        // Столкновения с запертыми дверями
        for (const door of doors) {
            if (door.isLocked && checkAABBCollision(this, door)) {
                 if (axis === 'horizontal') {
                    if (this.velocity.x > 0) this.position.x = door.position.x - this.width;
                    else if (this.velocity.x < 0) this.position.x = door.position.x + door.width;
                    this.velocity.x = 0;
                }
                // Вертикальные столкновения с дверью обычно не нужны, если она стоит на земле
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
