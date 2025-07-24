import * as THREE from 'https://solraczo.github.io/castillo1/android/libs/three.module.js';
import { ARButton } from 'https://solraczo.github.io/castillo1/android/libs/ARButton.js';
import { GLTFLoader } from 'https://solraczo.github.io/castillo1/android/libs/GLTFLoader.js';
import { RGBELoader } from 'https://solraczo.github.io/castillo1/android/libs/RGBELoader.js';

let mixerGLTF;
let actionsGLTF = {};
let clock = new THREE.Clock();
let modelLoaded = false;
const animationSpeed = 1;

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
            // Crear el botón AR y agregar una clase personalizada
            const arButton = ARButton.createButton(renderer, { requiredFeatures: ['hit-test'] });
            arButton.classList.add('custom-ar-button'); // Agregar una clase personalizada
            document.body.appendChild(arButton);

            // Detectar el inicio de la sesión de AR
            renderer.xr.addEventListener('sessionstart', () => {
                if (model) {
                    model.visible = true;
                }
            });

            // Detectar el final de la sesión de AR
            renderer.xr.addEventListener('sessionend', () => {
                if (model) {
                    model.visible = false;
                }
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
const light = new THREE.PointLight(0xffffff, 0.2);
light.position.set(0, 0.2, 0.2);
scene.add(light);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

// Cargar HDRI como entorno
const rgbeLoader = new RGBELoader();
rgbeLoader.load(
    'https://solraczo.github.io/castillo1/android/models/brown_photostudio_02_2k.hdr',
    (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        scene.environment = texture;
        scene.background = null;
        console.log('HDRI cargado correctamente.');
    },
    undefined,
    (error) => console.error('Error al cargar el HDRI:', error)
);

// Cargar el modelo GLTF y activar todas sus animaciones en loop
const gltfLoader = new GLTFLoader();
let model;
gltfLoader.load(
    'https://solraczo.github.io/castillo1/android/models/prueba1.gltf',
    (gltf) => {
        model = gltf.scene;
        model.scale.set(1, 1, 1);
        model.position.set(0, 0, 0);
        model.visible = false; // Ocultar el modelo inicialmente
        scene.add(model);

        mixerGLTF = new THREE.AnimationMixer(model);
        gltf.animations.forEach((clip) => {
            const action = mixerGLTF.clipAction(clip);
            action.setLoop(THREE.LoopRepeat);
            action.clampWhenFinished = false;
            action.timeScale = animationSpeed;
            action.play();
            actionsGLTF[clip.name] = action;
        });

        modelLoaded = true;
        console.log('Animaciones GLTF disponibles y activadas en loop:', Object.keys(actionsGLTF));
    },
    (xhr) => console.log('GLTF loaded:', (xhr.loaded / xhr.total) * 100 + '%'),
    (error) => console.error('Error al cargar el modelo GLTF:', error)
);

// Animar cada frame
renderer.setAnimationLoop((timestamp, frame) => {
    const delta = clock.getDelta();
    if (mixerGLTF) mixerGLTF.update(delta * animationSpeed);
    renderer.render(scene, camera);
});
// Variables para interacción táctil
let isTouching = false;
let previousTouches = [];

renderer.domElement.addEventListener('touchstart', (event) => {
    if (modelLoaded) {
        isTouching = true;
        previousTouches = [...event.touches];
    }
}, false);

renderer.domElement.addEventListener('touchmove', (event) => {
    if (!isTouching || !model) return;

    if (event.touches.length === 1 && previousTouches.length === 1) {
        // ROTAR con un dedo
        const deltaX = event.touches[0].clientX - previousTouches[0].clientX;
        model.rotation.y += deltaX * 0.005;
    } else if (event.touches.length === 2 && previousTouches.length === 2) {
        // ESCALAR y MOVER con dos dedos
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

        // MOVER en eje X (arrastre horizontal)
        const moveDeltaX = ((event.touches[0].clientX + event.touches[1].clientX) / 2 - 
                            (previousTouches[0].clientX + previousTouches[1].clientX) / 2) * 0.001;
        model.position.x += moveDeltaX;
    }

    previousTouches = [...event.touches];
}, false);

renderer.domElement.addEventListener('touchend', () => {
    isTouching = false;
}, false);
