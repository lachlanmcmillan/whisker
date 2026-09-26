export function tagHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  return h % 360;
}

export function tagColor(name: string): string {
  return `oklch(0.64 0.13 ${tagHue(name)})`;
}
