# Archon Construction — Tax Readiness Audit

**Audit date:** 2026-08-07
**Entity per dashboard:** Archon Construction, 656 Grant Terrace, Teaneck, NJ 07666
**Period covered by data:** 2026-01-16 → 2026-08-07 (partial year)
**Source:** live Supabase database `wrzurnpzttnzeiegsbzi`, queried directly. All totals below were recalculated from transaction-level rows, not read off the dashboard.

---

## A. Overall Readiness Score — 38 / 100

Solid as a job-costing and invoicing tool. Not yet a financial package. It produces a credible P&L for *operations*, but the balance sheet does not tie to the P&L, there is no cash tracking of any kind, payroll taxes are entirely absent, and the largest single cost on the P&L ($49,607 of labor) is an estimate that disagrees with actual payroll by $24,733.

This is also a **mid-year** dataset. It is not a year-end package and should not be presented as one.

---

## B. Critical Problems

### B1. Labor cost is imputed, not actual — $24,733 discrepancy

The P&L computes labor as `labor_entries.hours × employees.hourly_rate` ([reports/page.tsx:111](app/dashboard/reports/page.tsx:111)). It never reads the `payroll` table.

| Measure | Amount |
|---|---|
| Imputed labor (timesheets × rate) | $49,607.00 |
| Actual gross payroll recorded | $24,874.00 |
| **Unexplained difference** | **$24,733.00** |

Net income is misstated by up to $24,733 — 72% of reported net profit. One of the two is wrong: either timesheets/rates are inflated, or roughly half of payroll was never recorded. This must be resolved before anything else.

### B2. Payroll taxes are zero on all 31 records

Every payroll row has `taxes = 0`, `benefits = 0`, and `total_employer_cost = gross_pay`. All 10 workers are typed `full-time`.

$24,874 of gross wages with zero withholding and zero employer tax is not a coherent W-2 payroll. Either withholding is happening outside the system and isn't captured, or these workers are being treated as contractors while labeled employees. Employer FICA alone would be roughly $1,900. **Worker classification and payroll tax compliance must go to your CPA/payroll provider — I am not making a classification determination.**

### B3. Balance sheet does not tie to the P&L

[reports/page.tsx:202](app/dashboard/reports/page.tsx:202) computes:

```
totalAssets = totalCollected + accountsReceivable   → $96,950 + $24,000 = $120,950
equity      = totalAssets - totalLiabilities        → $120,950
```

Two defects:

1. **"Cash / Revenue Collected" is not cash.** It is cumulative collections with no deduction for anything spent. Real cash would be collections less disbursements. Cash is overstated by roughly the $86,635 of expenses paid.
2. **Retained earnings ($120,950) ≠ net income ($34,314.60).** Total assets exactly equal total revenue, which is arithmetically inevitable given the formula and proves the statement is not derived from real balances.

There is no bank account, credit card, loan, equity, or owner-draw data anywhere in the schema.

### B4. Invoice payments do not reconcile — $31,400 gap

| Source | Amount |
|---|---|
| `invoices.amount_paid` (drives the P&L) | $96,950.00 |
| `payments` table (transaction detail) | $65,550.00 |
| **Difference** | **$31,400.00** |

Fully explained:

- Seven invoices are marked paid with **no payment record at all** — INV-003, 004, 005, 006, 007, 009, 010 = **$33,200**
- One payment is **recorded twice** — INV-015, $1,800 duplicated = **−$1,800**

$33,200 − $1,800 = $31,400. Exact. The `payments` table cannot support the revenue figure, so there is no audit trail from revenue back to cash received.

### B5. Vehicle costs appear to double-dip

Schedule C Line 9 receives **both**:

- $1,770.85 of actual vehicle expenses (including "Mechanic — Timing belt repair" $500.00)
- $1,206.40 of standard mileage (1,856 miles × $0.65), added at [reports/page.tsx:158](app/dashboard/reports/page.tsx:158)

Total claimed: **$2,977.25**. The standard mileage rate and actual vehicle expenses generally cannot both be claimed for the same vehicle in the same year. Roughly **$1,206–$1,771 of the deduction is likely unsupportable**. CPA must pick a method. Also confirm the $0.65 rate is correct for 2026 — it is hardcoded as a fallback.

