import { StatusBar } from "expo-status-bar";
import Constants from "expo-constants";
import type { ComponentType } from "react";
import { ExpoThreeReplayScreen } from "./src/screens/ExpoThreeReplayScreen";

declare const require: (path: string) => { CaptureScreen: ComponentType };

const isExpoGo =
  Constants.executionEnvironment === "storeClient" ||
  Constants.appOwnership === "expo";

const NativeCaptureScreen = isExpoGo
  ? null
  : require("./src/screens/CaptureScreen").CaptureScreen;

export default function App() {
  return (
    <>
      {NativeCaptureScreen ? <NativeCaptureScreen /> : <ExpoThreeReplayScreen />}
      <StatusBar style="light" />
    </>
  );
}
