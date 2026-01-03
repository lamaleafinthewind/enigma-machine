
#ifndef ENIGMA_H
#define ENIGMA_H

typedef struct {
    char wiring[27];     // Forward wiring (A->?)
    char notch;          // turnover notch position
    int position;        // current rotation (0-25)
    int ring_setting;    // ring setting (0-25)
} Rotor;

typedef struct {
    Rotor r1;            // Left Rotor (Slow)
    Rotor r2;            // Middle Rotor (Medium)
    Rotor r3;            // Right Rotor (Fast)
    char reflector[27];  // Reflector wiring
    char plugboard[26];  // Plugboard swaps
} Enigma;

void init_enigma(Enigma* e);
char encrypt_char(Enigma* e, char c);

#endif //ENIGMA_H