import Phaser from 'phaser';

const PLAYER_SPEED = 300;
const DASH_SPEED = 800;
const BPM = 126;
const BEAT_TIME = 60 / BPM;

class RhythmAudio {
  private static ctx: AudioContext | null = null;

  static getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  static kick() {
    try {
      const ctx = this.getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.setValueAtTime(140, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(35, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {}
  }

  static tambourine() {
    try {
      const ctx = this.getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch {}
  }

  static perfectChime() {
    try {
      const ctx = this.getCtx();
      [587.33, 880.0, 1174.66].forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, ctx.currentTime + i * 0.04);
        gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.04);
        osc.stop(ctx.currentTime + 0.3);
      });
    } catch {}
  }
}

interface Enemy {
  obj: Phaser.GameObjects.Rectangle;
  speed: number;
}

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

export class GameScene extends Phaser.Scene {
  private showman!: Phaser.GameObjects.Rectangle;
  private rhythmRing!: Phaser.GameObjects.Arc;
  private spotlight!: Phaser.GameObjects.Arc;

  private playerHint!: Phaser.GameObjects.Text | null;
  private enemyHint!: Phaser.GameObjects.Text | null;
  private spotlightPointer!: Phaser.GameObjects.Text | null;

  // Ритм-система
  private beatTimer = 0;
  private beatCounter = 0;
  private beatWindow = 0.14;
  private beatBars: Phaser.GameObjects.Rectangle[] = [];

  private enemies: Enemy[] = [];
  private flyingConfetti: FlyingConfetti[] = [];
  private floorConfetti: FloorConfetti[] = [];

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;
  private spaceKey!: Phaser.Input.Keyboard.Key;

  // Счет
  private applause = 0;
  private bestApplause = 0;
  private act = 1;
  private spotlightsCaught = 0;
  private hype = 1;
  private isDashing = false;
  private dashTimer = 0;
  private isGameOver = false;

  // UI
  private applauseText!: Phaser.GameObjects.Text;
  private actText!: Phaser.GameObjects.Text;
  private rhythmFeedbackText!: Phaser.GameObjects.Text;
  private hypeText!: Phaser.GameObjects.Text;

  constructor() {
    super('GameScene');
  }

