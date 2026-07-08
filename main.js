import * as THREE from 'three';

let scene, camera, renderer, car, track, coins = [], particles = [];
let gameState = 'start';
let score = 0;
let startTime = 0;
let elapsedTime = 0;
let keys = {};
let carSpeed = 0;
let carRotation = 0;

const CAR_SPEED_MAX = 0.5;
const CAR_ACCELERATION = 0.02;
const CAR_FRICTION = 0.95;
const CAR_TURN_SPEED = 0.04;

function init() {
    scene = new THREE.Scene();
    
    // Create beautiful procedural gradient sky
    createSky();
    
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    document.getElementById('game-container').appendChild(renderer.domElement);

    createLights();
    createTrack();
    createCar();
    createCoins();
    createEnvironment();

    document.addEventListener('keydown', (e) => keys[e.key.toLowerCase()] = true);
    document.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

    document.getElementById('start-btn').addEventListener('click', startGame);
    document.getElementById('restart-btn').addEventListener('click', restartGame);

    window.addEventListener('resize', onWindowResize);

    animate();
}

function createSky() {
    // Create a beautiful gradient sky
    const skyGeo = new THREE.SphereGeometry(400, 32, 16);
    const skyMat = new THREE.ShaderMaterial({
        uniforms: {
            topColor: { value: new THREE.Color(0x0077ff) },
            bottomColor: { value: new THREE.Color(0xaaddff) },
            offset: { value: 30 },
            exponent: { value: 0.6 }
        },
        vertexShader: `
            varying vec3 vWorldPosition;
            void main() {
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPosition.xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 topColor;
            uniform vec3 bottomColor;
            uniform float offset;
            uniform float exponent;
            varying vec3 vWorldPosition;
            void main() {
                float h = normalize(vWorldPosition + offset).y;
                gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
            }
        `,
        side: THREE.BackSide
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    scene.add(sky);
}

function createLights() {
    // Ambient light for base illumination
    const ambientLight = new THREE.AmbientLight(0x6699ff, 0.6);
    scene.add(ambientLight);

    // Main sun light
    const sunLight = new THREE.DirectionalLight(0xfff5dd, 1.2);
    sunLight.position.set(100, 200, 100);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 4096;
    sunLight.shadow.mapSize.height = 4096;
    sunLight.shadow.camera.left = -200;
    sunLight.shadow.camera.right = 200;
    sunLight.shadow.camera.top = 200;
    sunLight.shadow.camera.bottom = -200;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 500;
    scene.add(sunLight);

    // Fill light from the side
    const fillLight = new THREE.DirectionalLight(0x6699ff, 0.4);
    fillLight.position.set(-100, 100, -50);
    scene.add(fillLight);
}

function createTrack() {
    // Base ground
    const groundGeo = new THREE.PlaneGeometry(800, 800);
    const groundMat = new THREE.MeshStandardMaterial({ 
        color: 0x44aa44, 
        roughness: 0.9,
        metalness: 0.1
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    scene.add(ground);

    // Track base
    const trackGeo = new THREE.PlaneGeometry(200, 400);
    const trackMat = new THREE.MeshStandardMaterial({ 
        color: 0x333333,
        roughness: 0.8,
        metalness: 0.2
    });
    track = new THREE.Mesh(trackGeo, trackMat);
    track.rotation.x = -Math.PI / 2;
    track.position.y = 0;
    track.receiveShadow = true;
    scene.add(track);

    // Road surface
    const roadWidth = 100;
    const roadLength = 380;
    const roadGeo = new THREE.PlaneGeometry(roadWidth, roadLength);
    const roadMat = new THREE.MeshStandardMaterial({ 
        color: 0x444444, 
        roughness: 0.9,
        metalness: 0.1
    });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0.01;
    road.receiveShadow = true;
    scene.add(road);

    // Road markings - center yellow lines
    for (let i = -roadLength/2 + 20; i < roadLength/2; i += 40) {
        const lineGeo = new THREE.PlaneGeometry(0.8, 20);
        const lineMat = new THREE.MeshStandardMaterial({ 
            color: 0xffff00, 
            emissive: 0x444400,
            emissiveIntensity: 0.3
        });
        const line = new THREE.Mesh(lineGeo, lineMat);
        line.rotation.x = -Math.PI / 2;
        line.position.set(0, 0.02, i);
        scene.add(line);
    }

    // Side white lines
    const sideLineGeo = new THREE.PlaneGeometry(0.4, roadLength);
    const sideLineMat = new THREE.MeshStandardMaterial({ 
        color: 0xffffff, 
        emissive: 0x222222,
        emissiveIntensity: 0.2
    });
    
    const leftLine = new THREE.Mesh(sideLineGeo, sideLineMat);
    leftLine.rotation.x = -Math.PI / 2;
    leftLine.position.set(-roadWidth/2 + 2, 0.02, 0);
    scene.add(leftLine);
    
    const rightLine = new THREE.Mesh(sideLineGeo, sideLineMat);
    rightLine.rotation.x = -Math.PI / 2;
    rightLine.position.set(roadWidth/2 - 2, 0.02, 0);
    scene.add(rightLine);

    // Curbs (red-white)
    const curbGeo = new THREE.BoxGeometry(4, 2, roadLength);
    const curbMat = new THREE.MeshStandardMaterial({ 
        color: 0xff0000,
        roughness: 0.7
    });
    
    const leftCurb = new THREE.Mesh(curbGeo, curbMat);
    leftCurb.position.set(-roadWidth/2 - 2, 1, 0);
    leftCurb.castShadow = true;
    leftCurb.receiveShadow = true;
    scene.add(leftCurb);
    
    const rightCurb = new THREE.Mesh(curbGeo, curbMat);
    rightCurb.position.set(roadWidth/2 + 2, 1, 0);
    rightCurb.castShadow = true;
    rightCurb.receiveShadow = true;
    scene.add(rightCurb);
}

function createCar() {
    const carGroup = new THREE.Group();

    // Main body - more aerodynamic
    const bodyGeo = new THREE.BoxGeometry(2.2, 0.7, 4.5);
    const bodyMat = new THREE.MeshStandardMaterial({ 
        color: 0xff2200, 
        metalness: 0.9, 
        roughness: 0.2,
        envMapIntensity: 1.5
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.7;
    body.castShadow = true;
    carGroup.add(body);

    // Hood (front)
    const hoodGeo = new THREE.BoxGeometry(2, 0.3, 1.5);
    const hood = new THREE.Mesh(hoodGeo, bodyMat);
    hood.position.set(0, 0.8, 1.8);
    hood.castShadow = true;
    carGroup.add(hood);

    // Cabin
    const cabinGeo = new THREE.BoxGeometry(1.8, 0.7, 2);
    const glassMat = new THREE.MeshPhysicalMaterial({ 
        color: 0x336699, 
        metalness: 0.1, 
        roughness: 0.1,
        transmission: 0.8,
        transparent: true,
        opacity: 0.7
    });
    const cabin = new THREE.Mesh(cabinGeo, glassMat);
    cabin.position.set(0, 1.35, -0.2);
    cabin.castShadow = true;
    carGroup.add(cabin);

    // Cabin frame
    const frameGeo = new THREE.BoxGeometry(1.9, 0.75, 2.1);
    const frameMat = new THREE.MeshStandardMaterial({ 
        color: 0x222222, 
        metalness: 0.9, 
        roughness: 0.2
    });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.scale.set(1.05, 1.1, 1.05);
    frame.position.copy(cabin.position);
    carGroup.add(frame);

    // Rear spoiler
    const spoilerBaseGeo = new THREE.BoxGeometry(0.3, 0.8, 1.5);
    const spoilerMat = new THREE.MeshStandardMaterial({ 
        color: 0x111111, 
        metalness: 0.8, 
        roughness: 0.3
    });
    const spoilerLeft = new THREE.Mesh(spoilerBaseGeo, spoilerMat);
    spoilerLeft.position.set(-0.9, 1.2, -2.2);
    spoilerLeft.castShadow = true;
    carGroup.add(spoilerLeft);

    const spoilerRight = new THREE.Mesh(spoilerBaseGeo, spoilerMat);
    spoilerRight.position.set(0.9, 1.2, -2.2);
    spoilerRight.castShadow = true;
    carGroup.add(spoilerRight);

    const spoilerWingGeo = new THREE.BoxGeometry(2.5, 0.15, 0.8);
    const spoilerWing = new THREE.Mesh(spoilerWingGeo, spoilerMat);
    spoilerWing.position.set(0, 1.7, -2.2);
    spoilerWing.castShadow = true;
    carGroup.add(spoilerWing);

    // Headlights
    const headlightGeo = new THREE.SphereGeometry(0.25, 16, 16);
    const headlightMat = new THREE.MeshStandardMaterial({ 
        color: 0xffffaa, 
        emissive: 0xffff00,
        emissiveIntensity: 0.5,
        metalness: 0.2,
        roughness: 0.1
    });
    
    const leftHeadlight = new THREE.Mesh(headlightGeo, headlightMat);
    leftHeadlight.position.set(-0.7, 0.6, 2.2);
    carGroup.add(leftHeadlight);

    const rightHeadlight = new THREE.Mesh(headlightGeo, headlightMat);
    rightHeadlight.position.set(0.7, 0.6, 2.2);
    carGroup.add(rightHeadlight);

    // Taillights
    const taillightGeo = new THREE.BoxGeometry(0.3, 0.2, 0.15);
    const taillightMat = new THREE.MeshStandardMaterial({ 
        color: 0xff0000, 
        emissive: 0xff0000,
        emissiveIntensity: 0.3
    });
    
    const leftTaillight = new THREE.Mesh(taillightGeo, taillightMat);
    leftTaillight.position.set(-0.7, 0.5, -2.2);
    carGroup.add(leftTaillight);

    const rightTaillight = new THREE.Mesh(taillightGeo, taillightMat);
    rightTaillight.position.set(0.7, 0.5, -2.2);
    carGroup.add(rightTaillight);

    // Wheels - more detailed
    const wheelGroup = [];
    const wheelGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.35, 24);
    const tireMat = new THREE.MeshStandardMaterial({ 
        color: 0x111111, 
        metalness: 0.3, 
        roughness: 0.8
    });
    
    const rimGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.4, 16);
    const rimMat = new THREE.MeshStandardMaterial({ 
        color: 0xcccccc, 
        metalness: 1.0, 
        roughness: 0.2
    });

    const wheelPositions = [
        { x: -1.0, z: 1.6 },
        { x: 1.0, z: 1.6 },
        { x: -1.0, z: -1.6 },
        { x: 1.0, z: -1.6 }
    ];
    
    wheelPositions.forEach(pos => {
        const tire = new THREE.Mesh(wheelGeo, tireMat);
        tire.rotation.z = Math.PI / 2;
        tire.position.set(pos.x, 0.45, pos.z);
        tire.castShadow = true;
        carGroup.add(tire);
        
        const rim = new THREE.Mesh(rimGeo, rimMat);
        rim.rotation.z = Math.PI / 2;
        rim.position.set(pos.x, 0.45, pos.z);
        carGroup.add(rim);
        
        // Spokes
        for (let i = 0; i < 5; i++) {
            const spokeGeo = new THREE.BoxGeometry(0.05, 0.25, 0.05);
            const spoke = new THREE.Mesh(spokeGeo, rimMat);
            const angle = (i / 5) * Math.PI * 2;
            spoke.rotation.z = Math.PI / 2;
            spoke.rotation.y = angle;
            spoke.position.set(pos.x + Math.cos(angle) * 0.15, 0.45, pos.z + Math.sin(angle) * 0.15);
            carGroup.add(spoke);
        }
    });

    car = carGroup;
    car.position.set(0, 0, 0);
    scene.add(car);
}

function createCoins() {
    const coinGeo = new THREE.TorusGeometry(0.4, 0.15, 16, 32);
    const coinMat = new THREE.MeshStandardMaterial({ 
        color: 0xffd700, 
        metalness: 1.0, 
        roughness: 0.1,
        emissive: 0xffaa00,
        emissiveIntensity: 0.4
    });

    for (let i = 0; i < 50; i++) {
        const coin = new THREE.Mesh(coinGeo, coinMat);
        coin.position.set(
            (Math.random() - 0.5) * 180,
            1.2,
            (Math.random() - 0.5) * 360
        );
        coin.rotation.x = Math.PI / 2;
        coin.castShadow = true;
        coins.push(coin);
        scene.add(coin);
    }
}

function createEnvironment() {
    // Trees - more detailed
    const trunkGeo = new THREE.CylinderGeometry(0.4, 0.7, 6, 8);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 });
    const leavesGeo1 = new THREE.ConeGeometry(2.5, 4, 8);
    const leavesGeo2 = new THREE.ConeGeometry(2, 3.5, 8);
    const leavesGeo3 = new THREE.ConeGeometry(1.5, 3, 8);
    const leavesMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32 });

    for (let i = 0; i < 80; i++) {
        const treeGroup = new THREE.Group();
        
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 3;
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        treeGroup.add(trunk);

        const leaves1 = new THREE.Mesh(leavesGeo1, leavesMat);
        leaves1.position.y = 7;
        leaves1.castShadow = true;
        treeGroup.add(leaves1);
        
        const leaves2 = new THREE.Mesh(leavesGeo2, leavesMat);
        leaves2.position.y = 9;
        leaves2.castShadow = true;
        treeGroup.add(leaves2);
        
        const leaves3 = new THREE.Mesh(leavesGeo3, leavesMat);
        leaves3.position.y = 10.8;
        leaves3.castShadow = true;
        treeGroup.add(leaves3);

        let x, z;
        do {
            x = (Math.random() - 0.5) * 700;
            z = (Math.random() - 0.5) * 700;
        } while (Math.abs(x) < 70 && Math.abs(z) < 210);

        treeGroup.position.set(x, 0, z);
        treeGroup.rotation.y = Math.random() * Math.PI * 2;
        const scale = 0.7 + Math.random() * 0.6;
        treeGroup.scale.set(scale, scale, scale);
        scene.add(treeGroup);
    }

    // Some rocks for variation
    const rockGeo = new THREE.DodecahedronGeometry(1, 0);
    const rockMat = new THREE.MeshStandardMaterial({ 
        color: 0x757575, 
        roughness: 0.9,
        metalness: 0.1
    });

    for (let i = 0; i < 30; i++) {
        const rock = new THREE.Mesh(rockGeo, rockMat);
        let x, z;
        do {
            x = (Math.random() - 0.5) * 700;
            z = (Math.random() - 0.5) * 700;
        } while (Math.abs(x) < 70 && Math.abs(z) < 210);
        
        rock.position.set(x, 0.5, z);
        rock.scale.set(0.5 + Math.random() * 1, 0.5 + Math.random() * 1, 0.5 + Math.random() * 1);
        rock.rotation.set(Math.random(), Math.random(), Math.random());
        rock.castShadow = true;
        rock.receiveShadow = true;
        scene.add(rock);
    }
}

