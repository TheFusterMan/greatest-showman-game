export const GAME_CONFIG = {
    playerSpeed: 300,
    dashSpeed: 800,
    bpm: 126,
    beatWindow: 0.14,
    phase2TargetSpotlights: 5,
    criticSpeedPhase1: { min: 130, max: 180 },
    criticSpeedPhase2: { min: 220, max: 280 },
    casualSpeedMultiplier: 0.7,
} as const;