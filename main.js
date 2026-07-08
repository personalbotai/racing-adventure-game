import * as THREE from 'three';

let scene, camera, renderer, car, track = [], trackPath = [], checkpoints = [], coins = [], particles = [], curbs = [], trees = [], rocks = [];
let gameState = 'start';
let score = 0;
let startTime = 0;
let elapsedTime = 0;
let keys = {};
let carSpeed = 0;
let carRotation = 0;
let currentLap = 0;
let totalLaps = 10;
let lastCheckpoint = -1;
let pathPoints = [];

const CAR_SPEED_MAX = 0.6;
const CAR_ACCELERATION = 0.025;
const CAR_FRICTION = 0.96;
const CAR_TURN_SPEED = 0.05;

function init() {
    scene = new THREE.Scene();
    
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
    createTrackPath();
    createTrack();
    createCheckpoints();
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
    const skyGeo = new THREE.SphereGeometry(800, 32, 16);
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
                gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0), 1.0);
            }
        `,
        side: THREE.BackSide
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    scene.add(sky);
}

function createLights() {
    const ambientLight = new THREE.AmbientLight(0x6699ff, 0.6);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfff5dd, 1.2);
    sunLight.position.set(200, 400, 200);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 4096;
    sunLight.shadow.mapSize.height = 4096;
    sunLight.shadow.camera.left = -400;
    sunLight.shadow.camera.right = 400;
    sunLight.shadow.camera.top = 400;
    sunLight.shadow.camera.bottom = -400;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 800;
    scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight(0x6699ff, 0.4);
    fillLight.position.set(-200, 200, -100);
    scene.add(fillLight);
}

function createTrackPath() {
    pathPoints = [
        new THREE.Vector3(0, 0, 150),
        new THREE.Vector3(50, 0, 120),
        new THREE.Vector3(80, 0, 60),
        new THREE.Vector3(100, 0, 0),
        new THREE.Vector3(90, 0, -60),
        new THREE.Vector3(60, 0, -100),
        new THREE.Vector3(20, 0, -130),
        new THREE.Vector3(-20, 0, -140),
        new THREE.Vector3(-70, 0, -130),
        new THREE.Vector3(-100, 0, -90),
        new THREE.Vector3(-110, 0, -40),
        new THREE.Vector3(-100, 0, 20),
        new THREE.Vector3(-70, 0, 60),
        new THREE.Vector3(-30, 0, 100),
        new THREE.Vector3(0, 0, 150)
    ];
}

function createTrack() {
    const groundGeo = new THREE.PlaneGeometry(1200, 1200);
    const groundMat = new THREE.MeshStandardMaterial({ 
        color: 0x338833, 
        roughness: 0.9,
        metalness: 0.1
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    scene.add(ground);

    const curve = new THREE.CatmullRomCurve3(pathPoints, true);
    const roadWidth = 25;
    const roadLength = 3000;

    const trackGeo = new THREE.PlaneGeometry(roadWidth, roadLength);
    const trackMat = new THREE.MeshStandardMaterial({ 
        color: 0x333333,
        roughness: 0.8,
        metalness: 0.2
    });
    
    const trackSegments = 200;
    for (let i = 0; i < trackSegments; i++) {
        const t1 = i / trackSegments;
        const t2 = (i + 1) / trackSegments;
        
        const p1 = curve.getPointAt(t1);
        const p2 = curve.getPointAt(t2);
        
        const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
        const dir = new THREE.Vector3().subVectors(p2, p1).normalize();
        const angle = Math.atan2(dir.x, dir.z);
        
        const segmentGeo = new THREE.PlaneGeometry(roadWidth, p1.distanceTo(p2) + 0.1);
        const segment = new THREE.Mesh(segmentGeo, trackMat);
        segment.rotation.x = -Math.PI / 2;
        segment.rotation.y = -angle;
        segment.position.set(mid.x, 0.01, mid.z);
        segment.receiveShadow = true;
        scene.add(segment);
        track.push(segment);
    }

    const lineMat = new THREE.MeshStandardMaterial({ 
        color: 0xffff00, 
        emissive: 0x444400,
        emissiveIntensity: 0.3
    });
    const sideLineMat = new THREE.MeshStandardMaterial({ 
        color: 0xffffff, 
        emissive: 0x222222,
        emissiveIntensity: 0.2
    });

    for (let i = 0; i < trackSegments; i++) {
        const t = i / trackSegments;
        const p = curve.getPointAt(t);
        const nextT = (i + 0.5) / trackSegments;
        const nextP = curve.getPointAt(nextT);
        
        const dir = new THREE.Vector3().subVectors(nextP, p).normalize();
        const perp = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(roadWidth / 2 - 2);
        
        const leftP = new THREE.Vector3().addVectors(p, perp);
        const rightP = new THREE.Vector3().subVectors(p, perp);
        
        if (i % 4 === 0) {
            const lineGeo = new THREE.PlaneGeometry(1, 8);
            const centerLine = new THREE.Mesh(lineGeo, lineMat);
            centerLine.rotation.x = -Math.PI / 2;
            centerLine.rotation.y = -Math.atan2(dir.x, dir.z);
            centerLine.position.set(p.x, 0.02, p.z);
            scene.add(centerLine);
        }
        
        const sideLineGeo = new THREE.PlaneGeometry(0.5, 12);
        const leftLine = new THREE.Mesh(sideLineGeo, sideLineMat);
        leftLine.rotation.x = -Math.PI / 2;
        leftLine.rotation.y = -Math.atan2(dir.x, dir.z);
        leftLine.position.set(leftP.x, 0.02, leftP.z);
        scene.add(leftLine);
        
        const rightLine = new THREE.Mesh(sideLineGeo, sideLineMat);
        rightLine.rotation.x = -Math.PI / 2;
        rightLine.rotation.y = -Math.atan2(dir.x, dir.z);
        rightLine.position.set(rightP.x, 0.02, rightP.z);
        scene.add(rightLine);
    }

    const curbMat = new THREE.MeshStandardMaterial({ 
        color: 0xff0000,
        roughness: 0.7
    });
    
    for (let i = 0; i < trackSegments; i++) {
        const t = i / trackSegments;
        const p = curve.getPointAt(t);
        const nextT = (i + 0.5) / trackSegments;
        const nextP = curve.getPointAt(nextT);
        
        const dir = new THREE.Vector3().subVectors(nextP, p).normalize();
        const perp = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(roadWidth / 2 + 1.5);
        
        const leftCurbP = new THREE.Vector3().addVectors(p, perp);
        const rightCurbP = new THREE.Vector3().subVectors(p, perp);
        
        const curbGeo = new THREE.BoxGeometry(3, 1.5, 10);
        
        if (i % 2 === 0) {
            const leftCurb = new THREE.Mesh(curbGeo, curbMat);
            leftCurb.position.set(leftCurbP.x, 0.75, leftCurbP.z);
            leftCurb.rotation.y = -Math.atan2(dir.x, dir.z);
            leftCurb.castShadow = true;
            leftCurb.receiveShadow = true;
            scene.add(leftCurb);
            curbs.push(leftCurb);
            
            const rightCurb = new THREE.Mesh(curbGeo, curbMat);
            rightCurb.position.set(rightCurbP.x, 0.75, rightCurbP.z);
            rightCurb.rotation.y = -Math.atan2(dir.x, dir.z);
            rightCurb.castShadow = true;
            rightCurb.receiveShadow = true;
            scene.add(rightCurb);
            curbs.push(rightCurb);
        }
    }
}

function createCheckpoints() {
    const numCheckpoints = pathPoints.length;
    for (let i = 0; i < numCheckpoints; i++) {
        const point = pathPoints[i];
        const markerGeo = new THREE.BoxGeometry(4, 15, 0.5);
        const markerMat = new THREE.MeshStandardMaterial({ 
            color: i === 0 ? 0x00ff00 : 0x0088ff,
            emissive: i === 0 ? 0x004400 : 0x004488,
            emissiveIntensity: 0.5
        });
        const marker = new THREE.Mesh(markerGeo, markerMat);
        
        const nextIndex = (i + 1) % pathPoints.length;
        const nextPoint = pathPoints[nextIndex];
        const dir = new THREE.Vector3().subVectors(nextPoint, point).normalize();
        const angle = Math.atan2(dir.x, dir.z);
        
        marker.position.set(point.x, 7.5, point.z);
        marker.rotation.y = -angle;
        marker.userData.index = i;
        
        scene.add(marker);
        checkpoints.push(marker);
    }
}

function createCar() {
    const carGroup = new THREE.Group();

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

    const hoodGeo = new THREE.BoxGeometry(2, 0.3, 1.5);
    const hood = new THREE.Mesh(hoodGeo, bodyMat);
    hood.position.set(0, 0.8, 1.8);
    hood.castShadow = true;
    carGroup.add(hood);

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
    car.position.set(0, 0, 150);
    scene.add(car);
}

function createCoins() {
    const coinGeo = new THREE.TorusGeometry(0.6, 0.2, 16, 32);
    const coinMat = new THREE.MeshStandardMaterial({ 
        color: 0xffd700, 
        metalness: 1.0, 
        roughness: 0.1,
        emissive: 0xffaa00,
        emissiveIntensity: 0.4
    });

    const curve = new THREE.CatmullRomCurve3(pathPoints, true);
    const numCoins = 100;
    for (let i = 0; i < numCoins; i++) {
        const t = i / numCoins;
        const basePoint = curve.getPointAt(t);
        
        const nextT = (i + 0.01) / numCoins;
        const nextPoint = curve.getPointAt(nextT);
        const dir = new THREE.Vector3().subVectors(nextPoint, basePoint).normalize();
        const perp = new THREE.Vector3(-dir.z, 0, dir.x);
        const offset = (Math.random() - 0.5) * 16;
        
        const coin = new THREE.Mesh(coinGeo, coinMat);
        coin.position.set(
            basePoint.x + perp.x * offset,
            1.5,
            basePoint.z + perp.z * offset
        );
        coin.rotation.x = Math.PI / 2;
        coin.castShadow = true;
        coins.push(coin);
        scene.add(coin);
    }
}

function createEnvironment() {
    const trunkGeo = new THREE.CylinderGeometry(0.5, 0.9, 7, 8);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 });
    const leavesGeo1 = new THREE.ConeGeometry(3, 5, 8);
    const leavesGeo2 = new THREE.ConeGeometry(2.4, 4, 8);
    const leavesGeo3 = new THREE.ConeGeometry(1.8, 3.5, 8);
    const leavesMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32 });

    const curve = new THREE.CatmullRomCurve3(pathPoints, true);
    
    for (let i = 0; i < 200; i++) {
        const treeGroup = new THREE.Group();
        
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 3.5;
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        treeGroup.add(trunk);

        const leaves1 = new THREE.Mesh(leavesGeo1, leavesMat);
        leaves1.position.y = 8;
        leaves1.castShadow = true;
        treeGroup.add(leaves1);
        
        const leaves2 = new THREE.Mesh(leavesGeo2, leavesMat);
        leaves2.position.y = 10.5;
        leaves2.castShadow = true;
        treeGroup.add(leaves2);
        
        const leaves3 = new THREE.Mesh(leavesGeo3, leavesMat);
        leaves3.position.y = 12.5;
        leaves3.castShadow = true;
        treeGroup.add(leaves3);

        let x, z, validPosition = false;
        let attempts = 0;
        
        while (!validPosition && attempts < 50) {
            const t = Math.random();
            const basePoint = curve.getPointAt(t);
            const offset = 50 + Math.random() * 200;
            const angle = Math.random() * Math.PI * 2;
            
            x = basePoint.x + Math.cos(angle) * offset;
            z = basePoint.z + Math.sin(angle) * offset;
            
            let minDist = Infinity;
            for (let j = 0; j < pathPoints.length; j++) {
                const checkT = (j + 0.5) / pathPoints.length;
                const trackPoint = curve.getPointAt(checkT);
                const d = Math.sqrt(Math.pow(x - trackPoint.x, 2) + Math.pow(z - trackPoint.z, 2));
                minDist = Math.min(minDist, d);
            }
            
            if (minDist > 40) {
                validPosition = true;
            }
            attempts++;
        }
        
        if (validPosition) {
            treeGroup.position.set(x, 0, z);
            treeGroup.rotation.y = Math.random() * Math.PI * 2;
            const scale = 0.6 + Math.random() * 0.8;
            treeGroup.scale.set(scale, scale, scale);
            scene.add(treeGroup);
            trees.push(treeGroup);
        }
    }

    const rockGeo = new THREE.DodecahedronGeometry(1.2, 0);
    const rockMat = new THREE.MeshStandardMaterial({ 
        color: 0x757575, 
        roughness: 0.9,
        metalness: 0.1
    });

    for (let i = 0; i < 60; i++) {
        const rock = new THREE.Mesh(rockGeo, rockMat);
        let x, z, validPosition = false;
        let attempts = 0;
        
        while (!validPosition && attempts < 50) {
            const t = Math.random();
            const basePoint = curve.getPointAt(t);
            const offset = 60 + Math.random() * 180;
            const angle = Math.random() * Math.PI * 2;
            
            x = basePoint.x + Math.cos(angle) * offset;
            z = basePoint.z + Math.sin(angle) * offset;
            
            let minDist = Infinity;
            for (let j = 0; j < pathPoints.length; j++) {
                const checkT = (j + 0.5) / pathPoints.length;
                const trackPoint = curve.getPointAt(checkT);
                const d = Math.sqrt(Math.pow(x - trackPoint.x, 2) + Math.pow(z - trackPoint.z, 2));
                minDist = Math.min(minDist, d);
            }
            
            if (minDist > 45) {
                validPosition = true;
            }
            attempts++;
        }
        
        if (validPosition) {
            rock.position.set(x, 0.6, z);
            rock.scale.set(0.6 + Math.random() * 1.5, 0.6 + Math.random() * 1.5, 0.6 + Math.random() * 1.5);
            rock.rotation.set(Math.random(), Math.random(), Math.random());
            rock.castShadow = true;
            rock.receiveShadow = true;
            scene.add(rock);
            rocks.push(rock);
        }
    }
}

function createParticles(position) {
    const particleCount = 25;
    const particleGeo = new THREE.SphereGeometry(0.15, 8, 8);
    const particleMat = new THREE.MeshStandardMaterial({ 
        color: 0xffd700, 
        emissive: 0xffaa00,
        emissiveIntensity: 1.0
    });

    for (let i = 0; i < particleCount; i++) {
        const particle = new THREE.Mesh(particleGeo, particleMat);
        particle.position.copy(position);
        particle.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.6,
            Math.random() * 0.6,
            (Math.random() - 0.5) * 0.6
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
        p.life -= 0.015;
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
    currentLap = 0;
    lastCheckpoint = -1;
    startTime = Date.now();
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('game-ui').classList.remove('hidden');
    document.getElementById('controls-hint').classList.remove('hidden');
    updateUI();
}

function restartGame() {
    car.position.set(0, 0, 150);
    car.rotation.set(0, 0, 0);
    carSpeed = 0;
    carRotation = 0;
    currentLap = 0;
    lastCheckpoint = -1;
    
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
    updateUI();
}

function updateUI() {
    document.getElementById('score-display').textContent = `🏆 SKOR: ${score}`;
    document.getElementById('time-display').textContent = `🏁 PUTARAN: ${currentLap} / ${totalLaps}`;
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
    const oldX = car.position.x;
    const oldZ = car.position.z;
    car.position.x += Math.sin(carRotation) * carSpeed;
    car.position.z += Math.cos(carRotation) * carSpeed;

    // Collision detection
    const carBox = new THREE.Box3().setFromObject(car);
    let collision = false;
    
    curbs.forEach(curb => {
        const curbBox = new THREE.Box3().setFromObject(curb);
        if (carBox.intersectsBox(curbBox)) {
            collision = true;
        }
    });
    
    trees.forEach(tree => {
        const treeBox = new THREE.Box3().setFromObject(tree);
        if (carBox.intersectsBox(treeBox)) {
            collision = true;
        }
    });
    
    rocks.forEach(rock => {
        const rockBox = new THREE.Box3().setFromObject(rock);
        if (carBox.intersectsBox(rockBox)) {
            collision = true;
        }
    });
    
    if (collision) {
        car.position.x = oldX;
        car.position.z = oldZ;
        carSpeed = -carSpeed * 0.3; // Bounce back
    }

    const cameraDistance = 22;
    const cameraHeight = 10;
    const targetX = car.position.x - Math.sin(carRotation) * cameraDistance;
    const targetZ = car.position.z - Math.cos(carRotation) * cameraDistance;
    const targetY = car.position.y + cameraHeight;
    
    camera.position.x += (targetX - camera.position.x) * 0.08;
    camera.position.y += (targetY - camera.position.y) * 0.08;
    camera.position.z += (targetZ - camera.position.z) * 0.08;
    camera.lookAt(car.position.x, car.position.y + 1.5, car.position.z);

    coins.forEach((coin, index) => {
        coin.rotation.z += 0.03;
        coin.rotation.y += 0.02;
        coin.position.y = 1.5 + Math.sin(Date.now() * 0.003 + index) * 0.25;
        
        const distance = car.position.distanceTo(coin.position);
        if (distance < 3) {
            createParticles(coin.position.clone());
            scene.remove(coin);
            coins.splice(index, 1);
            score += 10;
        }
    });

    checkpoints.forEach((checkpoint, index) => {
        const distance = car.position.distanceTo(checkpoint.position);
        if (distance < 10) {
            const expectedCheckpoint = (lastCheckpoint + 1) % checkpoints.length;
            if (index === expectedCheckpoint) {
                lastCheckpoint = index;
                if (index === 0 && lastCheckpoint === 0 && currentLap > 0) {
                    currentLap++;
                    updateUI();
                    if (currentLap >= totalLaps) {
                        endGame();
                    }
                } else if (index === 0 && lastCheckpoint === 0 && currentLap === 0) {
                    currentLap = 1;
                    updateUI();
                }
                checkpoint.material.emissiveIntensity = 1.5;
                setTimeout(() => { checkpoint.material.emissiveIntensity = 0.5; }, 500);
            }
        }
    });

    updateParticles();

    elapsedTime = Math.floor((Date.now() - startTime) / 1000);
}

function endGame() {
    gameState = 'gameover';
    document.getElementById('game-ui').classList.add('hidden');
    document.getElementById('controls-hint').classList.add('hidden');
    document.getElementById('final-score').textContent = `Skor Akhir: ${score} | Waktu: ${elapsedTime}s | Putaran: ${currentLap}`;
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
