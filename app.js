let audioStarted = false;
let currentGenre = "Afro House";
let currentBPM = 120;
let isPlaying = false;

let masterRecorder;
let recordedAudioBlob = null;
let isRecording = false;

let producer = { name: "Produtor Independente", email: "email@exemplo.com", tag: "PROD" };

let kickSynth, clapSynth, hatSynth, squatBass, tecladosSynth, cristalSynth, stringsSynth, vocalChopSynth;
let masterReverb, analogSaturator, masterPitch, vocalFX, masterGain, masterLimiter;

let customPlayers = {};

const padDefinitions = [
    { id: 0, cat: "Drum", name: "Punch Kick" }, { id: 1, cat: "Drum", name: "Clap" },
    { id: 2, cat: "Perc", name: "Shaker" }, { id: 3, cat: "Bass", name: "Squat Bass" },
    { id: 4, cat: "Keys", name: "Teclados" }, { id: 5, cat: "Lead", name: "Cristal Pluck" },
    { id: 6, cat: "Strings", name: "Violin" }, { id: 7, cat: "Perc", name: "Conga" },
    { id: 8, cat: "FX", name: "Impact FX" }, { id: 9, cat: "Vocal", name: "Vocal Chop" },
    { id: 10, cat: "Perc", name: "Rimshot" }, { id: 11, cat: "Hat", name: "Open Hat" },
    { id: 12, cat: "Drum", name: "808 Kick" }, { id: 13, cat: "Cymbal", name: "Crash" },
    { id: 14, cat: "Keys", name: "Deep Pad" }, { id: 15, cat: "FX", name: "Sweep Riser" }
];

const seqInstruments = ["Kick", "Clap", "Hats", "Squat Bass", "Teclados", "Cristal", "Strings", "Vocal"];
let sequencerData = {};

function initSequencerData() {
    seqInstruments.forEach(function(inst) { sequencerData[inst] = new Array(16).fill(false); });
}
initSequencerData();

// O botão mágico e 100% blindado
const btnEnter = document.getElementById('btn-enter');
if (btnEnter) {
    btnEnter.addEventListener('click', async function() {
        try {
            await Tone.start();
            audioStarted = true;
            setupStudioAudioChain();
            kickSynth.triggerAttackRelease("C1", "8n");

            document.getElementById('splash-screen').classList.add('hidden');
            document.getElementById('app-container').classList.remove('hidden');

            renderPads();
            setupExtraPads();
            loadProfile();
            loadProfessionalPattern(currentGenre);
            setupUSBMIDI();
        } catch (err) {
            console.error(err);
            alert("Erro ao iniciar áudio. Atualize a página.");
        }
    });
}

function setupStudioAudioChain() {
    masterLimiter = new Tone.Limiter(-0.5).toDestination();
    masterGain = new Tone.Gain(0.85).connect(masterLimiter);

    masterRecorder = new Tone.Recorder();
    masterGain.connect(masterRecorder);

    masterPitch = new Tone.PitchShift(0).connect(masterGain);
    
    // ATENÇÃO: O número aqui tem de ser inteiro.
    analogSaturator = new Tone.Chebyshev(2).connect(masterPitch);
    
    masterReverb = new Tone.Reverb({ roomSize: 0.7, wet: 0.15 }).connect(analogSaturator);
    vocalFX = new Tone.PingPongDelay("8n", 0).connect(masterReverb);

    kickSynth = new Tone.MembraneSynth().connect(analogSaturator);
    clapSynth = new Tone.NoiseSynth().connect(masterReverb);
    hatSynth = new Tone.MetalSynth({ frequency: 250 }).connect(masterPitch);
    squatBass = new Tone.FMSynth({ harmonicity: 0.5, modulationIndex: 5, oscillator: { type: "sawtooth" } }).connect(analogSaturator);
    tecladosSynth = new Tone.PolySynth(Tone.Synth).connect(masterReverb);
    cristalSynth = new Tone.PolySynth(Tone.FMSynth, { harmonicity: 4.5, modulationIndex: 12, oscillator: { type: "sine" } }).connect(masterReverb);
    stringsSynth = new Tone.PolySynth(Tone.AMSynth).connect(masterReverb);
    vocalChopSynth = new Tone.Synth({ oscillator: { type: "pwm" } }).connect(vocalFX);
}

