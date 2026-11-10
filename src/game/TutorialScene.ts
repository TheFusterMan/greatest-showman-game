import Phaser from 'phaser';
import { AudioSystem } from './audio/AudioSystem';
import { ParticleManager } from './vfx/ParticleManager';
import { GAME_CONFIG } from './logic/rules';

type Step = 1 | 2 | 3 | 4;

export class TutorialScene extends Phaser.Scene {
    private step: Step = 1;
    private particles!: ParticleManager;

    private showman!: Phaser.GameObjects.Rectangle;
    private rhythmRing!: Phaser.GameObjects.Arc;
    private shrinkingRing!: Phaser.GameObjects.Arc;
    private dummyCritic!: Phaser.GameObjects.Rectangle | null;

    private stepCards: Phaser.GameObjects.Container[] = [];
    private instructionText!: Phaser.GameObjects.Text;

    private wasd!: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;
    private spaceKey!: Phaser.Input.Keyboard.Key;
    private escKey!: Phaser.Input.Keyboard.Key;

    private beatTimer = 0;
    private beatCounter = 0;
    private beatHitsCount = 0;
    private isDashing = false;
    private dashTimer = 0;

    constructor() {
        super('TutorialScene');
    }

    create(): void {
        const { width, height } = this.scale;
        this.particles = new ParticleManager(this);

        this.add.rectangle(width / 2, height / 2, width, height, 0x180509);
        const gfx = this.add.graphics();
        gfx.lineStyle(1, 0x2d0c14, 0.7);
        for (let y = 0; y < height; y += 36) gfx.lineBetween(0, y, width, y);

        this.showman = this.add.rectangle(width * 0.3, height * 0.55, 32, 32, 0xd90429);
        this.showman.setStrokeStyle(2, 0xfbbf24).setDepth(2);

        this.rhythmRing = this.add.circle(this.showman.x, this.showman.y, 24, 0xfbbf24, 0.1);
        this.rhythmRing.setStrokeStyle(2, 0xfbbf24, 0.5).setDepth(1.9);

        this.shrinkingRing = this.add.circle(this.showman.x, this.showman.y, 24, 0xffffff, 0);
        this.shrinkingRing.setStrokeStyle(2, 0xffffff, 0.9).setDepth(1.9);

        this.createHeaderCards(width);

        this.instructionText = this.add.text(width / 2, height * 0.28, '', {
            fontFamily: "'Jost', sans-serif",
            fontSize: '24px',
            color: '#fef08a',
            fontStyle: 'bold',
            align: 'center',
        }).setOrigin(0.5);

        this.add.text(width / 2, height - 24, '[ESC] Пропустить репетицию и начать шоу', {
            fontFamily: "'Jost', sans-serif",
            fontSize: '14px',
            color: '#71717a',
        }).setOrigin(0.5);

        this.wasd = this.input.keyboard!.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D,
        }) as any;
        this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

        this.setStep(1);
    }

    update(_time: number, delta: number): void {
        const seconds = delta / 1000;

        if (Phaser.Input.Keyboard.JustDown(this.escKey)) {
            this.startGame();
            return;
        }

        this.handleMovement(seconds);
        this.handleRhythm(seconds);
        this.particles.update(seconds);

        // Проверка условий этапов:
        if (this.step === 1) {
            if (this.wasd.left.isDown || this.wasd.right.isDown || this.wasd.up.isDown || this.wasd.down.isDown) {
                this.time.delayedCall(400, () => this.setStep(2));
            }
        } else if (this.step === 3 && this.dummyCritic) {
            const dist = Phaser.Math.Distance.Between(this.showman.x, this.showman.y, this.dummyCritic.x, this.dummyCritic.y);
            if (dist < 34 && this.isDashing) {
                this.particles.createConfettiExplosion(this.dummyCritic.x, this.dummyCritic.y);
                this.dummyCritic.destroy();
                this.dummyCritic = null;
                AudioSystem.perfectChime();
                this.setStep(4);
            }
        }
    }

    private handleMovement(seconds: number): void {
        if (this.step === 1 && this.isDashing) return;

        if (Phaser.Input.Keyboard.JustDown(this.spaceKey) && !this.isDashing && this.step >= 2) {
            const evaluation = this.checkBeatHit();

            if (evaluation.hit) {
                this.isDashing = true;
                this.dashTimer = 0.20;
                AudioSystem.perfectChime();

                if (evaluation.rating === 'ОТЛИЧНО') {
                    this.shrinkingRing.setStrokeStyle(3, 0xfacc15, 1); // Золотой
                } else {
                    this.shrinkingRing.setStrokeStyle(3, 0x4ade80, 1); // Зеленый
                }

                this.time.delayedCall(180, () => {
                    if (this.shrinkingRing) this.shrinkingRing.setStrokeStyle(2, 0xffffff, 0.9);
                });

                if (this.step === 2) {
                    this.beatHitsCount++;
                    const label = evaluation.rating === 'ОТЛИЧНО' ? 'ОТЛИЧНО!' : 'ХОРОШО!';
                    this.instructionText.setText(`${label} (${this.beatHitsCount}/3)\nЖми [ПРОБЕЛ] ровно при смыкании колец`);

                    if (this.beatHitsCount >= 3) {
                        this.time.delayedCall(400, () => this.setStep(3));
                    }
                }
            } else {
                // Красная вспышка при промахе
                this.shrinkingRing.setStrokeStyle(2, 0xef4444, 1);
                this.time.delayedCall(180, () => {
                    if (this.shrinkingRing) this.shrinkingRing.setStrokeStyle(2, 0xffffff, 0.9);
                });
            }
        }

        if (this.isDashing) {
            this.dashTimer -= seconds;
            this.particles.spawnDanceDust(this.showman.x, this.showman.y);
            if (this.dashTimer <= 0) this.isDashing = false;
        }

        let dx = 0; let dy = 0;
        if (this.wasd.left.isDown) dx -= 1;
        if (this.wasd.right.isDown) dx += 1;
        if (this.wasd.up.isDown) dy -= 1;
        if (this.wasd.down.isDown) dy += 1;

        if (dx !== 0 || dy !== 0) {
            const speed = this.isDashing ? GAME_CONFIG.dashSpeed : GAME_CONFIG.playerSpeed;
            const len = Math.hypot(dx, dy);
            this.showman.x += (dx / len) * speed * seconds;
            this.showman.y += (dy / len) * speed * seconds;
        }

        this.showman.x = Phaser.Math.Clamp(this.showman.x, 30, this.scale.width - 30);
        this.showman.y = Phaser.Math.Clamp(this.showman.y, 160, this.scale.height - 40);
    }

    private handleRhythm(seconds: number): void {
        const beatTime = 60 / 96;
        this.beatTimer += seconds;
        const progress = Math.min(1, this.beatTimer / beatTime);

        const scale = 2.4 - progress * 1.4;
        this.shrinkingRing.setScale(scale);
        this.shrinkingRing.setAlpha(0.2 + progress * 0.8);

        if (this.beatTimer >= beatTime) {
            this.beatTimer -= beatTime;
            this.beatCounter++;
            if (this.beatCounter % 2 === 0) AudioSystem.kick();
            else AudioSystem.tambourine();

            this.tweens.add({
                targets: this.showman,
                scaleX: 1.25,
                scaleY: 0.8,
                yoyo: true,
                duration: 100,
            });
        }

        this.rhythmRing.setPosition(this.showman.x, this.showman.y);
        this.shrinkingRing.setPosition(this.showman.x, this.showman.y);
    }

    private checkBeatHit(): { hit: boolean; rating: 'ОТЛИЧНО' | 'ХОРОШО' | 'МИМО' } {
        const beatTime = 60 / 96;
        let diff = this.beatTimer;
        if (diff > beatTime / 2) diff = diff - beatTime;

        const absDiff = Math.abs(diff);

        if (absDiff <= 0.055) {
            return { hit: true, rating: 'ОТЛИЧНО' };
        } else if (absDiff <= 0.110) {
            return { hit: true, rating: 'ХОРОШО' };
        } else {
            return { hit: false, rating: 'МИМО' };
        }
    }

    private setStep(step: Step): void {
        this.step = step;
        this.updateCardStyles();

        if (step === 1) {
            this.instructionText.setText('ШАГ 1: ДВИЖЕНИЕ\nИспользуй клавиши [ W, A, S, D ]');
        } else if (step === 2) {
            this.beatHitsCount = 0;
            this.instructionText.setText('ШАГ 2: РИТМ (0/3)\nЖми [ПРОБЕЛ] ровно в момент, когда белое кольцо коснется золотого');
        } else if (step === 3) {
            const { width, height } = this.scale;
            this.instructionText.setText('ШАГ 3: ПИРУЭТ\nСделай рывок в ритм [ПРОБЕЛ] сквозь критика!');

            this.dummyCritic = this.add.rectangle(width * 0.72, height * 0.55, 30, 30, 0x64748b);
            this.dummyCritic.setStrokeStyle(2, 0x94a3b8).setDepth(2);
        } else if (step === 4) {
            this.instructionText.setText('★ ПРЕВОСХОДНО! ЗАЛ ЖДЕТ! ★').setColor('#22c55e');
            this.time.delayedCall(1200, () => this.startGame());
        }
    }

    private createHeaderCards(width: number): void {
        const titles = ['1. ДВИЖЕНИЕ', '2. РИТМ', '3. ПИРУЭТ'];
        const cardWidth = 190;
        const startX = width / 2 - 210;

        for (let i = 0; i < 3; i++) {
            const container = this.add.container(startX + i * 210, 50);
            const bg = this.add.rectangle(0, 0, cardWidth, 44, 0x1e1b4b, 0.7).setStrokeStyle(2, 0x475569);
            const txt = this.add.text(0, 0, titles[i], {
                fontFamily: "'Jost', sans-serif",
                fontSize: '15px',
                color: '#94a3b8',
                fontStyle: 'bold',
            }).setOrigin(0.5);

            container.add([bg, txt]);
            container.setDepth(10);
            this.stepCards.push(container);
        }
    }

    private updateCardStyles(): void {
        for (let i = 0; i < 3; i++) {
            const container = this.stepCards[i];
            const bg = container.getAt(0) as Phaser.GameObjects.Rectangle;
            const txt = container.getAt(1) as Phaser.GameObjects.Text;

            const stepIndex = i + 1;
            if (stepIndex === this.step) {
                bg.setFillStyle(0x78350f, 0.9).setStrokeStyle(2, 0xfacc15);
                txt.setColor('#fef08a');
            } else if (stepIndex < this.step) {
                bg.setFillStyle(0x064e3b, 0.6).setStrokeStyle(2, 0x22c55e);
                txt.setColor('#86efac');
            } else {
                bg.setFillStyle(0x18181b, 0.5).setStrokeStyle(1, 0x3f3f46);
                txt.setColor('#71717a');
            }
        }
    }

    private startGame(): void {
        this.scene.start('GameScene');
    }
}