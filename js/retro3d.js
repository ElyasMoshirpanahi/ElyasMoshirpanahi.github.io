
// CONFIGURATION
const CONF = {
    speed: 60, // Faster for more energy
    roadWidth: 25,
    palmCount: 12,
    archCount: 8,
    cityBlockCount: 80, // Denser city
    fogColor: 0x050510, // Darker purple/blue
    gridColor: 0xff00ff,
    roadColor: 0x080808,
    neonPink: 0xff00ff,
    neonCyan: 0x00ffff,
    neonBlue: 0x0055ff,
    neonPurple: 0xbc13fe,
    sunColor1: 0xffbd00,
    sunColor2: 0xff00ff
};

// GLOBALS
let scene, camera, renderer;
let clock, delta;
let car;
let roadSystem = []; // Moving objects
let cityBlocks = [];
let palms = [];
let arches = [];
let gridPlane;
let tronStation;
let tronBeam;
let sun;
let audioListener, bgMusic, sfxBeam, sfxHover;
let musicPlaying = true;
let soundEnabled = true;
let simplex = new SimplexNoise();

// INIT
function init() {
    const container = document.getElementById('canvas-container');

    // SCENE
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(CONF.fogColor, 0.006);
    scene.background = new THREE.Color(CONF.fogColor);

    // CAMERA
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.set(0, 5, 22); // Slightly lower and closer for speed feel
    camera.lookAt(0, 3, -50);

    // RENDERER
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap pixel ratio for perf
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // CLOCK
    clock = new THREE.Clock();

    // LIGHTS
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
    sunLight.position.set(0, 50, -100);
    scene.add(sunLight);
    
    // Car Glow
    const carLight = new THREE.PointLight(CONF.neonCyan, 2, 40);
    carLight.position.set(0, 2, 15);
    scene.add(carLight);

    // BUILD WORLD
    createSun();
    createSoundWaveGrid();
    createReflectiveRoad();
    createNeonCity();
    createNeonPalms();
    createWiderArches();
    createTronStation();
    createSleekCar();
    createStarfield();

    // AUDIO
    setupAudio();

    // LISTENERS
    window.addEventListener('resize', onWindowResize, false);
    window.addEventListener('click', resumeAudioContext, { once: true });
    window.addEventListener('keydown', resumeAudioContext, { once: true });
    
    // Button Logic
    document.getElementById('music-toggle').addEventListener('click', toggleMusic);
    document.getElementById('sound-toggle').addEventListener('click', toggleSound);
    
    // Hover Sounds
    const buttons = document.querySelectorAll('.btn, .social-icon, .project-card');
    buttons.forEach(btn => {
        btn.addEventListener('mouseenter', playHoverSound);
        btn.addEventListener('click', () => playHoverSound(0.5));
    });

    // START LOOP
    animate();
    
    // BEAM TIMER
    setInterval(fireTronBeam, 30000); // Every 30s
}

// AUDIO CONTEXT RESUME
function resumeAudioContext() {
    if (audioListener && audioListener.context.state === 'suspended') {
        audioListener.context.resume();
    }
    if (musicPlaying && bgMusic && !bgMusic.isPlaying) {
        bgMusic.play();
    }
}

// --- CREATION FUNCTIONS ---