---

## C. Missing Information

**Business identity** — no entity type, no EIN field, no tax year, no accounting method (cash vs. accrual), no state registration, no license number (field is blank). `company_settings` holds name/address/phone only.

**Entirely absent from the system:**

| Missing | Consequence |
|---|---|
| Bank accounts & balances | No cash figure, no reconciliation possible |
| Credit cards | Unknown liability; double-count risk on card payments |
| Loans / lines of credit | Liabilities understated; no principal/interest split |
| Owner contributions & draws | Equity cannot be computed; distributions untracked |
| Beginning-of-year balances | No opening equity or retained earnings |
| Payroll tax liabilities | Understates liabilities and expense |
| Sales tax | All 22 invoices have `tax = 0` or null |
| Estimated tax payments | Not tracked |
| Prior-year return | Not referenced |

**Empty tables:** `fixed_assets` (0), `documents` (0), `change_orders` (0), `payment_history` (0), `companies` (0).

**Substantiation:** **all 75 expenses have no receipt attached** (`receipt_url` null on every row), despite a receipts bucket existing. IRS substantiation generally requires receipts at $75 and above; 12 expenses exceed that.

---

## D. Calculation Errors

Recalculated independently from transaction rows:

| Line | Dashboard | Recalculated | Diff | Note |
|---|---|---|---|---|
| Total Revenue | $120,950.00 | $120,950.00 | $0.00 | Ties |
| Total Collected | $96,950.00 | $96,950.00 | $0.00 | Ties to invoices, **not** to payments (B4) |
| Accounts Receivable | $24,000.00 | $24,000.00 | $0.00 | Ties |
| Direct Costs | $3,094.56 | $3,094.56 | $0.00 | Ties |
| Labor | $49,607.00 | $24,874.00 actual | **$24,733.00** | B1 |
| Mileage | $1,206.40 | $1,206.40 | $0.00 | Ties; deductibility questioned (B5) |
| Vendor Bills Paid | $26,456.00 | $26,456.00 | $0.00 | Ties |
| Overhead | $6,271.44 | $6,271.44 | $0.00 | Ties |
| Total COGS | $80,363.96 | $80,363.96 | $0.00 | Ties |
| Gross Profit | $40,586.04 | $40,586.04 | $0.00 | Ties |
| **Net Income** | **$34,314.60** | **$34,314.60** | **$0.00** | Internally consistent, but built on B1 |
| Profit Margin | 28.37% | 28.37% | $0.00 | Ties |
| Total Expenses | $86,635.40 | $86,635.40 | $0.00 | Ties |
| Total Assets | $120,950.00 | Not determinable | — | B3 — no cash data exists |

**The dashboard's arithmetic is sound.** Every subtotal foots, and the Schedule C breakdown sums to $86,635.40, matching total expenses exactly. The failures are in *what is being measured*, not in the addition.

Two definitional errors:

1. **Meals not halved.** $204.69 is tagged "Meals — 50% deductible (Line 24b)" but enters the tax breakdown at 100% ([reports/page.tsx:149](app/dashboard/reports/page.tsx:149)). Either it should be $102.35, or — since it is an employee appreciation BBQ, which may qualify as a 100%-deductible employee event — the tag is wrong. CPA to determine; the code and the tag currently contradict each other.

2. **Tax estimate formula is wrong.** `taxableIncome = netProfit − accountsPayable` ([reports/page.tsx:225](app/dashboard/reports/page.tsx:225)). Vendor bills are already expensed at `amount_paid`, so unpaid AP was never deducted; subtracting it again would double-deduct. AP is $0 today so the error is currently dormant, but it will misstate the moment a bill goes unpaid. The flat 30% also ignores self-employment tax, entity type, QBI, and NJ state tax.

---

## E. Accounting & Categorization Issues

