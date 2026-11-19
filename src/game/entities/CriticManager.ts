import Phaser from 'phaser';
import { GAME_CONFIG } from '../logic/rules';

export interface Enemy {
    obj: Phaser.GameObjects.Rectangle;
    speed: number;
}

export class CriticManager {
    private enemies: Enemy[] = [];
    private enemyHint: Phaser.GameObjects.Text | null = null;

    constructor(private scene: Phaser.Scene) {}

    public get count(): number {
        return this.enemies.length;
    }

    public spawnFirstCriticWithHint(): void {
        const { width, height } = this.scene.scale;
        const x = width - 120;
        const y = height / 2;

        const criticObj = this.scene.add.rectangle(x, y, 28, 28, 0x475569);
        criticObj.setStrokeStyle(1, 0x94a3b8).setDepth(1);
        this.enemies.push({ obj: criticObj, speed: 110 });

        // Понятный призыв к действию:
        this.enemyHint = this.scene.add.text(x, y - 36, '▼ ТАРАНЬ В РИТМ! [ПРОБЕЛ]', {
            fontFamily: "'Jost', sans-serif",
            fontSize: '13px',
            color: '#f43f5e',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3,
        }).setOrigin(0.5).setDepth(5);
    }

    public spawnSingleCritic(isPhase2: boolean, isCasualMode: boolean): void {
        const { width, height } = this.scene.scale;
        const x = Math.random() > 0.5 ? 40 : width - 40;
        const y = Phaser.Math.Between(110, height - 80);

        const speedRange = isPhase2 ? GAME_CONFIG.criticSpeedPhase2 : GAME_CONFIG.criticSpeedPhase1;
        const casualMultiplier = isCasualMode ? GAME_CONFIG.casualSpeedMultiplier : 1.0;
        const speed = Math.round(Phaser.Math.Between(speedRange.min, speedRange.max) * casualMultiplier);
        const color = isPhase2 ? 0xf97316 : 0x475569;

        const criticObj = this.scene.add.rectangle(x, y, 28, 28, color);
        criticObj.setStrokeStyle(1, isPhase2 ? 0xfbbf24 : 0x94a3b8).setDepth(1);
        this.enemies.push({ obj: criticObj, speed });
    }

    public dismissHint(): void {
        if (this.enemyHint) {
            this.enemyHint.destroy();
            this.enemyHint = null;
        }
    }

    public onBeat(isKick: boolean): void {
        if (!this.enemyHint) return;
        if (isKick) {
            this.enemyHint.setColor('#fef08a');
            this.scene.tweens.add({ targets: this.enemyHint, scale: 1.15, yoyo: true, duration: 120 });
        } else {
            this.enemyHint.setColor('#f43f5e');
        }
    }

    // Принимает isSlowMo: если активно, скорость критиков режется до 0.35x
    public update(seconds: number, playerX: number, playerY: number, timeNow: number, isSlowMo: boolean): void {
        const currentMultiplier = isSlowMo ? GAME_CONFIG.slowMoSpeedMultiplier : 1.0;

        for (let i = 0; i < this.enemies.length; i++) {
            const e = this.enemies[i];
            if (!e || !e.obj) continue;

            // Расталкивание (flocking)
            for (let j = 0; j < this.enemies.length; j++) {
                if (i !== j) {
                    const other = this.enemies[j];
                    if (!other || !other.obj) continue;

                    const distBetween = Phaser.Math.Distance.Between(e.obj.x, e.obj.y, other.obj.x, other.obj.y);
                    if (distBetween < 26 && distBetween > 0) {
                        e.obj.x += ((e.obj.x - other.obj.x) / distBetween) * 50 * seconds;
                        e.obj.y += ((e.obj.y - other.obj.y) / distBetween) * 50 * seconds;
                    }
                }
            }

            const baseAngle = Phaser.Math.Angle.Between(e.obj.x, e.obj.y, playerX, playerY);
            const flankOffset = Math.sin(timeNow * 0.002 + i) * 0.25;
            const moveAngle = baseAngle + flankOffset;

            const effectiveSpeed = e.speed * currentMultiplier;
            e.obj.x += Math.cos(moveAngle) * effectiveSpeed * seconds;
            e.obj.y += Math.sin(moveAngle) * effectiveSpeed * seconds;

            if (i === 0 && this.enemyHint) {
                this.enemyHint.setPosition(e.obj.x, e.obj.y - 36);
            }
        }
    }

    // Бонус «Овация»: уничтожает критиков в радиусе вокруг артиста
    public triggerShockwave(originX: number, originY: number, radius = 240): { x: number; y: number }[] {
        const destroyed: { x: number; y: number }[] = [];
        this.dismissHint();

        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            const dist = Phaser.Math.Distance.Between(originX, originY, e.obj.x, e.obj.y);
            if (dist <= radius) {
                destroyed.push({ x: e.obj.x, y: e.obj.y });
                e.obj.destroy();
                this.enemies.splice(i, 1);
            }
        }
        return destroyed;
    }

    public checkPlayerCollision(
        playerX: number,
        playerY: number,
        isDashing: boolean
    ): { playerKilled: boolean; defeatedAt?: { x: number; y: number } } {
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            const dist = Phaser.Math.Distance.Between(playerX, playerY, e.obj.x, e.obj.y);

            if (dist < 32) {
                if (isDashing) {
                    this.dismissHint();
                    const pos = { x: e.obj.x, y: e.obj.y };
                    e.obj.destroy();
                    this.enemies.splice(i, 1);
                    return { playerKilled: false, defeatedAt: pos };
                } else {
                    return { playerKilled: true };
                }
            }
        }
        return { playerKilled: false };
    }
}