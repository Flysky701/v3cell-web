"""Localize the two homepage films in-place on their original timeline.

Run python scripts/localize_home_films.py --ffmpeg PATH with numpy, Pillow and
OpenCV installed. The source images and all model graphics stay in the frame.
Boxes and tracking references below use coordinates in the 1280 x 720 masters.
"""
import argparse
import subprocess
from functools import lru_cache
from pathlib import Path
from tempfile import TemporaryDirectory

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1] / "dist/assets/films"
INK = (34, 46, 67)
BLUE = (65, 88, 141)
MUTED = (78, 92, 112)
TEAL = (31, 123, 127)


@lru_cache(maxsize=128)
def font(size, bold):
    return ImageFont.truetype("segoeuib.ttf" if bold else "segoeui.ttf", size)


class Frame:
    def __init__(self, rgb):
        self.rgb = rgb
        self.image = Image.fromarray(rgb)
        self.draw = ImageDraw.Draw(self.image)
        self.gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)

    def label(self, box, text, size=18, color=INK, bold=False, width=None, anchor="center"):
        x, y, right, bottom = [round(n) for n in box]
        if x < 0 or y < 0 or right > 1280 or bottom > 720 or right <= x or bottom <= y:
            return
        region = self.rgb[y:bottom, x:right]
        # Local background samples follow the soft gradient of each individual frame.
        corners = np.array([[np.median(strip, axis=(0, 1)) for strip in pair] for pair in
                            ((region[:2, :3], region[:2, -3:]), (region[-2:, :3], region[-2:, -3:]))], np.uint8)
        back = corners.mean(axis=(0, 1))
        darkness = back.mean() - np.percentile(self.gray[y:bottom, x:right], 4)
        if darkness < 2.5:
            return
        alpha = min(1, darkness / max(40, back.mean() - np.mean(color)) * 1.1)
        self.image.paste(Image.fromarray(corners).resize((right-x, bottom-y), Image.Resampling.BILINEAR), (x, y))
        if not text:
            return
        size = round(size)
        while width and size > 10 and self.draw.textlength(text, font=font(size, bold)) > width:
            size -= 1
        xpos = {"left": x+2, "center": (right+x)/2, "right": right-2}[anchor]
        align = {"left": "lm", "center": "mm", "right": "rm"}[anchor]
        shade = tuple(np.uint8(back + alpha * (np.array(color)-back)))
        self.draw.text((xpos, (y+bottom)/2), text, font=font(size, bold), fill=shade, anchor=align)


def warm_bounds(rgb, box):
    x, y, right, bottom = box
    region = rgb[y:bottom, x:right]
    mask = cv2.inRange(region, (115, 78, 75), (250, 223, 224))
    mask[(region[:, :, 0].astype(int)-region[:, :, 2]) < 18] = 0
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None
    a, b, w, h = cv2.boundingRect(max(contours, key=cv2.contourArea))
    return (x+a, y+b, w, h) if w > 95 else None


def phenotypes(frame, sec):
    label = frame.label
    label((48, 41, 275, 68), "SECTION 02  /  STATIC PHENOTYPES", 16, BLUE, True, anchor="left")
    label((49, 68, 497, 110), "Real and virtual samples in a shared phenotype space", 31, INK, True, anchor="left")
    label((980, 684, 1257, 714), "2D section: columnar epithelium and lumen", 15, BLUE, True, anchor="right")
    if sec > 1.35:
        label((138, 169, 220, 199), "Brightfield", 17, MUTED)
    if sec >= .65:
        ring = warm_bounds(frame.rgb, (495, 190, 786, 490))
        if ring:
            bottom = ring[1] + ring[3]
            label((526, bottom+7, 755, bottom+33), "2D section to 64 × 64 ROI", 17)
    label((750, 177, 873, 205), "Learned features", 17, BLUE)
    label((957, 171, 1108, 198), "R3GAN generator", 19, BLUE, True, 180)
    label((950, 199, 1119, 226), "Noise z + subtype", 16, MUTED)
    label((1044, 248, 1123, 280), "Inference", 16, BLUE)
    label((211, 499, 301, 531), "Microscopy", 20, INK, True)
    if sec > 2:
        label((139, 532, 375, 556), "Diagrams above · observed images below", 15, MUTED, width=271)
    label((946, 499, 1098, 531), "Model output (V)", 20, INK, True)
    label((905, 532, 1140, 556), "Diagrams above · generated images below", 15, MUTED, width=280)
    if sec > 6:
        label((494, 541, 802, 578), "Translucent budding colon · hollow lung · solid stomach", 15, MUTED, width=405)


