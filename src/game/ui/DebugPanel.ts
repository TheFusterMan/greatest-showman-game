import Phaser from 'phaser';
import { GAME_VERSION } from '../logic/rules';

export interface DebugMetrics {
    bpm: number;
    beatWindowMs: number;
    enemiesCount: number;
    particlesActive: number;
    particlesPool: number;
    stage: number;
    act: number;
    hype: number;
    isCasual: boolean;
}

export class DebugPanel {
    private versionLabel: Phaser.GameObjects.Text;
    private panelContainer: Phaser.GameObjects.Container;
    private debugText: Phaser.GameObjects.Text;
    private f3Key: Phaser.Input.Keyboard.Key;

    private isVisible = false;
    private updateTimer = 0;

    constructor(private scene: Phaser.Scene) {
        const { width, height } = scene.scale;

        // Всегда видимый бейдж версии в правом нижнем углу (кликабельный)
        this.versionLabel = scene.add.text(width - 16, height - 16, `v${GAME_VERSION} [F3]`, {
            fontFamily: 'monospace',
            fontSize: '12px',
            color: '#94a3b8',
            backgroundColor: '#0f040888',
            padding: { x: 6, y: 3 },
        })
            .setOrigin(1, 1)
            .setDepth(50)
            .setInteractive({ useHandCursor: true });

        this.versionLabel.on('pointerdown', () => this.toggle());

        // Всплывающая отладочная панель
        this.panelContainer = scene.add.container(16, 95).setDepth(50).setVisible(false);

        const bg = scene.add.rectangle(0, 0, 235, 140, 0x09090b, 0.85)
            .setOrigin(0, 0)
            .setStrokeStyle(1, 0x3f3f46);

        this.debugText = scene.add.text(10, 8, '', {
            fontFamily: 'monospace',
            fontSize: '12px',
            color: '#4ade80',
            lineSpacing: 4,
        });

        this.panelContainer.add([bg, this.debugText]);

        this.f3Key = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F3);
    }

    public toggle(): void {
        this.isVisible = !this.isVisible;
        this.panelContainer.setVisible(this.isVisible);
        this.versionLabel.setColor(this.isVisible ? '#4ade80' : '#94a3b8');
    }

    public update(seconds: number, metrics: DebugMetrics): void {
        if (Phaser.Input.Keyboard.JustDown(this.f3Key)) {
            this.toggle();
        }

        if (!this.isVisible) return;

        // Обновляем текст раз в 150мс, чтобы панель сама не просаживала FPS
        this.updateTimer += seconds;
        if (this.updateTimer < 0.15) return;
        this.updateTimer = 0;

        const fps = Math.round(this.scene.game.loop.actualFps);

        this.debugText.setText([
            `BUILD: v${GAME_VERSION}`,
            `FPS:   ${fps}`,
            `BPM:   ${metrics.bpm} (win ±${Math.round(metrics.beatWindowMs)}ms)`,
            `STAGE: ${metrics.stage} | ACT: ${metrics.act} | HYPE: x${metrics.hype}`,
            `ENEMY: ${metrics.enemiesCount}`,
            `PART:  ${metrics.particlesActive} active / ${metrics.particlesPool} pool`,
            `MODE:  ${metrics.isCasual ? 'CASUAL' : 'STANDARD'}`,
        ]);
    }
}