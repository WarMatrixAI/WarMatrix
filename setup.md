# 🎖️ WarMatrix: Universal Setup Guide

Welcome to the WarMatrix Command Center. Follow this guide to initialize the tactical simulation suite and prepare for deployment.

---

## 📋 Phase 1: System Prerequisites

Before proceeding, ensure your station is equipped with the following:

- **Node.js**: v20 or higher.
- **Python**: v3.10 to v3.12 (v3.12 recommended).
- **Git**: Required for repository management and model acquisition.
- **NVIDIA GPU**: Required for high-performance local AI inference (VRAM: 8GB+ recommended, 4GB minimum with quantization).

---

## 🔌 Phase 2: Core Application Setup

Initialize the primary interface and the simulation engine.

1.  **Frontend Installation**:
    ```bash
    # Install dependencies
    npm install
    ```

2.  **Simulation Backend Setup**:
    ```powershell
    # Navigate to root (if not already there)
    cd WarMatrix

    # Create and activate virtual environment
    python -m venv .venv
    & .\.venv\Scripts\Activate.ps1

    # (1) Install core simulation engine requirements
    #     Installs: numpy, fastapi, uvicorn, pydantic
    pip install -r backend/requirements.txt

    # (2) Install AI server requirements (GPU/LLM inference stack)
    #     Installs: torch (CUDA 12.8), transformers, peft, bitsandbytes, accelerate
    #     NOTE: Skip this step if you are using LM Studio (Method C in Phase 3).
    pip install -r ai_server/requirements.txt
    ```
    
---

## 🧠 Phase 3: AI Server Configuration

WarMatrix uses a dedicated AI server for tactical synthesis and scenario generation. Choose the method that best fits your hardware capabilities:

### **Method A: Quick Start / Standard (Recommended)**
Use this if you want to get up and running quickly using a standard virtual environment.
👉 **[View Quick Start Guide](./ai_server/SETUP_QUICKSTART.md)**

### **Method B: High-Performance GPU (Conda/Unsloth)**
Use this for the best performance. Optimized for NVIDIA GPUs using Conda and Unsloth for ultra-fast response times.
👉 **[View High-Performance Guide](./ai_server/SETUP_LOCAL_GPU.md)**

### **Method C: LM Studio Proxy (Lightweight)**
Use this if you are VRAM-constrained or want to run the model on a separate machine in your network via LM Studio.
👉 **[View LM Studio Guide](./ai_server/SETUP_LM_STUDIO.md)**

### **Method D: Gemini API (Cloud-based)**
Use this for a fully managed cloud experience. No local GPU required.
👉 **[View Gemini Setup Guide](./ai_server/SETUP_GEMINI.md)**

---

## 🚀 Phase 4: Launching the System

Once all components are configured, you can launch the entire suite concurrently using:

```bash
npm run dev
```

The Command Console will be available at `http://localhost:3000`.

---
*Document maintained by the WarMatrix Operational Command.*
