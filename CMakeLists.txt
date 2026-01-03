
cmake_minimum_required(VERSION 3.20)
project(enigma_core C)

set(CMAKE_C_STANDARD 11)


add_executable(enigma_core main.c)


set_target_properties(enigma_core PROPERTIES LINK_FLAGS
        "-s MODULARIZE=1 \
     -s EXPORT_NAME='createEnigmaModule' \
     -s EXPORTED_RUNTIME_METHODS=['ccall','cwrap'] \
     -s WASM=1"
)