import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getDatabase, ref, set, onValue, query, orderByKey, startAt, limitToLast } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-database.js";
import 'https://cdn.jsdelivr.net/npm/chart.js';
import 'https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns';

const appSettings = {
    databaseURL: "https://greenhouse-2e0a6-default-rtdb.firebaseio.com/"
};

// Initialize Firebase
const app = initializeApp(appSettings);
const database = getDatabase(app);

const dataRef = ref(database, "data");
const sensorReadingsInDB = ref(database, "sensorReadings");

const setTempEl = document.getElementById("setTemp");
const rangeValueEl = document.getElementById("rangeValue");
const kpEl = document.getElementById("kp");
const kiEl = document.getElementById("ki");
const kdEl = document.getElementById("kd");

const temperatureGaugeEl = document.getElementById("temperature-gauge");
const fanGaugeEl = document.getElementById("fan-gauge");
const humidityGaugeEl = document.getElementById("humidity-gauge");
const pressureGaugeEl = document.getElementById("pressure-gauge");
const co2GaugeEl = document.getElementById("co2-gauge");
const tvocGaugeEl = document.getElementById("tvoc-gauge");

const onOffBtn = document.getElementById("onOff-btn");
const refreshPlotsBtn = document.getElementById('refreshPlotsBtn');

function setGaugeValue(gauge, value, maxValue, unit) {
    if (value < 0) return;
    const fillPercentage = Math.min(value / maxValue, 1);
    const rotation = fillPercentage / 2; // 0 to 0.5 turn for 0% to 100%
    gauge.querySelector(".gauge__fill").style.transform = `rotate(${rotation}turn)`;
    gauge.querySelector(".gauge__cover").textContent = `${value} ${unit}`;
}

// Function to update button text and color based on `isOn` value
function updateButtonText(isOnValue) {
    if (isOnValue === "1") {
        onOffBtn.textContent = "ON";
        onOffBtn.classList.remove("off");
        onOffBtn.classList.add("on");
    } else {
        onOffBtn.textContent = "OFF";
        onOffBtn.classList.remove("on");
        onOffBtn.classList.add("off");
    }
}

// Fetch and display the initial `isOn` value
onValue(ref(database, "data/isOn"), snapshot => {
    const isOnValue = snapshot.val();
    updateButtonText(isOnValue);
});

// Function to toggle `isOn` value
function toggleIsOn() {
    const currentValue = onOffBtn.textContent === "ON" ? "1" : "0";
    const newValue = currentValue === "1" ? "0" : "1";
    updateDatabase("data/isOn", newValue);
    updateButtonText(newValue);
}

// Add event listener to toggle button
onOffBtn.addEventListener("click", toggleIsOn);

function updateDatabase(path, value) {
    set(ref(database, path), value)
        .then(() => console.log(`Set ${path} to ${value}`))
        .catch(error => console.error(`Error setting ${path}:`, error));
}

function onValueUpdate(snapshot, element) {
    const value = snapshot.val();
    element.value = value;
    if (element === setTempEl) {
        rangeValueEl.value = value;
    }
}

// Fetch and display the initial values
onValue(ref(database, "data/setTemp"), snapshot => onValueUpdate(snapshot, setTempEl));
onValue(ref(database, "data/kp"), snapshot => onValueUpdate(snapshot, kpEl));
onValue(ref(database, "data/ki"), snapshot => onValueUpdate(snapshot, kiEl));
onValue(ref(database, "data/kd"), snapshot => onValueUpdate(snapshot, kdEl));

// Debounce function to limit the frequency of updates
function debounce(func, delay) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

const debounceUpdateSetTemp = debounce((value) => updateDatabase("data/setTemp", value), 500);
const debounceUpdateKp = debounce((value) => updateDatabase("data/kp", value), 500);
const debounceUpdateKi = debounce((value) => updateDatabase("data/ki", value), 500);
const debounceUpdateKd = debounce((value) => updateDatabase("data/kd", value), 500);

setTempEl.addEventListener("input", () => {
    rangeValueEl.value = setTempEl.value;
    debounceUpdateSetTemp(setTempEl.value);
});

rangeValueEl.addEventListener("input", () => {
    setTempEl.value = rangeValueEl.value;
    debounceUpdateSetTemp(rangeValueEl.value);
});

