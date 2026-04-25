import cv2
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from fastapi import FastAPI, File, UploadFile, Form
from fastapi.responses import JSONResponse
import base64
import io
from PIL import Image

try:
    from skimage.filters import threshold_sauvola
    SKIMAGE_AVAILABLE = True
except ImportError:
    SKIMAGE_AVAILABLE = False

app    = FastAPI()
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# ── Model definitions ─────────────────────────────────────────

class ConvBlock(nn.Module):
    def __init__(self, in_ch, out_ch, groups=8):
        super().__init__()
        g = min(groups, out_ch)
        self.block = nn.Sequential(
            nn.Conv2d(in_ch, out_ch, 3, padding=1, bias=False),
            nn.GroupNorm(g, out_ch),
            nn.ReLU(inplace=True),
            nn.Conv2d(out_ch, out_ch, 3, padding=1, bias=False),
            nn.GroupNorm(g, out_ch),
            nn.ReLU(inplace=True),
        )
    def forward(self, x): return self.block(x)


class UpBlock(nn.Module):
    def __init__(self, in_ch, skip_ch, out_ch):
        super().__init__()
        self.up   = nn.Sequential(
            nn.Upsample(scale_factor=2, mode='bilinear', align_corners=False),
            nn.Conv2d(in_ch, out_ch, kernel_size=1)
        )
        self.conv = ConvBlock(out_ch + skip_ch, out_ch)
    def forward(self, x, skip):
        x = self.up(x)
        if x.shape[-2:] != skip.shape[-2:]:
            x = F.interpolate(x, size=skip.shape[-2:],
                              mode='bilinear', align_corners=False)
        return self.conv(torch.cat([x, skip], dim=1))


class UNetDenoiser(nn.Module):
    def __init__(self, in_ch=1, out_ch=1, base_ch=32):
        super().__init__()
        b = base_ch
        self.enc1 = ConvBlock(in_ch, b)
        self.enc2 = ConvBlock(b,     b*2)
        self.enc3 = ConvBlock(b*2,   b*4)
        self.neck = ConvBlock(b*4,   b*8)
        self.pool = nn.MaxPool2d(2)
        self.dec3 = UpBlock(b*8, b*4, b*4)
        self.dec2 = UpBlock(b*4, b*2, b*2)
        self.dec1 = UpBlock(b*2, b,   b)
        self.out_conv = nn.Conv2d(b, out_ch, kernel_size=1)
    def forward(self, x):
        inp = x
        e1  = self.enc1(x)
        e2  = self.enc2(self.pool(e1))
        e3  = self.enc3(self.pool(e2))
        n   = self.neck(self.pool(e3))
        d3  = self.dec3(n,  e3)
        d2  = self.dec2(d3, e2)
        d1  = self.dec1(d2, e1)
        return torch.clamp(inp - self.out_conv(d1), 0.0, 1.0)


class CharCNN(nn.Module):
    def __init__(self, num_classes=62):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(1, 32, 3, padding=1), nn.BatchNorm2d(32), nn.ReLU(inplace=True),
            nn.Conv2d(32, 32, 3, padding=1), nn.BatchNorm2d(32), nn.ReLU(inplace=True),
            nn.MaxPool2d(2), nn.Dropout(0.1),
            nn.Conv2d(32, 64, 3, padding=1), nn.BatchNorm2d(64), nn.ReLU(inplace=True),
            nn.Conv2d(64, 64, 3, padding=1), nn.BatchNorm2d(64), nn.ReLU(inplace=True),
            nn.MaxPool2d(2), nn.Dropout(0.15),
            nn.Conv2d(64, 128, 3, padding=1), nn.BatchNorm2d(128), nn.ReLU(inplace=True),
            nn.Dropout(0.2),
        )
        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Linear(128*7*7, 256), nn.ReLU(inplace=True), nn.Dropout(0.3),
            nn.Linear(256, num_classes),
        )
    def forward(self, x):
        return self.classifier(self.features(x))


# ── Load models on startup ────────────────────────────────────

unet_model = UNetDenoiser().to(device)
unet_ckpt  = torch.load("unet_denoiser.pth",
                         map_location=device, weights_only=False)
unet_model.load_state_dict(unet_ckpt["model_state_dict"])
unet_model.eval()

cnn_ckpt   = torch.load("char74k_finetuned_cnn.pth",
                         map_location=device, weights_only=False)
