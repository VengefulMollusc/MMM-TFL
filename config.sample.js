/* Sample MagicMirror Config for MMM-TFL Module
*
* Copy this configuration into your MagicMirror's config/config.js file
* and customize with your own settings.
*/

{
    module: "MMM-TFL",
    position: "top_right", // or any other valid position
    config: {
        // Get these from https://api-portal.tfl.gov.uk/
        apiKey: "",
        appId: "",
        
        // === JOURNEY TIME FEATURE =
        // Shows travel time from a single origin to multiple destinations
        // Each destination has its own schedule for smart API usage
        journey: {
            enabled: true,
            origin: "10 Downing Street, London SW1A 2AA",
            updateInterval: 60000, // Update every 1 minute when active
            showWalkingTime: true, // Show total walking time
            // NEW: Multiple destinations with individual schedules
            destinations: [
                {
                    name: "Work",
                    address: "Canary Wharf, London E14",
                    activeSchedule: {
                        activeDays: [1, 2, 3, 4, 5], // Weekdays
                        activeHours: {
                            start: "07:00",
                            end: "09:00" // Morning commute only
                        }
                    }
                },
                {
                    name: "Gym",
                    address: "123 Fitness Street, London",
                    activeSchedule: {
                        activeDays: [1, 3, 5], // Mon, Wed, Fri
                        activeHours: {
                            start: "18:00",
                            end: "20:00" // Evening workout time
                        }
                    }
                },
                {
                    name: "Weekend Market",
                    address: "Borough Market, London SE1",
                    activeSchedule: {
                        activeDays: [0, 6], // Saturday and Sunday
                        activeHours: {
                            start: "10:00",
                            end: "16:00"
                        }
                    }
                }
            ]
        },

        // ===== STATION DEPARTURES FEATURE =====
        // Shows live departures from a tube station
        departures: {
            enabled: true,
            stationId: "940GZZLUSFS", // Southfields station
            // To find station IDs, use: https://api.tfl.gov.uk/StopPoint/Search?query=STATION_NAME
            maxDepartures: 5, // Show 5 upcoming departures
            showLineBadge: false, // show line badge next to departures
            updateInterval: 30000, // Update every 30 seconds when active
            activeSchedule: {
                activeDays: [1, 2, 3, 4, 5], // Monday-Friday
                activeHours: {
                    start: "06:30", // Morning commute
                    end: "09:30"
                }
            }
        },

        // === LINE STATUS FEATURE ==
        // = LINE STATUS FEATURE=
        // Shows service status for a tube line
        lineStatus: {
            enabled: true,
            lineId: "northern", // Northern line
            // Valid line IDs: bakerloo, central, circle, district, hammersmith-city,
            // jubilee, metropolitan, northern, piccadilly, victoria, waterloo-city,
            // elizabeth, dlr, london-overground
            updateInterval: 300000, // Update every 5 minutes
            activeSchedule: {
                activeDays: [0, 1, 2, 3, 4, 5, 6], // All days
                activeHours: {
                    start: "00:00", // Always active
                    end: "23:59"
                }
            }
        }
    }
}

/* ==== COMMON STATION IDS ====
*
* Major London Underground Stations:
* - King's Cross St Pancras: 940GZZLUKSX
* - Victoria: 940GZZLUVIC
* - Waterloo: 940GZZLUWLO
* - Liverpool Street: 940GZZLULVT
* - Paddington: 940GZZLUPAC
* - Oxford Circus: 940GZZLUOXC
* - Bank: 940GZZLUBNK
* - London Bridge: 940GZZLULNB
* - Euston: 940GZZLUEUS
* - Piccadilly Circus: 940GZZLUPCC
*
* Find more stations at: https://api.tfl.gov.uk/StopPoint/Search?query=STATION_NAME
*/

/* ==== SCHEDULE EXAMPLES ====
*
* Morning Commute Only:
* activeDays: [1, 2, 3, 4, 5]
* activeHours: { start: "07:00", end: "09:00" }
*
* Evening Commute Only:
* activeDays: [1, 2, 3, 4, 5]
* activeHours: { start: "17:00", end: "19:00" }
*
* Both Commutes:
* Use two separate module instances with different schedules
*
* Weekend Only:
* activeDays: [0, 6] // Saturday and Sunday
* activeHours: { start: "09:00", end: "22:00" }
*
* Night Shift (overnight):
* activeDays: [0, 1, 2, 3, 4] // Sun-Thu for Mon-Fri nights
* activeHours: { start: "22:00", end: "08:00" }
*
* Always Active:
* activeDays: [0, 1, 2, 3, 4, 5, 6]
* activeHours: { start: "00:00", end: "23:59" }
*/