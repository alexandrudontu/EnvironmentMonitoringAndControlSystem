#include <Adafruit_Sensor.h>
#include <Adafruit_BME280.h>
#include "Adafruit_CCS811.h"
#include <TimerOne.h>
#include <SimpleTimer.h>

// Date provenite de la traductoare
float humidity, pressure;
int co2, tvoc;

unsigned long lastPushTime = 0;    // Timpul la care s-a realizat transmisia anterioara catre ESP8266
const long pushInterval = 2000;    // Intervalul de timp intre transmisii catre ESP8266

const int PWM = 10;                // PWM output

// Parametri PWM
float cycle = 20000;               // Ciclu de lucru in us
float dutyMin = 4;                 // Factor de umplere minim
float dutyMax = 100.0;             // Factor de umplere maxim
float duty = dutyMin;              // Factor de umplere initial in %
bool dutyInv = false;              // True - inversare factor de umplere

// Parameteri control
float y_Tr;                        // Temperatura pre-procesata / filtrata
float temperatureRaw;              // Temperatura citita de traductor
float y_Tr_1 = 0;                  // Temperatura filtrata anterioara
float Refk = 21.0;                 // Referinta initiala
float Refk_1 = Refk;               // Referinta in ciclul anterior

// Parametri PID
const int tk = 300;                // Intervalul de timp al buclei de reglare in ms
float Kp = 50;                    // Constanta proportionala power% / C 
float Ki = 10;                    // Constanta integratoare power%/(C * s)    (0.1 - 2)
float Kd = 0.3;                     // Constanta derivativa power% * s / C  (0 - 40)
float softTemperature = 0.4;       // Factorul de netezire a temperaturii: 0<softTemperature<=1 (1 = nefiltrata)
float eps = 0;                         // y_Tr - Refk
float dutyProp = 0;                    // Componenta proportionala
float dutyInt = 0;                 // Componenta integratoare
float dutyDer = 0;                     // Componenta derivativa
float propMax = 100.0;             // Maxim componenta proportionala
float intMax = 100.0;              // Maxim componenta integratoare
float derMax = 100.0;              // Maxim componenta derivativa
float duty_1 = 0;                  // Valoarea factorului de umplere in ciclul anterior
float dutyKick = 50;               // Factor de umplere minim pentru a porni ventilatorul
float dutyOff = 2;                 // Factor de umplere minim care face ventilatorul sa se opreasca
float dutyOn = 8;                  // Factor de umplere minim care face ventilatorul sa se invarteasca
unsigned int fanOff = 0;           // Starea ventilatorului: 1 - ventilator oprit


// Date receptionate de la ESP
String temp = "21";
String kp = "100";
String ki = "4.8";
String kd = "40";
String isOn = "1";

Adafruit_BME280 bme;
Adafruit_CCS811 ccs;

// Timer
SimpleTimer timer;
bool pidActive = false;    // Starea buclei de reglare


//// Bucla de reglare cu regulator PID  ////
void PID() {
  Refk = temp.toFloat();
  Kp = kp.toFloat();
  Ki = ki.toFloat();
  Kd = kd.toFloat();

  if (pidActive) {
    // Pre-procesare temperatura. Se face media cu 
    //temperatura anterioara folosind un facor de netezire
    y_Tr = temperatureRaw * softTemperature + y_Tr_1 * (1 - softTemperature);

    // Calculare eroare
    eps = y_Tr - Refk;

    // Calculare componenta proportionala
    dutyProp = constrain(Kp * eps, -propMax, propMax);

    // Calculare componenta integratoare
    dutyInt = dutyInt + Ki * (tk / 1000.0) * eps;
    dutyInt = constrain(dutyInt, 0.0, intMax);

    // Calculare componenta derivativa
    dutyDer = Kd * (y_Tr - y_Tr_1) / tk * 1000;
    dutyDer = constrain(dutyDer, -derMax, derMax);

    // Combinare componente
    duty = dutyProp + dutyInt + dutyDer;

    // Limitare factor de umplere
    duty = constrain(duty, dutyMin, dutyMax);

    // Fortare ventilator sa porneasca daca era oprit
    if (fanOff == 1 && duty > dutyOn) {
      duty = dutyKick;
      fanOff = 0;
    }

    // Determinare daca ventilatorul este oprit
    if (duty < dutyOff) {
      fanOff = 1;
    }

    // Salvare valori curente pentru urmatoarea iteratie
    duty_1 = duty;
    y_Tr_1 = y_Tr;
    Refk_1 = Refk;

    // Inversare factor de umplere daca este necesar
    float y_EE = dutyInv ? 100.0 - duty : duty;

    // Actualizare timer PWM 
    Timer1.setPwmDuty(PWM, y_EE / 100.0 * 1023.0);
  }
}

