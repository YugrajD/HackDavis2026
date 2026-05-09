import type { Detection, RideMode } from "./types";

const bikeFrames: Detection[][] = [
  [
    {
      id: "bike-car-left-01",
      label: "car",
      confidence: 0.92,
      bbox: { x: 0.05, y: 0.28, width: 0.34, height: 0.34 },
      distanceM: 4.1,
      ttcSec: 1.2
    },
    {
      id: "bike-person-far-01",
      label: "person",
      confidence: 0.78,
      bbox: { x: 0.67, y: 0.24, width: 0.18, height: 0.4 },
      distanceM: 8.9,
      ttcSec: 2.7
    }
  ],
  [
    {
      id: "bike-truck-rear-01",
      label: "truck",
      confidence: 0.86,
      bbox: { x: 0.0, y: 0.18, width: 0.48, height: 0.45 },
      distanceM: 5.5,
      ttcSec: 1.8
    }
  ],
  [
    {
      id: "bike-ped-crossing-01",
      label: "person",
      confidence: 0.88,
      bbox: { x: 0.47, y: 0.19, width: 0.25, height: 0.48 },
      distanceM: 5.9,
      ttcSec: 1.9
    }
  ]
];

const carFrames: Detection[][] = [
  [
    {
      id: "car-bike-right-01",
      label: "bicycle",
      confidence: 0.9,
      bbox: { x: 0.61, y: 0.33, width: 0.24, height: 0.28 },
      distanceM: 6.4,
      ttcSec: 1.6
    },
    {
      id: "car-person-sidewalk-01",
      label: "person",
      confidence: 0.74,
      bbox: { x: 0.12, y: 0.22, width: 0.16, height: 0.42 },
      distanceM: 11.3
    }
  ],
  [
    {
      id: "car-bike-intersection-01",
      label: "bicycle",
      confidence: 0.93,
      bbox: { x: 0.43, y: 0.24, width: 0.2, height: 0.34 },
      distanceM: 4.8,
      ttcSec: 1.1
    }
  ],
  [
    {
      id: "car-motorcycle-01",
      label: "motorcycle",
      confidence: 0.81,
      bbox: { x: 0.06, y: 0.29, width: 0.26, height: 0.31 },
      distanceM: 7.7,
      ttcSec: 2.4
    }
  ]
];

export function getMockDetections(mode: RideMode, frameIndex: number): Detection[] {
  const frames = mode === "bike" ? bikeFrames : carFrames;
  return frames[frameIndex % frames.length];
}