NUM_CLASSES  = cnn_ckpt["num_classes"]
EMNIST_CHARS = cnn_ckpt["classes"]
IDX_TO_CHAR  = {i: ch for i, ch in enumerate(EMNIST_CHARS)}

cnn_model = CharCNN(NUM_CLASSES).to(device)
cnn_model.load_state_dict(cnn_ckpt["model_state_dict"])
cnn_model.eval()

print(f"Models loaded — {NUM_CLASSES} classes")


# ── Pipeline helpers ──────────────────────────────────────────

@torch.no_grad()
def denoise_image(image):
    h, w       = image.shape
    img_norm   = image.astype(np.float32) / 255.0
    pad_h      = (8 - h % 8) % 8
    pad_w      = (8 - w % 8) % 8
    img_padded = np.pad(img_norm, ((0, pad_h), (0, pad_w)), mode='reflect')
    tensor     = torch.from_numpy(img_padded).unsqueeze(0).unsqueeze(0).to(device)
    output     = unet_model(tensor).squeeze().cpu().numpy()
    return (output[:h, :w] * 255).clip(0, 255).astype(np.uint8)


def preprocess_for_segmentation(gray, method="sauvola"):
    if len(gray.shape) == 3:
        gray = cv2.cvtColor(gray, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (3, 3), 0)
    if method == "sauvola" and SKIMAGE_AVAILABLE:
        thresh = threshold_sauvola(blur, window_size=25, k=0.2)
        binary = (blur < thresh).astype(np.uint8) * 255
    else:
        _, binary = cv2.threshold(
            blur, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
        )
    kernel = np.ones((2, 2), np.uint8)
    binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)
    if np.sum(binary == 255) > np.sum(binary == 0):
        binary = 255 - binary
    return binary


def segment_lines(binary, min_line_height=10, row_frac=0.01):
    row_sum          = np.sum(binary > 0, axis=1)
    min_black_pixels = max(3, int(row_frac * binary.shape[1]))
    lines, in_line, start = [], False, 0
    for y, val in enumerate(row_sum):
        if not in_line and val >= min_black_pixels:
            in_line, start = True, y
        elif in_line and val < min_black_pixels:
            if y - start >= min_line_height:
                lines.append((start, y))
            in_line = False
    if in_line and (len(row_sum) - start) >= min_line_height:
        lines.append((start, len(row_sum)))
    return lines


def split_wide_box(line_binary, box, split_val_frac=0.15):
    x, y, w, h   = box
    col_sum      = np.sum(line_binary[y:y+h, x:x+w] > 0, axis=0)
    threshold    = max(1, int(split_val_frac * h))
    split_points = [i for i in range(1, len(col_sum)-1)
                    if col_sum[i] <= threshold
                    and col_sum[i-1] > threshold
                    and col_sum[i+1] > threshold]
    if not split_points:
        return [box]
    boxes, prev = [], 0
    for sp in split_points:
        if sp - prev > 2:
            boxes.append((x + prev, y, sp - prev, h))
        prev = sp
    if w - prev > 2:
        boxes.append((x + prev, y, w - prev, h))
    return boxes if len(boxes) > 1 else [box]


def segment_characters_in_line(line_binary, min_area=40, min_w=4,
                                min_h=8, max_w_ratio=0.18):
    contours, _ = cv2.findContours(
        line_binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )
    H, W  = line_binary.shape
    boxes = []
    for cnt in contours:
        x, y, w, h = cv2.boundingRect(cnt)
        if w*h < min_area or w < min_w or h < min_h:
            continue
        if w > 0.5*W and h < 0.35*H:
            continue
        boxes.append((x, y, w, h))
    boxes.sort(key=lambda b: b[0])
    final = []
    for box in boxes:
        x, y, w, h = box
        final.extend(
            split_wide_box(line_binary, box) if w > max_w_ratio*W else [box]
        )
    return sorted(final, key=lambda b: b[0])


def extract_character_crops(binary, pad=1):
    H, W    = binary.shape
    results = []
    for (ly1, ly2) in segment_lines(binary):
        char_boxes_local  = segment_characters_in_line(binary[ly1:ly2, :])
        char_boxes_global = []
        char_crops        = []
        for (x, y, w, h) in char_boxes_local:
            x1 = max(0, x - pad)
            y1 = max(0, ly1 + y - pad)
            x2 = min(W, x + w + pad)
            y2 = min(H, ly1 + y + h + pad)
            char_boxes_global.append((x1, y1, x2, y2))
            char_crops.append(binary[y1:y2, x1:x2])
        results.append({
            "line_box":   (ly1, ly2),
            "char_boxes": char_boxes_global,
            "char_crops": char_crops,
        })
    return results


