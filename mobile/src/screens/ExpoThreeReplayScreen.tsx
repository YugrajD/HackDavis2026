import { GLView } from "expo-gl";
import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import * as THREE from "three";

const ROUTE_POINTS = [
  new THREE.Vector3(-38, 0, -18),
  new THREE.Vector3(-24, 0, -12),
  new THREE.Vector3(-8, 0, -9),
  new THREE.Vector3(10, 0, -11),
  new THREE.Vector3(28, 0, -18),
  new THREE.Vector3(46, 0, -30),
];

const ALERTS = [
  { t: 0.18, label: "Vehicle closing fast on left", severity: 94 },
  { t: 0.38, label: "Blocked bike lane ahead", severity: 72 },
  { t: 0.58, label: "Door zone on right", severity: 81 },
  { t: 0.76, label: "Cross traffic conflict", severity: 88 },
];

type ExpoGl = WebGLRenderingContext & {
  drawingBufferWidth: number;
  drawingBufferHeight: number;
  endFrameEXP: () => void;
};

type ActorState = {
  bike: THREE.Group;
  car: THREE.Group;
  pulse: THREE.Mesh;
  riskCone: THREE.Mesh;
  alertMarkers: THREE.Mesh[];
};

function rightPerp(tangent: THREE.Vector3) {
  return new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
}

function buildRibbon(
  curve: THREE.CatmullRomCurve3,
  leftOffset: number,
  rightOffset: number,
  y: number,
  segments = 160
) {
  const points = curve.getPoints(segments);
  const vertices: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segments; i += 1) {
    const t = curve.getTangent(i / segments).setY(0).normalize();
    const right = rightPerp(t);
    const left = points[i].clone().addScaledVector(right, leftOffset).setY(y);
    const roadRight = points[i].clone().addScaledVector(right, rightOffset).setY(y);

    vertices.push(left.x, left.y, left.z, roadRight.x, roadRight.y, roadRight.z);

    if (i < segments) {
      const base = i * 2;
      indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function buildOffsetPoints(curve: THREE.CatmullRomCurve3, offset: number, y: number) {
  const segments = 96;
  return curve.getPoints(segments).map((point, index) => {
    const tangent = curve.getTangent(index / segments).setY(0).normalize();
    return point.clone().addScaledVector(rightPerp(tangent), offset).setY(y);
  });
}

function makeLine(points: THREE.Vector3[], color: string, linewidth = 1) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color, linewidth });
  return new THREE.Line(geometry, material);
}

function makeBike() {
  const group = new THREE.Group();

  const frameMaterial = new THREE.MeshStandardMaterial({
    color: "#2ee98f",
    emissive: "#09351f",
    metalness: 0.2,
    roughness: 0.4,
  });
  const tireMaterial = new THREE.MeshStandardMaterial({ color: "#060807", roughness: 0.7 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.34, 2.0), frameMaterial);
  body.position.y = 0.9;
  group.add(body);

  [-0.72, 0.72].forEach((x) => {
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.07, 10, 24), tireMaterial);
    wheel.position.set(x, 0.42, 0);
    wheel.rotation.y = Math.PI / 2;
    group.add(wheel);
  });

  const rider = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.34, 1.05, 8, 16),
    new THREE.MeshStandardMaterial({ color: "#d7f3ff", roughness: 0.35 })
  );
  rider.position.set(0, 1.65, -0.1);
  group.add(rider);

  return group;
}

function makeCar() {
  const group = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: "#ff4d45",
    emissive: "#250604",
    metalness: 0.2,
    roughness: 0.36,
  });
  const glassMaterial = new THREE.MeshStandardMaterial({
    color: "#bfe7ff",
    transparent: true,
    opacity: 0.72,
    roughness: 0.15,
  });
  const tireMaterial = new THREE.MeshStandardMaterial({ color: "#080808", roughness: 0.8 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.9, 5.0), bodyMaterial);
  body.position.y = 0.75;
  group.add(body);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.75, 2.35), glassMaterial);
  cabin.position.set(0, 1.45, -0.45);
  group.add(cabin);

  [
    [-1.45, 0.42, -1.65],
    [1.45, 0.42, -1.65],
    [-1.45, 0.42, 1.65],
    [1.45, 0.42, 1.65],
  ].forEach(([x, y, z]) => {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.32, 24), tireMaterial);
    wheel.position.set(x, y, z);
    wheel.rotation.z = Math.PI / 2;
    group.add(wheel);
  });

  return group;
}

