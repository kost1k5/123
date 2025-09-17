import { Vec2 } from '../utils/Vec2.js';
import { checkAABBCollision } from '../utils/Collision.js';
import { Sprite } from '../engine/Sprite.js';
import { Logger } from '../utils/Logger.js';

export class Player {
    constructor(x, y, { sprites, audioManager, timeManager, particleSystem, logger }) {
        this.logger = logger || new Logger('Player-Default');
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
        this.moveSpeed = 250;
        this.jumpForce = 500;
        this.maxSpeedX = 300;
        this.terminalVelocityY = 1000;
        this.friction = 0.85;

        // Рекомендация пользователя: установить yOffset в 0 для отладки
        this.yOffset = 0;
        this.sprite = new Sprite({
            frameWidth: this.width,
            frameHeight: this.height,
            animations: {
                idle: { image: sprites.idle, row: 0, frameCount: 4, frameInterval: 200 },
                run: { image: sprites.run, row: 0, frameCount: 8, frameInterval: 100 },
                jump: { image: sprites.jump, row: 0, frameCount: 1, frameInterval: 100 },
                fall: { image: sprites.fall, row: 0, frameCount: 1, frameInterval: 100 },
            }
        });
    }

    update(deltaTime, input, level, enemies, platforms, keys, doors) {
        this.wasGrounded = this.isGrounded;
        const dt = deltaTime / 1000;

        this.logger.debug(`Update Start: Pos=(${this.position.x.toFixed(2)}, ${this.position.y.toFixed(2)}), Vel=(${this.velocity.x.toFixed(2)}, ${this.velocity.y.toFixed(2)}), Grounded=${this.isGrounded}`);

        this.handleInput(input);

        // --- Горизонтальное движение и столкновения ---
        if (Math.abs(this.velocity.x) < 0.1) this.velocity.x = 0;
        this.velocity.x = Math.max(-this.maxSpeedX, Math.min(this.maxSpeedX, this.velocity.x));
        this.position.x += this.velocity.x * dt;
        // ИСПРАВЛЕНО: Передаем реальное время кадра (dt) для точных столкновений
        this.handleCollisions('horizontal', level.tiles, doors, platforms, dt);

        // --- Вертикальное движение и столкновения ---
        if (!this.isGrounded) {
            this.velocity.y += this.gravity * dt;
        }
        if (this.velocity.y > this.terminalVelocityY) this.velocity.y = this.terminalVelocityY;
        this.position.y += this.velocity.y * dt;
        this.isGrounded = false;
        this.onPlatform = null;
        // ИСПРАВЛЕНО: Передаем dt
        this.handleCollisions('vertical', level.tiles, doors, platforms, dt);

        if (this.onPlatform) {
            this.position.x += this.onPlatform.velocity.x * this.onPlatform.direction * dt;
        }

        if (this.isGrounded && !this.wasGrounded) {
            this.jumps = 0;
            this.audioManager.playSound('land', this.timeManager.timeScale);
            this.emitLandingParticles();
        }

        // ИСПРАВЛЕНО: Проверка падения за пределы мира
        if (this.clampAndCheckBounds(level)) {
            return { gameOver: true }; // Игрок упал -> Конец игры
        }

        this.handleItemCollisions(keys, doors);
        const enemyCollision = this.handleEnemyCollisions(enemies);
        if (enemyCollision.gameOver) {
            return { gameOver: true };
        }

        // --- Обновление анимации ---
        this.updateAnimationState();
        // ИСПРАВЛЕНО: Используем чистое deltaTime, чтобы анимация игрока не замедлялась
        this.sprite.update(deltaTime);
        return { gameOver: false };
    }

    handleInput(input) {
        if (input.keys.has('ArrowLeft')) {
            this.velocity.x = -this.moveSpeed;
            this.facingDirection = -1;
        } else if (input.keys.has('ArrowRight')) {
            this.velocity.x = this.moveSpeed;
            this.facingDirection = 1;
        } else {
            this.velocity.x *= this.friction;
        }

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

    // ИСПРАВЛЕНО: Добавляем параметр dt (с безопасным значением по умолчанию)
    handleCollisions(axis, tiles, doors, platforms = [], dt = 1/60) {
        const allObstacles = [...tiles, ...platforms, ...doors.filter(d => d.isLocked)];

        for (const obstacle of allObstacles) {
            if (axis === 'horizontal' && platforms.includes(obstacle)) continue;

            const playerBox = { x: this.position.x, y: this.position.y, width: this.width, height: this.height };
            const obstacleBox = { x: obstacle.x, y: obstacle.y, width: obstacle.width, height: obstacle.height };
            const didCollide = checkAABBCollision(playerBox, obstacle);

            // Log verbosely for vertical collisions near the player's feet
            if (axis === 'vertical' && Math.abs(playerBox.y + playerBox.height - obstacleBox.y) < 50) {
                 this.logger.debug(`Collision Check (Vertical): Player=${JSON.stringify(playerBox)}, Obstacle=${JSON.stringify(obstacleBox)}, Result=${didCollide}`);
            }

            if (didCollide) {
                if (axis === 'vertical') {
                    this.logger.debug(`Vertical collision detected with obstacle at (${obstacle.x}, ${obstacle.y})`);
                    // --- Вертикальные столкновения ---
                    if (this.velocity.y >= 0) { // Движемся вниз (падаем) или стоим на месте
                        // ИСПРАВЛЕНО: Используем реальное dt для расчета предыдущей позиции
                        const prevBottom = this.position.y + this.height - (this.velocity.y * dt);
                        // Добавляем небольшой допуск (0.1) для стабильности
                        if (prevBottom <= obstacle.y + 0.1) {
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

    // ИСПРАВЛЕНО: Переименовано из clampToLevelBounds и добавлена проверка падения
    clampAndCheckBounds(level) {
        const levelPixelWidth = level.width * level.tileSize;
        const levelPixelHeight = level.height * level.tileSize; // Добавлено

        // Горизонтальные ограничения (как было)
        if (this.position.x < 0) {
            this.position.x = 0;
            this.velocity.x = 0;
        } else if (this.position.x + this.width > levelPixelWidth) {
            this.position.x = levelPixelWidth - this.width;
            this.velocity.x = 0;
        }

        // Вертикальная проверка (Kill Plane)
        // Если игрок упал ниже уровня (с запасом в 200px)
        if (this.position.y > levelPixelHeight + 200) {
            return true; // Game Over
        }
        return false;
    }

    updateAnimationState() {
        const oldState = this.sprite.currentState;
        let newState = oldState;

        if (!this.isGrounded) {
            if (this.velocity.y < 0) {
                newState = 'jump';
            } else {
                newState = 'fall';
            }
        } else {
            if (Math.abs(this.velocity.x) > 1) {
                newState = 'run';
            } else {
                newState = 'idle';
            }
        }

        if (newState !== oldState) {
            this.logger.info(`Animation state change: ${oldState} -> ${newState}`);
            this.sprite.setState(newState);
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