def prepare_char_crop(crop, size=28):
    if crop is None or crop.size == 0:
        return np.zeros((size, size), dtype=np.float32)
    h, w     = crop.shape
    scale    = min((size-4)/max(h,1), (size-4)/max(w,1))
    new_w    = max(1, int(w * scale))
    new_h    = max(1, int(h * scale))
    resized  = cv2.resize(crop, (new_w, new_h), interpolation=cv2.INTER_AREA)
    canvas   = np.zeros((size, size), dtype=np.uint8)
    y_off    = (size - new_h) // 2
    x_off    = (size - new_w) // 2
    canvas[y_off:y_off+new_h, x_off:x_off+new_w] = resized
    min_val  = canvas.min()
    max_val  = canvas.max()
    if max_val > min_val:
        canvas = ((canvas - min_val) / (max_val - min_val) * 255).astype(np.uint8)
    img_f    = canvas.astype(np.float32) / 255.0
    return (img_f - 0.1736) / 0.3317


def reconstruct_line_with_spaces(char_boxes, predictions, space_multiplier=1.8):
    if not char_boxes or not predictions:
        return ""
    widths   = [x2 - x1 for (x1, y1, x2, y2) in char_boxes]
    median_w = float(np.median(widths)) if widths else 10.0
    gaps     = [char_boxes[i][0] - char_boxes[i-1][2]
                for i in range(1, len(char_boxes))]
    if not gaps:
        return "".join(predictions)
    gaps_arr    = np.array(gaps)
    sorted_gaps = np.sort(gaps_arr)
    if len(sorted_gaps) > 3:
        diffs     = np.diff(sorted_gaps)
        jump_idx  = np.argmax(diffs)
        jump_size = diffs[jump_idx]
        if jump_size > 2:
            space_threshold = max(2.0, (sorted_gaps[jump_idx] +
                                        sorted_gaps[jump_idx+1]) / 2)
        else:
            space_threshold = min(space_multiplier * median_w,
                                  gaps_arr.max() * 0.8)
    else:
        space_threshold = min(space_multiplier * median_w,
                              gaps_arr.max() * 0.8)
    result = [predictions[0]]
    for i in range(1, len(char_boxes)):
        if char_boxes[i][0] - char_boxes[i-1][2] > space_threshold:
            result.append(" ")
        result.append(predictions[i])
    return "".join(result)


# ── OCR endpoint ──────────────────────────────────────────────

@app.post("/ocr")
async def ocr(
    image: UploadFile = File(...),
    noise_profile: str = Form(default="none")
):
    # Read image
    contents = await image.read()
    nparr    = np.frombuffer(contents, np.uint8)
    img_bgr  = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    img_gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

    # Denoise
    denoised = denoise_image(img_gray)

    # Segment + recognise
    binary = preprocess_for_segmentation(denoised)
    seg    = extract_character_crops(binary)

    lines_out, all_confs = [], []
    for line in seg:
        preds = []
        for crop in line["char_crops"]:
            prepared = prepare_char_crop(crop)
            tensor   = torch.tensor(prepared, dtype=torch.float32)\
                           .unsqueeze(0).unsqueeze(0).to(device)
            with torch.no_grad():
                probs     = torch.softmax(cnn_model(tensor), dim=1)
                conf, idx = probs.max(dim=1)
            all_confs.append(conf.item())
            preds.append(IDX_TO_CHAR.get(idx.item(), "?"))
        line_text = reconstruct_line_with_spaces(line["char_boxes"], preds)
        lines_out.append(line_text)

    text      = "\n".join(lines_out)
    mean_conf = float(np.mean(all_confs)) if all_confs else 0.0

    # Return denoised image as base64
    denoised_pil    = Image.fromarray(denoised)
    buffer          = io.BytesIO()
    denoised_pil.save(buffer, format="PNG")
    denoised_b64    = base64.b64encode(buffer.getvalue()).decode()

    return JSONResponse({
        "text":           text,
        "confidence":     round(mean_conf, 4),
        "denoised_image": denoised_b64,
    })


@app.get("/health")
def health():
    return {"status": "ok"}