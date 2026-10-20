export type GamePhase = 'PLAYING' | 'PAUSED' | 'GAME_OVER';

export const BPM = 126;
export const BEAT_TIME = 60 / BPM;
export const BEAT_WINDOW = 0.14;

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

    constructor() {
        this.bestApplause = parseInt(localStorage.getItem('showman_best_applause') || '0', 10);
    }

    public togglePause(): boolean {
        if (this.phase === 'GAME_OVER') return false;
        this.phase = this.phase === 'PAUSED' ? 'PLAYING' : 'PAUSED';
        return this.phase === 'PAUSED';
    }

    public updateBeat(seconds: number): BeatTick {
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

    public registerSpotlightCaught(): boolean {
        this.spotlightsCaught++;
        this.applause += 300 * this.hype;
        this.hype++;
        this.updateBestScore();

        if (this.spotlightsCaught % 3 === 0) {
            this.act++;
            return true;
        }
        return false;
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