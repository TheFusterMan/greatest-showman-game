export type GamePhase = 'PLAYING' | 'PAUSED' | 'GAME_OVER';
import { GAME_CONFIG } from './rules';

export const BEAT_TIME = 60 / GAME_CONFIG.bpm;
export const BEAT_WINDOW = GAME_CONFIG.beatWindow;;
export const PHASE_2_TRIGGER_TIME = 7;
export const PHASE_2_TARGET_SPOTLIGHTS = 5;

export interface BeatTick {
    isBeat: boolean;
    isKick: boolean;
    progress: number;
}

export class GameState {
    public phase: GamePhase = 'PLAYING';
    public applause = 0;
    public bestApplause = 0;
    public act = 1;
    public spotlightsCaught = 0;
    public hype = 1;

    private beatTimer = 0;
    private beatCounter = 0;

    public gameTime = 0;
    public currentStage: 1 | 2 = 1;

    public isCasualMode = false;

    public toggleCasualMode(): boolean {
        this.isCasualMode = !this.isCasualMode;
        return this.isCasualMode;
    }

    constructor() {
        this.bestApplause = parseInt(localStorage.getItem('showman_best_applause') || '0', 10);
    }

    public togglePause(): boolean {
        if (this.phase === 'GAME_OVER') return false;
        this.phase = this.phase === 'PAUSED' ? 'PLAYING' : 'PAUSED';
        return this.phase === 'PAUSED';
    }

    public updateBeat(seconds: number): BeatTick {
        this.gameTime += seconds;

        this.beatTimer += seconds;
        const progress = (this.beatTimer % BEAT_TIME) / BEAT_TIME;
        let isBeat = false;
        let isKick = false;

        if (this.beatTimer >= BEAT_TIME) {
            this.beatTimer -= BEAT_TIME;
            this.beatCounter++;
            isBeat = true;
            isKick = this.beatCounter % 2 === 0;
        }

        return { isBeat, isKick, progress };
    }

    public isHitOnBeat(): boolean {
        const timeToBeat = Math.min(this.beatTimer, BEAT_TIME - this.beatTimer);
        return timeToBeat <= BEAT_WINDOW;
    }

    public registerCriticDefeated(): void {
        this.applause += 150 * this.hype;
        this.hype++;
        this.updateBestScore();
    }

    public registerSpotlightCaught(): { isNewAct: boolean; phaseSwitched: boolean } {
        this.spotlightsCaught++;
        this.applause += 300 * this.hype;
        this.hype++;
        this.updateBestScore();

        let phaseSwitched = false;
        if (this.spotlightsCaught >= GAME_CONFIG.phase2TargetSpotlights && this.currentStage === 1) {
            this.currentStage = 2;
            phaseSwitched = true;
        }

        const isNewAct = this.spotlightsCaught % 3 === 0;
        if (isNewAct) {
            this.act++;
        }

        return { isNewAct, phaseSwitched };
    }

    public registerHitOnBeatBonus(): void {
        this.applause += 100 * this.hype;
        this.updateBestScore();
    }

    public triggerGameOver(): void {
        this.phase = 'GAME_OVER';
    }

    private updateBestScore(): void {
        if (this.applause > this.bestApplause) {
            this.bestApplause = this.applause;
            localStorage.setItem('showman_best_applause', this.bestApplause.toString());
        }
    }
}