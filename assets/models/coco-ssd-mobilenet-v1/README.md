# COCO SSD MobileNet v1 TFLite

Pretrained TensorFlow Lite object detection model for Guardian Road mobile perception.

Source:

```txt
https://storage.googleapis.com/download.tensorflow.org/models/tflite/coco_ssd_mobilenet_v1_1.0_quant_2018_06_29.zip
```

Files:

```txt
detect.tflite   TensorFlow Lite SSD MobileNet v1 detector
labelmap.txt    COCO label map used by the detector
```

Checksums:

```txt
e4b118e5e4531945de2e659742c7c590f7536f8d0ed26d135abcfe83b4779d13  detect.tflite
c7e79c855f73cbba9f33d649d60e1676eb0a974021a41696d1ac0d4b7f7e0211  labelmap.txt
a809cd290b4d6a2e8a9d5dad076e0bd695b8091974e0eed1052b480b2f21b6dc  source zip
```

Notes for the React Native + Expo prebuild app:

- Bundle `detect.tflite` as a static asset.
- Add `tflite` to Metro asset extensions before importing it with `require(...)`.
- Expected image input is `300 x 300 x 3`.
- The first label is `???`, so class IDs should be mapped directly by line index.
