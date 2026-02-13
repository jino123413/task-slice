"""
Generate task-slice app icon with ComfyUI Flux Schnell.
- Output variants: task-slice/assets/icons/task-slice-v*.png
- Final logo: app-logos/task-slice.png (600x600)
"""
import json
import urllib.request
import urllib.parse
import time
from pathlib import Path

from PIL import Image

COMFYUI_URL = "http://127.0.0.1:8188"
ASSET_DIR = Path(__file__).parent / "assets" / "icons"
APP_LOGOS_PATH = Path(r"C:\Users\USER-PC\Desktop\appintoss-project\app-logos\task-slice.png")

PROMPTS = [
    {
        "name": "v1",
        "seed": 86231,
        "clip_l": (
            "app icon, white checklist sliced into five blocks on solid blue background, "
            "clean geometric, centered, minimal flat design, no text"
        ),
        "t5xxl": (
            "a premium mobile app icon on solid royal blue background hex 2F6BFF, "
            "centered white rounded square memo card, the card is visually divided into five horizontal slices, "
            "each slice has a subtle checkmark hint, one slice highlighted with cyan accent, "
            "clean flat vector illustration, bold and simple shapes, high contrast, "
            "modern productivity app identity, no gradients, no shadows, no text, no letters, square composition"
        ),
    },
    {
        "name": "v2",
        "seed": 86232,
        "clip_l": (
            "app icon, white lightning checklist with five steps on blue background, "
            "minimal geometric emblem, centered, no text"
        ),
        "t5xxl": (
            "a modern productivity app icon, solid blue background hex 2F6BFF, "
            "a central white emblem combining a checklist and forward arrow, "
            "five small step marks arranged vertically to indicate five-step action plan, "
            "sharp but friendly rounded geometry, one tiny accent in sky blue hex 7DD3FC, "
            "clean flat vector style, icon must be highly recognizable at small size, "
            "no text, no letters, no watermark, centered square icon"
        ),
    },
    {
        "name": "v3",
        "seed": 86233,
        "clip_l": (
            "app icon, white task card cut into five action strips, blue background, "
            "simple bold minimal symbol, centered, no text"
        ),
        "t5xxl": (
            "a minimalist app icon on solid blue background hex 2F6BFF, "
            "a white rounded card split into five clear action bars, "
            "bars are slightly staggered to imply quick execution and progress, "
            "tiny cyan progress dot as accent, "
            "flat vector brand style, clean edges, strong contrast, "
            "no gradients, no characters, no text, centered composition, square format"
        ),
    },
]


def queue_prompt(workflow: dict) -> str:
    payload = json.dumps({"prompt": workflow}).encode("utf-8")
    req = urllib.request.Request(
        f"{COMFYUI_URL}/prompt",
        data=payload,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req) as resp:
        result = json.loads(resp.read())
    return result["prompt_id"]


def wait_for_completion(prompt_id: str, timeout: int = 240) -> dict:
    start = time.time()
    while time.time() - start < timeout:
        req = urllib.request.Request(f"{COMFYUI_URL}/history/{prompt_id}")
        with urllib.request.urlopen(req) as resp:
            history = json.loads(resp.read())
        if prompt_id in history:
            return history[prompt_id]
        time.sleep(2)
    raise TimeoutError(f"Prompt {prompt_id} timed out")


def get_image(filename: str, subfolder: str = "", folder_type: str = "output") -> bytes:
    params = urllib.parse.urlencode(
        {"filename": filename, "subfolder": subfolder, "type": folder_type}
    )
    req = urllib.request.Request(f"{COMFYUI_URL}/view?{params}")
    with urllib.request.urlopen(req) as resp:
        return resp.read()


def build_workflow(prompt_data: dict, filename_prefix: str) -> dict:
    return {
        "1": {
            "class_type": "UnetLoaderGGUF",
            "inputs": {"unet_name": "flux1-schnell-Q4_K_S.gguf"},
        },
        "2": {
            "class_type": "DualCLIPLoaderGGUF",
            "inputs": {
                "clip_name1": "clip_l.safetensors",
                "clip_name2": "t5-v1_1-xxl-encoder-Q4_K_M.gguf",
                "type": "flux",
            },
        },
        "3": {
            "class_type": "CLIPTextEncodeFlux",
            "inputs": {
                "clip": ["2", 0],
                "clip_l": prompt_data["clip_l"],
                "t5xxl": prompt_data["t5xxl"],
                "guidance": 3.5,
            },
        },
        "4": {
            "class_type": "CLIPTextEncodeFlux",
            "inputs": {
                "clip": ["2", 0],
                "clip_l": "",
                "t5xxl": "",
                "guidance": 3.5,
            },
        },
        "5": {
            "class_type": "EmptySD3LatentImage",
            "inputs": {"width": 512, "height": 512, "batch_size": 1},
        },
        "6": {
            "class_type": "KSampler",
            "inputs": {
                "model": ["1", 0],
                "seed": prompt_data["seed"],
                "steps": 4,
                "cfg": 1.0,
                "sampler_name": "euler",
                "scheduler": "simple",
                "positive": ["3", 0],
                "negative": ["4", 0],
                "latent_image": ["5", 0],
                "denoise": 1.0,
            },
        },
        "7": {"class_type": "VAELoader", "inputs": {"vae_name": "ae.safetensors"}},
        "8": {
            "class_type": "VAEDecode",
            "inputs": {"samples": ["6", 0], "vae": ["7", 0]},
        },
        "9": {
            "class_type": "SaveImage",
            "inputs": {"images": ["8", 0], "filename_prefix": filename_prefix},
        },
    }


def write_png(raw_data: bytes, path: Path, size: int = 600) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.parent / f"{path.stem}.tmp.png"
    with open(tmp, "wb") as file:
        file.write(raw_data)
    with Image.open(tmp) as image:
        resized = image.convert("RGBA").resize((size, size), Image.LANCZOS)
        resized.save(path, format="PNG", optimize=True)
    tmp.unlink(missing_ok=True)


def main() -> None:
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    generated_paths: list[Path] = []

    for prompt in PROMPTS:
        run_prefix = f"task_slice_{prompt['name']}_{int(time.time() * 1000)}"
        workflow = build_workflow(prompt, run_prefix)
        prompt_id = queue_prompt(workflow)
        history = wait_for_completion(prompt_id)
        outputs = history.get("outputs", {})

        image_saved = False
        for output in outputs.values():
            images = output.get("images", [])
            if not images:
                continue
            image_info = images[0]
            image_data = get_image(
                image_info["filename"],
                image_info.get("subfolder", ""),
                image_info.get("type", "output"),
            )
            out_path = ASSET_DIR / f"task-slice-{prompt['name']}.png"
            write_png(image_data, out_path, size=600)
            generated_paths.append(out_path)
            image_saved = True
            print(f"Saved: {out_path}")
            break

        if not image_saved:
            raise RuntimeError(f"No image output for prompt {prompt['name']}")

    # Final selection: v2 (most symbol-like prompt)
    selected = ASSET_DIR / "task-slice-v2.png"
    if not selected.exists():
        selected = generated_paths[0]

    APP_LOGOS_PATH.write_bytes(selected.read_bytes())
    print(f"Final icon: {APP_LOGOS_PATH}")


if __name__ == "__main__":
    main()
