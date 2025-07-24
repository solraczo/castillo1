import * as THREE from 'https://solraczo.github.io/castillo1/android/libs/three.module.js';
import { ARButton } from 'https://solraczo.github.io/castillo1/android/libs/ARButton.js';
import { GLTFLoader } from 'https://solraczo.github.io/castillo1/android/libs/GLTFLoader.js';
import { RGBELoader } from 'https://solraczo.github.io/castillo1/android/libs/RGBELoader.js';
import { InteractiveGroup } from 'https://solraczo.github.io/castillo1/android/libs/InteractiveGroup.js';

let scene, camera, renderer;
let model, mixerGLTF, hitTestSource = null, hitTestSourceRequested = false;
let placed = false;
const clock = new THREE.Clock();
const animationSpeed = 1;

const interactiveGroup = new InteractiveGroup();
let lastPointer = null;
let isTouching = false;
let previousDistance = null;

init();
animate();

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 100);
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.setClearColor(0x000000, 0);
    document.body.appendChild(renderer.domElement);

    document.body.appendChild(ARButton.createButton(renderer, { requiredFeatures: ['hit-test'] }));

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const light = new THREE.PointLight(0xffffff, 0.2);
    light.position.set(0, 0.2, 0.2);
    scene.add(light);

    new RGBELoader().load(
        'https://solraczo.github.io/castillo1/android/models/brown_photostudio_02_2k.hdr',
        (texture) => {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            scene.environment = texture;
            scene.background = null;
        }
    );

    scene.add(interactiveGroup);
    interactiveGroup.listenToPointerEvents(renderer, camera);

    const loader = new GLTFLoader();
    loader.load(
        'https://solraczo.github.io/castillo1/android/models/prueba1.gltf',
        (gltf) => {
            model = gltf.scene;
            model.scale.set(1, 1, 1);
            model.visible = false;

            model.addEventListener('pointerdown', (event) => {
                isTouching = true;
                lastPointer = event.data.clone();
                previousDistance = null;
            });

            model.addEventListener('pointermove', (event) => {
                if (!isTouching || !lastPointer) return;

                const dx = event.data.x - lastPointer.x;
                const dy = event.data.y - lastPointer.y;

                model.rotation.y += dx * 5.0;
                model.position.x += dx * 2.0;
                model.position.z += dy * 2.0;

                lastPointer = event.data.clone();
            });

            model.addEventListener('pointerup', () => {
                isTouching = false;
                lastPointer = null;
                previousDistance = null;
            });

            interactiveGroup.add(model);

            mixerGLTF = new THREE.AnimationMixer(model);
            gltf.animations.forEach((clip) => {
                const action = mixerGLTF.clipAction(clip);
                action.setLoop(THREE.LoopRepeat);
                action.timeScale = animationSpeed;
                action.play();
            });
        }
    );

    renderer.domElement.addEventListener('touchend', () => {
        if (!placed && model && model.visible) {
            placed = true;
            hitTestSourceRequested = false;
            if (hitTestSource) {
                hitTestSource.cancel();
                hitTestSource = null;
            }
        }
    });

    renderer.domElement.addEventListener('touchmove', (e) => {
        if (!placed || !model) return;
        if (e.touches.length === 2) {
            const dist = distance(e.touches[0], e.touches[1]);
            if (previousDistance !== null) {
                const scaleChange = (dist - previousDistance) * 0.01;
                const newScale = model.scale.x + scaleChange;
                model.scale.setScalar(Math.max(0.1, Math.min(5, newScale)));
            }
            previousDistance = dist;
        }
    });
}

function animate() {
    renderer.setAnimationLoop((timestamp, frame) => {
        const delta = clock.getDelta();
        if (mixerGLTF) mixerGLTF.update(delta * animationSpeed);

        if (!placed && frame) {
            const session = renderer.xr.getSession();

            if (!hitTestSourceRequested) {
                session.requestReferenceSpace('viewer').then((space) => {
                    session.requestHitTestSource({ space }).then((source) => {
                        hitTestSource = source;
                    });
                });
                hitTestSourceRequested = true;

                session.addEventListener('end', () => {
                    hitTestSourceRequested = false;
                    hitTestSource = null;
                    placed = false;
                });
            }

            if (hitTestSource) {
                const referenceSpace = renderer.xr.getReferenceSpace();
                const hitTestResults = frame.getHitTestResults(hitTestSource);
                if (hitTestResults.length > 0 && model) {
                    const hit = hitTestResults[0];
                    const pose = hit.getPose(referenceSpace);
                    model.visible = true;
                    model.position.set(
                        pose.transform.position.x,
                        pose.transform.position.y,
                        pose.transform.position.z
                    );
                }
            }
        }

        renderer.render(scene, camera);
    });
}

function distance(p1, p2) {
    return Math.hypot(p1.clientX - p2.clientX, p1.clientY - p2.clientY);
}
