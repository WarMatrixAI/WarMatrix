"""
WarMatrix AI Backend Server
──────────────────────────
Serves POST /api/sitrep — forwards prompts to the fine-tuned wargaming LLM
and returns generated SITREP text.

Speed knobs (env vars):
  MAX_NEW_TOKENS   int   Default output token cap  (default: 150)
  USE_CACHE        bool  Enable KV cache            (default: true)  ← biggest win
  DO_SAMPLE        bool  Sampling vs greedy decode  (default: false) ← greedy is faster
  TEMPERATURE      float Sampling temp              (default: 0.7)
  TOP_P            float Nucleus sampling           (default: 0.9)
  LOAD_IN_4BIT     bool  4-bit NF4 quantisation    (default: true)
  MAX_GPU_MEMORY_GB float GPU memory cap in GiB    (default: 4.5)
  COMPUTE_DTYPE    str   bfloat16|float16|float32   (default: float16)
"""

import json
import os
import sys
import threading
import time
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import torch
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig

# ─── Config ───────────────────────────────────────────────────────────────────

HOST                       = "0.0.0.0"
PORT                       = 8000
MODEL_PATH                 = os.environ.get("MODEL_PATH", "wargaming_llm\\wargame_final_outputs\\checkpoint-125")
MAX_SEQ_LENGTH             = 2048
LOAD_IN_4BIT               = os.environ.get("LOAD_IN_4BIT",  "true").strip().lower()  in {"1", "true", "yes", "on"}
USE_8BIT                   = os.environ.get("USE_8BIT",      "false").strip().lower() in {"1", "true", "yes", "on"}
MAX_GPU_MEMORY_GB          = float(os.environ.get("MAX_GPU_MEMORY_GB", "4.5"))
COMPUTE_DTYPE              = os.environ.get("COMPUTE_DTYPE", "float16").strip().lower()
EMPTY_CUDA_CACHE           = os.environ.get("EMPTY_CUDA_CACHE_AFTER_REQUEST", "true").strip().lower() in {"1", "true", "yes", "on"}

# Generation defaults — can all be overridden per-request via JSON body
DEFAULT_MAX_NEW_TOKENS     = int(os.environ.get("MAX_NEW_TOKENS", "150"))   # lower = faster
DEFAULT_USE_CACHE          = os.environ.get("USE_CACHE",    "true").strip().lower()  in {"1", "true", "yes", "on"}
DEFAULT_DO_SAMPLE          = os.environ.get("DO_SAMPLE",    "false").strip().lower() in {"1", "true", "yes", "on"}
DEFAULT_TEMPERATURE        = float(os.environ.get("TEMPERATURE", "0.7"))
DEFAULT_TOP_P              = float(os.environ.get("TOP_P", "0.9"))
DEFAULT_REPETITION_PENALTY = float(os.environ.get("REPETITION_PENALTY", "1.1"))

_model        = None
_tokenizer    = None
_model_lock   = threading.Lock()
_resolved_model_path = None

# ─── Logging helpers ──────────────────────────────────────────────────────────

def _ts() -> str:
    return datetime.now().strftime("%H:%M:%S")

def log(msg: str) -> None:
    print(f"[{_ts()}] {msg}", flush=True)

def log_section(title: str) -> None:
    bar = "─" * (60 - len(title) - 3)
    print(f"\n[{_ts()}] ── {title} {bar}", flush=True)

# ─── Model helpers ────────────────────────────────────────────────────────────

