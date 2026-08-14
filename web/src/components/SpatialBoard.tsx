"use client";

import { Line, OrbitControls, RoundedBox } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import { CanvasTexture, DoubleSide, LinearFilter } from "three";

import type { Placement } from "@/lib/types";

type Tone = "existing" | "optimal" | "model";
type Axis = "x" | "y" | "z";

const GAP = 1.08;
const COLORS = {
  existing: "#dce5e2",
  optimal: "#62d0a3",
  model: "#ff795b",
};

function worldPosition({ x, y, z }: Placement, boardSize: number): [number, number, number] {
  const center = (boardSize - 1) / 2;
  return [(x - center) * GAP, (z - center) * GAP, (y - center) * GAP];
}

function tileKey({ x, y, z }: Placement) {
  return `${x}-${y}-${z}`;
}

function connectedWordKeys(tiles: Placement[], origin: Placement | null) {
  if (!origin) return new Set<string>();
  const occupied = new Map(tiles.map((tile) => [tileKey(tile), tile]));
  const connected = new Set<string>([tileKey(origin)]);
  const axes: Array<keyof Pick<Placement, "x" | "y" | "z">> = ["x", "y", "z"];
  for (const axis of axes) {
    const line = [origin];
    for (const direction of [-1, 1]) {
      for (let offset = 1; ; offset += 1) {
        const candidate = { ...origin, [axis]: origin[axis] + direction * offset };
        const tile = occupied.get(tileKey(candidate));
        if (!tile) break;
        line.push(tile);
      }
    }
    if (line.length > 1) line.forEach((tile) => connected.add(tileKey(tile)));
  }
  return connected;
}

function premium(x: number, y: number, z: number, boardSize: number) {
  const center = Math.floor(boardSize / 2);
  const inner = Math.floor(boardSize / 4);
  const farInner = boardSize - 1 - inner;
  if (x === center && y === center && z === center) return { label: "DW", color: "#ff795b" };
  if ([x, y, z].every((value) => value === 0 || value === boardSize - 1)) return { label: "TW", color: "#ef6a4b" };
  if ([x, y, z].every((value) => value === inner || value === farInner)) return { label: "DW", color: "#ff795b" };
  const centered = [x, y, z].filter((value) => value === center).length;
  if (centered === 2 && [x, y, z].some((value) => value === 0 || value === boardSize - 1)) return { label: "TL", color: "#62d0a3" };
  if (centered === 2 && [x, y, z].some((value) => value === inner || value === farInner)) return { label: "DL", color: "#78b8d8" };
  return null;
}

function LabelSprite({ text, color, size = 0.54, position = [0, 0, 0.46] }: { text: string; color: string; size?: number; position?: [number, number, number] }) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 128;
    const context = canvas.getContext("2d");
    if (context) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = color;
      context.font = "900 82px Arial";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(text, 128, 66);
    }
    const map = new CanvasTexture(canvas);
    map.minFilter = LinearFilter;
    return map;
  }, [color, text]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <sprite position={position} scale={[size * 1.65, size * 0.82, 1]}><spriteMaterial map={texture} transparent depthTest={false} /></sprite>;
}

function LetterFaces({ text }: { text: string }) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext("2d");
    if (context) {
      context.clearRect(0, 0, 128, 128);
      context.fillStyle = "#07110f";
      context.font = "900 76px Arial";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(text, 64, 67);
    }
    const map = new CanvasTexture(canvas);
    map.minFilter = LinearFilter;
    return map;
  }, [text]);
  useEffect(() => () => texture.dispose(), [texture]);

  const faces: Array<{ position: [number, number, number]; rotation: [number, number, number] }> = [
    { position: [0, 0, 0.416], rotation: [0, 0, 0] },
    { position: [0, 0, -0.416], rotation: [0, Math.PI, 0] },
    { position: [0.416, 0, 0], rotation: [0, Math.PI / 2, 0] },
    { position: [-0.416, 0, 0], rotation: [0, -Math.PI / 2, 0] },
    { position: [0, 0.416, 0], rotation: [-Math.PI / 2, 0, 0] },
    { position: [0, -0.416, 0], rotation: [Math.PI / 2, 0, 0] },
  ];
  return faces.map((face, index) => (
    <mesh key={index} position={face.position} rotation={face.rotation}>
      <planeGeometry args={[0.52, 0.52]} />
      <meshBasicMaterial map={texture} transparent side={DoubleSide} depthWrite={false} polygonOffset polygonOffsetFactor={-2} />
    </mesh>
  ));
}

