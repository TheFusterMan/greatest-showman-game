import Phaser from 'phaser';
import { GameState } from './logic/GameState';
import { CriticManager } from './entities/CriticManager';
import { BonusManager } from './entities/BonusManager';
import { AudioSystem } from './audio/AudioSystem';
import { ParticleManager } from './vfx/ParticleManager';
import { UIManager } from './ui/UIManager';
import { GAME_CONFIG } from './logic/rules';
import { DebugPanel } from './ui/DebugPanel';

export class GameScene extends Phaser.Scene {
  private state!: GameState;
  private particles!: ParticleManager;
  private ui!: UIManager;
  private bonusManager!: BonusManager;

  private showman!: Phaser.GameObjects.Rectangle;
  private rhythmRing!: Phaser.GameObjects.Arc;
  private spotlight!: Phaser.GameObjects.Arc;
  private critics!: CriticManager;

  private spotlightPointer!: Phaser.GameObjects.Text | null;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private isDashing = false;
  private dashTimer = 0;

  // Вектор последнего движения (чтобы рывок не срабатывал на месте!)
  private lastMoveDir = { x: 1, y: 0 };

  private pauseKeyP!: Phaser.Input.Keyboard.Key;
  private pauseKeyEsc!: Phaser.Input.Keyboard.Key;
  private keyC!: Phaser.Input.Keyboard.Key;

  private shrinkingRing!: Phaser.GameObjects.Arc;
  private respawnTimer = 0;
  private dashGraceTimer = 0;

  // Виньетка сапфирового слоу-мо
  private slowMoVignette!: Phaser.GameObjects.Rectangle;

  private debugPanel!: DebugPanel;

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.ui = new UIManager(this);

    const { width, height } = this.scale;

    this.state = new GameState();
    this.particles = new ParticleManager(this);
    this.critics = new CriticManager(this);
    this.bonusManager = new BonusManager(this);

