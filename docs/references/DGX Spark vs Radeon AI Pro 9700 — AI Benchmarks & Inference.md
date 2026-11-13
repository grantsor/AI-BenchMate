# DGX Spark vs. AMD Radeon AI Pro 9700 — AI Benchmarks & Inference Parity Guide

Complete benchmark methodology, command sets, parity matrices, and troubleshooting resolutions comparing the **AMD Radeon AI Pro 9700** (Windows 11 / Vulkan backend, 32 GB VRAM) and **NVIDIA DGX Spark** (Ubuntu Linux / CUDA backend, Grace Blackwell GB10 unified memory).

---

## 1\. Models & Hardware Testbeds

| Parameter | AMD Radeon AI Pro 9700 | NVIDIA DGX Spark |
| :---- | :---- | :---- |
| **OS & Architecture** | Windows (`x86_64`) | Ubuntu 24.04 (`aarch64` / ARM64) |
| **Compute Backend** | `llama.cpp` Vulkan (`--device Vulkan0`) | `llama.cpp` CUDA (`-DGGML_CUDA=ON -fa 1`) |
| **Model 1 (Dense)** | `Qwen3.8-27B-UD-Q4_K_M.gguf` (\~15.3–16 GB) | `/home/gadgetpilipinas/models/Qwen3.8-27B-UD-Q4_K_M.gguf` |
| **Model 2 (MoE)** | `Qwen3.6-35B-A3B-UD-Q4_K_M.gguf` (\~21 GB) | `/home/gadgetpilipinas/models/Qwen3.6-35B-A3B-UD-Q4_K_M.gguf` |
| **Results Directory** | `C:\Users\Grant Soriano\Desktop\GPU AI Benchmarks\Radeon AI Pro 9700` | `/home/gadgetpilipinas/benchmarks/dgx_spark` |

---

## 2\. Benchmark Parity Matrix

| Benchmark Suite / Configuration | Radeon AI Pro 9700 | DGX Spark | Purpose |
| :---- | :---: | :---: | :---- |
| **Native C++ `llama-bench` (Qwen 3.8)** | Completed | Completed | Raw compute (`pp`) & memory bandwidth (`tg`) |
| **Native C++ `llama-bench` (Qwen 3.6)** | Completed | Completed | MoE sparse routing raw throughput |
| **`llama-benchy` HTTP (Qwen 3.8)** | Completed | Completed | HTTP API overhead & `--depth 0 4096` KV drag |
| **`llama-benchy` HTTP (Qwen 3.6)** | Completed | Completed | HTTP API depth scaling on MoE |
| **`llmperf` Concurrency (Qwen 3.8)** | Completed | Configured | 4-stream parallel load, TTFT, ITL & QPS |
| **`llmperf` Concurrency (Qwen 3.6)** | Completed | Completed | 4-stream parallel load on MoE |
| **`SPEED-Bench` Multi-Category** | Completed | Completed (`16k` & `64k`) | Real-world qualitative tasks (`--category all --osl 1024 --limit 5`) |
| **`AA-AgentPerf-Local`** | Completed | Pending | Multi-turn agentic replay latency |
| **`AIPerf` Standard Concurrency** | Completed | Pending | 4 concurrent streams, 20 requests (`1024` in / `256` out) |
| **`AIPerf` Reviewer 64k Sweep** | Completed | Pending | Extreme long-context sweep (`16k, 32k, 64k`) with `cache_prompt:false` |

---

## 3\. AMD Radeon AI Pro 9700 (Windows / Vulkan) Commands

### A. Native C++ `llama-bench.exe`

```
$outDir = "C:\Users\Grant Soriano\Desktop\GPU AI Benchmarks\Radeon AI Pro 9700"
New-Item -ItemType Directory -Force -Path $outDir

# Qwen 3.8-27B (Dense)
& "C:\llama.cpp\vulkan\llama-bench.exe" `
  -m "C:\Users\Grant Soriano\.lmstudio\models\unsloth\Qwen3.8-27B-GGUF\Qwen3.8-27B-UD-Q4_K_M.gguf" `
  -ngl 99 -p 512,2048 -n 128,512 -r 3 -o md | Tee-Object -FilePath "$outDir\llama_bench_qwen38_vulkan.md"

# Qwen 3.6-35B-A3B (MoE)
& "C:\llama.cpp\vulkan\llama-bench.exe" `
  -m "C:\Users\Grant Soriano\.lmstudio\models\unsloth\Qwen3.6-35B-A3B-GGUF\Qwen3.6-35B-A3B-UD-Q4_K_M.gguf" `
  -ngl 99 -p 512,2048 -n 128,512 -r 3 -o md | Tee-Object -FilePath "$outDir\llama_bench_qwen36_vulkan.md"
```

