# Optional Qwen serving — operator only

The recording app does not require a GPU. Evidence mode is the default safe fallback.
For actual Qwen generation, provision the approved Qwen3.5-9B weights separately
and check their revision/hash against your operator manifest. Do not copy credentials,
customer records or weights into Git. The private AVM release does not include Qwen.

The included adapter uses bf16, greedy generation, seed 7, `device_map="auto"` and
xgrammar JSON-schema constraints. An existing project serving environment recorded:
torch 2.14.1, transformers 5.19.0, accelerate 1.15.0, xgrammar 0.2.8,
fastapi 0.143.2, uvicorn 0.54.0, pydantic 2.14.1. These are historical operator
versions, not a claim that a fresh GPU stack was validated for this release.
Choose a PyTorch/CUDA build compatible with the operator's driver; use a separate
environment, not the app `.venv`.

Before loading, inspect `nvidia-smi --query-gpu=index,memory.used,memory.free --format=csv,noheader,nounits`.
Select an authorized GPU with less than 1 GB in use and roughly 19–21 GiB available.
Refuse to start when no suitable GPU is free. Never reuse a fixed index from an old run.

In an operator-managed tmux session on the GPU host (replace both placeholders):

```bash
export CUDA_VISIBLE_DEVICES=YOUR_CURRENTLY_FREE_GPU
export VINFINX_QWEN_PATH=/operator/provisioned/Qwen3.5-9B
export VINFINX_ALLOWED_ORIGINS=http://127.0.0.1:4176,http://localhost:4176
export VINFINX_XGRAMMAR_MASK_CPU=1
cd prototype/vinfinx
python -m uvicorn qwen_api:app --host 127.0.0.1 --port 8061
```

CPU schema masking is the project's workaround when Triton cannot compile a mask
kernel. It does not change financial formulas. Keep logs and model revision, GPU
index, dependency versions and precision in the operator's private run record.

Check `http://127.0.0.1:8061/vinfinx-api/health` from the host, then connect through
the SSH tunnel described in README. The endpoint must remain loopback-only.
The app permits only loopback Qwen URLs, disables redirect/proxy handling and
validates model-returned evidence IDs/actions. Trusted application code supplies
financial numbers and final labels. Do not label Evidence mode as live Qwen.

The separate macro pipeline API/corpus (8062) is not included or started here.
