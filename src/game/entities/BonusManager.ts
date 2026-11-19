import Phaser from 'phaser';
import { GAME_CONFIG } from '../logic/rules';

export type BonusType = 'SLOW_MO' | 'HEAL' | 'SHOCKWAVE';

interface BonusItem {
    container: Phaser.GameObjects.Container;
    type: BonusType;
    life: number;
    baseY: number;
    age: number;
}

export class BonusManager {
    private bonuses: BonusItem[] = [];

    constructor(private scene: Phaser.Scene) {}

    public trySpawnFromCritic(x: number, y: number, currentLives: number, maxLives: number): void {
        if (Math.random() > GAME_CONFIG.bonusDropChance) return;

        // Выбираем тип бонуса: если жизней мало — сердечко падает чаще
        let type: BonusType = 'SLOW_MO';
        const rand = Math.random();

        if (currentLives < maxLives) {
            if (rand < 0.45) type = 'HEAL';
            else if (rand < 0.80) type = 'SLOW_MO';
            else type = 'SHOCKWAVE';
        } else {
            type = rand < 0.65 ? 'SLOW_MO' : 'SHOCKWAVE';
        }

        this.createBonus(x, y, type);
    }

    private createBonus(x: number, y: number, type: BonusType): void {
        const container = this.scene.add.container(x, y).setDepth(2);

        let color = 0x38bdf8; // Голубой для слоу-мо
        let icon = '⌛';
        let label = 'ВРЕМЯ';

        if (type === 'HEAL') {
            color = 0xf43f5e;
            icon = '❤️';
            label = 'БИС!';
        } else if (type === 'SHOCKWAVE') {
            color = 0xfacc15;
            icon = '⚡';
            label = 'ВОЛНА';
        }

        const aura = this.scene.add.circle(0, 0, 18, color, 0.25);
        const core = this.scene.add.circle(0, 0, 13, color, 0.85).setStrokeStyle(2, 0xffffff);
        const iconText = this.scene.add.text(0, -1, icon, {
            fontSize: '14px',
        }).setOrigin(0.5);

        const labelText = this.scene.add.text(0, 20, label, {
            fontFamily: "'Jost', sans-serif",
            fontSize: '10px',
            fontStyle: 'bold',
            color: '#fef08a',
            stroke: '#000000',
            strokeThickness: 2,
        }).setOrigin(0.5);

        container.add([aura, core, iconText, labelText]);

        // Пульсация ауры
        this.scene.tweens.add({
            targets: aura,
            scale: 1.35,
            alpha: 0.1,
            duration: 500,
            yoyo: true,
            repeat: -1,
        });

        this.bonuses.push({
            container,
            type,
            life: GAME_CONFIG.bonusLifespan,
            baseY: y,
            age: 0,
        });
    }

    public update(seconds: number): void {
        for (let i = this.bonuses.length - 1; i >= 0; i--) {
            const b = this.bonuses[i];
            b.life -= seconds;
            b.age += seconds;

            // Плавное парение вверх-вниз
            b.container.y = b.baseY + Math.sin(b.age * 5) * 4;

            // Мигание за 2.2 секунды до исчезновения
            if (b.life < 2.2) {
                b.container.setAlpha(Math.sin(this.scene.time.now * 0.02) > 0 ? 0.3 : 1);
            }

            if (b.life <= 0) {
                b.container.destroy();
                this.bonuses.splice(i, 1);
            }
        }
    }

    public checkCollision(playerX: number, playerY: number): { type: BonusType; x: number; y: number } | null {
        for (let i = this.bonuses.length - 1; i >= 0; i--) {
            const b = this.bonuses[i];
            const dist = Phaser.Math.Distance.Between(playerX, playerY, b.container.x, b.container.y);

            if (dist < 32) {
                const collected = { type: b.type, x: b.container.x, y: b.container.y };
                b.container.destroy();
                this.bonuses.splice(i, 1);
                return collected;
            }
        }
        return null;
    }
}