  create(): void {
    const { width, height } = this.scale;
    this.isGameOver = false;
    this.applause = 0;
    this.act = 1;
    this.spotlightsCaught = 0;
    this.hype = 1;
    this.beatTimer = 0;
    this.enemies = [];
    this.flyingConfetti = [];
    this.floorConfetti = [];
    this.beatBars = [];

    this.bestApplause = parseInt(localStorage.getItem('showman_best_applause') || '0', 10);

    // 1. Деревянный паркет театра
    this.drawWoodenStage(width, height);

    // 2. Золотой софит
    this.spotlight = this.add.circle(width * 0.78, height * 0.5, 30, 0xfacc15, 0.95);
    this.spotlight.setStrokeStyle(3, 0xffffff);

    this.spotlightPointer = this.add.text(this.spotlight.x, this.spotlight.y - 42, '★ К СВЕТУ! ★', {
      fontFamily: 'Georgia, serif',
      fontSize: '14px',
      color: '#fef08a',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // 3. Шоумен + Кольцо ритма
    this.showman = this.add.rectangle(width * 0.25, height * 0.5, 32, 32, 0xd90429);
    this.showman.setStrokeStyle(2, 0xfbbf24);
    this.showman.setDepth(1); // Шоумен всегда выше конфетти на полу

    this.rhythmRing = this.add.circle(this.showman.x, this.showman.y, 42, 0xfbbf24, 0);
    this.rhythmRing.setStrokeStyle(2, 0xfbbf24, 0.8);
    this.rhythmRing.setDepth(1);

    this.playerHint = this.add.text(this.showman.x, this.showman.y - 32, '[ WASD ] ШАГИ', {
      fontFamily: 'Georgia, serif',
      fontSize: '14px',
      color: '#fef08a',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // 4. Метроном внизу экрана
    this.createRhythmMetronome(width, height);

    // 5. UI
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

    this.rhythmFeedbackText = this.add.text(width / 2, height - 60, '', {
      fontFamily: 'Georgia, serif',
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#facc15',
    }).setOrigin(0.5).setDepth(5);

    // Управление
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    }) as any;
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.spawnFirstCriticWithHint();
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
    criticObj.setStrokeStyle(1, 0x94a3b8);
    criticObj.setDepth(1);
    this.enemies.push({ obj: criticObj, speed: 120 });

    this.enemyHint = this.add.text(x, y - 34, '▼ [ ПРОБЕЛ В РИТМ ] РЫВОК!', {
      fontFamily: 'Georgia, serif',
      fontSize: '14px',
      color: '#f43f5e',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(5);

    this.tweens.add({
      targets: this.enemyHint,
      y: y - 40,
      yoyo: true,
      repeat: -1,
      duration: 350,
      ease: 'Sine.easeInOut',
    });
  }

  update(_time: number, delta: number): void {
    if (this.isGameOver) {
      if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
        this.scene.restart();
      }
      return;
    }

    const seconds = delta / 1000;

    this.handleRhythmPulse(seconds);
    this.handleMovement(seconds);
    this.updateCritics(seconds);
    this.updateConfetti(seconds);
    this.checkSpotlightCollision();
  }

  private handleRhythmPulse(seconds: number): void {
    this.beatTimer += seconds;
    const progress = (this.beatTimer % BEAT_TIME) / BEAT_TIME;
    const { width } = this.scale;
    const offset = (1 - progress) * 150;
    this.beatBars[0].x = width / 2 - offset;
    this.beatBars[1].x = width / 2 + offset;

    if (this.beatTimer >= BEAT_TIME) {
      this.beatTimer -= BEAT_TIME;
      this.beatCounter++;

      if (this.beatCounter % 2 === 0) {
        RhythmAudio.kick();
      } else {
        RhythmAudio.tambourine();
      }

      this.rhythmRing.setScale(1.2);
      this.tweens.add({
        targets: this.rhythmRing,
        scaleX: 0.9,
        scaleY: 0.9,
        duration: BEAT_TIME * 800,
        ease: 'Sine.easeOut',
      });
    }

    this.rhythmRing.setPosition(this.showman.x, this.showman.y);
  }

  private isHitOnBeat(): boolean {
    const timeToBeat = Math.min(this.beatTimer, BEAT_TIME - this.beatTimer);
    return timeToBeat <= this.beatWindow;
  }

  private handleMovement(seconds: number): void {
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey) && !this.isDashing) {
      if (this.enemyHint) {
        this.enemyHint.destroy();
        this.enemyHint = null;
      }

      const onBeat = this.isHitOnBeat();

      if (onBeat) {
        // ПОПАЛ В ТАКТ: ДЕШ РАБОТАЕТ!
        this.isDashing = true;
        this.dashTimer = 0.22;
        RhythmAudio.perfectChime();
        this.showRhythmFeedback('ПРЕКРАСНО! ★', '#facc15');
        this.applause += 100 * this.hype;
        this.applauseText.setText(`ОВАЦИИ: ${this.applause.toLocaleString()}`);
        this.cameras.main.shake(100, 0.015);
      } else {
        // МИМО РИТМА: ДЕША ПРОСТО НЕТ
        this.showRhythmFeedback('МИМО!', '#94a3b8');
      }
    }

    if (this.isDashing) {
      this.dashTimer -= seconds;
      this.spawnDanceDust();
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

      const speed = this.isDashing ? DASH_SPEED : PLAYER_SPEED;
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

  private showRhythmFeedback(text: string, color: string): void {
    this.rhythmFeedbackText.setText(text).setColor(color).setAlpha(1);
    this.tweens.add({
      targets: this.rhythmFeedbackText,
      alpha: 0,
      duration: 600,
    });
  }

  private spawnDanceDust(): void {
    const spark = this.add.rectangle(this.showman.x, this.showman.y, 8, 8, 0xfbbf24, 0.7);
    spark.setDepth(0.3);
    this.tweens.add({
      targets: spark,
      alpha: 0,
      scale: 0.2,
      duration: 200,
      onComplete: () => spark.destroy(),
    });
  }

  private spawnSingleCritic(): void {
    const x = Math.random() > 0.5 ? 40 : this.scale.width - 40;
    const y = Phaser.Math.Between(110, this.scale.height - 80);
    const speed = Phaser.Math.Between(130, 180);

    const criticObj = this.add.rectangle(x, y, 28, 28, 0x475569);
    criticObj.setStrokeStyle(1, 0x94a3b8);
    criticObj.setDepth(1);
    this.enemies.push({ obj: criticObj, speed });
  }

  private updateCritics(seconds: number): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const angle = Phaser.Math.Angle.Between(e.obj.x, e.obj.y, this.showman.x, this.showman.y);
      e.obj.x += Math.cos(angle) * e.speed * seconds;
      e.obj.y += Math.sin(angle) * e.speed * seconds;

      if (i === 0 && this.enemyHint) {
        this.enemyHint.setPosition(e.obj.x, e.obj.y - 34);
      }

      const dist = Phaser.Math.Distance.Between(this.showman.x, this.showman.y, e.obj.x, e.obj.y);

      if (dist < 32) {
        if (this.isDashing) {
          if (this.enemyHint) {
            this.enemyHint.destroy();
            this.enemyHint = null;
          }

          this.createConfettiExplosion(e.obj.x, e.obj.y);
          e.obj.destroy();
          this.enemies.splice(i, 1);

          this.applause += 150 * this.hype;
          this.hype++;
          if (this.hypeText) {
            this.hypeText.setText(`СЕРИЯ: x${this.hype}`);
          }
          this.applauseText.setText(`ОВАЦИИ: ${this.applause.toLocaleString()}`);
          this.cameras.main.shake(120, 0.015);

          this.time.delayedCall(1600, () => {
            if (!this.isGameOver) this.spawnSingleCritic();
          });
        } else {
          this.gameOver();
          return;
        }
      }
    }
  }

  // Взрыв конфетти + серпантинные ленты на полу
  private createConfettiExplosion(x: number, y: number): void {
    const colors = [0xfacc15, 0xe11d48, 0xffffff, 0xfbbf24, 0xf43f5e];

    // 1. Длинные серпантинные ленты, которые сразу падают на пол и остаются
    for (let r = 0; r < 5; r++) {
      const ribbon = this.add.rectangle(
          x + Phaser.Math.Between(-15, 15),
          y + Phaser.Math.Between(-15, 15),
          Phaser.Math.Between(22, 38),
          Phaser.Math.Between(5, 8),
          colors[Phaser.Math.Between(0, colors.length - 1)],
          0.75
      );
      ribbon.setAngle(Phaser.Math.Between(0, 180));
      ribbon.setDepth(0.05); // Лежит прямо на паркете, под ногами шоумена

      this.floorConfetti.push({ obj: ribbon, life: 14.0 }); // Лежит 14 секунд
    }

    // 2. Разлетающиеся салютом конфетти
    for (let i = 0; i < 32; i++) {
      const p = this.add.rectangle(
          x,
          y,
          Phaser.Math.Between(5, 8),
          Phaser.Math.Between(5, 8),
          colors[Phaser.Math.Between(0, colors.length - 1)]
      );
      p.setDepth(1.5); // Летит над персонажами

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

  // Обновление конфетти: полет ➔ оседание на полу ➔ мягкое исчезновение
  private updateConfetti(seconds: number): void {
    // 1. Летающие конфетти
    for (let i = this.flyingConfetti.length - 1; i >= 0; i--) {
      const c = this.flyingConfetti[i];
      c.life -= seconds * 1.4;
      c.obj.x += c.vx * seconds;
      c.obj.y += c.vy * seconds;
      c.obj.rotation += c.rotSpeed * seconds;

      // Приземление на паркет
      if (c.life <= 0) {
        c.obj.setDepth(0.05); // Оседает на пол
        c.obj.setAlpha(0.65);
        this.floorConfetti.push({ obj: c.obj, life: 12.0 }); // Остается лежать 12 секунд
        this.flyingConfetti.splice(i, 1);
      }
    }

    // 2. Конфетти, лежащие на паркете
    for (let j = this.floorConfetti.length - 1; j >= 0; j--) {
      const fc = this.floorConfetti[j];
      fc.life -= seconds;

      // Медленно растворяются в последние 2 секунды
      if (fc.life < 2.0) {
        fc.obj.alpha = fc.life / 2.0 * 0.65;
      }

      if (fc.life <= 0) {
        fc.obj.destroy();
        this.floorConfetti.splice(j, 1);
      }
    }
  }

  private checkSpotlightCollision(): void {
    const dist = Phaser.Math.Distance.Between(this.showman.x, this.showman.y, this.spotlight.x, this.spotlight.y);
    if (dist < 36) {
      this.spotlightsCaught++;
      this.applause += 300 * this.hype;
      this.hype++;
      this.hypeText.setText(`СЕРИЯ: x${this.hype}`);
      this.applauseText.setText(`ОВАЦИИ: ${this.applause.toLocaleString()}`);

      if (this.spotlightPointer) {
        this.spotlightPointer.destroy();
        this.spotlightPointer = null;
      }

      this.cameras.main.flash(90, 254, 240, 138, false);

      this.spotlight.setPosition(
          Phaser.Math.Between(80, this.scale.width - 80),
          Phaser.Math.Between(110, this.scale.height - 80)
      );

      if (this.enemies.length < 2 + this.act * 2) {
        this.spawnSingleCritic();
      }

      if (this.spotlightsCaught % 3 === 0) {
        this.act++;
        this.actText.setText(`— АКТ ${this.act} —`);
        this.cameras.main.flash(200, 217, 119, 6, false);
        this.spawnSingleCritic();
      }
    }
  }

  private gameOver(): void {
    this.isGameOver = true;
    const { width, height } = this.scale;

    this.cameras.main.shake(300, 0.03);
    this.add.rectangle(width / 2, height / 2, width, height, 0x110206, 0.9).setDepth(20);

    this.add.text(width / 2, height * 0.35, 'ЗАНАВЕС ОПУСКАЕТСЯ', {
      fontFamily: 'Georgia, serif',
      fontSize: '56px',
      color: '#e11d48',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(21);

    this.add.text(width / 2, height * 0.52, `ОВАЦИИ: ${this.applause}\nЗАВЕРШЕНО: АКТ ${this.act}`, {
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
}