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

// --- NEW: Highlighted Hex Interface ---
interface HighlightedHex {
    id: number;
    center: Point;
    radius: number; // Store radius for drawing
    startTime: number;
    duration: number;
    maxOpacity: number;
    color: string;
}

// Component Props (optional for now, could add config later)
interface DynamicBackgroundProps {
    className?: string;
    hexRadius?: number;
    gridColor?: string;
    lineWidth?: number;
    glowColor?: string; // Base color for hover glow
    maxGlowRadius?: number; // Added for glow size/intensity calculation
    maxGlowOpacity?: number; // Added for glow opacity calculation
    rippleColor?: string; // Added for ripples
    rippleMaxRadius?: number;
    rippleDuration?: number;
    rippleLineWidthMultiplier?: number; // Optional: Make ripple lines thicker
    waveThickness?: number; // << NEW: Thickness of the wave band
    highlightInterval?: number; // Time between highlight bursts (ms)
    highlightDuration?: number; // How long each highlight lasts (ms)
    highlightPercentage?: number; // Percentage of hexes to highlight per burst (0-1)
    highlightColor?: string; // Color for highlights (supports alpha)
    highlightMaxOpacity?: number; // Peak opacity during fade
    highlightMaxAmount?: number; // Max simultaneous highlighted hexes (optional limit)
}

