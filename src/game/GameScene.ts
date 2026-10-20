import Phaser from 'phaser';
import { GameState } from './logic/GameState';
import { AudioSystem } from './audio/AudioSystem';
import { ParticleManager } from './vfx/ParticleManager';
import { GAME_CONFIG } from './logic/rules';

const PLAYER_SPEED = 300;
const DASH_SPEED = 800;

interface Enemy {
  obj: Phaser.GameObjects.Rectangle;
  speed: number;
}

export class GameScene extends Phaser.Scene {

  private state!: GameState;
  private particles!: ParticleManager;

  private showman!: Phaser.GameObjects.Rectangle;
  private rhythmRing!: Phaser.GameObjects.Arc;
  private spotlight!: Phaser.GameObjects.Arc;
  private enemies: Enemy[] = [];

  private playerHint!: Phaser.GameObjects.Text | null;
  private enemyHint!: Phaser.GameObjects.Text | null;
  private spotlightPointer!: Phaser.GameObjects.Text | null;

  private beatBars: Phaser.GameObjects.Rectangle[] = [];

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private isDashing = false;
  private dashTimer = 0;

  private applauseText!: Phaser.GameObjects.Text;
  private hypeText!: Phaser.GameObjects.Text;
  private actText!: Phaser.GameObjects.Text;
  private rhythmFeedbackText!: Phaser.GameObjects.Text;

  private pauseKeyP!: Phaser.Input.Keyboard.Key;
  private pauseKeyEsc!: Phaser.Input.Keyboard.Key;
  private pauseOverlay!: Phaser.GameObjects.Container;

  private timerText!: Phaser.GameObjects.Text;

  private keyC!: Phaser.Input.Keyboard.Key;
  private modeText!: Phaser.GameObjects.Text;

  constructor() {
    super('GameScene');
  }

  create(): void {
    const { width, height } = this.scale;

    this.state = new GameState();
    this.particles = new ParticleManager(this);
    this.enemies = [];
    this.beatBars = [];
    this.isDashing = false;
    this.keyC = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.C);

    this.modeText = this.add.text(28, height - 30, '[C] РЕЖИМ: ШОУ (ХАРДКОР)', {
      fontFamily: 'Georgia, serif',
      fontSize: '14px',
      color: '#94a3b8',
    }).setDepth(5);

    this.drawWoodenStage(width, height);

    this.spotlight = this.add.circle(width * 0.78, height * 0.5, 30, 0xfacc15, 0.95);
    this.spotlight.setStrokeStyle(3, 0xffffff);

