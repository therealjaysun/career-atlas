'use client';

import { memo, useEffect, useMemo, useRef } from 'react';
import { mapPoint, type cloud3D } from '@/lib/career';
import {
  fieldColor,
  iqrColorValue,
  intensityField,
  type FieldQuartiles,
  type FieldSample,
} from '@/lib/intensity-field';

export const IntensityField = memo(function IntensityField({
  samples,
  scene,
  width,
  height,
  view,
  sigma,
  opacity,
  metric,
  quartiles,
}: {
  samples: FieldSample[];
  scene: ReturnType<typeof cloud3D> | null;
  width: number;
  height: number;
  view: { x: number; y: number; k: number };
  sigma: number;
  opacity: number;
  metric: 'pay' | 'ai';
  quartiles: FieldQuartiles;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const is3D = scene !== null;
  const grid = useMemo(
    () => intensityField(samples, is3D ? 3 : 2, sigma),
    [samples, is3D, sigma],
  );
  // Reuse textures while rotating, zooming, changing transparency, or hovering.
  const texture = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const image = document.createElement('canvas');
    image.width = is3D ? 32 * 256 : grid.size;
    image.height = is3D ? 32 : grid.size;
    const ctx = image.getContext('2d');
    if (!ctx) return null;
    if (is3D) {
      for (let i = 0; i < 256; i++) {
        const color = fieldColor(i / 255, metric).join(',');
        const gradient = ctx.createRadialGradient(
          i * 32 + 16,
          16,
          0,
          i * 32 + 16,
          16,
          16,
        );
        gradient.addColorStop(0, `rgba(${color},1)`);
        gradient.addColorStop(0.5, `rgba(${color},0.55)`);
        gradient.addColorStop(1, `rgba(${color},0)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(i * 32, 0, 32, 32);
      }
    } else {
      const pixels = ctx.createImageData(grid.size, grid.size);
      for (const cell of grid.cells) {
        pixels.data.set(
          fieldColor(iqrColorValue(cell.value, quartiles), metric),
          cell.index * 4,
        );
        pixels.data[cell.index * 4 + 3] = Math.round(255 * cell.support);
      }
      ctx.putImageData(pixels, 0, 0);
    }
    return image;
  }, [grid, metric, is3D, quartiles]);
  useEffect(() => {
    const node = canvas.current;
    if (!node || !texture) return;
    const frame = requestAnimationFrame(() => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      if (node.width !== Math.round(width * ratio))
        node.width = Math.round(width * ratio);
      if (node.height !== Math.round(height * ratio))
        node.height = Math.round(height * ratio);
      const ctx = node.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.translate(view.x, view.y);
      ctx.scale(view.k, view.k);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      if (!scene) {
        const a = mapPoint(
          { x: -grid.pad - grid.step / 2, y: -grid.pad - grid.step / 2 },
          width,
          height,
        );
        const b = mapPoint(
          { x: 1 + grid.pad + grid.step / 2, y: 1 + grid.pad + grid.step / 2 },
          width,
          height,
        );
        ctx.globalAlpha = opacity;
        ctx.drawImage(texture, a.x, a.y, b.x - a.x, b.y - a.y);
      } else {
        const projected = grid.cells
          .map((cell) => ({ cell, p: scene.project(cell) }))
          .sort((a, b) => a.p.depth - b.p.depth);
        for (const { cell, p } of projected) {
          const screen = mapPoint(p, width, height);
          const radius = grid.step * scene.worldScale * p.scale * 1.35;
          ctx.globalAlpha = opacity * cell.support * 0.1;
          ctx.drawImage(
            texture,
            Math.round(iqrColorValue(cell.value, quartiles) * 255) * 32,
            0,
            32,
            32,
            screen.x - radius,
            screen.y - radius,
            radius * 2,
            radius * 2,
          );
        }
      }
      ctx.globalAlpha = 1;
    });
    return () => cancelAnimationFrame(frame);
  }, [texture, scene, grid, width, height, view, opacity, quartiles]);
  return <canvas ref={canvas} className="intensity-field" aria-hidden="true" />;
});
