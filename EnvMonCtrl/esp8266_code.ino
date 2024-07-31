#include <ESP8266WiFi.h>
#include <FirebaseArduino.h>
#include <NTPClient.h>
#include <WiFiUdp.h>

#define FIREBASE_HOST ""    // Link-ul bazei de date Firebase
#define FIREBASE_AUTH ""        // Cheia secreta a bazei de date
#define WIFI_SSID ""            // Numele retelei Wi-Fi
#define WIFI_PASSWORD ""        // Parola retelei Wi-Fi

WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, "pool.ntp.org");

// Date receptionate de la Arduino
String temperature = "";
String fanSpeed = "";
String humidity = "";
String pressure = "";
String co2 = "";
String tvoc = "";
String Refk = "";

// Date transmise catre Arduino
String setTemp = "21";
String kp = "50";
String ki = "10";
String kd = "0.3";
String isOn = "1";

unsigned long lastPushTime = 0;       // Timpul la care s-a realizat transmisia anterioara catre baza de date
const long pushInterval = 2000;       // Intervalul de timp intre transmisii catre baza de date

void setup() {
  Serial.begin(115200);
  // Conectare la Wi-Fi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
  }

  // Conectare la baza de date
  Firebase.begin(FIREBASE_HOST, FIREBASE_AUTH);
  timeClient.begin();
}

void loop() {
  // Verificare conexiune WiFi
  if (WiFi.status() != WL_CONNECTED) {
    reconnectWiFi();
  }
  // Citire date de la Arduino
  readSerialData();

  // Preluare date de la Firebase sub forma de siruri de caractere
  String tempString = Firebase.getString("data/setTemp");
  String kpString = Firebase.getString("data/kp");
  String kiString = Firebase.getString("data/ki");
  String kdString = Firebase.getString("data/kd");
  String isOnString = Firebase.getString("data/isOn");
  if (Firebase.failed()) {
    delay(2000);  // Incercare din nou
    return;
  } else {
    // Comparare valori noi cu valori vechi, transmisie catre Arduino doar daca s-a modificat macar o valoare
    if (tempString != setTemp || kpString != kp || kiString != ki || kdString != kd || isOnString != isOn) {
      setTemp = tempString;
      kp = kpString;
      ki = kiString;
      kd = kdString;
      isOn = isOnString;

      String data = setTemp + "," + kp + "," + ki + "," + kd + "," + isOn + "\n";
      Serial.print(data);  
    }
  }

  // Transmitere date catre Firebase la fiecare 2 secunde
  if ((millis() - lastPushTime >= pushInterval) && !(temperature == "0" && fanSpeed == "0" && humidity == "0" && pressure == "0" && Refk == "0")) {
    pushData();
    lastPushTime = millis();
  }

  delay(100);
}

// Citire date receptionate de la Arduino
void readSerialData() {
  if (Serial.available() > 0) {
    String input = Serial.readStringUntil('\n');

    // Separare sir de input prin virgule
    int index = 0;
    String values[7]; // We expect 7 values
    while (input.length() > 0 && index < 7) {
      int commaIndex = input.indexOf(',');
      if (commaIndex == -1) {
        values[index++] = input;
        input = "";
      } else {
        values[index++] = input.substring(0, commaIndex);
        input = input.substring(commaIndex + 1);
      }
    }

    // Verificare daca sunt exact 7 variabile
    if (index == 7) {
      temperature = values[0];
      fanSpeed = values[1];
      humidity = values[2];
      pressure = values[3];
      co2 = values[4];
      tvoc = values[5];
      Refk = values[6];
    } 
  }
}

// Transmitere date catre baza de date
void pushData() {
  if (temperature != "" && fanSpeed != "" && humidity != "" && pressure != "" && co2 != "" && tvoc != "" && Refk != "") {

    // Obtinere data si ora curenta 
    timeClient.update();
    // Epoch time = nr. de secunde scurse de la 1 ian. 1970
    unsigned long currentTimestamp = timeClient.getEpochTime(); 

    // Convertire timp in sir de caractere
    String timestampStr = String(currentTimestamp);

    // Transmitere date catre Firebase avand timpul ca si cheie
    Firebase.setString("sensorReadings/" + timestampStr + "/temperature", temperature);
    Firebase.setString("sensorReadings/" + timestampStr + "/fanSpeed", fanSpeed);
    Firebase.setString("sensorReadings/" + timestampStr + "/humidity", humidity);
    Firebase.setString("sensorReadings/" + timestampStr + "/pressure", pressure);
    Firebase.setString("sensorReadings/" + timestampStr + "/co2", co2);
    Firebase.setString("sensorReadings/" + timestampStr + "/tvoc", tvoc);
    Firebase.setString("sensorReadings/" + timestampStr + "/setTemp", Refk);
  }
}

void reconnectWiFi() {
  while (WiFi.status() != WL_CONNECTED) {
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    delay(500);
  }
}
