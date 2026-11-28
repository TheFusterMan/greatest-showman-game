import Phaser from 'phaser';
import { GameScene } from './GameScene';
import { TutorialScene } from './TutorialScene';

export function createGame(parent: string): Phaser.Game {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#180509',
    scene: [TutorialScene, GameScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 1024,
      height: 576,
    },
  };

  return new Phaser.Game(config);
}