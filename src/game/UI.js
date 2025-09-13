export class UI {
    constructor(game) {
        this.game = game;
        this.fontSize = 24;
        this.fontFamily = '"Source Sans Pro", sans-serif';
        this.isTouchDevice = 'ontouchstart' in window;

        this.menuButtons = {
            startGame: { x: this.game.width / 2 - 100, y: this.game.height / 2, width: 200, height: 50, text: 'Начать игру', action: () => this.game.startGame() },
            settings: { x: this.game.width / 2 - 100, y: this.game.height / 2 + 70, width: 200, height: 50, text: 'Настройки', action: () => { this.game.gameState = 'settings'; } }
        };

        this.settingsElements = {
            volumeSlider: { x: this.game.width / 2 - 100, y: this.game.height / 2, width: 200, height: 20 },
            backButton: { x: this.game.width / 2 - 100, y: this.game.height / 2 + 70, width: 200, height: 50, text: 'Назад', action: () => { this.game.gameState = 'mainMenu'; } }
        };

        this.touchControls = {
            left: { x: 50, y: this.game.height - 90, width: 80, height: 80, key: 'ArrowLeft' },
            right: { x: 150, y: this.game.height - 90, width: 80, height: 80, key: 'ArrowRight' },
            jump: { x: this.game.width - 130, y: this.game.height - 90, width: 80, height: 80, key: 'Space' }
        };
    }

    isReady() {
        return true;
    }

    handleMouseClick(x, y) {
        if (this.game.gameState === 'mainMenu') {
            // Check main menu buttons
            for (const key in this.menuButtons) {
                const button = this.menuButtons[key];
                if (x >= button.x && x <= button.x + button.width && y >= button.y && y <= button.y + button.height) {
                    button.action();
                    return; // Exit after one action
                }
            }
        } else if (this.game.gameState === 'settings') {
            // Check settings screen elements
            const backButton = this.settingsElements.backButton;
            if (x >= backButton.x && x <= backButton.x + backButton.width && y >= backButton.y && y <= backButton.y + backButton.height) {
                backButton.action();
                return; // Exit
            }

            const slider = this.settingsElements.volumeSlider;
            if (x >= slider.x && x <= slider.x + slider.width && y >= slider.y && y <= slider.y + slider.height) {
                // Calculate the new volume as a ratio of the click position on the slider
                let newVolume = (x - slider.x) / slider.width;
                // Clamp the value between 0 and 1 to be safe
                newVolume = Math.max(0, Math.min(1, newVolume));
                this.game.audioManager.setVolume(newVolume);
                return; // Exit
            }
        }
    }

    draw(context) {
        context.save();

        if (this.game.gameState === 'mainMenu') {
            this.drawMainMenu(context);
        } else if (this.game.gameState === 'settings') {
            this.drawSettingsMenu(context);
        } else if (this.game.gameState === 'paused') {
            this.drawPauseMenu(context);
        } else if (this.game.gameState === 'gameOver') {
            this.drawGameOver(context);
        } else if (this.game.gameState === 'enteringName') {
            this.drawNameInput(context);
        } else if (this.game.gameState === 'gameWon') {
            this.drawGameWon(context);
        }

        if (this.game.gameState === 'playing') {
            this.drawHUD(context);
            if (this.isTouchDevice) this.drawMobileControls(context);
        }

        if (this.game.showLeaderboard) {
            this.drawLeaderboard(context);
        }

        context.restore();
    }

    drawHUD(context) {
        context.fillStyle = 'white';
        context.font = `${this.fontSize}px ${this.fontFamily}`;
        context.textAlign = 'left';
        context.fillText(`Счет: ${this.game.score}`, 20, 30);
        context.textAlign = 'right';
        context.fillText(`Рекорд: ${this.game.highScore}`, this.game.width - 20, 30);

        // Отображение статуса звука (Mute)
        context.textAlign = 'center';
        const soundStatus = this.game.audioManager.isMuted ? 'Выкл' : 'Вкл';
        context.fillText(`Звук (M): ${soundStatus}`, this.game.width / 2, 30);

        // Индикатор замедления времени
        if (this.game.timeManager.isSlowed) {
            context.fillStyle = 'cyan';
            context.fillText('Slow Motion', this.game.width / 2, 60);
        }
    }

    drawMainMenu(context) {
        context.fillStyle = 'rgba(0, 0, 0, 0.7)';
        context.fillRect(0, 0, this.game.width, this.game.height);

        context.font = `50px ${this.fontFamily}`;
        context.fillStyle = 'white';
        context.textAlign = 'center';
        context.fillText('Хроно-Платформер', this.game.width / 2, this.game.height / 2 - 100);

        context.font = `20px ${this.fontFamily}`;
        for (const key in this.menuButtons) {
            const button = this.menuButtons[key];
            this.drawButton(context, button);
        }

        // Инструкции по управлению
        context.fillStyle = 'rgba(255, 255, 255, 0.7)';
        context.font = `18px ${this.fontFamily}`;
        context.textAlign = 'center';
        context.fillText('Управление: ← → (движение), Пробел (прыжок), C (время), M (звук)', this.game.width / 2, this.game.height - 50);
    }

    drawSettingsMenu(context) {
        context.fillStyle = 'rgba(0, 0, 0, 0.7)';
        context.fillRect(0, 0, this.game.width, this.game.height);

        context.font = `50px ${this.fontFamily}`;
        context.fillStyle = 'white';
        context.textAlign = 'center';
        context.fillText('Настройки', this.game.width / 2, this.game.height / 2 - 100);

        // Volume slider
        context.font = `20px ${this.fontFamily}`;
        context.fillText('Громкость', this.game.width / 2, this.game.height / 2 - 20);
        const slider = this.settingsElements.volumeSlider;
        context.fillStyle = '#555';
        context.fillRect(slider.x, slider.y, slider.width, slider.height);
        context.fillStyle = 'white';
        context.fillRect(slider.x, slider.y, slider.width * this.game.audioManager.volume, slider.height);

        // Back button
        this.drawButton(context, this.settingsElements.backButton);
    }

    drawPauseMenu(context) {
        context.fillStyle = 'rgba(0, 0, 0, 0.5)';
        context.fillRect(0, 0, this.game.width, this.game.height);
        context.font = `50px ${this.fontFamily}`;
        context.fillStyle = 'white';
        context.textAlign = 'center';
        context.fillText('Пауза', this.game.width / 2, this.game.height / 2);
    }

    drawButton(context, button) {
        context.fillStyle = 'white';
        context.fillRect(button.x, button.y, button.width, button.height);
        context.fillStyle = 'black';
        context.textAlign = 'center';
        context.font = `20px ${this.fontFamily}`;
        context.fillText(button.text, button.x + button.width / 2, button.y + button.height / 2 + 8);
    }

    drawMobileControls(context) {
        context.fillStyle = 'rgba(255, 255, 255, 0.3)';
        for (const buttonName in this.touchControls) {
            const btn = this.touchControls[buttonName];
            context.beginPath();
            context.arc(btn.x + btn.width / 2, btn.y + btn.height / 2, btn.width / 2, 0, Math.PI * 2);
            context.fill();
        }
    }

    drawGameOver(context) {
        context.fillStyle = 'rgba(0, 0, 0, 0.7)';
        context.fillRect(0, 0, this.game.width, this.game.height);
        context.fillStyle = 'white';
        context.textAlign = 'center';
        context.font = '40px ' + this.fontFamily;
        context.fillText('ИГРА ОКОНЧЕНА', this.game.width / 2, this.game.height / 2 - 80);
        context.font = '20px ' + this.fontFamily;
        context.fillText(`Ваш счет: ${this.game.score}`, this.game.width / 2, this.game.height / 2 - 20);
        context.fillText(`Рекорд: ${this.game.highScore}`, this.game.width / 2, this.game.height / 2 + 10);

        let yPos = this.game.height / 2 + 50;
        if (this.game.score > 0) {
            context.fillText('Нажмите "S" для отправки рекорда', this.game.width / 2, yPos);
            yPos += 30;
        }
        context.fillText('Нажмите "Enter" для перезапуска', this.game.width / 2, yPos);
        yPos += 30;
        context.fillText('Нажмите "L" для таблицы лидеров', this.game.width / 2, yPos);
    }

    drawGameWon(context) {
        context.fillStyle = 'rgba(0, 0, 0, 0.7)';
        context.fillRect(0, 0, this.game.width, this.game.height);
        context.fillStyle = 'gold';
        context.textAlign = 'center';
        context.font = '40px ' + this.fontFamily;
        context.fillText('ВЫ ПОБЕДИЛИ!', this.game.width / 2, this.game.height / 2 - 40);
        context.font = '20px ' + this.fontFamily;
        context.fillText(`Финальный счет: ${this.game.score}`, this.game.width / 2, this.game.height / 2 + 20);
        context.fillText('Нажмите "Enter" чтобы начать заново', this.game.width / 2, this.game.height / 2 + 60);
    }

    drawNameInput(context) {
        context.fillStyle = 'rgba(0, 0, 0, 0.8)';
        context.fillRect(0, 0, this.game.width, this.game.height);
        context.fillStyle = 'white';
        context.textAlign = 'center';
        context.font = '30px ' + this.fontFamily;
        context.fillText('Введите ваше имя:', this.game.width / 2, this.game.height / 2 - 60);

        const boxX = this.game.width / 2 - 150;
        const boxY = this.game.height / 2 - 25;
        const boxWidth = 300;
        const boxHeight = 50;
        context.strokeStyle = 'white';
        context.lineWidth = 2;
        context.strokeRect(boxX, boxY, boxWidth, boxHeight);

        context.font = '30px ' + this.fontFamily;
        context.textAlign = 'left';
        const cursor = (Math.floor(Date.now() / 500) % 2 === 0) ? '|' : '';
        context.fillText(this.game.playerName + cursor, boxX + 10, boxY + 35);

        context.font = '16px ' + this.fontFamily;
        context.textAlign = 'center';
        context.fillText('Нажмите Enter для подтверждения', this.game.width / 2, this.game.height / 2 + 60);
    }

    drawLeaderboard(context) {
        context.fillStyle = 'rgba(0, 0, 0, 0.8)';
        context.fillRect(0, 0, this.game.width, this.game.height);

        context.fillStyle = 'white';
        context.textAlign = 'center';
        context.font = '30px ' + this.fontFamily;
        context.fillText('Таблица Лидеров', this.game.width / 2, 80);

        if (!this.game.leaderboardData) {
            context.font = '20px ' + this.fontFamily;
            context.fillText('Загрузка...', this.game.width / 2, this.game.height / 2);
            return;
        }

        context.font = '20px ' + this.fontFamily;
        context.textAlign = 'left';
        let yPos = 140;
        this.game.leaderboardData.forEach((entry, index) => {
            context.fillText(`${index + 1}. ${entry.name}`, this.game.width / 2 - 150, yPos);
            context.textAlign = 'right';
            context.fillText(`${entry.score}`, this.game.width / 2 + 150, yPos);
            context.textAlign = 'left';
            yPos += 30;
        });

        context.textAlign = 'center';
        context.font = '16px ' + this.fontFamily;
        context.fillText('Нажмите "L", чтобы закрыть', this.game.width / 2, this.game.height - 40);
    }
}
