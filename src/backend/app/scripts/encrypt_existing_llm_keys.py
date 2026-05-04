"""一次性迁移脚本：把 llm_config.api_key 中的明文 key 加密为 Fernet 密文（spec 002 T040）.

使用场景：spec 002 部署后首次启动，把 spec 001 时期遗留的明文 api_key 升级为密文。

Usage:
    cd src/backend
    set -a && source /opt/sfa-crm/.env.production && set +a
    python -m app.scripts.encrypt_existing_llm_keys

幂等：已是 Fernet 密文（gAAAAA 开头）的行不重复加密。
"""

import sys

from sqlmodel import Session, select

from app.core.database import engine
from app.core.security import encrypt_api_key
from app.models.llm_config import LLMConfig


def main() -> int:
    encrypted = 0
    skipped = 0

    with Session(engine) as session:
        configs = session.exec(select(LLMConfig)).all()
        if not configs:
            print("DB 中无 llm_config 行，无需迁移。")
            return 0

        for config in configs:
            if not config.api_key:
                print(f"  [skip] id={config.id} api_key 为空")
                skipped += 1
                continue
            if config.api_key.startswith("gAAAAA"):
                print(f"  [skip] id={config.id} 已是 Fernet 密文")
                skipped += 1
                continue
            # 老明文 → 加密
            plaintext = config.api_key
            config.api_key = encrypt_api_key(plaintext)
            session.add(config)
            encrypted += 1
            print(f"  [enc]  id={config.id} 已加密（明文长度 {len(plaintext)}）")

        session.commit()

    print(f"\n完成：加密 {encrypted} 行，跳过 {skipped} 行。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