- **59 of 75 expenses (79%) sit in a category literally named "General"** — $6,024.16 across both groups. Useless for tax prep. The Schedule C tags are good, but the working category field is not.
- **48 of 75 expenses have no project assigned**, undermining job costing.
- **"Hammer Drill" $372.33** tagged Supplies & Materials — a tool with a useful life beyond one year. Likely fine under de minimis safe harbor, but flag it.
- **`fixed_assets` is empty**, so there is no depreciation schedule and no Section 179 / bonus depreciation position.
- **Insurance $2,969.32** includes prepaid periods ("Policy for 3 months", "First & last down payment"). Under accrual, part is a prepaid asset. Accounting method is undeclared, so this cannot be resolved.
- **Only 2 tax categories on all vendor bills** — Contract Labor $15,956 and Legal & Professional $10,500. No materials, no equipment rental. Unusual for construction; verify nothing is miscoded.

---

## F. Reconciliation Issues

| Reconciliation | Status |
|---|---|
| Revenue → invoices | ✅ Ties exactly |
| Invoices → payments | ❌ **$31,400 gap** (B4) |
| Labor → payroll | ❌ **$24,733 gap** (B1) |
| Expenses → Schedule C tags | ✅ $9,366.00 both ways, all rows tagged |
| Expense groups → total | ✅ $3,094.56 + $6,271.44 = $9,366.00 |
| Vendor bills → AP | ✅ $26,456 billed, $26,456 paid, AP $0 |
| Bank / credit card | ❌ **Impossible — no account data exists** |
| Balance sheet → P&L | ❌ **Does not tie** (B3) |

---

## G. Potential Duplicates

| Date | Source | Description | Amount | Assessment |
|---|---|---|---|---|
| 2026-06-26 | `payments` | INV-015, check | $1,800.00 | **Confirmed duplicate.** Two rows created 0.46 seconds apart — a double form submit. Invoice `amount_paid` is correctly $1,800, so the P&L is unaffected; the payments table is wrong. |
| 2026-07-24 | `expenses` | Homedepot "Hammer Drill" | $372.33 | **Almost certainly duplicate.** Identical vendor, date, amount, and description. If so, expenses are overstated $372.33. |
| 2026-06-19 | `vendor_bills` | Hugo | $1,000.00 | **Probable duplicate.** Same vendor, date, amount. Both marked paid — if erroneous, COGS overstated $1,000. |

Combined potential overstatement of costs: **$1,372.33**.

---

## H. Potential Missing Transactions

- **Invoice numbers 001, 002, and 013 do not exist.** 22 invoices run INV-003 → INV-025 with 013 skipped. Missing invoices mean potentially unrecorded revenue. Confirm whether these were voided, deleted, or never issued.
- **Seven paid invoices have no payment record** ($33,200) — see B4.
- **No transactions before 2026-01-16**, and only $18.98–$19.00/month in Jan–Mar with zero revenue. If the business operated in 2025, prior-year data is absent entirely.
- **Juan Mejia and Jose Castro appear as active employees with no payroll records.**
- **Zero receipts** across 75 expenses.

---

## I. CPA Review Items

### CRITICAL

1. **Reconcile the $24,733 labor gap.** Which is right — $49,607 of timesheets or $24,874 of payroll?
2. **Payroll tax compliance.** $24,874 in wages, $0 withheld, $0 employer tax, 10 workers typed full-time. Have 941s been filed? Are these W-2 or 1099 workers?
3. **Vehicle deduction method.** Standard mileage *or* actual expenses — currently both are claimed ($2,977.25 total).
4. **Related-party transactions.** "JM Design Studio LLC" received $10,500 (Legal & Professional) and shares your email domain (jm-ds.com). "Mejia Contractor" received $13,000 and shares the owner's surname. Two employees are also named Mejia. These require arm's-length documentation and may be reportable differently.

### HIGH

5. **1099 readiness.** All 5 vendors are flagged `is_1099_required = true`; **zero have a W-9 on file** and 4 of 5 have no EIN. Three exceed the $600 threshold: Mejia Contractor $13,000, JM Design Studio LLC $10,500, Hugo $2,500. Collect W-9s now.
6. **Missing invoices 001, 002, 013** — voided or unrecorded revenue?
7. **Accounting method** — cash or accrual? Nothing in the system declares it, and it changes the treatment of AR ($24,000), prepaid insurance, and vendor bills.
8. **Entity type and EIN** — sole proprietor, LLC, S-corp? The dashboard's Schedule C framing assumes sole proprietor / single-member LLC. If an S-corp election exists, reasonable-compensation rules apply to the owner.
9. **Owner draws and contributions** — untracked entirely. How has the owner been paid?

