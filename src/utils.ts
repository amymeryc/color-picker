/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PaletteEntry {
  id: string;
  name?: string;
  image: string; // base64 string
  colors: string[]; // hex codes
  timestamp: number;
}

export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('').toUpperCase();
}

export async function extractColors(imageSrc: string, colorCount: number = 5): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // Resize for performance
      const scale = Math.min(1, 100 / Math.max(img.width, img.height));
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const pixels: [number, number, number][] = [];

      for (let i = 0; i < imageData.length; i += 4) {
        pixels.push([imageData[i], imageData[i + 1], imageData[i + 2]]);
      }

      // Simple Median Cut or K-Means approximation
      // For MVP, we'll use a simplified version: 
      // 1. Group similar colors
      // 2. Pick the most frequent ones that are distinct
      
      const colorCounts: Record<string, { rgb: [number, number, number], count: number }> = {};
      
      pixels.forEach(([r, g, b]) => {
        // Quantize to reduce noise (e.g., group by 16)
        const qr = Math.round(r / 16) * 16;
        const qg = Math.round(g / 16) * 16;
        const qb = Math.round(b / 16) * 16;
        const key = `${qr},${qg},${qb}`;
        if (!colorCounts[key]) {
          colorCounts[key] = { rgb: [qr, qg, qb], count: 0 };
        }
        colorCounts[key].count++;
      });

      const sortedColors = Object.values(colorCounts)
        .sort((a, b) => b.count - a.count);

      const result: string[] = [];
      for (const item of sortedColors) {
        const hex = rgbToHex(item.rgb[0], item.rgb[1], item.rgb[2]);
        
        // Check if color is distinct enough from existing ones
        const isDistinct = result.every(existingHex => {
          const r1 = parseInt(existingHex.slice(1, 3), 16);
          const g1 = parseInt(existingHex.slice(3, 5), 16);
          const b1 = parseInt(existingHex.slice(5, 7), 16);
          const [r2, g2, b2] = item.rgb;
          
          const distance = Math.sqrt(
            Math.pow(r1 - r2, 2) + 
            Math.pow(g1 - g2, 2) + 
            Math.pow(b1 - b2, 2)
          );
          return distance > 60; // Distance threshold
        });

        if (isDistinct) {
          result.push(hex);
        }

        if (result.length >= colorCount) break;
      }

      resolve(result);
    };
    img.onerror = reject;
    img.src = imageSrc;
  });
}
