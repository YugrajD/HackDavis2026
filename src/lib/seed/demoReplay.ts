import type { ReplayPayload } from "../contracts";

const rideId = "demo-ride-1";

export const demoReplay: ReplayPayload = {
  generatedAt: "2026-05-09T19:10:00.000Z",
  ride: {
    id: rideId,
    mode: "bike",
    startedAt: "2026-05-09T19:04:00.000Z",
    endedAt: "2026-05-09T19:06:12.000Z",
    startLat: 38.54494,
    startLng: -121.75442,
    route: [
      { t: 0, lat: 38.54494, lng: -121.75442, speedMps: 4.2, headingDeg: 83 },
      { t: 14, lat: 38.54502, lng: -121.7536, speedMps: 5.1, headingDeg: 78 },
      { t: 28, lat: 38.54508, lng: -121.7527, speedMps: 5.8, headingDeg: 88 },
      { t: 44, lat: 38.5451, lng: -121.75182, speedMps: 4.9, headingDeg: 94 },
      { t: 61, lat: 38.54503, lng: -121.75088, speedMps: 5.4, headingDeg: 101 },
      { t: 78, lat: 38.54484, lng: -121.75006, speedMps: 4.6, headingDeg: 112 },
      { t: 96, lat: 38.54461, lng: -121.74928, speedMps: 3.8, headingDeg: 118 },
      { t: 114, lat: 38.54435, lng: -121.74858, speedMps: 5.2, headingDeg: 106 },
      { t: 132, lat: 38.54422, lng: -121.74778, speedMps: 5.6, headingDeg: 91 }
    ],
    stats: {
      durationSec: 132,
      distanceMeters: 585,
      maxRisk: 94,
      eventCount: 6
    }
  },
  events: [
    {
      id: "evt-close-pass",
      rideId,
      t: 18,
      timestamp: "2026-05-09T19:04:18.000Z",
      type: "close_pass",
      severity: 94,
      confidence: 0.93,
      lat: 38.54504,
      lng: -121.75335,
      headingDeg: 82,
      speedMps: 5.4,
      camera: "rear",
      spokenAlert: "Vehicle closing fast on your left.",
      explanation:
        "A sedan overtakes with limited lateral clearance while the rider is already near the bike-lane edge.",
      objects: [
        {
          id: "car-left-01",
          type: "car",
          confidence: 0.91,
          position: { x: -3.4, y: 0, z: 5.5 },
          velocity: { x: 1.7, y: 0, z: -5.2 },
          distanceM: 4.1,
          ttcSec: 1.2
        }
      ]
    },
    {
      id: "evt-blocked-bike-lane",
      rideId,
      t: 39,
      timestamp: "2026-05-09T19:04:39.000Z",
      type: "blocked_bike_lane",
      severity: 72,
      confidence: 0.88,
      lat: 38.54511,
      lng: -121.75208,
      headingDeg: 92,
      speedMps: 4.8,
      camera: "front",
      spokenAlert: "Blocked bike lane ahead.",
      explanation:
        "Cones and a partial curb obstruction push the rider toward the adjacent vehicle lane.",
      objects: [
        {
          id: "cone-row-01",
          type: "cone",
          confidence: 0.86,
          position: { x: 4.8, y: 0, z: 0.9 },
          velocity: { x: 0, y: 0, z: 0 },
          distanceM: 8.2
        },
        {
          id: "obstacle-01",
          type: "obstacle",
          confidence: 0.79,
          position: { x: 7.4, y: 0, z: -1.1 },
          velocity: { x: 0, y: 0, z: 0 },
          distanceM: 10.6
        }
      ]
    },
    {
      id: "evt-door-zone",
      rideId,
      t: 56,
      timestamp: "2026-05-09T19:04:56.000Z",
      type: "door_zone",
      severity: 81,
      confidence: 0.84,
      lat: 38.54506,
      lng: -121.7512,
      headingDeg: 98,
      speedMps: 5.2,
      camera: "front",
      spokenAlert: "Door zone on the right.",
      explanation:
        "A parked vehicle sits inside the rider's forward path with door-swing risk near the bike lane.",
      objects: [
        {
          id: "parked-car-01",
          type: "car",
          confidence: 0.87,
          position: { x: 6.2, y: 0, z: 3.1 },
          velocity: { x: 0, y: 0, z: 0 },
          distanceM: 9.4
        }
      ]
    },
    {
      id: "evt-pedestrian-conflict",
      rideId,
      t: 76,
      timestamp: "2026-05-09T19:05:16.000Z",
      type: "pedestrian_conflict",
      severity: 66,
      confidence: 0.82,
      lat: 38.54487,
      lng: -121.75016,
      headingDeg: 111,
      speedMps: 4.4,
      camera: "front",
      spokenAlert: "Pedestrian entering bike path.",
      explanation:
        "A pedestrian steps from the curb line toward the bike path during the rider's approach.",
      objects: [
        {
          id: "ped-crossing-01",
          type: "pedestrian",
          confidence: 0.82,
          position: { x: 5.8, y: 0, z: -2.8 },
          velocity: { x: -0.8, y: 0, z: 0.9 },
          distanceM: 7.6,
          ttcSec: 2.3
        }
      ]
    },
    {
      id: "evt-intersection-conflict",
      rideId,
      t: 98,
      timestamp: "2026-05-09T19:05:38.000Z",
      type: "intersection_conflict",
      severity: 88,
      confidence: 0.9,
      lat: 38.54458,
      lng: -121.74918,
      headingDeg: 119,
      speedMps: 3.9,
      camera: "front",
      spokenAlert: "Vehicle crossing from the right.",
      explanation:
        "A vehicle trajectory crosses the rider's projected path near the intersection conflict point.",
      objects: [
        {
          id: "cross-car-01",
          type: "car",
          confidence: 0.89,
          position: { x: 8.4, y: 0, z: -6.4 },
          velocity: { x: -3.8, y: 0, z: 2.4 },
          distanceM: 10.1,
          ttcSec: 1.7
        }
      ]
    },
    {
      id: "evt-pothole",
      rideId,
      t: 118,
      timestamp: "2026-05-09T19:05:58.000Z",
      type: "pothole",
      severity: 58,
      confidence: 0.77,
      lat: 38.54431,
      lng: -121.7484,
      headingDeg: 102,
      speedMps: 5.1,
      camera: "front",
      spokenAlert: "Surface hazard ahead.",
      explanation:
        "A pavement depression appears inside the rider's line and receives a lower but persistent risk score.",
      objects: [
        {
          id: "pothole-01",
          type: "obstacle",
          confidence: 0.77,
          position: { x: 5.2, y: 0, z: -0.4 },
          velocity: { x: 0, y: 0, z: 0 },
          distanceM: 6.8
        }
      ]
    }
  ],
  dangerSegments: [
    {
      id: "seg-russell-close-pass",
      label: "Russell Blvd bike lane",
      centerLat: 38.54503,
      centerLng: -121.75335,
      score: 91,
      eventCount: 7,
      topTypes: ["close_pass", "vehicle_approach"],
      lastSeen: "2026-05-09T19:04:18.000Z",
      explanation: "Repeated overtaking risk near the lane pinch point."
    },
    {
      id: "seg-campus-obstruction",
      label: "Campus edge obstruction",
      centerLat: 38.5451,
      centerLng: -121.75172,
      score: 74,
      eventCount: 4,
      topTypes: ["blocked_bike_lane", "door_zone"],
      lastSeen: "2026-05-09T19:04:56.000Z",
      explanation: "Temporary lane obstructions combine with parked-vehicle door risk."
    },
    {
      id: "seg-intersection-conflict",
      label: "Bike crossing conflict",
      centerLat: 38.54459,
      centerLng: -121.74918,
      score: 86,
      eventCount: 5,
      topTypes: ["intersection_conflict", "pedestrian_conflict"],
      lastSeen: "2026-05-09T19:05:38.000Z",
      explanation: "Turning and crossing movements create short time-to-conflict windows."
    }
  ]
};
