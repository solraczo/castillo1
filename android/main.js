import * as THREE from 'https://solraczo.github.io/castillo1/android/libs/three.module.js';
import { ARButton } from 'https://solraczo.github.io/castillo1/android/libs/ARButton.js';
import { GLTFLoader } from 'https://solraczo.github.io/castillo1/android/libs/GLTFLoader.js';
import { RGBELoader } from 'https://solraczo.github.io/castillo1/android/libs/RGBELoader.js';

let mixerGLTF;
let actionsGLTF = {};
let clock = new THREE.Clock();
let modelLoaded = false;
const animationSpeed = 1;

let model;
let placed = false;
let hitTestSource = null;

// Escena, cámara y renderizador
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 100);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.5;
renderer.outputEncoding = THREE.sRGBEncoding;
document.body.appendChild(renderer.domElement);

// Verificar soporte de WebXR
if ('xr' in navigator) {
    navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
        if (supported) {
            const arButton = ARButton.createButton(renderer, { requiredFeatures: ['hit-test'] });
            arButton.classList.add('custom-ar-button');
            document.body.appendChild(arButton);

            renderer.xr.addEventListener('sessionend', () => {
                hitTestSource = null;
                placed = false;
            });
        } else {
            alert('WebXR AR no es soportado en este dispositivo.');
        }
    }).catch((error) => {
        console.error('Error al verificar soporte de WebXR AR:', error);
    });
} else {
    alert('WebXR no está disponible en este navegador.');
}

// Iluminación
scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const light = new THREE.PointLight(0xffffff, 0.2);
light.position.set(0, 0.2, 0.2);
scene.add(light);

// HDRI
new RGBELoader().load(
    'https://solraczo.github.io/castillo1/android/models/brown_photostudio_02_2k.hdr',
    (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        scene.environment = texture;
        scene.background = null;
        console.log('HDRI cargado correctamente.');
    },
    undefined,
    (error) => console.error('Error al cargar HDRI:', error)
);

// Cargar modelo GLTF
new GLTFLoader().load(
    'https://solraczo.github.io/castillo1/android/models/prueba1.gltf',
    (gltf) => {
        model = gltf.scene;
        model.scale.set(1, 1, 1);
        model.visible = false;
        scene.add(model);

        mixerGLTF = new THREE.AnimationMixer(model);
        gltf.animations.forEach((clip) => {
            const action = mixerGLTF.clipAction(clip);
            action.setLoop(THREE.LoopRepeat);
            action.timeScale = animationSpeed;
            action.play();
            actionsGLTF[clip.name] = action;
        });

        modelLoaded = true;
        console.log('Modelo cargado con animaciones:', Object.keys(actionsGLTF));
    },
    (xhr) => console.log('GLTF loaded:', (xhr.loaded / xhr.total) * 100 + '%'),
    (error) => console.error('Error al cargar modelo:', error)
);

// Loop de renderizado con hit-test
renderer.setAnimationLoop((timestamp, frame) => {
    const delta = clock.getDelta();
    if (mixerGLTF) mixerGLTF.update(delta * animationSpeed);

    if (frame && !placed && model) {
        const session = renderer.xr.getSession();
        const refSpace = renderer.xr.getReferenceSpace();

        if (!hitTestSource) {
            session.requestReferenceSpace('viewer').then((viewerSpace) => {
                session.requestHitTestSource({ space: viewerSpace }).then((source) => {
                    hitTestSource = source;
                });
            });
        }

        if (hitTestSource) {
            const hitTestResults = frame.getHitTestResults(hitTestSource);
            if (hitTestResults.length > 0) {
                const hit = hitTestResults[0];
                const pose = hit.getPose(refSpace);
                if (pose) {
                    model.visible = true;
                    model.position.set(
                        pose.transform.position.x,
                        pose.transform.position.y,
                        pose.transform.position.z
                    );
                }
            }
        }
    }

    renderer.render(scene, camera);
});

// Fijar modelo al tocar por primera vez
renderer.domElement.addEventListener('touchend', (event) => {
    if (!placed && model && model.visible) {
        placed = true;
        console.log('Modelo colocado.');
    }
}, false);

// Gestos táctiles para mover, rotar, escalar
let isTouching = false;
let previousTouches = [];

renderer.domElement.addEventListener('touchstart', (event) => {
    if (modelLoaded && placed) {
        isTouching = true;
        previousTouches = [...event.touches];
    }
}, false);

renderer.domElement.addEventListener('touchmove', (event) => {
    if (!isTouching || !model || !placed) return;

    if (event.touches.length === 1 && previousTouches.length === 1) {
        // Rotar
        const deltaX = event.touches[0].clientX - previousTouches[0].clientX;
        model.rotation.y += deltaX * 0.005;
    } else if (event.touches.length === 2 && previousTouches.length === 2) {
        // Escalar
        const prevDist = Math.hypot(
            previousTouches[0].clientX - previousTouches[1].clientX,
            previousTouches[0].clientY - previousTouches[1].clientY
        );
        const currDist = Math.hypot(
            event.touches[0].clientX - event.touches[1].clientX,
            event.touches[0].clientY - event.touches[1].clientY
        );
        const scaleDelta = (currDist - prevDist) * 0.005;
        const newScale = model.scale.x + scaleDelta;
        model.scale.setScalar(Math.max(0.1, Math.min(5, newScale)));

        // Mover en X
        const moveDeltaX = ((event.touches[0].clientX + event.touches[1].clientX) / 2 -
                            (previousTouches[0].clientX + previousTouches[1].clientX) / 2) * 0.001;
        model.position.x += moveDeltaX;
    }

    previousTouches = [...event.touches];
}, false);

renderer.domElement.addEventListener('touchend', () => {
    isTouching = false;
}, false);
