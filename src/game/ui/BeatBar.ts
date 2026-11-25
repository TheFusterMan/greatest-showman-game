import Phaser from 'phaser';

export class BeatBar {
    private container: Phaser.GameObjects.Container;
    private targetZone: Phaser.GameObjects.Rectangle;
    private leftIn: Phaser.GameObjects.Rectangle;
    private rightIn: Phaser.GameObjects.Rectangle;
    private leftPass: Phaser.GameObjects.Rectangle;
    private rightPass: Phaser.GameObjects.Rectangle;

    private readonly halfWidth = 115;
    private wasInWindow = false;

    constructor(private scene: Phaser.Scene, x: number, y: number, depth = 6) {
        this.container = scene.add.container(x, y).setDepth(depth);

        // Фон дорожки
        const track = scene.add.rectangle(0, 0, this.halfWidth * 2, 10, 0x0f0408, 0.85)
            .setStrokeStyle(1, 0x52525b);

        // Центральная зона попадания (ширина обновляется под BPM)
        this.targetZone = scene.add.rectangle(0, 0, 38, 18, 0xfbbf24, 0.28)
            .setStrokeStyle(2, 0xfbbf24, 0.8);

        // Сходящиеся риски (следующий бит)
        this.leftIn = scene.add.rectangle(-this.halfWidth, 0, 5, 18, 0xffffff, 0.9);
        this.rightIn = scene.add.rectangle(this.halfWidth, 0, 5, 18, 0xffffff, 0.9);

        // Уходящие риски (окно "чуть позже бита", чтобы не было резкого скачка)
        this.leftPass = scene.add.rectangle(0, 0, 5, 18, 0x4ade80, 0);
        this.rightPass = scene.add.rectangle(0, 0, 5, 18, 0x4ade80, 0);

        this.container.add([track, this.targetZone, this.leftPass, this.rightPass, this.leftIn, this.rightIn]);
    }

    public update(progress: number, windowRatio: number, inWindow: boolean, isBeat: boolean): void {
        // Ширина зоны попадания 1:1 соответствует реальному окну beatWindow
        const zoneWidth = Phaser.Math.Clamp(windowRatio * this.halfWidth * 2, 16, this.halfWidth * 1.6);
        if (Math.abs(this.targetZone.width - zoneWidth) > 1) {
            this.targetZone.setSize(zoneWidth, 18);
            this.targetZone.setDisplaySize(zoneWidth, 18);
        }

        // Движение сходящихся рисок к центру (0)
        const offset = (1 - progress) * this.halfWidth;
        this.leftIn.x = -offset;
        this.rightIn.x = offset;
        this.leftIn.setAlpha(0.35 + progress * 0.65);
        this.rightIn.setAlpha(0.35 + progress * 0.65);

        // Плавный проход уходящих рисок сразу после бита (пока длится "позднее" окно)
        if (progress <= windowRatio * 1.2) {
            const passRatio = progress / (windowRatio * 1.2);
            const passOffset = progress * this.halfWidth;
            this.leftPass.x = passOffset;
            this.rightPass.x = -passOffset;
            this.leftPass.setAlpha((1 - passRatio) * 0.8);
            this.rightPass.setAlpha((1 - passRatio) * 0.8);
        } else {
            this.leftPass.setAlpha(0);
            this.rightPass.setAlpha(0);
        }

        // Яркая подсветка центра, когда МОЖНО жать Пробел
        if (inWindow !== this.wasInWindow) {
            this.wasInWindow = inWindow;
            if (inWindow) {
                this.targetZone.setFillStyle(0x4ade80, 0.55).setStrokeStyle(2, 0xfef08a, 1);
                this.leftIn.setFillStyle(0x4ade80);
                this.rightIn.setFillStyle(0x4ade80);
            } else {
                this.targetZone.setFillStyle(0xfbbf24, 0.22).setStrokeStyle(2, 0xfbbf24, 0.7);
                this.leftIn.setFillStyle(0xffffff);
                this.rightIn.setFillStyle(0xffffff);
            }
        }

        if (isBeat) {
            this.scene.tweens.killTweensOf(this.targetZone);
            this.targetZone.setScale(1.22);
            this.scene.tweens.add({
                targets: this.targetZone,
                scale: 1,
                duration: 130,
                ease: 'Quad.easeOut',
            });
        }
    }

    public setVisible(visible: boolean): void {
        this.container.setVisible(visible);
    }
}