function Tile({ placement, tone, boardSize, wordActive, wordDimmed, onSelect, onHover }: { placement: Placement; tone: Tone; boardSize: number; wordActive: boolean; wordDimmed: boolean; onSelect: (placement: Placement, tone: Tone) => void; onHover: (placement: Placement | null) => void }) {
  const [hovered, setHovered] = useState(false);
  const color = COLORS[tone];
  return (
    <group position={worldPosition(placement, boardSize)} scale={hovered ? 1.16 : wordActive ? 1.08 : 1}>
      <RoundedBox
        args={[0.82, 0.82, 0.82]}
        radius={0.1}
        smoothness={3}
        onClick={(event) => { event.stopPropagation(); onSelect(placement, tone); }}
        onPointerOver={(event) => { event.stopPropagation(); setHovered(true); onHover(placement); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { setHovered(false); onHover(null); document.body.style.cursor = "default"; }}
      >
        <meshStandardMaterial transparent opacity={wordDimmed ? 0.24 : 1} color={color} roughness={0.42} metalness={tone === "existing" ? 0.15 : 0.05} emissive={wordActive ? "#62d0a3" : tone === "existing" ? "#10201e" : color} emissiveIntensity={wordActive ? 0.72 : tone === "existing" ? 0.08 : 0.25} />
      </RoundedBox>
      <LetterFaces text={placement.letter} />
    </group>
  );
}

function Lattice({ boardSize, axis, layer, showPremiums, lightMode }: { boardSize: number; axis: Axis; layer: number | "all"; showPremiums: boolean; lightMode: boolean }) {
  const center = (boardSize - 1) / 2;
  const boundary = (boardSize / 2) * GAP;
  const edges = useMemo(() => {
    const corners = [-boundary, boundary];
    const lines: [number, number, number][][] = [];
    for (const a of corners) for (const b of corners) {
      lines.push([[-boundary, a, b], [boundary, a, b]]);
      lines.push([[a, -boundary, b], [a, boundary, b]]);
      lines.push([[a, b, -boundary], [a, b, boundary]]);
    }
    return lines;
  }, [boundary]);

  const premiumNodes = useMemo(() => {
    const nodes = [];
    for (let x = 0; x < boardSize; x += 1) for (let y = 0; y < boardSize; y += 1) for (let z = 0; z < boardSize; z += 1) {
      const value = premium(x, y, z, boardSize);
      if (value) nodes.push({ placement: { x, y, z, letter: value.label }, ...value });
    }
    return nodes;
  }, [boardSize]);
  const slicePosition: [number, number, number] = layer === "all" ? [0, 0, 0]
    : axis === "x" ? [(layer - center) * GAP, 0, 0]
    : axis === "y" ? [0, 0, (layer - center) * GAP]
    : [0, (layer - center) * GAP, 0];
  const sliceRotation: [number, number, number] = axis === "x" ? [0, 0, Math.PI / 2]
    : axis === "y" ? [Math.PI / 2, 0, 0]
    : [0, 0, 0];

  return (
    <group>
      {edges.map((points, index) => <Line key={index} points={points} color={lightMode ? "#637874" : "#405159"} lineWidth={0.9} transparent opacity={0.72} />)}
      {layer !== "all" ? (
        <gridHelper position={slicePosition} rotation={sliceRotation} args={[boardSize * GAP, boardSize, "#62d0a3", lightMode ? "#8fa3a0" : "#344249"]} />
      ) : null}
      {showPremiums ? premiumNodes.map(({ placement, color, label }) => (
        <group key={`${placement.x}-${placement.y}-${placement.z}`} position={worldPosition(placement, boardSize)} visible={layer === "all" || placement[axis] === layer}>
          <mesh>
            <sphereGeometry args={[0.09, 12, 12]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.4} />
          </mesh>
          <LabelSprite text={label} color={color} size={0.18} position={[0, 0.23, 0]} />
        </group>
      )) : null}
    </group>
  );
}

function Scene({ boardSize, board, highlight, highlightTone, axis, layer, showPremiums, lightMode, onSelect }: {
  boardSize: number;
  board: Placement[];
  highlight: Placement[];
  highlightTone: Tone;
  axis: Axis;
  layer: number | "all";
  showPremiums: boolean;
  lightMode: boolean;
  onSelect: (placement: Placement, tone: Tone) => void;
}) {
  const [hoveredTile, setHoveredTile] = useState<Placement | null>(null);
  const highlightKeys = new Set(highlight.map((tile) => `${tile.x}-${tile.y}-${tile.z}`));
  const wordKeys = connectedWordKeys([...board, ...highlight], hoveredTile);
  const hasHoveredWord = wordKeys.size > 1;
  return (
    <>
      <color attach="background" args={[lightMode ? "#edf2ef" : "#11191d"]} />
      <fog attach="fog" args={[lightMode ? "#edf2ef" : "#11191d", boardSize * 1.8, boardSize * 3.3]} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[6, 10, 8]} intensity={2.2} color="#f1f8f5" />
      <pointLight position={[-6, -3, -4]} intensity={25} distance={15} color="#62d0a3" />
      <pointLight position={[5, 2, 5]} intensity={16} distance={12} color="#ff795b" />
      <Lattice boardSize={boardSize} axis={axis} layer={layer} showPremiums={showPremiums} lightMode={lightMode} />
      {board.filter((tile) => !highlightKeys.has(`${tile.x}-${tile.y}-${tile.z}`) && (layer === "all" || tile[axis] === layer)).map((tile) => (
        <Tile key={`b-${tile.x}-${tile.y}-${tile.z}`} placement={tile} tone="existing" boardSize={boardSize} wordActive={hasHoveredWord && wordKeys.has(tileKey(tile))} wordDimmed={hasHoveredWord && !wordKeys.has(tileKey(tile))} onSelect={onSelect} onHover={setHoveredTile} />
      ))}
      {highlight.filter((tile) => layer === "all" || tile[axis] === layer).map((tile) => (
        <Tile key={`h-${tile.x}-${tile.y}-${tile.z}`} placement={tile} tone={highlightTone} boardSize={boardSize} wordActive={hasHoveredWord && wordKeys.has(tileKey(tile))} wordDimmed={hasHoveredWord && !wordKeys.has(tileKey(tile))} onSelect={onSelect} onHover={setHoveredTile} />
      ))}
      <OrbitControls makeDefault enablePan={false} minDistance={boardSize * 0.8} maxDistance={boardSize * 2.8} autoRotate autoRotateSpeed={0.35} />
    </>
  );
}

