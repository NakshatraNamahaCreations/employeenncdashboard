// The Employee Portal works only on a computer. A phone or tablet is caught even with "Desktop site" on:
// that only changes the browser name it sends, not the touch screen or the small physical screen.
export function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/Android|iPhone|iPad|iPod|Mobile|Mobi|Opera Mini|IEMobile|webOS|BlackBerry|Silk|Kindle/i.test(ua)) return true;
  if (navigator.userAgentData?.mobile) return true;
  const touch = (navigator.maxTouchPoints || 0) > 0;
  // iPad and iPhone in desktop mode say "Macintosh"; a real Mac has no touch screen
  if (touch && /Macintosh/i.test(ua)) return true;
  // Android in desktop mode says "Linux" or "X11"; Chromebooks (CrOS) are computers
  if (touch && /Linux|X11/i.test(ua) && !/CrOS/i.test(ua)) return true;
  const mm = (q) => typeof window !== "undefined" && window.matchMedia?.(q).matches;
  // a touch screen with no mouse or trackpad at all
  if (touch && mm("(pointer: coarse)") && !mm("(any-pointer: fine)")) return true;
  // a phone-sized physical screen (does not change with desktop mode or zoom)
  const short = Math.min(window.screen?.width || 9999, window.screen?.height || 9999);
  if (touch && short < 700) return true;
  return false;
}
