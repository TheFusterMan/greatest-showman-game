export const GAME_CONFIG = {
    playerSpeed: 270,
    dashSpeed: 820,
    bpm: 126,
    beatWindow: 0.14,
    phase2TargetSpotlights: 5,
    criticSpeedPhase1: { min: 140, max: 200 },
    criticSpeedPhase2: { min: 250, max: 315 },
    casualSpeedMultiplier: 0.7,
} as const;