### B. Standard Server Benchmarks (`llama-benchy`, `llmperf`, `SPEED-Bench`, `AgentPerf`)

1. **Launch `llama-server.exe` (Terminal 1):**

```
Set-Location "C:\llama.cpp\vulkan"
.\llama-server.exe `
  -m "C:\Users\Grant Soriano\.lmstudio\models\unsloth\Qwen3.8-27B-GGUF\Qwen3.8-27B-UD-Q4_K_M.gguf" `
  --device Vulkan0 --host 0.0.0.0 --port 8080 -ngl 99 -c 32768 -np 1
```

2. **Execute Client Benchmarks (Terminal 2):**

```
# llama-benchy (Depth 0 & 4096)
python -m llama_benchy `
  --base-url http://127.0.0.1:8080/v1 `
  --model "C:\Users\Grant Soriano\.lmstudio\models\unsloth\Qwen3.8-27B-GGUF\Qwen3.8-27B-UD-Q4_K_M.gguf" `
  --pp 512 2048 --tg 128 512 --depth 0 4096 --runs 3 --format md | Tee-Object -FilePath "$outDir\llama_benchy_qwen38_dgx_matched.md"

# llmperf (4-stream concurrency)
$env:OPENAI_API_BASE = "http://127.0.0.1:8080/v1"
$env:OPENAI_API_KEY = "dummy-key"
python token_benchmark_ray.py `
  --model "C:\Users\Grant Soriano\.lmstudio\models\unsloth\Qwen3.8-27B-GGUF\Qwen3.8-27B-UD-Q4_K_M.gguf" `
  --mean-input-tokens 1024 --stddev-input-tokens 128 `
  --mean-output-tokens 256 --stddev-output-tokens 32 `
  --num-concurrent-requests 4 --max-num-completed-requests 20 `
  --results-dir "$outDir\llmperf_qwen38_dgx_matched"

# SPEED-Bench (Qualitative multi-category)
python tools\server\bench\speed-bench\speed_bench.py `
  --url http://127.0.0.1:8080 --bench qualitative --category all `
  --osl 1024 --concurrency 1 --extra-inputs "{}" --limit 5 `
  --output "$HOME\benchmarks\speedbench_results_vulkan\speedbench_qwen38_vulkan.json"

# AA-AgentPerf-Local
agentperf-local run `
  --base-url http://127.0.0.1:8080/v1 `
  --model "C:\Users\Grant Soriano\.lmstudio\models\unsloth\Qwen3.8-27B-GGUF\Qwen3.8-27B-UD-Q4_K_M.gguf" `
  --output-dir "$HOME\benchmarks\agentperf_results_vulkan\qwen38"
```

### C. NVIDIA Reviewer's Guide 64k Long-Context Sweep (`AIPerf`)

* **Key Hardware Note:** At `65,536` ISL \+ chat template wrapper (`52` tokens) \+ `1,024` OSL (`66,612` total tokens), FP16 KV cache exceeds the R9700's 32 GB VRAM ceiling (`~31.3 GiB` just for weights \+ KV). Setting `-c 70000 -ctk q8_0 -ctv q8_0` (8-bit quantized KV cache) halves KV memory overhead and prevents out-of-memory and context-exceeded errors.  
* **Key CLI Note:** AIPerf requires `--ui simple` (or `--ui none`) when running `--sweep-type zip`.  
    
1. **Launch `llama-server.exe` with 70k Context & 8-bit KV Cache (Terminal 1):**

