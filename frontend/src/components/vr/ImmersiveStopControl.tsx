import { useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useXR } from "@react-three/xr";
import { Group, Vector3 } from "three";

type ImmersiveStopControlProps = {
  visible: boolean;
  onStop: () => void;
};

const offset = new Vector3(0.52, -0.34, -1.35);
const worldOffset = new Vector3();

const ImmersiveStopControl = ({ visible, onStop }: ImmersiveStopControlProps) => {
  const groupRef = useRef<Group>(null);
  const session = useXR((state) => state.session);
  const gl = useThree((state) => state.gl);
  const [hovered, setHovered] = useState(false);

  useFrame(() => {
    if (!groupRef.current || !session || !visible) return;
    const viewerCamera = gl.xr.getCamera();
    groupRef.current.quaternion.copy(viewerCamera.quaternion);
    worldOffset.copy(offset).applyQuaternion(viewerCamera.quaternion);
    viewerCamera.getWorldPosition(groupRef.current.position);
    groupRef.current.position.add(worldOffset);
  });

  if (!session || !visible) return null;

  return (
    <group ref={groupRef} renderOrder={120}>
      <mesh
        onClick={(event) => {
          event.stopPropagation();
          onStop();
        }}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
      >
        <circleGeometry args={[0.095, 32]} />
        <meshBasicMaterial
          color="#0a0d12"
          transparent
          opacity={hovered ? 0.92 : 0.58}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, 0, 0.002]} renderOrder={121}>
        <planeGeometry args={[0.045, 0.045]} />
        <meshBasicMaterial
          color="#f2f5f8"
          transparent
          opacity={hovered ? 1 : 0.76}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
};

export default ImmersiveStopControl;
