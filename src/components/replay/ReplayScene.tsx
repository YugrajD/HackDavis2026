import { useMemo } from "react";
import { Canvas, ThreeEvent, useFrame } from "@react-three/fiber";
import { Line, OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";
import type { DangerSegment, HazardEvent, ReplayPayload, TrackedObject } from "../../lib/contracts";
import { eventToMeters, headingToRotationY } from "../../lib/replay/coordinates";
import { interpolateRoutePoint } from "../../lib/replay/interpolate";
import {
  colorForSeverity,
  eventSceneVector,
  getNearestEvent,
  latLngSceneVector,
  metersToSceneVector,
  objectColor,
  type PreparedReplay,
  routePointSceneVector,
} from "../../lib/replay/scene";

// Lateral offsets from bike route centerline (positive = right of heading = south for eastbound)
const ROAD_LEFT = -6.2;      // outer car-lane edge
const CENTER_LINE = -1.7;    // yellow centre line
const BIKE_LANE_RIGHT = 1.9; // white solid right edge of bike lane
const CURB_RIGHT = 2.8;      // raised curb / shoulder start

type ReplaySceneProps = {
  payload: ReplayPayload;
  prepared: PreparedReplay;
  currentTime: number;
  selectedEventId: string;
  onSelectEvent: (eventId: string) => void;
};

export function ReplayScene({
  payload,
  prepared,
  currentTime,
  selectedEventId,
  onSelectEvent,
}: ReplaySceneProps) {
  const span = prepared.longestRouteSpan;
  const camPos: [number, number, number] = [
    -span * 0.12,
    span * 0.26,
    span * 0.40,
  ];

  return (
    <Canvas
      className="scene-canvas"
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: false }}
      camera={{ position: camPos, fov: 50, near: 0.1, far: 1400 }}
    >
      <color attach="background" args={["#090b0e"]} />
      <fog attach="fog" args={["#090b0e", 300, 980]} />

      <hemisphereLight args={["#cce8ff", "#0d1510", 0.85]} />
      <directionalLight
        position={[-80, 160, 80]}
        intensity={3.0}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={520}
        shadow-camera-left={-320}
        shadow-camera-right={320}
        shadow-camera-top={320}
        shadow-camera-bottom={-320}
      />
      <pointLight color="#ffe8bb" intensity={50} distance={220} position={[90, 32, -70]} />

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.07}
        target={[0, 2, 0]}
        maxPolarAngle={Math.PI * 0.44}
        minDistance={30}
        maxDistance={span * 2.0}
      />

      <Terrain prepared={prepared} />
      <Road prepared={prepared} />
      <LaneMarkings prepared={prepared} />

      {payload.dangerSegments.map((seg) => (
        <DangerZone key={seg.id} segment={seg} prepared={prepared} />
      ))}
      {payload.events.map((event) => (
        <HazardMarker
          key={event.id}
          event={event}
          prepared={prepared}
          currentTime={currentTime}
          selected={event.id === selectedEventId}
          onSelectEvent={onSelectEvent}
        />
      ))}
      {payload.events.flatMap((event) =>
        event.objects.map((object) => (
          <GhostObject
            key={`${event.id}-${object.id}`}
            event={event}
            object={object}
            prepared={prepared}
            currentTime={currentTime}
          />
        ))
      )}

      <BikeActor payload={payload} prepared={prepared} currentTime={currentTime} />
      <CarActor payload={payload} prepared={prepared} currentTime={currentTime} />
    </Canvas>
  );
}

// ─── Road geometry helpers ────────────────────────────────────────────────────

function rightPerp(tangent: THREE.Vector3): THREE.Vector3 {
  // forward × up in XZ plane (positive = right of heading)
  return new THREE.Vector3(-tangent.z, 0, tangent.x);
}

function curveTangents(curve: THREE.CatmullRomCurve3, N: number): THREE.Vector3[] {
  const tans: THREE.Vector3[] = [];
  for (let i = 0; i <= N; i++) {
    tans.push(curve.getTangent(i / N));
  }
  return tans;
}

