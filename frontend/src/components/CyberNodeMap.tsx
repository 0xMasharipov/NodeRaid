'use client';

import { useEffect, useRef, useCallback } from 'react';
import * as PIXI from 'pixi.js';
import gsap from 'gsap';
import { useGameStore } from '../store/gameStore';

// ─── Map constants ────────────────────────────────────────────────────────────
const GRID_COLS = 32;
const GRID_ROWS = 32;
const CELL = 64;          // flat pixels per cell

// MIP-8 Page layout — 8 subnets of 16×8 nodes each
// Arranged as 2 columns × 4 rows of pages
const PAGE_COLS = 16;
const PAGE_ROWS = 8;
const PAGE_COUNT = 8;

// Colour palette
const COL_BG = 0x02040f;
const COL_GRID = 0x00e5ff;
const COL_GRID_ALPHA = 0.20;

// Default neon color for neutral subnets
const COL_DEFAULT_SUBNET = 0x00e5ff;
// P1 (User) subnet color
const COL_P1_SUBNET = 0x39ff14;
// P2 (Enemy) subnet color
const COL_P2_SUBNET = 0xff003c;

const COL_HOVER = 0x39ff14;  // neon green
const COL_HOVER_ALPHA = 0.30;

// Zoom limits
const ZOOM_MIN = 0.20;
const ZOOM_MAX = 3.50;

// ─── Derived dimensions ────────────────────────────────────────────────────────
const FLAT_W = GRID_COLS * CELL;   // 2048 px
const FLAT_H = GRID_ROWS * CELL;   // 2048 px

// ─── Utilities ────────────────────────────────────────────────────────────────
function getSubnetId(gx: number, gy: number): number {
  return Math.floor(gy / 8) * 2 + Math.floor(gx / 16);
}

