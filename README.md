
## 🔗 [Launch Live Machine](https://lamaleafinthewind.github.io/enigma-machine/)

## 🛠️ Building from Source

### Prerequisites
1.  **Node.js** (for the frontend)
2.  **Emscripten SDK** (only if you want to modify the C engine)

### Quick Start (Frontend Only)
If you just want to run the simulator, the WebAssembly binaries are pre-included.

```bash
cd frontend
npm install
npm start
```

## 🔧 WASM compilation

If you modify the C engine in `core/main.c`, you must re-compile the WebAssembly binaries.

1.  **Install Emscripten:**
    Follow the [official instructions](https://emscripten.org/docs/getting_started/downloads.html) to install and activate the Emscripten SDK.

2.  **Compile:**
    I have included a build script in the frontend package.
    ```bash
    cd frontend
    npm run compile:core
    ```
    
    *This command compiles `../core/main.c` and outputs the new `.wasm` and `.js` files directly into `public/`, ready for React to use.*