CAPTIONS = [
    (1., "The flash marks chemical perturbation. The model takes the early brightfield sequence as input."),
    (4., "Frame five informs fate classification. The encoder extracts content and motion from the observed sequence."),
    (7., "The classifier scores each candidate fate. The sections at right illustrate their morphologies."),
    (10., "The three fates move with their Fig. 5A reference images into descending order of predicted probability."),
    (12.5, "In this example, cavity formation ranks first. It conditions the subsequent shape predictions."),
    (16., "Content stays fixed as motion evolves. The generator predicts successive shapes conditioned on the selected fate."),
]


class FateLabels:
    def __init__(self, capture, fps):
        def gray_at(sec):
            capture.set(cv2.CAP_PROP_POS_FRAMES, round(sec*fps))
            ok, image = capture.read()
            if not ok:
                raise ValueError("Missing reference frame")
            return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        base = gray_at(7.6)
        final = gray_at(17.6)
        self.names = []
        for index, (y, w, name) in enumerate([(222, 84, "Cavity collapse"), (344, 105, "Non-cavity"), (466, 84, "Cavity formation"), (222, 84, "Cavity formation")]):
            ref = final if index == 3 else base
            self.names.append((ref[y-9:y+12, 912:912+w].copy(), name, index == 3))
        self.fig = base[262:279, 1179:1220].copy()
        self.caption_patterns = [gray_at(sec)[638:664, 51:263].copy() for sec, _ in CAPTIONS]
        capture.set(cv2.CAP_PROP_POS_FRAMES, 0)

    def candidates(self, frame):
        # Labels fade out while the diagrams and reference images exchange rows.
        for row in (222, 344, 466):
            area = frame.gray[row-16:row+18, 905:1022]
            ranked = []
            for pattern, name, bold in self.names:
                _, score, _, point = cv2.minMaxLoc(cv2.matchTemplate(area, pattern, cv2.TM_CCOEFF_NORMED))
                ranked.append((score, point, pattern.shape, name, bold))
            score, (dx, dy), (h, w), name, bold = max(ranked, key=lambda r: r[0])
            if score > .55:
                x, y = 905+dx, row-16+dy
                frame.label((x-3, y-3, x+w+3, y+h+3), name, 17, TEAL if bold else INK, bold, 123, "left")
        # Figure captions follow the moving image chips rather than the fixed columns.
        area = frame.gray[248:582, 730:1246]
        matches = cv2.matchTemplate(area, self.fig, cv2.TM_CCOEFF_NORMED)
        h, w = self.fig.shape
        for _ in range(3):
            _, score, _, (x, y) = cv2.minMaxLoc(matches)
            if score < .55:
                break
            frame.label((730+x-2, 248+y-2, 730+x+w+2, 248+y+h+2), "Fig. 5A", 15, MUTED)
            matches[max(0,y-h):y+h, max(0,x-w):x+w] = -1

    def render(self, frame, sec):
        label = frame.label
        label((46, 24, 293, 54), "SECTION 03  /  DEVELOPMENTAL FATES", 16, BLUE, True, anchor="left")
        label((46, 56, 545, 101), "One early morphology, three possible fates", 34, INK, True, anchor="left")
        region = frame.gray[635:669, 48:270]
        index = max(range(len(CAPTIONS)), key=lambda i: cv2.minMaxLoc(cv2.matchTemplate(region, self.caption_patterns[i], cv2.TM_CCOEFF_NORMED))[1])
        label((48, 630, 1227, 672), CAPTIONS[index][1], 19, MUTED, width=1170, anchor="left")
        if sec < 13.56:
            shape = warm_bounds(frame.rgb, (140, 123, 752, 350)) if sec < 3.7 else None
            if shape:
                x, y, w, h = shape
                scale, cx, cy = w/130, x+w/2, y+h/2
            else:
                scale, cx, cy = 1, 240, 216
            def moved(box, text, size, color=INK, bold=False, width=None, anchor="center"):
                a,b,c,d = box
                label((cx+(a-240)*scale, cy+(b-216)*scale, cx+(c-240)*scale, cy+(d-216)*scale),
                      text, size*scale, color, bold, width*scale if width else None, anchor)
            moved((83, 144, 165, 176), "Perturbation", 17, (89,79,114), True, 115)
            moved((166, 402, 315, 439), "Early brightfield sequence", 20, INK, True, 280)
            if sec > 2.45:
                moved((355, 199, 425, 229), "Frame 5", 16, MUTED)
            if sec > 3.12:
                moved((515, 274, 635, 310), "Fate classifier", 20, INK, True, 156)
                moved((514, 532, 637, 566), "Sequence encoder", 20, INK, True, 164)
                moved((677, 428, 729, 457), "Content", 16, MUTED, False, 66)
                moved((677, 535, 729, 566), "Motion", 16, MUTED, False, 66)
        if sec > 5.28:
            title = "Most likely fate" if sec >= 11.35 else "Candidate fates"
            label((815, 115, 1008, 151), title, 18, TEAL if sec >= 11.35 else MUTED, True, 221, "left")
            if sec < 12.15:
                label((1035, 116, 1136, 152), "Probability", 16, MUTED, width=117)
                label((1152, 116, 1245, 152), "Virtual brightfield", 16, MUTED, width=114)
            self.candidates(frame)
        if sec > 13.2:
            label((108, 299, 212, 334), "Content features", 20, INK, True, width=170)
            label((112, 375, 205, 407), "Held fixed", 17, MUTED)
            label((108, 435, 212, 472), "Motion features", 20, INK, True, width=170)
            label((394, 534, 492, 568), "Updated at each step", 16, MUTED, width=167)
            label((746, 280, 840, 312), "Fate condition", 16, MUTED)
            label((628, 495, 749, 533), "Image generator", 20, INK, True, width=153)
            label((941, 492, 1110, 532), "Predicted future shapes", 20, INK, True, width=265)


