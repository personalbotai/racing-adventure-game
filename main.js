import * as THREE from 'three';

let scene, camera, renderer, car, track, coins = [];
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
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 50, 200);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.getElementById('game-container').appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

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

function createTrack() {
    const trackGeometry = new THREE.PlaneGeometry(400, 400);
    const trackMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x333333,
        roughness: 0.8
    });
    track = new THREE.Mesh(trackGeometry, trackMaterial);
    track.rotation.x = -Math.PI / 2;
    track.receiveShadow = true;
    scene.add(track);

    const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x555555 });
    for (let i = -150; i < 150; i += 20) {
        const roadSegment = new THREE.Mesh(
            new THREE.BoxGeometry(15, 0.1, 300),
            roadMaterial
        );
        roadSegment.position.set(i, 0.05, 0);
        roadSegment.receiveShadow = true;
        scene.add(roadSegment);
    }

    const lineMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
    for (let i = -150; i < 150; i += 40) {
        const line = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 0.15, 10),
            lineMaterial
        );
        line.position.set(i, 0.1, 0);
        scene.add(line);
    }
}

function createCar() {
    const carGroup = new THREE.Group();

    const bodyGeometry = new THREE.BoxGeometry(2, 0.8, 4);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xff4444, metalness: 0.7, roughness: 0.3 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.8;
    body.castShadow = true;
    carGroup.add(body);

    const cabinGeometry = new THREE.BoxGeometry(1.8, 0.6, 2);
    const cabinMaterial = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.9, roughness: 0.1 });
    const cabin = new THREE.Mesh(cabinGeometry, cabinMaterial);
    cabin.position.set(0, 1.5, -0.3);
    cabin.castShadow = true;
    carGroup.add(cabin);

    const wheelGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16);
    const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.5, roughness: 0.5 });
    
    const wheelPositions = [
        { x: -1.1, z: 1.3 },
        { x: 1.1, z: 1.3 },
        { x: -1.1, z: -1.3 },
        { x: 1.1, z: -1.3 }
    ];
    
    wheelPositions.forEach(pos => {
        const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(pos.x, 0.4, pos.z);
        wheel.castShadow = true;
        carGroup.add(wheel);
    });

    car = carGroup;
    car.position.set(0, 0, 0);
    scene.add(car);
}

function createCoins() {
    const coinGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 16);
    const coinMaterial = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.9, roughness: 0.2 });

    for (let i = 0; i < 50; i++) {
        const coin = new THREE.Mesh(coinGeometry, coinMaterial);
        coin.position.set(
            (Math.random() - 0.5) * 250,
            1,
            (Math.random() - 0.5) * 250
        );
        coin.rotation.x = Math.PI / 2;
        coin.castShadow = true;
        coins.push(coin);
        scene.add(coin);
    }
}

function createEnvironment() {
    const groundGeometry = new THREE.PlaneGeometry(1000, 1000);
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x90EE90 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.1;
    ground.receiveShadow = true;
    scene.add(ground);

    const treeTrunkGeometry = new THREE.CylinderGeometry(0.5, 0.7, 5, 8);
    const treeTrunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
    const treeLeavesGeometry = new THREE.ConeGeometry(2, 5, 8);
    const treeLeavesMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22 });

    for (let i = 0; i < 100; i++) {
        const treeGroup = new THREE.Group();
        
        const trunk = new THREE.Mesh(treeTrunkGeometry, treeTrunkMaterial);
        trunk.position.y = 2.5;
        trunk.castShadow = true;
        treeGroup.add(trunk);

        const leaves = new THREE.Mesh(treeLeavesGeometry, treeLeavesMaterial);
        leaves.position.y = 6;
        leaves.castShadow = true;
        treeGroup.add(leaves);

        let x, z;
        do {
            x = (Math.random() - 0.5) * 400;
            z = (Math.random() - 0.5) * 400;
        } while (Math.abs(x) < 20 && Math.abs(z) < 150);

        treeGroup.position.set(x, 0, z);
        scene.add(treeGroup);
    }
}

function startGame() {
    gameState = 'playing';
    score = 0;
    startTime = Date.now();
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('game-ui').classList.remove('hidden');
}

function restartGame() {
    car.position.set(0, 0, 0);
    car.rotation.set(0, 0, 0);
    carSpeed = 0;
    carRotation = 0;
    
    coins.forEach(coin => scene.remove(coin));
    coins = [];
    createCoins();
    
    gameState = 'playing';
    score = 0;
    startTime = Date.now();
    
    document.getElementById('game-over').classList.add('hidden');
    document.getElementById('game-ui').classList.remove('hidden');
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

    camera.position.x = car.position.x - Math.sin(carRotation) * 15;
    camera.position.z = car.position.z - Math.cos(carRotation) * 15;
    camera.position.y = car.position.y + 8;
    camera.lookAt(car.position.x, car.position.y + 1, car.position.z);

    coins.forEach((coin, index) => {
        coin.rotation.z += 0.05;
        
        const distance = car.position.distanceTo(coin.position);
        if (distance < 2) {
            scene.remove(coin);
            coins.splice(index, 1);
            score += 10;
        }
    });

    elapsedTime = Math.floor((Date.now() - startTime) / 1000);
    document.getElementById('score-display').textContent = `Skor: ${score}`;
    document.getElementById('time-display').textContent = `Waktu: ${elapsedTime}s`;

    if (coins.length === 0) {
        endGame();
    }
}

function endGame() {
    gameState = 'gameover';
    document.getElementById('game-ui').classList.add('hidden');
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
