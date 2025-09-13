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

window.addEventListener('load', async function() {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 960;
    canvas.height = 540;

    const game = {
        width: canvas.width,
        height: canvas.height,
        score: 0,
        highScore: 0,
        gameState: 'mainMenu', // 'mainMenu', 'playing', 'paused', 'settings', 'gameOver', 'enteringName', 'gameWon'
        playerName: '',
        showLeaderboard: false,
        leaderboardData: null,
        enemies: [],
        goal: null,
        platforms: [],
        keys: [],
        doors: [],
        particleSystem: null,
        camera: null,
        levels: ['./assets/levels/level1.json', './assets/levels/level2.json'],
        currentLevelIndex: 0,

        init() {
            this.assetManager = new AssetManager();
            this.audioManager = new AudioManager();
            this.timeManager = new TimeManager();
            this.saveManager = new SaveManager();
            this.leaderboard = new Leaderboard();
            this.ui = new UI(this);
            this.inputHandler = new InputHandler(canvas, this.ui);
            this.level = new Level();
            this.particleSystem = new ParticleSystem();
            this.camera = new Camera(0, 0, this.width, this.height);

            const saveData = this.saveManager.load();
            if (saveData && saveData.highScore) this.highScore = saveData.highScore;
        },

        async setup() {
            this.assetManager.queueDownload('./assets/images/enemy_walk.png');
            // Заглушки для кастомных спрайтов игрока
            this.assetManager.queueDownload('./assets/images/player_idle.png');
            this.assetManager.queueDownload('./assets/images/player_run.png');
            this.assetManager.queueDownload('./assets/images/player_jump.png');
            this.assetManager.queueDownload('./assets/images/player_fall.png');
            await this.assetManager.downloadAll();

            // Запускаем загрузку звуков в фоне, не дожидаясь ее завершения,
            // чтобы избежать блокировки на старте из-за политики AudioContext
            this.audioManager.loadSounds([
                { name: 'jump', path: './assets/audio/jump.mp3' },
                { name: 'land', path: './assets/audio/land.mp3' },
                { name: 'enemy_stomp', path: './assets/audio/enemy_stomp.mp3' }
            ]);

            // Не загружаем уровень сразу, ждем начала игры из меню
            this.setupEventListeners();
        },

        async loadLevel(levelIndex) {
            const levelPath = this.levels[levelIndex];
            const levelData = await this.level.load(levelPath);

            const playerData = levelData.entities.find(e => e.type === 'player');
            const playerSpritesheet = this.assetManager.getAsset('./assets/images/player_spritesheet.png');

            // Настраиваем спрайты для игрока.
            const playerSprites = {
                idle: this.assetManager.getAsset('./assets/images/player_idle.png'),
                run: this.assetManager.getAsset('./assets/images/player_run.png'),
                jump: this.assetManager.getAsset('./assets/images/player_jump.png'),
                fall: this.assetManager.getAsset('./assets/images/player_fall.png'),
            };

            this.player = new Player(playerData.x, playerData.y, {
                sprites: playerSprites,
                audioManager: this.audioManager,
                timeManager: this.timeManager,
                particleSystem: this.particleSystem
            });

            const enemyData = levelData.entities.filter(e => e.type === 'enemy');
            const enemySpritesheet = this.assetManager.getAsset('./assets/images/enemy_walk.png');
            this.enemies = enemyData.map(data => new Enemy(data.x, data.y, {
                spritesheet: enemySpritesheet
            }));

            this.platforms = (levelData.movingPlatforms || []).map(data => new MovingPlatform(
                data.x, data.y, data.width, data.height, data.endX, data.endY, data.speed
            ));

            this.keys = (levelData.entities.filter(e => e.type === 'key') || []).map(data => new Key(data.x, data.y));
            this.doors = (levelData.entities.filter(e => e.type === 'door') || []).map(data => new Door(data.x, data.y));

            const goalData = levelData.entities.find(e => e.type === 'goal');
            if (goalData) {
                this.goal = new Goal(goalData.x, goalData.y);
            } else {
                this.goal = null;
            }
        },

        async startGame() {
            if (window.screen && screen.orientation && screen.orientation.lock) {
                try {
                    await screen.orientation.lock('landscape');
                } catch (err) {
                    console.error('Orientation lock failed:', err);
                }
            }

            this.score = 0;
            this.currentLevelIndex = 0;
            await this.loadLevel(this.currentLevelIndex);
            this.gameState = 'playing';
        },

        restart() {
            this.gameState = 'mainMenu';
            this.showLeaderboard = false;
            this.playerName = '';
        },

        setupEventListeners() {
            window.addEventListener('keydown', async (e) => {
                if (this.gameState === 'enteringName') {
                    if (e.key.length === 1 && this.playerName.length < 15) {
                        this.playerName += e.key;
                    } else if (e.code === 'Backspace') {
                        this.playerName = this.playerName.slice(0, -1);
                    } else if (e.code === 'Enter' && this.playerName.length > 0) {
                        await this.leaderboard.submitScore(this.playerName, this.score);
                        this.gameState = 'gameOver';
                        this.playerName = '';
                        this.showLeaderboard = true;
                        this.leaderboardData = await this.leaderboard.fetchScores();
                    }
                    return;
                }

                if (this.gameState === 'gameOver' || this.gameState === 'gameWon') {
                    if (e.code === 'Enter') this.restart();
                }

                if (this.gameState === 'gameOver') {
                    if (e.code === 'KeyS' && this.score > 0) this.gameState = 'enteringName';
                }

                if (e.code === 'Escape') {
                    if (this.gameState === 'playing') {
                        this.gameState = 'paused';
                    } else if (this.gameState === 'paused') {
                        this.gameState = 'playing';
                    }
                }

                if (this.gameState === 'playing') {
                    if (e.code === 'ArrowUp' || e.code === 'Space') {
                        this.player.jump();
                    }
                }

                if (e.code === 'ShiftLeft' && this.gameState === 'playing') {
                    this.audioManager.init();
                    this.timeManager.toggle();
                }
                if (e.code === 'KeyL') {
                    this.showLeaderboard = !this.showLeaderboard;
                    if (this.showLeaderboard) {
                        this.leaderboardData = null;
                        this.leaderboardData = await this.leaderboard.fetchScores();
                    }
                }
            });

            canvas.addEventListener('touchstart', () => this.audioManager.init(), { once: true });
        }
    };

    game.init();
    await game.setup();

    async function update(timestep) {
        if (game.gameState !== 'playing' || game.showLeaderboard) return;

        const scaledTimeStep = timestep * game.timeManager.timeScale;

        game.level.update(scaledTimeStep);
        game.platforms.forEach(p => p.update(scaledTimeStep));
        game.particleSystem.update(scaledTimeStep);

        const playerStatus = game.player.update(scaledTimeStep, game.inputHandler, game.level, game.enemies, game.platforms, game.keys, game.doors);
        if (playerStatus.gameOver) {
            game.gameState = 'gameOver';
        }

        if (game.player) {
            game.camera.follow(game.player, game.width, game.height);
        }

        const activeEnemies = [];
        for (const enemy of game.enemies) {
            if (enemy.isActive) {
                enemy.update(scaledTimeStep);
                activeEnemies.push(enemy);
            } else {
                game.score += 100;
            }
        }
        game.enemies = activeEnemies;

        game.score += Math.round(timestep / 100);

        if (game.player.position.y > game.height) {
            game.gameState = 'gameOver';
        }

        if (game.goal && checkAABBCollision(game.player, game.goal)) {
            game.currentLevelIndex++;
            if (game.currentLevelIndex < game.levels.length) {
                await game.loadLevel(game.currentLevelIndex);
            } else {
                game.gameState = 'gameWon';
            }
        }

        if (game.gameState === 'gameOver' || game.gameState === 'gameWon') {
            if (game.score > game.highScore) {
                game.highScore = game.score;
                game.saveManager.save({ highScore: game.highScore });
            }
        }
    }

    function draw() {
        ctx.clearRect(0, 0, game.width, game.height);

        if (game.gameState !== 'mainMenu' && game.player) {
            // Рисуем фон относительно камеры
            game.level.drawBackground(ctx, game.camera);

            // Смещаем весь мир
            ctx.save();
            game.camera.apply(ctx);

            // Рисуем сам мир
            game.level.drawWorld(ctx);
            game.platforms.forEach(p => p.draw(ctx));
            game.doors.forEach(d => d.draw(ctx));
            game.keys.forEach(k => k.draw(ctx));
            if (game.goal) game.goal.draw(ctx);
            if (game.player) game.player.draw(ctx);
            game.enemies.forEach(enemy => enemy.draw(ctx));
            game.particleSystem.draw(ctx);

            // Возвращаем трансформацию
            ctx.restore();
        }

        // UI рисуется всегда, так как он управляет отображением меню
        game.ui.draw(ctx);
    }

    let lastTime = 0;
    let lag = 0.0;
    const TIMESTEP = 1000 / 60;

    function gameLoop(timestamp) {
        if (!lastTime) lastTime = timestamp;
        const deltaTime = timestamp - lastTime;
        lastTime = timestamp;
        lag += deltaTime;

        while (lag >= TIMESTEP) {
            update(TIMESTEP);
            lag -= TIMESTEP;
        }

        draw();
        requestAnimationFrame(gameLoop);
    }

    requestAnimationFrame(gameLoop);
});
