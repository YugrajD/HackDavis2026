# YOLOv8 COCO sidecar (Guardian Road)

Ultralytics **yolov8n** (COCO 80-class). Listens on **`0.0.0.0`** so phones on the same Wi‑Fi can reach your laptop by **LAN IP** (Windows: allow Python/uvicorn through the firewall for the chosen port).

## Setup

```bash
cd services/yolo
python -m venv .venv
# Windows:
.venv\Scripts\activate
pip install -r requirements.txt
```

First run downloads `yolov8n.pt` into the working directory (Ultralytics cache).

## Run (LAN demo)

```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

- Health: `GET http://127.0.0.1:8000/health`
- Detect: `POST http://127.0.0.1:8000/detect` with JSON `{ "imageBase64": "<base64 or data URL>" }`

## Env

| Variable      | Default      | Purpose                          |
|---------------|--------------|----------------------------------|
| `YOLO_MODEL`  | `yolov8n.pt` | Weights path or Ultralytics name |
| `YOLO_CONF`   | `0.25`       | Confidence threshold             |

Next.js uses **`YOLO_SERVICE_URL`** (e.g. `http://127.0.0.1:8000`) to proxy detection.
