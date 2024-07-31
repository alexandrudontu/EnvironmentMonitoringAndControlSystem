# Environment Monitoring And Control System
  This project consists of two parts:
1. Monitoring environment values like: temperature, humidity, pressure, CO2 and TVOC levels and dysplaying them using an interface alongside a realtime database
2. Controlling the temperature using a PID controller in a closed loop system.

![schema_proiect](https://github.com/user-attachments/assets/8a2ba22a-3245-46dc-9e0d-fd7f7295b937)

  A BME280 sensor is used for reading the indoor temperature value, which is transmitted to the Arduino Uno via an analog pin. A temperature reference is set from the GUI and stored in a database, and then transmitted to an ESP8266 Wi-Fi microcontroller, finally reaching the Arduino using serial communication. With the two values, the error is calculated, which will represent the input for a PID-type regulator that, depending on the proportional, integrator and derivative constants values, will generate a command that is transmitted to the execution element.
  A graphical web interface was created using HTML, CSS and JavaScript languages, accessible from any device with an Internet connection, which allows the user to view real-time data regarding the temperature, humidity, pressure, CO2 concentration, TVOC (total volatile organic compounds). The evolution of these parameters over time will be displayed in a series of graphs. The user is also able to change the value of the reference and the PID parameters, thus allowing precise adjustments to maintain the desired conditions.
  Interfacing with the rest of the project is done through a real-time Google Firebase database, which records the values ​​of all measured parameters, which can later be retrieved and analyzed to identify trends, optimize performance, and troubleshoot issues that may arise.
