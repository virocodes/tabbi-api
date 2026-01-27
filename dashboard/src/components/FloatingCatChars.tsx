"use client";

import { useEffect, useRef, useState } from "react";

interface FloatingCatCharsProps {
  catPosition?: { x: number; y: number };
  catScale?: number;
}

export function FloatingCatChars({
  catPosition,
  catScale = 1,
}: FloatingCatCharsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isBlinking, setIsBlinking] = useState(false);
  const [waveFrame, setWaveFrame] = useState(0);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const animationRef = useRef<number>();
  const dotActivationsRef = useRef<Map<string, number>>(new Map());

  // Initial wave animation on mount
  useEffect(() => {
    const waveSequence = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 0];
    let frameIndex = 0;

    const animate = () => {
      if (frameIndex < waveSequence.length) {
        setWaveFrame(waveSequence[frameIndex]);
        frameIndex++;
        setTimeout(animate, 100);
      } else {
        setTimeout(() => {
          setIsBlinking(true);
          setTimeout(() => {
            setIsBlinking(false);
          }, 150);
        }, 300);
      }
    };

    const startTimeout = setTimeout(() => {
      animate();
    }, 500);

    return () => clearTimeout(startTimeout);
  }, []);

  // Blink effect
  useEffect(() => {
    if (waveFrame > 0) return;

    const scheduleBlink = () => {
      const interval = 4000 + Math.random() * 2000;
      const timeoutId = setTimeout(() => {
        setIsBlinking(true);
        setTimeout(() => {
          setIsBlinking(false);
          scheduleBlink();
        }, 150);
      }, interval);

      return timeoutId;
    };

    const timeoutId = scheduleBlink();
    return () => clearTimeout(timeoutId);
  }, [waveFrame]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    window.addEventListener("mousemove", handleMouseMove);

    let emoticonPixels: Uint8ClampedArray | null = null;
    let emoticonWidth = 0;
    let emoticonHeight = 0;

    const computeEmoticon = (width: number, height: number) => {
      // Skip if dimensions are invalid
      if (width <= 0 || height <= 0) return;

      const offCanvas = document.createElement("canvas");
      const offCtx = offCanvas.getContext("2d");
      if (!offCtx) return;

      const fontSize = Math.min(width * 0.18, 180) * catScale;
      offCanvas.width = width;
      offCanvas.height = height;
      emoticonWidth = width;
      emoticonHeight = height;

      offCtx.font = `700 ${fontSize}px "Noto Sans", sans-serif`;
      offCtx.textBaseline = "middle";
      offCtx.fillStyle = "white";

      const centerY = catPosition ? height * catPosition.y : height * 0.35;

      let body = "ฅ^>⩊<^";
      if (isBlinking) {
        body = "ฅ^−⩊−^";
      }

      let pawOffsetY = 0;
      let pawOffsetX = 0;
      if (waveFrame > 0) {
        if (waveFrame <= 3) {
          pawOffsetY = -waveFrame * 15;
        } else if (waveFrame <= 9) {
          pawOffsetY = -45;
          const shakeFrame = waveFrame - 4;
          pawOffsetX = Math.sin(shakeFrame * Math.PI) * 8;
        } else {
          pawOffsetY = -(12 - waveFrame) * 15;
        }
      }

      const fullEmoticon = body + "ฅ";
      const fullWidth = offCtx.measureText(fullEmoticon).width;
      const bodyWidth = offCtx.measureText(body).width;
      const pawGap = 5;

      const startX = catPosition ? width * catPosition.x - fullWidth / 2 : (width - fullWidth) / 2;

      offCtx.textAlign = "left";
      offCtx.fillText(body, startX, centerY);

      const pawX = startX + bodyWidth + pawGap;
      offCtx.fillText("ฅ", pawX + pawOffsetX, centerY + pawOffsetY);

      const imageData = offCtx.getImageData(0, 0, width, height);
      emoticonPixels = imageData.data;
    };

    const getEmoticonIntensity = (x: number, y: number): number => {
      if (!emoticonPixels) return 0;
      const sampleRadius = 1;
      let totalIntensity = 0;
      let samples = 0;

      for (let dx = -sampleRadius; dx <= sampleRadius; dx += 1) {
        for (let dy = -sampleRadius; dy <= sampleRadius; dy += 1) {
          const sx = Math.floor(x + dx);
          const sy = Math.floor(y + dy);
          if (sx >= 0 && sx < emoticonWidth && sy >= 0 && sy < emoticonHeight) {
            const idx = (sy * emoticonWidth + sx) * 4;
            totalIntensity += emoticonPixels[idx];
            samples++;
          }
        }
      }

      const raw = samples > 0 ? totalIntensity / samples / 255 : 0;
      return Math.pow(raw, 0.5);
    };

    const drawPattern = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      // Skip if canvas hasn't been sized yet
      if (width <= 0 || height <= 0) {
        animationRef.current = requestAnimationFrame(drawPattern);
        return;
      }

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);

      if (emoticonWidth !== width || emoticonHeight !== height) {
        computeEmoticon(width, height);
      }

      const bgGridSpacing = 8;
      const catGridSpacing = 5;
      const baseDotSize = 0.5;
      const maxDotSize = 3.5;
      const catMaxDotSize = 2.5;
      const cursorRadius = 100;
      const cursorMaxSize = 4;
      const activationDecay = 0.96;
      const activationSpeed = 0.3;

      const baseColor = { r: 148, g: 163, b: 184 };
      const accentColor = { r: 59, g: 130, b: 246 };

      ctx.clearRect(0, 0, width, height);

      const mouse = mouseRef.current;
      const activations = dotActivationsRef.current;

      const catCenterX = catPosition ? width * catPosition.x : width / 2;
      const catCenterY = catPosition ? height * catPosition.y : height * 0.35;
      const catSize = Math.min(width * 0.18, 180) * catScale;
      const catBoxPadding = catSize * 0.3;
      const catLeft = catCenterX - catSize * 2.5 - catBoxPadding;
      const catRight = catCenterX + catSize * 2.5 + catBoxPadding;
      const catTop = catCenterY - catSize * 0.8 - catBoxPadding;
      const catBottom = catCenterY + catSize * 0.8 + catBoxPadding;

      const drawDot = (x: number, y: number, maxDot: number) => {
        const dotKey = `${Math.round(x)},${Math.round(y)}`;
        const intensity = getEmoticonIntensity(x, y);

        const distToCursor = Math.sqrt(Math.pow(x - mouse.x, 2) + Math.pow(y - mouse.y, 2));
        const cursorInfluence = Math.max(0, 1 - distToCursor / cursorRadius);
        const targetActivation = cursorInfluence * cursorInfluence * (3 - 2 * cursorInfluence);

        let currentActivation = activations.get(dotKey) || 0;
        if (targetActivation > currentActivation) {
          currentActivation += (targetActivation - currentActivation) * activationSpeed;
        } else {
          currentActivation *= activationDecay;
        }

        if (currentActivation < 0.001) {
          activations.delete(dotKey);
          currentActivation = 0;
        } else {
          activations.set(dotKey, currentActivation);
        }

        let dotSize;
        let color;

        if (intensity > 0.05) {
          const eased = intensity * intensity * (3 - 2 * intensity);
          const emoticonSize = baseDotSize + (maxDot - baseDotSize) * eased;
          const cursorBoost = currentActivation * (cursorMaxSize - emoticonSize);
          dotSize = emoticonSize + Math.max(0, cursorBoost);

          const r = Math.round(baseColor.r + (accentColor.r - baseColor.r) * eased * 0.7);
          const g = Math.round(baseColor.g + (accentColor.g - baseColor.g) * eased * 0.7);
          const b = Math.round(baseColor.b + (accentColor.b - baseColor.b) * eased * 0.7);
          const alpha = 0.1 + eased * 0.25 + currentActivation * 0.15;
          color = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        } else {
          dotSize = baseDotSize + currentActivation * (cursorMaxSize - baseDotSize);
          const alpha = 0.1 + currentActivation * 0.2;
          const r = Math.round(
            baseColor.r + (accentColor.r - baseColor.r) * currentActivation * 0.5
          );
          const g = Math.round(
            baseColor.g + (accentColor.g - baseColor.g) * currentActivation * 0.5
          );
          const b = Math.round(
            baseColor.b + (accentColor.b - baseColor.b) * currentActivation * 0.5
          );
          color = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }

        ctx.beginPath();
        ctx.arc(x, y, dotSize, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      };

      for (let x = bgGridSpacing / 2; x < width; x += bgGridSpacing) {
        for (let y = bgGridSpacing / 2; y < height; y += bgGridSpacing) {
          const intensity = getEmoticonIntensity(x, y);
          if (intensity <= 0.05) {
            drawDot(x, y, maxDotSize);
          }
        }
      }

      for (let x = catLeft; x <= catRight; x += catGridSpacing) {
        for (let y = catTop; y <= catBottom; y += catGridSpacing) {
          const intensity = getEmoticonIntensity(x, y);
          if (intensity > 0.05) {
            drawDot(x, y, catMaxDotSize);
          }
        }
      }

      animationRef.current = requestAnimationFrame(drawPattern);
    };

    const initialRect = canvas.getBoundingClientRect();
    if (initialRect.width > 0 && initialRect.height > 0) {
      computeEmoticon(initialRect.width, initialRect.height);
    }
    drawPattern();

    const handleResize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        computeEmoticon(rect.width, rect.height);
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isBlinking, waveFrame, catPosition, catScale]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
}
