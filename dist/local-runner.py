"""Run the published V3Cell conditional trajectory model on the visitor's computer."""
import argparse
import base64
import binascii
import hashlib
import io
import json
import secrets
import sys
import threading
import traceback
import warnings
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.parse import urlsplit


WEIGHTS = {
    "stage1_amniotic_frames256_snapshot580.pkl": "7443012c8896e4f538e76f5d472721ee",
    "stage2_motion_checkpoint_003999.pt": "29341f317df553e134c470c1931ddf4d",
}
FATES = ("lumen", "lumen_collapse", "non_lumen")
PORT = 8765
MAX_INPUT = 24 * 1024 * 1024
PROTOCOL = "v3cell-trajectory/1"


def verified_weights(directory):
    print("Verifying Zenodo weights (1.07 GB)...", flush=True)
    for name, expected in WEIGHTS.items():
        path = directory / name
        if not path.is_file():
            raise FileNotFoundError(f"Missing weight file: {path}")
        digest = hashlib.md5()
        with path.open("rb") as stream:
            for chunk in iter(lambda: stream.read(2**20), b""):
                digest.update(chunk)
        if digest.hexdigest() != expected:
            raise ValueError(f"Checksum mismatch for {name}. Download Zenodo record 24088077 again.")


def unpack_frames(payload, folder):
    from PIL import Image

    if not isinstance(payload, dict) or payload.get("condition") not in FATES:
        raise ValueError("Choose a fate condition.")
    frames = payload.get("frames")
    if not isinstance(frames, list) or len(frames) != 6:
        raise ValueError("Select six chronological PNG frames.")
    total = 0
    for i, frame in enumerate(frames):
        if not isinstance(frame, str):
            raise ValueError("Expected a base64 PNG for each frame.")
        data = base64.b64decode(frame, validate=True)
        total += len(data)
        if total > MAX_INPUT:
            raise ValueError("The six PNG files must fit within 24 MiB.")
        with Image.open(io.BytesIO(data), formats=["PNG"]) as image:
            if image.width * image.height > 16_000_000 or getattr(image, "is_animated", False):
                raise ValueError("Each input must be a single PNG frame under 16 megapixels.")
            image.load()
        (folder / f"{i:02}.png").write_bytes(data)


def encode_gif(video, fps=10):
    import numpy as np
    from PIL import Image

    arr = video.detach().cpu().float().numpy()
    if arr.ndim == 4 and arr.shape[1] in (1, 3):
        arr = np.transpose(arr, (0, 2, 3, 1))
    if arr.min() < 0:
        arr = (arr + 1.0) * 0.5
    arr = (arr * 255.0).clip(0, 255).astype(np.uint8)
    if arr.shape[-1] == 1:
        arr = np.repeat(arr, 3, axis=-1)
    pil_frames = [Image.fromarray(frame) for frame in arr]
    buffer = io.BytesIO()
    pil_frames[0].save(
        buffer,
        format="GIF",
        save_all=True,
        append_images=pil_frames[1:],
        duration=1000 // fps,
        loop=0,
        optimize=True,
    )
    return buffer.getvalue()


def load_predictor(source, weights, device_name):
    warnings.filterwarnings("ignore", message=".*weights_only.*", category=FutureWarning)
    import torch

    verified_weights(weights)
    resolved = ("cuda" if torch.cuda.is_available() else "cpu") if device_name == "auto" else device_name
    device = torch.device(resolved)
    label = torch.cuda.get_device_name(device) if device.type == "cuda" else "CPU"
    print(f"Loading V3Cell model on {label}...", flush=True)

    sys.path.insert(0, str(source.resolve()))
    from scripts.inference import get_class_label, inference_single_video, load_model, load_video_frames

    decoder, motion = (str(weights / name) for name in WEIGHTS)
    model = load_model(motion, decoder, device)

    def predict(folder, condition, seed):
        frames, _ = load_video_frames(folder)
        torch.manual_seed(seed)
        if device.type == "cuda":
            torch.cuda.manual_seed_all(seed)
        with torch.inference_mode():
            _, video = inference_single_video(model, frames, get_class_label(condition), 6, 25, device)
        if tuple(video.shape) != (25, 3, 256, 256) or not torch.isfinite(video).all().item():
            raise RuntimeError("Invalid model output.")
        return encode_gif(video)

    return predict, label