def export(ffmpeg, name, destination):
    source = ROOT / (name+".mp4")
    output = destination / (name+"-en.mp4")
    capture = cv2.VideoCapture(str(source))
    fps = round(capture.get(cv2.CAP_PROP_FPS))
    frames = round(capture.get(cv2.CAP_PROP_FRAME_COUNT))
    if not frames or not fps:
        raise ValueError(f"Unreadable master: {source}")
    localize = FateLabels(capture, fps).render if name == "fates" else phenotypes
    cmd = [ffmpeg, "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", "1280x720",
           "-r", str(fps), "-i", "-", "-an", "-c:v", "libx264", "-threads", "4", "-preset", "fast",
           "-crf", "17", "-pix_fmt", "yuv420p", "-metadata:s:v:0", "language=eng", "-movflags", "+faststart", str(output)]
    poster = round((10.7 if name == "fates" else 8.4)*fps)
    with subprocess.Popen(cmd, stdin=subprocess.PIPE) as writer:
        for no in range(frames):
            ok, bgr = capture.read()
            if not ok:
                raise ValueError(f"Frame {no} could not be decoded")
            frame = Frame(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))
            localize(frame, no/fps)
            if no == poster or (no == 0 and name == "phenotypes"):
                suffix = "-en" if no == poster else "-en-opening"
                frame.image.save(destination / (name+suffix+".webp"), quality=94, method=6)
            writer.stdin.write(frame.image.tobytes())
        writer.stdin.close()
        if writer.wait():
            raise RuntimeError(f"Encoding failed: {name}")
    capture.release()
    print(f"{output.name}: {frames} frames at {fps} fps", flush=True)


if __name__ == "__main__":
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--ffmpeg", default="ffmpeg")
    cli.add_argument("films", nargs="*", default=["phenotypes", "fates"])
    args = cli.parse_args()
    with TemporaryDirectory(dir=ROOT) as temporary:
        destination = Path(temporary)
        for film in args.films:
            if film not in {"phenotypes", "fates"}:
                cli.error("Unknown film: " + film)
            export(args.ffmpeg, film, destination)
        for asset in destination.iterdir():
            asset.replace(ROOT / asset.name)
