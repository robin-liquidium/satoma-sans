import * as THREE from "three/webgpu";
import { positionLocal } from "three/tsl";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";
import { tslExports } from "vgpu/three";
import glassModule from "./glass.wgsl";
import { createLightBeams } from "./light-beams";

type Inputs = { position: THREE.Node };

export async function mountSculpture(canvas: HTMLCanvasElement) {
  if (!navigator.gpu)
    throw new Error("WebGPU unavailable; showing static letterform");
  const stage = canvas.parentElement!;
  const hero = stage.closest<HTMLElement>(".hero")!;
  const renderer = new THREE.WebGPURenderer({
    canvas,
    alpha: true,
    antialias: true,
  });
  await renderer.init();
  renderer.setPixelRatio(
    Math.min(devicePixelRatio, innerWidth < 700 ? 1.25 : 1.5),
  );
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 0, 13);

  // Studio light strips reveal the glass edges without changing the black page.
  const studio = document.createElement("canvas");
  studio.width = 1024;
  studio.height = 512;
  const ctx = studio.getContext("2d")!;
  ctx.fillStyle = "#08090c";
  ctx.fillRect(0, 0, 1024, 512);
  ctx.fillStyle = "#101217";
  ctx.fillRect(160, 0, 170, 512);
  ctx.fillRect(780, 0, 80, 512);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(40, 40, 110, 400);
  ctx.fillRect(520, 110, 250, 110);
  ctx.fillStyle = "#aab8d4";
  ctx.fillRect(870, 100, 45, 360);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(330, 290, 75, 190);
  const envTexture = new THREE.CanvasTexture(studio);
  envTexture.mapping = THREE.EquirectangularReflectionMapping;
  envTexture.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromEquirectangular(envTexture);
  scene.environment = environment.texture;
  scene.environmentIntensity = 3;
  const key = new THREE.DirectionalLight(0xffffff, 3);
  key.position.set(3, 5, 7);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xddeaff, 2);
  rim.position.set(-4, -2, 3);
  scene.add(rim);
  const data = await new SVGLoader().loadAsync("/satoma-s.svg");
  const shapes = data.paths.flatMap((path) => path.toShapes());
  const geometry = new THREE.ExtrudeGeometry(shapes, {
    depth: 115,
    bevelEnabled: true,
    bevelSegments: 8,
    steps: 1,
    bevelSize: 13,
    bevelThickness: 13,
    curveSegments: 32,
  });
  geometry.scale(0.008, 0.008, 0.008);
  geometry.center();
  const { glassRoughness } = tslExports<{ glassRoughness: Inputs }>(
    glassModule,
  )("glassRoughness");
  const material = new THREE.MeshPhysicalNodeMaterial({
    color: 0xffffff,
    metalness: 0,
    transmission: 1,
    ior: 1.52,
    thickness: 1.15,
    dispersion: 4,
    attenuationColor: new THREE.Color(0xeaf5ff),
    attenuationDistance: 7,
    clearcoat: 0.25,
    clearcoatRoughness: 0.035,
  });
  material.roughnessNode = glassRoughness({ position: positionLocal });
  const letter = new THREE.Mesh(geometry, material);
  // Mirror at object level so Three also flips face winding for the SVG Y axis.
  letter.scale.y = -1;
  letter.rotation.set(0.1, -0.4, -0.12);
  scene.add(letter);
  const home = letter.quaternion.clone();
  const beams = createLightBeams(scene, letter, camera);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  let visible = true;
  let disposed = false;
  let frame = 0;
  let previous = 0;
  let elapsed = 0;
  let interacted = false;
  const target = home.clone();
  const rotation = new THREE.Euler();
  renderer.onDeviceLost = () => {
    disposed = true;
    cancelAnimationFrame(frame);
    stage.classList.remove("ready");
    canvas.removeAttribute("tabindex");
    canvas.setAttribute("aria-hidden", "true");
  };
  const draw = (dt = Infinity) => {
    if (!disposed) {
      beams.update(dt);
      renderer.render(scene, camera);
    }
  };
  const tick = (now: number) => {
    frame = 0;
    if (disposed || !visible || document.hidden) return;
    const settling = letter.quaternion.angleTo(target) > 0.0005;
    if ((reduced.matches || interacted) && !settling && !beams.settling) return;
    const dt = Math.min((now - previous) / 1000, 0.05);
    elapsed += dt;
    previous = now;
    if (!interacted && !reduced.matches) {
      rotation.set(0.1, -0.4 + Math.sin(elapsed * 0.3) * 0.18, -0.12);
      target.setFromEuler(rotation);
      letter.position.y = Math.sin(elapsed * 0.6) * 0.12;
    }
    // Time-based easing behaves consistently at 60 Hz and high refresh rates.
    letter.quaternion.slerp(target, 1 - Math.exp(-10 * dt));
    if (letter.quaternion.angleTo(target) < 0.0005)
      letter.quaternion.copy(target);
    draw(dt);
    frame = requestAnimationFrame(tick);
  };
  const resume = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    previous = performance.now();
    if (visible && !document.hidden && !disposed)
      frame = requestAnimationFrame(tick);
  };
  const resize = () => {
    const { width, height, top } = stage.getBoundingClientRect();
    const above = Math.max(0, top - hero.getBoundingClientRect().top);
    canvas.style.top = `${-above}px`;
    canvas.style.height = `${height + above}px`;
    renderer.setSize(width, height + above, false);
    camera.position.z = width < 700 ? 15 : 13;
    // Extend the frustum upward, preserving the original stage's scale/center.
    camera.setViewOffset(width, height, 0, -above, width, height + above);
    draw();
  };
  const onPointerMove = (e: PointerEvent) => {
    if (e.pointerType === "touch" || !visible || disposed) return;
    const box = stage.getBoundingClientRect();
    const x = THREE.MathUtils.clamp(
      (e.clientX - box.left) / box.width - 0.5,
      -0.5,
      0.5,
    );
    const y = THREE.MathUtils.clamp(
      (e.clientY - box.top) / box.height - 0.5,
      -0.5,
      0.5,
    );
    interacted = true;
    rotation.set(0.1 + y * 1.8, -0.4 + x * 4, -0.12);
    target.setFromEuler(rotation);
    if (!frame) resume();
  };
  const resetRotation = () => {
    interacted = true;
    cancelAnimationFrame(frame);
    frame = 0;
    target.copy(home);
    letter.quaternion.copy(home);
    letter.position.y = 0;
    draw();
  };
  const onKey = (e: KeyboardEvent) => {
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-0.15, 0],
      ArrowRight: [0.15, 0],
      ArrowUp: [0, -0.15],
      ArrowDown: [0, 0.15],
    };
    if (e.key === "Home") {
      e.preventDefault();
      resetRotation();
    } else if (delta[e.key]) {
      e.preventDefault();
      interacted = true;
      rotation.set(delta[e.key][1], delta[e.key][0], 0);
      target.premultiply(new THREE.Quaternion().setFromEuler(rotation));
      resume();
    }
  };
  const intersection = new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    resume();
  });
  const resizing = new ResizeObserver(resize);
  await renderer.compileAsync(scene, camera);
  resize();
  stage.classList.add("ready");
  resizing.observe(stage);
  resizing.observe(hero);
  intersection.observe(canvas);
  canvas.tabIndex = 0;
  canvas.setAttribute(
    "aria-label",
    "Refractive glass S. Move your mouse or use arrow keys to rotate. Press Home or double-click to reset.",
  );
  hero.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("dblclick", resetRotation);
  canvas.addEventListener("keydown", onKey);
  reduced.addEventListener("change", resume);
  document.addEventListener("visibilitychange", resume);
  resume();
  window.addEventListener("pagehide", (event) => {
    if (event.persisted) return;
    disposed = true;
    cancelAnimationFrame(frame);
    resizing.disconnect();
    intersection.disconnect();
    reduced.removeEventListener("change", resume);
    document.removeEventListener("visibilitychange", resume);
    hero.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("dblclick", resetRotation);
    canvas.removeEventListener("keydown", onKey);
    geometry.dispose();
    material.dispose();
    beams.dispose();
    environment.dispose();
    envTexture.dispose();
    pmrem.dispose();
    renderer.dispose();
  });
}