function createParticles(position) {
    const particleCount = 20;
    const particleGeo = new THREE.SphereGeometry(0.1, 8, 8);
    const particleMat = new THREE.MeshStandardMaterial({ 
        color: 0xffd700, 
        emissive: 0xffaa00,
        emissiveIntensity: 1.0
    });

    for (let i = 0; i < particleCount; i++) {
        const particle = new THREE.Mesh(particleGeo, particleMat);
        particle.position.copy(position);
        particle.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.5,
            Math.random() * 0.5,
            (Math.random() - 0.5) * 0.5
        );
        particle.life = 1.0;
        particles.push(particle);
        scene.add(particle);
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.position.add(p.velocity);
        p.velocity.y -= 0.02;
        p.life -= 0.02;
        p.scale.setScalar(p.life);
        p.material.opacity = p.life;
        
        if (p.life <= 0) {
            scene.remove(p);
            particles.splice(i, 1);
        }
    }
}

function startGame() {
    gameState = 'playing';
    score = 0;
    startTime = Date.now();
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('game-ui').classList.remove('hidden');
    document.getElementById('controls-hint').classList.remove('hidden');
}

function restartGame() {
    car.position.set(0, 0, 0);
    car.rotation.set(0, 0, 0);
    carSpeed = 0;
    carRotation = 0;
    
    coins.forEach(coin => scene.remove(coin));
    coins = [];
    createCoins();
    
    particles.forEach(p => scene.remove(p));
    particles = [];
    
    gameState = 'playing';
    score = 0;
    startTime = Date.now();
    
    document.getElementById('game-over').classList.add('hidden');
    document.getElementById('game-ui').classList.remove('hidden');
    document.getElementById('controls-hint').classList.remove('hidden');
}

