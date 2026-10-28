import Phaser from 'phaser';

export class UIManager {
    private applauseText: Phaser.GameObjects.Text;
    private hypeText: Phaser.GameObjects.Text;
    private actText: Phaser.GameObjects.Text;
    private timerText: Phaser.GameObjects.Text;
    private modeText: Phaser.GameObjects.Text;
    private rhythmFeedbackText: Phaser.GameObjects.Text;

    private beatBars: Phaser.GameObjects.Rectangle[] = [];
    private pauseOverlay: Phaser.GameObjects.Container;

    constructor(private scene: Phaser.Scene) {
        const { width, height } = scene.scale;

        // HUD тексты
        this.applauseText = scene.add.text(28, 24, 'ОВАЦИИ: 0', {
            fontFamily: 'Georgia, serif',
            fontSize: '24px',
            color: '#fef08a',
            fontStyle: 'bold',
        }).setDepth(5);

        this.hypeText = scene.add.text(28, 56, 'СЕРИЯ: x1', {
            fontFamily: 'Georgia, serif',
            fontSize: '18px',
            color: '#f43f5e',
            fontStyle: 'bold',
        }).setDepth(5);

        this.actText = scene.add.text(width / 2, 22, '— АКТ I —', {
            fontFamily: 'Georgia, serif',
            fontSize: '26px',
            color: '#fbbf24',
            fontStyle: 'bold',
        }).setOrigin(0.5, 0).setDepth(5);

        this.timerText = scene.add.text(width - 28, 24, 'ФАЗА 1 • СОФИТЫ: 0/5', {
            fontFamily: 'Georgia, serif',
            fontSize: '20px',
            color: '#fef08a',
            fontStyle: 'bold',
        }).setOrigin(1, 0).setDepth(5);

        this.modeText = scene.add.text(28, height - 30, '[C] РЕЖИМ: ШОУ (ХАРДКОР)', {
            fontFamily: 'Georgia, serif',
            fontSize: '14px',
            color: '#94a3b8',
        }).setDepth(5);

        this.rhythmFeedbackText = scene.add.text(width / 2, height - 60, '', {
            fontFamily: 'Georgia, serif',
            fontSize: '20px',
            fontStyle: 'bold',
            color: '#facc15',
        }).setOrigin(0.5).setDepth(5);

        this.createRhythmMetronome(width, height);
        this.pauseOverlay = this.createPauseOverlay(width, height);
    }

    public updateScore(applause: number, hype: number): void {
        this.applauseText.setText(`ОВАЦИИ: ${applause.toLocaleString()}`);
        this.hypeText.setText(`СЕРИЯ: x${hype}`);
    }

    public updateAct(actRoman: string): void {
        this.actText.setText(`— АКТ ${actRoman} —`);
    }

    public updatePhase(currentStage: number, spotlightsCaught: number): void {
        if (currentStage === 2) {
            this.timerText.setText('ФАЗА 2 • АНШЛАГ!').setColor('#f97316');
        } else {
            this.timerText.setText(`ФАЗА 1 • СОФИТЫ: ${spotlightsCaught}/5`);
        }
    }

    public updateMode(isCasual: boolean): void {
        this.modeText.setText(isCasual ? '[C] РЕЖИМ: РЕПЕТИЦИЯ (КАЗУАЛ)' : '[C] РЕЖИМ: ШОУ (ХАРДКОР)');
        this.modeText.setColor(isCasual ? '#22c55e' : '#94a3b8');
    }

    public updateMetronome(progress: number): void {
        const { width } = this.scene.scale;
        const offset = (1 - progress) * 150;
        this.beatBars[0].x = width / 2 - offset;
        this.beatBars[1].x = width / 2 + offset;
    }

    public showRhythmFeedback(text: string, color: string): void {
        this.rhythmFeedbackText.setText(text).setColor(color).setAlpha(1);
        this.scene.tweens.add({ targets: this.rhythmFeedbackText, alpha: 0, duration: 600 });
    }

    public setPauseVisible(visible: boolean): void {
        this.pauseOverlay.setVisible(visible);
    }

    public showPhase2Alert(): void {
        const { width, height } = this.scene.scale;
        const banner = this.scene.add.text(width / 2, height / 2 - 40, '★ ФАЗА 2: АНШЛАГ! ★\nКРИТИКИ УСКОРЯЮТСЯ', {
            fontFamily: 'Georgia, serif',
            fontSize: '32px',
            color: '#f97316',
            fontStyle: 'bold',
            align: 'center',
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
        this.scene.add.rectangle(width / 2, height / 2, width, height, 0x110206, 0.9).setDepth(20);

        this.scene.add.text(width / 2, height * 0.35, 'ЗАНАВЕС ОПУСКАЕТСЯ', {
            fontFamily: 'Georgia, serif',
            fontSize: '56px',
            color: '#e11d48',
            fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(21);

        this.scene.add.text(width / 2, height * 0.52, `ОВАЦИИ: ${applause}\nЗАВЕРШЕНО: АКТ ${actRoman}`, {
            fontFamily: 'Georgia, serif',
            fontSize: '22px',
            color: '#fef08a',
            align: 'center',
            lineSpacing: 10,
        }).setOrigin(0.5).setDepth(21);

        this.scene.add.text(width / 2, height * 0.72, 'НАЖМИТЕ [ПРОБЕЛ] ЧТОБЫ ПОВТОРИТЬ ШОУ', {
            fontFamily: 'Georgia, serif',
            fontSize: '20px',
            color: '#fbbf24',
            fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(21);
    }

    private createRhythmMetronome(width: number, height: number): void {
        const centerY = height - 26;
        this.scene.add.rectangle(width / 2, centerY, 320, 16, 0x090204, 0.75).setStrokeStyle(1, 0x78350f).setDepth(5);
        this.scene.add.rectangle(width / 2, centerY, 6, 20, 0xfbbf24).setDepth(5);

        const barLeft = this.scene.add.rectangle(width / 2 - 150, centerY, 4, 14, 0xf59e0b).setDepth(5);
        const barRight = this.scene.add.rectangle(width / 2 + 150, centerY, 4, 14, 0xf59e0b).setDepth(5);
        this.beatBars.push(barLeft, barRight);
    }

    private createPauseOverlay(width: number, height: number): Phaser.GameObjects.Container {
        const overlay = this.scene.add.container(width / 2, height / 2);
        const bg = this.scene.add.rectangle(0, 0, width, height, 0x0a0205, 0.85);
        const frame = this.scene.add.rectangle(0, 0, 480, 160, 0x1f070e, 0.95).setStrokeStyle(2, 0xfbbf24);

        const title = this.scene.add.text(0, -30, '— АНТРАКТ —', {
            fontFamily: 'Georgia, serif',
            fontSize: '44px',
            color: '#fbbf24',
            fontStyle: 'bold',
        }).setOrigin(0.5);

        const subtitle = this.scene.add.text(0, 30, 'ШОУ НА ПАУЗЕ\nНажмите [P] или [ESC], чтобы продолжить', {
            fontFamily: 'Georgia, serif',
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