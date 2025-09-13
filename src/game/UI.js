export class UI {
    constructor(game) {
        this.game = game;
        this.fontSize = 24;
        this.fontFamily = 'Helvetica';
        this.isTouchDevice = 'ontouchstart' in window;

        this.buttons = {
            left: { x: 50, y: this.game.height - 90, width: 80, height: 80, key: 'ArrowLeft' },
            right: { x: 150, y: this.game.height - 90, width: 80, height: 80, key: 'ArrowRight' },
            jump: { x: this.game.width - 130, y: this.game.height - 90, width: 80, height: 80, key: 'Space' }
        };
    }

    draw(context) {
        context.save();

        // Отрисовка HUD
        context.fillStyle = 'white';
        context.font = `${this.fontSize}px ${this.fontFamily}`;
        context.textAlign = 'left';
        context.fillText(`Счет: ${this.game.score}`, 20, 30);
        context.textAlign = 'right';
        context.fillText(`Рекорд: ${this.game.highScore}`, this.game.width - 20, 30);

        // Отрисовка мобильных контролов
        if (this.isTouchDevice) {
            this.drawMobileControls(context);
        }

        // Отрисовка экрана "Game Over"
        if (this.game.gameOver) {
            this.drawGameOver(context);
        }

        // Отрисовка таблицы лидеров
        if (this.game.showLeaderboard) {
            this.drawLeaderboard(context);
        }

        context.restore();
    }

    drawMobileControls(context) {
        context.fillStyle = 'rgba(255, 255, 255, 0.3)';
        for (const buttonName in this.buttons) {
            const btn = this.buttons[buttonName];
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
        context.fillText('ИГРА ОКОНЧЕНА', this.game.width / 2, this.game.height / 2 - 40);
        context.font = '20px ' + this.fontFamily;
        context.fillText(`Ваш счет: ${this.game.score}`, this.game.width / 2, this.game.height / 2);
        context.fillText('Нажмите "L" для таблицы лидеров', this.game.width / 2, this.game.height / 2 + 40);
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
