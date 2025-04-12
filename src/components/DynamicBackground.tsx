"use client"; // <-- Added directive
// src/components/DynamicBackground.tsx
import React, { useRef, useEffect, useState, useCallback } from 'react';

// Interface for coordinate points
interface Point {
  x: number;
  y: number;
}

// Interface for stored hex center data
interface HexCenterData {
    center: Point;
    // Store corners to optimize drawing tessellated lines
    // corners?: Point[]; // No longer storing corners here, calculate on the fly
}

// --- NEW: Interface for Data Pulse ---
interface Pulse {
    id: number;
    start: Point;
    end: Point;
    progress: number; // 0 to 1
    speed: number; // Units per second (approx)
    color: string;
    startTime: number; // Timestamp when created
}

// --- NEW: Ripple Interface ---
interface Ripple {
    id: number;
    center: Point;      // Origin of the ripple (mouse position at trigger)
    startTime: number;
    maxRadius: number;  // How far the ripple expands
    duration: number;   // How long the ripple effect lasts (ms)
    color: string;
}

// Component Props (optional for now, could add config later)
interface DynamicBackgroundProps {
    className?: string;
    hexRadius?: number;
    gridColor?: string;
    lineWidth?: number;
    glowColor?: string; // Added for glow
    maxGlowRadius?: number; // Added for glow size/intensity calculation
    maxGlowOpacity?: number; // Added for glow opacity calculation
    pulseColor?: string; // Added for pulses
    pulseSpeed?: number; // Added for pulses
    pulseInterval?: number; // Time between new pulses in ms
    pulseMaxLength?: number; // Max simultaneous pulses
    rippleColor?: string; // Added for ripples
    rippleMaxRadius?: number;
    rippleDuration?: number;
    rippleLineWidthMultiplier?: number; // Optional: Make ripple lines thicker
    waveThickness?: number; // << NEW: Thickness of the wave band
}

