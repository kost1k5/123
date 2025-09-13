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
        gameState: 'playing', // 'playing', 'gameOver', 'enteringName'
        playerName: '',
        showLeaderboard: false,
        leaderboardData: null,
        enemies: [],

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
            await this.assetManager.downloadAll();

            await this.audioManager.loadSounds([
                { name: 'jump', path: 'assets/audio/jump.wav' },
                { name: 'land', path: 'assets/audio/land.wav' }
            ]);

            const entitiesData = await this.level.load('assets/levels/level1.json');
            const playerData = entitiesData.find(e => e.type === 'player');
            const playerSpritesheet = this.assetManager.getAsset('assets/images/player_spritesheet.png');

            this.player = new Player(playerData.x, playerData.y, {
                spritesheet: playerSpritesheet,
                audioManager: this.audioManager,
                timeManager: this.timeManager
            });

            this.playerData = playerData; // Сохраняем для перезапуска
            const enemyData = entitiesData.filter(e => e.type === 'enemy');
            this.enemyData = enemyData; // Сохраняем для перезапуска
            this.enemies = enemyData.map(data => new Enemy(data.x, data.y));


            this.setupEventListeners();
        },

        restart() {
            this.score = 0;
            this.gameState = 'playing';
            this.playerName = '';
            this.showLeaderboard = false;

            this.player = new Player(this.playerData.x, this.playerData.y, {
                spritesheet: this.assetManager.getAsset('assets/images/player_spritesheet.png'),
                audioManager: this.audioManager,
                timeManager: this.timeManager
            });
            this.enemies = this.enemyData.map(data => new Enemy(data.x, data.y));
        },

        setupEventListeners() {
            window.addEventListener('keydown', async (e) => {
                if (this.gameState === 'enteringName') {
                    if (e.key.length === 1 && this.playerName.length < 15) { // Простое добавление символов
                        this.playerName += e.key;
                    } else if (e.code === 'Backspace') {
                        this.playerName = this.playerName.slice(0, -1);
                    } else if (e.code === 'Enter' && this.playerName.length > 0) {
                        await this.leaderboard.submitScore(this.playerName, this.score);
                        this.gameState = 'gameOver';
                        this.playerName = '';
                        this.showLeaderboard = true; // Показываем обновленную таблицу
                        this.leaderboardData = await this.leaderboard.fetchScores();
                    }
                    return;
                }

                if (this.gameState === 'gameOver') {
                    if (e.code === 'Enter') this.restart();
                    if (e.code === 'KeyS' && this.score > 0) this.gameState = 'enteringName';
                    // 'L' для таблицы лидеров обрабатывается ниже
                }

                if (e.code === 'ShiftLeft' && this.gameState === 'playing') {
                    this.audioManager.init();
                    this.timeManager.toggle();
                }
                if (e.code === 'KeyL') {
                    this.showLeaderboard = !this.showLeaderboard;
                    if (this.showLeaderboard) {
                        this.leaderboardData = null; // Показать "Загрузка..."
                        this.leaderboardData = await this.leaderboard.fetchScores();
                    }
                }
            });
            canvas.addEventListener('touchstart', () => this.audioManager.init(), { once: true });
        }
    };

    game.init();
    await game.setup();

    function update(timestep) {
        if (game.gameState !== 'playing' || game.showLeaderboard) return;

        const scaledTimeStep = timestep * game.timeManager.timeScale;
        const playerStatus = game.player.update(scaledTimeStep, game.inputHandler, game.level, game.enemies);
        if (playerStatus.gameOver) {
            game.gameState = 'gameOver';
        }

        // Обновляем врагов и проверяем, были ли они побеждены
        const activeEnemies = [];
        for (const enemy of game.enemies) {
            if (enemy.isActive) {
                enemy.update(scaledTimeStep);
                activeEnemies.push(enemy);
            } else {
                game.score += 100; // Начисляем очки за побежденного врага
            }
        }
        game.enemies = activeEnemies;


        game.score += Math.round(timestep / 100);

        if (game.player.position.y > game.height) {
            game.gameState = 'gameOver';
        }

        if (game.gameState === 'gameOver') {
            if (game.score > game.highScore) {
                game.highScore = game.score;
                game.saveManager.save({ highScore: game.highScore });
            }
        }
    }

    function draw() {
        ctx.clearRect(0, 0, game.width, game.height);
        game.level.draw(ctx);
        game.player.draw(ctx);
        game.enemies.forEach(enemy => enemy.draw(ctx));
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