function StaticBoardPreview({ boardSize, board, highlight, axis, layer }: { boardSize: number; board: Placement[]; highlight: Placement[]; axis: Axis; layer: number | "all" }) {
  const [hoveredTile, setHoveredTile] = useState<Placement | null>(null);
  const highlightKeys = new Set(highlight.map((tile) => `${tile.x}-${tile.y}-${tile.z}`));
  const visible = [...board, ...highlight].filter((tile, index, all) => (
    (layer === "all" || tile[axis] === layer)
    && all.findIndex((candidate) => `${candidate.x}-${candidate.y}-${candidate.z}` === `${tile.x}-${tile.y}-${tile.z}`) === index
  ));
  const wordKeys = connectedWordKeys([...board, ...highlight], hoveredTile);
  const hasHoveredWord = wordKeys.size > 1;
  const last = boardSize - 1;
  const boundaryStart = -0.5;
  const boundaryEnd = last + 0.5;
  const project = (x: number, y: number, z: number) => ({
    x: 50 + (x - y) * (34 / Math.max(last, 1)),
    y: 50 + (x + y - last) * (17 / Math.max(last, 1)) - (z - last / 2) * (34 / Math.max(last, 1)),
  });
  const selectedPlane = layer === "all" ? null
    : axis === "x" ? [project(layer, 0, 0), project(layer, last, 0), project(layer, last, last), project(layer, 0, last)]
    : axis === "y" ? [project(0, layer, 0), project(last, layer, 0), project(last, layer, last), project(0, layer, last)]
    : [project(0, 0, layer), project(last, 0, layer), project(last, last, layer), project(0, last, layer)];
  return (
    <div className="static-board-preview" role="img" aria-label="Static board preview because interactive 3D is unavailable">
      <svg className="static-lattice" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        {selectedPlane ? <polygon className="selected-layer" points={selectedPlane.map((point) => `${point.x},${point.y}`).join(" ")} /> : null}
        <polyline className="lattice-edge" points={[project(boundaryStart, boundaryStart, boundaryStart), project(boundaryEnd, boundaryStart, boundaryStart), project(boundaryEnd, boundaryEnd, boundaryStart), project(boundaryStart, boundaryEnd, boundaryStart), project(boundaryStart, boundaryStart, boundaryStart), project(boundaryStart, boundaryStart, boundaryEnd), project(boundaryEnd, boundaryStart, boundaryEnd), project(boundaryEnd, boundaryStart, boundaryStart)].map((point) => `${point.x},${point.y}`).join(" ")} />
        <polyline className="lattice-edge" points={[project(boundaryStart, boundaryStart, boundaryEnd), project(boundaryStart, boundaryEnd, boundaryEnd), project(boundaryStart, boundaryEnd, boundaryStart), project(boundaryEnd, boundaryEnd, boundaryStart), project(boundaryEnd, boundaryEnd, boundaryEnd), project(boundaryStart, boundaryEnd, boundaryEnd)].map((point) => `${point.x},${point.y}`).join(" ")} />
        <line className="lattice-edge" x1={project(boundaryEnd, boundaryEnd, boundaryEnd).x} y1={project(boundaryEnd, boundaryEnd, boundaryEnd).y} x2={project(boundaryEnd, boundaryStart, boundaryEnd).x} y2={project(boundaryEnd, boundaryStart, boundaryEnd).y} />
      </svg>
      {visible.map((tile) => {
        const highlighted = highlightKeys.has(`${tile.x}-${tile.y}-${tile.z}`);
        const point = project(tile.x, tile.y, tile.z);
        return (
          <span
            className={`${highlighted ? "highlighted" : ""} ${hasHoveredWord && wordKeys.has(tileKey(tile)) ? "word-active" : ""} ${hasHoveredWord && !wordKeys.has(tileKey(tile)) ? "word-dimmed" : ""}`}
            key={`${tile.x}-${tile.y}-${tile.z}`}
            onPointerEnter={() => setHoveredTile(tile)}
            onPointerLeave={() => setHoveredTile(null)}
            style={{
              left: `${point.x}%`,
              top: `${point.y}%`,
              zIndex: tile.z * 20 + tile.x + tile.y,
            }}
          >{tile.letter}</span>
        );
      })}
      <p>15 × 15 × 15 lattice · hover a cube to trace its word</p>
    </div>
  );
}

