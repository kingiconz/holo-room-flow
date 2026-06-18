export type LedColor =
  | "OFF"
  | "ON"
  | "RED"
  | "GREEN"
  | "YELLOW";

declare global {
  interface Window {
    Android?: {
      setLedColor(color: string): string;
    };
  }
}

export function setLedColor(color: LedColor) {
  if (!window.Android?.setLedColor) {
    return;
  }

  window.Android.setLedColor(color);
}
