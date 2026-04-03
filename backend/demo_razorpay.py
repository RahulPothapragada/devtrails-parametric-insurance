"""
Razorpay local sandbox test model.
Simulates the exact local testing model built into FlowSecure for Razorpay payouts.
"""

import asyncio
from unittest.mock import MagicMock
from app.models.models import Claim, Rider, PayoutChannel, ClaimStatus, PayoutStatus
from app.services.payout.payout_service import initiate_payout, confirm_payout, CHANNEL_SUCCESS_RATE

async def demo_razorpay_local():
    print("\n--- RAZORPAY SANDBOX LOCAL TESTING MODEL ---")
    print("In hackathon mode, we mock the Razorpay gateway to avoid internet/API limits during demo.")
    print(f"Realistic Success Rate Modeled: {CHANNEL_SUCCESS_RATE[PayoutChannel.RAZORPAY]*100}%\n")
    
    # Mocking the SQLite AsyncSession
    class MockDB:
        async def execute(self, stmt):
            m = MagicMock()
            
            # Setup a mock claim
            claim = Claim(id=1, rider_id=1, payout_amount=450.0, status=ClaimStatus.APPROVED, payout_status=PayoutStatus.NOT_INITIATED)
            rider = Rider(id=1, upi_id=None) # No UPI forces it to fall back to IMPS/Razorpay routing
            
            # Very hacky mock to satisfy the scalar_one_or_none calls in the payout service
            if "claims" in str(stmt):
                m.scalar_one_or_none.return_value = claim
            elif "riders" in str(stmt):
                m.scalar_one_or_none.return_value = rider
            return m
            
        async def flush(self): pass
        
    db = MockDB()
    
    print("[1] INITIATING RAZORPAY PAYOUT...")
    # Force the channel selection to Razorpay for demonstration
    with patch('app.services.payout.payout_service._select_channel', return_value=PayoutChannel.RAZORPAY):
        import app.services.payout.payout_service as ps
        init_res = await ps.initiate_payout(1, db)
    
    print(f"Status: {init_res['payout_status'].upper()}")
    print(f"Ref ID generated: {init_res['payout_ref']}")
    print(f"Expected processing time: {init_res['expected_time']}\n")
    
    print("[2] AWAITING RAZORPAY WEBHOOK (Simulated Confirmation)...")
    await asyncio.sleep(1) # simulate brief delay
    
    # Needs to mock the DB again because the previous call altered the claim object internally but our mock doesn't persist it perfectly
    class MockDBConfirm:
        def __init__(self, ref):
            self.ref = ref
        async def execute(self, stmt):
            m = MagicMock()
            claim = Claim(id=1, rider_id=1, payout_amount=450.0, status=ClaimStatus.APPROVED, 
                          payout_status=PayoutStatus.INITIATED, payout_channel=PayoutChannel.RAZORPAY, payout_ref=self.ref)
            m.scalar_one_or_none.return_value = claim
            return m
        async def flush(self): pass
        
    confirm_db = MockDBConfirm(init_res["payout_ref"])
    
    conf_res = await ps.confirm_payout(1, confirm_db)
    
    print(f"Webhook Received Status: {conf_res['success']}")
    if conf_res['success']:
        print(f"Final Claim Status: {conf_res['claim_status'].upper()}")
        print(f"Message: {conf_res['message']}")
        print(f"SMS Preview: {conf_res.get('sms_preview', '')}\n")
    else:
        print(f"Webhook Failed: {conf_res['failure_reason']}")

if __name__ == "__main__":
    from unittest.mock import patch
    asyncio.run(demo_razorpay_local())
