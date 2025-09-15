import { InputHandler } from './engine/InputHandler.js';
import { Player } from './game/Player.js';
import { Enemy } from './game/Enemy.js';
import { Level } from './game/Level.js';
import { AssetManager } from './engine/AssetManager.js';
import { TimeManager } from './engine/TimeManager.js';
import { AudioManager } from './engine/AudioManager.js';
import { UI } from './game/UI.js';
import { SaveManager } from './engine/SaveManager.js';
import { Leaderboard } from './game/Leaderboard.js';
import { Goal } from './game/Goal.js';
import { MovingPlatform } from './game/MovingPlatform.js';
import { Key } from './game/Key.js';
import { Door } from './game/Door.js';
import { ParticleSystem } from './engine/ParticleSystem.js';
import { Camera } from './engine/Camera.js';
import { checkAABBCollision } from './utils/Collision.js';

window.addEventListener('load', function() {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 960;
    canvas.height = 540;

    const game = {
        width: canvas.width,
        height: canvas.height,
        score: 0,
        highScore: 0,
        gameState: 'loading', // 'loading', 'mainMenu', 'playing', 'paused', 'gameOver', ...

        // Инициализация основных модулей
        init() {
            this.assetManager = new AssetManager();
            this.audioManager = new AudioManager();
            this.timeManager = new TimeManager();
            this.saveManager = new SaveManager();
            this.leaderboard = new Leaderboard();
            this.camera = new Camera(this.width, this.height);
            this.particleSystem = new ParticleSystem();
            this.level = new Level();
            this.ui = new UI(this);
            this.inputHandler = new InputHandler(canvas, this.ui); // UI передается сразу

            const saveData = this.saveManager.load();
            if (saveData && saveData.highScore) this.highScore = saveData.highScore;

            this.setupEventListeners();
        },

        // Загрузка всех ресурсов
        loadAssets() {
            this.gameState = 'loading';
            // Изображения
            this.assetManager.queueImage('player_idle', './assets/images/player_idle.png');
            this.assetManager.queueImage('player_run', './assets/images/player_run.png');
            this.assetManager.queueImage('player_jump', './assets/images/player_jump.png');
            this.assetManager.queueImage('player_fall', './assets/images/player_fall.png');
            this.assetManager.queueImage('enemy_walk', './assets/images/enemy_walk.png');

            // Звуки (загрузка в фоне)
            this.audioManager.loadSounds([
                { name: 'jump', path: './assets/audio/jump.mp3' },
                { name: 'land', path: './assets/audio/land.mp3' },
                { name: 'enemy_stomp', path: './assets/audio/enemy_stomp.mp3' }
            ]);

            // Запускаем загрузку и переходим к инициализации игры после завершения
            this.assetManager.loadAll(() => this.setupGame());
        },

        // Настройка игровой сессии после загрузки ресурсов
        async setupGame() {
            this.gameState = 'mainMenu';
            // Теперь игра готова к запуску из меню
        },

        async startGame() {
            if (this.gameState === 'playing') return;

            if (window.screen && screen.orientation && screen.orientation.lock) {
                try { await screen.orientation.lock('landscape'); } catch (err) { console.error('Orientation lock failed:', err); }
            }

            this.score = 0;
            this.currentLevelIndex = 0;
            await this.loadLevel(this.currentLevelIndex);
            this.gameState = 'playing';
        },

        async loadLevel(levelIndex) {
            const levelPath = ['./assets/levels/level1.json', './assets/levels/level2.json'][levelIndex];
            const levelData = await this.level.load(levelPath);

            const playerSprites = {
                idle: this.assetManager.getImage('player_idle'),
                run: this.assetManager.getImage('player_run'),
                jump: this.assetManager.getImage('player_jump'),
                fall: this.assetManager.getImage('player_fall'),
            };

            const playerData = levelData.entities.find(e => e.type === 'player');
            this.player = new Player(playerData.x, playerData.y, {
                sprites: playerSprites,
                audioManager: this.audioManager,
                timeManager: this.timeManager,
                particleSystem: this.particleSystem
            });

            const enemySpritesheet = this.assetManager.getImage('enemy_walk');
            this.enemies = (levelData.entities.filter(e => e.type === 'enemy') || []).map(data => new Enemy(data.x, data.y, { spritesheet: enemySpritesheet }));
            this.platforms = (levelData.movingPlatforms || []).map(data => new MovingPlatform(data.x, data.y, data.width, data.height, data.endX, data.endY, data.speed));
            this.keys = (levelData.entities.filter(e => e.type === 'key') || []).map(data => new Key(data.x, data.y));
            this.doors = (levelData.entities.filter(e => e.type === 'door') || []).map(data => new Door(data.x, data.y));
            const goalData = levelData.entities.find(e => e.type === 'goal');
            this.goal = goalData ? new Goal(goalData.x, goalData.y) : null;
        },

        update(rawDeltaTime) {
            if (this.gameState !== 'playing') return;

            // --- Механика Времени ---
            const slowMoActive = this.inputHandler.keys.has('ShiftLeft') || this.inputHandler.keys.has('ShiftRight');
            this.timeManager.setTimeScale(slowMoActive ? 0.3 : 1.0);
            const scaledDeltaTime = rawDeltaTime * this.timeManager.timeScale;

            // --- Обновления ---
            // Игрок обновляется с ЧИСТЫМ временем
            const playerStatus = this.player.update(rawDeltaTime, this.inputHandler, this.level, this.enemies, this.platforms, this.keys, this.doors);
            if (playerStatus.gameOver) {
                this.gameState = 'gameOver';
                return;
            }

            // Мир обновляется с МАСШТАБИРОВАННЫМ временем
            this.level.update(scaledDeltaTime);
            this.enemies.forEach(e => e.update(scaledDeltaTime));
            this.platforms.forEach(p => p.update(scaledDeltaTime));
            this.particleSystem.update(scaledDeltaTime);

            // Камера обновляется ПОСЛЕ движения игрока
            const levelPixelWidth = this.level.width * this.level.tileSize;
            const levelPixelHeight = this.level.height * this.level.tileSize;
            this.camera.follow(this.player, levelPixelWidth, levelPixelHeight);

            // Проверка цели
            if (this.goal && checkAABBCollision(this.player, this.goal)) {
                this.currentLevelIndex++;
                if (this.currentLevelIndex < 2) { // Assuming 2 levels
                    this.loadLevel(this.currentLevelIndex);
                } else {
                    this.gameState = 'gameWon';
                }
            }
        },

        draw() {
            ctx.clearRect(0, 0, this.width, this.height);

            if (this.gameState === 'playing' || this.gameState === 'paused' || this.gameState === 'gameOver' || this.gameState === 'gameWon') {
                 // 1. Рисуем фон
                this.level.drawBackground(ctx, this.camera);
                // 2. Применяем камеру
                ctx.save();
                this.camera.apply(ctx);
                // 3. Рисуем мир
                this.level.drawWorld(ctx);
                this.platforms.forEach(p => p.draw(ctx));
                this.doors.forEach(d => d.draw(ctx));
                this.keys.forEach(k => k.draw(ctx));
                if (this.goal) this.goal.draw(ctx);
                this.enemies.forEach(enemy => enemy.draw(ctx));
                this.player.draw(ctx);
                this.particleSystem.draw(ctx);
                // 4. Восстанавливаем контекст
                ctx.restore();
            }

            // 5. Рисуем UI поверх всего
            this.ui.draw(ctx);
        },

        setupEventListeners() {
            // ... (event listener logic remains largely the same, but simplified for brevity)
            window.addEventListener('keydown', (e) => {
                 if (e.code === 'Escape' && (this.gameState === 'playing' || this.gameState === 'paused')) {
                    this.gameState = this.gameState === 'playing' ? 'paused' : 'playing';
                }
            });
        }
    };

    // --- Основной игровой цикл ---
    let lastTime = 0;
    function gameLoop(timestamp) {
        // Инициализируем lastTime на первом кадре, чтобы избежать огромного deltaTime
        if (lastTime === 0) {
            lastTime = timestamp;
            requestAnimationFrame(gameLoop);
            return;
        }

        const rawDeltaTime = timestamp - lastTime;
        lastTime = timestamp;

        // Не обновляем логику если игра не в фокусе или на паузе
        if (game.gameState === 'playing') {
            game.update(rawDeltaTime);
        } else if (game.gameState === 'gameOver') {
            if (game.inputHandler.keys.has('Enter')) {
                game.inputHandler.keys.delete('Enter'); // Сразу удаляем, чтобы не было многократного срабатывания
                game.startGame();
            }
        }

        game.draw();
        requestAnimationFrame(gameLoop);
    }

    // --- Запуск игры ---
    game.init();
    game.loadAssets(); // Начинаем загрузку, которая вызовет setupGame и запустит цикл
    requestAnimationFrame(gameLoop);
});
