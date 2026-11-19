export const GAME_CONFIG = {
    playerSpeed: 270,
    dashSpeed: 820,
    bpmRange: { min: 80, max: 92 },
    beatWindowRange: { fair: 0.130, strict: 0.095 },
    phase2TargetSpotlights: 5,
    criticSpeedPhase1: { min: 110, max: 155 },
    criticSpeedPhase2: { min: 185, max: 235 },
    invulnerabilityDuration: 1.8,
    dashGraceDuration: 0.3,
    casualSpeedMultiplier: 0.7,
    maxLives: 3,

    // Настройки бонусов:
    bonusDropChance: 0.45,       // 45% шанс дропа при сбивании критика
    bonusLifespan: 8.0,          // Секунд до исчезновения бонуса с пола
    slowMoDuration: 5.0,         // Длительность замедления времени
    slowMoSpeedMultiplier: 0.35, // Насколько медленнее ползут враги
} as const;