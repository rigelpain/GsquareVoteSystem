import type { DeviceInfo, SessionEnv } from '../types';

// セッション用の環境情報（同期収集・IP取得無し → 起動直後に即記録可能）
export function collectSessionEnv(): SessionEnv {
  const nav = navigator as Navigator & {
    userAgentData?: {
      platform?: string;
      mobile?: boolean;
      brands?: { brand: string; version: string }[];
    };
  };

  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    devicePixelRatio: window.devicePixelRatio,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    uaData: nav.userAgentData
      ? {
          platform: nav.userAgentData.platform,
          mobile: nav.userAgentData.mobile,
          brands: nav.userAgentData.brands,
        }
      : null,
  };
}

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
