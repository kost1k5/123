export class AudioManager {
    constructor() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.audioCache = {};
        this.isUnlocked = false;
    }

    // Этот метод нужно вызвать по первому действию пользователя (клик, нажатие клавиши)
    init() {
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        this.isUnlocked = true;
    }

    async loadSound(name, path) {
        if (this.audioCache[name]) {
            return this.audioCache[name];
        }
        try {
            const response = await fetch(path);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} for path ${path}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            this.audioCache[name] = audioBuffer;
            return audioBuffer;
        } catch (e) {
            console.error(`Failed to load sound: ${name} from ${path}`, e);
            // Возвращаем null или кидаем ошибку, чтобы вызывающий код мог это обработать
            return null;
        }
    }

    async loadSounds(sounds) {
        const promises = sounds.map(sound => this.loadSound(sound.name, sound.path));
        await Promise.all(promises);
    }

    playSound(name, playbackRate = 1.0) {
        if (!this.isUnlocked) return;

        const audioBuffer = this.audioCache[name];
        if (!audioBuffer) {
            console.warn(`Sound not found in cache: ${name}`);
            return;
        }

        const source = this.audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.playbackRate.value = playbackRate;
        source.connect(this.audioContext.destination);
        source.start(0);
    }
}
