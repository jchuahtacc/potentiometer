
double voltage;

void setup() {
    pinMode(A1, INPUT);
    Particle.variable("voltage", voltage);
}

void loop() {
    int val = analogRead(A1);
    voltage = val / 4095.0 * 3.3;
    delay(500);
}
