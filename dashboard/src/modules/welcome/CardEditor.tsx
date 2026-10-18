// "Willkommenskarte": canvas designer for the welcome/goodbye image card (same renderer as the bot).

import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import {
  CARD_HEIGHT, CARD_LAYER_LABELS, CARD_MAX_LAYERS, CARD_TEMPLATES, CARD_WIDTH, TEXT_LINE_HEIGHT, cardImageUrls, fillPlaceholders, layoutText, renderCard,
  type CardAssets, type CardLayer, type CardLayerType, type CardVars, type WelcomeCard,
} from '../../../../src/shared/welcomeCard';
import { useAction, useGuild, useToast, useUser } from '../../api';
import { Actions, Badge, Card, Field, Modal, Select, Switch, Tabs } from '../../components/ui';
import { useConfirm } from '../../components/ConfirmDialog';
import { loadCardFonts } from './cardFonts';
import { BackgroundFields, LayerFields } from './CardFields';

type Ctx = CanvasRenderingContext2D;
interface Box { x: number; y: number; w: number; h: number }

const HANDLE = 22;
const clampX = (value: number) => Math.round(Math.min(CARD_WIDTH * 2, Math.max(-CARD_WIDTH, value)));
const clampY = (value: number) => Math.round(Math.min(CARD_HEIGHT * 2, Math.max(-CARD_HEIGHT, value)));

// ---------- Images ----------

const imageCache = new Map<string, Promise<HTMLImageElement | null>>();
function loadImage(url: string): Promise<HTMLImageElement | null> {
  let promise = imageCache.get(url);
  if (!promise) {
    promise = new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = url;
    });
    imageCache.set(url, promise);
  }
  return promise;
}

function useCardAssets(card: WelcomeCard, avatarUrl: string | null): CardAssets<HTMLImageElement> {
  const urls = cardImageUrls(card);
  const key = urls.join('\n');
  const [assets, setAssets] = useState<CardAssets<HTMLImageElement>>({ avatar: null, images: new Map() });
  useEffect(() => {
    let cancelled = false;
    Promise.all([avatarUrl ? loadImage(avatarUrl) : Promise.resolve(null), ...urls.map(loadImage)]).then(([avatar, ...images]) => {
      if (cancelled) return;
      const loaded = new Map<string, HTMLImageElement>();
      urls.forEach((url, index) => { const image = images[index]; if (image) loaded.set(url, image); });
      setAssets({ avatar, images: loaded });
    });
    return () => { cancelled = true; };
  }, [key, avatarUrl]); // `key` stands for `urls`.
  return assets;
}

// ---------- Geometry ----------

function layerBox(ctx: Ctx, layer: CardLayer, vars: CardVars): Box {
  switch (layer.type) {
    case 'avatar': return { x: layer.x, y: layer.y, w: layer.size, h: layer.size };
    case 'rect':
    case 'image': return { x: layer.x, y: layer.y, w: layer.w, h: layer.h };
    case 'circle': return { x: layer.x - layer.r, y: layer.y - layer.r, w: layer.r * 2, h: layer.r * 2 };
    case 'line': {
      const pad = Math.max(layer.width / 2, 8);
      return { x: Math.min(layer.x1, layer.x2) - pad, y: Math.min(layer.y1, layer.y2) - pad, w: Math.abs(layer.x2 - layer.x1) + pad * 2, h: Math.abs(layer.y2 - layer.y1) + pad * 2 };
    }
    case 'text': {
      const { lines, size, width } = layoutText(ctx, layer, vars);
      const w = Math.max(width, 20);
      const x = layer.align === 'left' ? layer.x : layer.align === 'center' ? layer.x - w / 2 : layer.x - w;
      return { x, y: layer.y - size * 0.85, w, h: size * 0.85 + (lines.length - 1) * size * TEXT_LINE_HEIGHT + size * 0.3 };
    }
  }
}

