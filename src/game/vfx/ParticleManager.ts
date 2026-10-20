import Phaser from 'phaser';

interface FlyingConfetti {
    obj: Phaser.GameObjects.Rectangle;
    vx: number;
    vy: number;
    life: number;
    rotSpeed: number;
}

interface FloorConfetti {
    obj: Phaser.GameObjects.Rectangle;
    life: number;
}

export class ParticleManager {
    private flyingConfetti: FlyingConfetti[] = [];
    private floorConfetti: FloorConfetti[] = [];
    private colors = [0xfacc15, 0xe11d48, 0xffffff, 0xfbbf24, 0xf43f5e];

    constructor(private scene: Phaser.Scene) {}

    // Взрыв конфетти и оседание серпантина
    public createConfettiExplosion(x: number, y: number): void {
        // 1. Серпантин на пол
        for (let r = 0; r < 5; r++) {
            const ribbon = this.scene.add.rectangle(
                x + Phaser.Math.Between(-15, 15),
                y + Phaser.Math.Between(-15, 15),
                Phaser.Math.Between(22, 38),
                Phaser.Math.Between(5, 8),
                this.colors[Phaser.Math.Between(0, this.colors.length - 1)],
                0.75
            );
            ribbon.setAngle(Phaser.Math.Between(0, 180));
            ribbon.setDepth(0.05);

            this.floorConfetti.push({ obj: ribbon, life: 14.0 });
        }

        // 2. Летающие частицы салюта
        for (let i = 0; i < 32; i++) {
            const p = this.scene.add.rectangle(
                x,
                y,
                Phaser.Math.Between(5, 8),
                Phaser.Math.Between(5, 8),
                this.colors[Phaser.Math.Between(0, this.colors.length - 1)]
            );
            p.setDepth(1.5);

            const angle = Math.random() * Math.PI * 2;
            const speed = Phaser.Math.Between(150, 420);

            this.flyingConfetti.push({
                obj: p,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.8,
                rotSpeed: Phaser.Math.Between(-12, 12),
            });
        }
    }

    // След танца при рывке
    public spawnDanceDust(x: number, y: number): void {
        const spark = this.scene.add.rectangle(x, y, 8, 8, 0xfbbf24, 0.7);
        spark.setDepth(0.3);
        this.scene.tweens.add({
            targets: spark,
            alpha: 0,
            scale: 0.2,
            duration: 200,
            onComplete: () => spark.destroy(),
        });
    }

    public update(seconds: number): void {
        for (let i = this.flyingConfetti.length - 1; i >= 0; i--) {
            const c = this.flyingConfetti[i];
            c.life -= seconds * 1.4;
            c.obj.x += c.vx * seconds;
            c.obj.y += c.vy * seconds;
            c.obj.rotation += c.rotSpeed * seconds;

            if (c.life <= 0) {
                c.obj.setDepth(0.05);
                c.obj.setAlpha(0.65);
                this.floorConfetti.push({ obj: c.obj, life: 12.0 });
                this.flyingConfetti.splice(i, 1);
            }
        }

        for (let j = this.floorConfetti.length - 1; j >= 0; j--) {
            const fc = this.floorConfetti[j];
            fc.life -= seconds;

            if (fc.life < 2.0) {
                fc.obj.alpha = (fc.life / 2.0) * 0.65;
            }

            if (fc.life <= 0) {
                fc.obj.destroy();
                this.floorConfetti.splice(j, 1);
            }
        }
    }
}