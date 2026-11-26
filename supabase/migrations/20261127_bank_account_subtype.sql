-- Keep the provider's own account subtype.
--
-- account_type only has five values ('checking','savings','credit','loan','other')
-- because that is all the cash maths needs: the first two are spendable, the rest
-- are not. But collapsing to it threw away the distinction that decides which
-- bucket a depository account belongs in.
--
-- A CD is locked until maturity and an HSA is restricted to medical spending.
-- Both arrive from Plaid as type 'depository', and the old mapping sent every
-- depository subtype except 'savings' to 'checking' — so both were counted as
-- available operating cash. On the sandbox item that overstated cash by $7,009
-- out of $62,569.
--
-- Storing the subtype means the classification is auditable after the fact and the
-- card can say *why* a balance is excluded instead of silently dropping it.

alter table bank_accounts
  add column if not exists account_subtype text;

comment on column bank_accounts.account_subtype is
  'The provider''s own subtype (cd, hsa, money market, ...). account_type is the coarse bucket the cash maths uses; this is what it was derived from.';
