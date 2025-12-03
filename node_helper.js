const NodeHelper = require("node_helper");
const fetch = require("node-fetch");

module.exports = NodeHelper.create({
    start: function() {
        console.log("Starting node helper for: " + this.name);
        this.updateTimers = {};
    },

    socketNotificationReceived: function(notification, payload) {
        if (notification === "SET_CONFIG") {
            this.config = payload;
            this.startUpdates();
        }
    },

    startUpdates: function() {
        // Clear any existing timers
        this.clearAllTimers();

        // Start updates for each enabled feature
        if (this.config.journey && this.config.journey.enabled) {
            this.scheduleFeatureUpdate("journey", this.config.journey);
        }
        if (this.config.departures && this.config.departures.enabled) {
            this.scheduleFeatureUpdate("departures", this.config.departures);
        }
        if (this.config.lineStatus && this.config.lineStatus.enabled) {
            this.scheduleFeatureUpdate("lineStatus", this.config.lineStatus);
        }
    },

    scheduleFeatureUpdate: function(featureName, featureConfig) {
        // Perform initial update
        this.updateFeature(featureName, featureConfig);

        // Schedule recurring updates
        this.updateTimers [featureName] = setInterval(() => {
            this.updateFeature(featureName, featureConfig);
        }, featureConfig.updateInterval);
    },

    updateFeature: function(featureName, featureConfig) {
        // Check if feature is within active schedule
        if (!this.isWithinActiveSchedule(featureConfig.activeSchedule)) {
            this.sendSocketNotification("FEATURE_INACTIVE", {feature: featureName });
            return;
        }

        // Call appropriate API based on feature
        switch(featureName) {
            case "journey":
                this.fetchJourneyTime(featureConfig);
                break;
            case "departures":
                this.fetchDepartures(featureConfig);
                break;
            case "lineStatus":
                this.fetchLineStatus(featureConfig);
                break;
        }
    },

    isWithinActiveSchedule: function(schedule) {
        if (!schedule) {
            // Default to always active if no schedule specified
            return true;
        }

        const now = new Date();
        const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday
        const currentTime = now.getHours() * 60 + now.getMinutes();// Minutes since midnight

        // Check if current day is in active days
        if (!schedule.activeDays.includes(currentDay)) {
            return false;
        }

        // Parse start and end times
        const [startHour, startMin] = schedule.activeHours.start.split(':').map(Number);
        const [endHour, endMin] = schedule.activeHours.end.split(':').map(Number);
        const startTime = startHour * 60 + startMin;
        const endTime = endHour * 60 + endMin;

        // Check if current time is within active hours
        if (startTime <= endTime) {
            // Normal case: e.g., 07:00 to 19:00
            return currentTime >= startTime && currentTime < endTime;
        } else {
            // Overnight case: e.g., 22:00 to 08:00
            return currentTime >= startTime || currentTime < endTime;
        }
    },

    fetchJourneyTime: async function(config) {
        try {
            let destinations = config.destinations;
            if (!destinations || destinations.length === 0) {
                throw new Error("No destinations configured");
            }

            // Filter for currently active destinations
            const activeDestinations = destinations.filter(dest =>
                this.isWithinActiveSchedule(dest.activeSchedule)
            );

            if (activeDestinations.length === 0) {
                this.sendSocketNotification("FEATURE_INACTIVE", { feature: "journey" });
                return;
            }

            // Fetch all active destinations simultaneously
            const journeyPromises = activeDestinations.map(dest =>
                this.fetchSingleJourney(config.origin, dest)
            );

            const results = await Promise.all(journeyPromises);

            // Filter out any failed journeys and send successful ones
            const successfulJourneys = results.filter(r => r !== null);

            if (successfulJourneys.length > 0) {
                this.sendSocketNotification("JOURNEY_DATA", successfulJourneys);
            } else {
                throw new Error("No journeys could be fetched");
            }
        } catch (error) {
            console.error("Error fetching journey times:", error);
            this.sendSocketNotification("JOURNEY_ERROR", error.message);
        }
    },

    fetchSingleJourney: async function(origin, destination) {
        try {
            const originEncoded = encodeURIComponent(origin);
            const destEncoded = encodeURIComponent(destination.address);

            // const now = new Date();
            // // date in format yyyymmdd
            // const year = now.getFullYear();
            // const month = String(now.getMonth() + 1).padStart(2, "0");
            // const day = String(now.getDate()).padStart(2, "0");
            // const date = `${year}${month}${day}`;

            // // time in format hhmm
            // const hh = String(now.getHours()).padStart(2, "0");
            // const mm = String(now.getMinutes()).padStart(2, "0");
            // const time = `${hh}${mm}`;
            // &date=${date}&time=${time}&timeIs=Departing

            const url = `https://api.tfl.gov.uk/Journey/JourneyResults/${originEncoded}/to/${destEncoded}
                ?nationalSearch=false&journeyPreference=LeastTime
                &mode=tube,walking&walkingSpeed=Fast`;

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.journeys && data.journeys.length > 0) {
                const fastestJourney = data.journeys [0];

                return {
                    destinationName: destination.name,
                    destinationAddress: destination.address,
                    duration: fastestJourney.duration,
                    startTime: fastestJourney.startDateTime,
                    arrivalTime: fastestJourney.arrivalDateTime,
                    legs: fastestJourney.legs.map(leg => ({
                        mode: leg.mode.name,
                        duration: leg.duration,
                        instruction: leg.instruction.summary,
                        departurePoint: leg.departurePoint ? leg.departurePoint.commonName : null,
                        arrivalPoint: leg.arrivalPoint ? leg.arrivalPoint.commonName : null,
                        routeName: leg.routeOptions && leg.routeOptions.length > 0 ? leg.routeOptions[0].name : null
                    }))
                };
            }
            return null;
        } catch (error) {
            console.error(`Error fetching journey to ${destination.name}:`, error);
            return null;
        }
    },

    fetchDepartures: async function(config) {
        try {
            const url =`https://api.tfl.gov.uk/StopPoint/${config.stationId}/Arrivals`;

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            // Filter for tube arrivals only and sort by expected arrival
            const tubeArrivals = data
                .filter(arrival => arrival.modeName === "tube")
                .sort((a, b) => new Date(a.expectedArrival) - new Date(b.expectedArrival))
                .slice(0, config.maxDepartures)
                .map(arrival =>({
                    lineName: arrival.lineName,
                    lineId: arrival.lineId,
                    destination: arrival.destinationName,
                    platform: arrival.platformName,
                    expectedArrival: arrival.expectedArrival,
                    timeToStation: arrival.timeToStation,
                    currentLocation: arrival.currentLocation,
                    towards: arrival.towards
                }));

            this.sendSocketNotification("DEPARTURES_DATA", tubeArrivals);
        } catch (error) {
            console.error("Error fetching departures:", error);
            this.sendSocketNotification("DEPARTURES_ERROR", error.message);
        }
    },

    fetchLineStatus: async function(config) {
        try {
            const url = `https://api.tfl.gov.uk/Line/${config.lineId}/Status`;

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data && data.length > 0) {
                const statusesArray = data.map(lineData => ({
                    lineName: lineData.name,
                    lineId: lineData.id,
                    statuses: (lineData.lineStatuses || []).map(status => ({
                        statusSeverity: status.statusSeverity,
                        statusSeverityDescription: status.statusSeverityDescription,
                        reason: status.reason || null,
                        disruption: status.disruption ? {
                            category: status.disruption.category,
                            description: status.disruption.description,
                            additionalInfo: status.disruption.additionalInfo
                        } : null
                    }))
                }));

                this.sendSocketNotification("LINE_STATUS_DATA", statusesArray);
            } else {
                throw new Error("No line status data found");
            }
        } catch (error) {
            console.error("Error fetching line status:", error);
            this.sendSocketNotification("LINE_STATUS_ERROR", error.message);
        }
    },

    clearAllTimers: function() {
        for (const timer in this.updateTimers) {
            clearInterval(this.updateTimers[timer]);
        }
        this.updateTimers = {};
    },

    stop: function() {
        this.clearAllTimers();
    }
});