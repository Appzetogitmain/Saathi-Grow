Refer & Earn deployment and validation
====================================

Rewards and both wallet ledger entries commit in one MongoDB transaction. The
database must be a replica set (including Atlas) or a sharded cluster. Standalone
MongoDB cannot issue these rewards; orders and login continue, and pending
rewards remain available for retry after database configuration is corrected.

Before deploying against an existing database, run from Backend:

    npm run migrate:referrals

This checks transaction support, creates the unique referral/ledger indexes,
and queues existing User.referredBy attribution for recovery. It does not delete
indexes or alter existing wallet balances. Starting the backend runs a bounded
retry worker every minute. Multiple server instances can safely retry the same
referral; the transaction and referrer write conflict prevent duplicate payouts
and cap overruns.

Rules:
- Only a new OTP signup can apply a referral, by invite URL or manual code.
- Invalid codes do not consume the signup OTP. Existing accounts cannot replace
  their original attribution by entering another code.
- Registration mode rewards the verified new account without requiring an order.
- Delivery mode uses the earliest delivered order, including an order later
  returned, and checks the paid final total including taxes/fees after discounts.
  A below-minimum first delivery is permanently ineligible for this referral.
  New delivery events retain deliveryTimestamps.deliveredAt. Legacy deliveries
  without timestamps are ordered by creation date as a conservative fallback.
- A zero cap means unlimited; zero rewards are valid. Disabling the program
  hides customer invite offers/controls and pauses pending payouts; historical
  rewards remain visible on the referral dashboard.
- Changing admin rules applies the current rules to still-pending referrals;
  completed/cancelled referrals are never paid again. Previously paid rewards
  are not automatically reversed after a later return.

Automated checks:

    cd Backend
    npm test
    npm run check:syntax
    cd ../Frontend
    node --test test/*.test.mjs
    npm run build

Referral tests exercise production services with isolated transaction snapshots
and write-conflict retries, and render production JSX for customer states. They
do not connect to a live database, send notifications, or run real payment flows.
For deployment acceptance, use a staging replica set to verify signup, delivery,
wallet history, cap enforcement, and a retried delivery request with test users.
