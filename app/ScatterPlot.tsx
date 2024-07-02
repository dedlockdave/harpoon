import React, { useRef, useEffect, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

type Dimension = "x" | "y" | "z";

interface Axis {
  name: string;
  data: number[];
}

export type AxisData = Record<Dimension, Axis>;

interface ScatterPlotProps {
  currentPrice: number;
  data: AxisData;
}

const ScatterPlot: React.FC<ScatterPlotProps> = ({ currentPrice, data }) => {
  console.log("incomingData", data, currentPrice);
  const gridRef = useRef<THREE.GridHelper | null>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [isRotating, setIsRotating] = useState(true);

  const [tooltip, setTooltip] = useState({
    show: false,
    x: 0,
    y: 0,
    content: "",
  });

  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);
    const camera = new THREE.PerspectiveCamera(72, width / height, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });

    renderer.setSize(width, height);
    mountRef.current.appendChild(renderer.domElement);

    // Normalize data
    const normalizeData = (data: AxisData) => {
      const minX = Math.min(...data.x.data);
      const maxX = Math.max(...data.x.data);
      const minY = Math.min(...data.y.data);
      const maxY = Math.max(...data.y.data);
      const minZ = Math.min(...data.z.data);
      const maxZ = Math.max(...data.z.data);

      return data.x.data.map((_, i) => ({
        x: ((data.x.data[i] - minX) / (maxX - minX)) * 20 - 10,
        y: ((data.y.data[i] - minY) / (maxY - minY)) * 20 - 10,
        z: ((data.z.data[i] - minZ) / (maxZ - minZ)) * 20 - 10,
        originalX: data.x.data[i],
        originalY: data.y.data[i],
        originalZ: data.z.data[i],
      }));
    };

    const normalizedData = normalizeData(data);

    // Create points
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(normalizedData.length * 3);
    const colors = new Float32Array(normalizedData.length * 3);

    const colorScale = (value: number) => {
      const minZ = Math.min(...data.z.data);
      const maxZ = Math.max(...data.z.data);
      const t = (value - minZ) / (maxZ - minZ);
      return new THREE.Color().setHSL(0.7 - t * 0.7, 1, 0.5);
    };

    normalizedData.forEach((point, i) => {
      positions[i * 3] = point.x;
      positions[i * 3 + 1] = point.y;
      positions[i * 3 + 2] = point.z;

      const color = colorScale(point.originalZ);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    });

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      vertexColors: true,
      size: 0.64,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geometry, material);

    scene.add(points);

    // Add axes
    const axesHelper = new THREE.AxesHelper(20);
    scene.add(axesHelper);

    // Add price range boxes
    const minY = Math.min(...data.y.data);
    const maxY = Math.max(...data.y.data);
    const normalizedCurrentPrice =
      ((currentPrice - minY) / (maxY - minY)) * 20 - 10;

    // Add main grid
    const gridHelper = new THREE.GridHelper(20, 20);
    gridHelper.position.set(0, normalizedCurrentPrice, 0);
    // gridHelper.rotation.x = Math.PI / 2;

    scene.add(gridHelper);
    gridRef.current = gridHelper;

    // Create box for prices above current price
    const upperBoxGeometry = new THREE.BoxGeometry(
      20,
      20 - normalizedCurrentPrice,
      20
    );
    const upperBoxMaterial = new THREE.MeshBasicMaterial({
      color: 0x90ee90, // Light green
      transparent: true,
      opacity: 0.2,
    });
    const upperBox = new THREE.Mesh(upperBoxGeometry, upperBoxMaterial);
    upperBox.position.set(0, (20 + normalizedCurrentPrice) / 2, 0);
    scene.add(upperBox);

    // Create box for prices below current price
    const lowerBoxGeometry = new THREE.BoxGeometry(
      20,
      normalizedCurrentPrice + 10,
      20
    );
    const lowerBoxMaterial = new THREE.MeshBasicMaterial({
      color: 0xffcccb, // Light red
      transparent: true,
      opacity: 0.2,
    });
    const lowerBox = new THREE.Mesh(lowerBoxGeometry, lowerBoxMaterial);
    lowerBox.position.set(0, (normalizedCurrentPrice - 10) / 2, 0);
    scene.add(lowerBox);

    const addLabel = (
      text: string,
      font,
      position: THREE.Vector3,
      size = 4,
      offset = new THREE.Vector3(0, 0, 0),
      fillStyle = "rgba(0,0,0,0.95)"
    ) => {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (context) {
        // Set font and measure text
        context.font = font;
        const textMetrics = context.measureText(text);

        // Calculate canvas size based on text width
        const padding = 20; // Padding on each side
        canvas.width = Math.ceil(textMetrics.width + padding * 2);
        // canvas.height = Math.ceil(fontSize * 1.5); // 1.5 times font size for height

        // Clear and redraw on resized canvas
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.font = font;
        context.fillStyle = fillStyle;
        context.textBaseline = "middle";
        context.textAlign = "center";
        context.fillText(text, canvas.width / 2, canvas.height / 2);
      }

      const texture = new THREE.Texture(canvas);
      texture.needsUpdate = true;
      const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.position.copy(position.add(offset));

      // Adjust sprite scale to maintain aspect ratio
      const aspectRatio = canvas.width / canvas.height;
      sprite.scale.set(size * aspectRatio, size, 1);

      scene.add(sprite);
    };

    // Update the axis labels with offsets
    addLabel(
      data.x.name,
      `32px Arial`,
      new THREE.Vector3(12, 0, 0),
      4,
      new THREE.Vector3(2, 0, 0)
    );
    addLabel(
      data.y.name,
      `32px Arial`,
      new THREE.Vector3(0, 20, 0),
      4,
      new THREE.Vector3(0, 2, 0)
    );
    addLabel(
      data.z.name,
      `32px Arial`,
      new THREE.Vector3(0, 0, 10),
      4,
      new THREE.Vector3(0, 0, 2)
    );

    // Update the current price label
    addLabel(
      `Price: $${currentPrice}`,
      `Bold 48px Arial`,
      new THREE.Vector3(-10, normalizedCurrentPrice, 0),
      4,
      new THREE.Vector3(-4, 0, 0),
      "rgba(255,165,0,0.95)"
    );

    //
    // ADD Stage and Controls
    // ***----***----***----***----***----
    // ***----***----***----***----***----

    // Set camera position
    camera.position.set(24, 8, 16);
    camera.lookAt(new THREE.Vector3(0, 0, 0));

    // Add OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);

    // Raycaster for mouse interaction
    const raycaster = new THREE.Raycaster();
    raycaster.params.Points!.threshold = 0.1;
    const mouse = new THREE.Vector2();

    // Mouse move event handler
    const onMouseMove = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(points);

      if (intersects.length > 0) {
        const index = intersects[0].index;
        if (index !== undefined) {
          const point = normalizedData[index];

          setTooltip({
            show: true,
            x: event.clientX,
            y: event.clientY,
            content: `${data.x.name}: ${point.originalX.toFixed(2)}, ${
              data.y.name
            }: ${point.originalY.toFixed(2)}, ${
              data.z.name
            }: ${point.originalZ.toFixed(2)}`,
          });
        }
      } else {
        setTooltip({ show: false, x: 0, y: 0, content: "" });
      }
    };

    renderer.domElement.addEventListener("mousemove", onMouseMove);

    // Animation
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    // Cleanup
    return () => {
      if (mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.domElement.removeEventListener("mousemove", onMouseMove);
    };
  }, [data, currentPrice]);

  useEffect(() => {
    if (gridRef.current) {
      const minY = Math.min(...data.y.data);
      const maxY = Math.max(...data.y.data);
      const normalizedCurrentPrice =
        ((currentPrice - minY) / (maxY - minY)) * 20 - 10;
      gridRef.current.position.setY(normalizedCurrentPrice);
    }
  }, [currentPrice, data]);

  return (
    <div
      ref={mountRef}
      className={`w-full h-full`}
      style={{ position: "relative" }}
    >
      {tooltip.show && (
        <div
          style={{
            position: "absolute",
            left: tooltip.x + 10,
            top: tooltip.y + 10,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            color: "white",
            padding: "5px",
            borderRadius: "5px",
            fontSize: "12px",
          }}
        >
          {tooltip.content}
        </div>
      )}
    </div>
  );
};

export default ScatterPlot;
