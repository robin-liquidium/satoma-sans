import * as THREE from "three/webgpu";
import {
  normalView,
  pass,
  positionLocal,
  positionViewDirection,
  pow,
} from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";
import { toCreasedNormals } from "three/addons/utils/BufferGeometryUtils.js";
import { tslExports } from "vgpu/three";
import glassModule from "./glass.wgsl";
import { createDust } from "./dust";
import { buildOutline, createLightBeams } from "./light-beams";

type Inputs = { position: THREE.Node };

const BACKDROP_Z = -3;
const REST = { x: 0.08, y: -0.3, z: -0.05 };
const INTRO_SECONDS = 2.6;
// White light from the upper right, the spectrum leaving toward the lower left.
const REST_AIM = { angle: 3.45, x: 1, y: 0.6 };

/** A dark studio with a few soft light panels: the glass only reads where it
 * reflects something bright, so the panels draw its edges and bevels. */
function studio() {
  const room = new THREE.Scene();
  room.background = new THREE.Color(0x020203);
  const panel = (
    w: number,
    h: number,
    intensity: number,
    tint: number,
    position: [number, number, number],
  ) => {
    const material = new THREE.MeshBasicNodeMaterial({
      color: new THREE.Color(tint).multiplyScalar(intensity),
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
    mesh.position.set(...position);
    mesh.lookAt(0, 0, 0);
    room.add(mesh);
  };
  panel(14, 2.4, 6, 0xffffff, [0, 9, 2]); // overhead strip
  panel(2.2, 12, 5, 0xf2f6ff, [-9, 0, 5]); // cool left rim
  panel(1.4, 10, 7, 0xfff3e8, [9, 1, 3]); // warm right key, matches the beam
  panel(5, 9, 3.2, 0xffffff, [5, 3, 9]); // soft front fill, off axis
  panel(3, 3, 2, 0xe8f0ff, [-6, -4, 8]); // low cool kicker
  panel(4, 3, 1.4, 0xffffff, [-5, 7, 7]); // high left, lifts the upper bowl
  panel(10, 1.2, 2.5, 0xdfe8ff, [0, -8, -4]); // floor bounce from behind
  return room;
}

export async function mountSculpture(canvas: HTMLCanvasElement) {
  if (!navigator.gpu)
    throw new Error("WebGPU unavailable; showing static letterform");
  const stage = canvas.parentElement!;
  const hero = stage.closest<HTMLElement>(".hero")!;
  const word = hero.querySelector<HTMLElement>(".hero-word")!;
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true });
  await renderer.init();
  renderer.setPixelRatio(
    Math.min(devicePixelRatio, innerWidth < 700 ? 1.5 : 1.75),
  );
  renderer.setClearColor(0x000000, 1);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 14);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = studio();
  const environment = pmrem.fromScene(room, 0.02);
  room.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      object.material.dispose();
    }
  });
  scene.environment = environment.texture;
  scene.environmentIntensity = 1.5;

  // The wordmark lives inside the scene so the glass genuinely refracts it.
  // Its rectangle mirrors the HTML heading, which stays for layout and a11y.
  const textCanvas = document.createElement("canvas");
  const textTexture = new THREE.CanvasTexture(textCanvas);
  textTexture.colorSpace = THREE.SRGBColorSpace;
  textTexture.anisotropy = 8;
  const backdropMaterial = new THREE.MeshBasicNodeMaterial({
    map: textTexture,
  });
  const backdropGeometry = new THREE.PlaneGeometry(1, 1);
  const backdrop = new THREE.Mesh(backdropGeometry, backdropMaterial);
  backdrop.position.z = BACKDROP_Z;
  scene.add(backdrop);

  const data = await new SVGLoader().loadAsync("/satoma-s.svg");
  const shapes = data.paths.flatMap((path) => path.toShapes());
  // Extrusions come out flat-shaded: every bevel ring is its own facet, and
  // refraction turns those normal jumps into stair-steps. Smooth curves and
  // bevels, but keep the sharp terminal corners crisp.
  const extruded = new THREE.ExtrudeGeometry(shapes, {
    depth: 150,
    bevelEnabled: true,
    bevelSegments: 12,
    steps: 1,
    bevelSize: 18,
    bevelThickness: 22,
    curveSegments: 48,
  });
  const geometry = toCreasedNormals(extruded, Math.PI / 6);
  extruded.dispose();
  geometry.scale(0.008, 0.008, 0.008);
  geometry.computeBoundingBox();
  const center = geometry.boundingBox!.getCenter(new THREE.Vector3());
  const size = geometry.boundingBox!.getSize(new THREE.Vector3());
  geometry.translate(-center.x, -center.y, -center.z);
  // The beam is traced through the glyph's own cross-section at mid-depth,
  // where the bevel has pushed the side walls out by its full size.
  const outline = buildOutline(
    shapes.map((shape) => {
      const { shape: outer, holes } = shape.extractPoints(24);
      // The light plane undoes the letter's mirror, so trace with y up.
      const local = (p: THREE.Vector2) => ({
        x: p.x * 0.008 - center.x,
        y: center.y - p.y * 0.008,
      });
      return { outer: outer.map(local), holes: holes.map((h) => h.map(local)) };
    }),
    18 * 0.008,
  );
  const { glassRoughness } = tslExports<{ glassRoughness: Inputs }>(
    glassModule,
  )("glassRoughness");
  const material = new THREE.MeshPhysicalNodeMaterial({
    color: 0xffffff,
    metalness: 0,
    transmission: 1,
    ior: 1.5,
    thickness: 2.2,
    dispersion: 6,
    attenuationColor: new THREE.Color(0xf3f8ff),
    attenuationDistance: 9,
    specularIntensity: 1,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
  });
  // Steep bevels refract neighbouring pixels to distant parts of the
  // backdrop, which stair-steps. A touch of roughness only at grazing angles
  // makes Three sample a slightly blurred backdrop exactly there.
  const grazing = pow(
    normalView.dot(positionViewDirection).abs().oneMinus(),
    2,
  );
  material.roughnessNode = glassRoughness({ position: positionLocal }).add(
    grazing.mul(0.35),
  );
  const letter = new THREE.Mesh(geometry, material);
  // Mirror at object level so Three also flips face winding for the SVG Y axis.
  letter.scale.y = -1;
  letter.rotation.set(REST.x, REST.y, REST.z);
  // The intro turns this pivot, leaving the letter's own pose to the pointer.
  const pivot = new THREE.Group();
  pivot.add(letter);
  scene.add(pivot);
  const home = letter.quaternion.clone();
  const lightPlane = new THREE.Object3D();
  lightPlane.scale.y = -1;
  letter.add(lightPlane);
  const beams = createLightBeams(lightPlane, outline, REST_AIM);
  const dust = createDust(lightPlane, beams);

  const pipeline = new THREE.RenderPipeline(renderer);
  const scenePass = pass(scene, camera);
  const color = scenePass.getTextureNode("output");
  pipeline.outputNode = color.add(bloom(color, 0.4, 0.55, 0.85));

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  // Intro: the glass turns in from edge-on, then the light switches on.
  let intro = reduced.matches ? 1 : 0;
  const applyIntro = () => {
    const turn = Math.min(1, intro / 0.6);
    const settle = 1 - (1 - turn) ** 4;
    pivot.rotation.y = (1 - settle) * -1.5;
    pivot.position.y = (1 - settle) * -0.6;
    pivot.scale.setScalar(0.9 + 0.1 * settle);
    beams.reveal = Math.min(1, Math.max(0, (intro - 0.4) / 0.6));
  };
  applyIntro();
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
    hero.classList.add("no-gpu");
    canvas.removeAttribute("tabindex");
    canvas.setAttribute("aria-hidden", "true");
  };
  const draw = (dt = Infinity) => {
    if (!disposed) {
      beams.update(dt);
      // Dust drifts on its own clock; reduced motion keeps it still.
      dust.update(reduced.matches ? 0 : elapsed, beams.reveal);
      pipeline.render();
    }
  };
  const tick = (now: number) => {
    frame = 0;
    if (disposed || !visible || document.hidden) return;
    const settling = letter.quaternion.angleTo(target) > 0.0005;
    // With motion allowed the dust keeps drifting; otherwise rest once settled.
    if (reduced.matches && !settling && !beams.settling) return;
    const dt = Math.min((now - previous) / 1000, 0.05);
    elapsed += dt;
    previous = now;
    if (intro < 1) {
      intro = Math.min(1, intro + dt / INTRO_SECONDS);
      applyIntro();
    }
    if (!interacted && !reduced.matches) {
      rotation.set(REST.x, REST.y + Math.sin(elapsed * 0.3) * 0.08, REST.z);
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
  // The word scales uniformly with the viewport, so one texture fits every
  // size; later layouts only move the plane.
  let wordDrawn = false;
  const drawWord = (box: DOMRect) => {
    wordDrawn = true;
    const style = getComputedStyle(word);
    const scale = Math.min(renderer.getPixelRatio() * 1.25, 4096 / box.width);
    textCanvas.width = Math.ceil(box.width * scale);
    textCanvas.height = Math.ceil(box.height * scale);
    const ctx = textCanvas.getContext("2d")!;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, textCanvas.width, textCanvas.height);
    ctx.font = `${style.fontStyle} ${style.fontWeight} ${parseFloat(style.fontSize) * scale}px "Satoma Sans"`;
    ctx.letterSpacing = `${(parseFloat(style.letterSpacing) || 0) * scale}px`;
    ctx.fillStyle = style.color;
    // Place the baseline exactly where CSS inline layout does.
    const metrics = ctx.measureText(word.textContent!);
    const ascent = metrics.fontBoundingBoxAscent;
    const content = ascent + metrics.fontBoundingBoxDescent;
    ctx.fillText(
      word.textContent!,
      0,
      (box.height * scale - content) / 2 + ascent,
    );
    textTexture.needsUpdate = true;
  };
  const layoutBackdrop = (stageBox: DOMRect) => {
    const box = word.getBoundingClientRect();
    if (!wordDrawn) drawWord(box);
    // Map the heading's screen rectangle onto the plane behind the glass.
    const depth = camera.position.z - BACKDROP_Z;
    const halfHeight =
      depth * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const halfWidth = halfHeight * camera.aspect;
    const ndc = (x: number, y: number) => [
      ((x - stageBox.left) / stageBox.width) * 2 - 1,
      1 - ((y - stageBox.top) / stageBox.height) * 2,
    ];
    const [left, top] = ndc(box.left, box.top);
    const [right, bottom] = ndc(box.right, box.bottom);
    backdrop.position.set(
      ((left + right) / 2) * halfWidth,
      ((top + bottom) / 2) * halfHeight,
      BACKDROP_Z,
    );
    backdrop.scale.set(
      (right - left) * halfWidth,
      (top - bottom) * halfHeight,
      1,
    );
  };
  const resize = () => {
    const box = stage.getBoundingClientRect();
    renderer.setSize(box.width, box.height, false);
    camera.aspect = box.width / box.height;
    // Fit the S to the stage: tall on landscape, width-bound on portrait.
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    camera.position.z = Math.max(
      size.y / (0.66 * 2 * tan),
      size.x / (0.62 * 2 * tan * camera.aspect),
    );
    camera.updateProjectionMatrix();
    layoutBackdrop(box);
    draw();
  };
  // Pointer height tilts the beam and slides it along the letter; the whole
  // range keeps the white-in, spectrum-out composition intact.
  const aimFor = (x: number, y: number) => ({
    angle: REST_AIM.angle + y * 0.2,
    x: REST_AIM.x - x * 0.4,
    y: REST_AIM.y + y * 0.6,
  });
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
    // The mouse steers the light; the letter only leans toward it.
    rotation.set(REST.x + y * 0.3, REST.y + x * 0.5, REST.z);
    target.setFromEuler(rotation);
    beams.aim(aimFor(x, y));
    if (!frame) resume();
  };
  const resetRotation = () => {
    interacted = true;
    cancelAnimationFrame(frame);
    frame = 0;
    target.copy(home);
    letter.quaternion.copy(home);
    letter.position.y = 0;
    beams.aim(aimFor(0, 0));
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
  // Measure the heading only once its entrance has finished moving it.
  await Promise.all(
    word.getAnimations().map((animation) => animation.finished),
  );
  await document.fonts.load(
    `${getComputedStyle(word).fontWeight} 100px "Satoma Sans"`,
    word.textContent!,
  );
  resize();
  await renderer.compileAsync(scene, camera);
  draw();
  stage.classList.add("ready");
  resizing.observe(stage);
  resizing.observe(word);
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
    backdropGeometry.dispose();
    backdropMaterial.dispose();
    textTexture.dispose();
    beams.dispose();
    dust.dispose();
    pipeline.dispose();
    environment.dispose();
    pmrem.dispose();
    renderer.dispose();
  });
}
