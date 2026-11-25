import Phaser from 'phaser';
import { GAME_CONFIG } from '../logic/rules';
import { BeatBar } from './BeatBar';

export class UIManager {
    private applauseText: Phaser.GameObjects.Text;
    private actText: Phaser.GameObjects.Text;
    private spotlightsProgressText: Phaser.GameObjects.Text;
    private spotlightsStarsText: Phaser.GameObjects.Text;
    private slowMoBanner: Phaser.GameObjects.Text;
    private modeText: Phaser.GameObjects.Text;
    private rhythmFeedbackText: Phaser.GameObjects.Text;

    private beatBar: BeatBar;
    private pauseOverlay: Phaser.GameObjects.Container;
    private livesText: Phaser.GameObjects.Text;

    private lastPhaseKey = '';
    private lastSlowMoText = '';

    constructor(private scene: Phaser.Scene) {
        const { width, height } = scene.scale;

        this.livesText = scene.add.text(28, 24, '❤️❤️❤️', {
            fontSize: '26px',
        }).setDepth(5);

        this.applauseText = scene.add.text(28, 56, '0 ★  (x1)', {
            fontFamily: "'Jost', sans-serif",
            fontSize: '22px',
            color: '#fef08a',
            fontStyle: 'bold',
        }).setDepth(5);

        // Центр сверху: Акт + наглядные 5 софитов
        this.actText = scene.add.text(width / 2, 22, '— АКТ I —', {
            fontFamily: "'Jost', sans-serif",
            fontSize: '24px',
            color: '#fbbf24',
            fontStyle: 'bold',
        }).setOrigin(0.5, 0).setDepth(5);

        this.spotlightsProgressText = scene.add.text(width / 2, 56, 'СОФИТЫ ДО АНШЛАГА: ☆ ☆ ☆ ☆ ☆', {
            fontFamily: "'Jost', sans-serif",
            fontSize: '15px',
            color: '#fef08a',
            fontStyle: 'bold',
        }).setOrigin(0.5, 0).setDepth(5);

        this.spotlightsStarsText = scene.add.text(width / 2, 70, '', {
            fontFamily: "'Jost', sans-serif",
            fontSize: '40px',
            color: '#fef08a',
            fontStyle: 'bold',
        }).setOrigin(0.5, 0).setDepth(5);

        this.slowMoBanner = scene.add.text(width / 2, 70, '', {
            fontFamily: "'Jost', sans-serif",
            fontSize: '15px',
            color: '#38bdf8',
            fontStyle: 'bold',
        }).setOrigin(0.5, 0).setDepth(5);

        this.modeText = scene.add.text(24, height - 28, '[C] РЕЖИМ: ШОУ (СТАНДАРТ)', {
            fontFamily: "'Jost', sans-serif",
            fontSize: '13px',
            color: '#94a3b8',
        }).setOrigin(0, 0.5).setDepth(5);

        this.rhythmFeedbackText = scene.add.text(width / 2, height - 62, '', {
            fontFamily: "'Jost', sans-serif",
            fontSize: '19px',
            fontStyle: 'bold',
            color: '#facc15',
        }).setOrigin(0.5).setDepth(5);

        // Нижняя ритм-шкала
        this.beatBar = new BeatBar(scene, width / 2, height - 28, 6);

        this.pauseOverlay = this.createPauseOverlay(width, height);
    }

    public updateBeatBar(progress: number, windowRatio: number, inWindow: boolean, isBeat: boolean): void {
        this.beatBar.update(progress, windowRatio, inWindow, isBeat);
    }

    public updateScore(applause: number, hype: number): void {
        this.applauseText.setText(`${applause.toLocaleString()} ★  (x${hype})`);
    }

    public updateAct(actRoman: string): void {
        this.actText.setText(`— АКТ ${actRoman} —`);
    }

    public updatePhase(currentStage: number, spotlightsCaught: number): void {
        const key = `${currentStage}_${spotlightsCaught}`;
        if (key === this.lastPhaseKey) return;
        this.lastPhaseKey = key;

        if (currentStage === 2) {
            this.spotlightsProgressText
                .setText('★ ФАЗА 2: АНШЛАГ! ★')
                .setColor('#f97316');
            this.spotlightsStarsText.setVisible(false); // Прячем звёзды во 2-й фазе!
            this.slowMoBanner.setY(82);
        } else {
            const target = GAME_CONFIG.phase2TargetSpotlights;
            const filled = Math.min(target, spotlightsCaught);
            const stars = Array.from({ length: target }, (_, i) => (i < filled ? '★' : '☆')).join(' ');

            this.spotlightsProgressText
                .setText('СОФИТЫ ДО ФАЗЫ 2:')
                .setColor('#fef08a');
            this.spotlightsStarsText
                .setVisible(true)
                .setText(stars)
                .setColor('#f97316');
            this.slowMoBanner.setY(116); // Сдвигаем слоу-мо ниже звёзд (они на y=70, размер 40px)
        }
    }

    public updateSlowMo(secondsRemaining: number): void {
        const txt = secondsRemaining > 0 ? `⌛ ЗАМЕДЛЕНИЕ: ${secondsRemaining.toFixed(1)}с` : '';
        if (txt === this.lastSlowMoText) return;
        this.lastSlowMoText = txt;
        this.slowMoBanner.setText(txt);
    }

