import { useMemo, useRef } from "react";
import { Canvas, ThreeEvent, useFrame } from "@react-three/fiber";
import { Line, OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";
import type { DangerSegment, HazardEvent, ReplayPayload, TrackedObject } from "../../lib/contracts";
import { eventToMeters } from "../../lib/replay/coordinates";
import { headingToRotationY } from "../../lib/replay/coordinates";
import { interpolateRoutePoint } from "../../lib/replay/interpolate";
import {
  colorForSeverity,
  eventSceneVector,
  getNearestEvent,
  latLngSceneVector,
  metersToSceneVector,
  objectColor,
  type PreparedReplay,
  routePointSceneVector
} from "../../lib/replay/scene";

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
  onSelectEvent
}: ReplaySceneProps) {
  const cameraPosition: [number, number, number] = [
    0,
    prepared.longestRouteSpan * 0.38,
    prepared.longestRouteSpan * 0.58
  ];

  return (
    <Canvas
      className="scene-canvas"
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: false }}
      camera={{ position: cameraPosition, fov: 52, near: 0.1, far: 1400 }}
    >
      <color attach="background" args={["#05070a"]} />
      <fog attach="fog" args={["#05070a", 220, 900]} />

      <hemisphereLight args={["#d8f8ff", "#101318", 1.2]} />
      <directionalLight
        position={[-80, 140, 70]}
        intensity={2.5}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={420}
        shadow-camera-left={-260}
        shadow-camera-right={260}
        shadow-camera-top={260}
        shadow-camera-bottom={-260}
      />
      <pointLight color="#24d7ff" intensity={65} distance={220} position={[-90, 32, 70]} />

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.07}
        target={[0, 0, 0]}
        maxPolarAngle={Math.PI * 0.48}
        minDistance={40}
        maxDistance={prepared.longestRouteSpan * 1.8}
      />

      <Ground prepared={prepared} />
      <RouteTube prepared={prepared} />
      {payload.dangerSegments.map((segment) => (
        <DangerZone key={segment.id} segment={segment} prepared={prepared} />
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
    </Canvas>
  );
}

function Ground({ prepared }: { prepared: PreparedReplay }) {
  const texture = useMemo(() => {
    const asphalt = createAsphaltTexture();
    asphalt.repeat.set(18, 8);
    asphalt.wrapS = THREE.RepeatWrapping;
    asphalt.wrapT = THREE.RepeatWrapping;
    return asphalt;
  }, []);

  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[prepared.routeWidth + 150, prepared.routeDepth + 170]} />
        <meshStandardMaterial
          color="#101318"
          roughness={0.92}
          metalness={0.04}
          map={texture}
        />
      </mesh>
      <gridHelper
        args={[
          Math.max(prepared.routeWidth, prepared.routeDepth) + 150,
          44,
          new THREE.Color("#17323a"),
          new THREE.Color("#111d22")
        ]}
        position={[0, 0.018, 0]}
      />
    </>
  );
}

function RouteTube({ prepared }: { prepared: PreparedReplay }) {
  const curve = useMemo(
    () => new THREE.CatmullRomCurve3(prepared.routeScenePoints),
    [prepared.routeScenePoints]
  );
  const routeGeometry = useMemo(() => new THREE.TubeGeometry(curve, 220, 0.36, 10, false), [curve]);
  const glowGeometry = useMemo(() => new THREE.TubeGeometry(curve, 220, 0.76, 10, false), [curve]);
  const centerLine = useMemo(
    () => prepared.routeScenePoints.map((point) => point.clone().setY(0.21)),
    [prepared.routeScenePoints]
  );

  return (
    <>
      <mesh geometry={glowGeometry} renderOrder={1}>
        <meshBasicMaterial color="#16b8d7" transparent opacity={0.16} />
      </mesh>
      <mesh geometry={routeGeometry} renderOrder={2}>
        <meshBasicMaterial color="#58e4ff" />
      </mesh>
      <Line points={centerLine} color="#f5fbff" lineWidth={2} transparent opacity={0.82} />
    </>
  );
}

