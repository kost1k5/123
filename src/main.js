import { InputHandler } from './engine/InputHandler.js';
import { Player } from './game/Player.js';
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
        gameOver: false,
        showLeaderboard: false,
        leaderboardData: null,

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

            this.setupEventListeners();
        },

        setupEventListeners() {
            window.addEventListener('keydown', async (e) => {
                if (e.code === 'ShiftLeft') {
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
        if (game.gameOver || game.showLeaderboard) return;

        const scaledTimeStep = timestep * game.timeManager.timeScale;
        game.player.update(scaledTimeStep, game.inputHandler, game.level);
        game.score += Math.round(timestep / 100);

        if (game.player.position.y > game.height) {
            game.gameOver = true;
            if (game.score > game.highScore) {
                game.highScore = game.score;
                game.saveManager.save({ highScore: game.highScore });
            }
            // Автоматическая отправка рекорда
            game.leaderboard.submitScore('Player', game.score);
        }
    }

    function draw() {
        ctx.clearRect(0, 0, game.width, game.height);
        game.level.draw(ctx);
        game.player.draw(ctx);
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
