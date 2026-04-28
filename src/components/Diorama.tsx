import { useMemo } from 'react';
import * as THREE from 'three';

const matte = (color: string, roughness = 0.95, metalness = 0.05) =>
  new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
  });

export function Diorama() {
  const concrete = useMemo(() => matte('#3a3f4a'), []);
  const concreteDark = useMemo(() => matte('#2a2e38'), []);
  const groundMat = useMemo(() => matte('#0e1424', 1.0, 0.0), []);
  const cone = useMemo(() => matte('#c2541a', 0.6, 0.1), []);
  const coneStripe = useMemo(() => matte('#e8e6da', 0.7, 0.0), []);
  const pipe = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#5a5d63',
        roughness: 0.45,
        metalness: 0.85,
      }),
    [],
  );
  const rebar = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#3d342a',
        roughness: 0.85,
        metalness: 0.4,
      }),
    [],
  );
  const signPole = useMemo(() => matte('#1c1f29', 0.7, 0.7), []);
  const signFace = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#d49532',
        roughness: 0.7,
        metalness: 0.05,
      }),
    [],
  );
  const drumMat = useMemo(() => matte('#1a1d27', 0.8, 0.3), []);

  return (
    <group>
      {/* ground */}
      <mesh
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -2, 0]}
        material={groundMat}
      >
        <planeGeometry args={[60, 60]} />
      </mesh>

      {/* MID-GROUND CLUSTER (left): two barriers, one tipped, one laying flat */}
      <group position={[-1.6, -1.55, 0.1]}>
        {/* standing barrier, slightly tilted */}
        <mesh
          castShadow
          receiveShadow
          material={concrete}
          rotation={[0, 0.18, -0.04]}
        >
          <boxGeometry args={[1.6, 0.9, 0.55]} />
        </mesh>
        {/* second barrier behind/under, laying on its side */}
        <mesh
          castShadow
          receiveShadow
          material={concreteDark}
          position={[-0.4, -0.45, -0.5]}
          rotation={[0, 0.22, Math.PI / 2]}
        >
          <boxGeometry args={[1.6, 0.9, 0.55]} />
        </mesh>
        {/* a third smaller chunk wedged between */}
        <mesh
          castShadow
          receiveShadow
          material={concrete}
          position={[0.55, -0.05, 0.4]}
          rotation={[0, -0.3, 0.1]}
        >
          <boxGeometry args={[0.7, 0.55, 0.5]} />
        </mesh>
      </group>

      {/* SIGN — leaning against the barriers, behind/right of them. No emissive. */}
      <group position={[-0.4, -1.35, 0.4]} rotation={[0, -0.35, 0.07]}>
        <mesh castShadow material={signPole} position={[0, -0.3, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 1.3, 8]} />
        </mesh>
        <mesh castShadow position={[0, 0.4, 0]} material={signFace}>
          <boxGeometry args={[1.0, 0.5, 0.05]} />
        </mesh>
        <mesh position={[0, 0.4, 0.027]}>
          <boxGeometry args={[0.92, 0.07, 0.001]} />
          <meshStandardMaterial color="#0d1020" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.53, 0.027]}>
          <boxGeometry args={[0.92, 0.035, 0.001]} />
          <meshStandardMaterial color="#0d1020" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.27, 0.027]}>
          <boxGeometry args={[0.92, 0.035, 0.001]} />
          <meshStandardMaterial color="#0d1020" roughness={0.9} />
        </mesh>
      </group>

      {/* TRAFFIC CONE — tilted, with stripe correctly hugging the cone surface */}
      <group position={[1.45, -1.6, 0.65]} rotation={[0.1, 0, 0.13]}>
        {/* base */}
        <mesh castShadow receiveShadow material={coneStripe}>
          <boxGeometry args={[0.55, 0.08, 0.55]} />
        </mesh>
        {/* cone body */}
        <mesh castShadow receiveShadow position={[0, 0.5, 0]} material={cone}>
          <coneGeometry args={[0.28, 1.0, 28]} />
        </mesh>
        {/* white reflective stripe — frustum that tracks cone slope.
            Cone tapers r=0.28 at y=0 to r=0 at y=1.0 (in group-local).
            Stripe at y=0.40..0.48 → r=0.28*(1-0.40)=0.168 down to 0.28*(1-0.48)=0.146 */}
        <mesh
          castShadow
          position={[0, 0.44, 0]}
          material={coneStripe}
        >
          <cylinderGeometry args={[0.148, 0.17, 0.085, 28, 1, true]} />
        </mesh>
      </group>

      {/* SCAFFOLD — pushed back, slightly silhouetted */}
      <group position={[2.7, -2, -1.0]} scale={0.92}>
        <mesh castShadow receiveShadow material={pipe} position={[0, 1.05, 0]}>
          <cylinderGeometry args={[0.045, 0.045, 2.1, 12]} />
        </mesh>
        <mesh
          castShadow
          receiveShadow
          material={pipe}
          position={[0.75, 1.05, 0]}
        >
          <cylinderGeometry args={[0.045, 0.045, 2.1, 12]} />
        </mesh>
        <mesh
          castShadow
          receiveShadow
          material={pipe}
          position={[0.375, 0.4, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.04, 0.04, 0.75, 12]} />
        </mesh>
        <mesh
          castShadow
          receiveShadow
          material={pipe}
          position={[0.375, 1.45, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.04, 0.04, 0.75, 12]} />
        </mesh>
        {/* diagonal cross-brace */}
        <mesh
          castShadow
          material={pipe}
          position={[0.375, 0.95, 0]}
          rotation={[0, 0, Math.PI / 4]}
        >
          <cylinderGeometry args={[0.035, 0.035, 1.05, 10]} />
        </mesh>
      </group>

      {/* BACKGROUND SILHOUETTE — cable drum, far right, barely lit */}
      <group position={[3.6, -1.55, -2.4]} rotation={[0, 0.4, 0]}>
        <mesh
          castShadow
          receiveShadow
          material={drumMat}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.5, 0.5, 0.7, 24, 1, false]} />
        </mesh>
        {/* end caps slightly larger */}
        <mesh
          material={drumMat}
          position={[-0.36, 0, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.55, 0.55, 0.04, 24]} />
        </mesh>
        <mesh
          material={drumMat}
          position={[0.36, 0, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.55, 0.55, 0.04, 24]} />
        </mesh>
      </group>

      {/* FOREGROUND DEPTH — rebar bundle, close to camera, mostly silhouetted */}
      <group position={[-2.7, -1.96, 3.5]} rotation={[0, 0.5, 0]}>
        <mesh
          castShadow
          receiveShadow
          material={rebar}
          rotation={[Math.PI / 2, 0, 0.05]}
        >
          <cylinderGeometry args={[0.025, 0.025, 1.8, 8]} />
        </mesh>
        <mesh
          castShadow
          receiveShadow
          material={rebar}
          position={[0.06, 0.02, 0.04]}
          rotation={[Math.PI / 2, 0.08, 0.02]}
        >
          <cylinderGeometry args={[0.025, 0.025, 1.85, 8]} />
        </mesh>
        <mesh
          castShadow
          receiveShadow
          material={rebar}
          position={[-0.04, 0.04, -0.03]}
          rotation={[Math.PI / 2, -0.06, 0.08]}
        >
          <cylinderGeometry args={[0.025, 0.025, 1.75, 8]} />
        </mesh>
        <mesh
          castShadow
          material={rebar}
          position={[0.6, 0.04, 0.05]}
          rotation={[Math.PI / 2, 0.4, 0.15]}
        >
          <cylinderGeometry args={[0.025, 0.025, 0.5, 8]} />
        </mesh>
      </group>

      {/* a tipped small cone in foreground for asymmetry */}
      <group
        position={[0.3, -1.96, 2.4]}
        rotation={[Math.PI / 2.2, 0.3, 0]}
      >
        <mesh castShadow receiveShadow material={cone}>
          <coneGeometry args={[0.18, 0.6, 20]} />
        </mesh>
      </group>

      {/* manhole-like ring detail on the floor */}
      <mesh
        position={[-0.4, -1.97, 1.6]}
        rotation={[-Math.PI / 2, 0, 0.3]}
      >
        <ringGeometry args={[0.18, 0.32, 24]} />
        <meshStandardMaterial color="#1c1f29" roughness={0.7} />
      </mesh>
    </group>
  );
}
