export class AudioManager {
    constructor() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.gainNode = this.audioContext.createGain();
        this.gainNode.connect(this.audioContext.destination);
        this.audioCache = {};
        this.isUnlocked = false;
        this.volume = 1.0;
        this.isMuted = false;
        this.volumeBeforeMute = 1.0;
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.isMuted) {
            this.volumeBeforeMute = this.volume;
            this.setVolume(0);
        } else {
            this.setVolume(this.volumeBeforeMute);
        }
    }

    // Этот метод нужно вызвать по первому действию пользователя (клик, нажатие клавиши)
    init() {
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        this.isUnlocked = true;
    }

    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume)); // Ограничиваем от 0 до 1
        if (this.gainNode) {
            this.gainNode.gain.setValueAtTime(this.volume, this.audioContext.currentTime);
        }
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
            return null;
        }
    }

    async loadSounds(sounds) {
        const promises = sounds.map(sound => this.loadSound(sound.name, sound.path));
        // Используем allSettled, чтобы одна неудачная загрузка не прервала все остальные.
        await Promise.allSettled(promises);
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
        source.connect(this.gainNode); // Подключаем к GainNode, а не к destination
        source.start(0);
    }
}
