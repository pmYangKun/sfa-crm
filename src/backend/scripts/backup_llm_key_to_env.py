"""reset-demo.bat 删 .db 之前的钩子：把当前 DB 里 LLMConfig 的 key 回写到 .env。

设计目的：
- 用户从 admin UI 改 LLM key 后，跑 reset-demo.bat 不应该丢这个 key。
- 之前流程：reset 删 .db → init_db 读 .env → 如果 .env 没跟上 admin UI 的最新值，
  reset 后回到 .env 里的老 key，admin UI 改的全没了。
- 现在流程：reset 之前先把 DB 里活跃的 LLMConfig 解密 → 同步回 .env，
  这样 init 重新读到的就是最新值。

失败一律静默跳过（DB 不存在 / 没记录 / 解密失败 → 不影响 reset 主流程）。
.env 在 .gitignore 里，回写不会泄漏到公开仓库。
"""

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def main() -> int:
    env_file = ROOT / ".env"

    # 静默尝试：DB 不存在 / 模型加载失败 / 解密失败 都不报错
    try:
        from sqlmodel import Session, select
        from app.core.database import engine
        from app.models.llm_config import LLMConfig
    except Exception as e:
        print(f"[backup_llm_key] skip: import failed ({e})")
        return 0

    try:
        with Session(engine) as s:
            cfg = s.exec(
                select(LLMConfig).where(LLMConfig.is_active == True)  # noqa: E712
            ).first()
            if not cfg:
                print("[backup_llm_key] skip: 没有活跃 LLMConfig")
                return 0
            key = cfg.api_key_decrypted if hasattr(cfg, "api_key_decrypted") else cfg.api_key
            provider = cfg.provider or "deepseek"
            model = cfg.model or "deepseek-chat"
            if not key or len(key) < 10:
                print("[backup_llm_key] skip: LLMConfig.key 为空或太短")
                return 0
    except Exception as e:
        print(f"[backup_llm_key] skip: read DB 失败 ({e})")
        return 0

    # 读 .env 现状
    if env_file.exists():
        try:
            existing_lines = env_file.read_text(encoding="utf-8").splitlines()
        except Exception:
            existing_lines = []
    else:
        existing_lines = ["# LLM 配置（reset-demo.bat 自动维护，gitignored，不会进 GitHub）"]

    targets = {
        "LLM_PROVIDER": provider,
        "LLM_MODEL": model,
        "LLM_API_KEY": key,
    }

    # 替换/追加，保留注释和其他变量
    new_lines = []
    seen = set()
    for line in existing_lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            new_lines.append(line)
            continue
        k = line.split("=", 1)[0].strip()
        if k in targets:
            new_lines.append(f"{k}={targets[k]}")
            seen.add(k)
        else:
            new_lines.append(line)
    for k, v in targets.items():
        if k not in seen:
            new_lines.append(f"{k}={v}")

    try:
        env_file.write_text("\n".join(new_lines) + "\n", encoding="utf-8")
    except Exception as e:
        print(f"[backup_llm_key] WARN: 写入 .env 失败 ({e})")
        return 0

    masked = f"****{key[-4:]}" if len(key) >= 4 else "****"
    print(f"[backup_llm_key] OK provider={provider} model={model} key={masked} → .env")
    return 0


if __name__ == "__main__":
    sys.exit(main())
