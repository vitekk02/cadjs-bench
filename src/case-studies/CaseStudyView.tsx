/**
 * Renders a single case-study stage in a fixed-camera viewport. The page-level
 * runner handles URL parsing and case-study loading; this component takes a
 * pre-built {@link CaseStudyStage} and mounts it into Three.js.
 *
 * The lighting and material setup mirror cadjs's internal `initSceneObjects`
 * (4-light rig: ambient, hemisphere, key, fill) so the screenshots look like
 * real CADjs output. The camera is positioned isometrically and frames the
 * geometry's bounding box automatically.
 *
 * Once the geometry is in the scene and at least one frame has rendered, the
 * component sets `window.__caseStudyReady = true` for Playwright to read.
 */

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import {
  createMeshFromBrep,
  createMeshFromGeometry,
  disposeObject3D,
  LIGHTING,
  SCENE,
} from "@vitekk02/cadjs";
import type { CaseStudyStage } from "./types";

declare global {
  interface Window {
    __caseStudyReady?: boolean;
  }
}

interface CaseStudyViewProps {
  stage: CaseStudyStage;
  caseName: string;
  caseDescription: string;
}

function frameCameraToBounds(
  camera: THREE.PerspectiveCamera,
  bounds: THREE.Box3,
  azimuth: number,
  elevation: number,
  marginFactor = 1.5,
): void {
  const center = new THREE.Vector3();
  bounds.getCenter(center);
  const size = new THREE.Vector3();
  bounds.getSize(size);
  const radius = Math.max(size.x, size.y, size.z) * 0.5 * marginFactor;
  const fovRad = (camera.fov * Math.PI) / 180;
  const distance = radius / Math.sin(fovRad / 2);

  const dir = new THREE.Vector3(
    Math.cos(elevation) * Math.cos(azimuth),
    Math.cos(elevation) * Math.sin(azimuth),
    Math.sin(elevation),
  );
  camera.position.copy(center).addScaledVector(dir, distance);
  camera.lookAt(center);
  camera.near = Math.max(0.1, distance * 0.01);
  camera.far = distance * 10;
  camera.updateProjectionMatrix();
}

function buildBackground(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 2;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, `#${SCENE.backgroundTop.toString(16).padStart(6, "0")}`);
  grad.addColorStop(
    1,
    `#${SCENE.backgroundBottom.toString(16).padStart(6, "0")}`,
  );
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 2, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function setupSceneLights(scene: THREE.Scene): void {
  scene.add(
    new THREE.AmbientLight(LIGHTING.ambient.color, LIGHTING.ambient.intensity),
  );
  scene.add(
    new THREE.HemisphereLight(
      LIGHTING.hemisphereTop,
      LIGHTING.hemisphereBottom,
      LIGHTING.hemisphereIntensity,
    ),
  );
  const key = new THREE.DirectionalLight(
    LIGHTING.keyLight.color,
    LIGHTING.keyLight.intensity,
  );
  key.position.set(...LIGHTING.keyLight.position);
  scene.add(key);
  const fill = new THREE.DirectionalLight(
    LIGHTING.fillLight.color,
    LIGHTING.fillLight.intensity,
  );
  fill.position.set(...LIGHTING.fillLight.position);
  scene.add(fill);
}

export const CaseStudyView: React.FC<CaseStudyViewProps> = ({
  stage,
  caseName,
  caseDescription,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneObjectsRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    bg: THREE.CanvasTexture;
    elementGroup: THREE.Group | null;
  } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    window.__caseStudyReady = false;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    const bg = buildBackground();
    scene.background = bg;
    setupSceneLights(scene);

    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 5000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    sceneObjectsRef.current = {
      scene,
      camera,
      renderer,
      bg,
      elementGroup: null,
    };

    const handleResize = () => {
      if (!container || !sceneObjectsRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      sceneObjectsRef.current.renderer.setSize(w, h);
      sceneObjectsRef.current.camera.aspect = w / h;
      sceneObjectsRef.current.camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      const objs = sceneObjectsRef.current;
      sceneObjectsRef.current = null;
      if (!objs) return;
      if (objs.elementGroup) disposeObject3D(objs.elementGroup);
      objs.bg.dispose();
      objs.renderer.dispose();
      if (objs.renderer.domElement.parentElement === container) {
        container.removeChild(objs.renderer.domElement);
      }
    };
  }, []);

  useEffect(() => {
    const objs = sceneObjectsRef.current;
    if (!objs) return;
    const { scene, camera, renderer } = objs;

    if (objs.elementGroup) {
      scene.remove(objs.elementGroup);
      disposeObject3D(objs.elementGroup);
      objs.elementGroup = null;
    }

    const el = stage.element;
    let group: THREE.Group;
    if (el.faceGeometry) {
      group = createMeshFromGeometry(el.faceGeometry, el.edgeGeometry);
    } else {
      group = createMeshFromBrep(el.brep);
    }
    group.position.copy(el.position);
    if (el.rotation) group.rotation.copy(el.rotation);
    scene.add(group);
    objs.elementGroup = group;

    const bounds = new THREE.Box3().setFromObject(group);
    if (!bounds.isEmpty()) {
      // Classic isometric: az = 45°, el = arctan(1/√2) ≈ 35.26°.
      // Equal foreshortening on all three axes.
      frameCameraToBounds(
        camera,
        bounds,
        Math.PI / 4,
        Math.atan(1 / Math.sqrt(2)),
        1.4,
      );
    }

    renderer.render(scene, camera);
    requestAnimationFrame(() => {
      renderer.render(scene, camera);
      window.__caseStudyReady = true;
    });
  }, [stage]);

  // Append `?label=1` to the URL to show the in-image label panel; otherwise
  // the viewport renders clean for screenshot capture.
  const showLabel =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("label") === "1";

  return (
    <div style={styles.page}>
      <div ref={containerRef} style={styles.viewport} />
      {showLabel && (
        <div style={styles.overlay}>
          <h1 style={styles.title}>{caseName}</h1>
          <p style={styles.caseDescription}>{caseDescription}</p>
          <h2 style={styles.stageLabel}>{stage.label}</h2>
          {stage.description && (
            <p style={styles.stageDescription}>{stage.description}</p>
          )}
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    position: "fixed",
    inset: 0,
    display: "flex",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  viewport: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
  },
  overlay: {
    position: "absolute",
    top: 16,
    left: 16,
    maxWidth: 320,
    padding: "10px 14px",
    background: "rgba(255,255,255,0.85)",
    borderRadius: 4,
    border: "1px solid #d8d8d8",
    fontSize: 13,
    color: "#222",
    pointerEvents: "none",
  },
  title: {
    fontSize: 16,
    margin: 0,
    marginBottom: 4,
  },
  caseDescription: {
    fontSize: 12,
    color: "#666",
    margin: 0,
    marginBottom: 8,
  },
  stageLabel: {
    fontSize: 14,
    margin: 0,
    marginBottom: 4,
    fontWeight: 600,
  },
  stageDescription: {
    fontSize: 12,
    color: "#444",
    margin: 0,
  },
};
