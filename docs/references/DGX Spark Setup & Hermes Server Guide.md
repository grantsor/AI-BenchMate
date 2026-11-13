# DGX Spark Setup & Hermes Server Guide

Complete technical walkthrough and command reference for configuring the **NVIDIA DGX Spark** (Grace Blackwell GB10, ARM64 / `aarch64`, Local IP: `192.168.50.55`) as a centralized AI inference server for **Ollama**, **LM Studio**, **vLLM**, and **ComfyUI**, accessible remotely from a Windows PC and **Hermes Agent**.

---

## 1\. System Overview & Network Architecture

* **Host Machine:** NVIDIA DGX Spark (Ubuntu Linux, ARM64 `aarch64`)  
* **Local IP Address:** `192.168.50.55`  
* **User Account:** `gadgetpilipinas`  
* **Centralized Model Directory:** `/home/gadgetpilipinas/models`

### Service Port Map

| Service | Port | Local Network Endpoint | Primary Use Case |
| :---- | :---: | :---- | :---- |
| **Ollama** | `11434` | `http://192.168.50.55:11434/v1` | GGUF LLM serving & dynamic VRAM swapping |
| **LM Studio** | `1234` | `http://192.168.50.55:1234/v1` | Local OpenAI-compatible GGUF serving via `lms` CLI |
| **vLLM** | `8000` | `http://192.168.50.55:8000/v1` | Native Safetensors / NVFP4 high-throughput serving |
| **ComfyUI** | `8189` | `http://192.168.50.55:8189/` | Diffusion image and 3D generation workflows |

### Firewall Configuration (UFW)

```sh
sudo ufw allow 11434/tcp comment 'Ollama'
sudo ufw allow 1234/tcp comment 'LM Studio'
sudo ufw allow 8000/tcp comment 'vLLM'
sudo ufw allow 8189/tcp comment 'ComfyUI'
sudo ufw reload
```

---

## 2\. Centralized Model Storage (`/home/gadgetpilipinas/models`)

All model weights are stored in `/home/gadgetpilipinas/models` to prevent duplicating tens or hundreds of gigabytes across Ollama, LM Studio, and ComfyUI.

### Directory Structure Setup

```sh
mkdir -p /home/gadgetpilipinas/models/{checkpoints,diffusion_models,vae,clip_vision,clip,background_removal,loras,geometry_estimation}
```

### Link LM Studio to Central Storage

```sh
mkdir -p /home/gadgetpilipinas/.lmstudio

if [ -d "/home/gadgetpilipinas/.lmstudio/models" ] && [ ! -L "/home/gadgetpilipinas/.lmstudio/models" ]; then
    cp -rn /home/gadgetpilipinas/.lmstudio/models/* /home/gadgetpilipinas/models/ 2>/dev/null
    rm -rf /home/gadgetpilipinas/.lmstudio/models
fi

ln -sfn /home/gadgetpilipinas/models /home/gadgetpilipinas/.lmstudio/models
```

---

## 3\. Ollama Setup, Permissions & Model Registration

### Systemd User & Storage Override

To prevent `status=1/FAILURE` permission errors when Ollama accesses `/home/gadgetpilipinas/models` and to expose it on `0.0.0.0:11434`:

```sh
sudo fuser -k -9 11434/tcp

sudo bash -c 'cat << "EOF" > /etc/systemd/system/ollama.service.d/override.conf
[Service]
User=gadgetpilipinas
Group=gadgetpilipinas
Environment="OLLAMA_HOST=0.0.0.0:11434"
Environment="OLLAMA_MODELS=/home/gadgetpilipinas/models"
EOF'

sudo systemctl daemon-reload
sudo systemctl restart ollama
```

### Pulling & Registering LLM Models

1. **Pull GGUF Directly from Hugging Face:**

```sh
ollama pull hf.co/NousResearch/Hermes-3-Llama-3.1-8B-GGUF:Q8_0
ollama pull hf.co/JonathanColetti/Qwen3.8-27B-Uncensored-GGUF:Q4_K_M
ollama pull hf.co/InfinimindCreations/gemma-4-31B-it-uncensored:Q8_0
ollama pull hf.co/orcarouter/Qwen3.8-Flash-Next-Uncensored-GGUF:Q4_K_M
```

2. **Register Local GGUF Files into Ollama:**

```sh
ollama create nemotron-nano-reasoning -f <(echo "FROM /home/gadgetpilipinas/models/nemotron-3-nano-omni-30b-a3b-reasoning-gguf/Nemotron-3-Nano-Omni-30B-A3B-Reasoning-Q4_K_M.gguf")
ollama create gemma-4-31b-qat -f <(echo "FROM /home/gadgetpilipinas/models/gemma-4-31B-it-QAT-GGU/gemma-4-31B-it-QAT-Q4_0.gguf")
```

---

