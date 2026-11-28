import Phaser from 'phaser';
import { AudioSystem } from '../audio/AudioSystem';

export interface TouchControlCallbacks {
    onPauseToggle: () => void;
    onModeToggle?: () => void;
}

export class TouchControls {
    private static manualOverride: boolean | null = null;

    private gameplayContainer: Phaser.GameObjects.Container;
    private hudButtonsContainer: Phaser.GameObjects.Container;
    private toggleBadge!: Phaser.GameObjects.Text;

    private joyBase: Phaser.GameObjects.Arc;
    private joyKnob: Phaser.GameObjects.Arc;
    private dashOuter: Phaser.GameObjects.Arc;
    private dashInner: Phaser.GameObjects.Arc;
    private dashText: Phaser.GameObjects.Text;
    private modeBtnBg!: Phaser.GameObjects.Rectangle;
    private modeBtnText!: Phaser.GameObjects.Text;

    private restJoyX: number;
    private restJoyY: number;
    private readonly maxJoyRadius = 46;
    private readonly deadZone = 7;

    // Отслеживаем конкретный палец через DOM-события по всему экрану
    private activeTouchId: number | null = null;
    private mouseJoystickActive = false;
    private joyOriginX = 0;
    private joyOriginY = 0;

    public moveX = 0;
    public moveY = 0;
    private dashQueued = false;

    private visible = false;
    private gameplayVisible = true;
    private wasInWindow = false;
    private toggleKeyT: Phaser.Input.Keyboard.Key;