### MEDIUM

10. Confirm the three suspected duplicates (§G) — $1,372.33.
11. Meals treatment — 50% or 100% for the employee BBQ ($204.69)?
12. NJ sales tax on construction services — all invoices show $0 tax. Confirm exemption or non-taxability.
13. Prepaid insurance allocation across periods.
14. "Hammer Drill" $372.33 — expense or capitalize?

### LOW

15. Confirm the $0.65 mileage rate for 2026.
16. Recategorize the 59 "General" expenses.
17. Assign projects to the 48 unassigned expenses.

---

## J. Recommended Dashboard Improvements

**Correctness first:**

1. Use `payroll.gross_pay` for the P&L labor line, not imputed timesheet cost. Show imputed labor separately as a job-costing metric with a variance indicator.
2. Add employer payroll tax fields and include them in expenses.
3. Rebuild the balance sheet on real accounts (bank, credit card, loans, equity) or **remove it** — a statement that cannot tie is worse than none.
4. Fix `taxableIncome` — drop the `− accountsPayable` term.
5. Apply the 50% haircut to meals, or retag.
6. Make mileage and actual vehicle expenses mutually exclusive, with a warning when both exist.
7. Enforce a unique constraint on payments and a duplicate warning on expenses (same vendor + amount + date).

**Missing modules:** bank/credit card accounts with reconciliation, owner equity (contributions/draws), loans with principal-interest split, sales tax, estimated tax payments, fixed assets with depreciation (page exists, table empty).

**Presentation:** separate BOOKKEEPING from CPA REVIEW ITEMS; add a data-completeness banner (receipts missing, unreconciled payments, invoice gaps); add a year-end close status; make every KPI drill down to transactions.

---

## K. Accountant Document Checklist

**Available now:** P&L (with caveats), revenue detail by invoice, expense detail with Schedule C tags, vendor bill detail, timesheets, mileage log, client and vendor lists, AR aging.

**Missing — must produce:** bank statements (all accounts), credit card statements, loan statements, payroll reports and filed 941s/940, W-2/W-3, W-9s from all 5 vendors, receipts for expenses ≥ $75, owner draw/contribution records, prior-year return, entity formation documents and EIN, estimated tax payment records.

**Need to request:** W-9s from Mejia Contractor, JM Design Studio LLC, Hugo, Ladrillero #1, Ladrillero #2. Bank and credit card statements Jan–Dec 2026.

**Not applicable (confirm):** inventory (none tracked), sales tax returns (if services are non-taxable in NJ).

**CPA should confirm:** accounting method, entity type and election status, worker classification, vehicle deduction method, related-party treatment.

---

## L. Final Verdict

# 🔴 NOT READY — SIGNIFICANT ACCOUNTING ISSUES

The dashboard's arithmetic is trustworthy — every total I recalculated foots exactly. The problem is what it measures and what it omits.

**Must be completed before handing this to your accountant:**

1. Resolve the $24,733 labor discrepancy — this alone could swing net income by 72%.
2. Produce payroll tax records, or establish that these workers are contractors.
3. Supply bank and credit card statements so cash can be reconciled and a real balance sheet built.
4. Collect W-9s from all 5 vendors — three are over the $600 threshold.
5. Explain the $31,400 payments gap and the three missing invoice numbers.
6. Document the related-party payments to JM Design Studio LLC and Mejia Contractor.
7. Pick one vehicle deduction method.
8. Declare entity type and accounting method.

Items 1–3 are genuine blockers. Handing this over as-is means your accountant rebuilds the books from source documents anyway, and bills you for it.

---

*Prepared by automated audit against live transaction data. Not a substitute for review by a licensed CPA. No tax position here should be relied upon without professional confirmation.*
