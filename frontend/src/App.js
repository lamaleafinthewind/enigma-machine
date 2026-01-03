
import React, { useEffect, useState, useRef, useCallback } from 'react';
import './App.css';

// Standard Enigma Keyboard Layout (German) (WTF IS THAT P KEY?!?!?!?!)
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const KEYBOARD_ROWS = [
  "QWERTZUIO".split(""),
  "ASDFGHJK".split(""),
  "PYXCVBNML".split("")
];

// Sounds
const useAudio = (url) => {
  const audioRef = useRef(null);

  useEffect(() => {
    audioRef.current = new Audio(url);
  }, [url]);

  const play = () => {
    if (audioRef.current) {
      // audio overlap
      const sound = audioRef.current.cloneNode();
      sound.volume = 0.5; // Adjust volume (0.0 to 1.0)
      sound.play().catch(e => console.log("Audio play failed:", e));
    }
  };

  return play;
};

function App() {
  const [rotorModels, setRotorModels] = useState({ slot1: 1, slot2: 2, slot3: 3 });
  const [isPowered, setIsPowered] = useState(false);
  const [inputLog, setInputLog] = useState("");
  const [outputLog, setOutputLog] = useState("");
  const [rotors, setRotors] = useState({ r1: 0, r2: 0, r3: 0 });
  const [activeLamp, setActiveLamp] = useState(null); // Which lamp is currently lit?
  const [isLoaded, setIsLoaded] = useState(false);
  const enigmaModule = useRef(null);
  // Plugboard
  const [plugs, setPlugs] = useState({}); // format: { 'A': 'Z', 'Z': 'A' }
  const [selectedPlug, setSelectedPlug] = useState(null); // first letter click
  // Sound file
  const playClick = useAudio(process.env.PUBLIC_URL + "/click.wav");


// pasted Text processing
  const handleBatchProcessing = (text) => {
    if (!enigmaModule.current) return;

    // Upper Case and only A-Z
    const cleanText = text.toUpperCase().replace(/[^A-Z]/g, '');

    if (cleanText.length === 0) return;

    let newCiphertext = "";

    // char loop
    for (let i = 0; i < cleanText.length; i++) {
      const charCode = cleanText.charCodeAt(i);

      // c logic for char
      const encryptedCode = enigmaModule.current.ccall(
          'encrypt_one_char',
          'number',
          ['number'],
          [charCode]
      );

      newCiphertext += String.fromCharCode(encryptedCode);
    }

    // log update
    setInputLog(prev => prev + cleanText);
    setOutputLog(prev => prev + newCiphertext);

    // rotor update
    updateRotorState();

    // Lamp for last character "pressed"
    if (newCiphertext.length > 0) {
      setActiveLamp(newCiphertext[newCiphertext.length - 1]);
      // Turn off lamp after delay
      setTimeout(() => setActiveLamp(null), 500);
    }
  };



  const handlePowerOn = () => {
    // wtf why autoplay
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    // start click
    playClick();

    // UI lock
    setIsPowered(true);
  };

  const handleRotorTypeChange = (slot, newModelId) => {
    // update React Rotor state
    const newModels = { ...rotorModels, [slot]: parseInt(newModelId) };
    setRotorModels(newModels);

    // send to C
    if (enigmaModule.current) {
      enigmaModule.current.ccall(
          'configure_machine',
          'null',
          ['number', 'number', 'number', 'number', 'number', 'number'],
          [
            newModels.slot1, rotors.r1,
            newModels.slot2, rotors.r2,
            newModels.slot3, rotors.r3
          ]
      );
    }
  };

  // helper to get offset
  const getRotorChar = (val, offset) => {
    // (val + offset) with negative handling
    const shifted = (val + offset);
    const safeVal = ((shifted % 26) + 26) % 26;
    return String.fromCharCode(safeVal + 65);
  };

  useEffect(() => {
    const script = document.createElement('script');
    script.src = process.env.PUBLIC_URL + "/enigma_core.js";
    script.async = true;
    script.onload = () => {
      window.createEnigmaModule().then((module) => {
        enigmaModule.current = module;
        module.ccall('configure_machine', 'null',
            ['number', 'number', 'number', 'number', 'number', 'number'],
            [1, 0, 2, 0, 3, 0]
        );
        setIsLoaded(true);
      });
    };
    document.body.appendChild(script);
    return () => document.body.removeChild(script);
  }, []);

  const updatePlugboardState = () => {
    if (!enigmaModule.current) return;

    const newPlugs = {};
    for (let i = 0; i < 26; i++) {
      const source = String.fromCharCode(65 + i);
      const targetIdx = enigmaModule.current.ccall('get_plug', 'number', ['number'], [i]);
      const target = String.fromCharCode(65 + targetIdx);

      // Only store if plugged to diff
      if (source !== target) {
        newPlugs[source] = target;
      }
    }
    setPlugs(newPlugs);
  };

  const handlePlugClick = (char) => {
    if (!enigmaModule.current) return;

    // Start selection
    if (!selectedPlug) {
      setSelectedPlug(char);
      return;
    }

    // chars to ASCII codes
    const p1 = selectedPlug.charCodeAt(0);
    const p2 = char.charCodeAt(0);

    // cancel or connect to itself
    if (selectedPlug === char) {
      enigmaModule.current.ccall('set_plug', 'null', ['number', 'number'], [p1, p2]);
      setSelectedPlug(null);
      updatePlugboardState();
      return;
    }

    // different letter --> connect
    // number bruh moment happened here
    enigmaModule.current.ccall('set_plug', 'null', ['number', 'number'], [p1, p2]);

    setSelectedPlug(null);
    updatePlugboardState();
  };

  const updateRotorState = () => {
    if (!enigmaModule.current) return;
    const r1 = enigmaModule.current.ccall('get_rotor_pos', 'number', ['number'], [1]);
    const r2 = enigmaModule.current.ccall('get_rotor_pos', 'number', ['number'], [2]);
    const r3 = enigmaModule.current.ccall('get_rotor_pos', 'number', ['number'], [3]);
    setRotors({ r1, r2, r3 });
  };

  const handleKeyDown = useCallback((e) => {
    if (!isLoaded || !isPowered || e.repeat) return;
    if (e.metaKey || e.ctrlKey || e.altKey) {
      return;
    }

    // Input preparation
    const char = e.key.toUpperCase();
    if (!/^[A-Z]$/.test(char)) return;

    // click sound
    playClick();

    // Get ASCII code
    const charCode = char.charCodeAt(0);

    // call c function
    const encryptedCode = enigmaModule.current.ccall(
        'encrypt_one_char',
        'number',    // number (ASCII code)
        ['number'],  // number
        [charCode]
    );

    // Convert the resul to string
    const encryptedChar = String.fromCharCode(encryptedCode);

    // Update UI
    setActiveLamp(encryptedChar);
    setInputLog(prev => prev + char);
    setOutputLog(prev => prev + encryptedChar);

    // Rotor update
    if (enigmaModule.current) {
      const r1 = enigmaModule.current.ccall('get_rotor_pos', 'number', ['number'], [1]);
      const r2 = enigmaModule.current.ccall('get_rotor_pos', 'number', ['number'], [2]);
      const r3 = enigmaModule.current.ccall('get_rotor_pos', 'number', ['number'], [3]);
      setRotors({ r1, r2, r3 });
    }
  }, [isLoaded, playClick, isPowered]);

  const handleKeyUp = useCallback(() => {
    setActiveLamp(null);
  }, []);

  // Global keyboard listeners (stackoverflow my beloved)
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  const handleReset = () => {
    if(!enigmaModule.current) return;
    enigmaModule.current.ccall(
        'configure_machine',
        'null',
        ['number', 'number', 'number', 'number', 'number', 'number'],
        [rotorModels.slot1, 0, rotorModels.slot2, 0, rotorModels.slot3, 0]
    );

    // Clear plugboard
    enigmaModule.current.ccall('clear_plugboard', 'null', [], []);

    // Clear UI state
    setInputLog("");
    setOutputLog("");
    setRotors({ r1: 0, r2: 0, r3: 0 });
    setActiveLamp(null);
    setSelectedPlug(null);

    // plugborad connection update
    updatePlugboardState();
  };

  const handleSoftReset = () => {
    if(!enigmaModule.current) return;

    enigmaModule.current.ccall(
        'configure_machine',
        'null',
        ['number', 'number', 'number', 'number', 'number', 'number'],
        [rotorModels.slot1, 0, rotorModels.slot2, 0, rotorModels.slot3, 0]
    );

    setInputLog("");
    setOutputLog("");
    setRotors({ r1: 0, r2: 0, r3: 0 }); // Reset visual rotors to 0
    setActiveLamp(null);

    setSelectedPlug(null);

    updatePlugboardState();
  };

  const changeRotor = (index, direction) => {
    if (!enigmaModule.current) return;

    // fetch current value
    const currentVal = index === 1 ? rotors.r1 : index === 2 ? rotors.r2 : rotors.r3;

    // calc new value
    const newVal = (currentVal + direction + 26) % 26;


    enigmaModule.current.ccall(
        'set_rotor',
        'null',
        ['number', 'number'],
        [index, newVal]
    );

    // Rotor update
    updateRotorState();
  };

  return (
      <div className="App">

        {/* POWER SWITCH */}
        {!isPowered && (
            <div className="power-overlay">
              <div className="power-box">
                <h2 style={{color: '#eee', marginBottom: '20px'}}>ENIGMA I</h2>
                <button className="power-btn" onClick={handlePowerOn}>
                  Power On
                </button>
              </div>
            </div>
        )}



        <h1>Enigma I</h1>

        {!isLoaded && <div style={{color: '#ff5555'}}>Initializing Core...</div>}

        {/* ROTORS */}
        <div className="rotor-container">
          {[1, 2, 3].map(rotorIndex => {
            // Identify keys dynamically
            const slotKey = `slot${rotorIndex}`; // "slot1", "slot2", "slot3"
            const currentModel = rotorModels[slotKey];
            const currentPos = rotorIndex === 1 ? rotors.r1 : rotorIndex === 2 ? rotors.r2 : rotors.r3;

            return (
                <div key={rotorIndex} className="rotor-slot">
                  {/* NEW: Rotor Selector Dropdown */}
                  <select
                      className="rotor-select"
                      value={currentModel}
                      onChange={(e) => handleRotorTypeChange(slotKey, e.target.value)}
                  >
                    <option value="1">I</option>
                    <option value="2">II</option>
                    <option value="3">III</option>
                    <option value="4">IV</option>
                    <option value="5">V</option>
                  </select>

                  {/* Thumbwheel (Existing Code) */}
                  <div className="rotor-wheel">
                    <div className="wheel-cell neighbor" onClick={() => changeRotor(rotorIndex, -1)}>
                      {getRotorChar(currentPos, -1)}
                    </div>
                    <div className="wheel-cell active">
                      {getRotorChar(currentPos, 0)}
                    </div>
                    <div className="wheel-cell neighbor" onClick={() => changeRotor(rotorIndex, 1)}>
                      {getRotorChar(currentPos, 1)}
                    </div>
                  </div>
                </div>
            );
          })}
        </div>

        {/* LAMPBOARD */}
        <div className="lampboard">
          {KEYBOARD_ROWS.map((row, rowIndex) => (
              <div key={rowIndex} className="keyboard-row">
                {row.map((char) => (
                    <div
                        key={char}
                        className={`lamp ${activeLamp === char ? 'lit' : ''}`}
                    >
                      {char}
                    </div>
                ))}
              </div>
          ))}
        </div>

        {/* PLUGBOARD */}
        <div className="plugboard-section">
          <h3 style={{color: '#888', fontSize: '0.9rem', marginBottom: '15px'}}>
            STECKERBRETT (PLUGBOARD)
          </h3>

          {/* SOCKET GRID */}
          <div className="plug-grid">
            {ALPHABET.map(char => {
              const partner = plugs[char];     // Who is this plugged to?
              const isConnected = partner !== undefined;
              const isSelected = selectedPlug === char;

              // styles based on state
              let socketClass = "plug-socket";
              if (isSelected) socketClass += " selected";
              if (isConnected) socketClass += " plugged";

              // color for connection
              let indicatorStyle = {};
              if (isConnected) {
                // reverse pair color same
                const key = char < partner ? char : partner;
                const hue = (key.charCodeAt(0) - 65) * (360 / 13);
                indicatorStyle = { borderBottom: `3px solid hsl(${hue}, 70%, 50%)` };
              }

              return (
                  <div
                      key={char}
                      className={socketClass}
                      style={indicatorStyle}
                      onClick={() => handlePlugClick(char)}
                      title={isConnected ? `Connected to ${partner}` : `Connect ${char}`}
                  >
                    <div className="socket-label">{char}</div>
                    {isConnected && (
                        <div className="socket-partner">{partner}</div>
                    )}
                  </div>
              );
            })}
          </div>

          {/* 2. ACTIVE CABLES */}
          {Object.keys(plugs).length > 0 && (
              <div className="cables-list">
                {/* UNIQUE PAIR FILTER */}
                {Object.keys(plugs)
                    .filter(key => key < plugs[key])
                    .map(source => {
                      const target = plugs[source];
                      // tag colour
                      const hue = (source.charCodeAt(0) - 65) * (360 / 13);
                      const color = `hsl(${hue}, 70%, 50%)`;

                      return (
                          <div key={source} className="cable-tag" style={{borderLeftColor: color}}>
                            <span>{source} ↔ {target}</span>
                            {/* X button */}
                            <span
                                className="cable-remove"
                                onClick={() => handlePlugClick(source)} // disconnect
                                title="Unplug cable"
                            >
                        ×
                      </span>
                          </div>
                      );
                    })
                }
              </div>
          )}
        </div>

        <div className="button-group">
          <button className="reset-btn" onClick={handleReset}>Reset</button>
          <button className="reset-btn" onClick={handleSoftReset}>Soft Reset</button>
        </div>

        {/* BATCH INPUT */}
        <div style={{width: '80%', maxWidth: '600px', marginBottom: '20px'}}>
          <h3 style={{color: '#888', fontSize: '0.9rem'}}>BATCH INPUT (PASTE TEXT)</h3>
          <div style={{display: 'flex', gap: '10px'}}>
            <textarea
                rows="3"
                placeholder="..."
                style={{
                  flexGrow: 1,
                  background: '#222',
                  color: '#eee',
                  border: '1px solid #555',
                  padding: '10px',
                  fontFamily: 'monospace'
                }}
                id="batchInput"
            />
            <button
                className="power-btn"
                style={{fontSize: '0.9rem', padding: '0 20px', background: '#444'}}
                onClick={() => {
                  const el = document.getElementById('batchInput');
                  handleBatchProcessing(el.value);
                  el.value = ""; // clear textbox
                }}
            >
              PROCESS
            </button>
          </div>
        </div>

        {/* LOGS */}
        <div className="logs-container">
          <div>
            <small>PLAINTEXT</small>
            <div className="log-box">{inputLog}</div>
          </div>
          <div>
            <small>CIPHERTEXT</small>
            <div className="log-box" style={{color: '#ffcc00'}}>{outputLog}</div>
          </div>
        </div>
      </div>
  );
}

export default App;