function updateGame() {
    if (gameState !== 'playing') return;

    if (keys['w'] || keys['arrowup']) {
        carSpeed = Math.min(carSpeed + CAR_ACCELERATION, CAR_SPEED_MAX);
    } else if (keys['s'] || keys['arrowdown']) {
        carSpeed = Math.max(carSpeed - CAR_ACCELERATION, -CAR_SPEED_MAX / 2);
    } else {
        carSpeed *= CAR_FRICTION;
    }

    if (Math.abs(carSpeed) > 0.01) {
        if (keys['a'] || keys['arrowleft']) {
            carRotation += CAR_TURN_SPEED * (carSpeed > 0 ? 1 : -1);
        }
        if (keys['d'] || keys['arrowright']) {
            carRotation -= CAR_TURN_SPEED * (carSpeed > 0 ? 1 : -1);
        }
    }

    car.rotation.y = carRotation;
    car.position.x += Math.sin(carRotation) * carSpeed;
    car.position.z += Math.cos(carRotation) * carSpeed;

    // Camera follow with smoothness
    const cameraDistance = 18;
    const cameraHeight = 8;
    const targetX = car.position.x - Math.sin(carRotation) * cameraDistance;
    const targetZ = car.position.z - Math.cos(carRotation) * cameraDistance;
    const targetY = car.position.y + cameraHeight;
    
    camera.position.x += (targetX - camera.position.x) * 0.1;
    camera.position.y += (targetY - camera.position.y) * 0.1;
    camera.position.z += (targetZ - camera.position.z) * 0.1;
    camera.lookAt(car.position.x, car.position.y + 1, car.position.z);

    // Rotate coins
    coins.forEach((coin, index) => {
        coin.rotation.z += 0.03;
        coin.rotation.y += 0.02;
        coin.position.y = 1.2 + Math.sin(Date.now() * 0.003 + index) * 0.2;
        
        const distance = car.position.distanceTo(coin.position);
        if (distance < 2.5) {
            createParticles(coin.position.clone());
            scene.remove(coin);
            coins.splice(index, 1);
            score += 10;
        }
    });

    updateParticles();

    elapsedTime = Math.floor((Date.now() - startTime) / 1000);
    document.getElementById('score-display').textContent = `🏆 SKOR: ${score}`;
    document.getElementById('time-display').textContent = `⏱️ WAKTU: ${elapsedTime}s`;

    if (coins.length === 0) {
        endGame();
    }
}

function endGame() {
    gameState = 'gameover';
    document.getElementById('game-ui').classList.add('hidden');
    document.getElementById('controls-hint').classList.add('hidden');
    document.getElementById('final-score').textContent = `Skor Akhir: ${score} | Waktu: ${elapsedTime}s`;
    document.getElementById('game-over').classList.remove('hidden');
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    updateGame();
    renderer.render(scene, camera);
}

init();