function DangerZone({
  segment,
  prepared
}: {
  segment: DangerSegment;
  prepared: PreparedReplay;
}) {
  const position = latLngSceneVector(segment.centerLat, segment.centerLng, prepared, 0.03);
  const radius = 8 + segment.eventCount * 1.5;
  const color = colorForSeverity(segment.score);

  return (
    <group position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={0}>
        <circleGeometry args={[radius, 64]} />
        <meshBasicMaterial color={color} transparent opacity={0.13} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[radius, radius + 0.6, 64]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.32}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function HazardMarker({
  event,
  prepared,
  currentTime,
  selected,
  onSelectEvent
}: {
  event: HazardEvent;
  prepared: PreparedReplay;
  currentTime: number;
  selected: boolean;
  onSelectEvent: (eventId: string) => void;
}) {
  const root = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>>(null);
  const stem = useRef<THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>>(null);
  const core = useRef<THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>>(null);
  const position = eventSceneVector(event, prepared);
  const color = colorForSeverity(event.severity);

  useFrame(({ clock }) => {
    const distance = Math.abs(currentTime - event.t);
    const temporalFocus = Math.max(0, 1 - distance / 8);
    const selectedFocus = selected ? 1 : 0;
    const pulse = Math.sin(clock.elapsedTime * 6.2 + event.t) * 0.12 + 1;
    const scale = 1 + temporalFocus * 0.7 * pulse + selectedFocus * 0.22;

    if (root.current) root.current.position.y = selected ? 0.22 : 0;
    if (ring.current) {
      ring.current.scale.setScalar(scale);
      ring.current.material.opacity = 0.18 + temporalFocus * 0.44 + selectedFocus * 0.16;
    }
    if (stem.current) stem.current.material.opacity = 0.46 + temporalFocus * 0.34 + selectedFocus * 0.18;
    if (core.current) {
      core.current.material.emissiveIntensity =
        (event.severity >= 85 ? 1.4 : 0.78) + temporalFocus * 1.55 + selectedFocus * 0.5;
    }
  });

  const handleClick = (interaction: ThreeEvent<MouseEvent>) => {
    interaction.stopPropagation();
    onSelectEvent(event.id);
  };

  return (
    <group ref={root} position={position} onClick={handleClick}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
        <ringGeometry args={[2.2, 2.75, 64]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.42}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={stem} position={[0, 1.6, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 3.2, 10]} />
        <meshBasicMaterial color={color} transparent opacity={0.7} />
      </mesh>
      <mesh ref={core} position={[0, 3.35, 0]} castShadow>
        <sphereGeometry args={[event.severity >= 85 ? 0.86 : 0.66, 24, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={event.severity >= 85 ? 1.8 : 1.15}
          roughness={0.35}
          metalness={0.18}
        />
      </mesh>
      <Text
        position={[0, 5.25, 0]}
        fontSize={0.9}
        color="#f6fbff"
        anchorX="center"
        anchorY="middle"
        outlineColor="#05080c"
        outlineWidth={0.08}
      >
        {event.type.replaceAll("_", " ")} {event.severity}
      </Text>
    </group>
  );
}

function GhostObject({
  event,
  object,
  prepared,
  currentTime
}: {
  event: HazardEvent;
  object: TrackedObject;
  prepared: PreparedReplay;
  currentTime: number;
}) {
  const eventMeters = eventToMeters(event, prepared.origin);
  const offset = object.position ?? { x: 0, y: 0, z: 0 };
  const velocity = object.velocity ?? { x: 0, y: 0, z: 0 };
  const position = metersToSceneVector(
    { x: eventMeters.x + offset.x, z: eventMeters.z + offset.z },
    prepared.worldCenter,
    offset.y
  );
  const rotationY = object.velocity
    ? Math.atan2(object.velocity.x, object.velocity.z)
    : headingToRotationY(event.headingDeg);
  const focus = Math.max(0.22, 1 - Math.abs(currentTime - event.t) / 12);
  const color = objectColor(object.type, event.severity);
  const trajectoryPoints = [
    metersToSceneVector(
      { x: eventMeters.x + offset.x, z: eventMeters.z + offset.z },
      prepared.worldCenter,
      0.16
    ),
    metersToSceneVector(
      {
        x: eventMeters.x + offset.x + velocity.x * 3,
        z: eventMeters.z + offset.z + velocity.z * 3
      },
      prepared.worldCenter,
      0.16
    )
  ];

  return (
    <>
      <Line points={trajectoryPoints} color={color} lineWidth={2} transparent opacity={Math.min(0.9, focus + 0.18)} />
      <group position={position} rotation={[0, rotationY, 0]}>
        <TrackedObjectShape object={object} color={color} opacity={focus} />
        <Text
          position={[0, 2.65, 0]}
          fontSize={0.72}
          color="#f7fbff"
          anchorX="center"
          anchorY="middle"
          outlineColor="#05080c"
          outlineWidth={0.08}
        >
          {object.type}
        </Text>
      </group>
    </>
  );
}

function TrackedObjectShape({
  object,
  color,
  opacity
}: {
  object: TrackedObject;
  color: string;
  opacity: number;
}) {
  if (object.type === "car" || object.type === "truck" || object.type === "bus") {
    const size: [number, number, number] = object.type === "car" ? [2.15, 1.25, 4.2] : [2.5, 1.7, 5.6];

    return (
      <>
        <mesh position={[0, size[1] / 2, 0]} castShadow>
          <boxGeometry args={size} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.25}
            roughness={0.48}
            metalness={0.15}
            transparent
            opacity={opacity}
          />
        </mesh>
        <mesh position={[0, size[1] + 0.03, size[2] * 0.05]}>
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
        <meshStandardMaterial color="#ff9b2f" emissive="#ff9b2f" emissiveIntensity={0.35} transparent opacity={opacity} />
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

function BikeActor({
  payload,
  prepared,
  currentTime
}: {
  payload: ReplayPayload;
  prepared: PreparedReplay;
  currentTime: number;
}) {
  const point = interpolateRoutePoint(payload.ride.route, currentTime);
  const position = routePointSceneVector(point, prepared, 0.12);
  const rotationY = headingToRotationY(point.headingDeg);
  const nearestEvent = getNearestEvent(payload.events, currentTime);
  const activeRisk = nearestEvent && Math.abs(nearestEvent.t - currentTime) <= 5;
  const coneColor = activeRisk ? colorForSeverity(nearestEvent.severity) : "#21d4ff";

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <BikeBody />
      <RiskCone rear={nearestEvent?.camera === "rear"} color={coneColor} active={Boolean(activeRisk)} />
    </group>
  );
}

function BikeBody() {
  const framePoints = useMemo(
    () => [
      new THREE.Vector3(0, 0.48, -0.95),
      new THREE.Vector3(0, 1.03, -0.12),
      new THREE.Vector3(0, 0.5, 0.95),
      new THREE.Vector3(0, 0.48, -0.95),
      new THREE.Vector3(0, 1.03, -0.12),
      new THREE.Vector3(0, 1.26, 0.48)
    ],
    []
  );

  return (
    <>
      <mesh rotation={[0, Math.PI / 2, 0]} position={[0, 0.45, -0.95]} castShadow>
        <torusGeometry args={[0.42, 0.045, 12, 36]} />
        <meshStandardMaterial color="#eefcff" emissive="#b8f7ff" emissiveIntensity={0.25} roughness={0.42} />
      </mesh>
      <mesh rotation={[0, Math.PI / 2, 0]} position={[0, 0.45, 0.95]} castShadow>
        <torusGeometry args={[0.42, 0.045, 12, 36]} />
        <meshStandardMaterial color="#eefcff" emissive="#b8f7ff" emissiveIntensity={0.25} roughness={0.42} />
      </mesh>
      <Line points={framePoints} color="#7af1ff" lineWidth={2} />
      <mesh position={[0, 1.6, -0.08]} rotation={[-0.3, 0, 0]} castShadow>
        <capsuleGeometry args={[0.22, 0.8, 8, 18]} />
        <meshStandardMaterial color="#7af1ff" emissive="#28cfff" emissiveIntensity={0.7} roughness={0.35} metalness={0.2} />
      </mesh>
      <mesh position={[0, 1.18, 0.82]} castShadow>
        <boxGeometry args={[0.16, 0.09, 0.3]} />
        <meshStandardMaterial color="#0c1116" emissive="#25d4ff" emissiveIntensity={0.45} roughness={0.25} />
      </mesh>
    </>
  );
}

function RiskCone({ rear, color, active }: { rear?: boolean; color: string; active: boolean }) {
  const range = 28;
  const halfWidth = 12;
  const fillGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(
        new Float32Array([0, 0.05, 0, -halfWidth, 0.05, range, halfWidth, 0.05, range]),
        3
      )
    );
    geometry.setIndex([0, 1, 2]);
    geometry.computeVertexNormals();
    return geometry;
  }, []);
  const linePoints = useMemo(
    () => [
      new THREE.Vector3(0, 0.08, 0),
      new THREE.Vector3(-halfWidth, 0.08, range),
      new THREE.Vector3(0, 0.08, 0),
      new THREE.Vector3(halfWidth, 0.08, range),
      new THREE.Vector3(-halfWidth, 0.08, range),
      new THREE.Vector3(halfWidth, 0.08, range)
    ],
    []
  );

  return (
    <group rotation={[0, rear ? Math.PI : 0, 0]}>
      <mesh geometry={fillGeometry} renderOrder={5}>
        <meshBasicMaterial
          color={color}
          transparent
          opacity={active ? 0.22 : 0.13}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <Line
        points={linePoints}
        color={active ? "#fff4d6" : "#8df3ff"}
        lineWidth={1.5}
        transparent
        opacity={active ? 0.88 : 0.72}
        segments
      />
    </group>
  );
}

function createAsphaltTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas rendering context unavailable.");

  context.fillStyle = "#111418";
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 2100; i += 1) {
    const alpha = Math.random() * 0.12;
    const shade = Math.random() > 0.5 ? 255 : 0;
    context.fillStyle = `rgba(${shade}, ${shade}, ${shade}, ${alpha})`;
    context.fillRect(Math.random() * 256, Math.random() * 256, Math.random() * 2.4, 1);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