function createReplayScene(gl: ExpoGl): { cleanup: () => void } {
  const width = gl.drawingBufferWidth;
  const height = gl.drawingBufferHeight;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#080b0e");
  scene.fog = new THREE.Fog("#080b0e", 45, 145);

  const camera = new THREE.PerspectiveCamera(52, width / height, 0.1, 500);
  camera.position.set(-34, 33, 44);
  camera.lookAt(4, 0, -15);

  const renderer = new THREE.WebGLRenderer({
    canvas: {
      width,
      height,
      style: {},
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      clientHeight: height,
      clientWidth: width,
    } as unknown as HTMLCanvasElement,
    context: gl as unknown as WebGLRenderingContext,
    antialias: true,
  });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.shadowMap.enabled = true;

  scene.add(new THREE.HemisphereLight("#d8ecff", "#10170f", 1.15));
  const sun = new THREE.DirectionalLight("#fff1d3", 3.2);
  sun.position.set(-30, 70, 34);
  sun.castShadow = true;
  scene.add(sun);

  const curve = new THREE.CatmullRomCurve3(ROUTE_POINTS);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(150, 110),
    new THREE.MeshStandardMaterial({ color: "#10160f", roughness: 0.92 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(4, -0.035, -18);
  ground.receiveShadow = true;
  scene.add(ground);

  const road = new THREE.Mesh(
    buildRibbon(curve, -6.2, 2.8, 0.01),
    new THREE.MeshStandardMaterial({ color: "#1d2023", roughness: 0.86 })
  );
  road.receiveShadow = true;
  scene.add(road);

  const bikeLane = new THREE.Mesh(
    buildRibbon(curve, -1.7, 1.9, 0.035),
    new THREE.MeshBasicMaterial({ color: "#173321", transparent: true, opacity: 0.78 })
  );
  scene.add(bikeLane);

  scene.add(makeLine(buildOffsetPoints(curve, -1.7, 0.08), "#f0c84b", 2));
  scene.add(makeLine(buildOffsetPoints(curve, 1.9, 0.09), "#f4f8f0", 2));

  ALERTS.forEach((alert) => {
    const point = curve.getPoint(alert.t);
    const tangent = curve.getTangent(alert.t).setY(0).normalize();
    const markerPosition = point.clone().addScaledVector(rightPerp(tangent), 0.7);
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.72, 20, 20),
      new THREE.MeshStandardMaterial({
        color: alert.severity > 85 ? "#ff4d45" : "#ffbe3d",
        emissive: alert.severity > 85 ? "#54100b" : "#4a2d02",
        roughness: 0.35,
      })
    );
    marker.position.copy(markerPosition).setY(1.2);
    scene.add(marker);
  });

  const actors: ActorState = {
    bike: makeBike(),
    car: makeCar(),
    pulse: new THREE.Mesh(
      new THREE.RingGeometry(1.4, 2.6, 48),
      new THREE.MeshBasicMaterial({
        color: "#ff4d45",
        transparent: true,
        opacity: 0.48,
        side: THREE.DoubleSide,
      })
    ),
    riskCone: new THREE.Mesh(
      new THREE.ConeGeometry(3.2, 11, 40, 1, true),
      new THREE.MeshBasicMaterial({
        color: "#ff6b4a",
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    ),
    alertMarkers: [],
  };

  actors.bike.add(actors.riskCone);
  actors.riskCone.position.set(0, 0.28, 5.5);
  actors.riskCone.rotation.x = Math.PI / 2;
  actors.pulse.rotation.x = -Math.PI / 2;
  scene.add(actors.bike);
  scene.add(actors.car);
  scene.add(actors.pulse);

  let animationFrame = 0;
  let disposed = false;
  const start = Date.now();

  const render = () => {
    if (disposed) return;

    const elapsed = (Date.now() - start) / 1000;
    const progress = (elapsed % 12) / 12;
    const bikeProgress = progress;
    const carProgress = Math.min(0.985, progress + 0.065);

    const bikePoint = curve.getPoint(bikeProgress);
    const bikeTangent = curve.getTangent(bikeProgress).setY(0).normalize();
    const bikeRight = rightPerp(bikeTangent);
    actors.bike.position.copy(bikePoint.clone().addScaledVector(bikeRight, 0.85)).setY(0);
    actors.bike.rotation.y = Math.atan2(bikeTangent.x, bikeTangent.z);

    const carPoint = curve.getPoint(carProgress);
    const carTangent = curve.getTangent(carProgress).setY(0).normalize();
    const carRight = rightPerp(carTangent);
    const squeeze = Math.max(0, 1 - Math.abs(progress - 0.18) / 0.11);
    const carOffset = -4.5 + squeeze * 2.1;
    actors.car.position.copy(carPoint.clone().addScaledVector(carRight, carOffset)).setY(0);
    actors.car.rotation.y = Math.atan2(carTangent.x, carTangent.z);

    actors.pulse.position.copy(actors.bike.position).setY(0.12);
    const pulseScale = 1 + ((elapsed * 1.8) % 1) * 2.2;
    actors.pulse.scale.setScalar(pulseScale);
    const pulseMaterial = actors.pulse.material as THREE.MeshBasicMaterial;
    pulseMaterial.opacity = 0.42 * (1 - ((elapsed * 1.8) % 1));

    const follow = actors.bike.position.clone().add(new THREE.Vector3(-26, 24, 34));
    camera.position.lerp(follow, 0.035);
    camera.lookAt(actors.bike.position.x + 7, 1.2, actors.bike.position.z - 2);

    renderer.render(scene, camera);
    gl.endFrameEXP();
    animationFrame = requestAnimationFrame(render);
  };

  render();

  return {
    cleanup: () => {
      disposed = true;
      cancelAnimationFrame(animationFrame);
      renderer.dispose();
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();
        const material = mesh.material;
        if (Array.isArray(material)) {
          material.forEach((item) => item.dispose());
        } else {
          material?.dispose();
        }
      });
    },
  };
}

