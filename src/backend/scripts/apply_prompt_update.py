"""一次性脚本：把 init_db.py 里最新的 agent_system_prompt 写到运行库。

init_db 二轮 seed 只插缺失 key，不覆盖；所以代码里 prompt 改了，现网/dev 不会自动同步。
执行后立刻生效（chat route.ts 每次调用都从 /agent/llm-config/full 拉最新 prompt）。
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from sqlmodel import Session, select  # noqa: E402

from app.core.database import engine  # noqa: E402
from app.core.init_db import DEFAULT_CONFIGS  # noqa: E402
from app.models.config import SystemConfig  # noqa: E402


def main() -> int:
    target_key = "agent_system_prompt"
    new_value = next((v for k, v, _ in DEFAULT_CONFIGS if k == target_key), None)
    if not new_value:
        print(f"[ERR] DEFAULT_CONFIGS 里找不到 {target_key}")
        return 1

    with Session(engine) as s:
        row = s.exec(select(SystemConfig).where(SystemConfig.key == target_key)).one_or_none()
        if not row:
            print(f"[ERR] DB 里没有 {target_key}，请先跑 init_db")
            return 1
        if row.value == new_value:
            print(f"[OK] {target_key} 已是最新版本，无需更新")
            return 0
        old_len = len(row.value)
        row.value = new_value
        s.add(row)
        s.commit()
        print(f"[OK] {target_key} 已更新：{old_len} chars -> {len(new_value)} chars")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