function buildRibbon(
  curve: THREE.CatmullRomCurve3,
  N: number,
  leftOff: number,
  rightOff: number,
  y = 0.01
): THREE.BufferGeometry {
  const pts = curve.getPoints(N);
  const tans = curveTangents(curve, N);
  const verts: number[] = [];
  const idxs: number[] = [];
  const uvs: number[] = [];

  for (let i = 0; i <= N; i++) {
    const rp = rightPerp(tans[i].clone().setY(0).normalize());
    const l = pts[i].clone().addScaledVector(rp, leftOff).setY(y);
    const r = pts[i].clone().addScaledVector(rp, rightOff).setY(y);
    verts.push(l.x, l.y, l.z, r.x, r.y, r.z);
    uvs.push(0, i / N, 1, i / N);
    if (i < N) {
      const b = i * 2;
      idxs.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(verts), 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(uvs), 2));
  geo.setIndex(idxs);
  geo.computeVertexNormals();
  return geo;
}

function buildOffsetLine(
  curve: THREE.CatmullRomCurve3,
  N: number,
  lateralOff: number,
  y = 0.05
): THREE.Vector3[] {
  const pts = curve.getPoints(N);
  const tans = curveTangents(curve, N);
  return pts.map((pt, i) => {
    const rp = rightPerp(tans[i].clone().setY(0).normalize());
    return pt.clone().addScaledVector(rp, lateralOff).setY(y);
  });
}

function buildDashedLine(
  curve: THREE.CatmullRomCurve3,
  N: number,
  lateralOff: number,
  dashM: number,
  gapM: number,
  y = 0.06
): THREE.Vector3[][] {
  const totalLen = curve.getLength();
  const pts = curve.getPoints(N);
  const tans = curveTangents(curve, N);
  const cycle = dashM + gapM;
  const groups: THREE.Vector3[][] = [];
  let cur: THREE.Vector3[] = [];
  let prevDash = true;

  for (let i = 0; i <= N; i++) {
    const dist = (i / N) * totalLen;
    const isDash = dist % cycle < dashM;
    if (isDash !== prevDash) {
      if (cur.length >= 2) groups.push(cur);
      cur = [];
    }
    if (isDash) {
      const rp = rightPerp(tans[i].clone().setY(0).normalize());
      cur.push(pts[i].clone().addScaledVector(rp, lateralOff).setY(y));
    }
    prevDash = isDash;
  }
  if (cur.length >= 2) groups.push(cur);
  return groups;
}

// ─── Scene components ─────────────────────────────────────────────────────────

function Terrain({ prepared }: { prepared: PreparedReplay }) {
  const w = prepared.routeWidth + 400;
  const d = prepared.routeDepth + 400;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[w, d]} />
      <meshStandardMaterial color="#0d110c" roughness={0.95} />
    </mesh>
  );
}

function Road({ prepared }: { prepared: PreparedReplay }) {
  const curve = useMemo(
    () => new THREE.CatmullRomCurve3(prepared.routeScenePoints),
    [prepared.routeScenePoints]
  );

  const N = 220;
  const roadGeo = useMemo(() => buildRibbon(curve, N, ROAD_LEFT, CURB_RIGHT, 0.004), [curve]);
  const bikeLaneGeo = useMemo(() => buildRibbon(curve, N, CENTER_LINE, BIKE_LANE_RIGHT, 0.018), [curve]);
  const curbLGeo = useMemo(() => buildRibbon(curve, N, ROAD_LEFT - 0.55, ROAD_LEFT, 0.07), [curve]);
  const curbRGeo = useMemo(() => buildRibbon(curve, N, BIKE_LANE_RIGHT, CURB_RIGHT + 0.55, 0.07), [curve]);
  const sidewalkLGeo = useMemo(() => buildRibbon(curve, N, ROAD_LEFT - 3.0, ROAD_LEFT - 0.55, 0.02), [curve]);
  const sidewalkRGeo = useMemo(() => buildRibbon(curve, N, CURB_RIGHT + 0.55, CURB_RIGHT + 3.2, 0.02), [curve]);

  return (
    <>
      {/* Asphalt */}
      <mesh geometry={roadGeo} receiveShadow>
        <meshStandardMaterial color="#1b1e21" roughness={0.88} metalness={0.04} />
      </mesh>
      {/* Bike lane tint */}
      <mesh geometry={bikeLaneGeo} renderOrder={1}>
        <meshBasicMaterial color="#162518" transparent opacity={0.7} depthWrite={false} />
      </mesh>
      {/* Curbs */}
      <mesh geometry={curbLGeo}>
        <meshStandardMaterial color="#323838" roughness={0.72} />
      </mesh>
      <mesh geometry={curbRGeo}>
        <meshStandardMaterial color="#323838" roughness={0.72} />
      </mesh>
      {/* Sidewalks */}
      <mesh geometry={sidewalkLGeo}>
        <meshStandardMaterial color="#252a27" roughness={0.85} />
      </mesh>
      <mesh geometry={sidewalkRGeo}>
        <meshStandardMaterial color="#252a27" roughness={0.85} />
      </mesh>
    </>
  );
}

