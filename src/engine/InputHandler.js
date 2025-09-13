export class InputHandler {
    constructor(canvas, ui) {
        this.keys = new Set();
        this.activeTouches = new Map(); // Для отслеживания активных касаний
        this.canvas = canvas;
        this.ui = ui;

        // --- Клавиатура ---
        window.addEventListener('keydown', (e) => {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter', 'ShiftLeft'].includes(e.code)) {
                e.preventDefault();
            }
            this.keys.add(e.code);
        });
        window.addEventListener('keyup', (e) => {
            this.keys.delete(e.code);
        });

        // --- Сенсорное управление ---
        if (this.ui.isTouchDevice) {
            this.canvas.addEventListener('touchstart', (e) => {
                e.preventDefault();
                const rect = this.canvas.getBoundingClientRect();
                for (const touch of e.changedTouches) {
                    const x = (touch.clientX - rect.left) * (this.canvas.width / rect.width);
                    const y = (touch.clientY - rect.top) * (this.canvas.height / rect.height);

                    for (const buttonName in this.ui.touchControls) {
                        const btn = this.ui.touchControls[buttonName];
                        // Простая проверка столкновения точки с кругом
                        const dx = x - (btn.x + btn.width / 2);
                        const dy = y - (btn.y + btn.height / 2);
                        if (dx * dx + dy * dy < (btn.width / 2) * (btn.width / 2)) {
                            // Специальная обработка для прыжка
                            if (btn.key === 'Space') {
                                if (this.ui.game.player) {
                                    this.ui.game.player.jump();
                                }
                            } else {
                                this.keys.add(btn.key);
                            }
                            this.activeTouches.set(touch.identifier, btn.key);
                            break; // Одно касание может активировать только одну кнопку
                        }
                    }
                }
            });

            this.canvas.addEventListener('touchend', (e) => {
                e.preventDefault();
                for (const touch of e.changedTouches) {
                    if (this.activeTouches.has(touch.identifier)) {
                        const key = this.activeTouches.get(touch.identifier);
                        this.keys.delete(key);
                        this.activeTouches.delete(touch.identifier);
                    }
                }
            });
        }
    }
}