def _get_base_model_name(adapter_path: str) -> str:
    adapter_config_path = Path(adapter_path) / "adapter_config.json"
    with open(adapter_config_path, "r", encoding="utf-8") as f:
        raw_text = f.read()

    if not raw_text.strip():
        raise RuntimeError(
            f"adapter_config.json is empty at: {adapter_config_path}. "
            "This usually means model artifacts are missing."
        )

    if raw_text.startswith("version https://git-lfs.github.com/spec/v1"):
        raise RuntimeError(
            "adapter_config.json is a Git LFS pointer, not real JSON. "
            "Pull model artifacts with Git LFS from the repo root:\n"
            "  git lfs install\n"
            "  git lfs pull\n"
            f"File: {adapter_config_path}"
        )

    try:
        adapter_config = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        raise RuntimeError(
            f"Invalid adapter_config.json at {adapter_config_path}: {exc}"
        ) from exc

    base_model_name = str(adapter_config.get("base_model_name_or_path", "")).strip()
    if not base_model_name:
        base_model_name = os.environ.get("BASE_MODEL_NAME", "").strip()

    if not base_model_name:
        raise RuntimeError(
            "Could not determine base model name. Expected 'base_model_name_or_path' in "
            f"{adapter_config_path} or env var BASE_MODEL_NAME."
        )

    return base_model_name


def _resolve_model_path(model_path: str) -> str:
    requested = Path(model_path)
    ai_server_dir = Path(__file__).resolve().parent
    candidates = []

    if requested.is_absolute():
        candidates.append(requested)
    else:
        candidates.append(Path.cwd() / requested)
        candidates.append(ai_server_dir / requested)

    candidates.append(ai_server_dir.parent.parent / "wargaming_llm" / "wargame_final_outputs" / "checkpoint-125")
    if len(ai_server_dir.parents) >= 3:
        candidates.append(ai_server_dir.parents[2] / "wargaming_llm" / "wargame_final_outputs" / "checkpoint-125")

    deduped, seen = [], set()
    for c in candidates:
        key = str(c.resolve()).lower()
        if key not in seen:
            deduped.append(c.resolve())
            seen.add(key)

    for c in deduped:
        if (c / "adapter_config.json").exists():
            return str(c)

    searched = "\n".join(f"  - {p}" for p in deduped)
    raise FileNotFoundError(
        "Could not find adapter checkpoint (adapter_config.json missing).\n"
        "Set MODEL_PATH to your checkpoint folder, e.g.:\n"
        "  $env:MODEL_PATH='C:\\models\\wargame_final_outputs\\checkpoint-125'\n"
        f"Searched:\n{searched}"
    )


def _resolve_compute_dtype() -> torch.dtype:
    if COMPUTE_DTYPE == "bfloat16":
        return torch.bfloat16
    if COMPUTE_DTYPE == "float32":
        return torch.float32
    return torch.float16


def build_prompt(instruction: str, battlefield_data: str) -> str:
    system_context = (
        "You are the WarMatrix Tactical AI Strategist. The wargame simulation has transitioned to a continuous, real-world coordinate system "
        "with float values for coordinates and multi-layered semantic terrain (Urban cover, Plains open ground, Mountain elevation, "
        "and rapid-transit Roads). The system operates on a time-stepped tick loop incorporating stateful units (Infantry, Armor, Recon, "
        "Artillery, Logistics, Command) that transition through Active, Damaged, and Destroyed statuses. Weather conditions "
        "(Fog, Storm, Sandstorm) directly reduce vision, movement, and accuracy. When providing briefings, sitreps, or explaining "
        "decisions, always reason and speak in terms of these continuous spatial dynamics, cover values, weather impact, and "
        "detailed stateful entity attributes."
    )
    return (
        f"System: {system_context}\n\n"
        "Below is an instruction that describes a task, paired with an input that provides further context. "
        "Write a response that appropriately completes the request.\n"
        "Return only the final SITREP output. Do not include reasoning, analysis notes, or <think> blocks.\n\n"
        f"### Instruction:\n{instruction}\n\n"
        f"### Input:\n{battlefield_data}\n\n"
        "### Response:\n"
    )


def clean_response_text(text: str) -> str:
    if "<think>" in text and "</think>" in text:
        start = text.find("<think>")
        end = text.find("</think>") + len("</think>")
        text = (text[:start] + text[end:]).strip()
    if text.startswith("Response:"):
        text = text[len("Response:"):].strip()
    return text.strip()