function LaneMarkings({ prepared }: { prepared: PreparedReplay }) {
  const curve = useMemo(
    () => new THREE.CatmullRomCurve3(prepared.routeScenePoints),
    [prepared.routeScenePoints]
  );
  const N = 220;

  const leftEdge = useMemo(() => buildOffsetLine(curve, N, ROAD_LEFT, 0.05), [curve]);
  const rightEdge = useMemo(() => buildOffsetLine(curve, N, CURB_RIGHT, 0.05), [curve]);
  const bikeLaneEdge = useMemo(() => buildOffsetLine(curve, N, BIKE_LANE_RIGHT, 0.06), [curve]);
  const centerDashes = useMemo(() => buildDashedLine(curve, N, CENTER_LINE, 5, 4, 0.07), [curve]);

  return (
    <>
      <Line points={leftEdge} color="#666666" lineWidth={1.2} />
      <Line points={rightEdge} color="#666666" lineWidth={1.2} />
      <Line points={bikeLaneEdge} color="#dddddd" lineWidth={2.2} />
      {centerDashes.map((dash, i) => (
        <Line key={i} points={dash} color="#ccaa00" lineWidth={2.0} />
      ))}
    </>
  );
}

function DangerZone({ segment, prepared }: { segment: DangerSegment; prepared: PreparedReplay }) {
  const pos = latLngSceneVector(segment.centerLat, segment.centerLng, prepared, 0.03);
  const r = 8 + segment.eventCount * 1.5;
  const col = colorForSeverity(segment.score);
  return (
    <group position={pos}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[r, 64]} />
        <meshBasicMaterial color={col} transparent opacity={0.11} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[r, r + 0.6, 64]} />
        <meshBasicMaterial color={col} transparent opacity={0.28} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

function HazardMarker({
  event, prepared, currentTime, selected, onSelectEvent,
}: {
  event: HazardEvent; prepared: PreparedReplay; currentTime: number;
  selected: boolean; onSelectEvent: (id: string) => void;
}) {
  const rootRef = { current: null as THREE.Group | null };
  const ringRef = { current: null as THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial> | null };
  const coreRef = { current: null as THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial> | null };
  const pos = eventSceneVector(event, prepared);
  const col = colorForSeverity(event.severity);

  useFrame(({ clock }) => {
    const dist = Math.abs(currentTime - event.t);
    const temporal = Math.max(0, 1 - dist / 8);
    const selFocus = selected ? 1 : 0;
    const pulse = Math.sin(clock.elapsedTime * 6.2 + event.t) * 0.12 + 1;
    const scale = 1 + temporal * 0.7 * pulse + selFocus * 0.22;
    if (ringRef.current) {
      ringRef.current.scale.setScalar(scale);
      ringRef.current.material.opacity = 0.18 + temporal * 0.44 + selFocus * 0.16;
    }
    if (coreRef.current) {
      coreRef.current.material.emissiveIntensity =
        (event.severity >= 85 ? 1.4 : 0.78) + temporal * 1.55 + selFocus * 0.5;
    }
  });

  return (
    <group
      ref={(n) => { rootRef.current = n; }}
      position={pos}
      onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelectEvent(event.id); }}
    >
      <mesh
        ref={(n) => { ringRef.current = n as typeof ringRef.current; }}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.08, 0]}
      >
        <ringGeometry args={[2.2, 2.75, 64]} />
        <meshBasicMaterial color={col} transparent opacity={0.42} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[0, 1.6, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 3.2, 10]} />
        <meshBasicMaterial color={col} transparent opacity={0.7} />
      </mesh>
      <mesh
        ref={(n) => { coreRef.current = n as typeof coreRef.current; }}
        position={[0, 3.35, 0]}
        castShadow
      >
        <sphereGeometry args={[event.severity >= 85 ? 0.86 : 0.66, 24, 16]} />
        <meshStandardMaterial
          color={col}
          emissive={col}
          emissiveIntensity={event.severity >= 85 ? 1.8 : 1.15}
          roughness={0.35}
          metalness={0.18}
        />
      </mesh>
      <Text
        position={[0, 5.2, 0]}
        fontSize={0.88}
        color="#f6fbff"
        anchorX="center"
        anchorY="middle"
        outlineColor="#05080c"
        outlineWidth={0.08}
      >
        {event.type.replaceAll("_", " ")} · {event.severity}
      </Text>
    </group>
  );
}

