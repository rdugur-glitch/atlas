import type { Quality } from './store';
export interface QCfg { dpr: number; shadow: number; env: number; particles: number; windows: number; clouds: number; extraLights: boolean; aa: boolean }
export const QUALITY: Record<Quality, QCfg> = {
  low: { dpr: 1, shadow: 0, env: 32, particles: 70, windows: 0.35, clouds: 2, extraLights: false, aa: false },
  balanced: { dpr: 1.5, shadow: 1024, env: 64, particles: 240, windows: 0.8, clouds: 4, extraLights: false, aa: true },
  high: { dpr: 2, shadow: 2048, env: 128, particles: 560, windows: 1.4, clouds: 7, extraLights: true, aa: true },
};
