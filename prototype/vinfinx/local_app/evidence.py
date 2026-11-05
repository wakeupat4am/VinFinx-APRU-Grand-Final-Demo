"""Presentation provenance for the demo. Valuation and scoring use their original rules."""
from datetime import datetime, timezone
import time

VALUATION_REVIEW_DAYS = 90


def property_state(prop, now=None):
    if not prop or prop['status'] == 'rejected':
        return {'status': 'MISSING', 'computed_at': None, 'training_cutoff': None}
    result = prop['result']
    computed = result.get('inference', {}).get('computed_at')
    now = time.time() if now is None else now
    if prop.get('address_review_required'):
        state = 'STALE'
    else:
        state = 'MISSING' if not computed else (
            'STALE' if now - computed > VALUATION_REVIEW_DAYS * 86400 else 'MODEL_ESTIMATED')
    return {'status': state, 'computed_at': computed, 'training_cutoff': None,
            'review_after_days': VALUATION_REVIEW_DAYS, 'model_version': result.get('model_version'),
            'method': result.get('method')}


def describe(profile, prop, documents):
    fields = {key: 'MISSING' if profile.get(key) is None else 'USER_PROVIDED'
              for key in ('income', 'expenses', 'debt_payment', 'cash', 'debt')}
    if profile['verified']:
        fields['income'] = 'HUMAN_VERIFIED'
    doc_states = {}
    for doc in documents:
        if doc['status'] == 'pending':
            state = 'OCR_PENDING'
        elif doc['status'] == 'rejected':
            state = 'MISSING'
        else:
            state = 'HUMAN_VERIFIED'
        doc_states[doc['id']] = state
    return {'profile': fields, 'valuation': property_state(prop), 'documents': doc_states,
            'income_disagreement': any(doc.get('conflicts_with_verified', False) for doc in documents),
            'comparison': 'SIMULATED', 'loan': 'SIMULATED'}


def iso_time(value):
    return datetime.fromtimestamp(value, timezone.utc).isoformat(timespec='seconds') if value else 'Unavailable'