```
# Qwen 3.8-27B
.\llama-server.exe `
  -m "C:\Users\Grant Soriano\.lmstudio\models\unsloth\Qwen3.8-27B-GGUF\Qwen3.8-27B-UD-Q4_K_M.gguf" `
  --device Vulkan0 --host 0.0.0.0 --port 8080 -ngl 99 -c 70000 -ctk q8_0 -ctv q8_0 -np 1

# Qwen 3.6-35B-A3B
.\llama-server.exe `
  -m "C:\Users\Grant Soriano\.lmstudio\models\unsloth\Qwen3.6-35B-A3B-GGUF\Qwen3.6-35B-A3B-UD-Q4_K_M.gguf" `
  --device Vulkan0 --host 0.0.0.0 --port 8080 -ngl 99 -c 70000 -ctk q8_0 -ctv q8_0 -np 1
```

2. **Run `aiperf profile` 64k Zip Sweep (Terminal 2):**

```
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
Set-Location "$HOME\benchmarks"
.\.venv-aiperf\Scripts\Activate.ps1

$baseDir = "C:\Users\Grant Soriano\Desktop\GPU AI Benchmarks\Radeon AI Pro 9700"

# Qwen 3.8 Sweep
$qwen38Out = "$baseDir\aiperf_qwen38_nv64k"
New-Item -ItemType Directory -Force -Path $qwen38Out
aiperf profile `
  --model "Qwen3.8-27B" --tokenizer "Qwen/Qwen3.8-27B" --url "http://127.0.0.1:8080" `
  --endpoint-type chat --streaming --ui simple --sweep-type zip `
  --isl "16384,32768,65536" --osl "1024,1024,1024" --isl-stddev 0 --osl-stddev 0 `
  --extra-inputs "ignore_eos:true" --extra-inputs "cache_prompt:false" `
  --concurrency 1 --warmup-request-count 1 --request-count 3 `
  --random-seed 42 --use-server-token-count --artifact-dir $qwen38Out

# Qwen 3.6 Sweep
$qwen36Out = "$baseDir\aiperf_qwen36_nv64k"
New-Item -ItemType Directory -Force -Path $qwen36Out
aiperf profile `
  --model "Qwen3.6-35B-A3B" --tokenizer "Qwen/Qwen3.6-35B-A3B" --url "http://127.0.0.1:8080" `
  --endpoint-type chat --streaming --ui simple --sweep-type zip `
  --isl "16384,32768,65536" --osl "1024,1024,1024" --isl-stddev 0 --osl-stddev 0 `
  --extra-inputs "ignore_eos:true" --extra-inputs "cache_prompt:false" `
  --concurrency 1 --warmup-request-count 1 --request-count 3 `
  --random-seed 42 --use-server-token-count --artifact-dir $qwen36Out
```

---

## 4\. NVIDIA DGX Spark (Linux / CUDA) Commands

### A. Free VRAM & Terminate Background AI Services

```sh
pkill -u "$USER" -9 -f "llama-server" 2>/dev/null
pkill -u "$USER" -9 -f "ollama serve" 2>/dev/null
pkill -u "$USER" -9 -f "ComfyUI" 2>/dev/null
pkill -u "$USER" -9 -f "lm-studio" 2>/dev/null
tmux kill-session -t ollama 2>/dev/null
tmux kill-session -t comfyui 2>/dev/null
fuser -k -9 8080/tcp 11434/tcp 1234/tcp 8189/tcp 2>/dev/null
nvidia-smi
```

### B. Native C++ `llama-bench`

```sh
mkdir -p /home/gadgetpilipinas/benchmarks/dgx_spark

# Qwen 3.8-27B (Dense)
/home/gadgetpilipinas/llama.cpp/build/bin/llama-bench \
  -m /home/gadgetpilipinas/models/Qwen3.8-27B-UD-Q4_K_M.gguf \
  -ngl 99 -fa 1 -p 512,2048 -n 128,512 -r 3 -o md | tee /home/gadgetpilipinas/benchmarks/dgx_spark/llama_bench_qwen38.md

# Qwen 3.6-35B-A3B (MoE)
/home/gadgetpilipinas/llama.cpp/build/bin/llama-bench \
  -m /home/gadgetpilipinas/models/Qwen3.6-35B-A3B-UD-Q4_K_M.gguf \
  -ngl 99 -fa 1 -p 512,2048 -n 128,512 -r 3 -o md | tee /home/gadgetpilipinas/benchmarks/dgx_spark/llama_bench_qwen36.md
```