function GhostObject({
  event, object, prepared, currentTime,
}: {
  event: HazardEvent; object: TrackedObject;
  prepared: PreparedReplay; currentTime: number;
}) {
  const em = eventToMeters(event, prepared.origin);
  const off = object.position ?? { x: 0, y: 0, z: 0 };
  const vel = object.velocity ?? { x: 0, y: 0, z: 0 };
  const pos = metersToSceneVector({ x: em.x + off.x, z: em.z + off.z }, prepared.worldCenter, off.y);
  const rotY = object.velocity ? Math.atan2(vel.x, vel.z) : headingToRotationY(event.headingDeg);
  const focus = Math.max(0.18, 1 - Math.abs(currentTime - event.t) / 12);
  const col = objectColor(object.type, event.severity);
  const trajEnd = metersToSceneVector(
    { x: em.x + off.x + vel.x * 3, z: em.z + off.z + vel.z * 3 },
    prepared.worldCenter,
    0.18
  );
  const trajStart = pos.clone().setY(0.18);

  return (
    <>
      <Line points={[trajStart, trajEnd]} color={col} lineWidth={2} transparent opacity={Math.min(0.9, focus + 0.18)} />
      <group position={pos} rotation={[0, rotY, 0]}>
        <GhostShape object={object} color={col} opacity={focus} />
        <Text position={[0, 2.8, 0]} fontSize={0.72} color="#f7fbff" anchorX="center" anchorY="middle" outlineColor="#05080c" outlineWidth={0.08}>
          {object.type}
        </Text>
      </group>
    </>
  );
}

function GhostShape({ object, color, opacity }: { object: TrackedObject; color: string; opacity: number }) {
  if (object.type === "car" || object.type === "truck" || object.type === "bus") {
    const size: [number, number, number] = object.type === "car" ? [2.1, 1.25, 4.2] : [2.5, 1.7, 5.6];
    return (
      <>
        <mesh position={[0, size[1] / 2, 0]} castShadow>
          <boxGeometry args={size} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} roughness={0.5} transparent opacity={opacity} />
        </mesh>
        <mesh position={[0, size[1] + 0.04, size[2] * 0.06]}>
          <boxGeometry args={[size[0] * 0.74, 0.04, size[2] * 0.32]} />
          <meshBasicMaterial color="#d9fbff" transparent opacity={0.38 * opacity} />
        </mesh>
      </>
    );
  }
  if (object.type === "pedestrian") {
    return (
      <>
        <mesh position={[0, 0.88, 0]}>
          <cylinderGeometry args={[0.24, 0.3, 1.35, 16]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} transparent opacity={opacity} />
        </mesh>
        <mesh position={[0, 1.72, 0]}>
          <sphereGeometry args={[0.26, 18, 14]} />
          <meshStandardMaterial color="#f7efe1" roughness={0.45} transparent opacity={opacity} />
        </mesh>
      </>
    );
  }
  if (object.type === "cone") {
    return (
      <mesh position={[0, 0.45, 0]}>
        <coneGeometry args={[0.34, 0.9, 20]} />
        <meshStandardMaterial color="#ff9b2f" emissive="#ff9b2f" emissiveIntensity={0.4} transparent opacity={opacity} />
      </mesh>
    );
  }
  return (
    <mesh position={[0, 0.14, 0]} scale={[1, 1, 0.62]}>
      <cylinderGeometry args={[0.64, 0.78, 0.28, 24]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.28} roughness={0.72} transparent opacity={opacity} />
    </mesh>
  );
}