function setupExtraPads() {
    ['A', 'B', 'C', 'D'].forEach(function(id) {
        const inputUpload = document.getElementById('import-ext-' + id);
        if (inputUpload) {
            inputUpload.addEventListener('change', function(e) {
                const file = e.target.files[0];
                if (file) {
                    const nameLabel = document.getElementById('name-ext-' + id);
                    nameLabel.textContent = "A carregar...";
                    nameLabel.style.color = "var(--accent-yellow)";

                    const reader = new FileReader();
                    reader.onload = async function(event) {
                        try {
                            const arrayBuffer = event.target.result;
                            const audioBuffer = await Tone.context.decodeAudioData(arrayBuffer);
                            
                            if (customPlayers[id]) { customPlayers[id].dispose(); }
                            
                            // Liga direto ao master para som limpo (sem chiado)
                            customPlayers[id] = new Tone.Player(audioBuffer).connect(masterGain);
                            
                            nameLabel.textContent = file.name.substring(0, 10);
                            nameLabel.style.color = "#27ae60"; 
                            
                            // Preenche o tempo no Cartão de Mixagem
                            const duration = customPlayers[id].buffer.duration;
                            document.getElementById('end-ext-' + id).value = duration.toFixed(1);
                        } catch (err) {
                            nameLabel.textContent = "ERRO";
                            nameLabel.style.color = "#e74c3c";
                        }
                    };
                    reader.readAsArrayBuffer(file);
                }
            });
        }

        const padEl = document.getElementById('pad-ext-' + id);
        if (padEl) {
            padEl.addEventListener('mousedown', function(e) {
                // Impede que a música toque se estiver a clicar nos botões do cartão
                if (e.target.closest('.mix-card') || e.target.tagName === 'LABEL' || e.target.tagName === 'INPUT') return;
                if (!audioStarted) return;
                
                padEl.classList.add('playing');

                if (customPlayers[id] && customPlayers[id].loaded) {
                    if (customPlayers[id].state === "started") { customPlayers[id].stop(); }
                    
                    const startInput = parseFloat(document.getElementById('start-ext-' + id).value) || 0;
                    const endInput = parseFloat(document.getElementById('end-ext-' + id).value) || 0;
                    
                    let offsetTime = startInput < 0 ? 0 : startInput;
                    let playDuration = 0;
                    
                    if (endInput > offsetTime) { playDuration = endInput - offsetTime; }

                    // Faz o corte exato definido no cartão
                    if (playDuration > 0) {
                        customPlayers[id].start(Tone.now(), offsetTime, playDuration);
                    } else {
                        customPlayers[id].start(Tone.now(), offsetTime);
                    }
                }
            });

            padEl.addEventListener('mouseup', function() { padEl.classList.remove('playing'); });
            padEl.addEventListener('mouseleave', function() { padEl.classList.remove('playing'); });
        }
    });
}

const btnRec = document.getElementById('btn-rec');
if (btnRec) {
    btnRec.addEventListener('click', async function() {
        if (!audioStarted) return;
        if (!isRecording) {
            masterRecorder.start();
            isRecording = true;
            btnRec.style.background = "#ff0000";
            btnRec.textContent = "⏹️ PARAR GRAVAÇÃO";
            document.getElementById('now-playing').textContent = "GRAVANDO ÁUDIO MASTER...";
        } else {
            recordedAudioBlob = await masterRecorder.stop();
            isRecording = false;
            btnRec.style.background = "#e74c3c";
            btnRec.textContent = "⏺️ REC (Gravar)";
            alert("Áudio capturado! Clique em Exportar.");
            document.getElementById('now-playing').textContent = "Áudio capturado e pronto para exportar.";
        }
    });
}

