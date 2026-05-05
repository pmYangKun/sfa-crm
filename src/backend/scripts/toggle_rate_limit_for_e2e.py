"""临时调整 spec 002 限流为 e2e 套件压测做准备 / 还原默认。

用法：
  python scripts/toggle_rate_limit_for_e2e.py loosen   # 跑套件前
  python scripts/toggle_rate_limit_for_e2e.py restore  # 跑完后

注意：SlowAPI 内存计数器无法 SQL 清；后端需在 loosen/restore 之后重启才能让新 SystemConfig 值生效到运行期。
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from sqlmodel import Session, select  # noqa: E402

from app.core.database import engine  # noqa: E402
from app.models.config import SystemConfig  # noqa: E402

LOOSEN = {
    "llm_user_minute_limit": "9999",
    "llm_user_daily_limit": "99999",
    "llm_global_hourly_limit": "99999",
}
RESTORE = {
    "llm_user_minute_limit": "10",
    "llm_user_daily_limit": "100",
    "llm_global_hourly_limit": "200",
}


def apply(targets: dict[str, str]) -> int:
    with Session(engine) as s:
        for k, v in targets.items():
            row = s.exec(select(SystemConfig).where(SystemConfig.key == k)).one_or_none()
            if not row:
                print(f"[ERR] 缺少 SystemConfig key={k}")
                return 1
            row.value = v
            s.add(row)
            print(f"  {k} = {v}")
        s.commit()
    return 0


def main(argv: list[str]) -> int:
    if len(argv) != 2 or argv[1] not in ("loosen", "restore"):
        print(__doc__)
        return 2
    targets = LOOSEN if argv[1] == "loosen" else RESTORE
    print(f"[{argv[1]}] 写入 SystemConfig:")
    return apply(targets)


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