    constructor(private scene: Phaser.Scene, private callbacks: TouchControlCallbacks) {
        const { width, height } = scene.scale;

        scene.input.addPointer(2);

        this.restJoyX = 115;
        this.restJoyY = height - 105;

        this.gameplayContainer = scene.add.container(0, 0).setDepth(25);
        this.hudButtonsContainer = scene.add.container(0, 0).setDepth(35);

        // --- Виртуальный джойстик ---
        this.joyBase = scene.add.circle(this.restJoyX, this.restJoyY, 48, 0xffffff, 0.08)
            .setStrokeStyle(2, 0xfbbf24, 0.35);
        this.joyKnob = scene.add.circle(this.restJoyX, this.restJoyY, 22, 0xfbbf24, 0.45)
            .setStrokeStyle(2, 0xffffff, 0.7);

        this.gameplayContainer.add([this.joyBase, this.joyKnob]);

        // --- Кнопка рывка (справа снизу) ---
        const dashX = width - 115;
        const dashY = height - 105;

        this.dashOuter = scene.add.circle(dashX, dashY, 50, 0xd90429, 0.25)
            .setStrokeStyle(3, 0xfbbf24, 0.6);
        this.dashInner = scene.add.circle(dashX, dashY, 38, 0xd90429, 0.55)
            .setStrokeStyle(2, 0xffffff, 0.7);
        this.dashText = scene.add.text(dashX, dashY, 'РЫВОК', {
            fontFamily: "'Jost', sans-serif",
            fontSize: '13px',
            fontStyle: 'bold',
            color: '#fef08a',
        }).setOrigin(0.5);

        this.gameplayContainer.add([this.dashOuter, this.dashInner, this.dashText]);

        // --- Верхние правые кнопки (Пауза + Смена режима) ---
        const pauseBg = scene.add.rectangle(width - 36, 36, 44, 38, 0x1f070e, 0.85)
            .setStrokeStyle(2, 0xfbbf24, 0.7)
            .setInteractive({ useHandCursor: true });
        const pauseLabel = scene.add.text(width - 36, 36, '⏸', {
            fontSize: '18px',
            color: '#fef08a',
        }).setOrigin(0.5);

        pauseBg.on('pointerdown', () => {
            AudioSystem.resume();
            this.callbacks.onPauseToggle();
        });

        this.hudButtonsContainer.add([pauseBg, pauseLabel]);

        if (this.callbacks.onModeToggle) {
            this.modeBtnBg = scene.add.rectangle(width - 110, 36, 90, 38, 0x1f070e, 0.85)
                .setStrokeStyle(1, 0x94a3b8, 0.8)
                .setInteractive({ useHandCursor: true });
            this.modeBtnText = scene.add.text(width - 110, 36, 'ШОУ', {
                fontFamily: "'Jost', sans-serif",
                fontSize: '12px',
                fontStyle: 'bold',
                color: '#fef08a',
            }).setOrigin(0.5);

            this.modeBtnBg.on('pointerdown', () => {
                AudioSystem.resume();
                this.callbacks.onModeToggle?.();
            });

            this.hudButtonsContainer.add([this.modeBtnBg, this.modeBtnText]);
        }

        // Кнопка переключения тач-режима
        this.toggleBadge = scene.add.text(width - 14, 72, '📱 [T]', {
            fontFamily: "'Jost', sans-serif",
            fontSize: '12px',
            fontStyle: 'bold',
            color: '#94a3b8',
            backgroundColor: '#1f070ecc',
            padding: { x: 8, y: 4 },
        })
            .setOrigin(1, 0.5)
            .setDepth(36)
            .setInteractive({ useHandCursor: true });

        this.toggleBadge.on('pointerdown', () => {
            AudioSystem.resume();
            this.toggleManual();
        });

        // Кнопка полного экрана
        const fsBadge = scene.add.text(width - 82, 72, '⛶', {
            fontFamily: "'Jost', sans-serif",
            fontSize: '14px',
            fontStyle: 'bold',
            color: '#94a3b8',
            backgroundColor: '#1f070ecc',
            padding: { x: 8, y: 3 },
        })
            .setOrigin(1, 0.5)
            .setDepth(36)
            .setInteractive({ useHandCursor: true });

        fsBadge.on('pointerdown', async () => {
            AudioSystem.resume();
            if (document.fullscreenElement) {
                await document.exitFullscreen().catch(() => {});
            } else {
                try {
                    await document.documentElement.requestFullscreen?.();
                    await (screen.orientation as any)?.lock?.('landscape');
                } catch {}
            }
        });

        const isCoarsePointer = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
        const isTouchCapable = !scene.sys.game.device.os.desktop || scene.sys.game.device.input.touch || isCoarsePointer;
        this.setVisible(TouchControls.manualOverride ?? isTouchCapable);

        this.toggleKeyT = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.T);
        this.bindPointerEvents();
    }

    private toggleManual(): void {
        const next = !this.visible;
        TouchControls.manualOverride = next;
        this.setVisible(next);
    }

    public get isActive(): boolean {
        return this.visible;
    }

    public setVisible(show: boolean): void {
        this.visible = show;
        this.gameplayContainer.setVisible(show && this.gameplayVisible);
        this.hudButtonsContainer.setVisible(show);
        this.toggleBadge?.setColor(show ? '#4ade80' : '#94a3b8');
        if (!show) {
            this.resetJoystick();
        }
    }

    public setGameplayVisible(show: boolean): void {
        this.gameplayVisible = show;
        this.gameplayContainer.setVisible(this.visible && show);
        if (!show) {
            this.resetJoystick();
        }
    }

    public updateModeLabel(isCasual: boolean): void {
        if (!this.modeBtnText) return;
        this.modeBtnText.setText(isCasual ? 'КАЗУАЛ' : 'ШОУ');
        this.modeBtnBg.setStrokeStyle(1, isCasual ? 0x22c55e : 0x94a3b8, 0.9);
    }

    public consumeDashPressed(): boolean {
        if (this.dashQueued) {
            this.dashQueued = false;
            return true;
        }
        return false;
    }

    public update(inWindow: boolean, isBeat: boolean): void {
        if (Phaser.Input.Keyboard.JustDown(this.toggleKeyT)) {
            this.toggleManual();
        }

        if (!this.visible || !this.gameplayVisible) return;

        if (inWindow !== this.wasInWindow) {
            this.wasInWindow = inWindow;
            if (inWindow) {
                this.dashOuter.setStrokeStyle(3, 0x4ade80, 1).setFillStyle(0x22c55e, 0.35);
                this.dashInner.setFillStyle(0x16a34a, 0.75);
            } else {
                this.dashOuter.setStrokeStyle(3, 0xfbbf24, 0.6).setFillStyle(0xd90429, 0.25);
                this.dashInner.setFillStyle(0xd90429, 0.55);
            }
        }

        if (isBeat) {
            this.scene.tweens.killTweensOf(this.dashOuter);
            this.dashOuter.setScale(1.14);
            this.scene.tweens.add({
                targets: this.dashOuter,
                scale: 1,
                duration: 130,
                ease: 'Quad.easeOut',
            });
        }
    }

    private bindPointerEvents(): void {
        const { width } = this.scene.scale;
        const canvas = this.scene.game.canvas;

        const toGameCoords = (clientX: number, clientY: number) => {
            const rect = canvas.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return null;
            return {
                x: ((clientX - rect.left) / rect.width) * this.scene.scale.width,
                y: ((clientY - rect.top) / rect.height) * this.scene.scale.height,
            };
        };

        // 1) Старт касания/клика внутри холста (с учётом кнопок UI)
        const onPhaserDown = (pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
            AudioSystem.resume();

            if (currentlyOver.length > 0) return;

            if (pointer.wasTouch && !this.visible) {
                TouchControls.manualOverride = true;
                this.setVisible(true);
            }

            if (!this.visible || !this.gameplayVisible) return;

            if (pointer.x < width * 0.5 && this.activeTouchId === null && !this.mouseJoystickActive) {
                if (pointer.wasTouch && 'changedTouches' in pointer.event) {
                    const touch = (pointer.event as TouchEvent).changedTouches[0];
                    if (touch) {
                        this.activeTouchId = touch.identifier;
                        this.startJoystickAt(pointer.x, pointer.y);
                    }
                } else {
                    this.mouseJoystickActive = true;
                    this.startJoystickAt(pointer.x, pointer.y);
                }
            } else if (pointer.x >= width * 0.5 && pointer.y > 85) {
                this.triggerDashFeedback();
            }
        };

        // 2) Старт касания на тёмных боковых полосах ВНЕ холста
        const onDomTouchStart = (e: TouchEvent) => {
            AudioSystem.resume();
            if (e.target === canvas) return;
            if (!this.visible || !this.gameplayVisible) return;

            for (let i = 0; i < e.changedTouches.length; i++) {
                const t = e.changedTouches[i];
                const pos = toGameCoords(t.clientX, t.clientY);
                if (!pos) continue;

                if (pos.x < width * 0.5 && this.activeTouchId === null && !this.mouseJoystickActive) {
                    this.activeTouchId = t.identifier;
                    this.startJoystickAt(pos.x, pos.y);
                } else if (pos.x >= width * 0.5 && pos.y > 85) {
                    this.triggerDashFeedback();
                }
            }
        };

        // 3) Непрерывный трекинг пальца по ВСЕМУ экрану (включая поля за пределами холста!)
        const onDomTouchMove = (e: TouchEvent) => {
            if (this.activeTouchId === null) return;
            for (let i = 0; i < e.changedTouches.length; i++) {
                const t = e.changedTouches[i];
                if (t.identifier === this.activeTouchId) {
                    const pos = toGameCoords(t.clientX, t.clientY);
                    if (pos) this.updateJoystickVector(pos.x, pos.y);
                    break;
                }
            }
        };

        const onDomTouchEnd = (e: TouchEvent) => {
            if (this.activeTouchId === null) return;
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === this.activeTouchId) {
                    this.resetJoystick();
                    break;
                }
            }
        };

        // 4) Поддержка перетаскивания мышью за границы холста (для теста на ПК)
        const onDomMouseMove = (e: MouseEvent) => {
            if (!this.mouseJoystickActive) return;
            const pos = toGameCoords(e.clientX, e.clientY);
            if (pos) this.updateJoystickVector(pos.x, pos.y);
        };

        const onDomMouseUp = () => {
            if (this.mouseJoystickActive) {
                this.resetJoystick();
            }
        };

        const onBlur = () => this.resetJoystick();

        this.scene.input.on('pointerdown', onPhaserDown);

        window.addEventListener('touchstart', onDomTouchStart, { passive: true });
        window.addEventListener('touchmove', onDomTouchMove, { passive: true });
        window.addEventListener('touchend', onDomTouchEnd, { passive: true });
        window.addEventListener('touchcancel', onDomTouchEnd, { passive: true });
        window.addEventListener('mousemove', onDomMouseMove);
        window.addEventListener('mouseup', onDomMouseUp);
        window.addEventListener('blur', onBlur);

        this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.scene.input.off('pointerdown', onPhaserDown);

            window.removeEventListener('touchstart', onDomTouchStart);
            window.removeEventListener('touchmove', onDomTouchMove);
            window.removeEventListener('touchend', onDomTouchEnd);
            window.removeEventListener('touchcancel', onDomTouchEnd);
            window.removeEventListener('mousemove', onDomMouseMove);
            window.removeEventListener('mouseup', onDomMouseUp);
            window.removeEventListener('blur', onBlur);
        });
    }

    private startJoystickAt(gx: number, gy: number): void {
        const { width, height } = this.scene.scale;
        this.joyOriginX = Phaser.Math.Clamp(gx, 60, width * 0.45);
        this.joyOriginY = Phaser.Math.Clamp(gy, 110, height - 60);

        this.joyBase.setPosition(this.joyOriginX, this.joyOriginY).setAlpha(0.7);
        this.joyKnob.setPosition(this.joyOriginX, this.joyOriginY).setAlpha(0.95);
        this.updateJoystickVector(gx, gy);
    }

    private triggerDashFeedback(): void {
        this.dashQueued = true;
        this.dashInner.setScale(0.88);
        this.scene.time.delayedCall(90, () => {
            if (this.dashInner) this.dashInner.setScale(1);
        });
    }

    private updateJoystickVector(px: number, py: number): void {
        const dx = px - this.joyOriginX;
        const dy = py - this.joyOriginY;
        const dist = Math.hypot(dx, dy);

        if (dist <= this.deadZone) {
            this.moveX = 0;
            this.moveY = 0;
            this.joyKnob.setPosition(this.joyOriginX, this.joyOriginY);
            return;
        }

        const clamped = Math.min(dist, this.maxJoyRadius);
        const nx = dx / dist;
        const ny = dy / dist;

        this.joyKnob.setPosition(this.joyOriginX + nx * clamped, this.joyOriginY + ny * clamped);
        this.moveX = nx;
        this.moveY = ny;
    }

    private resetJoystick(): void {
        this.activeTouchId = null;
        this.mouseJoystickActive = false;
        this.moveX = 0;
        this.moveY = 0;
        this.joyBase.setPosition(this.restJoyX, this.restJoyY).setAlpha(1);
        this.joyKnob.setPosition(this.restJoyX, this.restJoyY).setAlpha(1);
    }
}