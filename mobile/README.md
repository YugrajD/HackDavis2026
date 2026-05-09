# Guardian Road Mobile

React Native + Expo prebuild app for Guardian Road rider/driver capture.

## What Works Now

- Back camera preview with Expo Camera.
- Bike / car mode toggle.
- Seeded COCO-style detections overlaid as bounding boxes.
- Hazard scoring for cars, trucks, buses, motorcycles, cyclists, and pedestrians.
- Spoken alert stubs with `expo-speech`.
- Saved hazard event strip for demo flow.
- COCO SSD MobileNet v1 TFLite asset bundled under `assets/models`.
- Native TFLite runtime dependency installed through `react-native-fast-tflite`.

## Run

```sh
npm run start
```

For the full TFLite runtime, use an Expo prebuild/dev-client build rather than Expo Go:

```sh
npm run prebuild
npm run ios
npm run android
```

Expo CLI is currently happier with the local Node 22 runtime than Node 23:

```sh
/usr/local/bin/node ./node_modules/expo/bin/cli start --port 8082 --localhost
```

## Model

```txt
assets/models/coco-ssd-mobilenet-v1/detect.tflite
assets/models/coco-ssd-mobilenet-v1/labelmap.txt
```

The app currently uses seeded detections for a reliable hackathon demo. The next native step is wiring camera frames through `react-native-fast-tflite` inference and replacing `getMockDetections(...)` with real model outputs.