const DynamicBackground: React.FC<DynamicBackgroundProps> = ({
    className = '',
    hexRadius = 50, // << Increased default radius
    gridColor = 'rgba(0, 255, 255, 0.08)', // << Slightly dimmer grid
    lineWidth = 1,
    glowColor = 'rgba(0, 255, 255, alpha)', // Cyan glow, alpha calculated dynamically
    maxGlowRadius = 200, // << Increased glow radius
    maxGlowOpacity = 0.5, // Max opacity of the glow at the center
    pulseColor = 'rgba(255, 0, 255, 0.7)', // Magenta pulse color
    pulseSpeed = 120, // Pixels per second (approximate)
    pulseInterval = 400, // Add a new pulse every 400ms
    pulseMaxLength = 8, // Limit concurrent pulses
    rippleColor = 'rgba(0, 255, 255, alpha)', // Ripple color (cyan, alpha calculated)
    rippleMaxRadius = 800, // 
    rippleDuration = 1000, //
    rippleLineWidthMultiplier = 1.5, // << Default thicker ripple lines
    waveThickness = 60, // << NEW: Default wave thickness (adjust as needed)
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);
  const animationFrameId = useRef<number | null>(null); // Ref to store animation frame ID
  const hexCentersRef = useRef<HexCenterData[]>([]); // Ref to store pre-calculated centers
  const mousePosition = useRef<Point | null>(null); // Ref for mouse position (state causes re-renders)
  const activePulsesRef = useRef<Pulse[]>([]); // Ref to store active pulses
  const pulseIntervalId = useRef<NodeJS.Timeout | null>(null); // Ref for interval ID
  const lastTimestampRef = useRef<number>(0); // For delta time calculation
  // --- NEW: State/Refs for Ripples ---
  const activeRipplesRef = useRef<Ripple[]>([]);

  // --- Hexagon Geometry Helpers ---
  const getHexCorner = useCallback((center: Point, radius: number, i: number): Point => {
    // Correct angles for FLAT-TOPPED hexagons (0, 60, 120, 180, 240, 300 degrees)
    const angleDeg = 60 * i;
    const angleRad = (Math.PI / 180) * angleDeg;
    return {
      x: center.x + radius * Math.cos(angleRad),
      y: center.y + radius * Math.sin(angleRad),
    };
  }, []);

  // --- NEW: Helper to draw hexagon outline from corners ---
  const drawHexOutline = (context: CanvasRenderingContext2D, corners: Point[]) => {
      if (!corners || corners.length < 6) return;
      context.moveTo(corners[0].x, corners[0].y);
      for (let i = 1; i < 6; i++) {
          context.lineTo(corners[i].x, corners[i].y);
      }
      context.closePath(); // Close the path back to the start
  };

  // --- Grid Calculation & Tessellation Drawing Logic (Revised) ---
  const calculateAndDrawTessellatedGrid = useCallback((context: CanvasRenderingContext2D, width: number, height: number, radius: number) => {
    context.clearRect(0, 0, width, height);
    context.strokeStyle = gridColor;
    context.lineWidth = lineWidth;

    const newCentersData: HexCenterData[] = [];
    // const drawnEdges = new Set<string>(); // Removed edge tracking

    const hexHeight = radius * Math.sqrt(3);
    const hexWidth = radius * 2;
    const vertDist = hexHeight;
    const horizDist = (hexWidth * 3) / 4;

    const rows = Math.ceil(height / vertDist) + 2;
    const cols = Math.ceil(width / horizDist) + 2;

    context.beginPath(); // Start path for all hexagons

    for (let row = -1; row < rows; row++) {
      for (let col = -1; col < cols; col++) {
        const cx = col * horizDist;
        const cy = row * vertDist + (col % 2 !== 0 ? vertDist / 2 : 0);
        const center = { x: cx, y: cy };

        // Store center if within rough bounds
        if (cx > -horizDist - radius && cx < width + horizDist + radius && cy > -vertDist - radius && cy < height + vertDist + radius) {
            newCentersData.push({ center });
            // Calculate corners and draw the full hexagon outline
            const corners = Array.from({ length: 6 }, (_, i) => getHexCorner(center, radius, i));
            drawHexOutline(context, corners);
        }

        // --- Removed edge drawing logic --- //
      }
    }
    context.stroke(); // Stroke all hexagon paths at once
    hexCentersRef.current = newCentersData;
  }, [getHexCorner, gridColor, lineWidth]);

  // --- Glow Logic ---
  const getNearbyHexCenters = useCallback((targetPos: Point | null, maxDist: number): HexCenterData[] => {
      if (!targetPos) return [];
      const nearby: HexCenterData[] = [];
      const maxDistSq = maxDist * maxDist;
      for (const hexData of hexCentersRef.current) {
          const dx = hexData.center.x - targetPos.x;
          const dy = hexData.center.y - targetPos.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < maxDistSq) {
              nearby.push(hexData);
          }
      }
      return nearby;
  }, []);

  const drawGlows = useCallback((context: CanvasRenderingContext2D, targetPos: Point | null) => {
      if (!targetPos) return;
      const nearbyCenters = getNearbyHexCenters(targetPos, maxGlowRadius);
      for (const hexData of nearbyCenters) {
          const dx = hexData.center.x - targetPos.x;
          const dy = hexData.center.y - targetPos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const proximityFactor = Math.max(0, 1 - dist / maxGlowRadius);
          const opacity = maxGlowOpacity * proximityFactor * proximityFactor;
          const radius = hexRadius * 0.5 * proximityFactor;
          if (opacity > 0.01 && radius > 1) {
              context.fillStyle = glowColor.replace('alpha', opacity.toFixed(3));
              context.beginPath();
              context.arc(hexData.center.x, hexData.center.y, radius, 0, Math.PI * 2);
              context.fill();
          }
      }
  }, [getNearbyHexCenters, maxGlowRadius, hexRadius, glowColor, maxGlowOpacity]);

  // --- Pulse Logic ---
  const lerp = (start: number, end: number, t: number): number => {
      return start * (1 - t) + end * t;
  };

  // Function to find adjacent hex centers (simplified approach)
  const findAdjacentCenter = useCallback((startCenter: Point, allCenters: HexCenterData[]): Point | null => {
    const minDistSq = (hexRadius * 1.8) ** 2;
    const maxDistSq = (hexRadius * 2.2) ** 2;
    const potentialNeighbors: Point[] = [];
    for (const hexData of allCenters) {
      if (hexData.center === startCenter) continue;
      const dx = hexData.center.x - startCenter.x;
      const dy = hexData.center.y - startCenter.y;
      const distSq = dx * dx + dy * dy;
      if (distSq > minDistSq && distSq < maxDistSq) {
        potentialNeighbors.push(hexData.center);
      }
    }
    if (potentialNeighbors.length > 0) {
      return potentialNeighbors[Math.floor(Math.random() * potentialNeighbors.length)];
    } else {
      return null;
    }
  }, [hexRadius]);

  const createPulse = useCallback(() => {
    if (hexCentersRef.current.length === 0 || activePulsesRef.current.length >= pulseMaxLength) {
      return;
    }
    const startIndex = Math.floor(Math.random() * hexCentersRef.current.length);
    const startData = hexCentersRef.current[startIndex];
    const endCenter = findAdjacentCenter(startData.center, hexCentersRef.current);
    if (endCenter) {
      const newPulse: Pulse = {
        id: Date.now() + Math.random(),
        start: startData.center,
        end: endCenter,
        progress: 0,
        speed: pulseSpeed,
        color: pulseColor,
        startTime: performance.now(),
      };
      activePulsesRef.current.push(newPulse);
    }
  }, [findAdjacentCenter, pulseSpeed, pulseColor, pulseMaxLength]);

  const drawPulses = useCallback((context: CanvasRenderingContext2D, deltaTime: number) => {
    const pulsesToRemove: number[] = [];
    context.lineWidth = lineWidth * 1.5;
    for (let i = 0; i < activePulsesRef.current.length; i++) {
        const pulse = activePulsesRef.current[i];
        const distance = Math.sqrt(
            (pulse.end.x - pulse.start.x) ** 2 + (pulse.end.y - pulse.start.y) ** 2
        );
        const timeToTravel = (distance / pulse.speed) * 1000;
        const elapsedTime = performance.now() - pulse.startTime;
        pulse.progress = Math.min(1, elapsedTime / timeToTravel);
        const currentX = lerp(pulse.start.x, pulse.end.x, pulse.progress);
        const currentY = lerp(pulse.start.y, pulse.end.y, pulse.progress);
        context.strokeStyle = pulse.color;
        context.beginPath();
        context.arc(currentX, currentY, lineWidth * 1.5, 0, Math.PI * 2);
        context.fillStyle = pulse.color;
        context.fill();
        if (pulse.progress >= 1) {
            pulsesToRemove.push(pulse.id);
        }
    }
    activePulsesRef.current = activePulsesRef.current.filter(
        pulse => !pulsesToRemove.includes(pulse.id)
    );
    context.lineWidth = lineWidth;
  }, [lineWidth, pulseColor]);

  // --- NEW: Ripple Logic ---
  const createRipple = useCallback((center: Point) => {
      const now = performance.now();
      const newRipple: Ripple = {
          id: now + Math.random(),
          center: center,
          startTime: now,
          maxRadius: rippleMaxRadius,
          duration: rippleDuration,
          color: rippleColor,
      };
      activeRipplesRef.current.push(newRipple);
  }, [rippleMaxRadius, rippleDuration, rippleColor]);

  const drawRipples = useCallback((context: CanvasRenderingContext2D, timestamp: number) => {
    const ripplesToRemove: number[] = [];
    const originalLineWidth = context.lineWidth; // Store original width

    activeRipplesRef.current.forEach(ripple => {
        const elapsedTime = timestamp - ripple.startTime;
        const lifeProgress = Math.min(1, elapsedTime / ripple.duration);

        if (lifeProgress >= 1) {
            ripplesToRemove.push(ripple.id);
            return;
        }

        const currentRadius = ripple.maxRadius * lifeProgress;
        const opacity = maxGlowOpacity * (1 - lifeProgress) * (1 - lifeProgress); // Sharper fade out

        if (opacity <= 0.01) {
            ripplesToRemove.push(ripple.id);
            return;
        }

        // Define the wave band
        const halfWaveThickness = waveThickness / 2;
        const innerRadius = Math.max(0, currentRadius - halfWaveThickness);
        const outerRadius = currentRadius + halfWaveThickness;

        // Set style for the ripple wave lines
        context.lineWidth = originalLineWidth * rippleLineWidthMultiplier;
        context.strokeStyle = ripple.color.replace('alpha', opacity.toFixed(3));

        context.beginPath(); // Start path for all affected hex outlines in this ripple

        // Iterate through ALL hex centers to see if they fall within the wave band
        for (const hexData of hexCentersRef.current) {
            const dx = hexData.center.x - ripple.center.x;
            const dy = hexData.center.y - ripple.center.y;
            const dist = Math.sqrt(dx*dx + dy*dy);

            // Check if the center distance is within the wave band
            if (dist >= innerRadius && dist < outerRadius) {
                // Recalculate corners and add this hex outline to the current path
                const corners = Array.from({ length: 6 }, (_, i) => getHexCorner(hexData.center, hexRadius, i));
                drawHexOutline(context, corners);
            }
        }
        context.stroke(); // Stroke all hexes affected by this ripple wave
    });

    // Remove completed ripples
    activeRipplesRef.current = activeRipplesRef.current.filter(
        ripple => !ripplesToRemove.includes(ripple.id)
    );
    context.lineWidth = originalLineWidth; // Restore original line width
  }, [maxGlowOpacity, waveThickness, rippleLineWidthMultiplier, rippleColor, getHexCorner, hexRadius, drawHexOutline]);

  // --- Animation Loop ---
  const animate = useCallback((timestamp: number) => {
    if (!ctx || !canvasRef.current) {
      animationFrameId.current = requestAnimationFrame(animate);
      return;
    }

    if (lastTimestampRef.current === 0) lastTimestampRef.current = timestamp;
    const deltaTime = (timestamp - lastTimestampRef.current) / 1000;
    lastTimestampRef.current = timestamp;

    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // --- Draw Tessellated Grid (Using the revised function) ---\
    calculateAndDrawTessellatedGrid(ctx, width, height, hexRadius);

    // --- Draw Effects --- //
    drawGlows(ctx, mousePosition.current);
    drawPulses(ctx, deltaTime);
    drawRipples(ctx, timestamp); // Pass timestamp for ripple timing

    // Request next frame
    animationFrameId.current = requestAnimationFrame(animate);
  // Updated dependencies
  }, [ctx, calculateAndDrawTessellatedGrid, drawGlows, drawPulses, drawRipples, hexRadius]);

  // --- Resize Handling ---
  const handleResize = useCallback(() => {
    if (canvasRef.current && ctx) {
      const canvas = canvasRef.current;
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.resetTransform();
      ctx.scale(dpr, dpr);
      // Use the tessellated grid draw function
      calculateAndDrawTessellatedGrid(ctx, canvas.width / dpr, canvas.height / dpr, hexRadius);
    }
  // Updated dependency
  }, [ctx, calculateAndDrawTessellatedGrid, hexRadius]);

  // --- Use Effects (Setup, Resize, Animation, Mouse, Pulse Interval) ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas && !ctx) {
      const context = canvas.getContext('2d');
      if (context) setCtx(context);
      else console.error("Failed to get 2D context");
    }
  }, [ctx]);

  useEffect(() => {
    if (!ctx) return;
    handleResize();
    window.addEventListener('resize', handleResize);
    lastTimestampRef.current = 0;
    animationFrameId.current = requestAnimationFrame(animate);
    if (pulseInterval > 0) {
        pulseIntervalId.current = setInterval(createPulse, pulseInterval);
    }
    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      if (pulseIntervalId.current) clearInterval(pulseIntervalId.current);
    };
  }, [ctx, handleResize, animate, createPulse, pulseInterval]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        mousePosition.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      }
    };
    const handleMouseLeave = () => { mousePosition.current = null; };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  // --- NEW: Effect for Click Listener ---
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
        if (canvasRef.current) {
            const rect = canvasRef.current.getBoundingClientRect();
            // Calculate click position relative to the canvas element
            const clickPos: Point = {
                x: event.clientX - rect.left,
                y: event.clientY - rect.top
            };
            createRipple(clickPos); // Trigger ripple at click position
        }
    };

    // Add click listener to the window
    window.addEventListener('click', handleClick);

    // Cleanup listener on component unmount
    return () => {
        window.removeEventListener('click', handleClick);
    };
  // Added createRipple dependency
  }, [createRipple]);

  return (
    <canvas
      ref={canvasRef}
      className={`fixed top-0 left-0 w-full h-full -z-10 ${className}`}
      style={{ pointerEvents: 'none' }}
    />
  );
};

export default DynamicBackground;