## 4\. LM Studio Remote Server Setup (`lms` CLI)

### Fix Missing `.internal/temp` Directory Error

If LM Studio throws `ENOENT: no such file or directory, mkdtemp '/home/gadgetpilipinas/.lmstudio/.internal/temp/...'`:

```sh
mkdir -p /home/gadgetpilipinas/.lmstudio/.internal/temp
chmod -R 755 /home/gadgetpilipinas/.lmstudio/.internal
```

### Start Server & Load Model

```sh
# Start headless OpenAI-compatible server on port 1234
/home/gadgetpilipinas/.lmstudio/bin/lms server start --bind 0.0.0.0 --port 1234 --cors

# List available models
/home/gadgetpilipinas/.lmstudio/bin/lms ls

# Load model into unified GPU memory
/home/gadgetpilipinas/.lmstudio/bin/lms load /home/gadgetpilipinas/models/nemotron-3-nano-omni-30b-a3b-reasoning-gguf/Nemotron-3-Nano-Omni-30B-A3B-Reasoning-Q4_K_M.gguf --gpu 1.0

# Verify loaded state
/home/gadgetpilipinas/.lmstudio/bin/lms ps
```

---

## 5\. vLLM Setup for Safetensors & NVFP4 Models

### Download & Serve `NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4`

```sh
# Direct Python download bypassing transformers version checks
python3 -c "from huggingface_hub import snapshot_download; snapshot_download(repo_id='nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4')"

# Serve via vLLM in a persistent tmux session (capping VRAM at 70% to leave headroom for Ollama)
tmux new-session -d -s vllm_nemotron "bash -c 'vllm serve nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4 --host 0.0.0.0 --port 8000 --gpu-memory-utilization 0.70 --trust-remote-code --dtype auto'"
```

---

## 6\. ComfyUI Native ARM64 Setup & 3D Workflows

Because x86\_64 AppImages fail with `Exec format error` on Grace Blackwell (`aarch64`), ComfyUI is installed natively via Python virtual environment.

### Native Installation

```sh
cd /home/gadgetpilipinas
git clone https://github.com/comfyanonymous/ComfyUI.git /home/gadgetpilipinas/ComfyUI
cd /home/gadgetpilipinas/ComfyUI
python3 -m venv /home/gadgetpilipinas/ComfyUI/venv
source /home/gadgetpilipinas/ComfyUI/venv/bin/activate
pip install --upgrade pip
pip install torch torchvision torchaudio
pip install -r /home/gadgetpilipinas/ComfyUI/requirements.txt

# Install ComfyUI-Manager
git clone https://github.com/ltdrdata/ComfyUI-Manager.git /home/gadgetpilipinas/ComfyUI/custom_nodes/ComfyUI-Manager
```

### Link Central Models to ComfyUI

```sh
cat << 'EOF' > /home/gadgetpilipinas/ComfyUI/extra_model_paths.yaml
central_models:
    base_path: /home/gadgetpilipinas/models

    checkpoints: checkpoints
    diffusion_models: diffusion_models
    vae: vae
    clip_vision: clip_vision
    clip: clip
    background_removal: background_removal
    loras: loras
    geometry_estimation: geometry_estimation
EOF

ln -sfn /home/gadgetpilipinas/models/vae /home/gadgetpilipinas/ComfyUI/models/vae
ln -sfn /home/gadgetpilipinas/models/diffusion_models /home/gadgetpilipinas/ComfyUI/models/diffusion_models
ln -sfn /home/gadgetpilipinas/models/clip_vision /home/gadgetpilipinas/ComfyUI/models/clip_vision
ln -sfn /home/gadgetpilipinas/models/background_removal /home/gadgetpilipinas/ComfyUI/models/background_removal
ln -sfn /home/gadgetpilipinas/models/geometry_estimation /home/gadgetpilipinas/ComfyUI/models/geometry_estimation
```

### Pixal3D / TRELLIS.2 & Hunyuan3D 2.0 Model Downloads