class Runner(BaseHTTPRequestHandler):
    server_version = "V3CellLocal/1"

    def setup(self):
        super().setup()
        self.connection.settimeout(60)

    def reply(self, code, data, content_type="application/json", seed=None):
        if content_type == "application/json":
            data = json.dumps(data).encode()
        self.send_response(code)
        origin = self.headers.get("Origin")
        if origin in self.server.origins:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Access-Control-Expose-Headers", "X-V3Cell-Seed")
            self.send_header("Access-Control-Allow-Private-Network", "true")
        if seed is not None:
            self.send_header("X-V3Cell-Seed", str(seed))
        self.send_header("Vary", "Origin")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def allowed(self):
        host = self.headers.get("Host")
        origin = self.headers.get("Origin")
        if host in (f"127.0.0.1:{PORT}", f"localhost:{PORT}") and (
            origin is None or origin in self.server.origins
        ):
            return True
        self.reply(403, {"error": "Workbench origin is not paired with this runner."})
        return False

    def do_OPTIONS(self):
        if self.allowed():
            self.reply(204, b"", "text/plain")

    def do_GET(self):
        if not self.allowed():
            return
        if self.path != "/v1/status":
            self.reply(404, {"error": "Unknown route."})
            return
        self.reply(200, {"protocol": PROTOCOL, "device": self.server.device, "weights": WEIGHTS})

    def do_POST(self):
        if not self.allowed():
            return
        if self.path != "/v1/trajectory":
            self.reply(404, {"error": "Unknown route."})
            return
        if self.headers.get_content_type() != "application/json":
            self.reply(415, {"error": "Expected JSON."})
            return
        try:
            size = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            size = 0
        if not 0 < size <= MAX_INPUT * 4 // 3 + 1024:
            self.reply(413, {"error": "Invalid input size."})
            return
        if not self.server.busy.acquire(blocking=False):
            self.reply(409, {"error": "The local model is busy. Retry when it finishes."})
            return
        try:
            with TemporaryDirectory(prefix="v3cell-") as temp:
                folder = Path(temp)
                try:
                    payload = json.loads(self.rfile.read(size))
                    unpack_frames(payload, folder)
                except (ValueError, OSError, binascii.Error, SyntaxError) as exc:
                    self.reply(400, {"error": str(exc)})
                    return
                seed = secrets.randbits(31)
                output = self.server.predict(folder, payload["condition"], seed)
            self.reply(200, output, "image/gif", seed)
        except (ConnectionError, TimeoutError):
            pass
        except Exception:
            traceback.print_exc()
            try:
                self.reply(500, {"error": "Local inference failed. Check the runner console."})
            except (ConnectionError, TimeoutError):
                pass
        finally:
            self.server.busy.release()


def normalize_origin(origin):
    parts = urlsplit(origin)
    if parts.path == "/" and not parts.query and not parts.fragment and origin.endswith("/"):
        return origin[:-1]
    return origin


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, type=Path, help="Author's V3Cell source checkout")
    parser.add_argument("--weights", required=True, type=Path, help="Directory with both Zenodo weights")
    parser.add_argument("--device", choices=("auto", "cpu", "cuda"), default="auto")
    parser.add_argument("--origin", action="append", help="Exact origin of the workbench")
    args = parser.parse_args()
    origins = [normalize_origin(o) for o in (args.origin or ["http://127.0.0.1:3000", "http://localhost:3000"])]
    for origin in origins:
        parts = urlsplit(origin)
        if parts.scheme not in ("http", "https") or not parts.hostname or parts.username or (
            parts.path or parts.query or parts.fragment or "*" in origin
        ):
            parser.error("--origin requires an exact http(s) origin, e.g. http://127.0.0.1:3000")
    predict, device = load_predictor(args.source, args.weights, args.device)
    with ThreadingHTTPServer(("127.0.0.1", PORT), Runner) as server:
        server.predict = predict
        server.device = device
        server.origins = origins
        server.busy = threading.Lock()
        print(f"V3Cell ready on http://127.0.0.1:{PORT} ({device})", flush=True)
        server.serve_forever()


if __name__ == "__main__":
    main()