function BikeActor({ payload, prepared, currentTime }: { payload: ReplayPayload; prepared: PreparedReplay; currentTime: number }) {
  const point = interpolateRoutePoint(payload.ride.route, currentTime);
  const pos = routePointSceneVector(point, prepared, 0.12);
  const rotY = headingToRotationY(point.headingDeg);
  const nearest = getNearestEvent(payload.events, currentTime);
  const active = nearest && Math.abs(nearest.t - currentTime) <= 5;
  const coneCol = active ? colorForSeverity(nearest.severity) : "#21d4ff";

  return (
    <group position={pos} rotation={[0, rotY, 0]}>
      <BikeBody />
      <RiskCone rear={nearest?.camera === "rear"} color={coneCol} active={Boolean(active)} />
    </group>
  );
}

function BikeBody() {
  const frameLines = useMemo(
    () => [
      new THREE.Vector3(0, 0.48, -0.96),
      new THREE.Vector3(0, 1.04, -0.12),
      new THREE.Vector3(0, 0.5, 0.96),
      new THREE.Vector3(0, 0.48, -0.96),
      new THREE.Vector3(0, 1.04, -0.12),
      new THREE.Vector3(0, 1.28, 0.48),
    ],
    []
  );
  return (
    <>
      {/* Rear wheel */}
      <mesh rotation={[0, Math.PI / 2, 0]} position={[0, 0.45, -0.96]} castShadow>
        <torusGeometry args={[0.42, 0.046, 12, 36]} />
        <meshStandardMaterial color="#eefcff" emissive="#b8f7ff" emissiveIntensity={0.25} roughness={0.42} />
      </mesh>
      {/* Front wheel */}
      <mesh rotation={[0, Math.PI / 2, 0]} position={[0, 0.45, 0.96]} castShadow>
        <torusGeometry args={[0.42, 0.046, 12, 36]} />
        <meshStandardMaterial color="#eefcff" emissive="#b8f7ff" emissiveIntensity={0.25} roughness={0.42} />
      </mesh>
      <Line points={frameLines} color="#7af1ff" lineWidth={2} />
      {/* Rider */}
      <mesh position={[0, 1.62, -0.08]} rotation={[-0.3, 0, 0]} castShadow>
        <capsuleGeometry args={[0.22, 0.82, 8, 18]} />
        <meshStandardMaterial color="#7af1ff" emissive="#28cfff" emissiveIntensity={0.7} roughness={0.35} metalness={0.2} />
      </mesh>
      {/* Headlight */}
      <mesh position={[0, 1.18, 0.84]} castShadow>
        <boxGeometry args={[0.16, 0.09, 0.3]} />
        <meshStandardMaterial color="#0c1116" emissive="#25d4ff" emissiveIntensity={0.5} roughness={0.25} />
      </mesh>
    </>
  );
}

function RiskCone({ rear, color, active }: { rear?: boolean; color: string; active: boolean }) {
  const range = 28;
  const hw = 12;
  const fill = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array([0, 0.05, 0, -hw, 0.05, range, hw, 0.05, range]), 3)
    );
    geo.setIndex([0, 1, 2]);
    geo.computeVertexNormals();
    return geo;
  }, []);
  const lines = useMemo(
    () => [
      new THREE.Vector3(0, 0.08, 0),
      new THREE.Vector3(-hw, 0.08, range),
      new THREE.Vector3(0, 0.08, 0),
      new THREE.Vector3(hw, 0.08, range),
      new THREE.Vector3(-hw, 0.08, range),
      new THREE.Vector3(hw, 0.08, range),
    ],
    []
  );
  return (
    <group rotation={[0, rear ? Math.PI : 0, 0]}>
      <mesh geometry={fill} renderOrder={5}>
        <meshBasicMaterial color={color} transparent opacity={active ? 0.22 : 0.12} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <Line points={lines} color={active ? "#fff4d6" : "#8df3ff"} lineWidth={1.5} transparent opacity={active ? 0.88 : 0.68} segments />
    </group>
  );
}