# ─── Model loading ────────────────────────────────────────────────────────────

def load_model() -> None:
    global _model, _tokenizer, _resolved_model_path
    if _model is not None and _tokenizer is not None:
        return

    _resolved_model_path = _resolve_model_path(MODEL_PATH)
    base_model_name = _get_base_model_name(_resolved_model_path)

    log(f"Adapter path : {_resolved_model_path}")
    log(f"Base model   : {base_model_name}")

    hf_token = os.environ.get("HF_TOKEN")
    model_kwargs = {"trust_remote_code": True, "token": hf_token}

    log("Loading tokenizer…")
    _tokenizer = AutoTokenizer.from_pretrained(_resolved_model_path, trust_remote_code=True, token=hf_token)

    has_cuda     = torch.cuda.is_available()
    compute_dtype = _resolve_compute_dtype()

    if has_cuda and LOAD_IN_4BIT and not USE_8BIT:
        log(f"Quantisation : 4-bit NF4  compute={COMPUTE_DTYPE}")
        model_kwargs["quantization_config"] = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_compute_dtype=compute_dtype,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_use_double_quant=True,
        )
        model_kwargs["device_map"] = "auto"
    elif has_cuda and USE_8BIT:
        log(f"Quantisation : 8-bit  compute={COMPUTE_DTYPE}")
        model_kwargs["quantization_config"] = BitsAndBytesConfig(load_in_8bit=True)
        model_kwargs["device_map"] = "auto"
    elif has_cuda:
        log(f"Full precision  dtype={COMPUTE_DTYPE}  GPU")
        model_kwargs["torch_dtype"] = compute_dtype
        model_kwargs["device_map"] = "auto"
    else:
        log("No CUDA — running on CPU (will be slow)")
        model_kwargs["torch_dtype"] = torch.float32

    # Force SDPA (Scaled Dot Product Attention) to avoid "fast path" errors on Windows
    # while maintaining high performance. 
    model_kwargs["attn_implementation"] = "sdpa"

    if has_cuda:
        gpu_mem_mb = max(int(MAX_GPU_MEMORY_GB * 1024), 1024)
        max_mem_map: dict = {}
        try:
            cuda_count = torch.cuda.device_count()
        except Exception:
            cuda_count = 1
        for i in range(max(1, cuda_count)):
            max_mem_map[i] = f"{gpu_mem_mb}MiB"
        max_mem_map["cpu"] = "48GiB"
        model_kwargs["max_memory"] = max_mem_map
        if os.environ.get("FORCE_CPU", "").strip().lower() in {"1", "true", "yes", "on"}:
            model_kwargs["device_map"] = {"": "cpu"}

    model_kwargs["low_cpu_mem_usage"] = True

    log("Loading base model weights…")
    t0 = time.perf_counter()
    try:
        base_model = AutoModelForCausalLM.from_pretrained(base_model_name, **model_kwargs)
        log("Applying LoRA adapter…")
        _model = PeftModel.from_pretrained(base_model, _resolved_model_path)
        _model.eval()
    except OSError as exc:
        err = str(exc)
        if "os error 1455" in err.lower() or "paging file is too small" in err.lower():
            raise RuntimeError(
                "Model load failed — Windows paging file too small. "
                "Set system-managed page file (>= 32 GB) and restart."
            ) from exc
        raise

    elapsed = time.perf_counter() - t0
    device_name = torch.cuda.get_device_name(0) if has_cuda else "CPU"
    log(f"Model ready in {elapsed:.1f}s  device={device_name}")

# ─── Inference ────────────────────────────────────────────────────────────────