### C. `llama-benchy` HTTP Depth Sweep

1. **Terminal 1 (`llama-server`):**

```sh
/home/gadgetpilipinas/llama.cpp/build/bin/llama-server \
  -m /home/gadgetpilipinas/models/Qwen3.8-27B-UD-Q4_K_M.gguf \
  --host 0.0.0.0 --port 8080 -ngl 99 -fa 1 -c 32768 -np 1
```

2. **Terminal 2 (`llama-benchy`):**

```sh
source /home/gadgetpilipinas/.venv-aiperf/bin/activate
rm -rf ~/.cache/llama-benchy

python3 -u -m llama_benchy \
  --base-url http://127.0.0.1:8080/v1 \
  --model "Qwen3.8-27B" --tokenizer "Qwen/Qwen3.8-27B" \
  --pp 512 2048 --tg 128 512 --depth 0 4096 --runs 3 \
  --format md | tee /home/gadgetpilipinas/benchmarks/dgx_spark/llama_benchy_qwen38.md
```

### D. `llmperf` Setup & Python 3.12 Patch on Ubuntu 24.04

On Ubuntu 24.04 (`Python 3.12.3`), `llmperf` enforces an outdated `<3.11` cap in `pyproject.toml`, and `aiperf[tdigest]` requires `python3-dev` headers to compile `crick` on ARM64:

```sh
# Optional: Install C headers if compiling crick for aiperf[tdigest]
sudo apt update && sudo apt install -y python3-dev python3.12-dev build-essential

# Clone and patch llmperf for Python 3.12
mkdir -p /home/gadgetpilipinas/benchmarks
cd /home/gadgetpilipinas/benchmarks
git clone https://github.com/ray-project/llmperf.git
sed -i 's/<3.11,\s*//g; s/,\s*<3.11//g' /home/gadgetpilipinas/benchmarks/llmperf/pyproject.toml

# Install into virtual environment
python3 -m venv /home/gadgetpilipinas/.venv-aiperf
source /home/gadgetpilipinas/.venv-aiperf/bin/activate
pip install --upgrade pip
pip install -e /home/gadgetpilipinas/benchmarks/llmperf
```

**Run `llmperf` Concurrency Benchmark (Qwen 3.8):**

```sh
source /home/gadgetpilipinas/.venv-aiperf/bin/activate
mkdir -p /home/gadgetpilipinas/benchmarks/dgx_spark/llmperf_qwen38

export OPENAI_API_BASE="http://127.0.0.1:8080/v1"
export OPENAI_API_KEY="dummy"

python3 /home/gadgetpilipinas/benchmarks/llmperf/token_benchmark_ray.py \
  --model "Qwen3.8-27B" \
  --mean-input-tokens 1024 --stddev-input-tokens 128 \
  --mean-output-tokens 256 --stddev-output-tokens 32 \
  --num-concurrent-requests 4 --max-num-completed-requests 20 \
  --results-dir /home/gadgetpilipinas/benchmarks/dgx_spark/llmperf_qwen38
```

### E. `SPEED-Bench` Multi-Category & Comparison

```sh
cd /home/gadgetpilipinas/llama.cpp

# Run qualitative suite across all categories (OSL 1024, limit 5)
python3 tools/server/bench/speed-bench/speed_bench.py \
  --url http://127.0.0.1:8080 --bench qualitative --category all \
  --osl 1024 --concurrency 1 --extra-inputs '{}' --limit 5 \
  --output /home/gadgetpilipinas/speedbench_results/speedbench_qwen38_27b_dense_q4km.json

# Compare Dense (Qwen 3.8) vs. MoE (Qwen 3.6)
python3 tools/server/bench/speed-bench/speed_bench_compare.py \
  --baseline /home/gadgetpilipinas/speedbench_results/speedbench_qwen38_27b_dense_q4km.json \
  --speculative /home/gadgetpilipinas/speedbench_results/speedbench_qwen36_35b_a3b_q4km_ctx64k.json
```

