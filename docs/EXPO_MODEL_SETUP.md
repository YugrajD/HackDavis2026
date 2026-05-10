# Expo Model Setup

Guardian Road's mobile app should be React Native + Expo prebuild.

The pretrained COCO SSD MobileNet v1 TensorFlow Lite assets live here:

```txt
assets/models/coco-ssd-mobilenet-v1/detect.tflite
assets/models/coco-ssd-mobilenet-v1/labelmap.txt
mobile/assets/models/coco-ssd-mobilenet-v1/detect.tflite
mobile/assets/models/coco-ssd-mobilenet-v1/labelmap.txt
```

## Metro asset config

Expo's Metro bundler requires custom asset extensions to be explicitly added. Once the Expo app scaffold exists, add this to `metro.config.js`:

```js
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push("tflite");

module.exports = config;
```

If the project keeps `"type": "module"` in `package.json`, use a CommonJS config file such as `metro.config.cjs`, or remove `"type": "module"` when converting this repo to Expo.

## Asset import

Use the mobile helper in:

```txt
mobile/src/ml/cocoSsdMobileNetV1.ts
```

It exposes:

```ts
cocoSsdMobileNetV1.modelAsset
cocoSsdMobileNetV1.labelsAsset
cocoSsdMobileNetV1.inputSize // 300 x 300 x 3
```

## Model notes

- Model: COCO SSD MobileNet v1, quantized TFLite.
- Input tensor: `300 x 300 x 3`.
- Label file has 91 lines.
- The first label is `???`, so class IDs should map directly to label line indexes.
- Useful Guardian Road classes include `person`, `bicycle`, `car`, `motorcycle`, `bus`, and `truck`.