function createSun() {
    const geometry = new THREE.CircleGeometry(200, 64);
    const material = new THREE.ShaderMaterial({
        uniforms: {
            color1: { value: new THREE.Color(CONF.sunColor1) },
            color2: { value: new THREE.Color(CONF.sunColor2) }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 color1;
            uniform vec3 color2;
            varying vec2 vUv;
            void main() {
                vec3 color = mix(color2, color1, vUv.y);
                // Scanline cuts
                float scanline = step(0.1, mod(vUv.y * 25.0, 1.0));
                if (vUv.y < 0.5) color *= scanline; 
                gl_FragColor = vec4(color, 1.0);
            }
        `,
        transparent: true
    });
    sun = new THREE.Mesh(geometry, material);
    sun.position.set(0, 60, -800);
    scene.add(sun);
}

function createSoundWaveGrid() {
    // High res grid for smooth waves
    const geometry = new THREE.PlaneGeometry(800, 1000, 100, 100);
    geometry.rotateX(-Math.PI / 2);
    
    const material = new THREE.MeshBasicMaterial({ 
        color: CONF.neonPink, 
        wireframe: true,
        transparent: true,
        opacity: 0.25
    });
    
    gridPlane = new THREE.Mesh(geometry, material);
    gridPlane.position.y = -4; // Lower than road
    scene.add(gridPlane);
    
    // Store original for animation
    gridPlane.userData.originalPos = geometry.attributes.position.clone();
}

function createReflectiveRoad() {
    const geometry = new THREE.PlaneGeometry(CONF.roadWidth, 1000);
    geometry.rotateX(-Math.PI / 2);
    const material = new THREE.MeshStandardMaterial({
        color: 0x000000,
        roughness: 0.05, // Very shiny
        metalness: 0.9,
        envMapIntensity: 1
    });
    const road = new THREE.Mesh(geometry, material);
    road.position.y = -2;
    road.position.z = -100;
    scene.add(road);
    
    // Neon Edges
    const lineGeo = new THREE.BoxGeometry(0.8, 0.5, 1000);
    const lineMat = new THREE.MeshBasicMaterial({ 
        color: CONF.neonCyan,
        transparent: true,
        opacity: 0.8
    });
    
    const leftLine = new THREE.Mesh(lineGeo, lineMat);
    leftLine.position.set(-CONF.roadWidth/2 - 0.4, -1.8, -100);
    scene.add(leftLine);
    
    const rightLine = new THREE.Mesh(lineGeo, lineMat);
    rightLine.position.set(CONF.roadWidth/2 + 0.4, -1.8, -100);
    scene.add(rightLine);
}

function createSleekCar() {
    // Using ExtrudeGeometry for a sharp wedge profile
    car = new THREE.Group();

    // Materials
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 1.0, roughness: 0.2 });
    const glassMat = new THREE.MeshPhongMaterial({ color: 0x000000, shininess: 150, specular: 0xffffff });
    const glowMat = new THREE.MeshBasicMaterial({ color: CONF.neonCyan });
    const tailLightMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });

    // 1. MAIN BODY PROFILE (Side View)
    const length = 9;
    const width = 3.8;
    
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.5); // Rear bottom
    shape.lineTo(0, 1.8); // Rear deck
    shape.lineTo(1.5, 2.6); // Roof back
    shape.lineTo(4.5, 2.6); // Roof front
    shape.lineTo(7.5, 1.4); // Hood back
    shape.lineTo(9, 1.0); // Nose top
    shape.lineTo(9, 0.5); // Nose bottom
    shape.lineTo(8, 0.2); // Front wheel well start
    shape.lineTo(6.5, 0.2); // Front wheel well end
    shape.lineTo(6.5, 0.5); 
    shape.lineTo(2.5, 0.5);
    shape.lineTo(2.5, 0.2); // Rear wheel well start
    shape.lineTo(1.0, 0.2); // Rear wheel well end
    shape.lineTo(1.0, 0.5);
    shape.lineTo(0, 0.5); // Back to start

    const extrudeSettings = {
        steps: 1,
        depth: width,
        bevelEnabled: true,
        bevelThickness: 0.1,
        bevelSize: 0.1,
        bevelSegments: 2
    };

    const bodyGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    // Center the mesh
    body.rotation.y = Math.PI; // Flip to face forward
    body.position.set(length/2, 0.8, -width/2); // Adjust pivot
    
    // The ExtrudeGeometry creates the car sideways along Z. We need to rotate it correctly.
    // Actually, Extrude extrudes along Z. The shape is in XY plane.
    // So looking at the shape, Y is height, X is length. Z is width.
    // Car needs to face -Z. 
    // Current Shape: Nose is at X=9. Rear at X=0. 
    // So X axis is Length. Z axis is Width.
    // To face -Z, we rotate Y by -90 deg?
    
    // Let's put it in a holder to rotate easily
    const carBodyHolder = new THREE.Mesh(bodyGeo, bodyMat);
    // Center geometry
    carBodyHolder.geometry.center(); 
    // Now Nose is at +X. 
    carBodyHolder.rotation.y = Math.PI / 2; // Nose at -Z (into screen)
    
    car.add(carBodyHolder);

    // 2. GLASS CABIN
    // Simple box intersecting the body for now, or a smaller extruded shape
    const glassGeo = new THREE.BoxGeometry(3.2, 1.0, 2.5);
    const glass = new THREE.Mesh(glassGeo, glassMat);
    glass.position.set(0, 2.1, 0.5); // Shifted back
    car.add(glass);

    // 3. WHEELS (Glowing Turbines)
    const wheelGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.6, 32);
    wheelGeo.rotateZ(Math.PI/2);
    
    const wMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const rimMat = new THREE.MeshBasicMaterial({ color: CONF.neonCyan });

    const positions = [
        [-2.2, 0.8, 2.0], [2.2, 0.8, 2.0],   // Front
        [-2.2, 0.8, -2.0], [2.2, 0.8, -2.0]  // Rear (Wait, Nose is -Z, so Rear is +Z)
    ];
    // My coordinates above might be flipped relative to "Nose at -Z"
    // Let's re-verify. 
    // carBodyHolder: Nose at -Z.
    // So Front wheels should be negative Z. Rear wheels positive Z.
    // Correct.

    positions.forEach(pos => {
        const w = new THREE.Mesh(wheelGeo, wMat);
        w.position.set(pos[0], 0.8, pos[2]); // Y is height
        car.add(w);
        
        // Neon Rim
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 8, 32), rimMat);
        rim.rotation.y = Math.PI / 2;
        rim.position.set(pos[0] > 0 ? pos[0] + 0.31 : pos[0] - 0.31, 0.8, pos[2]);
        car.add(rim);
    });

    // 4. TAIL LIGHTS (The Cyberpunk Strip)
    const tailStrip = new THREE.Mesh(
        new THREE.BoxGeometry(3.6, 0.4, 0.1),
        tailLightMat
    );
    tailStrip.position.set(0, 1.5, 4.5); // Rear is +Z
    car.add(tailStrip);
    
    // Glow halo for tail
    const tailGlow = new THREE.PointLight(0xff0000, 1, 10);
    tailGlow.position.set(0, 1.5, 5.0);
    car.add(tailGlow);

    // 5. UNDERGLOW
    const under = new THREE.Mesh(
        new THREE.PlaneGeometry(3.5, 8.5),
        new THREE.MeshBasicMaterial({ color: CONF.neonCyan, transparent: true, opacity: 0.4, side: THREE.DoubleSide })
    );
    under.rotation.x = Math.PI/2;
    under.position.y = 0.2;
    car.add(under);

    // Position Car
    car.position.set(0, 0, 15);
    // car.rotation.y = 0; // Already facing -Z
    
    scene.add(car);
}

function createNeonCity() {
    // Vast field of neon towers
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    // Move pivot to bottom
    geometry.translate(0, 0.5, 0);
    
    const material = new THREE.MeshBasicMaterial({ 
        color: 0x000000, 
        transparent: true, 
        opacity: 0.9 
    });
    const edgeMat = new THREE.LineBasicMaterial({ color: CONF.neonPurple });
    const edgeMat2 = new THREE.LineBasicMaterial({ color: CONF.neonBlue });

    // Create clusters
    for (let i = 0; i < CONF.cityBlockCount; i++) {
        // Size
        const w = 10 + Math.random() * 15;
        const d = 10 + Math.random() * 15;
        const h = 20 + Math.random() * 60;
        
        const block = new THREE.Mesh(geometry, material);
        block.scale.set(w, h, d);
        
        // Position: Avoid the road (x: -30 to 30)
        let x = (Math.random() * 600 - 300);
        if (Math.abs(x) < 40) x = x < 0 ? -50 : 50; // Push out
        
        const z = -Math.random() * 800 - 100; // Far back
        
        block.position.set(x, -5, z);
        
        // Wireframe Edges
        const edges = new THREE.EdgesGeometry(geometry);
        const wireframe = new THREE.LineSegments(edges, Math.random() > 0.5 ? edgeMat : edgeMat2);
        block.add(wireframe);
        
        scene.add(block);
        cityBlocks.push(block);
    }
}

function createNeonPalms() {
    // Stylized Neon Palms (Wireframe look)
    for (let i = 0; i < CONF.palmCount * 2; i++) {
        const group = new THREE.Group();
        
        // Trunk: Stack of rings/segments
        const trunkMat = new THREE.MeshBasicMaterial({ color: CONF.neonPurple });
        for(let j=0; j<8; j++) {
            const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 1.5, 6), trunkMat);
            seg.position.y = j * 1.2;
            seg.rotation.z = Math.sin(j) * 0.1; // Curving
            group.add(seg);
        }
        
        // Leaves: Glowing curves
        const leafMat = new THREE.LineBasicMaterial({ color: CONF.neonCyan });
        for(let k=0; k<6; k++) {
            const curve = new THREE.QuadraticBezierCurve3(
                new THREE.Vector3(0, 9, 0),
                new THREE.Vector3(Math.cos(k)*3, 11, Math.sin(k)*3),
                new THREE.Vector3(Math.cos(k)*6, 6, Math.sin(k)*6)
            );
            const pts = curve.getPoints(10);
            const geo = new THREE.BufferGeometry().setFromPoints(pts);
            const leaf = new THREE.Line(geo, leafMat);
            group.add(leaf);
        }

        // Position
        const side = (i % 2 === 0) ? 1 : -1;
        group.position.set(side * (CONF.roadWidth/2 + 8), -2, -i * 60);
        
        scene.add(group);
        palms.push(group);
    }
}

function createWiderArches() {
    const geometry = new THREE.TorusGeometry(55, 0.8, 8, 50, Math.PI); // Huge arches
    const material = new THREE.MeshBasicMaterial({ color: CONF.neonCyan });
    
    for(let i=0; i<CONF.archCount; i++) {
        const arch = new THREE.Mesh(geometry, material);
        arch.position.set(0, -5, -i * 150);
        scene.add(arch);
        arches.push(arch);
    }
}

function createTronStation() {
    tronStation = new THREE.Group();
    
    // Massive Monolith
    const geo = new THREE.BoxGeometry(60, 100, 20);
    const mat = new THREE.MeshBasicMaterial({ color: 0x050505 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 50;
    tronStation.add(mesh);
    
    // Glowing Core
    const core = new THREE.Mesh(
        new THREE.BoxGeometry(10, 120, 5),
        new THREE.MeshBasicMaterial({ color: CONF.neonBlue })
    );
    core.position.y = 50;
    core.position.z = 10;
    tronStation.add(core);
    
    // Beam
    const beamGeo = new THREE.CylinderGeometry(4, 4, 1000, 16);
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
    tronBeam = new THREE.Mesh(beamGeo, beamMat);
    tronBeam.position.y = 500;
    tronStation.add(tronBeam);
    
    tronStation.position.set(0, -5, -900);
    scene.add(tronStation);
}

function createStarfield() {
    const geometry = new THREE.BufferGeometry();
    const count = 2000;
    const positions = new Float32Array(count * 3);
    
    for(let i=0; i<count*3; i+=3) {
        positions[i] = (Math.random() - 0.5) * 2000;
        positions[i+1] = Math.random() * 1000 + 200; // Only sky
        positions[i+2] = -Math.random() * 2000;
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color: 0xffffff, size: 2, transparent: true, opacity: 0.8 });
    const stars = new THREE.Points(geometry, material);
    scene.add(stars);
}

function setupAudio() {
    audioListener = new THREE.AudioListener();
    camera.add(audioListener);
    
    // Music
    bgMusic = new THREE.Audio(audioListener);
    const audioLoader = new THREE.AudioLoader();
    
    audioLoader.load('music/RETRO1.m4a', function(buffer) {
        bgMusic.setBuffer(buffer);
        bgMusic.setLoop(true);
        bgMusic.setVolume(0.6);
        bgMusic.play().catch(e => console.log("Click to play"));
    });
    
    // SFX Beam
    sfxBeam = new THREE.Audio(audioListener);
    audioLoader.load('sounds/science-fiction-effect-020-305484.mp3', function(buffer) {
        sfxBeam.setBuffer(buffer);
        sfxBeam.setVolume(1.0);
    });
    
    // SFX Hover
    sfxHover = new THREE.Audio(audioListener);
    audioLoader.load('sounds/pulse_sound_try1-89547.mp3', function(buffer) {
        sfxHover.setBuffer(buffer);
        sfxHover.setVolume(0.4);
    });
}

// --- ANIMATION ---

function animate() {
    requestAnimationFrame(animate);
    
    delta = clock.getDelta();
    const time = clock.getElapsedTime();
    
    // Speed simulation
    const speed = CONF.speed * delta;
    
    // Move Palms
    palms.forEach(palm => {
        palm.position.z += speed;
        if (palm.position.z > 20) palm.position.z = -700;
        // Rotate leaves slightly
        palm.rotation.y += delta * 0.1; 
    });
    
    // Move Arches
    arches.forEach(arch => {
        arch.position.z += speed;
        if (arch.position.z > 20) arch.position.z = -1200;
    });
    
    // Grid Wave Animation
    if (gridPlane && simplex) {
        const pos = gridPlane.geometry.attributes.position;
        const orig = gridPlane.userData.originalPos;
        
        // Pulse grid based on time (Beat simulation)
        const beat = Math.sin(time * 8) * 0.5 + 0.5;
        
        for (let i = 0; i < pos.count; i++) {
            const x = orig.getX(i);
            const z = orig.getY(i); // Plane rotated, so Y is Z depth
            
            // Keep road flat
            if (Math.abs(x) < CONF.roadWidth / 2 + 5) {
                pos.setZ(i, 0);
                continue;
            }
            
            // "Sound Wave" effect on sides
            // Higher amplitude further out
            const dist = Math.abs(x) / 50;
            
            // Noise moving towards camera (+z)
            // simplex.noise2D(x, y)
            const noise = simplex.noise2D(x * 0.02, z * 0.01 + time * 0.5);
            
            // Equalizer bars effect: quantize the wave? 
            // Or just jagged peaks
            let height = noise * 15 * dist;
            
            // Add pulse
            height *= (0.8 + beat * 0.4);
            
            pos.setZ(i, height);
        }
        pos.needsUpdate = true;
    }
    
    // Car bounce
    if (car) {
        car.position.y = Math.sin(time * 15) * 0.03;
        // Slight sway
        car.rotation.z = Math.sin(time * 2) * 0.02;
    }
    
    // City movement (Parallax)
    // Actually, city should stay far, but maybe loop slowly? 
    // Let's just let them be static "horizon" objects for scale, 
    // or move very slowly if we want infinite city.
    // Let's move them slowly to feel like driving through a mega-city
    cityBlocks.forEach(b => {
        b.position.z += speed * 0.2; // Parallax speed
        if (b.position.z > 50) b.position.z = -800;
    });

    renderer.render(scene, camera);
}

function fireTronBeam() {
    if (!sfxBeam) return;
    
    if (soundEnabled) {
        if(sfxBeam.isPlaying) sfxBeam.stop();
        sfxBeam.play();
    }
    
    // Tween opacity
    new TWEEN.Tween(tronBeam.material)
        .to({ opacity: 1 }, 500)
        .easing(TWEEN.Easing.Circular.Out)
        .start()
        .onComplete(() => {
            setTimeout(() => {
                 new TWEEN.Tween(tronBeam.material).to({ opacity: 0 }, 2000).start();
            }, 2000);
        });
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function toggleMusic() {
    const btn = document.getElementById('music-toggle');
    if (musicPlaying) {
        bgMusic.pause();
        btn.classList.add('off');
        btn.innerText = 'Music: OFF';
    } else {
        bgMusic.play();
        btn.classList.remove('off');
        btn.innerText = 'Music: ON';
    }
    musicPlaying = !musicPlaying;
}

function toggleSound() {
    const btn = document.getElementById('sound-toggle');
    soundEnabled = !soundEnabled;
    if (soundEnabled) {
        btn.classList.remove('off');
        btn.innerText = 'Sound: ON';
    } else {
        btn.classList.add('off');
        btn.innerText = 'Sound: OFF';
    }
}

function playHoverSound(vol) {
    resumeAudioContext();
    if (soundEnabled && sfxHover && sfxHover.buffer) {
        if (sfxHover.isPlaying) sfxHover.stop();
        sfxHover.setVolume(vol || 0.4);
        sfxHover.play();
    }
}

const _origAnimate = animate;
animate = function() {
    TWEEN.update();
    _origAnimate();
};

init();