    this.critics.spawnFirstCriticWithHint();
    this.isDashing = false;
    this.keyC = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.C);

    this.drawWoodenStage(width, height);

    // Подсветка замедления времени (полноэкранный оверлей)
    this.slowMoVignette = this.add.rectangle(width / 2, height / 2, width, height, 0x0284c7, 0)
        .setDepth(1.2);

    this.spotlight = this.add.circle(width * 0.78, height * 0.5, 30, 0xfacc15, 0.95);
    this.spotlight.setStrokeStyle(3, 0xffffff);

    this.spotlightPointer = this.add.text(this.spotlight.x, this.spotlight.y - 42, '★ К СВЕТУ! ★', {
      fontFamily: "'Jost', sans-serif",
      fontSize: '14px',
      color: '#fef08a',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.showman = this.add.rectangle(width * 0.25, height * 0.5, 32, 32, 0xd90429);
    this.showman.setStrokeStyle(2, 0xfbbf24);
    this.showman.setDepth(2);

    this.rhythmRing = this.add.circle(this.showman.x, this.showman.y, 28, 0xfbbf24, 0.1);
    this.rhythmRing.setStrokeStyle(2, 0xfbbf24, 0.5).setDepth(1.9);

    this.shrinkingRing = this.add.circle(this.showman.x, this.showman.y, 28, 0xffffff, 0);
    this.shrinkingRing.setStrokeStyle(2, 0xffffff, 0.9).setDepth(1.9);

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
  
    this.debugPanel = new DebugPanel(this);
    this.setupAutoPauseOnHide();
  }

  update(_time: number, delta: number): void {
    const seconds = Math.min(delta / 1000, 0.05);

    this.debugPanel.update(seconds, {
      bpm: this.state.getCurrentBpm(),
      beatWindowMs: this.state.getCurrentBeatWindow() * 1000,
      enemiesCount: this.critics.count,
      particlesActive: this.particles.activeCount,
      particlesPool: this.particles.poolSize,
      stage: this.state.currentStage,
      act: this.state.act,
      hype: this.state.hype,
      isCasual: this.state.isCasualMode,
    });

    if (this.critics.count === 0) {
      this.respawnTimer += seconds;
      if (this.respawnTimer >= 1.5) {
        this.critics.spawnSingleCritic(this.state.currentStage === 2, this.state.isCasualMode);
        this.respawnTimer = 0;
      }
    } else {
      this.respawnTimer = 0;
    }

    if (
        Phaser.Input.Keyboard.JustDown(this.pauseKeyP) ||
        Phaser.Input.Keyboard.JustDown(this.pauseKeyEsc)
    ) {
      const isPaused = this.state.togglePause();
      this.ui.setPauseVisible(isPaused);
    }

    if (this.state.phase === 'PAUSED') return;

    if (this.state.phase === 'GAME_OVER') {
      this.particles.update(seconds);
      if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
        this.scene.restart();
      }
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.keyC)) {
      const isCasual = this.state.toggleCasualMode();
      this.ui.updateMode(isCasual);
      this.ui.showRhythmFeedback(isCasual ? 'РЕЖИМ РЕПЕТИЦИИ' : 'ШОУ (СТАНДАРТ)', isCasual ? '#22c55e' : '#facc15');
    }

    if (this.state.invulnerableTimer > 0) {
      this.state.invulnerableTimer -= seconds;
      this.showman.setAlpha(Math.sin(this.time.now * 0.03) > 0 ? 0.3 : 1);
    } else {
      this.showman.setAlpha(1);
    }

    // Визуальный оверлей слоу-мо
    if (this.state.isSlowMo) {
      this.slowMoVignette.setAlpha(0.18);
    } else {
      this.slowMoVignette.setAlpha(0);
    }
    this.ui.updateSlowMo(this.state.slowMoTimer);

    this.handleMovement(seconds);
    this.handleRhythm(seconds);
    this.updateCritics(seconds);
    this.bonusManager.update(seconds);
    this.checkBonusCollision();
    this.particles.update(seconds);
    this.checkSpotlightCollision();
  }

  private setupAutoPauseOnHide(): void {
    const pauseGame = () => {
      AudioSystem.suspend();
      if (this.state.phase === 'PLAYING') {
        const isPaused = this.state.togglePause();
        this.ui.setPauseVisible(isPaused);
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        pauseGame();
      } else {
        AudioSystem.resume();
      }
    };

    const onWindowBlur = () => pauseGame();
    const onWindowFocus = () => AudioSystem.resume();

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('focus', onWindowFocus);

    // Обязательно снимаем обработчики при рестарте сцены!
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onWindowBlur);
      window.removeEventListener('focus', onWindowFocus);
    });
  }

  private handleRhythm(seconds: number): void {
    this.ui.updatePhase(this.state.currentStage, this.state.spotlightsCaught);

    const tick = this.state.updateBeat(seconds);

    const scale = 2.4 - tick.progress * 1.4;
    this.shrinkingRing.setScale(scale);
    this.shrinkingRing.setAlpha(0.2 + tick.progress * 0.8);

    if (tick.isBeat) {
      if (tick.isKick) AudioSystem.kick();
      else AudioSystem.tambourine();

      this.critics.onBeat(tick.isKick);

      this.rhythmRing.setScale(1.2);
      this.tweens.add({
        targets: this.rhythmRing,
        strokeColor: 0xfbbf24,
        strokeAlpha: 0.5,
        duration: 180,
      });

      this.tweens.add({
        targets: this.showman,
        scaleX: 1.25,
        scaleY: 0.8,
        yoyo: true,
        duration: 110,
        ease: 'Quad.easeInOut',
      });
    }

    this.rhythmRing.setPosition(this.showman.x, this.showman.y);
    this.shrinkingRing.setPosition(this.showman.x, this.showman.y);
  }

  private handleMovement(seconds: number): void {
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey) && !this.isDashing) {
      const evaluation = this.state.evaluateBeat();
      const onBeat = evaluation.hit;

      if (onBeat || this.state.isCasualMode) {
        this.isDashing = true;
        this.dashGraceTimer = 0;
        this.dashTimer = onBeat ? 0.20 : 0.16;

        if (onBeat) {
          AudioSystem.perfectChime();
          const earned = this.state.registerHitOnBeatBonus();
          const bonus = 100 * this.state.hype;

          if (evaluation.rating === 'ОТЛИЧНО') {
            this.shrinkingRing.setStrokeStyle(3, 0xfacc15, 1);
            this.ui.showRhythmFeedback(`ОТЛИЧНО! +${bonus}`, '#facc15');
          } else {
            this.shrinkingRing.setStrokeStyle(3, 0x4ade80, 1);
            this.ui.showRhythmFeedback(`ХОРОШО! +${bonus}`, '#4ade80');
          }

          if (earned) {
            this.ui.showFloatingScore(this.showman.x, this.showman.y, bonus);
            this.ui.updateScore(this.state.applause, this.state.hype);
          } else {
            this.ui.showRhythmFeedback('★ К СОФИТУ! ★', '#fbbf24');
          }

          this.cameras.main.shake(70, 0.01);
        } else {
          this.ui.showRhythmFeedback('БЕЗОПАСНЫЙ ШАГ', '#22c55e');
        }

        // Возврат кольца к белому цвету
        this.time.delayedCall(160, () => {
          if (this.shrinkingRing) this.shrinkingRing.setStrokeStyle(2, 0xffffff, 0.9);
        });
      } else {
        this.shrinkingRing.setStrokeStyle(2, 0xef4444, 0.9);
        const reason = evaluation.rating === 'РАНО' ? 'РАНО!' : 'ПОЗДНО!';
        this.ui.showRhythmFeedback(reason, '#ef4444');

        this.time.delayedCall(160, () => {
          if (this.shrinkingRing) this.shrinkingRing.setStrokeStyle(2, 0xffffff, 0.9);
        });
      }
    }

    if (this.isDashing) {
      this.dashTimer -= seconds;
      this.particles.spawnDanceDust(this.showman.x, this.showman.y);
      if (this.dashTimer <= 0) {
        this.isDashing = false;
        this.dashGraceTimer = GAME_CONFIG.dashGraceDuration;
      }
    }

    if (this.dashGraceTimer > 0) {
      this.dashGraceTimer -= seconds;
    }

    let dx = 0;
    let dy = 0;
    if (this.cursors.left.isDown || this.wasd.left.isDown) dx -= 1;
    if (this.cursors.right.isDown || this.wasd.right.isDown) dx += 1;
    if (this.cursors.up.isDown || this.wasd.up.isDown) dy -= 1;
    if (this.cursors.down.isDown || this.wasd.down.isDown) dy += 1;

    // Запоминаем последнее направление движения
    if (dx !== 0 || dy !== 0) {
      this.lastMoveDir = { x: dx, y: dy };
    }

    // Если рывок нажат без зажатого WASD — прыгаем в lastMoveDir!
    let moveX = dx;
    let moveY = dy;
    if (this.isDashing && dx === 0 && dy === 0) {
      moveX = this.lastMoveDir.x;
      moveY = this.lastMoveDir.y;
    }

    if (moveX !== 0 || moveY !== 0) {
      const speed = this.isDashing ? GAME_CONFIG.dashSpeed : GAME_CONFIG.playerSpeed;
      const len = Math.hypot(moveX, moveY);
      this.showman.x += (moveX / len) * speed * seconds;
      this.showman.y += (moveY / len) * speed * seconds;
    }

    this.showman.x = Phaser.Math.Clamp(this.showman.x, 24, this.scale.width - 24);
    this.showman.y = Phaser.Math.Clamp(this.showman.y, 76, this.scale.height - 35);
  }

  private updateCritics(seconds: number): void {
    this.critics.update(seconds, this.showman.x, this.showman.y, this.time.now, this.state.isSlowMo);

    const isLethal = this.isDashing || this.dashGraceTimer > 0;
    const collision = this.critics.checkPlayerCollision(
        this.showman.x,
        this.showman.y,
        isLethal
    );

    // Удар по игроку
    if (collision.playerKilled && this.state.invulnerableTimer <= 0) {
      const damageResult = this.state.takeDamage();

      if (damageResult.tookDamage) {
        this.ui.updateLives(damageResult.remainingLives);
        this.ui.updateScore(this.state.applause, this.state.hype);

        if (!damageResult.survives) {
          this.particles.createConfettiExplosion(this.showman.x, this.showman.y);
          this.showman.setVisible(false);
          this.rhythmRing.setVisible(false);
          this.cameras.main.flash(350, 255, 255, 255, false);
          this.cameras.main.shake(300, 0.03);

          this.time.delayedCall(1000, () => {
            this.ui.showGameOver(this.state.applause, this.getRomanAct(this.state.act));
          });
          return;
        }

        this.cameras.main.flash(220, 225, 29, 72, false);
        this.cameras.main.shake(120, 0.015);
        this.ui.showRhythmFeedback('ОШИБКА! ЗАЛ НЕДОВОЛЕН', '#ef4444');
      }
    }

    // Критик повержен рывком!
    if (collision.defeatedAt) {
      this.particles.createConfettiExplosion(collision.defeatedAt.x, collision.defeatedAt.y);
      this.state.registerCriticDefeated();
      this.ui.updateScore(this.state.applause, this.state.hype);
      this.cameras.main.shake(120, 0.015);

      // ДРОП БОНУСА ИЗ КРИТИКА
      this.bonusManager.trySpawnFromCritic(
          collision.defeatedAt.x,
          collision.defeatedAt.y,
          this.state.lives,
          GAME_CONFIG.maxLives
      );
    }
  }

  private checkBonusCollision(): void {
    const pickup = this.bonusManager.checkCollision(this.showman.x, this.showman.y);
    if (!pickup) return;

    AudioSystem.bonusChime();
    this.particles.createConfettiExplosion(pickup.x, pickup.y);

    if (pickup.type === 'SLOW_MO') {
      this.state.activateSlowMo();
      AudioSystem.slowMoSound();
      this.ui.showRhythmFeedback('⌛ ВРЕМЯ ЗАМЕРЛО!', '#38bdf8');
      this.cameras.main.flash(180, 56, 189, 248, false);
    } else if (pickup.type === 'HEAL') {
      const healed = this.state.heal(1);
      this.ui.updateLives(this.state.lives);
      this.ui.showRhythmFeedback(healed ? '❤️ БИС! +1 ЖИЗНЬ' : '❤️ ПОЛНОЕ ЗДОРОВЬЕ', '#f43f5e');
      this.cameras.main.flash(180, 244, 63, 94, false);
    } else if (pickup.type === 'SHOCKWAVE') {
      AudioSystem.shockwaveSound();
      const destroyed = this.critics.triggerShockwave(this.showman.x, this.showman.y, 250);
      destroyed.forEach(pos => {
        this.particles.createConfettiExplosion(pos.x, pos.y);
        this.state.registerCriticDefeated();
      });
      this.ui.updateScore(this.state.applause, this.state.hype);
      this.cameras.main.shake(200, 0.025);
      this.ui.showRhythmFeedback('⚡ ОВАЦИЯ! ЗАЛ В ВОСТОРГЕ', '#facc15');
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

      if (this.spotlightPointer) {
        this.spotlightPointer.destroy();
        this.spotlightPointer = null;
      }

      this.particles.createConfettiExplosion(this.spotlight.x, this.spotlight.y);
      this.cameras.main.flash(90, 254, 240, 138, false);

      this.spotlight.setPosition(
          Phaser.Math.Between(80, this.scale.width - 80),
          Phaser.Math.Between(110, this.scale.height - 80)
      );

      const maxEnemies = Math.min(6, 2 + this.state.act);
      if (this.critics.count < maxEnemies) {
        this.critics.spawnSingleCritic(this.state.currentStage === 2, this.state.isCasualMode);
      }

      if (result.isNewAct) {
        this.ui.updateAct(this.getRomanAct(this.state.act));
        this.cameras.main.flash(200, 217, 119, 6, false);
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
  }
}