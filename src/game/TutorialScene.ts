import Phaser from 'phaser';
import { AudioSystem } from './audio/AudioSystem';
import { ParticleManager } from './vfx/ParticleManager';
import { BeatBar } from './ui/BeatBar';
import { TouchControls } from './ui/TouchControls';
import { GAME_CONFIG } from './logic/rules';

type Step = 1 | 2 | 3 | 4 | 5;

export class TutorialScene extends Phaser.Scene {
    private step: Step = 1;
    private stepTransitioning = false;
    private isPaused = false;

    private particles!: ParticleManager;
    private beatBar!: BeatBar;
    private touch!: TouchControls;

    private showman!: Phaser.GameObjects.Rectangle;
    private rhythmRing!: Phaser.GameObjects.Arc;
    private shrinkingRing!: Phaser.GameObjects.Arc;
    private pauseOverlay!: Phaser.GameObjects.Container;

    private dummyCritic: Phaser.GameObjects.Rectangle | null = null;
    private dummyLabel: Phaser.GameObjects.Text | null = null;
    private tutorialSpotlight: Phaser.GameObjects.Arc | null = null;
    private spotlightLabel: Phaser.GameObjects.Text | null = null;

    private stepCards: Phaser.GameObjects.Container[] = [];
    private instructionText!: Phaser.GameObjects.Text;
    private warningText!: Phaser.GameObjects.Text;

    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private wasd!: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;
    private spaceKey!: Phaser.Input.Keyboard.Key;
    private escKey!: Phaser.Input.Keyboard.Key;

    private beatTimer = 0;
    private beatCounter = 0;
    private beatHitsCount = 0;

    private isDashing = false;
    private dashTimer = 0;
    private dashGraceTimer = 0;
    private lastMoveDir = { x: 1, y: 0 };

    private ringFeedbackTimer = 0;
    private wasInWindow = false;
    private wasLethal = false;
    private touchCooldown = 0;
    private lastTouchActive = false;

    constructor() {
        super('TutorialScene');
    }