```sh
# Pixal3D / TRELLIS.2
wget -c "https://huggingface.co/Comfy-Org/Pixal3D/resolve/main/vae/trellis_2_shape_vae_bf16.safetensors" -O /home/gadgetpilipinas/models/vae/trellis_2_shape_vae_bf16.safetensors
wget -c "https://huggingface.co/Comfy-Org/Pixal3D/resolve/main/vae/trellis_2_texture_vae_bf16.safetensors" -O /home/gadgetpilipinas/models/vae/trellis_2_texture_vae_bf16.safetensors
wget -c "https://huggingface.co/Comfy-Org/Pixal3D/resolve/main/diffusion_models/pixal3d_multiview_int8_convrot.safetensors" -O /home/gadgetpilipinas/models/diffusion_models/pixal3d_multiview_int8_convrot.safetensors
wget -c "https://huggingface.co/Comfy-Org/Pixal3D/resolve/main/diffusion_models/pixal3d_int8_convrot.safetensors" -O /home/gadgetpilipinas/models/diffusion_models/pixal3d_int8_convrot.safetensors
wget -c "https://huggingface.co/Comfy-Org/TRELLIS.2/resolve/main/diffusion_models/trellis_2_int8_convrot.safetensors" -O /home/gadgetpilipinas/models/diffusion_models/trellis_2_int8_convrot.safetensors
wget -c "https://huggingface.co/Comfy-Org/Pixal3D/resolve/main/clip_vision/dino_v3_L_naf_fp32.safetensors" -O /home/gadgetpilipinas/models/clip_vision/dino_v3_L_naf_fp32.safetensors
wget -c "https://huggingface.co/Comfy-Org/BiRefNet/resolve/main/background_removal/birefnet.safetensors" -O /home/gadgetpilipinas/models/background_removal/birefnet.safetensors
wget -c "https://huggingface.co/Comfy-Org/MoGe/resolve/main/geometry_estimation/moge_2_vitl_normal_fp16.safetensors" -O /home/gadgetpilipinas/models/geometry_estimation/moge_2_vitl_normal_fp16.safetensors

# Hunyuan3D 2.0
wget -c "https://huggingface.co/Comfy-Org/hunyuan3D_2.0_repackaged/resolve/main/split_files/hunyuan3d-dit-v2_fp16.safetensors" -O /home/gadgetpilipinas/models/diffusion_models/hunyuan3d-dit-v2_fp16.safetensors
ln -sf /home/gadgetpilipinas/models/diffusion_models/hunyuan3d-dit-v2_fp16.safetensors /home/gadgetpilipinas/models/checkpoints/hunyuan3d-dit-v2_fp16.safetensors
```

---

## 7\. Sudo-Free All-In-One Startup Script (`start-ai`)

```sh
mkdir -p /home/gadgetpilipinas/.local/bin
mkdir -p /home/gadgetpilipinas/Desktop

cat << 'EOF' > /home/gadgetpilipinas/start_ai_stack.sh
#!/usr/bin/env bash

echo "=========================================="
echo "   Starting DGX Spark AI Stack"
echo "=========================================="

# 1. Start Ollama (Port 11434)
echo "[+] Starting Ollama on 0.0.0.0:11434..."
tmux kill-session -t ollama 2>/dev/null
tmux new-session -d -s ollama "bash -c 'OLLAMA_HOST=0.0.0.0:11434 OLLAMA_MODELS=/home/gadgetpilipinas/models ollama serve'"

# 2. Start LM Studio Server (Port 1234)
echo "[+] Starting LM Studio Server on 0.0.0.0:1234..."
/home/gadgetpilipinas/.lmstudio/bin/lms server start --bind 0.0.0.0 --port 1234 --cors

# 3. Start ComfyUI (Port 8189)
echo "[+] Starting ComfyUI on 0.0.0.0:8189..."
tmux kill-session -t comfyui 2>/dev/null
tmux new-session -d -s comfyui "bash -c 'source /home/gadgetpilipinas/ComfyUI/venv/bin/activate && python /home/gadgetpilipinas/ComfyUI/main.py --listen 0.0.0.0 --port 8189'"

sleep 3

echo ""
echo "=========================================="
echo "   Active Port Status"
echo "=========================================="
ss -tulpn | grep -E '11434|1234|8189'

echo ""
echo "=========================================="
echo "   Ready! Endpoints for Windows PC:"
echo "=========================================="
echo "   • ComfyUI:   http://192.168.50.55:8189/"
echo "   • LM Studio: http://192.168.50.55:1234/v1"
echo "   • Ollama:    http://192.168.50.55:11434"
echo "=========================================="
EOF

chmod +x /home/gadgetpilipinas/start_ai_stack.sh
ln -sf /home/gadgetpilipinas/start_ai_stack.sh /home/gadgetpilipinas/.local/bin/start-ai
```

---

## 8\. Hermes Agent Multi-Instance Routing Configuration

On the Windows client PC, individual Hermes Agent instances can target specific models hosted on the DGX Spark (`192.168.50.55`):

```
agent_coder:
  base_url: "http://192.168.50.55:11434/v1"
  api_key: "ollama"
  model: "hf.co/JonathanColetti/Qwen3.8-27B-Uncensored-GGUF:Q4_K_M"

agent_multimodal_analyst:
  base_url: "http://192.168.50.55:11434/v1"
  api_key: "ollama"
  model: "gemma-4-31b-qat"

agent_reasoning:
  base_url: "http://192.168.50.55:11434/v1"
  api_key: "ollama"
  model: "nemotron-nano-reasoning"

agent_orchestrator:
  base_url: "http://192.168.50.55:8000/v1"
  api_key: "empty"
  model: "nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4"
```