const btnExport = document.getElementById('btn-export-wav');
if (btnExport) {
    btnExport.addEventListener('click', function() {
        if (!recordedAudioBlob) { alert("Grave o áudio primeiro!"); return; }
        const url = URL.createObjectURL(recordedAudioBlob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = producer.tag + "Master" + new Date().getTime() + ".webm";
        anchor.click();
    });
}

function updateScoreView() {
    const isrcFicticio = 'BR-' + producer.tag.substring(0,3).toUpperCase() + '-' + new Date().getFullYear() + '-0001';

    const scoreMeta = document.getElementById('score-meta');
    if (scoreMeta) {
        scoreMeta.innerHTML =
            '<p style="color:var(--accent-yellow); font-weight:bold;">INTERNATIONAL MUSIC SCORE REGISTRATION</p>' +
            '<p><strong>COMPOSER:</strong> ' + producer.name + '</p>' +
            '<p><strong>EMAIL:</strong> ' + producer.email + '</p>' +
            '<p><strong>ISRC:</strong> ' + isrcFicticio + '</p>' +
            '<p><strong>STYLE:</strong> ' + currentGenre + ' | <strong>BPM:</strong> ' + currentBPM + ' | <strong>TIME SIG:</strong> 4/4</p>';
    }

    let ascii = '==================================================\n';
    ascii += 'INTERNATIONAL DRUM TABLATURE & SEQUENCER EVENT LIST\n';
    ascii += '==================================================\n';
    ascii += 'COMPOSER: ' + producer.name + '\n';
    ascii += 'TRACK ID: ' + isrcFicticio + '\n';
    ascii += 'TEMPO: ' + currentBPM + ' BPM | KEY: D# minor\n';
    ascii += '--------------------------------------------------\n';
    ascii += 'BEAT(16th): | 1 e & a | 2 e & a | 3 e & a | 4 e & a |\n';
    ascii += '--------------------------------------------------\n';

    seqInstruments.forEach(function(inst) {
        let line = inst.padEnd(11, ' ') + ' | ';
        for (let i = 0; i < 16; i++) {
            line += sequencerData[inst][i] ? 'X ' : '- ';
            if ((i + 1) % 4 === 0 && i !== 15) line += '| ';
        }
        ascii += '|\n' + line;
    });

    ascii += '\n\nCOPYRIGHT (C) ' + new Date().getFullYear() + ' ' + producer.name + '. ALL RIGHTS RESERVED.';
    
    const scoreAscii = document.getElementById('score-ascii');
    if (scoreAscii) scoreAscii.textContent = ascii;
}

const btnProfileOpen = document.getElementById('btn-profile-open');
if (btnProfileOpen) btnProfileOpen.addEventListener('click', function() { document.getElementById('profile-modal').classList.remove('hidden'); loadProfile(); });

const btnProfileClose = document.getElementById('btn-profile-close');
if (btnProfileClose) btnProfileClose.addEventListener('click', function() { document.getElementById('profile-modal').classList.add('hidden'); });

const profileForm = document.getElementById('profile-form');
if (profileForm) {
    profileForm.addEventListener('submit', function(e) {
        e.preventDefault();
        producer.name = document.getElementById('prof-name').value;
        producer.email = document.getElementById('prof-email').value;
        producer.tag = document.getElementById('prof-tag').value;
        localStorage.setItem('mpc_producer', JSON.stringify(producer));
        document.getElementById('profile-modal').classList.add('hidden');
        updateScoreView();
        alert("Perfil salvo. Partitura Internacional atualizada!");
    });
}

function loadProfile() {
    const saved = localStorage.getItem('mpc_producer');
    if (saved) {
        producer = JSON.parse(saved);
        if(document.getElementById('prof-name')) document.getElementById('prof-name').value = producer.name;
        if(document.getElementById('prof-email')) document.getElementById('prof-email').value = producer.email;
        if(document.getElementById('prof-tag')) document.getElementById('prof-tag').value = producer.tag;
    }
}

const btnGenScore = document.getElementById('btn-gen-score');
if (btnGenScore) btnGenScore.addEventListener('click', updateScoreView);

const btnDownloadScore = document.getElementById('btn-download-score');
if (btnDownloadScore) {
    btnDownloadScore.addEventListener('click', function() {
        const text = document.getElementById('score-ascii').textContent;
        const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = producer.tag + "_International_Score.txt";
        anchor.click();
    });
}

function updateSynthsForGenre(genre) {
    if (genre === "Deep House") { squatBass.set({ oscillator: { type: "sine" }, harmonicity: 0.5 }); cristalSynth.set({ harmonicity: 2.0 }); } 
    else if (genre === "Afro House") { squatBass.set({ oscillator: { type: "square" }, harmonicity: 1.5 }); cristalSynth.set({ harmonicity: 5.5 }); } 
    else { squatBass.set({ oscillator: { type: "sawtooth" }, harmonicity: 1.0 }); cristalSynth.set({ harmonicity: 4.5 }); }
}

function loadProfessionalPattern(genre) {
    initSequencerData();
    if (genre === "Afro House") { [0, 4, 8, 12].forEach(i => sequencerData["Kick"][i] = true); [4, 12].forEach(i => sequencerData["Clap"][i] = true); [2, 6, 7, 10, 14].forEach(i => sequencerData["Hats"][i] = true); [3, 8, 11].forEach(i => sequencerData["Squat Bass"][i] = true); [7, 14].forEach(i => sequencerData["Cristal"][i] = true); }
    else if (genre === "Hip Hop") { [0, 7, 10].forEach(i => sequencerData["Kick"][i] = true); [4, 12].forEach(i => sequencerData["Clap"][i] = true); [0, 2, 4, 6, 8, 10, 12, 14].forEach(i => sequencerData["Hats"][i] = true); [0, 7, 10].forEach(i => sequencerData["Squat Bass"][i] = true); [0, 8].forEach(i => sequencerData["Teclados"][i] = true); }
    else if (genre === "Deep House") { [0, 4, 8, 12].forEach(i => sequencerData["Kick"][i] = true); [4, 12].forEach(i => sequencerData["Clap"][i] = true); [2, 6, 10, 14].forEach(i => sequencerData["Hats"][i] = true); [2, 5, 8, 14].forEach(i => sequencerData["Squat Bass"][i] = true); [0].forEach(i => sequencerData["Strings"][i] = true); }
    else { [0, 4, 8, 12].forEach(i => sequencerData["Kick"][i] = true); [4, 12].forEach(i => sequencerData["Clap"][i] = true); [2, 6, 10, 14].forEach(i => sequencerData["Hats"][i] = true); [0, 8].forEach(i => sequencerData["Squat Bass"][i] = true); [0].forEach(i => sequencerData["Teclados"][i] = true); }
    renderSequencer();
    updateScoreView();
    const nowPlaying = document.getElementById('now-playing');
    if (nowPlaying) nowPlaying.textContent = 'Padrão Profissional Carregado: ' + genre;
}

document.querySelectorAll('#genre-list li').forEach(function(item) {
    item.addEventListener('click', function(e) {
        document.querySelectorAll('#genre-list li').forEach(l => l.classList.remove('active'));
        e.target.classList.add('active');
        currentGenre = e.target.dataset.genre;
        
        const projectTitle = document.getElementById('project-title');
        if (projectTitle) projectTitle.textContent = currentGenre + ' — Ultimate';
        
        updateSynthsForGenre(currentGenre);
        loadProfessionalPattern(currentGenre);
    });
});

function renderPads() {
    const grid = document.getElementById('pads-grid');
    if (!grid) return;
    grid.innerHTML = "";
    padDefinitions.forEach(function(p, index) {
        const padEl = document.createElement('div');
        padEl.className = 'pad';
        padEl.id = 'pad-' + index;
        padEl.innerHTML = '<span class="pad-cat">' + p.cat + '</span><span class="pad-name">' + p.name + '</span>';
        padEl.addEventListener('mousedown', function() { triggerStudioSound(index); });
        padEl.addEventListener('mouseup', function() { padEl.classList.remove('playing'); });
        padEl.addEventListener('mouseleave', function() { padEl.classList.remove('playing'); });
        grid.appendChild(padEl);
    });
}

function triggerStudioSound(padIndex) {
    if (!audioStarted) return;
    const now = Tone.now();
    const pad = padDefinitions[padIndex];
    const padElement = document.getElementById('pad-' + padIndex);
    if(padElement) padElement.classList.add('playing');

    let rootNote = (currentGenre === "Deep House") ? "C" : (currentGenre === "Afro House") ? "F#" : "Eb";

    switch(pad.name) {
        case "Punch Kick": kickSynth.triggerAttackRelease(rootNote + "1", "8n", now); break;
        case "808 Kick": kickSynth.triggerAttackRelease(rootNote + "0", "2n", now); break;
        case "Clap": clapSynth.triggerAttackRelease("8n", now); break;
        case "Shaker": hatSynth.triggerAttackRelease("32n", now); break;
        case "Squat Bass": squatBass.triggerAttackRelease(rootNote + "2", "8n", now); break;
        case "Teclados": tecladosSynth.triggerAttackRelease([rootNote + "3", rootNote + "4"], "4n", now); break;
        case "Deep Pad": tecladosSynth.triggerAttackRelease([rootNote + "2", rootNote + "3", "G3"], "1m", now); break;
        case "Cristal Pluck": cristalSynth.triggerAttackRelease(rootNote + "4", "8n", now); break;
        case "Violin": stringsSynth.triggerAttackRelease([rootNote + "4", "Bb4"], "2n", now); break;
        case "Vocal Chop": vocalChopSynth.triggerAttackRelease(rootNote + "5", "8n", now); break;
        case "Sweep Riser": hatSynth.triggerAttackRelease("4n", now); break;
        default: hatSynth.triggerAttackRelease("16n", now); break;
    }
    setTimeout(function() { if(padElement) padElement.classList.remove('playing'); }, 150);
}

function renderSequencer() {
    const grid = document.getElementById('sequencer-grid');
    if (!grid) return;
    grid.innerHTML = "";
    seqInstruments.forEach(function(inst) {
        const row = document.createElement('div');
        row.className = 'seq-row';
        const label = document.createElement('span');
        label.className = 'seq-label';
        label.textContent = inst;
        row.appendChild(label);
        const stepsContainer = document.createElement('div');
        stepsContainer.className = 'seq-steps';
        for (let i = 0; i < 16; i++) {
            const step = document.createElement('div');
            step.className = 'step ' + (sequencerData[inst][i] ? 'active' : '');
            step.addEventListener('click', function() {
                sequencerData[inst][i] = !sequencerData[inst][i];
                step.classList.toggle('active');
                updateScoreView();
            });
            stepsContainer.appendChild(step);
        }
        row.appendChild(stepsContainer);
        grid.appendChild(row);
    });
}

const btnPlay = document.getElementById('btn-play');
if (btnPlay) {
    btnPlay.addEventListener('click', function() {
        if (!audioStarted) return;
        Tone.Transport.bpm.value = currentBPM;
        let stepIndex = 0;
        let rootNote = (currentGenre === "Deep House") ? "C" : (currentGenre === "Afro House") ? "F#" : "Eb";

        Tone.Transport.scheduleRepeat(function(time) {
            if (sequencerData["Kick"][stepIndex]) kickSynth.triggerAttackRelease(rootNote + "1", "8n", time);
            if (sequencerData["Clap"][stepIndex]) clapSynth.triggerAttackRelease("8n", time);
            if (sequencerData["Hats"][stepIndex]) hatSynth.triggerAttackRelease("32n", time);
            if (sequencerData["Squat Bass"][stepIndex]) squatBass.triggerAttackRelease(rootNote + "2", "8n", time);
            if (sequencerData["Teclados"][stepIndex]) tecladosSynth.triggerAttackRelease([rootNote + "3", rootNote + "4"], "8n", time);
            if (sequencerData["Cristal"][stepIndex]) cristalSynth.triggerAttackRelease(rootNote + "4", "16n", time);
            if (sequencerData["Strings"][stepIndex]) stringsSynth.triggerAttackRelease([rootNote + "4", "Bb4"], "4n", time);
            if (sequencerData["Vocal"][stepIndex]) vocalChopSynth.triggerAttackRelease(rootNote + "5", "16n", time);

            const allSteps = document.querySelectorAll('.seq-steps .step');
            allSteps.forEach(function(st) { st.style.opacity = '1'; });
            const currentSteps = document.querySelectorAll('.seq-steps .step:nth-child(' + (stepIndex + 1) + ')');
            currentSteps.forEach(function(st) { if(st.classList.contains('active')) st.style.opacity = '0.5'; });

            stepIndex = (stepIndex + 1) % 16;
        }, "16n");
        Tone.Transport.start();
        isPlaying = true;
    });
}

const btnStop = document.getElementById('btn-stop');
if (btnStop) {
    btnStop.addEventListener('click', function() {
        Tone.Transport.stop(); Tone.Transport.cancel(); isPlaying = false;
        document.querySelectorAll('.seq-steps .step').forEach(function(st) { st.style.opacity = '1'; });
    });
}

function setupUSBMIDI() {
    if (navigator.requestMIDIAccess) {
        navigator.requestMIDIAccess().then(function(midiAccess) {
            for (let input of midiAccess.inputs.values()) {
                input.onmidimessage = function(message) {
                    if (message.data[0] === 144 && message.data[2] > 0) {
                        let padIndex = message.data[1] - 36;
                        if(padIndex >= 0 && padIndex < 16) triggerStudioSound(padIndex);
                    }
                };
            }
        });
    }
}

const btnBluetooth = document.getElementById('btn-bluetooth');
if (btnBluetooth) {
    btnBluetooth.addEventListener('click', async function() {
        try {
            const device = await navigator.bluetooth.requestDevice({ filters: [{ services: ['03b80e5a-ede8-4b33-a751-6ce34ec4c700'] }] });
            btnBluetooth.textContent = "✅ BT Conectado";
            alert("Bluetooth MIDI conectado!");
        } catch (error) { alert("Erro BT ou não compatível."); }
    });
}

const masterPitchEl = document.getElementById('master-pitch');
if (masterPitchEl) masterPitchEl.addEventListener('input', function(e) { if(masterPitch) masterPitch.pitch = parseFloat(e.target.value); });

const fxVocalEl = document.getElementById('fx-vocal');
if (fxVocalEl) fxVocalEl.addEventListener('input', function(e) { if(vocalFX) vocalFX.wet.value = parseFloat(e.target.value); });

const volMasterEl = document.getElementById('vol-master');
if (volMasterEl) volMasterEl.addEventListener('input', function(e) { if(masterGain) masterGain.gain.value = Tone.dbToGain(parseFloat(e.target.value)); });

const fxReverbEl = document.getElementById('fx-reverb');
if (fxReverbEl) fxReverbEl.addEventListener('input', function(e) { if(masterReverb) masterReverb.wet.value = parseFloat(e.target.value); });

const bpmInputEl = document.getElementById('bpm-input');
if (bpmInputEl) bpmInputEl.addEventListener('input', function(e) { currentBPM = parseInt(e.target.value); updateScoreView(); });

document.querySelectorAll('.tab-btn').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
        document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
        document.querySelectorAll('.tab-pane').forEach(function(p) { p.classList.remove('active'); });
        e.target.classList.add('active');
        
        const targetId = e.target.dataset.target;
        if (targetId) {
            const targetPane = document.getElementById(targetId);
            if (targetPane) targetPane.classList.add('active');
        }
    });
});