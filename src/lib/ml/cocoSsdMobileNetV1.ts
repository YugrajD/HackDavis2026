export const cocoSsdMobileNetV1 = {
  modelName: "COCO SSD MobileNet v1 TFLite",
  inputSize: {
    width: 300,
    height: 300,
    channels: 3
  },
  modelAsset: require("../../../assets/models/coco-ssd-mobilenet-v1/detect.tflite"),
  labelsAsset: require("../../../assets/models/coco-ssd-mobilenet-v1/labelmap.txt")
} as const;
