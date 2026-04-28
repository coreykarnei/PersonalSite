import { Canvas } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { PendulumLamp } from './PendulumLamp';
import { Diorama } from './Diorama';

export default function ConstructionHero() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mql.matches);
    const onChange = () => setReduced(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  if (reduced) return null;

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, 0.4, 5.5], fov: 42 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
      }}
    >
      <color attach="background" args={['#060912']} />
      <fog attach="fog" args={['#060912', 7, 18]} />

      <ambientLight intensity={0.06} color="#5a6f99" />
      <hemisphereLight
        args={['#3a4c7a', '#060912', 0.12]}
      />

      <PendulumLamp />
      <Diorama />

      <Sparkles
        count={18}
        scale={[2.2, 3.2, 1.8]}
        position={[0, -0.4, 0]}
        size={1.4}
        speed={0.18}
        opacity={0.22}
        color="#ffd58a"
      />

      <EffectComposer>
        <Bloom
          luminanceThreshold={0.55}
          luminanceSmoothing={0.2}
          intensity={0.9}
          mipmapBlur
        />
        <Vignette eskil={false} offset={0.25} darkness={0.7} />
      </EffectComposer>
    </Canvas>
  );
}