/** Map screen coordinates → flat grid cell, or null if outside bounds. */
function screenToGrid(
  isoContainer: PIXI.Container,
  stage: PIXI.Container,
  sx: number,
  sy: number,
): { gx: number; gy: number } | null {
  const local = isoContainer.toLocal(new PIXI.Point(sx, sy), stage);
  const gx = Math.floor(local.x / CELL);
  const gy = Math.floor(local.y / CELL);
  if (gx < 0 || gx >= GRID_COLS || gy < 0 || gy >= GRID_ROWS) return null;
  return { gx, gy };
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function CyberNodeMap() {
  const mountRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);

  const initPixi = useCallback(() => {
    const el = mountRef.current;
    if (!el || appRef.current) return;

    // ── Application ─────────────────────────────────────────────────────────
    const app = new PIXI.Application({
      width: el.clientWidth,
      height: el.clientHeight,
      backgroundColor: COL_BG,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });
    appRef.current = app;
    el.appendChild(app.view as HTMLCanvasElement);

    // ── Camera container (pan + zoom lives here) ─────────────────────────────
    const camera = new PIXI.Container();
    app.stage.addChild(camera);

    // ── Isometric container (child of camera) ────────────────────────────────
    // Pixi applies scale before rotation on a single object.
    // To get true isometric projection, we must rotate FIRST, then squash the Y axis.
    const isoRoot = new PIXI.Container();
    isoRoot.scale.y = 0.5;
    camera.addChild(isoRoot);

    const iso = new PIXI.Container();
    iso.rotation = -Math.PI / 4;
    isoRoot.addChild(iso);

    // Centre the diamond on screen at startup by pivoting at the mathematical center
    iso.pivot.set(FLAT_W / 2, FLAT_H / 2);
    const diagW = FLAT_W * Math.SQRT2;
    const diagH = FLAT_H * Math.SQRT2 * 0.5;
    camera.x = el.clientWidth / 2;
    camera.y = el.clientHeight / 2;

    // ── 3D Platform Depth (Fayans/Slab effect) ───────────────────────────────
    const platformGfx = new PIXI.Graphics();
    iso.addChild(platformGfx);

    // Depth in iso space that perfectly corresponds to straight-down on screen
    const depth = 35;
    const dx = -depth;
    const dy = depth;

    const COL_SIDE_LEFT = 0x01132b;
    const COL_SIDE_RIGHT = 0x011a3a;
    const COL_SIDE_LINE = 0x00e5ff;

    // Left wall (from 0,0 to 0,FLAT_H)
    platformGfx.beginFill(COL_SIDE_LEFT);
    platformGfx.moveTo(0, 0);
    platformGfx.lineTo(0, FLAT_H);
    platformGfx.lineTo(dx, FLAT_H + dy);
    platformGfx.lineTo(dx, dy);
    platformGfx.endFill();

    // Right wall (from 0,FLAT_H to FLAT_W,FLAT_H)
    platformGfx.beginFill(COL_SIDE_RIGHT);
    platformGfx.moveTo(0, FLAT_H);
    platformGfx.lineTo(FLAT_W, FLAT_H);
    platformGfx.lineTo(FLAT_W + dx, FLAT_H + dy);
    platformGfx.lineTo(dx, FLAT_H + dy);
    platformGfx.endFill();

    // Side vertical grid lines
    platformGfx.lineStyle(1, COL_SIDE_LINE, 0.3);
    for (let r = 0; r <= GRID_ROWS; r++) {
      const cy = r * CELL;
      platformGfx.moveTo(0, cy);
      platformGfx.lineTo(dx, cy + dy);
    }
    for (let c = 0; c <= GRID_COLS; c++) {
      const cx = c * CELL;
      platformGfx.moveTo(cx, FLAT_H);
      platformGfx.lineTo(cx + dx, FLAT_H + dy);
    }

    // Platform bottom outline (Glow edge)
    platformGfx.lineStyle(2, COL_SIDE_LINE, 0.8);
    platformGfx.moveTo(dx, dy);
    platformGfx.lineTo(dx, FLAT_H + dy);
    platformGfx.lineTo(FLAT_W + dx, FLAT_H + dy);

    // ── Background ───────────────────────────────────────────────────────────
    const bg = new PIXI.Graphics();
    bg.beginFill(COL_BG);
    bg.drawRect(0, 0, FLAT_W, FLAT_H);
    bg.endFill();
    iso.addChild(bg);

    // ── Standard grid lines ──────────────────────────────────────────────────
    const gridGfx = new PIXI.Graphics();
    gridGfx.lineStyle(1, COL_GRID, COL_GRID_ALPHA);
    for (let c = 0; c <= GRID_COLS; c++) {
      gridGfx.moveTo(c * CELL, 0);
      gridGfx.lineTo(c * CELL, FLAT_H);
    }
    for (let r = 0; r <= GRID_ROWS; r++) {
      gridGfx.moveTo(0, r * CELL);
      gridGfx.lineTo(FLAT_W, r * CELL);
    }
    iso.addChild(gridGfx);

    // ── Dynamic Subnet boundaries and fills ──────────────────────────────────
    const subnetLayer = new PIXI.Container();
    iso.addChild(subnetLayer);

    const subnetFill = new PIXI.Graphics();
    const subnetGfx = new PIXI.Graphics();
    subnetLayer.addChild(subnetFill, subnetGfx);

    let lastSubnetState = '';
    
    function updateSubnets(mapData: import('../store/gameStore').NodeData[]) {
      const owners = new Array(8).fill(null);
      for (const node of mapData) {
        if (node.buildingType === 4 && node.owner) { // Mainframe found
          const subnetId = Math.floor(node.id / 128);
          owners[subnetId] = node.owner;
        }
      }

      const stateStr = owners.join(',');
      if (stateStr === lastSubnetState) return;
      lastSubnetState = stateStr;

      subnetGfx.clear();
      subnetFill.clear();

      for (let pi = 0; pi < PAGE_COUNT; pi++) {
        const pageCol = pi % 2;
        const pageRow = Math.floor(pi / 2);
        const x0 = pageCol * PAGE_COLS * CELL;
        const y0 = pageRow * PAGE_ROWS * CELL;
        const bw = PAGE_COLS * CELL;
        const bh = PAGE_ROWS * CELL;

        let col = COL_DEFAULT_SUBNET;
        if (owners[pi] === 'P1') col = COL_P1_SUBNET;
        else if (owners[pi]) col = COL_P2_SUBNET;

        // Subtle fill
        subnetFill.beginFill(col, 0.05);
        subnetFill.drawRect(x0, y0, bw, bh);
        subnetFill.endFill();

        // Multi-pass glow
        const glowPasses = [
          { width: 12, alpha: 0.06 },
          { width: 8, alpha: 0.10 },
          { width: 5, alpha: 0.16 },
          { width: 3, alpha: 0.30 },
        ];
        for (const { width, alpha } of glowPasses) {
          subnetGfx.lineStyle(width, col, alpha);
          subnetGfx.drawRect(x0, y0, bw, bh);
        }
        subnetGfx.lineStyle(2, col, 0.95);
        subnetGfx.drawRect(x0, y0, bw, bh);
      }
    }

    // ── Page Hash Labels (Painted on the floor) ─────────────────────────────
    const hashLabels = [
      "0x3F9A2", "0x8B1C4", "0x5E0D7", "0x1A4F9",
      "0x9C2B1", "0x4D8E6", "0x7F5A3", "0x2B6C0"
    ];

    const floorLabelLayer = new PIXI.Container();
    iso.addChild(floorLabelLayer);

    for (let pi = 0; pi < PAGE_COUNT; pi++) {
      const pageCol = pi % 2;
      const pageRow = Math.floor(pi / 2);
      
      const x0 = pageCol * PAGE_COLS * CELL;
      const y0 = pageRow * PAGE_ROWS * CELL;

      const label = new PIXI.Text(hashLabels[pi], {
        fontFamily: 'Orbitron, Rajdhani, monospace',
        fontSize: 28,
        fontWeight: '700',
        fill: 0xffffff,
        alpha: 0.25,
      });

      // Position near the top corner of the subnet cell (in flat space)
      label.x = x0 + 15;
      label.y = y0 + 10;
      
      floorLabelLayer.addChild(label);
    }

    // ── Buildings Layer ──────────────────────────────────────────────────────
    const buildingsLayer = new PIXI.Container();
    iso.addChild(buildingsLayer);

    const buildingSprites: Record<number, { gfx: PIXI.Container; text: PIXI.Text; spriteImg: PIXI.Sprite | null }> = {};



    // Ticker for updating buildings and uncollected data visually
    let lastTick = 0;
    app.ticker.add(() => {
      lastTick += app.ticker.deltaMS;
      if (lastTick >= 1000) {
        lastTick = 0;
        useGameStore.getState().tickMiners();
      }

      const mapData = useGameStore.getState().mapData;
      
      // Update subnet dynamic colors
      updateSubnets(mapData);

      for (const node of mapData) {
        let sprite = buildingSprites[node.id];

        if (node.buildingType !== 0 && !sprite) {
          const gfx = new PIXI.Container();
          const text = new PIXI.Text('', {
            fontFamily: 'Orbitron, Rajdhani, monospace',
            fontSize: 18,
            fontWeight: '700',
            fill: 0xffffff,
            align: 'center',
            dropShadow: true,
            dropShadowColor: 0x000000,
            dropShadowBlur: 4,
            dropShadowDistance: 2,
          });
          text.anchor.set(0.5, 0.5);
          // Counteract isometric squash and rotation so text faces camera
          text.rotation = Math.PI / 4;
          text.scale.set(1, 2);

          const gx = node.id % GRID_COLS;
          const gy = Math.floor(node.id / GRID_COLS);

          gfx.x = gx * CELL;
          gfx.y = gy * CELL;

          let spriteImg: PIXI.Sprite | null = null;
          let textUpOffset = 0;

          if (node.buildingType === 1) {
            spriteImg = PIXI.Sprite.from('/miner.png');
            textUpOffset = 70;
          } else if (node.buildingType === 2) {
            spriteImg = PIXI.Sprite.from('/firewall.png');
            textUpOffset = 70;
          } else if (node.buildingType === 3) {
            spriteImg = PIXI.Sprite.from('/mainframe.png');
            textUpOffset = 70;
          } else if (node.buildingType === 4) {
            spriteImg = PIXI.Sprite.from('/dataCent.png');
            textUpOffset = 70;
          }

          if (spriteImg) {
            spriteImg.anchor.set(0.5, 0.80);
            spriteImg.rotation = Math.PI / 4;
            // Tüm yeni assetler 600x327 boyutunda olduğu için ortak scale kullanıyoruz
            spriteImg.scale.set(0.22, 0.44);
            
            spriteImg.x = CELL / 2;
            spriteImg.y = CELL / 2;
            
            gfx.addChild(spriteImg);
          }

          // İzometrik düzlemde yazıyı tam yukarı (straight up) taşımak için
          // X eksenine ekleyip, Y ekseninden çıkarıyoruz:
          text.x = CELL / 2 + textUpOffset;
          text.y = CELL / 2 - textUpOffset;

          gfx.addChild(text);
          buildingsLayer.addChild(gfx);
          sprite = { gfx, text, spriteImg };
          buildingSprites[node.id] = sprite;
        }

        if (sprite) {
          if (node.buildingType === 0) {
            buildingsLayer.removeChild(sprite.gfx);
            sprite.gfx.destroy({ children: true });
            delete buildingSprites[node.id];
          } else {
            if (node.buildingType === 1) {
              sprite.text.text = node.uncollectedData > 0 ? `${node.uncollectedData}` : '';
            } else if (node.buildingType === 2) {
              sprite.text.text = '';
            } else if (node.buildingType === 3) {
              sprite.text.text = node.username || '';
            } else if (node.buildingType === 4) {
              sprite.text.text = '';
            }
          }
        }
      }
    });

    // ── Collapse Event Listener (GSAP) ───────────────────────────────────────
    const onCollapse = (e: Event) => {
      const customEvent = e as CustomEvent<{ nodeId: number; onComplete: () => void }>;
      const { nodeId, onComplete } = customEvent.detail;
      const spriteData = buildingSprites[nodeId];

      if (!spriteData || !spriteData.spriteImg) {
        onComplete();
        return;
      }

      const img = spriteData.spriteImg;
      const originalScaleY = img.scale.y;
      
      // Stop rendering text immediately during glitch
      spriteData.text.visible = false;

      // GSAP Timeline for Digital Glitch & Collapse
      const tl = gsap.timeline({
        onComplete: () => {
          // Once animation finishes, call state updater (e.g. destroyNode)
          onComplete();
        }
      });

      // Aşama 1: Shock & Glitch (Daha uzun ve belirgin)
      tl.to(img, {
        tint: 0xFF0000,
        duration: 0.2, // Rengin dönme süresi uzatıldı
      })
      .to(img.position, {
        x: img.x + 12,
        yoyo: true,
        repeat: 15, // Daha çok titreme (eskiden 5)
        duration: 0.05, // Titreme hızı yavaşlatıldı (eskiden 0.03)
        ease: "rough({ template: none.out, strength: 1, points: 20, taper: 'none', randomize: true, clamp: false })"
      })
      // Aşama 2: Data Dissolve (Erişerek zemine çökme - Yavaşlatıldı)
      .to(img.scale, {
        y: 0,
        duration: 1.2, // Çökme süresi uzatıldı (eskiden 0.4)
        ease: "power2.in",
      }, "+=0.2") // Titreme bitince azıcık bekle
      .to(img, {
        alpha: 0,
        duration: 0.8, // Kaybolma süresi uzatıldı (eskiden 0.3)
      }, "<0.3"); // Çökmeye başladıktan biraz sonra saydamlaşmaya başla
    };

    window.addEventListener('cyber-collapse', onCollapse);

    // ── Hover overlay (drawn on top of everything) ───────────────────────────
    const hoverGfx = new PIXI.Graphics();
    iso.addChild(hoverGfx);

    function drawHover(gx: number | null, gy: number | null) {
      hoverGfx.clear();
      if (gx === null || gy === null) return;
      hoverGfx.beginFill(COL_HOVER, COL_HOVER_ALPHA);
      hoverGfx.lineStyle(1.5, COL_HOVER, 0.95);
      hoverGfx.drawRect(gx * CELL, gy * CELL, CELL, CELL);
      hoverGfx.endFill();
    }

    // ── Interaction state ────────────────────────────────────────────────────
    let isDragging = false;
    let didDrag = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let camOriginX = 0;
    let camOriginY = 0;
    let hovGx: number | null = null;
    let hovGy: number | null = null;

    app.stage.interactive = true;
    app.stage.hitArea = new PIXI.Rectangle(0, 0, el.clientWidth, el.clientHeight);

    // Camera bounds clamping
    function clampCamera() {
      const s = camera.scale.x;
      const iW = diagW * s;
      const iH = diagH * s;
      const pw = el.clientWidth;
      const ph = el.clientHeight;

      camera.x = Math.min(camera.x, pw + iW / 2);
      camera.x = Math.max(camera.x, -iW / 2);
      camera.y = Math.min(camera.y, ph + iH / 2);
      camera.y = Math.max(camera.y, -iH / 2);
    }

    // Pointer move → hover + drag
    app.stage.on('pointermove', (e: PIXI.FederatedPointerEvent) => {
      const { x, y } = e.global;

      if (isDragging) {
        const dx = x - dragStartX;
        const dy = y - dragStartY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDrag = true;
        camera.x = camOriginX + dx;
        camera.y = camOriginY + dy;
        clampCamera();
        return;
      }

      const cell = screenToGrid(iso, app.stage, x, y);
      const ngx = cell?.gx ?? null;
      const ngy = cell?.gy ?? null;
      if (ngx !== hovGx || ngy !== hovGy) {
        hovGx = ngx;
        hovGy = ngy;
        drawHover(hovGx, hovGy);
      }
    });

    // Pointer down → begin drag
    app.stage.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      isDragging = true;
      didDrag = false;
      dragStartX = e.global.x;
      dragStartY = e.global.y;
      camOriginX = camera.x;
      camOriginY = camera.y;
    });

    // Pointer up → end drag or fire click
    const handlePointerUp = (e: PIXI.FederatedPointerEvent) => {
      if (!isDragging) return;
      isDragging = false;

      if (!didDrag) {
        const cell = screenToGrid(iso, app.stage, e.global.x, e.global.y);
        if (cell) {
          const { gx, gy } = cell;
          const nodeId = gy * GRID_COLS + gx;
          const subnetId = getSubnetId(gx, gy);

          useGameStore.getState().setSelectedNodeId(nodeId);

          console.log(
            `%c[CyberNode] %cx=${gx}, y=${gy} | nodeId=${nodeId} | subnetId=${subnetId} (PAGE ${subnetId + 1})`,
            'color:#00e5ff;font-weight:bold',
            'color:#39ff14',
          );
        }
      }
      didDrag = false;
    };

    app.stage.on('pointerup', handlePointerUp);
    app.stage.on('pointerupoutside', handlePointerUp);

    // ── Wheel zoom (zoom-to-pointer) ─────────────────────────────────────────
    const canvasEl = app.view as HTMLCanvasElement;

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.10 : 0.91;
      const newScale = Math.min(Math.max(camera.scale.x * factor, ZOOM_MIN), ZOOM_MAX);
      const ratio = newScale / camera.scale.x;

      const rect = canvasEl.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      camera.x = mx - (mx - camera.x) * ratio;
      camera.y = my - (my - camera.y) * ratio;
      camera.scale.set(newScale);
      clampCamera();
    }

    canvasEl.addEventListener('wheel', onWheel, { passive: false });

    // ── Resize ───────────────────────────────────────────────────────────────
    function onResize() {
      if (!el) return;
      app.renderer.resize(el.clientWidth, el.clientHeight);
      app.stage.hitArea = new PIXI.Rectangle(0, 0, el.clientWidth, el.clientHeight);
    }
    window.addEventListener('resize', onResize);

    // Stash cleanup handles
    (app as any).__onWheel = onWheel;
    (app as any).__onResize = onResize;
    (app as any).__onCollapse = onCollapse;
  }, []);

  useEffect(() => {
    // Guard against React Strict Mode double-invoke
    if (appRef.current) return;
    initPixi();

    return () => {
      const app = appRef.current;
      if (!app) return;

      const canvasEl = app.view as HTMLCanvasElement;
      canvasEl.removeEventListener('wheel', (app as any).__onWheel);
      window.removeEventListener('resize', (app as any).__onResize);

      // texture ve baseTexture'ı yok etme, aksi takdirde React Strict Mode 
      // ikinci render'ında siyah ekran veya flashing oluşur (çünkü cache silinir)
      app.destroy(true, { children: true });
      appRef.current = null;
      window.removeEventListener('cyber-collapse', (app as any).__onCollapse);
    };
  }, [initPixi]);

  return (
    <div
      ref={mountRef}
      id="cyber-node-canvas"
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        cursor: 'crosshair',
      }}
    />
  );
}
