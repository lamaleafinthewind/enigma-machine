#include <stdio.h>
#include <string.h>
#include <emscripten/emscripten.h>
#include "enigma.h"

// Wiring
const char* WIRING[] = {
    "",
    "EKMFLGDQVZNTOWYHXUSPAIBRCJ", // Rotor I
    "AJDKSIRUXBLHWTMCQGZNPYFVOE", // Rotor II
    "BDFHJLCPRTXVZNYEIWGAKMUSQO", // Rotor III
    "ESOVPZJAYQUIRHXLNFTGKDCMWB", // Rotor IV
    "VZBRGITYUPSDNHLXAWMJQOFECK"  // Rotor V
};

const char NOTCHES[] = " QEVJZ";      // Notches for Rotors
const char* REFLECTOR_B = "YRUHQSLDPXNGOKMIEBFZCWVJAT"; // Reflector wiring. Could theoretically add other reflectors, but very uncommon

// Global state
Enigma machine;


// char to 0-25 index
int to_int(char c) { return c - 'A'; }
// 0-25 index to char
char to_char(int i) { return (i + 26) % 26 + 'A'; }

// Pass signal through rotor
int pass_rotor(int signal, Rotor r, int direction) {
    int offset = r.position - r.ring_setting;
    int pin_in = (signal + offset + 26) % 26;

    int pin_out;
    if (direction) {
        // in
        pin_out = to_int(r.wiring[pin_in]);
    } else {
        // out
        for (int i = 0; i < 26; i++) {
            if (to_int(r.wiring[i]) == pin_in) {
                pin_out = i;
                break;
            }
        }
    }

    return (pin_out - offset + 26) % 26;
}

void disconnect_char(int index) {
    int partner = machine.plugboard[index];
    if (partner != index) {
        machine.plugboard[partner] = partner;
    }
    machine.plugboard[index] = index;
}


EMSCRIPTEN_KEEPALIVE
void configure_machine(int id1, int pos1, int id2, int pos2, int id3, int pos3) {
    // Slot 1 (Left)
    strcpy(machine.r1.wiring, WIRING[id1]);
    machine.r1.notch = NOTCHES[id1];
    machine.r1.position = pos1;
    machine.r1.ring_setting = 0;

    // Slot 2 (Middle)
    strcpy(machine.r2.wiring, WIRING[id2]);
    machine.r2.notch = NOTCHES[id2];
    machine.r2.position = pos2;
    machine.r2.ring_setting = 0;

    // Slot 3 (Right)
    strcpy(machine.r3.wiring, WIRING[id3]);
    machine.r3.notch = NOTCHES[id3];
    machine.r3.position = pos3;
    machine.r3.ring_setting = 0;

    // reflector init
    strcpy(machine.reflector, REFLECTOR_B);

    // plugboard init
    static int initialized = 0;
    if (!initialized) {
        for(int i=0; i<26; i++) machine.plugboard[i] = i;
        initialized = 1;
    }
}

EMSCRIPTEN_KEEPALIVE
void set_rotor(int index, int value) {
    int safe_val = (value + 26) % 26;
    if (index == 1) machine.r1.position = safe_val;
    else if (index == 2) machine.r2.position = safe_val;
    else if (index == 3) machine.r3.position = safe_val;
}

EMSCRIPTEN_KEEPALIVE
int get_rotor_pos(int rotor_index) {
    if (rotor_index == 1) return machine.r1.position;
    if (rotor_index == 2) return machine.r2.position;
    return machine.r3.position;
}

EMSCRIPTEN_KEEPALIVE
void set_plug(int c1, int c2) {
    // Convert ASCII to Index STOP MAKING THE SAME MISTAKE!
    int p1 = c1 - 'A';
    int p2 = c2 - 'A';
    // check if 0-25
    if (p1 < 0 || p1 > 25 || p2 < 0 || p2 > 25) return;

    disconnect_char(p1);
    disconnect_char(p2);

    if (p1 == p2) return;

    machine.plugboard[p1] = p2;
    machine.plugboard[p2] = p1;
}

EMSCRIPTEN_KEEPALIVE
int get_plug(int index) {
    if (index < 0 || index > 25) return index;
    return machine.plugboard[index];
}

EMSCRIPTEN_KEEPALIVE
void clear_plugboard() {
    for(int i=0; i<26; i++) machine.plugboard[i] = i;
}

EMSCRIPTEN_KEEPALIVE
int encrypt_one_char(int c) {
    // char is passed as number
    int signal = c - 'A';
    if (signal < 0 || signal > 25) return c; // Ignore non-letters

    // Rotor steps and double stepping
    int r3_at_notch = (to_char(machine.r3.position) == machine.r3.notch);
    int r2_at_notch = (to_char(machine.r2.position) == machine.r2.notch);

    if (r2_at_notch) {
        machine.r1.position = (machine.r1.position + 1) % 26;
        machine.r2.position = (machine.r2.position + 1) % 26;
    } else if (r3_at_notch) {
        machine.r2.position = (machine.r2.position + 1) % 26;
    }
    machine.r3.position = (machine.r3.position + 1) % 26;

    // Signal path
    // Plugboard (In)
    signal = machine.plugboard[signal];

    // Rotors (Forward)
    signal = pass_rotor(signal, machine.r3, 1);
    signal = pass_rotor(signal, machine.r2, 1);
    signal = pass_rotor(signal, machine.r1, 1);

    // Reflector
    signal = to_int(machine.reflector[signal]);

    // Rotors (Backward)
    signal = pass_rotor(signal, machine.r1, 0);
    signal = pass_rotor(signal, machine.r2, 0);
    signal = pass_rotor(signal, machine.r3, 0);

    // Plugboard (Out)
    signal = machine.plugboard[signal];

    return signal + 'A'; // Return ASCII
}

int main() {
    // default: I-II-III at A-A-A
    configure_machine(1, 0, 2, 0, 3, 0);
    return 0;
}