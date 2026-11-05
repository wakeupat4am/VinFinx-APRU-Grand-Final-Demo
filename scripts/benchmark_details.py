"""Private-data operator experiment. Outputs stay outside Git; no weight refit."""
import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'prototype/vinfinx/local_app'))
os.environ.setdefault('VINFINX_MODEL_DIR',str(ROOT/'.runtime/model'))
os.environ.setdefault('VINFINX_MODEL_MANIFEST',str(ROOT/'.runtime/model/manifest.json'))
os.environ.setdefault('VINFINX_HYBRID_PATH',str(ROOT/'.runtime/model/hierarchy.json'))
from valuation import AVM, features, GEO, NUM, norm

FIELDS=['floors','frontage','road','bedrooms','bathrooms']
MASKS=list(range(32))
STAGES=[('basic',0),('floors',1),('frontage',3),('access',7),('complete',31)]

def digest(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def masked(frame,mask):
    import numpy as np
    f=frame.copy()
    for i,name in enumerate(FIELDS):
        if not mask&(1<<i):
            f[name if name=='floors' else 'log_'+name]=np.nan
            if name in ('floors','frontage','road'):f[name+'_missing']=1.
    return f

def main():
    import numpy as np
    import pandas as pd
    p=argparse.ArgumentParser();p.add_argument('--features',type=Path,required=True)
    p.add_argument('--split-dir',type=Path,required=True);p.add_argument('--output',type=Path,required=True)
    args=p.parse_args();args.output.mkdir(parents=True,exist_ok=True)
    model=AVM();raw=pd.read_parquet(args.features)
    market=json.loads((ROOT/'prototype/vinfinx/local_app/assets/market.json').read_text())
    catalog={norm(d['label']):d for d in market['districts']}
    columns={'area':'area_m2','floors':'num_floors','frontage':'frontage_m','road':'road_width_m','bedrooms':'bedrooms','bathrooms':'bathrooms'}
    selected=raw[raw.addr_last_1.fillna('').map(norm).eq('hanoi') & raw.property_subtype.isin(['normal_house','frontage_house','alley_frontage_house','villa'])].copy()
    selected=selected.dropna(subset=list(columns.values())+['addr_last_2','addr_last_3','street_proxy'])
    records=[];ids=[]
    for row in selected.to_dict('records'):
        d=catalog.get(norm(row['addr_last_2']))
        if not d:continue
        ward=str(row['addr_last_3']).strip().lower()
        street=str(row['street_proxy']).strip().lower()
        if norm(ward) in ('missing','unknown',''):ward='';street=''
        if norm(street) in ('missing','unknown',''):street=''
        r={key:float(row[col]) for key,col in columns.items()}
        r.update(district=d['label'],ward=ward,street=street,subtype=row['property_subtype'])
        try:f=features(r)
        except ValueError:continue
        # Never calibrate a seen-geography policy using OHE-unknown complete inputs.
        if any(f.iloc[0][key] not in cats for key,cats in zip(GEO,model.transform.named_transformers_['geo'].categories_) if key not in ('ward','street') or r.get(key)):continue
        records.append(r);ids.append(row['id'])
    table=pd.DataFrame(records,index=ids);assert table.index.is_unique
    sets={};split_hashes={};groups={}
    for split in ('calibration','test'):
        path=args.split_dir/f'{split}_predictions.parquet';split_hashes[split]=digest(path)
        meta=pd.read_parquet(path).set_index('id');groups[split]=set(meta['group'])
        matched=table.loc[table.index.intersection(meta.index)].sort_index()
        frame=pd.concat([features(r) for r in matched.to_dict('records')],ignore_index=True)
        target=meta.loc[matched.index,'price'].to_numpy()
        actual=raw.set_index('id').loc[matched.index,'price_vnd'].to_numpy()/1e9
        assert np.allclose(target,actual,rtol=1e-10)
        sets[split]=(matched,frame,target)
    assert not groups['calibration']&groups['test']
    assert not set(sets['calibration'][0].index)&set(sets['test'][0].index)
    n=len(sets['calibration'][0]);assert n>=100, f'Only {n} calibration rows; insufficient support'
    q={};cal_predictions={}
    for mask in MASKS:
        pred=model.model.predict(model.transform.transform(masked(sets['calibration'][1],mask)[GEO+NUM]),num_threads=2)
        errors=np.abs(np.log(sets['calibration'][2])-pred)
        q[mask]=float(np.sort(errors)[min(n,math.ceil((n+1)*.9))-1]);cal_predictions[mask]=pred
    widths={m:max(q[s] for s in MASKS if s&m==m) for m in MASKS}
    bounds={key:[float(sets['calibration'][0][key].min()),float(sets['calibration'][0][key].max())] for key in columns}
    policy={'version':'detail-interval/1.0','status':'research','nominal_coverage':.9,'fields':FIELDS,
      'model_sha256':model.hash,'transform_sha256':model.artifact_hashes['transform.joblib'],
      'cohort':'Phase 1 historical Hanoi complete-record group holdout; asking prices',
      'calibration_n':n,'input_bounds':bounds,'half_widths':{str(m):widths[m] for m in MASKS},
      'empirical_half_widths':{str(m):q[m] for m in MASKS},
      'provenance':{'features_sha256':digest(args.features),'splits_sha256':split_hashes,
        'calibration_ids_sha256':hashlib.sha256('\n'.join(map(str,sets['calibration'][0].index)).encode()).hexdigest(),
        'script_sha256':digest(__file__)},'monotonic_rule':'max calibrated half-width over supersets; only widens less-detailed masks'}
    # Freeze before evaluating any held-out labels.
    path=args.output/'detail_intervals.json';path.write_text(json.dumps(policy,indent=2)+'\n')
    test=sets['test'];rows=[]
    for mask in MASKS:
        pred=model.model.predict(model.transform.transform(masked(test[1],mask)[GEO+NUM]),num_threads=2)
        errors=np.abs(np.log(test[2])-pred);point=np.exp(pred)
        eligible=np.ones(len(test[0]),dtype=bool)
        for key,(lo,hi) in bounds.items():
            if key=='area' or mask&(1<<FIELDS.index(key)):
                eligible &= test[0][key].between(lo,hi).to_numpy()
        applied_width=np.where(eligible,widths[mask],max(model.q,widths[0]))
        rows.append({'mask':mask,'n':len(point),'medape_pct':float(100*np.median(np.abs(point/test[2]-1))),
            'coverage_pct':float(100*np.mean(errors<=applied_width)), 'research_applied_n':int(eligible.sum()), 'log_half_width':widths[mask],
            'relative_width_pct':float(200*np.sinh(widths[mask])),
            'median_width_billion':float(np.median(2*point*np.sinh(applied_width)))})
    report={'protocol':'docs/DETAIL_INTERVAL_PROTOCOL.md','policy_sha256':digest(path),'calibration_n':n,'test_n':len(test[0]),
      'stages':[{**next(r for r in rows if r['mask']==mask),'stage':label} for label,mask in STAGES],
      'all_masks_min_coverage_pct':min(r['coverage_pct'] for r in rows),'mask_count':len(rows),
      'all_masks':rows,'input_bounds':bounds}
    report['release_gate_passed']=all(r['coverage_pct']>=85 for r in report['stages']) and report['stages'][-1]['medape_pct']<report['stages'][0]['medape_pct']
    (args.output/'detail_benchmark.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k!='all_masks'},indent=2))

if __name__=='__main__':main()