// ─── Car actor ────────────────────────────────────────────────────────────────

function CarActor({ payload, prepared, currentTime }: { payload: ReplayPayload; prepared: PreparedReplay; currentTime: number }) {
  const point = interpolateRoutePoint(payload.ride.route, currentTime);
  const bikePos = routePointSceneVector(point, prepared, 0);

  // Perpendicular right of heading (positive = south = away from car lane)
  const hRad = (point.headingDeg * Math.PI) / 180;
  const fwd = new THREE.Vector3(Math.sin(hRad), 0, -Math.cos(hRad));
  const rp = new THREE.Vector3(-fwd.z, 0, fwd.x);

  // Car lives left of bike (negative = north = car lane).
  // At t=18 (close pass) it narrows from 3.6 m → 1.1 m clearance.
  const closeness = Math.max(0, 1 - Math.abs(currentTime - 18) / 5);
  const lateralOff = -(3.6 - closeness * 2.5);

  const carPos = bikePos.clone().addScaledVector(rp, lateralOff);
  const rotY = headingToRotationY(point.headingDeg);

  const emissive = 0.28 + closeness * 0.7;
  const opacity = 0.55 + closeness * 0.45;

  return (
    <group position={[carPos.x, 0, carPos.z]} rotation={[0, rotY, 0]}>
      {/* Body */}
      <mesh position={[0, 0.72, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.0, 1.38, 4.55]} />
        <meshStandardMaterial
          color="#bb2222"
          emissive="#881010"
          emissiveIntensity={emissive}
          roughness={0.48}
          metalness={0.28}
          transparent
          opacity={opacity}
        />
      </mesh>
      {/* Cabin */}
      <mesh position={[0, 1.52, -0.16]} castShadow>
        <boxGeometry args={[1.76, 0.74, 2.38]} />
        <meshStandardMaterial color="#992020" roughness={0.42} metalness={0.3} transparent opacity={opacity} />
      </mesh>
      {/* Windshield */}
      <mesh position={[0, 1.57, 1.06]} rotation={[0.28, 0, 0]}>
        <boxGeometry args={[1.64, 0.65, 0.06]} />
        <meshStandardMaterial color="#99ccee" transparent opacity={0.55 * opacity} roughness={0.06} />
      </mesh>
      {/* Rear window */}
      <mesh position={[0, 1.52, -1.28]} rotation={[-0.26, 0, 0]}>
        <boxGeometry args={[1.64, 0.6, 0.06]} />
        <meshStandardMaterial color="#99ccee" transparent opacity={0.45 * opacity} roughness={0.06} />
      </mesh>
      {/* Wheels */}
      {[-0.93, 0.93].flatMap((x) =>
        [-1.44, 1.44].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 0.34, z]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.34, 0.34, 0.22, 16]} />
            <meshStandardMaterial color="#111111" roughness={0.95} />
          </mesh>
        ))
      )}
      {/* Headlights */}
      {[-0.62, 0.62].map((x) => (
        <mesh key={x} position={[x, 0.72, 2.29]}>
          <boxGeometry args={[0.28, 0.16, 0.04]} />
          <meshStandardMaterial color="#ffffee" emissive="#ffffee" emissiveIntensity={3 + closeness * 2} />
        </mesh>
      ))}
      {/* Tail lights */}
      {[-0.62, 0.62].map((x) => (
        <mesh key={x} position={[x, 0.72, -2.29]}>
          <boxGeometry args={[0.28, 0.14, 0.04]} />
          <meshStandardMaterial color="#ff1f0a" emissive="#ff1f0a" emissiveIntensity={1.6} />
        </mesh>
      ))}
      {/* Headlight glow when close pass */}
      {closeness > 0.1 && (
        <pointLight color="#ffffee" intensity={closeness * 55} distance={90} position={[0, 0.72, 2.4]} />
      )}
    </group>
  );
}
