Module.register("MMM-forecast-io", {

  defaults: {
    apiKey: "",
    apiBase: "https://api.darksky.net/forecast",
    units: config.units,
    language: config.language,
    updateInterval: 6 * 60 * 1000, // every 5 minutes
    animationSpeed: 1000,
    initialLoadDelay: 0, // 0 seconds delay
    retryDelay: 2500,
    tempDecimalPlaces: 0, // round temperatures to this many decimal places
    geoLocationOptions: {
      enableHighAccuracy: true,
      timeout: 5000
    },
    latitude:  null,
    longitude: null,
    showSummary: true,
    showForecast: true,
    showPrecipitationGraph: true,
    precipitationGraphWidth: 400,
    showWind: true,
    showSunrise: true,
    unitTable: {
      'default':  'auto',
      'metric':   'si',
      'imperial': 'us'
    },
    iconTable: {
      'clear-day':           'wi-day-sunny',
      'clear-night':         'wi-night-clear',
      'rain':                'wi-rain',
      'snow':                'wi-snow',
      'sleet':               'wi-rain-mix',
      'wind':                'wi-cloudy-gusts',
      'fog':                 'wi-fog',
      'cloudy':              'wi-cloudy',
      'partly-cloudy-day':   'wi-day-cloudy',
      'partly-cloudy-night': 'wi-night-cloudy',
      'hail':                'wi-hail',
      'thunderstorm':        'wi-thunderstorm',
      'tornado':             'wi-tornado'
    },

    debug: false
  },

  getTranslations: function () {
    return false;
  },

  getScripts: function () {
    return [
      'jsonp.js',
      'moment.js'
    ];
  },

  getStyles: function () {
    return ["weather-icons.css", "MMM-forecast-io.css"];
  },

  shouldLookupGeolocation: function () {
    return this.config.latitude == null &&
           this.config.longitude == null;
  },

  start: function () {
    Log.info("Starting module: " + this.name);

    if (this.shouldLookupGeolocation()) {
      this.getLocation();
    }
    this.scheduleUpdate(this.config.initialLoadDelay);
  },

  updateWeather: function () {
    if (this.geoLocationLookupFailed) {
      return;
    }
    if (this.shouldLookupGeolocation() && !this.geoLocationLookupSuccess) {
      this.scheduleUpdate(1000); // try again in one second
      return;
    }

    var units = this.config.unitTable[this.config.units] || 'auto';

    var url = this.config.apiBase+'/'+this.config.apiKey+'/'+this.config.latitude+','+this.config.longitude+'?units='+units+'&lang='+this.config.language;
    if (this.config.data) {
      // for debugging
      this.processWeather(this.config.data);
    } else {
      getJSONP(url, this.processWeather.bind(this), this.processWeatherError.bind(this));
    }
  },

  processWeather: function (data) {
    if (this.config.debug) {
      console.log('weather data', data);
    }
    this.loaded = true;
    this.weatherData = data;
    this.temp = this.roundTemp(this.weatherData.currently.temperature);
    this.updateDom(this.config.animationSpeed);
    this.scheduleUpdate();
  },

  processWeatherError: function (error) {
    if (this.config.debug) {
      console.log('process weather error', error);
    }
    // try later
    this.scheduleUpdate();
  },

  notificationReceived: function(notification, payload, sender) {
    switch(notification) {
      case "DOM_OBJECTS_CREATED":
        break;
    }
  },

  getDom: function() {
    var wrapper = document.createElement("div");

    if (this.config.apiKey === "") {
      wrapper.innerHTML = "Please set the correct forcast.io <i>apiKey</i> in the config for module: " + this.name + ".";
      wrapper.className = "dimmed light small";
      return wrapper;
    }

    if (this.geoLocationLookupFailed) {
      wrapper.innerHTML = "Geolocaiton lookup failed, please set <i>latitude</i> and <i>longitude</i> in the config for module: " + this.name + ".";
      wrapper.className = "dimmed light small";
      return wrapper;
    }

    if (!this.loaded) {
      wrapper.innerHTML = this.translate('LOADING');
      wrapper.className = "dimmed light small";
      return wrapper;
    }

    var currentWeather = this.weatherData.currently;
    var hourly         = this.weatherData.hourly;
    var minutely       = this.weatherData.minutely;
    var daily          = this.weatherData.daily;

    //========== Current large icon & Temp
    var large = document.createElement("div");
    large.className = "large light";

    var icon = minutely ? minutely.icon : hourly.icon;
    var iconClass = this.config.iconTable[hourly.icon];
    var icon = document.createElement("span");
    icon.className = 'big-icon wi ' + iconClass;
    large.appendChild(icon);

    var temperature = document.createElement("span");
    temperature.className = "bright";
    temperature.innerHTML = " " + this.temp + "&deg;";
    large.appendChild(temperature);

    // ====== wind 
    if (this.config.showWind) {
      var padding = document.createElement("span");
      padding.className = "dim";
      padding.innerHTML = " &nbsp &nbsp ";
      large.appendChild(padding);

      var windicon = document.createElement("span");
      windicon.className = 'big-icon wi wi-strong-wind xdimmed';
      large.appendChild(windicon);

      var wind = document.createElement("span");
      wind.className = "dim";
      wind.innerHTML = " " + Math.round(this.weatherData.currently.windSpeed) + " ";
      large.appendChild(wind);
    }

    //========== sunrise/sunset
    if (this.config.showSunrise) {
      var midText = document.createElement("div");
      midText.className = "light";

      var today      = this.weatherData.daily.data[0];
      var now        = new Date();

      if (today.sunriseTime*1000 < now && today.sunsetTime*1000 > now) {
      	var sunset = new moment.unix(today.sunsetTime).format( "LT" );
   	    sunString = '<span class="wi wi-sunset xdimmed"></span> '  + sunset;
      } else {
    	var sunrise = new moment.unix(today.sunriseTime).format( "LT" );
    	sunString = '<span class="wi wi-sunrise xdimmed"></span> ' + sunrise;
      }

      var sunTime = document.createElement("div");
      sunTime.className = "small dimmed summary";
      sunTime.innerHTML = sunString;
      large.appendChild(sunTime);
    }
    wrapper.appendChild(large);

    // =========  summary text
    if (this.config.showSummary) {
      var summaryText = minutely ? minutely.summary : hourly.summary;
      var summary = document.createElement("div");
      summary.className = "small dimmed summary";
      summary.innerHTML = summaryText;
      wrapper.appendChild(summary);
    }

    // ======== precip graph
    if (this.config.showPrecipitationGraph) {
      wrapper.appendChild(this.renderPrecipitationGraph());
    }

    // ======== forecast table 
    if (this.config.showForecast) {
      wrapper.appendChild(this.renderWeatherForecast());
    }

    return wrapper;
  },

  renderPrecipitationGraph: function () {
    var i;
    var width = this.config.precipitationGraphWidth; 
    var height = Math.round(width * 0.25);            // 75 by default
    var element = document.createElement('canvas');
    element.className = "precipitation-graph";
    element.width  = width;
    element.height = height;
    var context = element.getContext('2d');

    var precipitationGraphYShift = -15;  // 0..65 range, thus graph -15 to 45 degrees centigrade
    var stepSize = (width / (24) );    // pixels per hour for 24h

    // ======= shade blocks for daylight hours
    var now = new Date();
    now = Math.floor(now / 1000);    // current time in Unix format
    var timeUnilSunrise;
    var timeUnilSunset;
    var sunrisePixels;    // daytime shade box location on graph
    var sunsetPixels;

    for (i = 0; i < 3; i++) {                // 3 days ([0]..[2])
      timeUnilSunrise = (this.weatherData.daily.data[i].sunriseTime - now);
      timeUnilSunset  = (this.weatherData.daily.data[i].sunsetTime - now);

      if ((timeUnilSunrise < 0) && (i == 0)) {     
        timeUnilSunrise = 0;       // sunrise has happened already today
      }
      if ((timeUnilSunset < 0) && (i == 0)) {     
        timeUnilSunset = 0;        // sunset has happened already today
      }

      sunrisePixels = (timeUnilSunrise/60/60)*stepSize;
      sunsetPixels  = (timeUnilSunset/60/60)*stepSize;

      context.fillStyle = "#323232";
      context.fillRect(sunrisePixels, 0, (sunsetPixels-sunrisePixels), height);
    }

    // ===== 6hr tick lines
    var tickCount = Math.round(width / (stepSize*6));
    context.strokeStyle = 'gray';
    context.lineWidth = 2;
    for (i = 1; i < tickCount; i++) {
      context.moveTo(i * (stepSize*6), height);
      context.lineTo(i * (stepSize*6), height - 7);
      context.stroke();
    }

    // ====== graph of precipIntensity  (inches of liquid water per hour)
    var data = this.weatherData.hourly.data;

    context.strokeStyle = 'blue';
    context.fillStyle = 'blue';
    context.beginPath();
    context.moveTo(0, height);
    var intensity;
    for (i = 0; i < data.length; i++) {
      intensity = 0;
      if (data[i].precipIntensity > 0) {
        intensity = (data[i].precipIntensity * height * 5) + 4;   // make trace stand out
      }
      context.lineTo(i * stepSize, height - intensity);
    }
    context.lineTo(width, height);
    context.closePath();
    context.fill();

    // ========= graph of temp
    var numMins = 60 * 24;     // minutes in graph, 1 day
    var tempTemp;

    context.strokeStyle = 'red';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(0, height);

    var stepSizeTemp = Math.round(width / (24));
    var tempX;
    var tempY;

    for (i = 0; i < (24+1); i++) {
      tempX = i * stepSizeTemp;
      tempY = height - (this.weatherData.hourly.data[i].temperature + 10);

      context.lineTo(tempX, tempY);       // line from last hour to this hour
      context.stroke();

      context.beginPath();
      context.arc(tempX, tempY, 1, 0 ,2*Math.PI);          // hour-dots
      context.stroke();
    }

    var timeLabel;
    for (i = 0; i < (24+1); i++) {     // text label for temperature on graph
      if ((i % 2) == 1) {
        tempX = (i * stepSizeTemp) - 5;
        tempY = height - (this.weatherData.hourly.data[i].temperature + 10 + 5);
        tempTemp = Math.round( this.weatherData.hourly.data[i].temperature );

        context.beginPath();
        context.font = "12px Arial";
        context.fillStyle = "white";
        context.fillText( tempTemp, tempX, tempY );
        context.stroke();


        timeLabel = this.weatherData.hourly.data[i].time;
        timeLabel = moment(timeLabel*1000).format("HH");
        context.beginPath();
        context.font = "12px Arial";
        context.fillStyle = "white";
        context.fillText( timeLabel , tempX, 10 );
        context.stroke();
      }
    }

    return element;
  },

  getDayFromTime: function (time) {
    var dt = new Date(time * 1000);
    return moment.weekdaysShort(dt.getDay());
  },

  renderForecastRow: function (data, min, max) {
    var total = max - min;
    var interval = 100 / total;
    var rowMinTemp = this.roundTemp(data.temperatureMin);
    var rowMaxTemp = this.roundTemp(data.temperatureMax);

    var row = document.createElement("tr");
    row.className = "forecast-row";

    var dayTextSpan = document.createElement("span");
    dayTextSpan.className = "forecast-day"
    dayTextSpan.innerHTML = this.getDayFromTime(data.time);
    var iconClass = this.config.iconTable[data.icon];
    var icon = document.createElement("span");
    icon.className = 'wi weathericon ' + iconClass;

    var forecastBar = document.createElement("div");
    forecastBar.className = "forecast-bar";

    var minTemp = document.createElement("span");
    minTemp.innerHTML = rowMinTemp + "&deg;";
    minTemp.className = "temp min-temp";

    var maxTemp = document.createElement("span");
    maxTemp.innerHTML = rowMaxTemp + "&deg;";
    maxTemp.className = "temp max-temp";

    var bar = document.createElement("span");
    bar.className = "bar";
    bar.innerHTML = "&nbsp;"
    var barWidth = Math.round(interval * (rowMaxTemp - rowMinTemp));
    bar.style.width = barWidth + '%';

    var leftSpacer = document.createElement("span");
    leftSpacer.style.width = (interval * (rowMinTemp - min)) + "%";
    var rightSpacer = document.createElement("span");
    rightSpacer.style.width = (interval * (max - rowMaxTemp)) + "%";

    forecastBar.appendChild(leftSpacer);
    forecastBar.appendChild(minTemp);
    forecastBar.appendChild(bar);
    forecastBar.appendChild(maxTemp);
    forecastBar.appendChild(rightSpacer);

    var forecastBarWrapper = document.createElement("td");
    forecastBarWrapper.appendChild(forecastBar);

    row.appendChild(dayTextSpan);
    row.appendChild(icon);
    row.appendChild(forecastBarWrapper);

    return row;
  },

  renderWeatherForecast: function () {
    var numDays =  7;
    var i;

    var filteredDays =
      this.weatherData.daily.data.filter( function(d, i) { return (i < numDays); });

    var min = Number.MAX_VALUE;
    var max = -Number.MAX_VALUE;
    for (i = 0; i < filteredDays.length; i++) {
      var day = filteredDays[i];
      min = Math.min(min, day.temperatureMin);
      max = Math.max(max, day.temperatureMax);
    }
    min = Math.round(min);
    max = Math.round(max);        // this week's min & max, for graph scaling

    var display = document.createElement("table");
    display.className = "forecast";
    for (i = 0; i < filteredDays.length; i++) {
      var day = filteredDays[i];
      var row = this.renderForecastRow(day, min, max);
      display.appendChild(row);
    }
    return display;
  },

  getLocation: function () {
    var self = this;
    navigator.geolocation.getCurrentPosition(
      function (location) {
        if (self.config.debug) {
          console.log("geolocation success", location);
        }
        self.config.latitude  = location.coords.latitude;
        self.config.longitude = location.coords.longitude;
        self.geoLocationLookupSuccess = true;
      },
      function (error) {
        if (self.config.debug) {
          console.log("geolocation error", error);
        }
        self.geoLocationLookupFailed = true;
        self.updateDom(self.config.animationSpeed);
      },
      this.config.geoLocationOptions);
  },

// Round the temperature based on tempDecimalPlaces
  roundTemp: function (temp) {
    var scalar = 1 << this.config.tempDecimalPlaces;

    temp *= scalar;
    temp  = Math.round( temp );
    temp /= scalar;

    return temp;
  },

  scheduleUpdate: function(delay) {
    var nextLoad = this.config.updateInterval;
    if (typeof delay !== "undefined" && delay >= 0) {
      nextLoad = delay;
    }

    var self = this;
    setTimeout(function() {
      self.updateWeather();
    }, nextLoad);
  }

});
