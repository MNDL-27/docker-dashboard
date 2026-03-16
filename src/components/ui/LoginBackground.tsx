import { useEffect, useRef } from "react";
import * as THREE from "three";

export function LoginBackground() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Check pre-reduced motion preference
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const prefersReducedMotion = mediaQuery.matches;

    // Determine particle count based on screen width
    // Capping at 800 to keep it very subtle and performant (user requested 600-1000)
    const particleCount = window.innerWidth < 768 ? 400 : 800;

    // 1. Scene Setup
    const scene = new THREE.Scene();

    // 2. Camera Setup
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.z = 40;

    // 3. Renderer Setup (Transparent background)
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "low-power",
    });
    // Limit pixel ratio for performance
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    containerRef.current.appendChild(renderer.domElement);

    // 4. Geometry & Particles
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    // Distribute particles in a wide 3D sphere/cloud
    for (let i = 0; i < particleCount * 3; i += 3) {
      // Create a spherical distribution cluster
      const radius = 100 * Math.cbrt(Math.random());
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.acos(2 * Math.random() - 1);

      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);

      positions[i] = x;
      positions[i + 1] = y;
      positions[i + 2] = z;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    // 5. Material
    // User constraint: muted cyan / blue-tinted white, low contrast, very low opacity
    const material = new THREE.PointsMaterial({
      size: 0.25,
      color: 0x88ccff, // Muted cyan/blue-tinted white
      transparent: true,
      opacity: 0.15, // Very low opacity to sit quietly behind
      blending: THREE.AdditiveBlending,
      depthWrite: false, // Prevents depth sorting issues with transparent particles
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // 6. Animation & Mouse Parallax Constraints
    let animationFrameId: number;
    let targetX = 0;
    let targetY = 0;
    
    // Using simple variables mapped inside the event listener to respect resizing
    let windowHalfX = window.innerWidth / 2;
    let windowHalfY = window.innerHeight / 2;

    const onDocumentMouseMove = (event: MouseEvent) => {
      if (prefersReducedMotion) return;
      // Very gentle parallax influence (10% of standard effect)
      targetX = (event.clientX - windowHalfX) * 0.02;
      targetY = (event.clientY - windowHalfY) * 0.02;
    };

    const onWindowResize = () => {
      windowHalfX = window.innerWidth / 2;
      windowHalfY = window.innerHeight / 2;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener("resize", onWindowResize, false);
    document.addEventListener("mousemove", onDocumentMouseMove, false);

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Natural slow drift
      if (!prefersReducedMotion) {
        particles.rotation.x += 0.0002;
        particles.rotation.y += 0.0004;

        // Gentle camera parallax smoothing
        camera.position.x += (targetX - camera.position.x) * 0.02;
        camera.position.y += (-targetY - camera.position.y) * 0.02;
        camera.lookAt(scene.position);
      }

      renderer.render(scene, camera);
    };

    animate();

    // Store DOM node reference for reliable cleanup
    const containerNode = containerRef.current;

    // 7. Cleanup
    return () => {
      window.removeEventListener("resize", onWindowResize);
      document.removeEventListener("mousemove", onDocumentMouseMove);
      cancelAnimationFrame(animationFrameId);

      // Clean up Three.js objects
      geometry.dispose();
      material.dispose();
      renderer.dispose();

      if (containerNode && containerNode.contains(renderer.domElement)) {
        containerNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-0 overflow-hidden pointer-events-none"
      aria-hidden="true"
    />
  );
}
