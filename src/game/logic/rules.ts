export const GAME_CONFIG = {
    playerSpeed: 270,
    dashSpeed: 820,
    bpmRange: { min: 94, max: 116 },
    beatWindowRange: { fair: 0.130, strict: 0.095 },
    phase2TargetSpotlights: 5,
    criticSpeedPhase1: { min: 140, max: 200 },
    criticSpeedPhase2: { min: 250, max: 315 },
    invulnerabilityDuration: 1.8,
    dashGraceDuration: 0.12,
    casualSpeedMultiplier: 0.7,
    maxLives: 3,
} as const;