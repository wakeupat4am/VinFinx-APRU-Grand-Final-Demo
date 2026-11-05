'use strict';
// Fixed-payment illustration, using the assumptions supplied by the existing score engine.
function repaymentScenario(principal, annualRate, term, income, existingPayment) {
  if (![principal, annualRate, term, income, existingPayment].every(Number.isFinite)
      || principal < 0 || annualRate < 0 || term < 1 || !Number.isInteger(term)) {
    throw new RangeError('Enter valid loan scenario assumptions.');
  }
  const rate=annualRate/12;
  const payment=rate?principal*rate/-Math.expm1(-term*Math.log1p(rate)):principal/term;
  let balance=principal;
  const schedule=[];
  for(let month=1;month<=term;month++){
    const interest=balance*rate;
    const paid=month===term?balance+interest:payment;
    const capital=Math.max(0,Math.min(balance,paid-interest));
    balance=Math.max(0,balance-capital);
    schedule.push({month,payment:paid,interest,capital,balance});
  }
  return {payment,schedule,burden:income>0?(payment+existingPayment)/income:null};
}
if(typeof module!=='undefined')module.exports=repaymentScenario;