kpEl.addEventListener("input", () => debounceUpdateKp(kpEl.value));
kiEl.addEventListener("input", () => debounceUpdateKi(kiEl.value));
kdEl.addEventListener("input", () => debounceUpdateKd(kdEl.value));

// Fetch the most recent sensor reading
const recentReadingsQuery = query(sensorReadingsInDB, orderByKey(), limitToLast(1));

onValue(recentReadingsQuery, (snapshot) => {
    snapshot.forEach((childSnapshot) => {
        const data = childSnapshot.val();
        console.log("Fetched data:", data);
        setGaugeValue(temperatureGaugeEl, data.temperature, 50, '°C');
        setGaugeValue(fanGaugeEl, data.fanSpeed, 100, '%');
        setGaugeValue(humidityGaugeEl, data.humidity, 100, '%');
        setGaugeValue(pressureGaugeEl, data.pressure, 2000, 'hPa');
        setGaugeValue(co2GaugeEl, data.co2, 1400, 'ppm');
        setGaugeValue(tvocGaugeEl, data.tvoc, 100, 'ppb');
    });
}, (error) => {
    console.error('Error fetching recent readings:', error);
});

// Initialize Chart.js instances for temperature, humidity, pressure, CO2, and TVOC
const ctxTemperature = document.getElementById('temperaturePlot').getContext('2d');
const ctxHumidity = document.getElementById('humidityPlot').getContext('2d');
const ctxPressure = document.getElementById('pressurePlot').getContext('2d');
const ctxCO2 = document.getElementById('co2Plot').getContext('2d');
const ctxTVOC = document.getElementById('tvocPlot').getContext('2d');
const ctxTempFan = document.getElementById('tempFanPlot').getContext('2d');

let temperaturePlot, humidityPlot, pressurePlot, co2Plot, tvocPlot, tempFanPlot;

try {
    humidityPlot = createPlot(ctxHumidity, 'Umiditate (%)', 'rgb(54, 162, 235)');
    pressurePlot = createPlot(ctxPressure, 'Presiune (hPa)', 'rgb(131, 56, 236)');
    co2Plot = createPlot(ctxCO2, 'CO2 (ppm)', 'rgb(255, 159, 64)');
    tvocPlot = createPlot(ctxTVOC, 'TVOC (ppb)', 'rgb(75, 192, 192)');
    
    temperaturePlot = new Chart(ctxTemperature, {
        type: 'line',
        data: {
            labels: [], 
            datasets: [
                {
                    label: 'Temperatura măsurată (°C)',
                    data: [], 
                    borderColor: 'rgb(255, 99, 132)',
                    tension: 0.1
                },
                {
                    label: 'Temperatura setată (°C)',
                    data: [], 
                    borderColor: 'rgb(54, 162, 235)',
                    tension: 0.1
                }
            ]
        },
        options: {
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'minute',
                        tooltipFormat: 'yyyy-MM-dd HH:mm:ss',
                        displayFormats: {
                            minute: 'HH:mm'
                        }
                    }
                }
            }
        }
    });

    tempFanPlot = new Chart(ctxTempFan, {
        type: 'line',
        data: {
            labels: [], 
            datasets: [
                {
                    label: 'Temperatura măsurată (°C)',
                    data: [], 
                    borderColor: 'rgb(255, 99, 132)',
                    tension: 0.1
                },
                {
                    label: 'Viteza ventilatorului (%)',
                    data: [], 
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1
                }
            ]
        },
        options: {
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'minute',
                        tooltipFormat: 'yyyy-MM-dd HH:mm:ss',
                        displayFormats: {
                            minute: 'HH:mm'
                        }
                    }
                }
            }
        }
    });

    console.log("Charts initialized successfully");
} catch (chartError) {
    console.error('Error initializing charts:', chartError);
}

// Function to create a Chart.js plot
function createPlot(ctx, label, borderColor) {
    return new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: label,
                data: [],
                borderColor: borderColor,
                tension: 0.1
            }]
        },
        options: {
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'minute',
                        tooltipFormat: 'yyyy-MM-dd HH:mm:ss',
                        displayFormats: {
                            minute: 'HH:mm'
                        }
                    }
                }
            }
        }
    });
}