def generate_sitrep(
    instruction: str,
    battlefield_data: str,
    max_new_tokens: int  = DEFAULT_MAX_NEW_TOKENS,
    use_cache: bool      = DEFAULT_USE_CACHE,
    do_sample: bool      = DEFAULT_DO_SAMPLE,
    temperature: float   = DEFAULT_TEMPERATURE,
    top_p: float         = DEFAULT_TOP_P,
    repetition_penalty: float = DEFAULT_REPETITION_PENALTY,
) -> str:
    if _model is None or _tokenizer is None:
        raise RuntimeError("Model is not loaded")

    prompt = build_prompt(instruction=instruction, battlefield_data=battlefield_data)
    prompt_tokens = len(_tokenizer.encode(prompt))
    device = "cuda" if torch.cuda.is_available() else "cpu"

    # ── Terminal output ──────────────────────────────────────────────────────
    log_section("INCOMING REQUEST")
    log(f"Instruction  : {instruction[:120]}{'…' if len(instruction) > 120 else ''}")
    log(f"Battlefield  : {battlefield_data[:120]}{'…' if len(battlefield_data) > 120 else ''}")
    log(f"Settings     : max_new_tokens={max_new_tokens}  use_cache={use_cache}  "
        f"do_sample={do_sample}  temp={temperature}  top_p={top_p}")
    log(f"Prompt tokens: {prompt_tokens}  |  device={device}")
    log("Generating…")

    t_start = time.perf_counter()

    gen_kwargs: dict = {
        "max_new_tokens":    max_new_tokens,
        "use_cache":         use_cache,
        "eos_token_id":      _tokenizer.eos_token_id,
        "pad_token_id":      _tokenizer.eos_token_id,
    }
    if do_sample:
        gen_kwargs["do_sample"]   = True
        gen_kwargs["temperature"] = temperature
        gen_kwargs["top_p"]       = top_p
    else:
        gen_kwargs["do_sample"] = False   # greedy — fastest

    with _model_lock:
        inputs = _tokenizer(text=[prompt], return_tensors="pt").to(device)
        input_len = inputs["input_ids"].shape[1]

        with torch.inference_mode():
            output_ids = _model.generate(**inputs, **gen_kwargs)

    # Slice only the newly generated tokens (skip the prompt)
    new_ids = output_ids[0][input_len:]
    response_text = _tokenizer.decode(new_ids, skip_special_tokens=True)
    response_text = clean_response_text(response_text)

    elapsed = time.perf_counter() - t_start
    out_tokens = len(new_ids)
    tok_per_sec = out_tokens / elapsed if elapsed > 0 else 0

    log(f"Done  {out_tokens} tokens in {elapsed:.1f}s  ({tok_per_sec:.1f} tok/s)")
    log(f"Response preview: {response_text[:120]}{'…' if len(response_text) > 120 else ''}")

    if torch.cuda.is_available() and EMPTY_CUDA_CACHE:
        del inputs, output_ids, new_ids
        torch.cuda.empty_cache()

    return response_text

# ─── HTTP Handler ─────────────────────────────────────────────────────────────

