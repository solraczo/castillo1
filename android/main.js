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
// Ya no necesitamos 'modelPlaced' para el comportamiento original,
// pero la mantendremos si quieres usarla para un futuro reposicionamiento manual.
let modelPlaced = false;

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
            const arButton = ARButton.createButton(renderer, { requiredFeatures: ['hit-test'] }); // Mantenemos hit-test
            arButton.classList.add('custom-ar-button');
            document.body.appendChild(arButton);

            // Detectar el inicio de la sesión de AR
            renderer.xr.addEventListener('sessionstart', (event) => {
                const session = event.session;

                // Restablecer el comportamiento original: hacer el modelo visible al iniciar la sesión
                if (model) {
                    model.visible = true; // HACER VISIBLE EL MODELO AQUÍ
                    // Opcionalmente, puedes darle una posición inicial si no quieres que sea (0,0,0)
                    // model.position.set(0, -0.5, -1); // Ejemplo: un poco más abajo y enfrente de la cámara
                }

                // Las siguientes líneas son para el hit-test, las mantenemos para futuras funcionalidades
                session.requestReferenceSpace('local').then((space) => {
                    localSpace = space;
                });
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

                // Mantendremos el listener 'select' por si quieres usar el hit-test para algo más tarde
                session.addEventListener('select', onSelect);

                console.log('Sesión AR iniciada. Modelo debería ser visible.');
            });

            // Detectar el final de la sesión de AR
            renderer.xr.addEventListener('sessionend', () => {
                if (model) {
                    model.visible = false; // Ocultar el modelo al salir de AR
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

// Iluminación (sin cambios)
const light = new THREE.PointLight(0xffffff, 0.2);
light.position.set(0, 0.2, 0.2);
scene.add(light);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

// Cargar HDRI (sin cambios)
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

// Cargar el modelo GLTF y activar animaciones (con un ajuste inicial de visibilidad)
const gltfLoader = new GLTFLoader();
let model;
gltfLoader.load(
    'https://solraczo.github.io/castillo1/android/models/prueba1.gltf',
    (gltf) => {
        model = gltf.scene;
        model.scale.set(1, 1, 1);
        model.position.set(0, 0, 0); // Posición inicial (puedes ajustar esta para que aparezca en un lugar razonable)
        model.visible = false; // El modelo se oculta inicialmente aquí. Se hará visible en 'sessionstart'.
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

// --- Funcionalidades para interactuar en AR (manteniendo el hit-test por si lo necesitas) ---

/**
 * Función que se ejecuta cuando el usuario realiza un "select" (tap/clic) en la sesión AR.
 * Puedes usar esta función para reposicionar el modelo o añadir otros elementos.
 */
function onSelect() {
    // Si el modelo ya es visible por defecto al entrar en AR,
    // puedes usar esta función para, por ejemplo, moverlo al punto de hit-test.
    if (renderer.xr.isPresenting && modelLoaded && hitTestSourceInitialized && hitTestSource) {
        const frame = renderer.xr.getFrame();
        const hitTestResults = frame.getHitTestResults(hitTestSource);

        if (hitTestResults.length > 0) {
            const hit = hitTestResults[0];
            const pose = hit.getPose(localSpace);

            if (model) {
                // Aquí, en lugar de hacerlo visible, lo reposicionas.
                model.position.copy(pose.transform.position);
                model.quaternion.copy(pose.transform.orientation);
                console.log('Modelo reposicionado a través de hit-test.');
            }
        } else {
            console.log('No se encontraron resultados de hit-test para reposicionar.');
        }
    }
}

// Animar cada frame (sin cambios)
renderer.setAnimationLoop((timestamp, frame) => {
    const delta = clock.getDelta();
    if (mixerGLTF) mixerGLTF.update(delta * animationSpeed);

    renderer.render(scene, camera);
});
