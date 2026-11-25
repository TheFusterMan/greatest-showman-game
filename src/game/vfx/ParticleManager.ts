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

interface DustParticle {
    obj: Phaser.GameObjects.Rectangle;
    life: number;
    maxLife: number;
}

export class ParticleManager {
    private flyingConfetti: FlyingConfetti[] = [];
    private floorConfetti: FloorConfetti[] = [];
    private dustParticles: DustParticle[] = [];

    // Пул неиспользуемых прямоугольников
    private pool: Phaser.GameObjects.Rectangle[] = [];
    private readonly MAX_POOL_SIZE = 220;

    private colors = [0xfacc15, 0xe11d48, 0xffffff, 0xfbbf24, 0xf43f5e];
    private dustCooldown = 0;

    constructor(private scene: Phaser.Scene) {
        // Предсоздаём пул при старте сцены (0 просадок во время игры)
        for (let i = 0; i < 100; i++) {
            const rect = this.scene.add.rectangle(-100, -100, 6, 6, 0xffffff);
            rect.setVisible(false).setActive(false);
            this.pool.push(rect);
        }
    }

    public get activeCount(): number {
        return this.flyingConfetti.length + this.floorConfetti.length + this.dustParticles.length;
    }

    public get poolSize(): number {
        return this.pool.length;
    }

    private acquireRect(x: number, y: number, w: number, h: number, color: number, alpha: number): Phaser.GameObjects.Rectangle | null {
        let rect = this.pool.pop();
        if (!rect) {
            if (this.activeCount >= this.MAX_POOL_SIZE) return null; // Защита от переполнения
            rect = this.scene.add.rectangle(x, y, w, h, color, alpha);
        }
        rect.setPosition(x, y);
        rect.setSize(w, h);
        rect.setDisplaySize(w, h);
        rect.setFillStyle(color, alpha);
        rect.setAngle(0);
        rect.setScale(1);
        rect.setAlpha(alpha);
        rect.setVisible(true).setActive(true);
        return rect;
    }

    private releaseRect(rect: Phaser.GameObjects.Rectangle): void {
        rect.setVisible(false).setActive(false);
        this.pool.push(rect);
    }

    public createConfettiExplosion(x: number, y: number): void {
        // 1. Серпантин на пол
        for (let r = 0; r < 4; r++) {
            const ribbon = this.acquireRect(
                x + Phaser.Math.Between(-15, 15),
                y + Phaser.Math.Between(-15, 15),
                Phaser.Math.Between(20, 34),
                Phaser.Math.Between(5, 7),
                this.colors[Phaser.Math.Between(0, this.colors.length - 1)],
                0.75
            );
            if (!ribbon) break;
            ribbon.setAngle(Phaser.Math.Between(0, 180));
            ribbon.setDepth(0.05);
            this.floorConfetti.push({ obj: ribbon, life: 10.0 });
        }

        // 2. Летающие частицы салюта
        for (let i = 0; i < 24; i++) {
            const size = Phaser.Math.Between(5, 8);
            const p = this.acquireRect(
                x, y, size, size,
                this.colors[Phaser.Math.Between(0, this.colors.length - 1)],
                1
            );
            if (!p) break;
            p.setDepth(1.5);

            const angle = Math.random() * Math.PI * 2;
            const speed = Phaser.Math.Between(150, 400);

            this.flyingConfetti.push({
                obj: p,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.75,
                rotSpeed: Phaser.Math.Between(-12, 12),
            });
        }
    }

    // След танца без твинов + троттлинг раз в 30мс
    public spawnDanceDust(x: number, y: number): void {
        if (this.dustCooldown > 0) return;
        this.dustCooldown = 0.03;

        const spark = this.acquireRect(x, y, 8, 8, 0xfbbf24, 0.7);
        if (!spark) return;
        spark.setDepth(0.3);

        this.dustParticles.push({
            obj: spark,
            life: 0.2,
            maxLife: 0.2,
        });
    }

    public update(seconds: number): void {
        if (this.dustCooldown > 0) this.dustCooldown -= seconds;

        // Обновление пыли от рывка
        for (let d = this.dustParticles.length - 1; d >= 0; d--) {
            const dp = this.dustParticles[d];
            dp.life -= seconds;
            if (dp.life <= 0) {
                this.releaseRect(dp.obj);
                this.dustParticles.splice(d, 1);
            } else {
                const ratio = dp.life / dp.maxLife;
                dp.obj.setAlpha(ratio * 0.7);
                dp.obj.setScale(0.2 + ratio * 0.8);
            }
        }

        // Летающее конфетти
        for (let i = this.flyingConfetti.length - 1; i >= 0; i--) {
            const c = this.flyingConfetti[i];
            c.life -= seconds * 1.4;
            c.obj.x += c.vx * seconds;
            c.obj.y += c.vy * seconds;
            c.obj.rotation += c.rotSpeed * seconds;

            if (c.life <= 0) {
                c.obj.setDepth(0.05);
                c.obj.setAlpha(0.65);
                this.floorConfetti.push({ obj: c.obj, life: 9.0 });
                this.flyingConfetti.splice(i, 1);
            }
        }

        // Осевшее конфетти
        for (let j = this.floorConfetti.length - 1; j >= 0; j--) {
            const fc = this.floorConfetti[j];
            fc.life -= seconds;

            if (fc.life < 2.0) {
                fc.obj.setAlpha((fc.life / 2.0) * 0.65);
            }

            if (fc.life <= 0) {
                this.releaseRect(fc.obj);
                this.floorConfetti.splice(j, 1);
            }
        }
    }
}