"""Explicit research option: calibrated structural missingness, never a confidence score."""
import math

FIELDS=('floors','frontage','road','bedrooms','bathrooms')

def validate(policy,model_hash,transform_hash):
    if policy.get('version')!='detail-interval/1.0' or policy.get('fields')!=list(FIELDS):
        raise ValueError('Unsupported detail interval policy')
    if policy.get('model_sha256')!=model_hash or policy.get('transform_sha256')!=transform_hash:
        raise ValueError('Detail policy does not match the frozen model')
    widths=policy['half_widths']
    if set(widths)!={str(i) for i in range(32)} or policy['calibration_n']<100:
        raise ValueError('Insufficient detail calibration support')
    for i in range(32):
        q=widths[str(i)]
        if not isinstance(q,(int,float)) or not math.isfinite(q) or q<=0:raise ValueError('Invalid interval width')
        if any(q+1e-12<widths[str(j)] for j in range(32) if i&j==i):
            raise ValueError('Detail interval envelope is inconsistent')

def apply(policy,raw,geography,base_q):
    present=lambda k:raw.get(k) not in ('',None)
    mask=sum(1<<i for i,k in enumerate(FIELDS) if present(k))
    reason=None
    if not policy:reason='The research interval policy is unavailable.'
    elif any(status=='unseen' for status in geography.values()):reason='This location is outside the training-seen geography.'
    elif any(present(k) for k in ('width','length')) or any(v for k,v in raw.items() if k.startswith('is_') or k=='has_legal_text'):
        reason='Extra property features are outside this interval experiment.'
    else:
        for key,(lo,hi) in policy['input_bounds'].items():
            if present(key) and not lo<=float(raw[key])<=hi:
                reason='A supplied value is outside the calibration sample range.';break
    if reason:
        # Do not use added/out-of-scope fields as a reason to shrink the interval.
        q=max(base_q,policy['half_widths']['0'] if policy else base_q)
        return q,{'applied':False,'status':'BASELINE_OR_WIDER_FALLBACK','reason':reason,
          'fields_present':[k for k in FIELDS if present(k)],'mask':mask,
          'note':'No detail-based narrowing or accuracy improvement is claimed for this input.'}
    q=policy['half_widths'][str(mask)]
    return q,{'applied':True,'status':'RESEARCH_MASK_CALIBRATION','version':policy['version'],
      'mask':mask,'fields_present':[k for k in FIELDS if present(k)],
      'fields_missing':[k for k in FIELDS if not present(k)],'calibration_n':policy['calibration_n'],
      'cohort':policy['cohort'],'log_half_width':q,'relative_width_pct':200*math.sinh(q),
      'note':'Valid structural details can reduce relative uncertainty. Absolute width and accuracy may not improve for each property. This is not street-specific or sale-price validation.'}