export function SpatialBoard({ boardSize, board, highlight = [], highlightTone = "optimal", className = "" }: {
  boardSize: number;
  board: Placement[];
  highlight?: Placement[];
  highlightTone?: Tone;
  className?: string;
}) {
  const [layer, setLayer] = useState<number | "all">("all");
  const [axis, setAxis] = useState<Axis>("z");
  const showPremiums = true;
  const [selected, setSelected] = useState<{ placement: Placement; tone: Tone } | null>(null);
  const [webglReady, setWebglReady] = useState(false);
  const [lightMode, setLightMode] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: light)");
    const update = () => setLightMode(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return (
    <div className={`spatial-board ${className}`}>
      <div className="board-toolbar">
        <div className="layer-switch" aria-label="Visible Z layer">
          <button className={layer === "all" ? "active" : ""} onClick={() => setLayer("all")}>ALL</button>
          {Array.from({ length: boardSize }, (_, value) => (
            <button key={value} className={layer === value ? "active" : ""} onClick={() => setLayer(value)}>{axis.toUpperCase()}{value}</button>
          ))}
        </div>
      </div>
      <div className="canvas-wrap">
        <div className={`board-fallback-layer ${webglReady ? "is-ready" : ""}`}>
          <StaticBoardPreview boardSize={boardSize} board={board} highlight={highlight} axis={axis} layer={layer} />
        </div>
        <Canvas dpr={[1, 1.7]} camera={{ position: [boardSize * 1.2, boardSize, boardSize * 1.3], fov: 38, near: 0.1, far: boardSize * 8 }} onCreated={() => requestAnimationFrame(() => setWebglReady(true))}>
          <Scene boardSize={boardSize} board={board} highlight={highlight} highlightTone={highlightTone} axis={axis} layer={layer} showPremiums={showPremiums} lightMode={lightMode} onSelect={(placement, tone) => setSelected({ placement, tone })} />
        </Canvas>
        <div className="axis-key" aria-label="Slice axis">
          {(["x", "y", "z"] as Axis[]).map((value) => <button type="button" key={value} className={axis === value ? "active" : ""} onClick={() => { setAxis(value); setLayer("all"); }}>{value.toUpperCase()}</button>)}
        </div>
        <p className="drag-hint">DRAG TO ORBIT · SCROLL TO ZOOM</p>
      </div>
      <div className="board-readout">
        {selected ? (
          <><span className={`readout-dot ${selected.tone}`} /><b>{selected.placement.letter}</b><code>({selected.placement.x}, {selected.placement.y}, {selected.placement.z})</code><small>{selected.tone.toUpperCase()} TILE</small></>
        ) : (
          <><span className="readout-dot" /><b>LIVE</b><code>SELECT A CUBE</code><small>{layer === "all" ? `${axis.toUpperCase()} AXIS · FULL LATTICE` : `${axis.toUpperCase()}-LAYER ${layer}`}</small></>
        )}
      </div>
    </div>
  );
}
