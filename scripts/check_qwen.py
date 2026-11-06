"""Operator smoke check: actual private Qwen generation, synthetic metadata only."""
import json
import os
from pathlib import Path
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'prototype/vinfinx/local_app'))
os.environ.setdefault('VINFINX_QWEN_ORIGIN', 'http://127.0.0.1:4187')
import assistant
import finx


def main():
    started = time.monotonic()
    health = assistant.health()
    if not health['online']:
        print(json.dumps({'passed': False, 'stage': 'health', 'service': health}))
        return 1
    safe = {'intent': 'EXPLAIN', 'evidence_ids': ['health.score', 'health.surplus'],
            'action_id': 'OPEN_HEALTH', 'status': 'READY', 'clarification_key': None,
            'safety_flags': []}
    context = {'synthetic': True, 'role': 'customer', 'screen': 'health',
               'goal': 'health', 'step': 'health', 'intent_cues': ['health'],
               'income_status': 'USER_PROVIDED', 'valuation_status': 'MISSING',
               'ocr_pending': False}
    try:
        plan = finx.propose(safe, context)
        valid = finx.validate(plan, safe)
    except Exception as error:
        print(json.dumps({'passed': False, 'stage': 'generation',
                          'error_type': type(error).__name__}))
        return 1
    print(json.dumps({'passed': valid, 'stage': 'validated_generation',
                      'service': health, 'seconds': round(time.monotonic()-started, 3),
                      'synthetic_only': True}))
    return 0 if valid else 1


if __name__ == '__main__':
    sys.exit(main())
