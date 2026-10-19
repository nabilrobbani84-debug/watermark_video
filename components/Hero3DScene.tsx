'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export function Hero3DScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasWebGL] = useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      const canvas = document.createElement('canvas');
      return Boolean(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!hasWebGL) return;

    const container = containerRef.current;
    if (!container) return;

    // Detect headless / reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isHeadless = /HeadlessChrome/i.test(navigator.userAgent);

    const width = container.clientWidth || 500;
    const height = container.clientHeight || 400;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 5.5);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: !isHeadless,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isHeadless ? 1 : 1.5));
    container.appendChild(renderer.domElement);

    // Group for rotation and parallax
    const frameGroup = new THREE.Group();
    scene.add(frameGroup);

    // Video frame box (16:9 proportions: width 3.2, height 1.8, depth 0.08)
    const frameGeometry = new THREE.BoxGeometry(3.2, 1.8, 0.08);
    const frameMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x12172b,
      metalness: 0.85,
      roughness: 0.25,
      transparent: true,
      opacity: 0.88,
      reflectivity: 0.7,
      clearcoat: 0.3,
    });
    const frameMesh = new THREE.Mesh(frameGeometry, frameMaterial);
    frameGroup.add(frameMesh);

    // Glowing border outline
    const edges = new THREE.EdgesGeometry(frameGeometry);
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x8b5cf6,
      linewidth: 2,
      transparent: true,
      opacity: 0.75,
    });
    const wireframe = new THREE.LineSegments(edges, lineMaterial);
    frameGroup.add(wireframe);

    // Holographic inner screen plane
    const screenGeo = new THREE.PlaneGeometry(3.05, 1.65);
    const screenMat = new THREE.MeshBasicMaterial({
      color: 0x161c36,
      transparent: true,
      opacity: 0.65,
    });
    const screenMesh = new THREE.Mesh(screenGeo, screenMat);
    screenMesh.position.z = 0.045;
    frameGroup.add(screenMesh);

    // Scanning laser beam
    const beamGeo = new THREE.BoxGeometry(3.1, 0.03, 0.02);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.85,
    });
    const beamMesh = new THREE.Mesh(beamGeo, beamMat);
    beamMesh.position.z = 0.055;
    frameGroup.add(beamMesh);

    // Holographic particle cluster
    const particleCount = isHeadless ? 30 : 75;
    const particleGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 6;
      positions[i + 1] = (Math.random() - 0.5) * 4;
      positions[i + 2] = (Math.random() - 0.5) * 3;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0xa78bfa,
      size: 0.04,
      transparent: true,
      opacity: 0.7,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0x8b5cf6, 2.5, 10);
    pointLight.position.set(2, 2, 3);
    scene.add(pointLight);

    const cyanLight = new THREE.PointLight(0x22d3ee, 2.0, 10);
    cyanLight.position.set(-2, -2, 2);
    scene.add(cyanLight);

    // Mouse parallax tracking
    let targetRotationX = 0;
    let targetRotationY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      targetRotationY = x * 0.4;
      targetRotationX = -y * 0.3;
    };

    window.addEventListener('mousemove', handleMouseMove);

    // Animation loop
    let animationId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      if (!prefersReducedMotion) {
        // Floating frame idle oscillation
        frameGroup.rotation.y += (targetRotationY - frameGroup.rotation.y) * 0.05;
        frameGroup.rotation.x += (targetRotationX - frameGroup.rotation.x) * 0.05;
        frameGroup.position.y = Math.sin(elapsedTime * 1.5) * 0.08;

        // Scanning beam movement
        beamMesh.position.y = Math.sin(elapsedTime * 2.2) * 0.75;

        // Orbiting particles rotation
        particles.rotation.y = elapsedTime * 0.06;
      }

      renderer.render(scene, camera);
    };

    animate();

    // Handle container resize
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      frameGeometry.dispose();
      frameMaterial.dispose();
      lineMaterial.dispose();
      screenGeo.dispose();
      screenMat.dispose();
      beamGeo.dispose();
      beamMat.dispose();
      particleGeo.dispose();
      particleMat.dispose();
    };
  }, [hasWebGL]);

  if (!hasWebGL) {
    // Accessible fallback card for devices without WebGL
    return (
      <div className="relative w-full h-[360px] sm:h-[420px] rounded-2xl border border-white/10 bg-[#101322] flex flex-col items-center justify-center p-6 text-center shadow-2xl">
        <div className="w-16 h-16 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center mb-4">
          <div className="w-8 h-8 rounded-lg border-2 border-dashed border-violet-400" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-1">Precision Reconstruction</h3>
        <p className="text-sm text-slate-400 max-w-xs">
          Original resolution preserved with boundary pixel interpolation.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[360px] sm:h-[440px] flex items-center justify-center pointer-events-none"
      aria-label="3D Floating Video Reconstruction Frame"
    />
  );
}
