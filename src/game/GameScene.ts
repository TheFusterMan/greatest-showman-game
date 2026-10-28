import Phaser from 'phaser';
import { GameState } from './logic/GameState';
import { CriticManager } from './entities/CriticManager';
import { AudioSystem } from './audio/AudioSystem';
import { ParticleManager } from './vfx/ParticleManager';
import { UIManager } from './ui/UIManager';
import { GAME_CONFIG } from './logic/rules';

export class GameScene extends Phaser.Scene {

  private state!: GameState;
  private particles!: ParticleManager;
  private ui!: UIManager;

  private showman!: Phaser.GameObjects.Rectangle;
  private rhythmRing!: Phaser.GameObjects.Arc;
  private spotlight!: Phaser.GameObjects.Arc;
  private critics!: CriticManager;

  private playerHint!: Phaser.GameObjects.Text | null;
  private spotlightPointer!: Phaser.GameObjects.Text | null;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private isDashing = false;
  private dashTimer = 0;

  private pauseKeyP!: Phaser.Input.Keyboard.Key;
  private pauseKeyEsc!: Phaser.Input.Keyboard.Key;
  private keyC!: Phaser.Input.Keyboard.Key;

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.ui = new UIManager(this);

    const { width, height } = this.scale;

    this.state = new GameState();
    this.particles = new ParticleManager(this);
    this.critics = new CriticManager(this);
    this.critics.spawnFirstCriticWithHint();
    this.isDashing = false;
    this.keyC = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.C);

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

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    }) as any;
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.pauseKeyP = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.P);
    this.pauseKeyEsc = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
  }

  update(_time: number, delta: number): void {
    if (
        Phaser.Input.Keyboard.JustDown(this.pauseKeyP) ||
        Phaser.Input.Keyboard.JustDown(this.pauseKeyEsc)
    ) {
      const isPaused = this.state.togglePause();
      this.ui.setPauseVisible(isPaused);
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
      this.ui.updateMode(isCasual);
      this.ui.showRhythmFeedback(isCasual ? 'РЕЖИМ РЕПЕТИЦИИ ВКЛЮЧЕН' : 'ХАРДКОР ВКЛЮЧЕН', isCasual ? '#22c55e' : '#facc15');
    }

    const seconds = delta / 1000;

    this.handleRhythm(seconds);
    this.handleMovement(seconds);
    this.updateCritics(seconds);
    this.particles.update(seconds);
    this.checkSpotlightCollision();
  }

  private handleRhythm(seconds: number): void {
    this.ui.updatePhase(this.state.currentStage, this.state.spotlightsCaught);

    const tick = this.state.updateBeat(seconds);
    this.ui.updateMetronome(tick.progress);

    if (tick.isBeat) {
      if (tick.isKick) {
        AudioSystem.kick();
      } else {
        AudioSystem.tambourine();
      }
      this.critics.onBeat(tick.isKick);

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
      this.critics.dismissHint();

      const onBeat = this.state.isHitOnBeat();

      if (onBeat || this.state.isCasualMode) {
        this.isDashing = true;
        this.dashTimer = onBeat ? 0.22 : 0.18;

        if (onBeat) {
          AudioSystem.perfectChime();
          this.ui.showRhythmFeedback('ПРЕКРАСНО! ★', '#facc15');
          this.state.registerHitOnBeatBonus();
          this.ui.updateScore(this.state.applause, this.state.hype);
          this.cameras.main.shake(100, 0.015);
        } else {
          this.ui.showRhythmFeedback('БЕЗОПАСНЫЙ ШАГ', '#22c55e');
        }
      } else {
        this.ui.showRhythmFeedback('МИМО!', '#94a3b8');
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
    // 1. Обновляем движение критиков и AI стаи
    this.critics.update(seconds, this.showman.x, this.showman.y, this.time.now);

    // 2. Проверяем коллизию с игроком
    const collision = this.critics.checkPlayerCollision(
        this.showman.x,
        this.showman.y,
        this.isDashing
    );

    // Случай 1: Игрок врезался без рывка -> Конец игры
    if (collision.playerKilled) {
      this.state.triggerGameOver();
      this.ui.showGameOver(this.state.applause, this.getRomanAct(this.state.act));
      return;
    }

    // Случай 2: Игрок сбил критика в рывке -> Овации и салют
    if (collision.defeatedAt) {
      this.particles.createConfettiExplosion(collision.defeatedAt.x, collision.defeatedAt.y);
      this.state.registerCriticDefeated();
      this.ui.updateScore(this.state.applause, this.state.hype);
      this.cameras.main.shake(120, 0.015);

      this.time.delayedCall(1600, () => {
        if (this.state.phase === 'PLAYING') {
          this.critics.spawnSingleCritic(this.state.currentStage === 2, this.state.isCasualMode);
        }
      });
    }
  }

  private checkSpotlightCollision(): void {
    const dist = Phaser.Math.Distance.Between(this.showman.x, this.showman.y, this.spotlight.x, this.spotlight.y);
    if (dist < 36) {
      const result = this.state.registerSpotlightCaught();
      this.ui.updateScore(this.state.applause, this.state.hype);

      if (result.phaseSwitched) {
        this.ui.showPhase2Alert();
      }
      this.ui.updateScore(this.state.applause, this.state.hype);

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
      if (this.critics.count < maxEnemies) {
        this.critics.spawnSingleCritic(this.state.currentStage === 2, this.state.isCasualMode);
      }

      if (result.isNewAct) {
        this.ui.updateAct(this.getRomanAct(this.state.act));
        this.cameras.main.flash(200, 217, 119, 6, false);
        this.critics.spawnSingleCritic(this.state.currentStage === 2, this.state.isCasualMode);
      }
    }
  }

  private getRomanAct(act: number): string {
    const romans = ['I', 'II', 'III', 'IV', 'V', 'VI'];
    return romans[act - 1] || act.toString();
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
}