void setup() {
  // Configurare Serial
  Serial.begin(115200);
  delay(100);

  if (!bme.begin(0x76)) {
    // Nu s-a gasit un traductor BME280!
    while (1);
  }

  if (!ccs.begin()) {
    // Nu s-a putut porni traductorul CCS811!
    while (1);
  }

  // Asteptare ca traductorul sa porneasca
  while (!ccs.available());

  pinMode(PWM, OUTPUT);
  // Declansare initiala ventilator: viteza maxima timp de 2 secunde
  digitalWrite(PWM, HIGH);
  delay(2000);

  // Setare PWM bazat pe timer
  Timer1.initialize(cycle);
  Timer1.pwm(PWM, duty / 100.0 * 1023.0);

  // Setup traductor temperatura
  y_Tr_1 = bme.readTemperature();
  y_Tr = y_Tr_1;
  timer.setInterval(tk, PID);
}

void loop() {
  // Citire date de la ESP
  if (Serial.available() > 0) {
    String input = Serial.readStringUntil('\n');
    int commaIndex = 0;
    int lastCommaIndex = -1;

    commaIndex = input.indexOf(',', lastCommaIndex + 1);
    temp = input.substring(lastCommaIndex + 1, commaIndex);
    lastCommaIndex = commaIndex;

    commaIndex = input.indexOf(',', lastCommaIndex + 1);
    kp = input.substring(lastCommaIndex + 1, commaIndex);
    lastCommaIndex = commaIndex;

    commaIndex = input.indexOf(',', lastCommaIndex + 1);
    ki = input.substring(lastCommaIndex + 1, commaIndex);
    lastCommaIndex = commaIndex;

    commaIndex = input.indexOf(',', lastCommaIndex + 1);
    kd = input.substring(lastCommaIndex + 1, commaIndex);
    lastCommaIndex = commaIndex;

    isOn = input.substring(lastCommaIndex + 1);

    // Actualizare fanion PID activ in baza lui isOn
    pidActive = (isOn == "1");

    if (!pidActive) {
      // Oprire ventilator si resetare factor de umplere
      duty = 0;
      Timer1.setPwmDuty(PWM, 0);
      // Transmitere un mesaj care indica oprirea
      String data = "0,0,0,0,0,0,0\n";
      Serial.print(data);
    }
  }

  if (pidActive) {
    // Citire valori traductoare
    temperatureRaw = bme.readTemperature();
    humidity = bme.readHumidity();
    pressure = bme.readPressure() / 100.0F;  // hPa
    if (ccs.available()) {
      if (!ccs.readData()) {
        co2 = ccs.geteCO2();
        tvoc = ccs.getTVOC();
      }
    }

    // Transmitere date catre ESP8266 la fiecare 2 secunde
    if (millis() - lastPushTime >= pushInterval) {
      String data = String(temperatureRaw) + "," +
                    String(duty) + "," + String(humidity) + "," +
                    String(pressure) + "," + String(co2) + "," +
                    String(tvoc) + "," + String(Refk) + "\n";
      Serial.print(data);

      lastPushTime = millis();
    }
  }

  timer.run();
}
