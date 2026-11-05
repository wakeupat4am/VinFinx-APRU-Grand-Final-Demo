"""Real-model parity and safety boundaries for the optional research interval."""
import json
import math
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from detail_intervals import FIELDS, validate
from valuation import AVM, get_model

BASE={'district':'quận đống đa','ward':'phường quang trung','street':'đường thái hà','area':52.3}
VALUES={'floors':4,'frontage':4,'road':4,'bedrooms':3,'bathrooms':3}

class DetailIntervals(unittest.TestCase):
    @classmethod
    def setUpClass(cls):cls.model=get_model()

    def test_every_mask_keeps_actual_point_and_nested_relative_width(self):
        results={}
        for mask in range(32):
            raw={**BASE,**{k:VALUES[k] for i,k in enumerate(FIELDS) if mask&(1<<i)}}
            old=self.model.predict(raw)
            new=self.model.predict({**raw,'method':'detail_aware'})
            self.assertAlmostEqual(new['value'],old['value'],places=6)
            self.assertEqual(new['factors'],old['factors'])
            self.assertTrue(new['detail_interval']['applied'])
            self.assertEqual(new['detail_interval']['mask'],mask)
            self.assertEqual(new['inference']['artifact_sha256']['detail_intervals.json'],self.model.detail_hash)
            results[mask]=math.log(new['high']/new['low'])
        for mask,width in results.items():
            for child,child_width in results.items():
                if child&mask==mask:self.assertGreaterEqual(width+1e-10,child_width)

    def test_omitted_fields_not_treated_as_new_evidence(self):
        a=self.model.predict({**BASE,'method':'detail_aware'})
        b=self.model.predict({**BASE,'floors':'','road':None,'method':'detail_aware'})
        self.assertEqual(a['detail_interval']['mask'],b['detail_interval']['mask'])
        self.assertEqual(a['low'],b['low'])
        with self.assertRaises(ValueError):self.model.predict({**BASE,'floors':float('nan'),'method':'detail_aware'})

    def test_unsupported_values_cannot_earn_a_tighter_interval(self):
        for extra in [{'area':2000},{'road':0},{'is_corner_text':True},{'width':4},{'ward':'unseen','street':''}]:
            r=self.model.predict({**BASE,**VALUES,**extra,'method':'detail_aware'})
            self.assertFalse(r['detail_interval']['applied'])
            self.assertGreaterEqual(math.log(r['high']/r['low'])/2+1e-12,self.model.detail_policy['half_widths']['0'])

    def test_policy_integrity_is_required(self):
        manifest=json.loads(Path(os.environ['VINFINX_MODEL_MANIFEST']).read_text())
        manifest['detail_intervals.json']='0'*64
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'manifest.json';path.write_text(json.dumps(manifest))
            with patch.dict(os.environ,VINFINX_MODEL_MANIFEST=str(path)):
                with self.assertRaisesRegex(RuntimeError,'Detail policy integrity'):AVM()

    def test_declared_example_narrows_without_clipping_estimate(self):
        results=[self.model.predict({**BASE,**extra,'method':'detail_aware'}) for extra in ({},{k:VALUES[k] for k in ('floors','frontage','road')},VALUES)]
        for previous,current in zip(results,results[1:]):
            self.assertLess(current['high']-current['low'],previous['high']-previous['low'])
        for r in results:self.assertLess(r['low'],r['value']);self.assertLess(r['value'],r['high'])
        self.assertNotEqual(results[0]['value'],results[-1]['value'])

if __name__=='__main__':unittest.main()
