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
        levels: ['assets/levels/level1.json', 'assets/levels/level2.json'],
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

            const saveData = this.saveManager.load();
            if (saveData && saveData.highScore) this.highScore = saveData.highScore;
        },

        async setup() {
            this.assetManager.queueDownload('assets/images/player_spritesheet.png');
            this.assetManager.queueDownload('assets/images/enemy_walk.png');
            await this.assetManager.downloadAll();

            await this.audioManager.loadSounds([
                { name: 'jump', path: 'assets/audio/jump.wav' },
                { name: 'land', path: 'assets/audio/land.wav' },
                { name: 'enemy_stomp', path: 'assets/audio/enemy_stomp.mp3' }
            ]);

            // Не загружаем уровень сразу, ждем начала игры из меню
            this.setupEventListeners();
        },

        async loadLevel(levelIndex) {
            const levelPath = this.levels[levelIndex];
            const entitiesData = await this.level.load(levelPath);

            const playerData = entitiesData.find(e => e.type === 'player');
            const playerSpritesheet = this.assetManager.getAsset('assets/images/player_spritesheet.png');
            this.player = new Player(playerData.x, playerData.y, {
                spritesheet: playerSpritesheet,
                audioManager: this.audioManager,
                timeManager: this.timeManager
            });

            const enemyData = entitiesData.filter(e => e.type === 'enemy');
            const enemySpritesheet = this.assetManager.getAsset('assets/images/enemy_walk.png');
            this.enemies = enemyData.map(data => new Enemy(data.x, data.y, {
                spritesheet: enemySpritesheet
            }));

            const goalData = entitiesData.find(e => e.type === 'goal');
            if (goalData) {
                this.goal = new Goal(goalData.x, goalData.y);
            } else {
                this.goal = null;
            }
        },

        async startGame() {
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

            canvas.addEventListener('click', (e) => {
                if (this.ui.isReady()) {
                    this.ui.handleMouseClick(e.offsetX, e.offsetY);
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
        const playerStatus = game.player.update(scaledTimeStep, game.inputHandler, game.level, game.enemies);
        if (playerStatus.gameOver) {
            game.gameState = 'gameOver';
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

        // Рисуем игровой мир только если мы не в главном меню
        if (game.gameState !== 'mainMenu') {
            game.level.draw(ctx);
            if (game.goal) game.goal.draw(ctx);
            if (game.player) game.player.draw(ctx); // Проверяем, что игрок создан
            game.enemies.forEach(enemy => enemy.draw(ctx));
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