const resizable = (layer: CardLayer) => layer.type === 'rect' || layer.type === 'image' || layer.type === 'avatar' || layer.type === 'circle';
const inBox = (box: Box, x: number, y: number) => x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h;
const handleBox = (box: Box): Box => ({ x: box.x + box.w - HANDLE / 2, y: box.y + box.h - HANDLE / 2, w: HANDLE, h: HANDLE });

function moved(layer: CardLayer, dx: number, dy: number): CardLayer {
  if (layer.type === 'line') {
    return { ...layer, x1: clampX(layer.x1 + dx), y1: clampY(layer.y1 + dy), x2: clampX(layer.x2 + dx), y2: clampY(layer.y2 + dy) };
  }
  return { ...layer, x: clampX(layer.x + dx), y: clampY(layer.y + dy) };
}

function resized(layer: CardLayer, dx: number, dy: number, px: number, py: number): CardLayer {
  switch (layer.type) {
    case 'rect':
    case 'image': return { ...layer, w: Math.round(Math.min(2048, Math.max(1, layer.w + dx))), h: Math.round(Math.min(2048, Math.max(1, layer.h + dy))) };
    case 'avatar': return { ...layer, size: Math.round(Math.min(1024, Math.max(16, layer.size + Math.max(dx, dy)))) };
    case 'circle': return { ...layer, r: Math.round(Math.min(1024, Math.max(1, Math.max(px - layer.x, py - layer.y)))) };
    default: return layer;
  }
}

function drawSelection(ctx: Ctx, box: Box, handle: boolean) {
  ctx.save();
  ctx.strokeStyle = '#7C5CFF';
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 6]);
  ctx.strokeRect(box.x, box.y, box.w, box.h);
  if (handle) {
    const h = handleBox(box);
    ctx.setLineDash([]);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(h.x, h.y, h.w, h.h);
    ctx.strokeRect(h.x, h.y, h.w, h.h);
  }
  ctx.restore();
}

// ---------- New layers ----------

const newId = () => Math.random().toString(36).slice(2, 10);

function newLayer(type: CardLayerType, imageUrl: string): CardLayer {
  const id = newId();
  switch (type) {
    case 'text': return { id, type, x: 512, y: 240, text: 'Neuer Text', font: 'inter', size: 48, weight: 700, color: '#FFFFFF', align: 'center', maxWidth: 900, shadow: true };
    case 'rect': return { id, type, x: 412, y: 175, w: 200, h: 100, radius: 16, color: '#FFFFFF', opacity: 30 };
    case 'circle': return { id, type, x: 512, y: 225, r: 60, color: '#FFFFFF', opacity: 30 };
    case 'line': return { id, type, x1: 412, y1: 225, x2: 612, y2: 225, width: 4, color: '#FFFFFF', opacity: 100 };
    case 'image': return { id, type, x: 437, y: 150, w: 150, h: 150, url: imageUrl, radius: 24, opacity: 100 };
    case 'avatar': return { id, type, x: 412, y: 125, size: 200, shape: 'circle', borderWidth: 6, borderColor: '#FFFFFF' };
  }
}

const ADDABLE: CardLayerType[] = ['text', 'rect', 'circle', 'line', 'image', 'avatar'];

function layerTitle(layer: CardLayer, vars: CardVars) {
  return layer.type === 'text' ? fillPlaceholders(layer.text, vars).replace(/\n/g, ' ') || 'Leerer Text' : CARD_LAYER_LABELS[layer.type];
}

// ---------- Editor ----------

interface Drag { mode: 'move' | 'resize'; id: string; startX: number; startY: number; origin: CardLayer }