const DynamicBackground: React.FC<DynamicBackgroundProps> = ({
    className = '',
    hexRadius = 10, // << Increased default radius
    gridColor = 'rgba(0, 189, 214, 0.2)', 
    lineWidth = 1,
    glowColor = 'rgba(0, 189, 214, alpha)', // Base color for hover glow
    maxGlowRadius = 200, // << Increased glow radius
    maxGlowOpacity = 0.3, // Max opacity of the glow at the center
    rippleColor = 'rgba(0, 189, 214, alpha)', // Ripple color (cyan, alpha calculated)
    rippleMaxRadius = 300, // 
    rippleDuration = 300, //
    rippleLineWidthMultiplier = 1.5, // << Default thicker ripple lines
    waveThickness = 60, // << NEW: Default wave thickness (adjust as needed)
    highlightInterval = 2000, 
    highlightDuration = 2000, 
    highlightPercentage = 0.7, // Highlight 5% of hexes per burst
    highlightColor = 'rgba(0, 189, 214, alpha)', // Slightly different cyan for highlight
    highlightMaxOpacity = 0.2, // Keep highlight subtle
    highlightMaxAmount = 200, // Limit concurrent highlights (optional)
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctx = useRef<CanvasRenderingContext2D | null>(null); // Use useRef for ctx
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null); // <-- NEW: Ref for offscreen canvas
  const offscreenCtxRef = useRef<CanvasRenderingContext2D | null>(null); // <-- NEW: Ref for offscreen context
  const animationFrameId = useRef<number | null>(null); // Ref to store animation frame ID
  const hexCentersRef = useRef<HexCenterData[]>([]); // Ref to store pre-calculated centers
  const mousePosition = useRef<Point | null>(null); // Ref for mouse position (state causes re-renders)
  const activeRipplesRef = useRef<Ripple[]>([]);
  const activeHighlightsRef = useRef<HighlightedHex[]>([]);
  const highlightIntervalId = useRef<NodeJS.Timeout | null>(null);
  const lastTimestampRef = useRef<number>(0); // For delta time calculation

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
  const drawHexOutline = useCallback((context: CanvasRenderingContext2D, corners: Point[]) => {
      if (!corners || corners.length < 6) return;
      context.moveTo(corners[0].x, corners[0].y);
      for (let i = 1; i < 6; i++) {
          context.lineTo(corners[i].x, corners[i].y);
      }
      context.closePath(); // Close the path back to the start
  }, []);

  // --- REVISED: Grid Calculation & Drawing (Draws to a given context) ---
  const drawGridAndCalculateCenters = useCallback((context: CanvasRenderingContext2D, width: number, height: number, radius: number) => {
    // Reset hex centers calculation for this run
    hexCentersRef.current = [];
    const newCentersData: HexCenterData[] = [];

    // Clear only the context we're drawing to (the offscreen one)
    context.clearRect(0, 0, width, height);

    // --- Grid Glow Settings (Apply to the offscreen canvas drawing) ---
    // Keep shadows on the offscreen grid draw for now if desired effect
    context.shadowColor = gridColor.replace('alpha', '1');
    context.shadowBlur = 5;
    context.shadowOffsetX = 2;
    context.shadowOffsetY = -2;
    // ------------------------

    context.strokeStyle = gridColor;
    context.lineWidth = lineWidth;

    const hexHeight = radius * Math.sqrt(3);
    const hexWidth = radius * 2;
    const vertDist = hexHeight;
    const horizDist = (hexWidth * 3) / 4;

    const rows = Math.ceil(height / vertDist) + 2;
    const cols = Math.ceil(width / horizDist) + 2;

    // --- Apply Blur Filter ---
    context.filter = 'blur(2px)';
    // ------------------------

    context.beginPath();

    for (let row = -1; row < rows; row++) {
      for (let col = -1; col < cols; col++) {
        const cx = col * horizDist;
        const cy = row * vertDist + (col % 2 !== 0 ? vertDist / 2 : 0);
        const center = { x: cx, y: cy };

        // Only calculate/draw if within extended bounds
        if (cx > -horizDist - radius && cx < width + horizDist + radius && cy > -vertDist - radius && cy < height + vertDist + radius) {
            // Important: Calculate and STORE centers even though drawing is offscreen
            newCentersData.push({ center });
            const corners = Array.from({ length: 6 }, (_, i) => getHexCorner(center, radius, i));
            drawHexOutline(context, corners);
        }
      }
    }
    context.stroke();

    // --- Reset Filter and Shadow Settings ---
    context.filter = 'none'; // Reset blur immediately after drawing
    context.shadowColor = 'transparent';
    context.shadowBlur = 0;
    context.shadowOffsetX = 0; // Also reset offsets
    context.shadowOffsetY = 0;
    // --------------------------------------

    // Update the ref with the calculated centers
    hexCentersRef.current = newCentersData;

  }, [getHexCorner, drawHexOutline, gridColor, lineWidth]);

  // --- Glow Logic (Revised for Glow Effect) ---
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

      // --- Glow Shadow Settings ---
      // Use the glow color itself for the shadow to enhance it
      context.shadowColor = glowColor.replace('alpha', '1'); 
      context.shadowBlur = 10; // Make hover glow blurrier
      context.shadowOffsetX = 2;
      context.shadowOffsetY = 2;
      // --------------------------

      const nearbyCenters = getNearbyHexCenters(targetPos, maxGlowRadius);
      for (const hexData of nearbyCenters) {
          const dx = hexData.center.x - targetPos.x;
          const dy = hexData.center.y - targetPos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const proximityFactor = Math.max(0, 1 - dist / maxGlowRadius);
          const opacity = maxGlowOpacity * proximityFactor * proximityFactor;
          const radius = hexRadius * 0.5 * proximityFactor;
          if (opacity > 0.01 && radius > 1) {
              // Base fill color can be slightly less opaque now
              context.fillStyle = glowColor.replace('alpha', (opacity * 0.7).toFixed(3)); 
              context.beginPath();
              context.arc(hexData.center.x, hexData.center.y, radius, 0, Math.PI * 2);
              context.fill();
          }
      }

      // --- Reset Shadow Settings ---
      context.shadowColor = 'transparent';
      context.shadowBlur = 0;
      // ---------------------------
  }, [getNearbyHexCenters, maxGlowRadius, hexRadius, glowColor, maxGlowOpacity]);

  // --- Ripple Logic (Could optionally add shadow here too) ---
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

  // --- NEW: Highlight Logic ---
  const createHighlightBurst = useCallback(() => {
      if (hexCentersRef.current.length === 0) return;

      const numToHighlight = Math.max(1, Math.floor(hexCentersRef.current.length * highlightPercentage));
      const availableIndices = Array.from(hexCentersRef.current.keys());
      const now = performance.now();
      let countAdded = 0;

      for (let i = 0; i < numToHighlight; i++) {
          if (availableIndices.length === 0) break;
          if (activeHighlightsRef.current.length >= highlightMaxAmount) break;

          const randomIndex = Math.floor(Math.random() * availableIndices.length);
          const hexIndex = availableIndices.splice(randomIndex, 1)[0];
          const hexData = hexCentersRef.current[hexIndex];
          if (!hexData) continue;

          const newHighlight: HighlightedHex = {
              id: now + Math.random(),
              center: hexData.center,
              radius: hexRadius,
              startTime: now,
              duration: highlightDuration,
              maxOpacity: highlightMaxOpacity,
              color: highlightColor,
          };
          activeHighlightsRef.current.push(newHighlight);
          countAdded++;
      }
      // *** DEBUG LOG ***
      if (countAdded > 0) {
          console.log(`[Highlight] Created Burst: Added ${countAdded} highlights. Total active: ${activeHighlightsRef.current.length}`);
      }

  }, [highlightPercentage, highlightDuration, highlightMaxOpacity, highlightColor, hexRadius, highlightMaxAmount]);

  const drawHighlights = useCallback((context: CanvasRenderingContext2D, timestamp: number) => {
    const highlightsToRemove: number[] = [];
    const originalLineWidth = context.lineWidth;

    // Define fade phases (e.g., 20% fade in, 60% hold, 20% fade out)
    const fadeInRatio = 0.2;
    const fadeOutRatio = 0.2;
    const holdRatio = 1.0 - fadeInRatio - fadeOutRatio;

    activeHighlightsRef.current.forEach(highlight => {
        const elapsedTime = Math.max(0, timestamp - highlight.startTime);
        const lifeProgress = Math.min(1, elapsedTime / highlight.duration);

        // --- Only remove when duration is fully complete ---
        if (lifeProgress >= 1) {
            highlightsToRemove.push(highlight.id);
            return; // Stop processing this highlight if it's expired
        }

        // --- Plateau Fade Calculation with Easing --- 
        let phaseProgress = 0;
        if (lifeProgress < fadeInRatio) { 
            // Fade In Phase (Ease Out Quad)
            const t = lifeProgress / fadeInRatio; // Normalize progress within phase (0 to 1)
            phaseProgress = 1 - (1 - t) * (1 - t);
        } else if (lifeProgress < fadeInRatio + holdRatio) {
            // Hold Phase
            phaseProgress = 1.0;
        } else { 
            // Fade Out Phase (Ease In Quad)
            const t = (lifeProgress - (fadeInRatio + holdRatio)) / fadeOutRatio; // Normalize progress (0 to 1)
            phaseProgress = 1 - (t * t);
        }

        const opacity = highlight.maxOpacity * Math.max(0, Math.min(1, phaseProgress)); 
        // ---------------------------------------------

        // --- Removed opacity check for removal ---

        // --- Only draw if opacity is significant ---
        if (opacity > 0.01) {
            context.strokeStyle = highlight.color.replace('alpha', opacity.toFixed(3));
            context.lineWidth = originalLineWidth * 2.5;
            const corners = Array.from({ length: 6 }, (_, i) => getHexCorner(highlight.center, highlight.radius, i));
            context.beginPath();
            drawHexOutline(context, corners);
            context.stroke();
        }
        // Else, do nothing (don't draw if opacity is too low)
    });

    // Remove completed highlights based on duration ONLY
    activeHighlightsRef.current = activeHighlightsRef.current.filter(
        highlight => !highlightsToRemove.includes(highlight.id)
    );

    context.lineWidth = originalLineWidth;
  }, [getHexCorner, drawHexOutline, highlightColor, highlightMaxOpacity, highlightDuration]);

  // --- Animation Loop (REVISED) ---
  const animate = useCallback((timestamp: number) => {
    const mainCtx = ctx.current; // Get context from ref
    const canvas = canvasRef.current;
    if (!mainCtx || !canvas) {
      animationFrameId.current = requestAnimationFrame(animate);
      return;
    }

    if (lastTimestampRef.current === 0) lastTimestampRef.current = timestamp;
    const deltaTime = (timestamp - lastTimestampRef.current) / 1000;
    lastTimestampRef.current = timestamp;

    const dpr = window.devicePixelRatio || 1; // Recalculate here in case it changes? (unlikely)
    // Use logical width/height for drawing operations
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    // --- Fill background ---
    mainCtx.fillStyle = '#030712';
    mainCtx.fillRect(0, 0, width, height);
    // ctx.clearRect(0, 0, width, height); // Removed clearRect
    // -------------------------------------------

    // 1. --- Draw Pre-rendered Grid from Offscreen Canvas ---
    const offscreenCanvas = offscreenCanvasRef.current;
    if (offscreenCanvas && offscreenCanvas.width > 0 && offscreenCanvas.height > 0) {
        // Use logical width/height for the destination size
        // Ensure we draw from the 0,0 coordinate of the offscreen canvas
        mainCtx.drawImage(offscreenCanvas, 0, 0, offscreenCanvas.width, offscreenCanvas.height, 0, 0, width, height);
    }
    // -----------------------------------------------------

    // 2. Draw Base Highlights (on main canvas)
    drawHighlights(mainCtx, timestamp);

    // 3. Draw Interactive Effects (on main canvas)
    drawGlows(mainCtx, mousePosition.current);
    drawRipples(mainCtx, timestamp);

    // Request next frame
    animationFrameId.current = requestAnimationFrame(animate);
  }, [drawHighlights, drawGlows, drawRipples]); // Dependencies change: remove grid drawing

  // --- Resize Handling (REVISED) ---
  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !ctx.current) return; // Check main canvas and context ref

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    // Resize main canvas
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.current.resetTransform(); // Reset transform on main context
    ctx.current.scale(dpr, dpr);
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    // --- NEW: Manage Offscreen Canvas ---
    // Create if doesn't exist
    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement('canvas');
      // console.log("[Offscreen] Created canvas");
    }
    const offscreenCanvas = offscreenCanvasRef.current;

    // Resize offscreen canvas (crucial!)
    if (offscreenCanvas.width !== canvas.width || offscreenCanvas.height !== canvas.height) {
        offscreenCanvas.width = canvas.width;
        offscreenCanvas.height = canvas.height;
        // console.log(`[Offscreen] Resized to ${offscreenCanvas.width}x${offscreenCanvas.height}`);

        // Get/update offscreen context ONLY after size is set
        if (!offscreenCtxRef.current) {
            offscreenCtxRef.current = offscreenCanvas.getContext('2d', { alpha: false }); // alpha:false might improve perf slightly
            // console.log("[Offscreen] Got context");
        }

        const offscreenCtx = offscreenCtxRef.current;
        if (offscreenCtx) {
            // Scale offscreen context like the main one
            offscreenCtx.resetTransform();
            offscreenCtx.scale(dpr, dpr);
            // console.log("[Offscreen] Context scaled");

            // Draw the grid onto the (now correctly sized) offscreen canvas
            // console.log("[Offscreen] Drawing grid...");
            drawGridAndCalculateCenters(offscreenCtx, width, height, hexRadius);
            // console.log("[Offscreen] Grid drawn.");
        } else {
            console.error("Failed to get offscreen 2D context");
        }
    }
    // --- END NEW ---

    // No need to draw grid to main canvas here, animate loop will handle it
  }, [drawGridAndCalculateCenters, hexRadius]); // Added drawGridAndCalculateCenters dependency

  // --- Use Effects (Setup, Resize, Animation, Mouse, Click) ---
  useEffect(() => {
    const canvas = canvasRef.current;
    // Get main context and store in ref
    if (canvas && !ctx.current) {
      const context = canvas.getContext('2d', { alpha: false }); // Use alpha:false for main too?
      if (context) {
        ctx.current = context;
        // console.log("[Main Canvas] Context set in ref");
      } else {
        console.error("Failed to get main 2D context");
      }
    }

    // Cleanup function remains the same
    // return () => { ... };
  }, []); // Run only once on mount to get context

  useEffect(() => {
    // This effect depends on the main context being available in ctx.current
    const mainCtxCurrent = ctx.current; // Capture the value for the effect closure
    if (!mainCtxCurrent) return;

    // console.log("[Resize Effect] Attaching listener and running initial resize");
    // Initial setup: call resize handler to set initial sizes and draw offscreen grid
    handleResize(); // <-- This will now handle the initial offscreen draw

    window.addEventListener('resize', handleResize);
    lastTimestampRef.current = 0; // Reset timestamp for animation start
    animationFrameId.current = requestAnimationFrame(animate);

    if (highlightInterval > 0 && highlightIntervalId.current === null) { // Prevent multiple intervals
        // console.log("[Highlight] Starting interval timer");
        highlightIntervalId.current = setInterval(createHighlightBurst, highlightInterval);
    }

    return () => {
      // console.log("[Resize Effect] Cleaning up");
      window.removeEventListener('resize', handleResize);
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      if (highlightIntervalId.current) {
        // console.log("[Highlight] Clearing interval timer");
        clearInterval(highlightIntervalId.current);
        highlightIntervalId.current = null; // Reset ref
      }
    };
    // Re-run if context becomes available or resize handler/animate changes identity
  }, [handleResize, animate, createHighlightBurst, highlightInterval]); // ctx.current dependency removed as it's captured

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
    <div className="fixed top-0 left-0 w-full h-full -z-20 bg-black">
      <canvas
        ref={canvasRef}
        className={`fixed top-0 left-0 w-full h-full -z-10 ${className}`}
        style={{ pointerEvents: 'none' }}
      />
    </div>
  );
};

export default DynamicBackground;