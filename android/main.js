import * as THREE from 'https://solraczo.github.io/castillo1/android/libs/three.module.js';
import { ARButton } from 'https://solraczo.github.io/castillo1/android/libs/ARButton.js';
import { GLTFLoader } from 'https://solraczo.github.io/castillo1/android/libs/GLTFLoader.js';
import { RGBELoader } from 'https://solraczo.github.io/castillo1/android/libs/RGBELoader.js';

let mixerGLTF;
let actionsGLTF = {};
let clock = new THREE.Clock();
let modelLoaded = false;
const animationSpeed = 1;

// Variables para Realidad Aumentada
let hitTestSource = null;
let hitTestSourceInitialized = false;
let localSpace = null;
let viewerSpace = null;
let modelPlaced = false; // Para saber si el modelo ya está posicionado

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
            renderer.xr.addEventListener('sessionstart', (event) => {
                const session = event.session;

                // Crear un espacio local para el contenido
                session.requestReferenceSpace('local').then((space) => {
                    localSpace = space;
                });

                // Crear un espacio para el visor (cámara)
                session.requestReferenceSpace('viewer').then((space) => {
                    viewerSpace = space;
                    session.requestHitTestSource({ space: viewerSpace }).then((source) => {
                        hitTestSource = source;
                        hitTestSourceInitialized = true;
                        console.log('Hit test source initialized.');
                    }).catch(e => {
                        console.error('Error requesting hit test source:', e);
                    });
                }).catch(e => {
                    console.error('Error requesting viewer space:', e);
                });

                // Agregar un listener para taps en la pantalla (simula clics en AR)
                session.addEventListener('select', onSelect);

                // Ocultar el modelo al iniciar la sesión si ya estaba visible de alguna manera
                if (model) {
                    model.visible = false;
                    modelPlaced = false; // Resetear el estado de colocado
                }
            });

            // Detectar el final de la sesión de AR
            renderer.xr.addEventListener('sessionend', () => {
                if (model) {
                    model.visible = false;
                    modelPlaced = false; // Resetear el estado de colocado
                }
                hitTestSource = null;
                hitTestSourceInitialized = false;
                console.log('AR Session ended.');
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
        model.position.set(0, 0, 0); // Posición inicial (antes de ser colocado en AR)
        model.visible = false; // Ocultar el modelo inicialmente hasta que sea colocado en AR
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

// --- Funcionalidades para interactuar en AR ---

/**
 * Función que se ejecuta cuando el usuario realiza un "select" (tap/clic) en la sesión AR.
 * Aquí es donde intentaremos colocar el modelo.
 */
function onSelect() {
    if (renderer.xr.isPresenting && modelLoaded && hitTestSourceInitialized && hitTestSource && !modelPlaced) {
        // Obtenemos los resultados del hit-test para el frame actual
        const frame = renderer.xr.getFrame();
        const hitTestResults = frame.getHitTestResults(hitTestSource);

        if (hitTestResults.length > 0) {
            // Tomamos el primer resultado del hit-test
            const hit = hitTestResults[0];

            // Obtenemos la matriz de transformación del resultado del hit-test
            const pose = hit.getPose(localSpace);

            if (model) {
                // Posicionamos el modelo en la ubicación del hit-test
                model.position.copy(pose.transform.position);
                model.quaternion.copy(pose.transform.orientation);
                model.visible = true; // Hacer el modelo visible
                modelPlaced = true; // Marcar que el modelo ya ha sido colocado
                console.log('Modelo colocado en AR.');
            }
        } else {
            console.log('No se encontraron resultados de hit-test.');
        }
    } else if (modelPlaced) {
        console.log('Modelo ya colocado. Toca para reposicionarlo si es necesario.');
        // Puedes agregar lógica aquí para reposicionar el modelo si se toca de nuevo
        // Por ahora, solo permitimos un solo posicionamiento inicial.
        // Para reposicionar, podrías establecer modelPlaced = false y model.visible = false
        // y permitir que el siguiente tap lo mueva.
    }
}

// Animar cada frame
renderer.setAnimationLoop((timestamp, frame) => {
    const delta = clock.getDelta();
    if (mixerGLTF) mixerGLTF.update(delta * animationSpeed);

    renderer.render(scene, camera);
});
