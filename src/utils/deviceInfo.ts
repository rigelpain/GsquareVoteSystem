import type { DeviceInfo } from '../types';

export async function collectDeviceInfo(): Promise<DeviceInfo> {
  const info: DeviceInfo = {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    language: navigator.language,
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
    clearTimeout(timeout);
    const data = await res.json();
    info.ipAddress = data.ip;
  } catch {
    // IP取得失敗は無視
  }

  return info;
}
