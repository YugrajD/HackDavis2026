"""
COCO YOLOv8 HTTP service for Guardian Road.
Binds 0.0.0.0 for Wi‑Fi / LAN demos. Run: uvicorn main:app --host 0.0.0.0 --port 8000
"""

from __future__ import annotations

import base64
import io
import os
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from PIL import Image

from ultralytics import YOLO

DEFAULT_MODEL = os.environ.get("YOLO_MODEL", "yolov8n.pt")
CONF_THRESHOLD = float(os.environ.get("YOLO_CONF", "0.25"))

# Map Ultralytics COCO class names to labels understood by Guardian Road frame-pipeline regexes
COCO_LABEL_MAP: dict[str, str] = {
    "person": "pedestrian",
    "bicycle": "bike",
    "car": "car",
    "motorcycle": "scooter",
    "airplane": "obstacle",
    "bus": "bus",
    "train": "obstacle",
    "truck": "truck",
    "boat": "obstacle",
    "traffic light": "obstacle",
    "fire hydrant": "obstacle",
    "stop sign": "obstacle",
    "parking meter": "obstacle",
    "bench": "obstacle",
    "bird": "obstacle",
    "cat": "obstacle",
    "dog": "obstacle",
    "horse": "obstacle",
    "sheep": "obstacle",
    "cow": "obstacle",
    "elephant": "obstacle",
    "bear": "obstacle",
    "zebra": "obstacle",
    "giraffe": "obstacle",
    "backpack": "obstacle",
    "umbrella": "obstacle",
    "handbag": "obstacle",
    "tie": "obstacle",
    "suitcase": "obstacle",
    "frisbee": "obstacle",
    "skis": "obstacle",
    "snowboard": "obstacle",
    "sports ball": "obstacle",
    "kite": "obstacle",
    "baseball bat": "obstacle",
    "baseball glove": "obstacle",
    "skateboard": "obstacle",
    "surfboard": "obstacle",
    "tennis racket": "obstacle",
    "bottle": "obstacle",
    "wine glass": "obstacle",
    "cup": "obstacle",
    "fork": "obstacle",
    "knife": "obstacle",
    "spoon": "obstacle",
    "bowl": "obstacle",
    "banana": "obstacle",
    "apple": "obstacle",
    "sandwich": "obstacle",
    "orange": "obstacle",
    "broccoli": "obstacle",
    "carrot": "obstacle",
    "hot dog": "obstacle",
    "pizza": "obstacle",
    "donut": "obstacle",
    "cake": "obstacle",
    "chair": "obstacle",
    "couch": "obstacle",
    "potted plant": "obstacle",
    "bed": "obstacle",
    "dining table": "obstacle",
    "toilet": "obstacle",
    "tv": "obstacle",
    "laptop": "obstacle",
    "mouse": "obstacle",
    "remote": "obstacle",
    "keyboard": "obstacle",
    "cell phone": "obstacle",
    "microwave": "obstacle",
    "oven": "obstacle",
    "toaster": "obstacle",
    "sink": "obstacle",
    "refrigerator": "obstacle",
    "book": "obstacle",
    "clock": "obstacle",
    "vase": "obstacle",
    "scissors": "obstacle",
    "teddy bear": "obstacle",
    "hair drier": "obstacle",
    "toothbrush": "obstacle",
}


app = FastAPI(title="Guardian Road YOLOv8 COCO")

_model: YOLO | None = None


def get_model() -> YOLO:
    global _model
    if _model is None:
        _model = YOLO(DEFAULT_MODEL)
    return _model


class DetectRequest(BaseModel):
    imageBase64: str = Field(..., description="Raw base64 or data URL")
    imageMimeType: str | None = Field(None, description="Optional mime type")


class DetectResponse(BaseModel):
    detections: list[dict[str, Any]]
    width: int
    height: int
    model: str


def decode_image(body: DetectRequest) -> Image.Image:
    raw = body.imageBase64.strip()
    if raw.startswith("data:"):
        parts = raw.split(",", 1)
        if len(parts) != 2:
            raise ValueError("Invalid data URL")
        raw = parts[1]
    try:
        data = base64.b64decode(raw, validate=False)
    except Exception as e:
        raise ValueError(f"Invalid base64: {e}") from e
    try:
        return Image.open(io.BytesIO(data)).convert("RGB")
    except Exception as e:
        raise ValueError(f"Invalid image: {e}") from e


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/detect", response_model=DetectResponse)
def detect(body: DetectRequest) -> DetectResponse:
    try:
        image = decode_image(body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    width, height = image.size
    model = get_model()
    results = model.predict(image, conf=CONF_THRESHOLD, verbose=False)

    detections: list[dict[str, Any]] = []
    if results and results[0].boxes is not None:
        boxes = results[0].boxes
        names = model.names
        xyxyn = boxes.xyxyn.cpu().numpy()
        confs = boxes.conf.cpu().numpy()
        clss = boxes.cls.cpu().numpy().astype(int)

        for i in range(len(xyxyn)):
            xy = xyxyn[i]
            x1, y1, x2, y2 = float(xy[0]), float(xy[1]), float(xy[2]), float(xy[3])
            conf = float(confs[i])
            cls_id = int(clss[i])
            coco_name = str(names.get(cls_id, "object")).lower()
            label = COCO_LABEL_MAP.get(coco_name, "obstacle")

            detections.append(
                {
                    "id": f"coco-{cls_id}-{i}",
                    "label": label,
                    "description": f"COCO {coco_name}",
                    "confidence": round(conf, 4),
                    "bbox": [
                        max(0.0, min(1.0, x1)),
                        max(0.0, min(1.0, y1)),
                        max(0.0, min(1.0, x2)),
                        max(0.0, min(1.0, y2)),
                    ],
                }
            )

    return DetectResponse(
        detections=detections,
        width=width,
        height=height,
        model=DEFAULT_MODEL,
    )
