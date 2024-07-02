import React, { useRef, useEffect, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

// Types and Interfaces
type Dimension = "x" | "y" | "z";

interface Axis {
  name: string;
  data: number[];
}

export type AxisData = Record<Dimension, Axis>;

interface ScatterPlotProps {
  optionType: string;
  currentPrice: number;
  data: AxisData;
}

interface Point {
  x: number;
  y: number;
  z: number;
  originalX: number;
  originalY: number;
  originalZ: number;
}

interface TooltipState {
  show: boolean;
  x: number;
  y: number;
  content: string;
}

// Constants
const GRID_SIZE = 20;
const POINT_SIZE = 0.64;

// Utility Functions
const normalizeData = (data: AxisData): Point[] => {
  const normalize = (value: number, min: number, max: number) =>
    ((value - min) / (max - min)) * GRID_SIZE - GRID_SIZE / 2;

  const minMax = (arr: number[]) => ({
    min: Math.min(...arr),
    max: Math.max(...arr),
  });

  const { min: minX, max: maxX } = minMax(data.x.data);
  const { min: minY, max: maxY } = minMax(data.y.data);
  const { min: minZ, max: maxZ } = minMax(data.z.data);

  return data.x.data.map((_, i) => ({
    x: normalize(data.x.data[i], minX, maxX),
    y: normalize(data.y.data[i], minY, maxY),
    z: normalize(data.z.data[i], minZ, maxZ),
    originalX: data.x.data[i],
    originalY: data.y.data[i],
    originalZ: data.z.data[i],
  }));
};

const colorScale = (value: number, min: number, max: number) => {
  const t = (value - min) / (max - min);
  return new THREE.Color().setHSL(0.7 - t * 0.7, 1, 0.5);
};

// Component
const ScatterPlot: React.FC<ScatterPlotProps> = ({
  currentPrice,
  data,
  optionType,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const gridRef = useRef<THREE.GridHelper | null>(null);

  const [tooltip, setTooltip] = useState<TooltipState>({
    show: false,
    x: 0,
    y: 0,
    content: "",
  });

  const setupScene = useCallback(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    const camera = new THREE.PerspectiveCamera(72, width / height, 0.1, 1000);
    camera.position.set(24, 8, 16);
    camera.lookAt(new THREE.Vector3(0, 0, 0));

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    mountRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    controlsRef.current = controls;

    return () => {
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  const createPoints = useCallback(
    (normalizedData: Point[]) => {
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(normalizedData.length * 3);
      const colors = new Float32Array(normalizedData.length * 3);

      const minZ = Math.min(...data.z.data);
      const maxZ = Math.max(...data.z.data);

      normalizedData.forEach((point, i) => {
        positions[i * 3] = point.x;
        positions[i * 3 + 1] = point.y;
        positions[i * 3 + 2] = point.z;

        const color = colorScale(point.originalZ, minZ, maxZ);
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
      });

      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3)
      );
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

      const material = new THREE.PointsMaterial({
        vertexColors: true,
        size: POINT_SIZE,
        sizeAttenuation: true,
      });

      return new THREE.Points(geometry, material);
    },
    [data.z.data]
  );

  const createPriceRangeBoxes = useCallback(
    (normalizedCurrentPrice: number) => {
      const upperBoxGeometry = new THREE.BoxGeometry(
        GRID_SIZE,
        GRID_SIZE - normalizedCurrentPrice,
        GRID_SIZE
      );

      let lowerBoxColor = optionType == "put" ? 0xffcccb : 0x90ee90;
      let upperBoxColor = optionType == "put" ? 0x90ee90 : 0xffcccb;

      const upperBoxMaterial = new THREE.MeshBasicMaterial({
        color: upperBoxColor,
        transparent: true,
        opacity: 0.2,
      });
      const upperBox = new THREE.Mesh(upperBoxGeometry, upperBoxMaterial);
      upperBox.position.set(0, (GRID_SIZE + normalizedCurrentPrice) / 2, 0);

      const lowerBoxGeometry = new THREE.BoxGeometry(
        GRID_SIZE,
        normalizedCurrentPrice + GRID_SIZE / 2,
        GRID_SIZE
      );
      const lowerBoxMaterial = new THREE.MeshBasicMaterial({
        color: lowerBoxColor,
        transparent: true,
        opacity: 0.2,
      });
      const lowerBox = new THREE.Mesh(lowerBoxGeometry, lowerBoxMaterial);
      lowerBox.position.set(0, (normalizedCurrentPrice - GRID_SIZE / 2) / 2, 0);

      return { upperBox, lowerBox };
    },
    [optionType]
  );

  const addLabel = useCallback(
    (
      text: string,
      font: string,
      position: THREE.Vector3,
      size = 4,
      offset = new THREE.Vector3(0, 0, 0),
      fillStyle = "rgba(0,0,0,.64)" // Changed to full opacity black as default
    ) => {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (context) {
        const pixelRatio = window.devicePixelRatio || 1;

        const fontSize = parseInt(font.match(/\d+/)?.[0] || "32", 10);
        context.font = font;
        const textMetrics = context.measureText(text);

        const padding = fontSize;
        const canvasWidth = Math.ceil(textMetrics.width + padding * 2);
        const canvasHeight = Math.ceil(fontSize * 2.5);

        canvas.width = canvasWidth * pixelRatio;
        canvas.height = canvasHeight * pixelRatio;

        context.scale(pixelRatio, pixelRatio);

        // Clear the canvas with a transparent background
        context.clearRect(0, 0, canvasWidth, canvasHeight);

        const adjustedFont = font.replace(/\d+px/, `${fontSize}px`);

        context.font = adjustedFont;
        context.textBaseline = "middle";
        context.textAlign = "center";

        // Remove shadow for cleaner text
        context.shadowColor = "transparent";
        context.shadowBlur = 0;
        context.shadowOffsetX = 0;
        context.shadowOffsetY = 0;

        // Draw text with full opacity
        context.fillStyle = fillStyle;
        context.fillText(text, canvasWidth / 2, canvasHeight / 2);

        // Optional: Add a subtle white border for better visibility
        context.strokeStyle = "rgba(255, 255, 255, 0.5)";
        context.lineWidth = 1;
        context.strokeText(text, canvasWidth / 2, canvasHeight / 2);
      }

      const texture = new THREE.Texture(canvas);
      texture.needsUpdate = true;

      // Ensure texture uses correct blending for transparency
      texture.premultiplyAlpha = true;

      const renderer = rendererRef.current;
      if (renderer) {
        const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
        texture.anisotropy = maxAnisotropy;
      }

      const spriteMaterial = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      });

      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.position.copy(position.add(offset));

      const aspectRatio = canvas.width / canvas.height;
      sprite.scale.set(size * aspectRatio, size, 1);

      return sprite;
    },
    [rendererRef]
  );
  const handleMouseMove = useCallback(
    (event: MouseEvent, points: THREE.Points, normalizedData: Point[]) => {
      if (!rendererRef.current || !cameraRef.current) return;

      const rect = rendererRef.current.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.params.Points!.threshold = 0.1;
      raycaster.setFromCamera(mouse, cameraRef.current);

      const intersects = raycaster.intersectObject(points);

      if (intersects.length > 0 && intersects[0].index !== undefined) {
        const point = normalizedData[intersects[0].index];
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
      } else {
        setTooltip({ show: false, x: 0, y: 0, content: "" });
      }
    },
    [data.x.name, data.y.name, data.z.name]
  );

  useEffect(() => {
    const cleanup = setupScene();
    const normalizedData = normalizeData(data);
    const points = createPoints(normalizedData);

    if (!sceneRef.current || !rendererRef.current || !cameraRef.current) return;

    sceneRef.current.add(points);
    sceneRef.current.add(new THREE.AxesHelper(GRID_SIZE));

    const minY = Math.min(...data.y.data);
    const maxY = Math.max(...data.y.data);
    const normalizedCurrentPrice =
      ((currentPrice - minY) / (maxY - minY)) * GRID_SIZE - GRID_SIZE / 2;

    const gridHelper = new THREE.GridHelper(GRID_SIZE, GRID_SIZE);
    gridHelper.position.set(0, normalizedCurrentPrice, 0);
    sceneRef.current.add(gridHelper);
    gridRef.current = gridHelper;

    const { upperBox, lowerBox } = createPriceRangeBoxes(
      normalizedCurrentPrice
    );
    sceneRef.current.add(upperBox, lowerBox);

    sceneRef.current.add(
      addLabel(
        data.x.name,
        `32px Arial`,
        new THREE.Vector3(12, 0, 0),
        4,
        new THREE.Vector3(4, 0, 0)
      )
    );
    sceneRef.current.add(
      addLabel(
        data.y.name,
        `32px Arial`,
        new THREE.Vector3(0, GRID_SIZE, 0),
        4,
        new THREE.Vector3(0, 4, 0)
      )
    );
    sceneRef.current.add(
      addLabel(
        data.z.name,
        `32px Arial`,
        new THREE.Vector3(0, 0, 10),
        4,
        new THREE.Vector3(0, 0, 4)
      )
    );
    sceneRef.current.add(
      addLabel(
        `Price: $${currentPrice}`,
        `Bold 16px Arial`,
        new THREE.Vector3(-10, normalizedCurrentPrice, 0),
        4,
        new THREE.Vector3(-4, 0, 0),
        "rgba(255,165,0,0.95)"
      )
    );

    const onMouseMove = (event: MouseEvent) =>
      handleMouseMove(event, points, normalizedData);
    rendererRef.current.domElement.addEventListener("mousemove", onMouseMove);

    const animate = () => {
      requestAnimationFrame(animate);
      controlsRef.current?.update();
      rendererRef.current?.render(sceneRef.current!, cameraRef.current!);
    };
    animate();

    return () => {
      cleanup!();
      rendererRef.current?.domElement.removeEventListener(
        "mousemove",
        onMouseMove
      );
    };
  }, [
    data,
    currentPrice,
    setupScene,
    createPoints,
    createPriceRangeBoxes,
    addLabel,
    handleMouseMove,
  ]);

  useEffect(() => {
    if (gridRef.current) {
      const minY = Math.min(...data.y.data);
      const maxY = Math.max(...data.y.data);
      const normalizedCurrentPrice =
        ((currentPrice - minY) / (maxY - minY)) * GRID_SIZE - GRID_SIZE / 2;
      gridRef.current.position.setY(normalizedCurrentPrice);
    }
  }, [currentPrice, data.y.data]);

  return (
    <div
      ref={mountRef}
      className="w-full h-full"
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