export function ExpoThreeReplayScreen() {
  const cleanupRef = useRef<(() => void) | null>(null);
  const [activeAlert, setActiveAlert] = useState(ALERTS[0]);

  useEffect(() => {
    const interval = setInterval(() => {
      const phase = ((Date.now() / 1000) % 12) / 12;
      const nearest = ALERTS.reduce((best, alert) =>
        Math.abs(alert.t - phase) < Math.abs(best.t - phase) ? alert : best
      );
      setActiveAlert(nearest);
    }, 400);

    return () => clearInterval(interval);
  }, []);

  const handleContextCreate = useCallback((gl: ExpoGl) => {
    cleanupRef.current?.();
    cleanupRef.current = createReplayScene(gl).cleanup;
  }, []);

  useEffect(() => {
    return () => cleanupRef.current?.();
  }, []);

  return (
    <View style={styles.screen}>
      <GLView style={styles.canvas} onContextCreate={handleContextCreate} />
      <View style={styles.topBar}>
        <Text style={styles.kicker}>Guardian Road</Text>
        <Text style={styles.title}>Three.js Near-Miss Replay</Text>
      </View>
      <View style={styles.alertPanel}>
        <View style={[styles.severityDot, activeAlert.severity > 85 && styles.hotDot]} />
        <View style={styles.alertTextGroup}>
          <Text style={styles.alertLabel}>{activeAlert.label}</Text>
          <Text style={styles.alertMeta}>risk {activeAlert.severity} / Davis demo route</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#080b0e",
  },
  canvas: {
    flex: 1,
  },
  topBar: {
    position: "absolute",
    top: 58,
    left: 18,
    right: 18,
  },
  kicker: {
    color: "#89f0bb",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  title: {
    color: "#f4f7f3",
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: 0,
    marginTop: 4,
  },
  alertPanel: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 34,
    minHeight: 72,
    borderRadius: 8,
    backgroundColor: "rgba(9, 13, 16, 0.82)",
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  severityDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#ffbe3d",
    marginRight: 12,
  },
  hotDot: {
    backgroundColor: "#ff4d45",
  },
  alertTextGroup: {
    flex: 1,
  },
  alertLabel: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0,
  },
  alertMeta: {
    color: "#aeb9bc",
    fontSize: 13,
    marginTop: 4,
  },
});