// Function to update humidity chart based on selected time range
function updateHumidityPlot(timeRange) {
    updateChart(humidityPlot, 'humidity', timeRange);
}

// Function to update pressure chart based on selected time range
function updatePressurePlot(timeRange) {
    updateChart(pressurePlot, 'pressure', timeRange);
}

// Function to update CO2 chart based on selected time range
function updateCO2Plot(timeRange) {
    updateChart(co2Plot, 'co2', timeRange);
}

// Function to update TVOC chart based on selected time range
function updateTVOCPlot(timeRange) {
    updateChart(tvocPlot, 'tvoc', timeRange);
}

function updateTemperaturePlot(timeRange) {
    updateTemperatureAndFanPlot(temperaturePlot, timeRange, 'temperature', 'setTemp');
}

function updateTempFanPlot(timeRange) {
    updateTemperatureAndFanPlot(tempFanPlot, timeRange, 'temperature', 'fanSpeed');
}

// Function to update a chart based on selected time range
function updateChart(chart, dataType, timeRange) {
    const startTime = new Date();
    startTime.setMinutes(startTime.getMinutes() - timeRange);
    const startTimeInSeconds = Math.floor(startTime.getTime() / 1000);
    const dataRef = query(sensorReadingsInDB, orderByKey(), startAt(startTimeInSeconds.toString()));
    onValue(dataRef, (snapshot) => {
        const data = [];
        snapshot.forEach((childSnapshot) => {
            const reading = childSnapshot.val();
            data.push({
                x: new Date(parseInt(childSnapshot.key) * 1000),
                y: reading[dataType]
            });
        });
        chart.data.datasets[0].data = data;
        chart.update();
    }, (error) => {
        console.error(`Error updating ${dataType} chart:`, error);
    });
}

function updateTemperatureAndFanPlot(chart, timeRange, tempType, otherType) {
    const startTime = new Date();
    startTime.setMinutes(startTime.getMinutes() - timeRange);
    const startTimeInSeconds = Math.floor(startTime.getTime() / 1000);
    const dataRef = query(sensorReadingsInDB, orderByKey(), startAt(startTimeInSeconds.toString()));
    onValue(dataRef, (snapshot) => {
        const labels = [];
        const temperatureData = [];
        const otherData = [];
        snapshot.forEach((childSnapshot) => {
            const reading = childSnapshot.val();
            const timestamp = new Date(parseInt(childSnapshot.key) * 1000);
            labels.push(timestamp);
            temperatureData.push({ x: timestamp, y: reading[tempType] });
            otherData.push({ x: timestamp, y: reading[otherType] });
        });
        chart.data.labels = labels;
        chart.data.datasets[0].data = temperatureData;
        chart.data.datasets[1].data = otherData;
        chart.update();
    }, (error) => {
        console.error('Error updating temperature and fan plot:', error);
    });
}

// Add event listeners to toggle buttons
document.getElementById('last10min').addEventListener('click', () => {
    updateTemperaturePlot(10);
    updateHumidityPlot(10);
    updatePressurePlot(10);
    updateCO2Plot(10);
    updateTVOCPlot(10);
    updateTempFanPlot(10);
});
document.getElementById('last1hour').addEventListener('click', () => {
    updateTemperaturePlot(60);
    updateHumidityPlot(60);
    updatePressurePlot(60);
    updateCO2Plot(60);
    updateTVOCPlot(60);
    updateTempFanPlot(60);
});
document.getElementById('last1day').addEventListener('click', () => {
    updateTemperaturePlot(60 * 24);
    updateHumidityPlot(60 * 24);
    updatePressurePlot(60 * 24);
    updateCO2Plot(60 * 24);
    updateTVOCPlot(60 * 24);
    updateTempFanPlot(60 * 24);
});

// Add event listener to the refresh plots button
refreshPlotsBtn.addEventListener('click', () => {
    // Reference to the sensor readings in the database
    const sensorReadingsRef = ref(database, "sensorReadings");
    
    // Remove all data under the sensor readings
    set(sensorReadingsRef, null)
        .then(() => console.log("Sensor readings data deleted successfully"))
        .catch(error => console.error("Error deleting sensor readings data:", error));
});