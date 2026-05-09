import { useTensorflowModel } from "react-native-fast-tflite";

export const cocoSsdMobileNetV1 = {
  name: "COCO SSD MobileNet v1",
  inputSize: {
    width: 300,
    height: 300,
    channels: 3
  },
  modelAsset: require("../../assets/models/coco-ssd-mobilenet-v1/detect.tflite"),
  labelsAsset: require("../../assets/models/coco-ssd-mobilenet-v1/labelmap.txt")
} as const;

export function useCocoSsdMobileNetV1() {
  return useTensorflowModel(cocoSsdMobileNetV1.modelAsset, []);
}
