Module.register("MMM-TFL", {
    defaults: {
        apikey: "",
        appId: "",

        journey: {
            enabled: false,
            origin: "",
            destination: "",
            updateInterval: 60000, // 1 minute
            showWalkingTime: true,
            activeSchedule: {
                activeDays: [0, 1, 2, 3, 4, 5, 6],
                activeHours: {
                    start: "00:00",
                    end: "23:59"
                }
            }
        },

        departures: {
            enabled: false,
            stationName: "",
            stationId: "",
            maxDepartures: 5,
            showLineBadge: false,
            updateInterval: 30000, // 30 seconds
            activeSchedule: {
                activeDays: [0, 1, 2, 3, 4, 5, 6],
                activeHours: {
                    start: "00:00",
                    end: "23:59"
                }
            }
        },

        lineStatus: {
            enabled: false,
            lineId: "",
            updateInterval: 300000, // 5 minutes
            activeSchedule: {
                activeDays: [0, 1, 2, 3, 4, 5, 6],
                activeHours: {
                    start: "00:00",
                    end: "23:59"
                }
            }
        }
    },

    start: function () {
        Log.info("Starting module: " + this.name);
        this.journeyData = []; // Changed to array for multiple destinations
        this.departuresData = null;
        this.lineStatusData = null;
        this.journeyError = null;
        this.departuresError = null;
        this.lineStatusError = null;
        this.journeyInactive = false;
        this.departuresInactive = false;
        this.lineStatusInactive = false;
        this.lastUpdate = {
            journey: null,
            departures: null,
            lineStatus: null
        };
        this.loaded = false;

        // Send config to node_helper
        this.sendSocketNotification("SET_CONFIG", this.config);
    },

    getStyles: function () {
        return ["MMM-TFL.css"];
    },

    socketNotificationReceived: function (notification, payload) {
        switch (notification) {
            case "JOURNEY_DATA":
                this.journeyData = payload;
                this.journeyError = null;
                this.journeyInactive = false;
                this.lastUpdate.journey = new Date();
                this.loaded = true;
                this.updateDom();
                break;

            case "DEPARTURES_DATA":
                this.departuresData = payload;
                this.departuresError = null;
                this.departuresInactive = false;
                this.lastUpdate.departures = new Date();
                this.loaded = true;
                this.updateDom();
                break;

            case "LINE_STATUS_DATA":
                this.lineStatusData = payload;
                this.lineStatusError = null;
                this.lineStatusInactive = false;
                this.lastUpdate.lineStatus = new Date();
                this.loaded = true;
                this.updateDom();
                break;

            case "JOURNEY_ERROR":
                this.journeyError = payload;
                this.updateDom();
                break;

            case "DEPARTURES_ERROR":
                this.departuresError = payload;
                this.updateDom();
                break;

            case "LINE_STATUS_ERROR":
                this.lineStatusError = payload;
                this.updateDom();
                break;

            case "FEATURE_INACTIVE":
                if (payload.feature === "journey") {
                    this.journeyInactive = true;
                } else if (payload.feature === "departures") {
                    this.departuresInactive = true;
                } else if (payload.feature === "lineStatus") {
                    this.lineStatusInactive = true;
                }
                this.updateDom();
                break;
        }
    },

    getDom: function () {
        const wrapper = document.createElement("div");
        wrapper.className = "mmm-tfl-wrapper";

        // if (!this.config.apikey || !this.config.appId) {
        //     wrapper.innerHTML = "Please configure TFL API credentials";
        //     wrapper.className = "dimmed light small";
        //     return wrapper;
        // }

        // Journey Time Section
        if (this.config.journey.enabled) {
            const journeySection = this.createJourneySection();
            if (journeySection) {
                wrapper.appendChild(journeySection);
            }
        }

        // Departures Section
        if (this.config.departures.enabled) {
            const departuresSection = this.createDeparturesSection();
            if (departuresSection) {
                wrapper.appendChild(departuresSection);
            }
        }

        // Line Status Section
        if (this.config.lineStatus.enabled) {
            const lineStatusSection = this.createLineStatusSection();
            if (lineStatusSection) {
                wrapper.appendChild(lineStatusSection);
            }
        }

        return wrapper;
    },

    createJourneySection: function () {
        const section = document.createElement("div");
        section.className = "tfl-section journey-section";

        const header = document.createElement("div");
        header.className = "section-header";
        header.innerHTML = "Journey Times";
        section.appendChild(header);

        if (this.journeyError) {
            const error = document.createElement("div");
            error.className = "error-message small";
            error.innerHTML = "Error: " + this.journeyError;
            section.appendChild(error);
            return section;
        }

        if (this.journeyInactive) {
            const inactive = document.createElement("div");
            inactive.className = "inactive-message small dimmed";
            inactive.innerHTML = "No active destinations";
            if (this.lastUpdate.journey) {
                inactive.innerHTML += " (Last update: " + this.formatTime(this.lastUpdate.journey) + ")";
            }
            section.appendChild(inactive);
            return section;
        }

        if (!this.journeyData || this.journeyData.length === 0) {
            const loading = document.createElement("div");
            loading.className = "dimmed light small";
            loading.innerHTML = "Loading ...";
            section.appendChild(loading);
            return section;
        }

        // Display each active destination in config order
        this.journeyData.forEach(journey => {
            const content = this.createJourneyContent(journey);
            section.appendChild(content);
        });

        return section;
    },

    createJourneyContent: function (journey) {
        const content = document.createElement("div");
        content.className = "journey-content";

        // Destination name header
        const destHeader = document.createElement("div");
        destHeader.className = "journey-destination-name";
        destHeader.innerHTML = journey.destinationName;
        content.appendChild(destHeader);

        const duration = document.createElement("div");
        duration.className = "journey-duration";
        duration.innerHTML = this.formatDuration(journey.duration);
        content.appendChild(duration);

        const route = document.createElement("div");
        route.className = "journey-route small";

        // Create route summary
        const routeParts = [];
        journey.legs.forEach(leg => {
            if (leg.mode === "walking") {
                routeParts.push("Walk " + this.formatDuration(leg.duration));
            } else if (leg.routeName) {
                routeParts.push(leg.routeName);
            }
        });
        route.innerHTML = routeParts.join(" -> ");
        content.appendChild(route);

        if (this.config.journey.showWalkingTime) {
            const walkingTime = journey.legs
                .filter(leg => leg.mode === "walking")
                .reduce((total, leg) => total + leg.duration, 0);

            if (walkingTime > 0) {
                const walking = document.createElement("div");
                walking.className = "journey-walking xsmall dimmed";
                walking.innerHTML = "Walking: " + this.formatDuration(walkingTime);
                content.appendChild(walking);
            }
        }

        return content;
    },

    createDeparturesSection: function () {
        const section = document.createElement("div");
        section.className = "tfl-section departures-section";

        const header = document.createElement("div");
        header.className = "section-header";
        header.innerHTML = `${this.config.departures.stationName} departures`;
        section.appendChild(header);

        if (this.departuresError) {
            const error = document.createElement("div");
            error.className = "error-message small";
            error.innerHTML = "Error: " + this.departuresError;
            section.appendChild(error);
            return section;
        }

        if (this.departuresInactive) {
            const inactive = document.createElement("div");
            inactive.className = "inactive-message small dimmed";
            inactive.innerHTML = "Outside active hours";
            if (this.lastUpdate.departures) {
                inactive.innerHTML += " (Last update: " + this.formatTime(this.lastUpdate.departures) + ")";
            }
            section.appendChild(inactive);

            // Show last known data if available
            if (this.departuresData && this.departuresData.length > 0) {
                section.className += " inactive";
                const content = this.createDeparturesContent();
                section.appendChild(content);
            }
            return section;
        }

        if (!this.departuresData) {
            const loading = document.createElement("div");
            loading.className = "dimmed light small";
            loading.innerHTML = "Loading ...";
            section.appendChild(loading);
            return section;
        }

        if (this.departuresData.length === 0) {
            const noDepartures = document.createElement("div");
            noDepartures.className = "small dimmed";
            noDepartures.innerHTML = "No departures";
            section.appendChild(noDepartures);
            return section;
        }

        const content = this.createDeparturesContent();
        section.appendChild(content);

        return section;
    },

    createDeparturesContent: function () {
        const table = document.createElement("table");
        table.className = "departures-table small";

        // console.log(this.departuresData);

        this.departuresData.forEach(departure => {
            const row = document.createElement("tr");

            if (this.config.departures.showLineBadge) {
                const lineCell = document.createElement("td");
                lineCell.className = "line-name line-" + departure.lineId;
                lineCell.innerHTML = departure.lineName;
                row.appendChild(lineCell);
            }

            const destCell = document.createElement("td");
            destCell.className = "destination";
            destCell.innerHTML = departure.towards;
            row.appendChild(destCell);

            const platformCell = document.createElement("td");
            platformCell.className = "platform";
            platformCell.innerHTML = departure.platform || "";
            row.appendChild(platformCell);

            const timeCell = document.createElement("td");
            timeCell.className = "time";
            const minutes = Math.floor(departure.timeToStation / 60);
            if (minutes < 1) {
                timeCell.innerHTML = "Due";
            } else {
                timeCell.innerHTML = minutes + " min";
            }
            row.appendChild(timeCell);

            table.appendChild(row);
        });

        return table;
    },

    createLineStatusSection: function () {
        const section = document.createElement("div");
        section.className = "tfl-section line-status-section";

        const header = document.createElement("div");
        header.className = "section-header";
        header.innerHTML = "Line Status";
        section.appendChild(header);

        if (this.lineStatusError) {
            const error = document.createElement("div");
            error.className = "error-message small";
            error.innerHTML = "Error: " + this.lineStatusError;
            section.appendChild(error);
            return section;
        }

        if (this.lineStatusInactive) {
            const inactive = document.createElement("div");
            inactive.className = "inactive-message small dimmed";
            inactive.innerHTML = "Outside active hours";
            if (this.lastUpdate.lineStatus) {
                inactive.innerHTML += " (Last update: " + this.formatTime(this.lastUpdate.lineStatus) + ")";
            }
            section.appendChild(inactive);

            // Show last known data if available
            if (this.lineStatusData) {
                section.className += " inactive";
                const content = this.createLineStatusContent();
                section.appendChild(content);
            }
            return section;
        }

        if (!this.lineStatusData) {
            const loading = document.createElement("div");
            loading.className = "dimmed light small";
            loading.innerHTML = "Loading ...";
            section.appendChild(loading);
            return section;
        }

        const content = this.createLineStatusContent();
        section.appendChild(content);

        return section;
    },

    createLineStatusContent: function () {
        const content = document.createElement("div");
        content.className = "line-status-content";

        // Ensure we have an array of line status entries
        const lines = Array.isArray(this.lineStatusData) ? this.lineStatusData : [this.lineStatusData];

        const table = document.createElement("table");
        table.className = "line-status-table small";

        lines.forEach(lineData => {
            if (!lineData) return;

            const row = document.createElement("tr");

            const nameCell = document.createElement("td");
            nameCell.className = "line-name-display";
            nameCell.innerHTML = lineData.lineName || "";
            row.appendChild(nameCell);

            const statusCell = document.createElement("td");
            statusCell.className = "line-statuses";

            const statuses = lineData.statuses || [];
            if (statuses.length === 0) {
                const none = document.createElement("span");
                none.className = "status-none dimmed";
                none.innerHTML = "No status";
                statusCell.appendChild(none);
            } else {
                statuses.forEach(status => {
                    const statusBadge = document.createElement("span");
                    statusBadge.className = "status-badge severity-" + (status.statusSeverity || "");
                    if (status.statusSeverity == 10) {
                        statusBadge.className += " dimmed";
                        nameCell.className += " dimmed";
                    }
                    statusBadge.innerHTML = status.statusSeverityDescription || "";
                    statusCell.appendChild(statusBadge);
                });
            }

            row.appendChild(statusCell);
            table.appendChild(row);
        });

        content.appendChild(table);

        return content;
    },

    formatDuration: function (minutes) {
        if (minutes < 60) {
            return minutes + " min";
        }
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return hours + "h " + mins + "m";
    },

    formatTime: function (date) {
        return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }
});