    this.spotlightPointer = this.add.text(this.spotlight.x, this.spotlight.y - 42, '★ К СВЕТУ! ★', {
      fontFamily: 'Georgia, serif',
      fontSize: '14px',
      color: '#fef08a',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.showman = this.add.rectangle(width * 0.25, height * 0.5, 32, 32, 0xd90429);
    this.showman.setStrokeStyle(2, 0xfbbf24);
    this.showman.setDepth(1);

    this.rhythmRing = this.add.circle(this.showman.x, this.showman.y, 42, 0xfbbf24, 0);
    this.rhythmRing.setStrokeStyle(2, 0xfbbf24, 0.8).setDepth(1);

    this.playerHint = this.add.text(this.showman.x, this.showman.y - 32, '[ WASD ] ШАГИ', {
      fontFamily: 'Georgia, serif',
      fontSize: '14px',
      color: '#fef08a',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.createRhythmMetronome(width, height);

    this.applauseText = this.add.text(28, 24, 'ОВАЦИИ: 0', {
      fontFamily: 'Georgia, serif',
      fontSize: '24px',
      color: '#fef08a',
      fontStyle: 'bold',
    }).setDepth(5);

    this.hypeText = this.add.text(28, 56, 'СЕРИЯ: x1', {
      fontFamily: 'Georgia, serif',
      fontSize: '18px',
      color: '#f43f5e',
      fontStyle: 'bold',
    }).setDepth(5);

    this.actText = this.add.text(width / 2, 22, '— АКТ I —', {
      fontFamily: 'Georgia, serif',
      fontSize: '26px',
      color: '#fbbf24',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0).setDepth(5);

    this.timerText = this.add.text(width - 28, 24, 'ФАЗА 1 • 00:00', {
      fontFamily: 'Georgia, serif',
      fontSize: '20px',
      color: '#fef08a',
      fontStyle: 'bold',
    }).setOrigin(1, 0).setDepth(5);

    this.rhythmFeedbackText = this.add.text(width / 2, height - 60, '', {
      fontFamily: 'Georgia, serif',
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#facc15',
    }).setOrigin(0.5).setDepth(5);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    }) as any;
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.spawnFirstCriticWithHint();

    this.pauseKeyP = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.P);
    this.pauseKeyEsc = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

    this.createPauseOverlay(width, height);

    this.time.delayedCall(8000, () => {
      if (this.enemyHint) {
        this.enemyHint.destroy();
        this.enemyHint = null;
      }
    });
  }

  update(_time: number, delta: number): void {
    if (
        Phaser.Input.Keyboard.JustDown(this.pauseKeyP) ||
        Phaser.Input.Keyboard.JustDown(this.pauseKeyEsc)
    ) {
      const isPaused = this.state.togglePause();
      this.pauseOverlay.setVisible(isPaused);
    }

    if (this.state.phase === 'PAUSED') {
      return;
    }

    if (this.state.phase === 'GAME_OVER') {
      if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
        this.scene.restart();
      }
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.keyC)) {
      const isCasual = this.state.toggleCasualMode();
      this.modeText.setText(isCasual ? '[C] РЕЖИМ: РЕПЕТИЦИЯ (КАЗУАЛ)' : '[C] РЕЖИМ: ШОУ (ХАРДКОР)');
      this.modeText.setColor(isCasual ? '#22c55e' : '#94a3b8');
      this.showRhythmFeedback(isCasual ? 'РЕЖИМ РЕПЕТИЦИИ ВКЛЮЧЕН' : 'ХАРДКОР ВКЛЮЧЕН', isCasual ? '#22c55e' : '#facc15');
    }

    const seconds = delta / 1000;

