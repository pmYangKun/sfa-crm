"""Fernet 对称加密包装（spec 002 T008）.

用于 llm_config.api_key 字段的加密存储；密钥来自 env LLM_KEY_FERNET_KEY。

- 生产 env (ENV=production) 缺密钥 → SystemExit 拒绝启动
- dev env 缺密钥 → fallback 固定 dev key + warning（仅供本地开发，绝不能用于生产）
"""

import logging
import os
import sys

from cryptography.fernet import Fernet

logger = logging.getLogger(__name__)

# Fixed dev fallback — 仅在 ENV != production 且 LLM_KEY_FERNET_KEY 未设置时使用。
# 用此 key 加密的数据无法解密到生产环境，反之亦然。
_DEV_FALLBACK_KEY = b"vBBl3iKnAY-6iQXVZ6DOX6CgPFTo1VG8oBA5o-dXx8M="

_fernet_cache: Fernet | None = None


def get_fernet() -> Fernet:
    """返回当前进程使用的 Fernet 实例（带缓存）。

    生产环境若 LLM_KEY_FERNET_KEY 未设置或为空 → SystemExit。
    Dev 环境 fallback 到固定 dev key 并打 warning。
    """
    global _fernet_cache
    if _fernet_cache is not None:
        return _fernet_cache

    env = os.getenv("ENV", "dev").lower()
    raw_key = os.getenv("LLM_KEY_FERNET_KEY", "").strip()

    if raw_key:
        try:
            _fernet_cache = Fernet(raw_key.encode())
            return _fernet_cache
        except Exception as exc:
            print(
                f"❌ LLM_KEY_FERNET_KEY 格式无效（应为 base64 编码 32 字节）: {exc}",
                file=sys.stderr,
            )
            raise SystemExit(1) from exc

    # raw_key 缺失
    if env == "production":
        print(
            "❌ 生产环境 (ENV=production) 必须配置 LLM_KEY_FERNET_KEY。\n"
            "   生成命令: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\"",
            file=sys.stderr,
        )
        raise SystemExit(1)

    logger.warning(
        "LLM_KEY_FERNET_KEY 未设置，使用 dev fallback key（仅开发用，生产环境必须配置真实 key）"
    )
    _fernet_cache = Fernet(_DEV_FALLBACK_KEY)
    return _fernet_cache


def encrypt_api_key(plaintext: str) -> str:
    """加密明文 API Key 返回 base64 字符串（gAAAAA... 开头）。"""
    return get_fernet().encrypt(plaintext.encode()).decode()


def decrypt_api_key(ciphertext: str) -> str:
    """解密 ciphertext 返回明文 API Key。失败抛 cryptography.fernet.InvalidToken。"""
    return get_fernet().decrypt(ciphertext.encode()).decode()


def reset_fernet_cache() -> None:
    """测试用：重置缓存让下次 get_fernet() 重新读 env。"""
    global _fernet_cache
    _fernet_cache = None