class BackendHandler(BaseHTTPRequestHandler):

    # Silence the default per-request access log — we print our own
    def log_message(self, fmt, *args):  # type: ignore[override]
        pass

    def log_request(self, code="-", size="-"):  # type: ignore[override]
        pass

    def _normalized_path(self) -> str:
        path = urlparse(self.path).path.rstrip("/")
        return path if path else "/"

    def _query_params(self) -> dict:
        return parse_qs(urlparse(self.path).query)

    def _send_json(self, status_code: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError, OSError) as exc:
            # Client disconnected before response finished writing (common on timeout/cancel).
            log(f"Client disconnected during response write: {exc}")

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    # ── GET ───────────────────────────────────────────────────────────────────

    def do_GET(self) -> None:
        path  = self._normalized_path()
        query = self._query_params()

        if path == "/":
            self._send_json(200, {
                "ok": True, "service": "wargaming-backend",
                "message": "Use /health, /api/echo, or /api/sitrep",
                "endpoints": {"GET": ["/", "/health", "/api/echo"], "POST": ["/api/echo", "/api/sitrep"]},
            })
            return

        if path == "/health":
            log(f"Health check from {self.client_address[0]}")
            self._send_json(200, {
                "ok": True,
                "service": "wargaming-backend",
                "model_loaded": _model is not None,
                "model_path": str(_resolved_model_path or MODEL_PATH),
                "device": "cuda" if torch.cuda.is_available() else "cpu",
            })
            return

        if path == "/api/echo":
            self._send_json(200, {"ok": True, "received": query})
            return

        self._send_json(404, {"error": "Not found"})

    # ── POST ──────────────────────────────────────────────────────────────────

    def do_POST(self) -> None:
        path           = self._normalized_path()
        content_length = int(self.headers.get("Content-Length", 0))
        raw_body       = self.rfile.read(content_length) if content_length > 0 else b"{}"

        try:
            body = json.loads(raw_body.decode("utf-8")) if raw_body else {}
        except (json.JSONDecodeError, UnicodeDecodeError):
            self._send_json(400, {"error": "Invalid JSON body"})
            return

        if path == "/api/echo":
            self._send_json(200, {"ok": True, "received": body})
            return

        if path == "/api/sitrep":
            instruction     = body.get("instruction", "Generate a tactical SITREP.")
            battlefield_data = body.get("battlefield_data", "")

            if not battlefield_data:
                self._send_json(400, {"error": "battlefield_data is required"})
                return

            # Check for LM Studio redirection
            use_lm_studio = os.environ.get("USE_LM_STUDIO", "false").lower() in ("true", "1", "yes")
            ip = os.environ.get("LM_STUDIO_IP", "127.0.0.1")
            port = os.environ.get("LM_STUDIO_PORT", "1234")
            lm_studio_url = f"http://{ip}:{port}" if use_lm_studio else None

            if lm_studio_url:
                log(f"Proxying request to LM Studio: {lm_studio_url}")
                try:
                    import urllib.request
                    
                    api_key = os.environ.get("LM_STUDIO_API_KEY", "not-needed").strip()
                    # Sanitize: Remove "Bearer " prefix if user provided it in the env var
                    if api_key.lower().startswith("bearer "):
                        api_key = api_key[7:].strip()
                    
                    masked_token = f"{api_key[:6]}...{api_key[-4:]}" if len(api_key) > 10 else "***"
                    log(f"Proxying request to LM Studio with token: {masked_token}")
                    
                    # Map our internal keys to OpenAI-compatible messages with enriched system context
                    system_message = (
                        "You are the WarMatrix Tactical AI Strategist. The wargame simulation has transitioned to a continuous, real-world coordinate system "
                        "with float values for coordinates and multi-layered semantic terrain (Urban cover, Plains open ground, Mountain elevation, "
                        "and rapid-transit Roads). The system operates on a time-stepped tick loop incorporating stateful units (Infantry, Armor, Recon, "
                        "Artillery, Logistics, Command) that transition through Active, Damaged, and Destroyed statuses. Weather conditions "
                        "(Fog, Storm, Sandstorm) directly reduce vision, movement, and accuracy. When providing briefings, sitreps, or explaining "
                        "decisions, always reason and speak in terms of these continuous spatial dynamics, cover values, weather impact, and "
                        "detailed stateful entity attributes.\n\n"
                        f"{instruction}"
                    )
                    openai_payload = {
                        "model": "local-model",
                        "messages": [
                            {"role": "system", "content": system_message},
                            {"role": "user", "content": battlefield_data}
                        ],
                        "temperature": float(body.get("temperature", DEFAULT_TEMPERATURE)),
                        "max_tokens": int(body.get("max_new_tokens", DEFAULT_MAX_NEW_TOKENS)),
                        "stream": False
                    }
                    
                    headers = {
                        "Content-Type": "application/json",
                        "Accept": "application/json",
                        "Authorization": f"Bearer {api_key}"
                    }
                    
                    proxy_req = urllib.request.Request(
                        f"{lm_studio_url.rstrip('/')}/v1/chat/completions",
                        data=json.dumps(openai_payload).encode("utf-8"),
                        headers=headers
                    )
                    
                    with urllib.request.urlopen(proxy_req, timeout=120) as resp:
                        proxy_data = json.loads(resp.read().decode("utf-8"))
                        response_text = proxy_data["choices"][0]["message"]["content"]
                        self._send_json(200, {"ok": True, "response": response_text, "source": "lm_studio"})
                        return
                except Exception as exc:
                    log(f"LM Studio proxy FAILED: {exc}")
                    self._send_json(500, {"error": "lm_studio_proxy_failed", "details": str(exc)})
                    return

            # Per-request overrides (all optional)
            max_new_tokens      = max(32, int(body.get("max_new_tokens",      DEFAULT_MAX_NEW_TOKENS)))
            temperature         = max(0.0, min(float(body.get("temperature",       DEFAULT_TEMPERATURE)),        2.0))
            top_p               = max(0.1, min(float(body.get("top_p",             DEFAULT_TOP_P)),              1.0))
            repetition_penalty  = max(1.0, min(float(body.get("repetition_penalty", DEFAULT_REPETITION_PENALTY)), 2.0))
            use_cache           = bool(body.get("use_cache",   DEFAULT_USE_CACHE))
            do_sample           = bool(body.get("do_sample",   DEFAULT_DO_SAMPLE))

            try:
                response_text = generate_sitrep(
                    instruction=instruction,
                    battlefield_data=str(battlefield_data),
                    max_new_tokens=max_new_tokens,
                    use_cache=use_cache,
                    do_sample=do_sample,
                    temperature=temperature,
                    top_p=top_p,
                    repetition_penalty=repetition_penalty,
                )
            except Exception as exc:
                log(f"ERROR during inference: {exc}")
                self._send_json(500, {"error": "inference_failed", "details": str(exc)})
                return

            self._send_json(200, {"ok": True, "response": response_text})
            return

        self._send_json(404, {"error": "Not found"})