export function CardEditor({ kind, value, onChange }: { kind: 'welcome' | 'goodbye'; value: WelcomeCard; onChange: (card: WelcomeCard) => void }) {
  const { guild } = useGuild();
  const user = useUser();
  const toast = useToast();
  const { run, busy } = useAction();
  const { confirm, dialog } = useConfirm();
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<Drag | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panel, setPanel] = useState<'layer' | 'background'>('background');
  const [hover, setHover] = useState<'move' | 'resize' | null>(null);
  const [fontsReady, setFontsReady] = useState(false);
  const [template, setTemplate] = useState(CARD_TEMPLATES[0].id);
  const [serverPreview, setServerPreview] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);

  const name = user?.globalName ?? user?.username ?? 'Nexo-Fan';
  const vars = useMemo<CardVars>(() => ({
    userName: name, username: user?.username ?? 'nexo_fan', server: guild.name, memberCount: guild.memberCount.toLocaleString('de-DE'),
  }), [name, user?.username, guild.name, guild.memberCount]);
  const avatarUrl = user?.avatarUrl.replace('size=128', 'size=256') ?? null;
  const assets = useCardAssets(value, avatarUrl);
  const selected = value.layers.find((layer) => layer.id === selectedId) ?? null;

  useEffect(() => { loadCardFonts().then(() => setFontsReady(true)); }, []);
  useEffect(() => () => { if (serverPreview) URL.revokeObjectURL(serverPreview); }, [serverPreview]);

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    renderCard(ctx, value, assets, vars);
    if (selected) drawSelection(ctx, layerBox(ctx, selected, vars), resizable(selected));
  }, [value, assets, vars, selected, fontsReady]);

  const setLayers = (layers: CardLayer[]) => onChange({ ...value, layers });
  const updateLayer = (layer: CardLayer) => setLayers(value.layers.map((entry) => (entry.id === layer.id ? layer : entry)));
  const select = (id: string | null) => { setSelectedId(id); if (id) setPanel('layer'); };

  const removeLayer = (id: string) => { setLayers(value.layers.filter((layer) => layer.id !== id)); if (id === selectedId) setSelectedId(null); };
  const moveLayer = (id: string, step: 1 | -1) => {
    const index = value.layers.findIndex((layer) => layer.id === id);
    const target = index + step;
    if (index < 0 || target < 0 || target >= value.layers.length) return;
    const layers = [...value.layers];
    [layers[index], layers[target]] = [layers[target], layers[index]];
    setLayers(layers);
  };
  const addLayer = (layer: CardLayer) => {
    if (value.layers.length >= CARD_MAX_LAYERS) return;
    setLayers([...value.layers, layer]);
    select(layer.id);
  };
  const duplicate = (layer: CardLayer) => addLayer(moved({ ...layer, id: newId() }, 20, 20));

  const applyTemplate = () => {
    const chosen = CARD_TEMPLATES.find((entry) => entry.id === template);
    if (!chosen) return;
    const apply = () => { onChange({ ...value, background: structuredClone(chosen.background), layers: structuredClone(chosen.layers) }); setSelectedId(null); };
    if (value.layers.length === 0) apply();
    else confirm({ title: 'Vorlage anwenden?', text: `„${chosen.label}“ ersetzt den Hintergrund und alle ${value.layers.length} Ebenen deiner Karte.`, confirmLabel: 'Vorlage anwenden', danger: false, onConfirm: apply });
  };

  // ----- Pointer & keyboard -----

  const point = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) * CARD_WIDTH) / rect.width, y: ((event.clientY - rect.top) * CARD_HEIGHT) / rect.height };
  };

  const hitTest = (ctx: Ctx, x: number, y: number): { layer: CardLayer; mode: 'move' | 'resize' } | null => {
    if (selected && resizable(selected) && inBox(handleBox(layerBox(ctx, selected, vars)), x, y)) return { layer: selected, mode: 'resize' };
    const layer = [...value.layers].reverse().find((entry) => inBox(layerBox(ctx, entry, vars), x, y));
    return layer ? { layer, mode: 'move' } : null;
  };

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    const ctx = event.currentTarget.getContext('2d');
    if (!ctx) return;
    const { x, y } = point(event);
    const hit = hitTest(ctx, x, y);
    select(hit?.layer.id ?? null);
    if (!hit) { setPanel('background'); return; }
    drag.current = { mode: hit.mode, id: hit.layer.id, startX: x, startY: y, origin: hit.layer };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = point(event);
    const current = drag.current;
    if (!current) {
      const ctx = event.currentTarget.getContext('2d');
      setHover(ctx ? hitTest(ctx, x, y)?.mode ?? null : null);
      return;
    }
    const dx = x - current.startX;
    const dy = y - current.startY;
    updateLayer(current.mode === 'move' ? moved(current.origin, dx, dy) : resized(current.origin, dx, dy, x, y));
  };

  const onPointerUp = () => { drag.current = null; };

  const onKeyDown = (event: KeyboardEvent<HTMLCanvasElement>) => {
    if (!selected) return;
    const step = event.shiftKey ? 10 : 1;
    const delta: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (delta[event.key]) {
      event.preventDefault();
      updateLayer(moved(selected, ...delta[event.key]));
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      removeLayer(selected.id);
    } else if (event.key === 'Escape') {
      select(null);
    }
  };

  // ----- Server actions -----

  const loadServerPreview = async () => {
    setPreviewBusy(true);
    try {
      const response = await fetch(`/dashboard/api/guilds/${guild.id}/welcome/card/preview`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'x-nexo-dashboard': '1' },
        body: JSON.stringify(value),
      });
      if (!response.ok) {
        const data: unknown = await response.json().catch(() => null);
        const message = data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error : `Vorschau fehlgeschlagen (${response.status})`;
        toast(message, true);
        return;
      }
      setServerPreview(URL.createObjectURL(await response.blob()));
    } catch {
      toast('Die Server-Vorschau konnte nicht geladen werden.', true);
    } finally {
      setPreviewBusy(false);
    }
  };

  const testPath = `/guilds/${guild.id}/welcome/actions/test`;
  const isWelcome = kind === 'welcome';
  const cursor = hover === 'resize' ? 'cursor-nwse-resize' : hover === 'move' ? 'cursor-move' : 'cursor-default';
  const listed = [...value.layers].reverse();

  return (
    <>
      <Card
        icon="welcome"
        title={isWelcome ? 'Willkommenskarte' : 'Abschiedskarte'}
        description="Ein persönliches Bild für jedes Mitglied, angehängt ans Embed."
        disabled={!value.enabled}
        right={(
          <div className="row">
            <Badge on={value.enabled}>{value.enabled ? 'Aktiv' : 'Aus'}</Badge>
            <Switch checked={value.enabled} label="Karte aktiv" onChange={(enabled) => onChange({ ...value, enabled })} />
          </div>
        )}
      >
        <div className="stack">
          <canvas
            ref={canvas}
            width={CARD_WIDTH}
            height={CARD_HEIGHT}
            tabIndex={0}
            aria-label="Kartenvorschau. Klicke eine Ebene an, zieh sie mit der Maus oder verschieb sie mit den Pfeiltasten."
            className={`block h-auto w-full touch-none rounded-xl border border-[color:var(--border)] outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand)] ${cursor}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onPointerLeave={() => setHover(null)}
            onKeyDown={onKeyDown}
          />
          <p className="faint">
            Klick wählt eine Ebene, Ziehen verschiebt sie, das Quadrat unten rechts ändert die Größe. Pfeiltasten verschieben um 1 px (mit Shift 10 px), Entf löscht.
          </p>

          <div className="row items-end">
            <div className="min-w-[180px] flex-1">
              <Field label="Vorlage">
                <Select value={template} options={CARD_TEMPLATES.map((entry) => ({ value: entry.id, label: entry.label }))} onChange={setTemplate} />
              </Field>
            </div>
            <button type="button" className="btn btn-secondary" onClick={applyTemplate}>Vorlage anwenden</button>
          </div>

          <div className="grid-2">
            <div className="stack gap-3">
              <span className="field-label">Ebenen ({value.layers.length}/{CARD_MAX_LAYERS})</span>
              <div className="chips">
                {ADDABLE.map((type) => (
                  <button key={type} type="button" className="btn btn-secondary btn-sm" disabled={value.layers.length >= CARD_MAX_LAYERS}
                    onClick={() => addLayer(newLayer(type, guild.iconUrl ?? avatarUrl ?? 'https://cdn.discordapp.com/embed/avatars/0.png'))}>
                    + {CARD_LAYER_LABELS[type]}
                  </button>
                ))}
              </div>
              <div className="list">
                {listed.length === 0 && <p className="faint">Noch keine Ebenen. Füg oben welche hinzu oder wähl eine Vorlage.</p>}
                {listed.map((layer, index) => (
                  <div key={layer.id} className={`list-item cursor-pointer py-2 ${layer.id === selectedId ? 'border-[color:var(--brand)]' : ''}`}
                    onClick={() => select(layer.id)}>
                    <div className="grow">
                      <div className="title">{layerTitle(layer, vars)}</div>
                      <div className="faint">{CARD_LAYER_LABELS[layer.type]}</div>
                    </div>
                    <div className="flex gap-1" onClick={(event) => event.stopPropagation()}>
                      <button type="button" className="btn btn-ghost btn-sm" title="Nach vorne" aria-label="Nach vorne" disabled={index === 0} onClick={() => moveLayer(layer.id, 1)}>↑</button>
                      <button type="button" className="btn btn-ghost btn-sm" title="Nach hinten" aria-label="Nach hinten" disabled={index === listed.length - 1} onClick={() => moveLayer(layer.id, -1)}>↓</button>
                      <button type="button" className="btn btn-ghost btn-sm" title="Duplizieren" aria-label="Duplizieren" disabled={value.layers.length >= CARD_MAX_LAYERS} onClick={() => duplicate(layer)}>⧉</button>
                      <button type="button" className="btn btn-ghost btn-sm" title="Löschen" aria-label="Löschen" onClick={() => removeLayer(layer.id)}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="stack gap-3">
              <Tabs value={panel} onChange={setPanel} items={[{ id: 'layer', label: 'Ebene' }, { id: 'background', label: 'Hintergrund' }]} />
              {panel === 'background'
                ? <BackgroundFields value={value.background} onChange={(background) => onChange({ ...value, background })} />
                : selected
                  ? <LayerFields layer={selected} onChange={updateLayer} />
                  : <p className="faint">Wähl eine Ebene in der Vorschau oder in der Liste aus.</p>}
            </div>
          </div>

          <Actions align="between">
            <span className="faint">„Test senden“ nutzt die gespeicherten Einstellungen.</span>
            <div className="row gap-2">
              <button type="button" className="btn btn-secondary" disabled={previewBusy} onClick={loadServerPreview}>
                {previewBusy ? 'Lädt …' : 'Server-Vorschau laden'}
              </button>
              <button type="button" className="btn btn-secondary" disabled={busy === testPath}
                onClick={() => run(testPath, { kind }, isWelcome ? 'Willkommensnachricht gesendet.' : 'Abschiedsnachricht gesendet.')}>
                Test senden
              </button>
            </div>
          </Actions>
        </div>
      </Card>
      {/* Outside the card: a disabled card fades and blocks its content. */}
      {serverPreview && (
        <Modal title="Server-Vorschau" onClose={() => setServerPreview(null)}
          footer={<button type="button" className="btn btn-secondary" onClick={() => setServerPreview(null)}>Schließen</button>}>
          <p className="muted mb-3">So rendert Nexo deine Karte für dich – mit dem aktuellen (ungespeicherten) Entwurf.</p>
          <img className="block w-full rounded-lg" src={serverPreview} alt="Server-Vorschau der Karte" />
        </Modal>
      )}
      {dialog}
    </>
  );
}