    create(): void {
        const { width, height } = this.scale;
        this.particles = new ParticleManager(this);

        this.step = 1;
        this.stepTransitioning = false;
        this.isPaused = false;
        this.stepCards = [];
        this.dummyCritic = null;
        this.dummyLabel = null;
        this.tutorialSpotlight = null;
        this.spotlightLabel = null;
        this.isDashing = false;
        this.dashTimer = 0;
        this.dashGraceTimer = 0;
        this.lastMoveDir = { x: 1, y: 0 };
        this.ringFeedbackTimer = 0;
        this.wasInWindow = false;
        this.wasLethal = false;
        this.touchCooldown = 0;

        this.add.rectangle(width / 2, height / 2, width, height, 0x180509);
        const gfx = this.add.graphics();
        gfx.lineStyle(1, 0x2d0c14, 0.7);
        for (let y = 0; y < height; y += 36) gfx.lineBetween(0, y, width, y);

        this.showman = this.add.rectangle(width * 0.28, height * 0.56, 32, 32, 0xd90429);
        this.showman.setStrokeStyle(2, 0xfbbf24).setDepth(2);

        this.rhythmRing = this.add.circle(this.showman.x, this.showman.y, 36, 0xfbbf24, 0.08);
        this.rhythmRing.setStrokeStyle(2, 0xfbbf24, 0.5).setDepth(1.9);

        this.shrinkingRing = this.add.circle(this.showman.x, this.showman.y, 36, 0xffffff, 0);
        this.shrinkingRing.setStrokeStyle(2, 0xffffff, 0.85).setDepth(1.9);

        this.createHeaderCards(width);

        this.instructionText = this.add.text(width / 2, height * 0.25, '', {
            fontFamily: "'Jost', sans-serif",
            fontSize: '22px',
            color: '#fef08a',
            fontStyle: 'bold',
            align: 'center',
            lineSpacing: 6,
            wordWrap: { width: width - 80 },
        }).setOrigin(0.5).setDepth(10);

        this.warningText = this.add.text(width / 2, height * 0.37, '', {
            fontFamily: "'Jost', sans-serif",
            fontSize: '16px',
            color: '#f87171',
            fontStyle: 'bold',
            align: 'center',
            wordWrap: { width: width - 80 },
        }).setOrigin(0.5).setDepth(10);

        // Общая ритм-шкала снизу
        this.beatBar = new BeatBar(this, width / 2, height - 58, 10);
        this.beatBar.setVisible(false);

        // Тапабельная кнопка пропуска репетиции (работает и на мобилке, и на ПК)
        const skipText = this.add.text(width / 2, height - 20, '[ ПРОПУСТИТЬ РЕПЕТИЦИЮ ⏭ ]', {
            fontFamily: "'Jost', sans-serif",
            fontSize: '13px',
            fontStyle: 'bold',
            color: '#94a3b8',
            backgroundColor: '#1f070ecc',
            padding: { x: 10, y: 4 },
        })
            .setOrigin(0.5)
            .setDepth(26)
            .setInteractive({ useHandCursor: true });

        skipText.on('pointerdown', () => {
            AudioSystem.resume();
            this.startGame();
        });

        // Подключаем мобильное тач-управление
        this.touch = new TouchControls(this, {
            onPauseToggle: () => this.togglePause(),
        });
        this.lastTouchActive = this.touch.isActive;

        this.pauseOverlay = this.createPauseOverlay(width, height);

        this.cursors = this.input.keyboard!.createCursorKeys();
        this.wasd = this.input.keyboard!.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D,
        }) as any;
        this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

        this.input.keyboard!.addCapture([
            Phaser.Input.Keyboard.KeyCodes.SPACE,
            Phaser.Input.Keyboard.KeyCodes.UP,
            Phaser.Input.Keyboard.KeyCodes.DOWN,
            Phaser.Input.Keyboard.KeyCodes.LEFT,
            Phaser.Input.Keyboard.KeyCodes.RIGHT,
        ]);

        this.setStep(1);
    }

    update(_time: number, delta: number): void {
        const seconds = Math.min(delta / 1000, 0.05);

        if (Phaser.Input.Keyboard.JustDown(this.escKey)) {
            this.startGame();
            return;
        }

        // Если переключили режим тача клавишей [T] или кнопкой 📱 — обновляем подсказки
        if (this.touch.isActive !== this.lastTouchActive) {
            this.lastTouchActive = this.touch.isActive;
            this.refreshStepInstruction();
        }

        if (this.isPaused) {
            this.touch.update(false, false);
            return;
        }

        if (this.touchCooldown > 0) this.touchCooldown -= seconds;

        this.handleRhythm(seconds);
        this.handleMovement(seconds);
        this.particles.update(seconds);

        if (this.stepTransitioning) return;

        // Шаг 1: Движение (клавиатура ИЛИ тач-джойстик)
        if (this.step === 1) {
            const isMovingKeyboard =
                this.wasd.left.isDown || this.wasd.right.isDown ||
                this.wasd.up.isDown || this.wasd.down.isDown ||
                this.cursors.left.isDown || this.cursors.right.isDown ||
                this.cursors.up.isDown || this.cursors.down.isDown;
            const isMovingTouch = this.touch.moveX !== 0 || this.touch.moveY !== 0;

            if (isMovingKeyboard || isMovingTouch) {
                this.stepTransitioning = true;
                this.time.delayedCall(450, () => this.setStep(2));
            }
        }
        // Шаг 3: Сбить манекен рывком
        else if (this.step === 3 && this.dummyCritic) {
            const dist = Phaser.Math.Distance.Between(
                this.showman.x, this.showman.y,
                this.dummyCritic.x, this.dummyCritic.y
            );
            const isLethal = this.isDashing || this.dashGraceTimer > 0;

            if (dist < 38) {
                if (isLethal) {
                    this.particles.createConfettiExplosion(this.dummyCritic.x, this.dummyCritic.y);
                    this.dummyCritic.destroy();
                    this.dummyCritic = null;
                    this.dummyLabel?.destroy();
                    this.dummyLabel = null;
                    this.warningText.setText('');
                    AudioSystem.perfectChime();
                    this.cameras.main.shake(120, 0.015);
                    this.stepTransitioning = true;
                    this.time.delayedCall(450, () => this.setStep(4));
                } else if (this.touchCooldown <= 0) {
                    this.touchCooldown = 0.7;
                    const angle = Phaser.Math.Angle.Between(this.dummyCritic.x, this.dummyCritic.y, this.showman.x, this.showman.y);
                    this.showman.x += Math.cos(angle) * 65;
                    this.showman.y += Math.sin(angle) * 65;
                    this.cameras.main.shake(90, 0.01);
                    const actionKey = this.touch.isActive ? '[РЫВОК]' : '[ПРОБЕЛ]';
                    this.warningText.setText(`ОСТОРОЖНО! Пешком критик бьёт!\nИди к нему и нажми ${actionKey} В РИТМ!`);
                }
            }
        }
        // Шаг 4: Подобрать софит
        else if (this.step === 4 && this.tutorialSpotlight) {
            const dist = Phaser.Math.Distance.Between(
                this.showman.x, this.showman.y,
                this.tutorialSpotlight.x, this.tutorialSpotlight.y
            );
            if (dist < 38) {
                this.particles.createConfettiExplosion(this.tutorialSpotlight.x, this.tutorialSpotlight.y);
                this.tutorialSpotlight.destroy();
                this.tutorialSpotlight = null;
                this.spotlightLabel?.destroy();
                this.spotlightLabel = null;
                AudioSystem.perfectChime();
                this.setStep(5);
            }
        }
    }

    private handleMovement(seconds: number): void {
        const dashPressed = Phaser.Input.Keyboard.JustDown(this.spaceKey) || this.touch.consumeDashPressed();

        if (dashPressed && !this.isDashing && this.step >= 2) {
            const evaluation = this.checkBeatHit();
            this.ringFeedbackTimer = 0.18;

            if (evaluation.hit) {
                this.isDashing = true;
                this.dashGraceTimer = 0;
                this.dashTimer = 0.20;
                AudioSystem.perfectChime();

                const color = evaluation.rating === 'ОТЛИЧНО' ? 0xfacc15 : 0x4ade80;
                this.shrinkingRing.setStrokeStyle(3, color, 1);

                if (this.step === 2 && !this.stepTransitioning) {
                    this.beatHitsCount++;
                    const label = evaluation.rating === 'ОТЛИЧНО' ? 'ОТЛИЧНО!' : 'ХОРОШО!';
                    const actionKey = this.touch.isActive ? '[РЫВОК]' : '[ПРОБЕЛ]';
                    this.instructionText.setText(`${label} (${this.beatHitsCount}/3)\nЖми ${actionKey}, когда полоски в зелёном центре`);

                    if (this.beatHitsCount >= 3) {
                        this.stepTransitioning = true;
                        this.time.delayedCall(450, () => this.setStep(3));
                    }
                }
            } else {
                this.shrinkingRing.setStrokeStyle(2, 0xef4444, 1);
            }
        }

        if (this.isDashing) {
            this.dashTimer -= seconds;
            this.particles.spawnDanceDust(this.showman.x, this.showman.y);
            if (this.dashTimer <= 0) {
                this.isDashing = false;
                this.dashGraceTimer = GAME_CONFIG.dashGraceDuration;
            }
        } else if (this.dashGraceTimer > 0) {
            this.dashGraceTimer -= seconds;
        }

        const isLethal = this.isDashing || this.dashGraceTimer > 0;
        if (isLethal !== this.wasLethal) {
            this.wasLethal = isLethal;
            if (isLethal) {
                this.showman.setFillStyle(0xfacc15).setStrokeStyle(3, 0xffffff);
            } else {
                this.showman.setFillStyle(0xd90429).setStrokeStyle(2, 0xfbbf24);
            }
        }

        let dx = 0;
        let dy = 0;
        if (this.wasd.left.isDown || this.cursors.left.isDown) dx -= 1;
        if (this.wasd.right.isDown || this.cursors.right.isDown) dx += 1;
        if (this.wasd.up.isDown || this.cursors.up.isDown) dy -= 1;
        if (this.wasd.down.isDown || this.cursors.down.isDown) dy += 1;

        // Подключаем вектор с виртуального джойстика
        if (dx === 0 && dy === 0) {
            dx = this.touch.moveX;
            dy = this.touch.moveY;
        }

        if (dx !== 0 || dy !== 0) {
            this.lastMoveDir = { x: dx, y: dy };
        }

        const moveX = (this.isDashing && dx === 0 && dy === 0) ? this.lastMoveDir.x : dx;
        const moveY = (this.isDashing && dx === 0 && dy === 0) ? this.lastMoveDir.y : dy;

        if (moveX !== 0 || moveY !== 0) {
            const speed = this.isDashing ? GAME_CONFIG.dashSpeed : GAME_CONFIG.playerSpeed;
            const len = Math.hypot(moveX, moveY);
            this.showman.x += (moveX / len) * speed * seconds;
            this.showman.y += (moveY / len) * speed * seconds;
        }

        this.showman.x = Phaser.Math.Clamp(this.showman.x, 30, this.scale.width - 30);
        this.showman.y = Phaser.Math.Clamp(this.showman.y, 130, this.scale.height - 95);
    }

    private handleRhythm(seconds: number): void {
        const beatTime = 60 / GAME_CONFIG.bpmRange.min;
        const windowSec = GAME_CONFIG.beatWindowRange.fair;

        this.beatTimer += seconds;
        const progress = Math.min(1, this.beatTimer / beatTime);
        let isBeat = false;

        if (this.beatTimer >= beatTime) {
            this.beatTimer -= beatTime;
            this.beatCounter++;
            isBeat = true;
            if (this.beatCounter % 2 === 0) AudioSystem.kick();
            else AudioSystem.tambourine();

            this.tweens.add({
                targets: this.showman,
                scaleX: 1.22,
                scaleY: 0.82,
                yoyo: true,
                duration: 100,
            });
        }

        const scale = 2.2 - progress * 1.2;
        this.shrinkingRing.setScale(scale);
        this.shrinkingRing.setAlpha(0.25 + progress * 0.75);

        const inWindow = this.checkBeatHit().hit;

        if (this.ringFeedbackTimer > 0) {
            this.ringFeedbackTimer -= seconds;
        } else if (inWindow !== this.wasInWindow) {
            this.wasInWindow = inWindow;
            if (inWindow) {
                this.rhythmRing.setStrokeStyle(3, 0x4ade80, 1);
                this.shrinkingRing.setStrokeStyle(3, 0xfef08a, 1);
            } else {
                this.rhythmRing.setStrokeStyle(2, 0xfbbf24, 0.45);
                this.shrinkingRing.setStrokeStyle(2, 0xffffff, 0.85);
            }
        }

        this.beatBar.update(progress, windowSec / beatTime, inWindow, isBeat);
        this.touch.update(this.step >= 2 && inWindow, this.step >= 2 && isBeat);

        this.rhythmRing.setPosition(this.showman.x, this.showman.y);
        this.shrinkingRing.setPosition(this.showman.x, this.showman.y);
    }

    private checkBeatHit(): { hit: boolean; rating: 'ОТЛИЧНО' | 'ХОРОШО' | 'МИМО' } {
        const beatTime = 60 / GAME_CONFIG.bpmRange.min;
        const windowSec = GAME_CONFIG.beatWindowRange.fair;
        let diff = this.beatTimer;
        if (diff > beatTime / 2) diff = diff - beatTime;

        const absDiff = Math.abs(diff);
        if (absDiff <= windowSec * 0.5) return { hit: true, rating: 'ОТЛИЧНО' };
        if (absDiff <= windowSec) return { hit: true, rating: 'ХОРОШО' };
        return { hit: false, rating: 'МИМО' };
    }

    private setStep(step: Step): void {
        this.step = step;
        this.stepTransitioning = false;
        this.warningText.setText('');
        this.updateCardStyles();
        this.refreshStepInstruction();

        if (step === 1) {
            this.beatBar.setVisible(false);
        } else if (step === 2) {
            this.beatHitsCount = 0;
            this.beatBar.setVisible(true);
        } else if (step === 3) {
            const { width, height } = this.scale;
            this.beatBar.setVisible(true);

            this.dummyCritic = this.add.rectangle(width * 0.72, height * 0.56, 30, 30, 0x64748b);
            this.dummyCritic.setStrokeStyle(2, 0xf43f5e).setDepth(2);
            this.dummyLabel = this.add.text(width * 0.72, height * 0.56 - 30, '▼ КРИТИК (СБЕЙ!)', {
                fontFamily: "'Jost', sans-serif",
                fontSize: '13px',
                color: '#f43f5e',
                fontStyle: 'bold',
            }).setOrigin(0.5).setDepth(5);
        } else if (step === 4) {
            const { width, height } = this.scale;

            this.tutorialSpotlight = this.add.circle(width * 0.5, height * 0.56, 28, 0xfacc15, 0.95)
                .setStrokeStyle(3, 0xffffff).setDepth(2);
            this.spotlightLabel = this.add.text(width * 0.5, height * 0.56 - 40, '★ СОФИТ ★', {
                fontFamily: "'Jost', sans-serif",
                fontSize: '14px',
                color: '#fef08a',
                fontStyle: 'bold',
            }).setOrigin(0.5).setDepth(5);
        } else if (step === 5) {
            this.time.delayedCall(1100, () => this.startGame());
        }
    }

    private refreshStepInstruction(): void {
        const isTouch = this.touch.isActive;

        if (this.step === 1) {
            this.instructionText.setText(
                isTouch
                    ? 'ШАГ 1: ДВИЖЕНИЕ\nВеди пальцем по левой половине экрана (джойстик)'
                    : 'ШАГ 1: ДВИЖЕНИЕ\nИспользуй [ WASD ] или [ СТРЕЛКИ ]'
            );
        } else if (this.step === 2) {
            const key = isTouch ? 'кнопку [РЫВОК] справа' : '[ПРОБЕЛ]';
            this.instructionText.setText(
                `ШАГ 2: ПОПАДИ В РИТМ (${this.beatHitsCount}/3)\nЖми ${key}, когда полоски сойдутся в зелёном центре`
            );
        } else if (this.step === 3) {
            const key = isTouch ? '[РЫВОК]' : '[ПРОБЕЛ]';
            this.instructionText.setText(
                `ШАГ 3: ТАРАН РЫВКОМ\nБеги на критика и нажми ${key} в ритм — сбей его!`
            );
        } else if (this.step === 4) {
            this.instructionText.setText(
                'ШАГ 4: СОФИТЫ\nПодбирай золотые софиты! 5 штук запустят Фазу 2 (Аншлаг)'
            );
        } else if (this.step === 5) {
            this.instructionText.setText('★ ПРЕВОСХОДНО! ЗАЛ ЖДЕТ! ★').setColor('#22c55e');
        }
    }

    private togglePause(): void {
        this.isPaused = !this.isPaused;
        this.pauseOverlay.setVisible(this.isPaused);
        this.touch.setGameplayVisible(!this.isPaused);
    }

    private createPauseOverlay(width: number, height: number): Phaser.GameObjects.Container {
        const overlay = this.add.container(width / 2, height / 2).setDepth(30).setVisible(false);
        const bg = this.add.rectangle(0, 0, width, height, 0x0a0205, 0.82);
        const frame = this.add.rectangle(0, 0, 360, 140, 0x1f070e, 0.95)
            .setStrokeStyle(2, 0xfbbf24)
            .setInteractive({ useHandCursor: true });

        frame.on('pointerdown', () => this.togglePause());

        const title = this.add.text(0, -24, 'ПАУЗА', {
            fontFamily: "'Jost', sans-serif",
            fontSize: '34px',
            color: '#fbbf24',
            fontStyle: 'bold',
        }).setOrigin(0.5);

        const subtitle = this.add.text(0, 26, 'Коснитесь окна, чтобы продолжить', {
            fontFamily: "'Jost', sans-serif",
            fontSize: '16px',
            color: '#fef08a',
        }).setOrigin(0.5);

        overlay.add([bg, frame, title, subtitle]);
        return overlay;
    }

    private createHeaderCards(width: number): void {
        const titles = ['1. ХОДЬБА', '2. РИТМ', '3. ТАРАН', '4. СОФИТ'];
        // Слегка сдвигаем и сжимаем при узком экране, чтобы не налезать на правые кнопки [⏸] и [📱]
        const maxArea = Math.min(640, width - 170);
        const gap = maxArea / 4;
        const cardWidth = Math.max(76, gap - 10);
        const startX = (width - 70) / 2 - gap * 1.5;

        for (let i = 0; i < 4; i++) {
            const container = this.add.container(startX + i * gap, 42);
            const bg = this.add.rectangle(0, 0, cardWidth, 38, 0x1e1b4b, 0.7).setStrokeStyle(2, 0x475569);
            const txt = this.add.text(0, 0, titles[i], {
                fontFamily: "'Jost', sans-serif",
                fontSize: cardWidth < 110 ? '11px' : '13px',
                color: '#94a3b8',
                fontStyle: 'bold',
            }).setOrigin(0.5);

            container.add([bg, txt]);
            container.setDepth(10);
            this.stepCards.push(container);
        }
    }

    private updateCardStyles(): void {
        for (let i = 0; i < 4; i++) {
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