    this.handleRhythm(seconds);
    this.handleMovement(seconds);
    this.updateCritics(seconds);
    this.particles.update(seconds);
    this.checkSpotlightCollision();
  }

  private handleRhythm(seconds: number): void {
    const totalSec = Math.floor(this.state.gameTime);
    const mins = Math.floor(totalSec / 60).toString().padStart(2, '0');
    const secs = (totalSec % 60).toString().padStart(2, '0');

    if (this.state.currentStage === 2) {
      this.timerText.setText('ФАЗА 2 • АНШЛАГ!').setColor('#f97316');
    } else {
      this.timerText.setText(`ФАЗА 1 • СОФИТЫ: ${this.state.spotlightsCaught}/5`);
    }

    const tick = this.state.updateBeat(seconds);

    const { width } = this.scale;
    const offset = (1 - tick.progress) * 150;
    this.beatBars[0].x = width / 2 - offset;
    this.beatBars[1].x = width / 2 + offset;

    if (tick.isBeat) {
      if (tick.isKick) {
        AudioSystem.kick();
        if (this.enemyHint) {
          this.enemyHint.setColor('#ffffff');
          this.tweens.add({ targets: this.enemyHint, scale: 1.15, yoyo: true, duration: 120 });
        }
      } else {
        AudioSystem.tambourine();
        if (this.enemyHint) {
          this.enemyHint.setColor('#f43f5e');
        }
      }

      this.rhythmRing.setScale(1.2);
      this.tweens.add({
        targets: this.rhythmRing,
        scaleX: 0.9,
        scaleY: 0.9,
        duration: 380,
        ease: 'Sine.easeOut',
      });
    }

    this.rhythmRing.setPosition(this.showman.x, this.showman.y);
  }

  private handleMovement(seconds: number): void {
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey) && !this.isDashing) {
      if (this.enemyHint) {
        this.enemyHint.destroy();
        this.enemyHint = null;
      }

      const onBeat = this.state.isHitOnBeat();

      if (onBeat || this.state.isCasualMode) {
        this.isDashing = true;
        this.dashTimer = onBeat ? 0.22 : 0.18;

        if (onBeat) {
          AudioSystem.perfectChime();
          this.showRhythmFeedback('ПРЕКРАСНО! ★', '#facc15');
          this.state.registerHitOnBeatBonus();
          this.updateScoreUI();
          this.cameras.main.shake(100, 0.015);
        } else {
          this.showRhythmFeedback('БЕЗОПАСНЫЙ ШАГ', '#22c55e');
        }
      } else {
        this.showRhythmFeedback('МИМО!', '#94a3b8');
      }
    }

    if (this.isDashing) {
      this.dashTimer -= seconds;
      this.particles.spawnDanceDust(this.showman.x, this.showman.y);
      if (this.dashTimer <= 0) {
        this.isDashing = false;
      }
    }

    let dx = 0;
    let dy = 0;
    if (this.cursors.left.isDown || this.wasd.left.isDown) dx -= 1;
    if (this.cursors.right.isDown || this.wasd.right.isDown) dx += 1;
    if (this.cursors.up.isDown || this.wasd.up.isDown) dy -= 1;
    if (this.cursors.down.isDown || this.wasd.down.isDown) dy += 1;

    if (dx !== 0 || dy !== 0) {
      if (this.playerHint) {
        this.playerHint.destroy();
        this.playerHint = null;
      }

      const speed = this.isDashing ? GAME_CONFIG.dashSpeed : GAME_CONFIG.playerSpeed;
      const len = Math.hypot(dx, dy);
      this.showman.x += (dx / len) * speed * seconds;
      this.showman.y += (dy / len) * speed * seconds;
    }

    if (this.playerHint) {
      this.playerHint.setPosition(this.showman.x, this.showman.y - 32);
    }

    this.showman.x = Phaser.Math.Clamp(this.showman.x, 24, this.scale.width - 24);
    this.showman.y = Phaser.Math.Clamp(this.showman.y, 76, this.scale.height - 35);
  }

  private updateCritics(seconds: number): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e || !e.obj) continue;

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

      const baseAngle = Phaser.Math.Angle.Between(e.obj.x, e.obj.y, this.showman.x, this.showman.y);
      const flankOffset = Math.sin(this.time.now * 0.002 + i) * 0.25;
      const moveAngle = baseAngle + flankOffset;

      e.obj.x += Math.cos(moveAngle) * e.speed * seconds;
      e.obj.y += Math.sin(moveAngle) * e.speed * seconds;

      if (i === 0 && this.enemyHint) {
        this.enemyHint.setPosition(e.obj.x, e.obj.y - 34);
      }

      const distToPlayer = Phaser.Math.Distance.Between(this.showman.x, this.showman.y, e.obj.x, e.obj.y);

      if (distToPlayer < 32) {
        if (this.isDashing) {
          if (this.enemyHint) {
            this.enemyHint.destroy();
            this.enemyHint = null;
          }

          this.particles.createConfettiExplosion(e.obj.x, e.obj.y);
          e.obj.destroy();
          this.enemies.splice(i, 1);

          this.state.registerCriticDefeated();
          this.updateScoreUI();
          this.cameras.main.shake(120, 0.015);

          this.time.delayedCall(1600, () => {
            if (this.state.phase === 'PLAYING') this.spawnSingleCritic();
          });
        } else {
          this.state.triggerGameOver();
          this.showGameOverUI();
          return;
        }
      }
    }
  }

  private checkSpotlightCollision(): void {
    const dist = Phaser.Math.Distance.Between(this.showman.x, this.showman.y, this.spotlight.x, this.spotlight.y);
    if (dist < 36) {
      const result = this.state.registerSpotlightCaught();
      this.updateScoreUI();

      if (result.phaseSwitched) {
        this.triggerPhase2Alert();
      }
      this.updateScoreUI();

      if (this.spotlightPointer) {
        this.spotlightPointer.destroy();
        this.spotlightPointer = null;
      }

      this.cameras.main.flash(90, 254, 240, 138, false);
      this.spotlight.setPosition(
          Phaser.Math.Between(80, this.scale.width - 80),
          Phaser.Math.Between(110, this.scale.height - 80)
      );

      const maxEnemies = (2 + this.state.act * 2) * (this.state.currentStage === 2 ? 2 : 1);
      if (this.enemies.length < maxEnemies) {
        this.spawnSingleCritic();
      }

      if (result.isNewAct) {
        this.actText.setText(`— АКТ ${this.getRomanAct(this.state.act)} —`);
        this.cameras.main.flash(200, 217, 119, 6, false);
        this.spawnSingleCritic();
      }
    }
  }

  private updateScoreUI(): void {
    this.applauseText.setText(`ОВАЦИИ: ${this.state.applause.toLocaleString()}`);
    this.hypeText.setText(`СЕРИЯ: x${this.state.hype}`);
  }

  private getRomanAct(act: number): string {
    const romans = ['I', 'II', 'III', 'IV', 'V', 'VI'];
    return romans[act - 1] || act.toString();
  }

  private showRhythmFeedback(text: string, color: string): void {
    this.rhythmFeedbackText.setText(text).setColor(color).setAlpha(1);
    this.tweens.add({ targets: this.rhythmFeedbackText, alpha: 0, duration: 600 });
  }

  private drawWoodenStage(width: number, height: number): void {
    this.add.rectangle(width / 2, height / 2, width, height, 0x180509);
    const stageGfx = this.add.graphics();
    stageGfx.lineStyle(1, 0x2d0c14, 0.7);

    for (let y = 0; y < height; y += 36) {
      stageGfx.lineBetween(0, y, width, y);
    }

    this.add.rectangle(width / 2, height - 6, width, 12, 0x451a03);
    for (let x = 30; x < width; x += 50) {
      this.add.circle(x, height - 7, 4, 0xfbbf24, 0.9);
    }
  }

  private createRhythmMetronome(width: number, height: number): void {
    const centerY = height - 26;
    this.add.rectangle(width / 2, centerY, 320, 16, 0x090204, 0.75).setStrokeStyle(1, 0x78350f).setDepth(5);
    this.add.rectangle(width / 2, centerY, 6, 20, 0xfbbf24).setDepth(5);

    const barLeft = this.add.rectangle(width / 2 - 150, centerY, 4, 14, 0xf59e0b).setDepth(5);
    const barRight = this.add.rectangle(width / 2 + 150, centerY, 4, 14, 0xf59e0b).setDepth(5);
    this.beatBars.push(barLeft, barRight);
  }

  private spawnFirstCriticWithHint(): void {
    const x = this.scale.width - 120;
    const y = this.scale.height / 2;
    const criticObj = this.add.rectangle(x, y, 28, 28, 0x475569);
    criticObj.setStrokeStyle(1, 0x94a3b8).setDepth(1);
    this.enemies.push({ obj: criticObj, speed: 120 });

    this.enemyHint = this.add.text(x, y - 34, '▼ [ ПРОБЕЛ В РИТМ ] РЫВОК!', {
      fontFamily: 'Georgia, serif',
      fontSize: '14px',
      color: '#f43f5e',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(5);
  }

  private spawnSingleCritic(): void {
    const x = Math.random() > 0.5 ? 40 : this.scale.width - 40;
    const y = Phaser.Math.Between(110, this.scale.height - 80);

    const isPhase2 = this.state.currentStage === 2;
    const speedRange = isPhase2 ? GAME_CONFIG.criticSpeedPhase2 : GAME_CONFIG.criticSpeedPhase1;
    const casualMultiplier = this.state.isCasualMode ? GAME_CONFIG.casualSpeedMultiplier : 1.0;
    const speed = Math.round(Phaser.Math.Between(speedRange.min, speedRange.max) * casualMultiplier);
    const color = isPhase2 ? 0xf97316 : 0x475569;

    const criticObj = this.add.rectangle(x, y, 28, 28, color);
    criticObj.setStrokeStyle(1, isPhase2 ? 0xfbbf24 : 0x94a3b8).setDepth(1);
    this.enemies.push({ obj: criticObj, speed });
  }

  private showGameOverUI(): void {
    const { width, height } = this.scale;

    this.cameras.main.shake(300, 0.03);
    this.add.rectangle(width / 2, height / 2, width, height, 0x110206, 0.9).setDepth(20);

    this.add.text(width / 2, height * 0.35, 'ЗАНАВЕС ОПУСКАЕТСЯ', {
      fontFamily: 'Georgia, serif',
      fontSize: '56px',
      color: '#e11d48',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(21);

    this.add.text(width / 2, height * 0.52, `ОВАЦИИ: ${this.state.applause}\nЗАВЕРШЕНО: АКТ ${this.getRomanAct(this.state.act)}`, {
      fontFamily: 'Georgia, serif',
      fontSize: '22px',
      color: '#fef08a',
      align: 'center',
      lineSpacing: 10,
    }).setOrigin(0.5).setDepth(21);

    this.add.text(width / 2, height * 0.72, 'НАЖМИТЕ [ПРОБЕЛ] ЧТОБЫ ПОВТОРИТЬ ШОУ', {
      fontFamily: 'Georgia, serif',
      fontSize: '20px',
      color: '#fbbf24',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(21);
  }

  private createPauseOverlay(width: number, height: number): void {
    this.pauseOverlay = this.add.container(width / 2, height / 2);

    const bg = this.add.rectangle(0, 0, width, height, 0x0a0205, 0.85);
    const frame = this.add.rectangle(0, 0, 480, 160, 0x1f070e, 0.95).setStrokeStyle(2, 0xfbbf24);

    const title = this.add.text(0, -30, '— АНТРАКТ —', {
      fontFamily: 'Georgia, serif',
      fontSize: '44px',
      color: '#fbbf24',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const subtitle = this.add.text(0, 30, 'ШОУ НА ПАУЗЕ\nНажмите [P] или [ESC], чтобы продолжить', {
      fontFamily: 'Georgia, serif',
      fontSize: '18px',
      color: '#fef08a',
      align: 'center',
      lineSpacing: 8,
    }).setOrigin(0.5);

    this.pauseOverlay.add([bg, frame, title, subtitle]);
    this.pauseOverlay.setDepth(30);
    this.pauseOverlay.setVisible(false);
  }

  private triggerPhase2Alert(): void {
    const { width, height } = this.scale;
    this.cameras.main.flash(400, 249, 115, 22, false);
    this.cameras.main.shake(200, 0.02);

    this.spawnSingleCritic();
    this.spawnSingleCritic();

    const banner = this.add.text(width / 2, height / 2 - 40, '★ ФАЗА 2: АНШЛАГ! ★\nКРИТИКИ УСКОРЯЮТСЯ', {
      fontFamily: 'Georgia, serif',
      fontSize: '32px',
      color: '#f97316',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5).setDepth(25);

    this.tweens.add({
      targets: banner,
      scaleX: 1.2,
      scaleY: 1.2,
      alpha: 0,
      duration: 2500,
      onComplete: () => banner.destroy(),
    });
  }
}