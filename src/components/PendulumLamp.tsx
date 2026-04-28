import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

const ANCHOR = new THREE.Vector3(0, 4.2, 0);
const CORD_LENGTH = 3.2;
const G = 9.8;
const REST_DAMPING = 0.32;
const SWING_IN_DAMPING = 0.22;
const SWING_IN_DURATION = 1.4;
const INITIAL_THETA = -1.05;
const CURSOR_FORCE_PER_PX = 0.22;
const CURSOR_VEL_DECAY = 0.85;
const MAX_TORQUE = 28;
const HIT_RADIUS_PX = 110;

export function PendulumLamp() {
  const pivotRef = useRef<THREE.Group>(null!);
  const bulbRef = useRef<THREE.Mesh>(null!);
  const spotRef = useRef<THREE.SpotLight>(null!);
  const targetRef = useRef<THREE.Object3D>(null!);

  const stateRef = useRef({
    theta: INITIAL_THETA,
    omega: 0,
    elapsed: 0,
    mouseX: 0,
    mouseY: 0,
    mouseDX: 0,
    mouseInitialized: false,
  });

  const { size, camera } = useThree();
  const lampScreen = useMemo(() => new THREE.Vector3(), []);
  const lampWorld = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      const s = stateRef.current;
      if (!s.mouseInitialized) {
        s.mouseX = e.clientX;
        s.mouseY = e.clientY;
        s.mouseInitialized = true;
        return;
      }
      const dx = e.clientX - s.mouseX;
      s.mouseDX = s.mouseDX * 0.55 + dx * 0.45;
      s.mouseX = e.clientX;
      s.mouseY = e.clientY;
    };
    window.addEventListener('pointermove', handleMove);
    return () => window.removeEventListener('pointermove', handleMove);
  }, []);

  useFrame((_state, deltaRaw) => {
    const dt = Math.min(deltaRaw, 1 / 30);
    const s = stateRef.current;
    s.elapsed += dt;

    const damping =
      s.elapsed < SWING_IN_DURATION ? SWING_IN_DAMPING : REST_DAMPING;

    let externalTorque = 0;
    if (s.mouseInitialized && bulbRef.current) {
      bulbRef.current.getWorldPosition(lampWorld);
      lampScreen.copy(lampWorld).project(camera);
      const lampSx = ((lampScreen.x + 1) / 2) * size.width;
      const lampSy = ((1 - lampScreen.y) / 2) * size.height;
      const ddx = s.mouseX - lampSx;
      const ddy = s.mouseY - lampSy;
      const dist = Math.hypot(ddx, ddy);

      if (dist < HIT_RADIUS_PX) {
        const falloff = 1 - dist / HIT_RADIUS_PX;
        const rawTorque = s.mouseDX * CURSOR_FORCE_PER_PX * falloff;
        externalTorque = Math.max(
          -MAX_TORQUE,
          Math.min(MAX_TORQUE, rawTorque),
        );
      }
    }

    const alpha =
      -(G / CORD_LENGTH) * Math.sin(s.theta) -
      damping * s.omega +
      externalTorque;

    s.omega += alpha * dt;
    s.theta += s.omega * dt;

    s.mouseDX *= Math.pow(CURSOR_VEL_DECAY, dt * 60);

    if (pivotRef.current) {
      pivotRef.current.rotation.z = s.theta;
    }
  });

  useEffect(() => {
    if (spotRef.current && targetRef.current) {
      spotRef.current.target = targetRef.current;
    }
  }, []);

  const cordMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#1a1a1a',
        roughness: 0.9,
        metalness: 0.1,
      }),
    [],
  );

  const shadeMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#1f2333',
        roughness: 0.4,
        metalness: 0.85,
        emissive: '#ff8a00',
        emissiveIntensity: 0.08,
      }),
    [],
  );

  const innerShadeMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#fff5e1',
        roughness: 0.6,
        metalness: 0.2,
        emissive: '#ffb347',
        emissiveIntensity: 0.18,
        side: THREE.BackSide,
      }),
    [],
  );

  const baffleMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#05060a',
        roughness: 0.95,
        metalness: 0.0,
        side: THREE.DoubleSide,
      }),
    [],
  );

  const bulbMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#fff2c8',
        emissive: '#ffd58a',
        emissiveIntensity: 1.5,
        toneMapped: false,
      }),
    [],
  );

  return (
    <>
      <mesh position={[ANCHOR.x, ANCHOR.y + 0.05, ANCHOR.z]}>
        <cylinderGeometry args={[0.12, 0.12, 0.08, 16]} />
        <meshStandardMaterial color="#0d1020" roughness={0.7} metalness={0.6} />
      </mesh>

      <group
        ref={pivotRef}
        position={ANCHOR.toArray()}
      >
        <mesh
          position={[0, -CORD_LENGTH / 2, 0]}
          material={cordMaterial}
        >
          <cylinderGeometry
            args={[0.018, 0.018, CORD_LENGTH, 8]}
          />
        </mesh>

        <group position={[0, -CORD_LENGTH, 0]}>
          <mesh material={shadeMaterial} castShadow>
            <coneGeometry args={[0.55, 0.55, 32, 1, true]} />
          </mesh>
          <mesh material={innerShadeMaterial}>
            <coneGeometry args={[0.53, 0.52, 32, 1, true]} />
          </mesh>
          <mesh
            position={[0, 0.05, 0]}
            rotation={[Math.PI / 2, 0, 0]}
            material={baffleMaterial}
          >
            <circleGeometry args={[0.22, 24]} />
          </mesh>

          <mesh
            ref={bulbRef}
            position={[0, -0.05, 0]}
            material={bulbMaterial}
          >
            <sphereGeometry args={[0.13, 24, 24]} />
          </mesh>

          <spotLight
            ref={spotRef}
            position={[0, -0.1, 0]}
            color="#ffb066"
            intensity={70}
            angle={0.55}
            penumbra={0.45}
            distance={20}
            decay={1.5}
            castShadow
            shadow-mapSize={[1024, 1024]}
            shadow-bias={-0.0008}
          />
          <object3D ref={targetRef} position={[0, -3, 0]} />
        </group>
      </group>
    </>
  );
}