    public updateMode(isCasual: boolean): void {
        this.modeText.setText(isCasual ? '[C] РЕЖИМ: РЕПЕТИЦИЯ (КАЗУАЛ)' : '[C] РЕЖИМ: ШОУ (СТАНДАРТ)');
        this.modeText.setColor(isCasual ? '#22c55e' : '#94a3b8');
    }

    public updateLives(lives: number): void {
        const hearts = '❤️'.repeat(Math.max(0, lives)) + '🖤'.repeat(Math.max(0, GAME_CONFIG.maxLives - lives));
        this.livesText.setText(hearts);

        this.scene.tweens.killTweensOf(this.livesText);
        this.livesText.setScale(1);
        this.scene.tweens.add({
            targets: this.livesText,
            scale: 1.25,
            duration: 110,
            yoyo: true,
        });
    }

    public showFloatingText(x: number, y: number, text: string, color = '#fef08a'): void {
        const popup = this.scene.add.text(x, y - 20, text, {
            fontFamily: "'Jost', sans-serif",
            fontSize: '18px',
            fontStyle: 'bold',
            color,
            stroke: '#000000',
            strokeThickness: 3,
        }).setOrigin(0.5).setDepth(15);

        this.scene.tweens.add({
            targets: popup,
            y: y - 58,
            alpha: 0,
            scale: 1.15,
            duration: 850,
            ease: 'Sine.easeOut',
            onComplete: () => popup.destroy(),
        });
    }

    public showFloatingScore(x: number, y: number, score: number): void {
        this.showFloatingText(x, y, `+${score}`, '#fef08a');
    }

    public showRhythmFeedback(text: string, color: string): void {
        this.scene.tweens.killTweensOf(this.rhythmFeedbackText);
        this.rhythmFeedbackText.setText(text).setColor(color).setAlpha(1);
        this.scene.tweens.add({ targets: this.rhythmFeedbackText, alpha: 0, duration: 600 });
    }

    public setPauseVisible(visible: boolean): void {
        this.pauseOverlay.setVisible(visible);
    }

    public showPhase2Alert(): void {
        const { width, height } = this.scene.scale;
        const banner = this.scene.add.text(width / 2, height / 2 - 40, '★ ФАЗА 2: АНШЛАГ! ★\nКРИТИКИ НАСТУПАЮТ', {
            fontFamily: "'Jost', sans-serif",
            fontSize: '32px',
            color: '#f97316',
            fontStyle: 'bold',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 4,
        }).setOrigin(0.5).setDepth(25);

        this.scene.tweens.add({
            targets: banner,
            scaleX: 1.2,
            scaleY: 1.2,
            alpha: 0,
            duration: 2500,
            onComplete: () => banner.destroy(),
        });
    }

    public showGameOver(applause: number, actRoman: string): void {
        const { width, height } = this.scene.scale;
        this.beatBar.setVisible(false);
        this.scene.add.rectangle(width / 2, height / 2, width, height, 0x110206, 0.9).setDepth(20);

        this.scene.add.text(width / 2, height * 0.35, 'ЗАНАВЕС ОПУСКАЕТСЯ', {
            fontFamily: "'Jost', sans-serif",
            fontSize: '50px',
            color: '#e11d48',
            fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(21);

        this.scene.add.text(width / 2, height * 0.52, `ОВАЦИИ: ${applause}\nЗАВЕРШЕНО: АКТ ${actRoman}`, {
            fontFamily: "'Jost', sans-serif",
            fontSize: '22px',
            color: '#fef08a',
            align: 'center',
            lineSpacing: 10,
        }).setOrigin(0.5).setDepth(21);

        this.scene.add.text(width / 2, height * 0.72, 'НАЖМИТЕ [ПРОБЕЛ] ЧТОБЫ ПОВТОРИТЬ ШОУ', {
            fontFamily: "'Jost', sans-serif",
            fontSize: '18px',
            color: '#fbbf24',
            fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(21);
    }

    private createPauseOverlay(width: number, height: number): Phaser.GameObjects.Container {
        const overlay = this.scene.add.container(width / 2, height / 2);
        const bg = this.scene.add.rectangle(0, 0, width, height, 0x0a0205, 0.85);
        const frame = this.scene.add.rectangle(0, 0, 480, 160, 0x1f070e, 0.95).setStrokeStyle(2, 0xfbbf24);

        const title = this.scene.add.text(0, -30, '— АНТРАКТ —', {
            fontFamily: "'Jost', sans-serif",
            fontSize: '44px',
            color: '#fbbf24',
            fontStyle: 'bold',
        }).setOrigin(0.5);

        const subtitle = this.scene.add.text(0, 30, 'ШОУ НА ПАУЗЕ\nНажмите [P] или [ESC], чтобы продолжить', {
            fontFamily: "'Jost', sans-serif",
            fontSize: '18px',
            color: '#fef08a',
            align: 'center',
            lineSpacing: 8,
        }).setOrigin(0.5);

        overlay.add([bg, frame, title, subtitle]);
        overlay.setDepth(30);
        overlay.setVisible(false);
        return overlay;
    }
}