# ─── Entry point ──────────────────────────────────────────────────────────────

def run() -> None:
    print("=" * 62, flush=True)
    print("  WarMatrix AI Backend Server", flush=True)
    print(f"  Python {sys.version.split()[0]}  |  PyTorch {torch.__version__}", flush=True)
    print(f"  CUDA available : {torch.cuda.is_available()}", flush=True)
    if torch.cuda.is_available():
        print(f"  GPU            : {torch.cuda.get_device_name(0)}", flush=True)
    print(f"  Max new tokens : {DEFAULT_MAX_NEW_TOKENS}", flush=True)
    print(f"  KV cache       : {DEFAULT_USE_CACHE}", flush=True)
    print(f"  Sampling       : {DEFAULT_DO_SAMPLE}", flush=True)
    print("=" * 62, flush=True)

    use_lm_studio = os.environ.get("USE_LM_STUDIO", "false").lower() in ("true", "1", "yes")
    ip = os.environ.get("LM_STUDIO_IP", "127.0.0.1")
    port = os.environ.get("LM_STUDIO_PORT", "1234")
    lm_studio_url = f"http://{ip}:{port}" if use_lm_studio else None

    if lm_studio_url:
        log(f"LM Studio Proxy Mode ACTIVE (skipping local model load)")
        log(f"Forwarding requests to: {lm_studio_url}")
    else:
        log("Loading fine-tuned model — this may take a minute…")
        load_model()

    server = ThreadingHTTPServer((HOST, PORT), BackendHandler)
    log(f"Server listening on http://{HOST}:{PORT}")
    log("Endpoints: GET /health  |  POST /api/sitrep  |  POST /api/echo")
    log("Ready — waiting for requests.\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        log("Shutting down…")
        server.shutdown()


if __name__ == "__main__":
    run()
