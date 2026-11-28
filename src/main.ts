import './style.css';
import { createGame } from './game/config';

createGame('game');

async function enterLandscapeFullscreen(): Promise<void> {
    try {
        const el = document.documentElement;
        if (!document.fullscreenElement && el.requestFullscreen) {
            await el.requestFullscreen();
        }
    } catch {
        // Игнорируем на браузерах без поддержки Fullscreen API (например, iOS Safari)
    }

    try {
        await (screen.orientation as any)?.lock?.('landscape');
    } catch {
        // Игнорируем, если браузер не позволяет заблокировать ориентацию
    }
}

document.getElementById('force-landscape-btn')?.addEventListener('click', () => {
    enterLandscapeFullscreen();
});

window.addEventListener('resize', () => {
    const isPortraitMobile =
        window.innerHeight > window.innerWidth &&
        window.matchMedia?.('(pointer: coarse)').matches;

    if (isPortraitMobile) {
        window.dispatchEvent(new Event('blur'));
    }
});